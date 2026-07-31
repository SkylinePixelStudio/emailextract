import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = (req.query.search as string) || '';
    const tag = (req.query.tag as string) || '';
    const hasEmail = req.query.hasEmail === 'true';

    const where: any = {};
    
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (tag) where.tags = { contains: tag };
    if (hasEmail) where.email = { not: null };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({ contacts, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      companyName: z.string().optional(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      tags: z.string().optional(),
      notes: z.string().optional(),
    });
    
    const data = schema.parse(req.body);
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data,
    });
    res.json(contact);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
