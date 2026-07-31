import nodemailer from 'nodemailer';
import { PrismaClient, Campaign } from '@prisma/client';
import { CONFIG } from '../config';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  host: CONFIG.SMTP_HOST,
  port: CONFIG.SMTP_PORT,
  secure: CONFIG.SMTP_PORT === 465,
  auth: {
    user: CONFIG.SMTP_USER,
    pass: CONFIG.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
  rateDelta: 1000,
  rateLimit: 3,
});

export async function sendTestEmail(campaign: Campaign, to: string) {
  const unsubscribeUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/unsubscribe?email=${encodeURIComponent(to)}`;
  
  const html = campaign.body
    .replace(/{{company}}/g, 'Test Company')
    .replace(/{{website}}/g, 'https://example.com')
    .replace(/{{email}}/g, to)
    + `<br><br><hr><p style="font-size:12px;color:#666;">If you no longer wish to receive these emails, <a href="${unsubscribeUrl}">unsubscribe here</a>.</p>`;

  await transporter.sendMail({
    from: `"${campaign.fromName}" <${CONFIG.SMTP_FROM}>`,
    to,
    subject: campaign.subject,
    html,
    text: html.replace(/<[^>]*>/g, ''),
  });
}

export async function scheduleCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { contacts: { include: { contact: true } } },
  });

  if (!campaign || campaign.status === 'cancelled') return;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'sending' },
  });

  const batches = chunk(campaign.contacts, campaign.batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Check if cancelled
    const current = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (current?.status === 'cancelled') break;

    for (const cc of batch) {
      const contact = cc.contact;
      if (!contact.email) continue;

      // Check unsubscribe
      const unsubscribed = await prisma.unsubscribe.findUnique({
        where: { email: contact.email },
      });
      if (unsubscribed) {
        await prisma.campaignContact.update({
          where: { id: cc.id },
          data: { status: 'skipped' },
        });
        continue;
      }

      try {
        const unsubscribeUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/unsubscribe?email=${encodeURIComponent(contact.email)}`;
        
        const html = campaign.body
          .replace(/{{company}}/g, contact.companyName || 'there')
          .replace(/{{website}}/g, contact.website)
          .replace(/{{email}}/g, contact.email)
          + `<br><br><hr><p style="font-size:12px;color:#666;">If you no longer wish to receive these emails, <a href="${unsubscribeUrl}">unsubscribe here</a>.</p>`;

        await transporter.sendMail({
          from: `"${campaign.fromName}" <${CONFIG.SMTP_FROM}>`,
          to: contact.email,
          subject: campaign.subject,
          html,
          text: html.replace(/<[^>]*>/g, ''),
        });

        await prisma.campaignContact.update({
          where: { id: cc.id },
          data: { status: 'sent', sentAt: new Date() },
        });

        await prisma.emailLog.create({
          data: {
            campaignId: campaign.id,
            contactId: contact.id,
            status: 'sent',
          },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: 1 } },
        });
      } catch (err: any) {
        logger.error(`Failed to send to ${contact.email}: ${err.message}`);
        
        await prisma.campaignContact.update({
          where: { id: cc.id },
          data: { status: 'failed' },
        });

        await prisma.emailLog.create({
          data: {
            campaignId: campaign.id,
            contactId: contact.id,
            status: 'failed',
            error: err.message,
          },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
      }
    }

    // Delay between batches
    if (i < batches.length - 1) {
      await delay(campaign.batchDelayMinutes * 60 * 1000);
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'completed' },
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
