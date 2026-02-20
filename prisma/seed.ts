import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${key}`;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@splaro.co';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'SPLARO Admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      provider: 'LOCAL',
      passwordHash: hashPassword(adminPassword),
    },
    create: {
      name: adminName,
      email: adminEmail,
      provider: 'LOCAL',
      passwordHash: hashPassword(adminPassword),
    },
  });

  await prisma.subscription.upsert({
    where: { email: 'hello@splaro.co' },
    update: {
      consent: true,
      source: 'seed',
    },
    create: {
      email: 'hello@splaro.co',
      consent: true,
      source: 'seed',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('seed_error', { message: error instanceof Error ? error.message : String(error) });
    await prisma.$disconnect();
    process.exit(1);
  });
