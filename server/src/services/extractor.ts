import * as cheerio from 'cheerio';
import { ExtractedContact } from '../types';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
const BUSINESS_PAGE_PATTERNS = [
  /contact/i, /about/i, /team/i, /careers?/i, /support/i,
  /help/i, /company/i, /offices?/i, /locations?/i
];

export function isBusinessPage(url: string): boolean {
  return BUSINESS_PAGE_PATTERNS.some((p) => p.test(url));
}

export function extractContacts(html: string, pageUrl: string, website: string): ExtractedContact[] {
  const $ = cheerio.load(html);
  const contacts: ExtractedContact[] = [];
  const seen = new Set<string>();

  const pageTitle = $('title').text().trim() || $('h1').first().text().trim();
  let companyName: string | undefined;

  // JSON-LD Schema.org extraction
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const data = Array.isArray(json) ? json : [json];
      for (const item of data) {
        if (item['@type'] === 'Organization' || item['@type'] === 'LocalBusiness') {
          companyName = item.name || companyName;
          const email = item.email || item.contactPoint?.email;
          const phone = item.telephone || item.contactPoint?.telephone;
          if (email || phone) {
            const key = `${email}-${phone}-${pageUrl}`;
            if (!seen.has(key)) {
              seen.add(key);
              contacts.push({
                companyName,
                website,
                email: normalizeEmail(email),
                phone: normalizePhone(phone),
                sourceUrl: pageUrl,
                pageTitle,
              });
            }
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  // mailto: and tel: links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const email = href.replace('mailto:', '').split('?')[0].trim();
    if (isValidEmail(email)) {
      const key = `${email}-${pageUrl}`;
      if (!seen.has(key)) {
        seen.add(key);
        contacts.push({
          companyName,
          website,
          email: normalizeEmail(email),
          sourceUrl: pageUrl,
          pageTitle,
        });
      }
    }
  });

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const phone = href.replace('tel:', '').trim();
    if (phone) {
      const key = `-${phone}-${pageUrl}`;
      if (!seen.has(key)) {
        seen.add(key);
        contacts.push({
          companyName,
          website,
          phone: normalizePhone(phone),
          sourceUrl: pageUrl,
          pageTitle,
        });
      }
    }
  });

  // Visible text extraction (only on business pages for precision)
  if (isBusinessPage(pageUrl)) {
    const text = $('body').text();
    const emails = text.match(EMAIL_REGEX) || [];
    const phones = text.match(PHONE_REGEX) || [];

    for (const email of emails) {
      if (isValidEmail(email)) {
        const key = `${email}-${pageUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          contacts.push({
            companyName,
            website,
            email: normalizeEmail(email),
            sourceUrl: pageUrl,
            pageTitle,
          });
        }
      }
    }

    for (const phone of phones) {
      const normalized = normalizePhone(phone);
      if (normalized && normalized.length >= 10) {
        const key = `-${normalized}-${pageUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          contacts.push({
            companyName,
            website,
            phone: normalized,
            sourceUrl: pageUrl,
            pageTitle,
          });
        }
      }
    }
  }

  return contacts;
}

function normalizeEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const cleaned = email.toLowerCase().trim();
  return isValidEmail(cleaned) ? cleaned : undefined;
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/[^\d+]/g, '').trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && 
    !email.includes('example.com') &&
    !email.includes('test.com') &&
    !email.startsWith('noreply') &&
    !email.startsWith('no-reply');
}
