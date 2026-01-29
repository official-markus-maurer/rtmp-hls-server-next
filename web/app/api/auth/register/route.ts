
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { randomBytes } from 'crypto';

export async function POST(req: Request) {
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate random stream key
    const streamKey = randomBytes(16).toString('hex');

    // Insert user
    const insert = db.prepare('INSERT INTO users (username, email, password, stream_key) VALUES (?, ?, ?, ?)');
    const info = insert.run(username, email, hashedPassword, streamKey);

    return NextResponse.json({ 
      success: true, 
      user: { id: info.lastInsertRowid, username, email, streamKey } 
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
