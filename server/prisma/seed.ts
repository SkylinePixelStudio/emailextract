import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CONFIG } from '../src/config';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: CONFIG.ADMIN_EMAIL },
  });

  if (!existing) {
    const hashed = await bcrypt.hash(CONFIG.ADMIN_PASSWORD, CONFIG.BCRYPT_ROUNDS);
    await prisma.user.create({
      data: {
        email: CONFIG.ADMIN_EMAIL,
        password: hashed,
        name: 'System Administrator',
        role: 'admin',
      },
    });
    console.log('✅ Admin user created');
  } else {
    console.log('ℹ️ Admin user already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
