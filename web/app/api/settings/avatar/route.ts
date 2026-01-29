
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pump = promisify(pipeline);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return NextResponse.json({ error: 'File size too large (max 5MB)' }, { status: 400 });
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${session.user.name}_${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'avatars');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Delete old avatar if exists
    try {
        const currentUser = db.prepare('SELECT avatar FROM users WHERE email = ?').get(session.user.email) as any;
        if (currentUser?.avatar) {
            const oldFilename = currentUser.avatar.split('/').pop();
            if (oldFilename) {
                const oldPath = path.join(uploadDir, oldFilename);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
        }
    } catch (e) {
        console.error('Failed to cleanup old avatar', e);
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    const publicPath = `/avatars/${filename}`;

    // Update database
    db.prepare('UPDATE users SET avatar = ? WHERE email = ?').run(publicPath, session.user.email);

    return NextResponse.json({ avatar: publicPath });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
