import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('zuigo_session')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = verifySessionToken(token);

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
