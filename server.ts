import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import nodemailer from 'nodemailer';
import os from 'os';
import path from 'path';

dotenv.config();

const parsedPort = Number.parseInt(process.env.PORT ?? '', 10);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

function resolveDataDir(): string {
  const preferredDir = path.resolve(process.cwd(), '.medradar-data');
  try {
    if (!fs.existsSync(preferredDir)) {
      fs.mkdirSync(preferredDir, { recursive: true, mode: 0o700 });
    }
    fs.accessSync(preferredDir, fs.constants.W_OK);
    return preferredDir;
  } catch {
    const fallbackDir = path.join(os.tmpdir(), 'medradar-data');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true, mode: 0o700 });
    }
    return fallbackDir;
  }
}

const DATA_DIR = resolveDataDir();
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
  firstName: string;
  lastName: string;
  fullName: string;
  age: number | null;
  phoneE164: string;
  countryCode?: string;
  localPhone?: string;
  villageName: string;
  email: string;
  passwordHash?: string;
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

function normalizeStoredUser(raw: Partial<StoredUser>): StoredUser {
  const fullName = String(raw.fullName || '').trim();
  const parts = fullName ? fullName.split(/\s+/) : [];
  const firstName = String(raw.firstName || parts[0] || '').trim();
  const lastName = String(raw.lastName || parts.slice(1).join(' ') || '').trim();
  const combined = `${firstName} ${lastName}`.trim() || fullName;
  return {
    id: String(raw.id || `USR-${crypto.randomUUID()}`),
    firstName,
    lastName,
    fullName: combined,
    age: typeof raw.age === 'number' && Number.isFinite(raw.age) ? raw.age : null,
    phoneE164: String(raw.phoneE164 || ''),
    countryCode: raw.countryCode ? String(raw.countryCode) : undefined,
    localPhone: raw.localPhone ? String(raw.localPhone) : undefined,
    villageName: String(raw.villageName || ''),
    email: String(raw.email || ''),
    passwordHash: typeof raw.passwordHash === 'string' ? raw.passwordHash : undefined,
    accountRole: raw.accountRole === 'doctor' ? 'doctor' : 'patient',
    isSupportAdmin: Boolean(raw.isSupportAdmin),
    profileCompleted: Boolean(raw.profileCompleted),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
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
      users: Array.isArray(parsed.users) ? parsed.users.map(normalizeStoredUser) : [],
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

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function sanitizeUser(user: StoredUser): Omit<StoredUser, 'passwordHash'> {
  const { passwordHash: _removed, ...safeUser } = user;
  return safeUser;
}

function splitPhoneParts(countryCodeInput: string, localPhoneInput: string, fullPhoneInput: string) {
  const rawCC = countryCodeInput.trim();
  const rawLocal = localPhoneInput.replace(/\D/g, '');
  const combined = fullPhoneInput.trim() || `${rawCC}${rawLocal}`;
  const phoneE164 = normalizePhoneE164(combined);
  return {
    phoneE164,
    countryCode: rawCC || undefined,
    localPhone: rawLocal || undefined,
  };
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

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, service: 'medradar', port: PORT });
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
          firstName: '',
          lastName: '',
          fullName: '',
          age: null,
          phoneE164,
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
        user: sanitizeUser(user),
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

  // 3b. Full Registration with Personal Details & Password
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const firstName = String(req.body?.firstName || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    const ageRaw = String(req.body?.age ?? '').trim();
    const countryCode = String(req.body?.countryCode || '').trim();
    const localPhone = String(req.body?.localPhone || '').trim();
    const phoneInput = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');
    const villageName = String(req.body?.villageName || '').trim();
    const accountRole = req.body?.accountRole === 'doctor' ? 'doctor' : 'patient';
    const rememberMe = req.body?.rememberMe !== false;

    const fieldErrors: Record<string, string> = {};

    if (firstName.length < 2 || firstName.length > 40) {
      fieldErrors.firstName = 'First name must be between 2 and 40 characters.';
    }
    if (lastName.length < 2 || lastName.length > 40) {
      fieldErrors.lastName = 'Last name must be between 2 and 40 characters.';
    }

    const ageNum = /^\d+$/.test(ageRaw) ? Number.parseInt(ageRaw, 10) : Number.NaN;
    if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
      fieldErrors.age = 'Age must be a valid whole number between 1 and 120.';
    }

    const { phoneE164, countryCode: cc, localPhone: lp } = splitPhoneParts(
      countryCode,
      localPhone,
      phoneInput
    );
    if (!phoneE164 || (localPhone && localPhone.replace(/\D/g, '').length < 7)) {
      fieldErrors.phone = 'Enter a valid phone number with country code (e.g. +7 701 555 0101).';
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors.email = 'Enter a valid email address.';
    }

    if (password.length < 6 || password.length > 128) {
      fieldErrors.password = 'Password must be at least 6 characters long.';
    }
    if (!confirmPassword) {
      fieldErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      fieldErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        error: Object.values(fieldErrors)[0],
        fieldErrors,
      });
      return;
    }

    const store = ensureStore();
    const existingByEmail = store.users.find((u) => u.email.toLowerCase() === email);
    if (existingByEmail) {
      res.status(409).json({
        ok: false,
        code: 'EMAIL_EXISTS',
        error: 'An account with this email already exists. Please sign in.',
        fieldErrors: { email: 'An account with this email is already registered.' },
      });
      return;
    }

    const existingByPhone = store.users.find((u) => u.phoneE164 === phoneE164);
    if (existingByPhone) {
      res.status(409).json({
        ok: false,
        code: 'PHONE_EXISTS',
        error: 'An account with this phone number already exists. Please sign in.',
        fieldErrors: { phone: 'An account with this phone number is already registered.' },
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const isSupportAdmin = isPhoneSupportAdmin(phoneE164!);
    const newUser: StoredUser = {
      id: `USR-${crypto.randomUUID()}`,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      age: ageNum,
      phoneE164: phoneE164!,
      countryCode: cc,
      localPhone: lp,
      villageName,
      email,
      passwordHash: hashPassword(password),
      accountRole,
      isSupportAdmin,
      profileCompleted: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const ttlMs = rememberMe ? SESSION_TTL_REMEMBER_MS : SESSION_TTL_DEFAULT_MS;
    const expiresAt = Date.now() + ttlMs;

    store.users.push(newUser);
    store.sessions.push({
      tokenHash: sha256(rawToken),
      userId: newUser.id,
      isSupportAdmin,
      rememberMe,
      expiresAt,
      createdAt: nowIso,
    });
    saveStore(store);

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    setCookieHeader(res, SESSION_COOKIE_NAME, rawToken, ttlMs, isSecure);

    res.status(201).json({
      ok: true,
      user: sanitizeUser(newUser),
      sessionToken: rawToken,
      expiresAt,
    });
  });

  // 3c. Login with Email or Phone Number + Password
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const identifier = String(req.body?.identifier || '').trim();
    const password = String(req.body?.password || '');
    const rememberMe = req.body?.rememberMe !== false;

    const fieldErrors: Record<string, string> = {};
    if (!identifier) {
      fieldErrors.identifier = 'Enter your email address or phone number.';
    }
    if (!password) {
      fieldErrors.password = 'Enter your password.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        error: Object.values(fieldErrors)[0],
        fieldErrors,
      });
      return;
    }

    const store = ensureStore();
    const normalizedEmail = identifier.toLowerCase();
    const normalizedPhone = normalizePhoneE164(identifier);

    const user = store.users.find((u) => {
      if (u.email && u.email.toLowerCase() === normalizedEmail) return true;
      if (normalizedPhone && u.phoneE164 === normalizedPhone) return true;
      return false;
    });

    if (!user) {
      res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        error: 'No account matches this email/phone or password.',
        fieldErrors: { identifier: 'Invalid email, phone number, or password.' },
      });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({
        ok: false,
        code: 'PASSWORD_NOT_SET',
        error: 'This account was registered via SMS only. Sign in with SMS verification code.',
        fieldErrors: { password: 'Use SMS code sign-in for this phone-only account.' },
      });
      return;
    }

    if (!verifyPassword(password, user.passwordHash)) {
      res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        error: 'Incorrect password.',
        fieldErrors: { password: 'Incorrect password.' },
      });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const ttlMs = rememberMe ? SESSION_TTL_REMEMBER_MS : SESSION_TTL_DEFAULT_MS;
    const expiresAt = Date.now() + ttlMs;
    const nowIso = new Date().toISOString();

    store.sessions.push({
      tokenHash: sha256(rawToken),
      userId: user.id,
      isSupportAdmin: Boolean(user.isSupportAdmin),
      rememberMe,
      expiresAt,
      createdAt: nowIso,
    });
    saveStore(store);

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    setCookieHeader(res, SESSION_COOKIE_NAME, rawToken, ttlMs, isSecure);

    res.json({
      ok: true,
      user: sanitizeUser(user),
      sessionToken: rawToken,
      expiresAt,
    });
  });

  // 4. Current Authenticated User
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const ctx = getAuthContext(req);
    res.json({
      authenticated: Boolean(ctx.user),
      user: ctx.user ? sanitizeUser(ctx.user) : null,
      isSupportTeam: ctx.isSupportTeam,
    });
  });

  // 5. Update Authenticated User Profile ("Мой профиль")
  const handleUpdateProfile = (req: Request, res: Response) => {
    const ctx = getAuthContext(req);
    if (!ctx.user) {
      res.status(401).json({ ok: false, error: 'Authentication required.' });
      return;
    }

    const firstNameInput = String(req.body?.firstName || '').trim();
    const lastNameInput = String(req.body?.lastName || '').trim();
    const legacyFullName = String(req.body?.fullName || '').trim();
    const firstName = firstNameInput || legacyFullName.split(/\s+/)[0] || '';
    const lastName = lastNameInput || legacyFullName.split(/\s+/).slice(1).join(' ') || '';
    const fullName = `${firstName} ${lastName}`.trim() || legacyFullName;

    const ageRaw = req.body?.age !== undefined && req.body?.age !== null ? String(req.body.age).trim() : '';
    const countryCodeInput = String(req.body?.countryCode || ctx.user.countryCode || '').trim();
    const localPhoneInput = String(req.body?.localPhone || '').trim();
    const phoneInput = String(req.body?.phone || ctx.user.phoneE164 || '').trim();
    const email = String(req.body?.email ?? ctx.user.email ?? '').trim().toLowerCase();
    const villageName = String(req.body?.villageName ?? ctx.user.villageName ?? '').trim();
    const accountRole =
      req.body?.accountRole === 'doctor'
        ? 'doctor'
        : req.body?.accountRole === 'patient'
          ? 'patient'
          : ctx.user.accountRole;

    const fieldErrors: Record<string, string> = {};

    if (firstName.length < 2 || firstName.length > 40) {
      fieldErrors.firstName = 'First name must be between 2 and 40 characters.';
    }
    if (lastNameInput !== '' && (lastName.length < 2 || lastName.length > 40)) {
      fieldErrors.lastName = 'Last name must be between 2 and 40 characters.';
    } else if (req.body?.lastName !== undefined && lastName.length < 2) {
      fieldErrors.lastName = 'Last name must be between 2 and 40 characters.';
    }

    let nextAge: number | null = ctx.user.age;
    if (req.body?.age !== undefined) {
      const parsedAge = /^\d+$/.test(ageRaw) ? Number.parseInt(ageRaw, 10) : Number.NaN;
      if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        fieldErrors.age = 'Age must be a valid whole number between 1 and 120.';
      } else {
        nextAge = parsedAge;
      }
    }

    const { phoneE164, countryCode, localPhone } =
      localPhoneInput || req.body?.phone !== undefined
        ? splitPhoneParts(countryCodeInput, localPhoneInput, localPhoneInput ? `${countryCodeInput}${localPhoneInput}` : phoneInput)
        : {
            phoneE164: ctx.user.phoneE164,
            countryCode: ctx.user.countryCode,
            localPhone: ctx.user.localPhone,
          };

    if (!phoneE164) {
      fieldErrors.phone = 'Enter a valid phone number with country code.';
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors.email = 'Please enter a valid email address.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        error: Object.values(fieldErrors)[0],
        fieldErrors,
      });
      return;
    }

    const store = ensureStore();
    const idx = store.users.findIndex((u) => u.id === ctx.user!.id);
    if (idx === -1) {
      res.status(404).json({ ok: false, error: 'User account not found.' });
      return;
    }

    if (store.users.some((u) => u.id !== ctx.user!.id && u.email.toLowerCase() === email)) {
      res.status(409).json({
        ok: false,
        code: 'EMAIL_EXISTS',
        error: 'This email is already used by another account.',
        fieldErrors: { email: 'This email is already registered to another user.' },
      });
      return;
    }

    if (store.users.some((u) => u.id !== ctx.user!.id && u.phoneE164 === phoneE164)) {
      res.status(409).json({
        ok: false,
        code: 'PHONE_EXISTS',
        error: 'This phone number is already used by another account.',
        fieldErrors: { phone: 'This phone number is already registered to another user.' },
      });
      return;
    }

    store.users[idx] = {
      ...store.users[idx],
      firstName,
      lastName,
      fullName,
      age: nextAge,
      phoneE164: phoneE164!,
      countryCode: countryCode ?? store.users[idx].countryCode,
      localPhone: localPhone ?? store.users[idx].localPhone,
      villageName,
      email,
      accountRole,
      profileCompleted: true,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);

    res.json({ ok: true, user: sanitizeUser(store.users[idx]) });
  };

  app.post('/api/auth/complete-profile', handleUpdateProfile);
  app.patch('/api/auth/profile', handleUpdateProfile);

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
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProductionRuntime =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.K_SERVICE) ||
    Boolean(process.env.CLOUD_RUN_JOB);

  if (!isProductionRuntime) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(503).send('MEDRADAR production build not found. Run npm run build first.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`MEDRADAR server listening on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('MEDRADAR HTTP server error:', err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MEDRADAR server:', err);
  process.exit(1);
});
