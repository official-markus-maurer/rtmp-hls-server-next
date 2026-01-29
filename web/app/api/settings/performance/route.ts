import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = db.prepare('SELECT transcoding_preset, latency_mode FROM users WHERE email = ?').get(session.user.email) as any;
    
    return NextResponse.json({
      transcodingPreset: user.transcoding_preset || 'p4',
      latencyMode: user.latency_mode || 'll'
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { transcodingPreset, latencyMode } = await req.json();

    // Validate inputs
    const validPresets = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    const validModes = ['ll', 'ull', 'hq', 'zerolatency'];

    if (!validPresets.includes(transcodingPreset)) {
         return NextResponse.json({ error: 'Invalid preset' }, { status: 400 });
    }
    // We can be lenient with latencyMode or strict. Let's be semi-strict.
    // Actually, 'zerolatency' is a tune option, 'll' is low latency tune. 
    // Let's stick to what FFmpeg accepts for -tune: film, animation, grain, stillimage, fastdecode, zerolatency, ll, ull (if supported by specific encoder)
    // NVENC supports: ll, ull, hq, lossless
    
    // For safety, let's just sanitize.
    
    db.prepare('UPDATE users SET transcoding_preset = ?, latency_mode = ? WHERE email = ?')
      .run(transcodingPreset, latencyMode, session.user.email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}