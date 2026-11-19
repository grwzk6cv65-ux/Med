import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import nodemailer from 'nodemailer';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), '.medradar-data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SESSION_TTL_DEFAULT_MS = 1000 * 60 * 60 * 12; // 12 hours
const SESSION_TTL_REMEMBER_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const OTP_TTL_MS = 1000 * 60 * 10; // 10 minutes
const SESSION_COOKIE_NAME = 'medradar_session';
const SUPPORT_TEAM_COOKIE_NAME = 'medradar_support_team';

// Runtime server HMAC secret (never exposed to browser)
const SERVER_HMAC_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

type SupportTicketStatus = 'New' | 'In Progress' | 'Resolved';

interface StoredUser {
  id: string;
  phoneE164: string;
  fullName: string;
  villageName: string;
  email: string;
  accountRole: 'patient' | 'doctor';
  isSupportAdmin: boolean;
  profileCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoredSession {
  tokenHash: string;
  userId: string;
  isSupportAdmin: boolean;
  rememberMe: boolean;
  expiresAt: number;
  createdAt: string;
}

interface HashedOtpChallenge {
  phoneHash: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  sentAt: number;
}

interface StoredSupportTicket {
  id: string;
  ticketNumber: string;
  userId: string | null;
  submittedByName: string;
  phoneNumber: string;
  replyEmail: string;
  subject: string;
  message: string;
  pageFeature: string;
  status: SupportTicketStatus;
  emailDelivery: {
    sent: boolean;
    configured: boolean;
    recipient: string;
    sentAt?: string;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface StoreShape {
  users: StoredUser[];
  sessions: StoredSession[];
  otpChallenges: HashedOtpChallenge[];
  supportTickets: StoredSupportTicket[];
}

function ensureStore(): StoreShape {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const empty: StoreShape = {
      users: [],
      sessions: [],
      otpChallenges: [],
      supportTickets: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2), { mode: 0o600 });
    return empty;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      otpChallenges: Array.isArray(parsed.otpChallenges) ? parsed.otpChallenges : [],
      supportTickets: Array.isArray(parsed.supportTickets) ? parsed.supportTickets : [],
    };
  } catch {
    return { users: [], sessions: [], otpChallenges: [], supportTickets: [] };
  }
}

function saveStore(store: StoreShape): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
  const now = Date.now();
  store.sessions = store.sessions.filter((s) => s.expiresAt > now);
  store.otpChallenges = store.otpChallenges.filter((c) => c.expiresAt > now);
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacDigest(value: string): string {
  return crypto.createHmac('sha256', SERVER_HMAC_SECRET).update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizePhoneE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) return null;
  return cleaned;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

function extractSessionToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const bearer = auth.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function appendCookie(res: Response, cookieStr: string): void {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', [cookieStr]);
  } else if (Array.isArray(prev)) {
    res.setHeader('Set-Cookie', [...prev.map(String), cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [String(prev), cookieStr]);
  }
}

function setCookieHeader(
  res: Response,
  name: string,
  value: string,
  maxAgeMs: number,
  isSecureReq: boolean
): void {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    isSecureReq ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  appendCookie(res, parts.join('; '));
}

function getSmsConfig() {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const verifySid = (process.env.TWILIO_VERIFY_SERVICE_SID || '').trim();
  const fromNumber = (process.env.TWILIO_FROM_NUMBER || '').trim();

  const hasVerify = Boolean(accountSid && authToken && verifySid);
  const hasMessaging = Boolean(accountSid && authToken && fromNumber);
  const missingSmsVars: string[] = [];
  if (!accountSid) missingSmsVars.push('TWILIO_ACCOUNT_SID');
  if (!authToken) missingSmsVars.push('TWILIO_AUTH_TOKEN');
  if (!verifySid && !fromNumber) {
    missingSmsVars.push('TWILIO_VERIFY_SERVICE_SID (or TWILIO_FROM_NUMBER)');
  }

  return {
    configured: hasVerify || hasMessaging,
    mode: hasVerify ? ('twilio_verify' as const) : hasMessaging ? ('twilio_sms' as const) : ('none' as const),
    accountSid,
    authToken,
    verifySid,
    fromNumber,
    missingSmsVars,
  };
}

