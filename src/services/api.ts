import type {
  AuthUser,
  DoctorVerificationRecord,
  DoctorVerificationStatus,
  ServerConfigStatus,
  SupportTicket,
  SupportTicketStatus,
  UserRole,
} from '../types/medradar';

const TOKEN_STORAGE_KEY = 'medradar_auth_session_token';

export function getStoredSessionToken(): string | null {
  try {
    return (
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
      sessionStorage.getItem(TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null, rememberMe: boolean): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    if (token) {
      if (rememberMe) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    }
  } catch {
    // Ignore restricted storage environments; HttpOnly cookie remains active
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<{ status: number; data: T }> {
  const token = getStoredSessionToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const resp = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  const data = (await resp.json().catch(() => ({}))) as T;
  return { status: resp.status, data };
}

export async function fetchProtectedDocumentBlobUrl(endpoint: string): Promise<{
  ok: boolean;
  objectUrl?: string;
  mimeType?: string;
  error?: string;
}> {
  const token = getStoredSessionToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const resp = await fetch(endpoint, {
    headers,
    credentials: 'include',
  });
  if (!resp.ok) {
    const errJson = (await resp.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: errJson.error || `Error ${resp.status}` };
  }
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  return { ok: true, objectUrl, mimeType: blob.type };
}

export async function fetchConfigStatus(): Promise<ServerConfigStatus> {
  const { data } = await apiFetch<ServerConfigStatus>('/api/config/status');
  return data;
}

export async function fetchAuthMe(): Promise<{
  authenticated: boolean;
  user: AuthUser | null;
  effectiveRole?: UserRole;
  doctorVerified?: boolean;
  isSupportTeam: boolean;
}> {
  const { data } = await apiFetch<{
    authenticated: boolean;
    user: AuthUser | null;
    effectiveRole?: UserRole;
    doctorVerified?: boolean;
    isSupportTeam: boolean;
  }>('/api/auth/me');
  return data;
}

export async function requestPhoneOtp(phone: string, mode: 'register' | 'login') {
  return apiFetch<{
    ok: boolean;
    configured?: boolean;
    code?: string;
    missingVars?: string[];
    phoneE164?: string;
    expiresInSeconds?: number;
    error?: string;
  }>('/api/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, mode }),
  });
}

export async function verifyPhoneOtp(params: {
  phone: string;
  code: string;
  mode: 'register' | 'login';
  rememberMe: boolean;
}) {
  return apiFetch<{
    ok: boolean;
    user?: AuthUser;
    isNewAccount?: boolean;
    sessionToken?: string;
    expiresAt?: number;
    configured?: boolean;
    code?: string;
    missingVars?: string[];
    error?: string;
  }>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface AuthApiResponse {
  ok: boolean;
  user?: AuthUser;
  isNewAccount?: boolean;
  sessionToken?: string;
  expiresAt?: number;
  configured?: boolean;
  code?: string;
  missingVars?: string[];
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function registerAccount(params: {
  firstName: string;
  lastName: string;
  age: number;
  countryCode: string;
  localPhone: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountRole: UserRole;
  villageName?: string;
  rememberMe?: boolean;
}) {
  return apiFetch<AuthApiResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function loginWithPassword(params: {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}) {
  return apiFetch<AuthApiResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function saveUserProfile(params: {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  age?: number;
  countryCode?: string;
  localPhone?: string;
  phone?: string;
  villageName: string;
  email: string;
  accountRole?: UserRole;
}) {
  return apiFetch<AuthApiResponse>('/api/auth/complete-profile', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateUserProfile(params: {
  firstName: string;
  lastName: string;
  age: number;
  countryCode: string;
  localPhone: string;
  phone: string;
  email: string;
  villageName?: string;
}) {
  return apiFetch<AuthApiResponse>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export async function logoutSession() {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function checkDoctorAccess() {
  return apiFetch<{
    ok: boolean;
    accessGranted: boolean;
    code?: string;
    verificationStatus?: DoctorVerificationStatus;
    rejectionReason?: string;
    error?: string;
  }>('/api/doctor/access');
}

export async function fetchMyDoctorVerification() {
  return apiFetch<{
    ok: boolean;
    verificationStatus?: DoctorVerificationStatus;
    rejectionReason?: string;
    verification?: DoctorVerificationRecord | null;
    error?: string;
  }>('/api/doctor/verification');
}

export async function submitDoctorVerification(params: {
  fullName: string;
  specialty: string;
  institutionName: string;
  licenseNumber: string;
  issuingRegion: string;
  issueDate: string;
  documentDataUrl: string;
  fileName: string;
}) {
  return apiFetch<{
    ok: boolean;
    user?: AuthUser;
    verification?: DoctorVerificationRecord;
    error?: string;
    fieldErrors?: Record<string, string>;
  }>('/api/doctor/verification', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchAdminDoctorVerifications() {
  return apiFetch<{
    ok: boolean;
    verifications?: DoctorVerificationRecord[];
    error?: string;
  }>('/api/admin/doctor-verifications');
}

export async function decideDoctorVerification(
  id: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string
) {
  return apiFetch<{
    ok: boolean;
    verification?: DoctorVerificationRecord;
    error?: string;
  }>(`/api/admin/doctor-verifications/${encodeURIComponent(id)}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, rejectionReason }),
  });
}

export async function submitSupportEmail(params: {
  message: string;
  subject?: string;
  replyEmail?: string;
  phoneNumber?: string;
  submittedByName?: string;
  pageFeature: string;
}) {
  return apiFetch<{
    ok: boolean;
    emailSent: boolean;
    emailConfigured?: boolean;
    missingVars?: string[];
    ticket?: SupportTicket;
    error?: string;
  }>('/api/support/send-email', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function unlockSupportTeamAccess(passcode: string) {
  return apiFetch<{
    ok: boolean;
    isSupportTeam?: boolean;
    sessionToken?: string;
    configured?: boolean;
    error?: string;
  }>('/api/support/team-auth', {
    method: 'POST',
    body: JSON.stringify({ passcode }),
  });
}

export async function fetchSupportTickets(scope: 'mine' | 'team') {
  return apiFetch<{ ok: boolean; tickets?: SupportTicket[]; error?: string }>(
    `/api/support/tickets?scope=${scope}`
  );
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicketStatus) {
  return apiFetch<{ ok: boolean; ticket?: SupportTicket; error?: string }>(
    `/api/support/tickets/${encodeURIComponent(ticketId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
}

