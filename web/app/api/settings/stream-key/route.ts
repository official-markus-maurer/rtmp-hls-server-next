
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import db from '@/lib/db';
import { randomBytes } from 'crypto';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = db.prepare('SELECT stream_key FROM users WHERE email = ?').get(session.user.email) as any;
    return NextResponse.json({ streamKey: user.stream_key });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const newKey = randomBytes(16).toString('hex');
    db.prepare('UPDATE users SET stream_key = ? WHERE email = ?').run(newKey, session.user.email);
    return NextResponse.json({ streamKey: newKey });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