function getEmailConfig() {
  const supportEmail = (process.env.SUPPORT_EMAIL || 'your-support-email@example.com').trim();
  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = (process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true';
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpFrom = (process.env.SMTP_FROM || smtpUser || 'no-reply@example.com').trim();

  const supportEmailPlaceholder =
    !supportEmail ||
    supportEmail === 'your-support-email@example.com' ||
    !supportEmail.includes('@');

  const missingEmailVars: string[] = [];
  if (supportEmailPlaceholder) missingEmailVars.push('SUPPORT_EMAIL');
  if (!smtpHost) missingEmailVars.push('SMTP_HOST');
  if (!smtpUser) missingEmailVars.push('SMTP_USER');
  if (!smtpPass) missingEmailVars.push('SMTP_PASS');

  const supportEmailPreview = supportEmailPlaceholder
    ? 'your-support-email@example.com'
    : supportEmail.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.min(4, b.length))}${c}`);

  return {
    configured: !supportEmailPlaceholder && Boolean(smtpHost && smtpUser && smtpPass),
    supportEmailPlaceholder,
    supportEmail,
    supportEmailPreview,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
    missingEmailVars,
  };
}

function isPhoneSupportAdmin(phoneE164: string): boolean {
  const raw = (process.env.SUPPORT_ADMIN_PHONES || '').trim();
  if (!raw) return false;
  const list = raw
    .split(',')
    .map((item) => normalizePhoneE164(item.trim()))
    .filter((item): item is string => Boolean(item));
  return list.includes(phoneE164);
}

function generateUniqueTicketNumber(existing: StoredSupportTicket[]): string {
  const used = new Set(existing.map((t) => t.ticketNumber));
  for (let i = 0; i < 20; i++) {
    const num = `#${crypto.randomInt(10000, 99999)}`;
    if (!used.has(num)) return num;
  }
  return `#${Date.now().toString().slice(-6)}`;
}

async function sendTwilioVerifyOtp(phoneE164: string): Promise<{ ok: boolean; error?: string }> {
  const sms = getSmsConfig();
  if (sms.mode === 'twilio_verify') {
    const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(sms.verifySid)}/Verifications`;
    const body = new URLSearchParams({ To: phoneE164, Channel: 'sms' });
    const authHeader = Buffer.from(`${sms.accountSid}:${sms.authToken}`).toString('base64');
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      return { ok: false, error: `SMS provider rejected request (${resp.status}): ${errBody.slice(0, 180)}` };
    }
    return { ok: true };
  }

  if (sms.mode === 'twilio_sms') {
    const otp = String(crypto.randomInt(100000, 999999));
    const store = ensureStore();
    const phoneHash = hmacDigest(phoneE164);
    const existing = store.otpChallenges.find((c) => c.phoneHash === phoneHash);
    if (existing && Date.now() - existing.sentAt < 30_000) {
      return { ok: false, error: 'Please wait 30 seconds before requesting another SMS code.' };
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sms.accountSid)}/Messages.json`;
    const body = new URLSearchParams({
      To: phoneE164,
      From: sms.fromNumber,
      Body: `MEDRADAR verification code: ${otp}. Valid for 10 minutes. Never share this code.`,
    });
    const authHeader = Buffer.from(`${sms.accountSid}:${sms.authToken}`).toString('base64');
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      return { ok: false, error: `SMS gateway error (${resp.status}): ${errBody.slice(0, 180)}` };
    }

    // Store ONLY HMAC digest of phone & OTP code (never plain text)
    store.otpChallenges = store.otpChallenges.filter((c) => c.phoneHash !== phoneHash);
    store.otpChallenges.push({
      phoneHash,
      codeHash: hmacDigest(`${phoneE164}:${otp}`),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      sentAt: Date.now(),
    });
    saveStore(store);
    return { ok: true };
  }

  return { ok: false, error: 'SMS verification service is not configured.' };
}

