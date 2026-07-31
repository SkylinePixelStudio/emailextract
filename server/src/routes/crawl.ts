import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { startCrawl, stopCrawl } from '../services/crawler';

const router = Router();
const prisma = new PrismaClient();

const crawlSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(100),
  depth: z.number().min(1).max(5).default(2),
  maxPages: z.number().min(1).max(200).default(50),
  respectRobots: z.boolean().default(true),
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { urls, depth, maxPages, respectRobots } = crawlSchema.parse(req.body);
    
    const job = await prisma.crawlJob.create({
      data: {
        startUrl: urls[0],
        urls: JSON.stringify(urls),
        depth,
        maxPages,
        respectRobots,
        status: 'pending',
      },
    });

    // Start crawl in background
    startCrawl({ jobId: job.id, urls, depth, maxPages, respectRobots }).catch(console.error);

    res.status(202).json(job);
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const jobs = await prisma.crawlJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const job = await prisma.crawlJob.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pause', authenticate, async (req, res, next) => {
  try {
    const job = await prisma.crawlJob.update({
      where: { id: req.params.id },
      data: { paused: true },
    });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/resume', authenticate, async (req, res, next) => {
  try {
    const job = await prisma.crawlJob.update({
      where: { id: req.params.id },
      data: { paused: false, status: 'running' },
    });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/stop', authenticate, async (req, res, next) => {
  try {
    stopCrawl(req.params.id);
    const job = await prisma.crawlJob.update({
      where: { id: req.params.id },
      data: { stopped: true },
    });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

export default router;
