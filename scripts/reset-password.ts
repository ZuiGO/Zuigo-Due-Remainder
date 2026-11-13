// Usage (PowerShell):  npx tsx scripts/reset-password.ts <email> <new-password> [name]
// Resets the password of an existing user, or creates the account as ADMIN if it does not exist.
import prisma from '../src/lib/db';
import { hashPassword } from '../src/lib/auth';

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: npx tsx scripts/reset-password.ts <email> <new-password> [name]');
    process.exit(1);
  }
  const clean = email.trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email: clean } });
  if (existing) {
    await prisma.user.update({ where: { email: clean }, data: { passwordHash } });
    console.log(`Password reset for ${clean}`);
  } else {
    const tenant = await prisma.tenant.findFirst({ where: { slug: 'abmato' } });
    await prisma.user.create({
      data: { email: clean, passwordHash, name: name || 'Admin', role: 'ADMIN', tenantId: tenant?.id ?? null },
    });
    console.log(`Account created: ${clean} (ADMIN)`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
