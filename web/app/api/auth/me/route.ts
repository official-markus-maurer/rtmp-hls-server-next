
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';
import { cookies } from 'next/headers';

const JWT_SECRET = 'your-secret-key-change-this';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare('SELECT id, username, email, stream_key FROM users WHERE id = ?').get(decoded.id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });

  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export async function POST() {
    // Logout
    const response = NextResponse.json({ success: true });
    response.cookies.set('auth_token', '', { maxAge: 0 });
    return response;
}
