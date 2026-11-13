import crypto from 'node:crypto';

const SECRET_KEY = process.env.JWT_SECRET || 'zuigo_due_reminder_secret_key_2026';

/**
 * Hashes a plain password with a random salt using crypto.scryptSync
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against the stored salt:hash string
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;

  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);

  if (keyBuffer.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  exp: number;
}

/**
 * Creates a signed stateless session token
 */
export function createSessionToken(user: { id: string; email: string; name: string; role: string }): string {
  const payload: SessionUser = {
    ...user,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(b64Payload).digest('base64url');
  return `${b64Payload}.${signature}`;
}

/**
 * Verifies and parses a signed session token
 */
export function verifySessionToken(token: string): SessionUser | null {
  if (!token || !token.includes('.')) return null;
  const [b64Payload, signature] = token.split('.');
  if (!b64Payload || !signature) return null;

  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(b64Payload).digest('base64url');
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSig);

  if (sigBuffer.length !== expBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expBuffer)) return null;

  try {
    const payload: SessionUser = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null; // expired
    return payload;
  } catch {
    return null;
  }
}