async function verifyTwilioOtp(phoneE164: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const sms = getSmsConfig();
  if (sms.mode === 'twilio_verify') {
    const endpoint = `https://verify.twilio.com/v2/Services/${encodeURIComponent(sms.verifySid)}/VerificationCheck`;
    const body = new URLSearchParams({ To: phoneE164, Code: code });
    const authHeader = Buffer.from(`${sms.accountSid}:${sms.authToken}`).toString('base64');
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const data = (await resp.json().catch(() => ({}))) as { status?: string; message?: string };
    if (!resp.ok || data.status !== 'approved') {
      return { ok: false, error: data.message || 'Invalid or expired verification code.' };
    }
    return { ok: true };
  }

  if (sms.mode === 'twilio_sms') {
    const store = ensureStore();
    const phoneHash = hmacDigest(phoneE164);
    const challenge = store.otpChallenges.find((c) => c.phoneHash === phoneHash);
    if (!challenge || challenge.expiresAt < Date.now()) {
      return { ok: false, error: 'Verification code expired or not found. Please request a new SMS code.' };
    }
    if (challenge.attempts >= 5) {
      return { ok: false, error: 'Too many verification attempts. Please request a new SMS code.' };
    }
    const candidateHash = hmacDigest(`${phoneE164}:${code}`);
    if (!safeEqualHex(challenge.codeHash, candidateHash)) {
      challenge.attempts += 1;
      saveStore(store);
      return { ok: false, error: 'Incorrect verification code.' };
    }
    store.otpChallenges = store.otpChallenges.filter((c) => c.phoneHash !== phoneHash);
    saveStore(store);
    return { ok: true };
  }

  return { ok: false, error: 'SMS verification service is not configured.' };
}

interface AuthedContext {
  session?: StoredSession;
  user?: StoredUser;
  isSupportTeam: boolean;
}

