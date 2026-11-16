import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword, createSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // Auto-seed default admin if user table is clean or default admin is logging in
    if (!user && (cleanEmail === 'jayesh@zuigo.ai' || cleanEmail === 'admin@zuigo.ai')) {
      const { hashPassword } = await import('@/lib/auth');
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: 'Zuigo Admin',
          role: 'ADMIN',
          passwordHash: hashPassword('zuigo123'),
        },
      });
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      message: 'Logged in successfully',
    });

    // Only set Secure if protocol is HTTPS (never on plain HTTP localhost)
    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https:');

    response.cookies.set('zuigo_session', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error during login' },
      { status: 500 }
    );
  }
}
