import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { scheduleCampaign } from '../services/campaignSender';

const router = Router();
const prisma = new PrismaClient();

const campaignSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  fromName: z.string().min(1),
  contactIds: z.array(z.string()).min(1),
  scheduleAt: z.string().datetime().optional(),
  batchSize: z.number().min(1).max(500).default(50),
  batchDelayMinutes: z.number().min(1).default(60),
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = campaignSchema.parse(req.body);
    
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        fromName: data.fromName,
        status: data.scheduleAt ? 'scheduled' : 'sending',
        scheduleAt: data.scheduleAt ? new Date(data.scheduleAt) : null,
        batchSize: data.batchSize,
        batchDelayMinutes: data.batchDelayMinutes,
        totalCount: data.contactIds.length,
      },
    });

    // Create campaign contacts
    await prisma.campaignContact.createMany({
      data: data.contactIds.map((contactId) => ({
        campaignId: campaign.id,
        contactId,
      })),
      skipDuplicates: true,
    });

    if (!data.scheduleAt) {
      scheduleCampaign(campaign.id).catch(console.error);
    }

    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { contacts: true, emailLogs: true } },
      },
    });
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        contacts: { include: { contact: true } },
        emailLogs: { orderBy: { sentAt: 'desc' }, take: 100 },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Not found' });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send-test', authenticate, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const { id } = req.params;
    
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { sendTestEmail } = await import('../services/campaignSender');
    await sendTestEmail(campaign, email);
    
    res.json({ success: true, message: 'Test email sent' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { status: 'cancelled' },
    });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

export default router;