function getAuthContext(req: Request): AuthedContext {
  const store = ensureStore();
  const token = extractSessionToken(req);
  let session: StoredSession | undefined;
  let user: StoredUser | undefined;

  if (token) {
    const tokenHash = sha256(token);
    session = store.sessions.find((s) => s.tokenHash === tokenHash && s.expiresAt > Date.now());
    if (session) {
      user = store.users.find((u) => u.id === session!.userId);
    }
  }

  const cookies = parseCookies(req);
  const supportTeamCookie = cookies[SUPPORT_TEAM_COOKIE_NAME];
  const passcode = (process.env.SUPPORT_TEAM_PASSCODE || '').trim();
  const hasPasscodeCookie =
    Boolean(passcode) &&
    Boolean(supportTeamCookie) &&
    safeEqualHex(supportTeamCookie, hmacDigest(`support-team:${passcode}`));

  const isSupportTeam = Boolean(session?.isSupportAdmin || user?.isSupportAdmin || hasPasscodeCookie);

  return { session, user, isSupportTeam };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  // 1. Public capability status (NEVER returns secret values)
  app.get('/api/config/status', (_req: Request, res: Response) => {
    const sms = getSmsConfig();
    const email = getEmailConfig();
    res.json({
      smsConfigured: sms.configured,
      smsProvider: sms.mode,
      missingSmsVars: sms.missingSmsVars,
      emailConfigured: email.configured,
      supportEmailPlaceholder: email.supportEmailPlaceholder,
      supportEmailPreview: email.supportEmailPreview,
      missingEmailVars: email.missingEmailVars,
      supportTeamPasscodeConfigured: Boolean((process.env.SUPPORT_TEAM_PASSCODE || '').trim()),
    });
  });

  // 2. Request real SMS OTP (Register or Login)
  app.post('/api/auth/request-otp', async (req: Request, res: Response) => {
    const phoneE164 = normalizePhoneE164(String(req.body?.phone || ''));
    const mode = req.body?.mode === 'register' ? 'register' : 'login';

    if (!phoneE164) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_PHONE',
        error: 'Enter a valid mobile phone number with country code (e.g. +77015550101).',
      });
      return;
    }

    const store = ensureStore();
    const existingUser = store.users.find((u) => u.phoneE164 === phoneE164);

    if (mode === 'login' && !existingUser) {
      res.status(404).json({
        ok: false,
        code: 'ACCOUNT_NOT_FOUND',
        error: 'No MEDRADAR account is registered with this phone number yet. Switch to Register first.',
      });
      return;
    }

    const sms = getSmsConfig();
    if (!sms.configured) {
      res.status(503).json({
        ok: false,
        configured: false,
        code: 'SMS_NOT_CONFIGURED',
        missingVars: sms.missingSmsVars,
        error:
          'Real SMS verification service is not configured on the server. MEDRADAR never issues fake verification codes.',
      });
      return;
    }

    try {
      const sent = await sendTwilioVerifyOtp(phoneE164);
      if (!sent.ok) {
        res.status(502).json({ ok: false, code: 'SMS_DELIVERY_FAILED', error: sent.error });
        return;
      }
      res.json({
        ok: true,
        phoneE164,
        expiresInSeconds: 600,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        code: 'SMS_NETWORK_ERROR',
        error: err instanceof Error ? err.message : 'Unable to reach SMS verification service.',
      });
    }
  });

  // 3. Verify SMS OTP & Issue Secure Session
  app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
    const phoneE164 = normalizePhoneE164(String(req.body?.phone || ''));
    const code = String(req.body?.code || '').trim();
    const rememberMe = Boolean(req.body?.rememberMe);

    if (!phoneE164 || !/^\d{4,8}$/.test(code)) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_OTP_INPUT',
        error: 'Provide a valid phone number and the SMS verification code.',
      });
      return;
    }

    const sms = getSmsConfig();
    if (!sms.configured) {
      res.status(503).json({
        ok: false,
        configured: false,
        code: 'SMS_NOT_CONFIGURED',
        missingVars: sms.missingSmsVars,
        error: 'Real SMS verification service is not configured on the server.',
      });
      return;
    }

    try {
      const verified = await verifyTwilioOtp(phoneE164, code);
      if (!verified.ok) {
        res.status(401).json({ ok: false, code: 'OTP_REJECTED', error: verified.error });
        return;
      }

      const store = ensureStore();
      const nowIso = new Date().toISOString();
      let user = store.users.find((u) => u.phoneE164 === phoneE164);
      let isNewAccount = false;
      const isSupportAdmin = isPhoneSupportAdmin(phoneE164);

      if (!user) {
        isNewAccount = true;
        user = {
          id: `USR-${crypto.randomUUID()}`,
          phoneE164,
          fullName: '',
          villageName: '',
          email: '',
          accountRole: 'patient',
          isSupportAdmin,
          profileCompleted: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        store.users.push(user);
      } else if (user.isSupportAdmin !== isSupportAdmin) {
        user.isSupportAdmin = isSupportAdmin;
        user.updatedAt = nowIso;
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const ttlMs = rememberMe ? SESSION_TTL_REMEMBER_MS : SESSION_TTL_DEFAULT_MS;
      const expiresAt = Date.now() + ttlMs;

      store.sessions.push({
        tokenHash: sha256(rawToken),
        userId: user.id,
        isSupportAdmin,
        rememberMe,
        expiresAt,
        createdAt: nowIso,
      });
      saveStore(store);

      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      setCookieHeader(res, SESSION_COOKIE_NAME, rawToken, ttlMs, isSecure);

      res.json({
        ok: true,
        user,
        isNewAccount,
        sessionToken: rawToken,
        expiresAt,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        code: 'OTP_VERIFY_ERROR',
        error: err instanceof Error ? err.message : 'Verification failed.',
      });
    }
  });

  // 4. Current Authenticated User
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const ctx = getAuthContext(req);
    res.json({
      authenticated: Boolean(ctx.user),
      user: ctx.user || null,
      isSupportTeam: ctx.isSupportTeam,
    });
  });

  // 5. Complete or Update Authenticated User Profile
  app.post('/api/auth/complete-profile', (req: Request, res: Response) => {
    const ctx = getAuthContext(req);
    if (!ctx.user) {
      res.status(401).json({ ok: false, error: 'Authentication required.' });
      return;
    }

    const fullName = String(req.body?.fullName || '').trim();
    const villageName = String(req.body?.villageName || '').trim();
    const email = String(req.body?.email || '').trim();
    const accountRole = req.body?.accountRole === 'doctor' ? 'doctor' : 'patient';

    if (fullName.length < 2 || fullName.length > 80) {
      res.status(400).json({ ok: false, error: 'Full name must be between 2 and 80 characters.' });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
      return;
    }

    const store = ensureStore();
    const idx = store.users.findIndex((u) => u.id === ctx.user!.id);
    if (idx === -1) {
      res.status(404).json({ ok: false, error: 'User account not found.' });
      return;
    }

    store.users[idx] = {
      ...store.users[idx],
      fullName,
      villageName,
      email,
      accountRole,
      profileCompleted: true,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);

    res.json({ ok: true, user: store.users[idx] });
  });

  // 6. Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractSessionToken(req);
    if (token) {
      const store = ensureStore();
      const tokenHash = sha256(token);
      store.sessions = store.sessions.filter((s) => s.tokenHash !== tokenHash);
      saveStore(store);
    }
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    setCookieHeader(res, SESSION_COOKIE_NAME, '', 0, isSecure);
    setCookieHeader(res, SUPPORT_TEAM_COOKIE_NAME, '', 0, isSecure);
    res.json({ ok: true });
  });

  // 7. Send Support Request to Official Email via SMTP & Save Ticket
  app.post('/api/support/send-email', async (req: Request, res: Response) => {
    const ctx = getAuthContext(req);
    const message = String(req.body?.message || '').trim();
    const subject = String(req.body?.subject || 'MEDRADAR Technical Support Request').trim().slice(0, 120);
    const pageFeature = String(req.body?.pageFeature || 'General').trim().slice(0, 80);
    const replyEmail = String(req.body?.replyEmail || ctx.user?.email || '').trim();
    const phoneNumber = String(req.body?.phoneNumber || ctx.user?.phoneE164 || '').trim();
    const submittedByName = String(
      req.body?.submittedByName || ctx.user?.fullName || 'MEDRADAR User'
    )
      .trim()
      .slice(0, 80);

    if (message.length < 8 || message.length > 2000) {
      res.status(400).json({
        ok: false,
        emailSent: false,
        error: 'Please enter a clear issue description (8 to 2000 characters).',
      });
      return;
    }

    if (!replyEmail && !phoneNumber) {
      res.status(400).json({
        ok: false,
        emailSent: false,
        error: 'Please provide an email address or phone number so our team can contact you.',
      });
      return;
    }

    if (replyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyEmail)) {
      res.status(400).json({
        ok: false,
        emailSent: false,
        error: 'Please enter a valid reply email address.',
      });
      return;
    }

    const store = ensureStore();
    const nowIso = new Date().toISOString();
    const ticketNumber = generateUniqueTicketNumber(store.supportTickets);
    const emailCfg = getEmailConfig();

    const ticket: StoredSupportTicket = {
      id: `TKT-${crypto.randomUUID()}`,
      ticketNumber,
      userId: ctx.user ? ctx.user.id : null,
      submittedByName,
      phoneNumber,
      replyEmail,
      subject: subject || 'MEDRADAR Technical Support Request',
      message,
      pageFeature,
      status: 'New',
      emailDelivery: {
        sent: false,
        configured: emailCfg.configured,
        recipient: emailCfg.supportEmailPreview,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (!emailCfg.configured) {
      ticket.emailDelivery.error = 'SUPPORT_EMAIL or SMTP settings are not configured on the server yet.';
      store.supportTickets.unshift(ticket);
      saveStore(store);

      res.status(503).json({
        ok: false,
        emailSent: false,
        emailConfigured: false,
        missingVars: emailCfg.missingEmailVars,
        ticket,
        error:
          'Support email delivery is not configured yet on the backend. Your ticket was saved locally, NOT emailed.',
      });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: emailCfg.smtpHost,
        port: emailCfg.smtpPort,
        secure: emailCfg.smtpSecure,
        auth: {
          user: emailCfg.smtpUser,
          pass: emailCfg.smtpPass,
        },
      });

      await transporter.sendMail({
        from: emailCfg.smtpFrom,
        to: emailCfg.supportEmail,
        replyTo: replyEmail || undefined,
        subject: `[MEDRADAR ${ticket.ticketNumber}] ${ticket.subject}`,
        text: [
          `MEDRADAR Technical Support Request`,
          `Ticket Number: ${ticket.ticketNumber}`,
          `Date & Time: ${ticket.createdAt}`,
          `Page / Feature: ${ticket.pageFeature}`,
          `Submitted By: ${ticket.submittedByName}`,
          `Reply Email: ${ticket.replyEmail || 'Not provided'}`,
          `Phone Number: ${ticket.phoneNumber || 'Not provided'}`,
          `User Account ID: ${ticket.userId || 'Guest'}`,
          '',
          'Message:',
          ticket.message,
        ].join('\n'),
      });

      ticket.emailDelivery = {
        sent: true,
        configured: true,
        recipient: emailCfg.supportEmailPreview,
        sentAt: new Date().toISOString(),
      };
      store.supportTickets.unshift(ticket);
      saveStore(store);

      res.json({
        ok: true,
        emailSent: true,
        emailConfigured: true,
        ticket,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SMTP delivery failed';
      ticket.emailDelivery = {
        sent: false,
        configured: true,
        recipient: emailCfg.supportEmailPreview,
        error: msg,
      };
      store.supportTickets.unshift(ticket);
      saveStore(store);

      res.status(502).json({
        ok: false,
        emailSent: false,
        emailConfigured: true,
        ticket,
        error: `Email could not be delivered: ${msg}`,
      });
    }
  });

  // 8. Unlock Support Team Review Console
  app.post('/api/support/team-auth', (req: Request, res: Response) => {
    const passcode = (process.env.SUPPORT_TEAM_PASSCODE || '').trim();
    if (!passcode) {
      res.status(503).json({
        ok: false,
        configured: false,
        error: 'SUPPORT_TEAM_PASSCODE is not configured on the server.',
      });
      return;
    }

    const supplied = String(req.body?.passcode || '').trim();
    if (!supplied || !safeEqualHex(sha256(passcode), sha256(supplied))) {
      res.status(401).json({ ok: false, error: 'Invalid support team passcode.' });
      return;
    }

    const ctx = getAuthContext(req);
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    setCookieHeader(res, SUPPORT_TEAM_COOKIE_NAME, hmacDigest(`support-team:${passcode}`), 14400 * 1000, isSecure);

    if (ctx.session) {
      const store = ensureStore();
      const s = store.sessions.find((item) => item.tokenHash === ctx.session!.tokenHash);
      if (s) {
        s.isSupportAdmin = true;
        saveStore(store);
      }
    }

    res.json({ ok: true, isSupportTeam: true });
  });

  // 9. List Support Tickets (STRICTLY scoped: own tickets OR verified Support Team)
  app.get('/api/support/tickets', (req: Request, res: Response) => {
    const scope = req.query.scope === 'team' ? 'team' : 'mine';
    const ctx = getAuthContext(req);
    const store = ensureStore();

    if (scope === 'team') {
      if (!ctx.isSupportTeam) {
        res.status(403).json({
          ok: false,
          error: 'Support team authorization required to review all user tickets.',
        });
        return;
      }
      res.json({ ok: true, tickets: store.supportTickets });
      return;
    }

    if (!ctx.user) {
      res.status(401).json({
        ok: false,
        error: 'Sign in with your phone number to view your own support tickets.',
      });
      return;
    }

    const ownTickets = store.supportTickets.filter((t) => t.userId === ctx.user!.id);
    res.json({ ok: true, tickets: ownTickets });
  });

  // 10. Update Support Ticket Status (Support Team Only)
  app.patch('/api/support/tickets/:id/status', (req: Request, res: Response) => {
    const ctx = getAuthContext(req);
    if (!ctx.isSupportTeam) {
      res.status(403).json({ ok: false, error: 'Support team authorization required.' });
      return;
    }

    const nextStatus = req.body?.status as SupportTicketStatus;
    if (nextStatus !== 'New' && nextStatus !== 'In Progress' && nextStatus !== 'Resolved') {
      res.status(400).json({ ok: false, error: 'Status must be New, In Progress, or Resolved.' });
      return;
    }

    const store = ensureStore();
    const ticket = store.supportTickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ ok: false, error: 'Support ticket not found.' });
      return;
    }

    ticket.status = nextStatus;
    ticket.updatedAt = new Date().toISOString();
    saveStore(store);

    res.json({ ok: true, ticket });
  });

  // Vite dev middleware vs static production build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MEDRADAR server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MEDRADAR server:', err);
  process.exit(1);
});
