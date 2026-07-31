import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.post('/', async (req, res, next) => {
  try {
    const { email, reason } = z.object({
      email: z.string().email(),
      reason: z.string().optional(),
    }).parse(req.body);

    await prisma.unsubscribe.upsert({
      where: { email },
      update: { reason },
      create: { email, reason },
    });

    res.json({ success: true, message: 'You have been unsubscribed' });
  } catch (err) {
    next(err);
  }
});

router.get('/check', async (req, res, next) => {
  try {
    const email = req.query.email as string;
    const exists = await prisma.unsubscribe.findUnique({ where: { email } });
    res.json({ unsubscribed: !!exists });
  } catch (err) {
    next(err);
  }
});

export default router;
