import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '5000'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'file:../database/dev.db',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  CRAWL_DELAY_MS: parseInt(process.env.CRAWL_DELAY_MS || '1000'),
  MAX_CRAWL_DEPTH: parseInt(process.env.MAX_CRAWL_DEPTH || '3'),
  MAX_PAGES_PER_SITE: parseInt(process.env.MAX_PAGES_PER_SITE || '50'),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@leadminer.local',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@leadminer.local',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
} as const;
