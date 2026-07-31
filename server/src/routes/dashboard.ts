import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/stats', authenticate, async (_req, res, next) => {
  try {
    const [
      totalContacts,
      totalEmails,
      totalPhones,
      totalCrawls,
      totalCampaigns,
      recentCrawls,
      recentCampaigns,
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { email: { not: null } } }),
      prisma.contact.count({ where: { phone: { not: null } } }),
      prisma.crawlJob.count(),
      prisma.campaign.count(),
      prisma.crawlJob.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);

    res.json({
      totalContacts,
      totalEmails,
      totalPhones,
      totalCrawls,
      totalCampaigns,
      recentCrawls,
      recentCampaigns,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
