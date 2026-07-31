export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface CrawlStatus {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  progress: number;
  urlsFound: number;
  contactsFound: number;
  currentUrl: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedContact {
  companyName?: string;
  website: string;
  email?: string;
  phone?: string;
  sourceUrl: string;
  pageTitle?: string;
  tags?: string[];
}

export interface CampaignInput {
  name: string;
  subject: string;
  body: string;
  fromName: string;
  contactIds: string[];
  scheduleAt?: Date;
  batchSize?: number;
  batchDelayMinutes?: number;
}

export interface EmailLogEntry {
  id: string;
  campaignId: string;
  contactId: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  error?: string;
  sentAt?: Date;
}
