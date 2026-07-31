import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config';
import { canCrawl } from './robots';
import { extractContacts, isBusinessPage } from './extractor';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const activeJobs = new Map<string, AbortController>();

const USER_AGENT = 'LeadMinerBot/1.0 (Business Contact Research Bot; https://leadminer.local)';

export interface CrawlOptions {
  jobId: string;
  urls: string[];
  depth: number;
  maxPages: number;
  respectRobots: boolean;
}

export async function startCrawl(options: CrawlOptions) {
  const { jobId, urls, depth, maxPages, respectRobots } = options;
  const controller = new AbortController();
  activeJobs.set(jobId, controller);

  const visited = new Set<string>();
  const queue: { url: string; level: number }[] = urls.map((u) => ({ url: normalizeUrl(u), level: 0 }));
  let pagesCrawled = 0;
  let contactsFound = 0;

  try {
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: 'running', progress: 0 },
    });

    while (queue.length > 0 && pagesCrawled < maxPages) {
      const job = await prisma.crawlJob.findUnique({ where: { id: jobId } });
      if (!job || job.stopped) {
        await prisma.crawlJob.update({
          where: { id: jobId },
          data: { status: 'stopped', progress: 100 },
        });
        activeJobs.delete(jobId);
        return;
      }

      if (job.paused) {
        await prisma.crawlJob.update({
          where: { id: jobId },
          data: { status: 'paused' },
        });
        await delay(2000);
        continue;
      }

      const { url, level } = queue.shift()!;
      if (visited.has(url) || level > depth) continue;
      visited.add(url);

      // Respect robots.txt
      if (respectRobots && !(await canCrawl(url, USER_AGENT))) {
        logger.info(`Robots.txt blocked: ${url}`);
        continue;
      }

      try {
        await prisma.crawlJob.update({
          where: { id: jobId },
          data: { currentUrl: url },
        });

        const { data: html } = await axios.get(url, {
          timeout: 15000,
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
          maxRedirects: 5,
        });

        const baseUrl = new URL(url).origin;
        const contacts = extractContacts(html, url, baseUrl);
        
        for (const contact of contacts) {
          if (contact.email) {
            const exists = await prisma.contact.findFirst({
              where: { email: contact.email, website: contact.website },
            });
            if (!exists) {
              await prisma.contact.create({
                data: {
                  ...contact,
                  tags: 'auto-crawled',
                  crawlJobId: jobId,
                },
              });
              contactsFound++;
            }
          }
        }

        // Extract internal links if we haven't reached max depth
        if (level < depth) {
          const $ = cheerio.load(html);
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            try {
              const nextUrl = new URL(href, baseUrl).href;
              const nextHost = new URL(nextUrl).host;
              if (nextHost === new URL(url).host && !visited.has(nextUrl)) {
                // Prioritize business pages
                if (isBusinessPage(nextUrl)) {
                  queue.unshift({ url: nextUrl, level: level + 1 });
                } else {
                  queue.push({ url: nextUrl, level: level + 1 });
                }
              }
            } catch {
              // Invalid URL
            }
          });
        }

        pagesCrawled++;
        const progress = Math.min(100, Math.round((pagesCrawled / Math.min(maxPages, queue.length + pagesCrawled)) * 100));
        
        await prisma.crawlJob.update({
          where: { id: jobId },
          data: {
            progress,
            urlsFound: visited.size,
            contactsFound,
          },
        });

        // Rate limiting
        await delay(CONFIG.CRAWL_DELAY_MS);
      } catch (err: any) {
        logger.error(`Crawl error for ${url}: ${err.message}`);
        continue;
      }
    }

    await prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        urlsFound: visited.size,
        contactsFound,
        currentUrl: null,
      },
    });
  } catch (err: any) {
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: err.message, currentUrl: null },
    });
  } finally {
    activeJobs.delete(jobId);
  }
}

export function stopCrawl(jobId: string) {
  const controller = activeJobs.get(jobId);
  if (controller) {
    controller.abort();
    activeJobs.delete(jobId);
  }
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http')) return `https://${url}`;
  return url;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
