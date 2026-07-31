import robotsParser from 'robots-parser';
import axios from 'axios';

const cache = new Map<string, ReturnType<typeof robotsParser>>();

export async function canCrawl(url: string, userAgent = '*'): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
    
    if (!cache.has(robotsUrl)) {
      const { data } = await axios.get(robotsUrl, { timeout: 5000 });
      cache.set(robotsUrl, robotsParser(robotsUrl, data));
    }
    
    const robots = cache.get(robotsUrl)!;
    return robots.isAllowed(url, userAgent) ?? true;
  } catch {
    return true;
  }
}
