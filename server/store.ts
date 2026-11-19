import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AuthUser, SupportTicket, SupportTicketStatus } from '../src/types/medradar.ts';

export interface SessionRecord {
  tokenHash: string;
  userId: string | null;
  isSupportTeam: boolean;
  rememberMe: boolean;
  expiresAt: number;
  createdAt: string;
}

export interface OtpChallengeRecord {
  phoneE164: string;
  otpHmacHash: string;
  mode: 'register' | 'login';
  attempts: number;
  expiresAt: number;
  lastSentAt: number;
}

interface StoreData {
  serverSecret: string;
  users: AuthUser[];
  sessions: SessionRecord[];
  otpChallenges: OtpChallengeRecord[];
  supportTickets: SupportTicket[];
}

const DATA_DIR = path.resolve(process.cwd(), '.medradar-data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function defaultStore(): StoreData {
  return {
    serverSecret: crypto.randomBytes(32).toString('hex'),
    users: [],
    sessions: [],
    otpChallenges: [],
    supportTickets: [],
  };
}

export function loadStore(): StoreData {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    const initial = defaultStore();
    saveStore(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      serverSecret:
        typeof parsed.serverSecret === 'string' && parsed.serverSecret.length >= 32
          ? parsed.serverSecret
          : crypto.randomBytes(32).toString('hex'),
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      otpChallenges: Array.isArray(parsed.otpChallenges) ? parsed.otpChallenges : [],
      supportTickets: Array.isArray(parsed.supportTickets) ? parsed.supportTickets : [],
    };
  } catch {
    const fallback = defaultStore();
    saveStore(fallback);
    return fallback;
  }
}

export function saveStore(data: StoreData): void {
  ensureDataDir();
  const now = Date.now();
  const pruned: StoreData = {
    ...data,
    sessions: data.sessions.filter((s) => s.expiresAt > now),
    otpChallenges: data.otpChallenges.filter((c) => c.expiresAt > now),
  };
  fs.writeFileSync(STORE_PATH, JSON.stringify(pruned, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function getEffectiveSecret(store: StoreData): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : store.serverSecret;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function hashOtp(phoneE164: string, otpCode: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${phoneE164}:${otpCode}`).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function normalizePhoneE164(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  if (!/^\+[1-9]\d{7,14}$/.test(withPlus)) {
    return null;
  }
  return withPlus;
}

export function isConfiguredAdminPhone(phoneE164: string): boolean {
  const rawList = process.env.SUPPORT_ADMIN_PHONES?.trim();
  if (!rawList) return false;
  const admins = rawList
    .split(',')
    .map((p) => normalizePhoneE164(p))
    .filter((p): p is string => Boolean(p));
  return admins.includes(phoneE164);
}

export function generateUniqueTicketNumber(existing: SupportTicket[]): string {
  const used = new Set(existing.map((t) => t.ticketNumber));
  for (let i = 0; i < 40; i += 1) {
    const num = `#${crypto.randomInt(10000, 100000)}`;
    if (!used.has(num)) return num;
  }
  return `#${String(Date.now()).slice(-6)}`;
}

export function sanitizeTicketStatus(status: unknown): SupportTicketStatus | null {
  if (status === 'New' || status === 'In Progress' || status === 'Resolved') {
    return status;
  }
  return null;
}
