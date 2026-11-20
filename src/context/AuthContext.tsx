import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  checkDoctorAccess,
  fetchAuthMe,
  fetchConfigStatus,
  fetchMyDoctorVerification,
  loginWithPassword as apiLoginWithPassword,
  logoutSession,
  registerAccount as apiRegisterAccount,
  requestPhoneOtp,
  saveUserProfile,
  setStoredSessionToken,
  submitDoctorVerification as apiSubmitDoctorVerification,
  unlockSupportTeamAccess,
  updateUserProfile as apiUpdateUserProfile,
  verifyPhoneOtp,
} from '../services/api';
import {
  AuthUser,
  DoctorVerificationRecord,
  ServerConfigStatus,
  UserRole,
} from '../types/medradar';

interface RegisterParams {
  firstName: string;
  lastName: string;
  age: number;
  countryCode: string;
  localPhone: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  villageName?: string;
  accountRole: UserRole;
  rememberMe?: boolean;
}

interface UpdateProfileParams {
  firstName: string;
  lastName: string;
  age: number;
  countryCode: string;
  localPhone: string;
  phone: string;
  email: string;
  villageName?: string;
}

interface SubmitVerificationParams {
  fullName: string;
  specialty: string;
  institutionName: string;
  licenseNumber: string;
  issuingRegion: string;
  issueDate: string;
  documentDataUrl: string;
  fileName: string;
}

interface AuthResult {
  ok: boolean;
  user?: AuthUser;
  error?: string;
  fieldErrors?: Record<string, string>;
}

interface AuthContextValue {
  user: AuthUser | null;
  effectiveRole: UserRole;
  isVerifiedDoctor: boolean;
  isAuthenticated: boolean;
  isSupportTeam: boolean;
  loadingAuth: boolean;
  configStatus: ServerConfigStatus | null;
  authModalOpen: boolean;
  authModalInitialTab: 'login' | 'register';
  doctorVerification: DoctorVerificationRecord | null;
  doctorVerificationModalOpen: boolean;
  accessDeniedCode: 'AUTH_REQUIRED' | 'DOCTOR_ROLE_REQUIRED' | null;
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  openDoctorVerificationModal: () => void;
  closeDoctorVerificationModal: () => void;
  clearAccessDenied: () => void;
  refreshSession: () => Promise<void>;
  refreshConfigStatus: () => Promise<void>;
  refreshDoctorVerification: () => Promise<void>;
  requestDoctorCabinetAccess: () => Promise<'granted' | 'verification_required' | 'denied'>;
  submitDoctorVerification: (params: SubmitVerificationParams) => Promise<{
    ok: boolean;
    verification?: DoctorVerificationRecord;
    error?: string;
    fieldErrors?: Record<string, string>;
  }>;
  registerAccount: (params: RegisterParams) => Promise<AuthResult>;
  loginWithPassword: (params: {
    identifier: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<AuthResult>;
  updateProfile: (params: UpdateProfileParams) => Promise<AuthResult>;
  sendOtp: (
    phone: string,
    mode: 'register' | 'login'
  ) => Promise<{ ok: boolean; configured?: boolean; code?: string; missingVars?: string[]; error?: string }>;
  verifyOtp: (params: {
    phone: string;
    code: string;
    mode: 'register' | 'login';
    rememberMe: boolean;
  }) => Promise<{ ok: boolean; isNewAccount?: boolean; user?: AuthUser; error?: string }>;
  completeProfile: (params: {
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
  }) => Promise<AuthResult>;
  unlockSupportTeam: (passcode: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSupportTeam, setIsSupportTeam] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [configStatus, setConfigStatus] = useState<ServerConfigStatus | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialTab, setAuthModalInitialTab] = useState<'login' | 'register'>('login');
  const [doctorVerification, setDoctorVerification] = useState<DoctorVerificationRecord | null>(
    null
  );
  const [doctorVerificationModalOpen, setDoctorVerificationModalOpen] = useState(false);
  const [accessDeniedCode, setAccessDeniedCode] = useState<
    'AUTH_REQUIRED' | 'DOCTOR_ROLE_REQUIRED' | null
  >(null);

  const isVerifiedDoctor = Boolean(
    user && user.accountRole === 'doctor' && user.doctorVerificationStatus === 'approved'
  );
  const effectiveRole: UserRole = isVerifiedDoctor ? 'doctor' : 'patient';

  const refreshConfigStatus = useCallback(async () => {
    try {
      const data = await fetchConfigStatus();
      if (data && typeof data.smsConfigured === 'boolean') {
        setConfigStatus(data);
      }
    } catch {
      // Offline / static hosting fallback
    }
  }, []);

  const refreshDoctorVerification = useCallback(async () => {
    try {
      const { status, data } = await fetchMyDoctorVerification();
      if (status >= 200 && status < 300 && data.ok) {
        setDoctorVerification(data.verification ?? null);
      } else {
        setDoctorVerification(null);
      }
    } catch {
      // Ignore offline
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setLoadingAuth(true);
    try {
      const data = await fetchAuthMe();
      if (data.authenticated && data.user) {
        setUser(data.user);
        setIsSupportTeam(Boolean(data.isSupportTeam));
        if (data.user.accountRole === 'doctor') {
          void refreshDoctorVerification();
        } else {
          setDoctorVerification(null);
        }
      } else {
        setUser(null);
        setDoctorVerification(null);
        setIsSupportTeam(Boolean(data.isSupportTeam));
      }
    } catch {
      // Ignore when offline
    } finally {
      setLoadingAuth(false);
    }
  }, [refreshDoctorVerification]);

  useEffect(() => {
    void refreshConfigStatus();
    void refreshSession();
  }, [refreshConfigStatus, refreshSession]);

  const requestDoctorCabinetAccess = async (): Promise<
    'granted' | 'verification_required' | 'denied'
  > => {
    try {
      const { status, data } = await checkDoctorAccess();
      if (status >= 200 && status < 300 && data.ok && data.accessGranted) {
        setAccessDeniedCode(null);
        setDoctorVerificationModalOpen(false);
        await refreshSession();
        return 'granted';
      }
      if (status === 403 && data.code === 'DOCTOR_VERIFICATION_REQUIRED') {
        setAccessDeniedCode(null);
        await refreshDoctorVerification();
        setDoctorVerificationModalOpen(true);
        return 'verification_required';
      }
      if (status === 401 || data.code === 'AUTH_REQUIRED') {
        setAccessDeniedCode('AUTH_REQUIRED');
        return 'denied';
      }
      setAccessDeniedCode('DOCTOR_ROLE_REQUIRED');
      return 'denied';
    } catch {
      if (isVerifiedDoctor) return 'granted';
      if (user?.accountRole === 'doctor') {
        setDoctorVerificationModalOpen(true);
        return 'verification_required';
      }
      setAccessDeniedCode(user ? 'DOCTOR_ROLE_REQUIRED' : 'AUTH_REQUIRED');
      return 'denied';
    }
  };

  const submitDoctorVerification = async (params: SubmitVerificationParams) => {
    const { status, data } = await apiSubmitDoctorVerification(params);
    if (status >= 200 && status < 300 && data.ok) {
      if (data.user) {
        setUser(data.user);
      }
      if (data.verification) {
        setDoctorVerification(data.verification);
      }
      return { ok: true, verification: data.verification };
    }
    return {
      ok: false,
      error: data.error || 'Could not submit doctor license verification.',
      fieldErrors: data.fieldErrors,
    };
  };

  const registerAccount = async (params: RegisterParams): Promise<AuthResult> => {
    const { status, data } = await apiRegisterAccount(params);
    if (status >= 200 && status < 300 && data.ok && data.user) {
      if (data.sessionToken) {
        setStoredSessionToken(data.sessionToken, params.rememberMe !== false);
      }
      setAccessDeniedCode(null);
      setUser(data.user);
      setDoctorVerification(null);
      setIsSupportTeam(Boolean(data.user.isSupportAdmin));
      return { ok: true, user: data.user };
    }
    return {
      ok: false,
      error: data.error || 'Could not complete registration.',
      fieldErrors: data.fieldErrors,
    };
  };

  const loginWithPassword = async (params: {
    identifier: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<AuthResult> => {
    const { status, data } = await apiLoginWithPassword(params);
    if (status >= 200 && status < 300 && data.ok && data.user) {
      if (data.sessionToken) {
        setStoredSessionToken(data.sessionToken, params.rememberMe !== false);
      }
      setAccessDeniedCode(null);
      setUser(data.user);
      setIsSupportTeam(Boolean(data.user.isSupportAdmin));
      if (data.user.accountRole === 'doctor') {
        void refreshDoctorVerification();
      } else {
        setDoctorVerification(null);
      }
      return { ok: true, user: data.user };
    }
    return {
      ok: false,
      error: data.error || 'Invalid credentials.',
      fieldErrors: data.fieldErrors,
    };
  };

  const updateProfile = async (params: UpdateProfileParams): Promise<AuthResult> => {
    const { status, data } = await apiUpdateUserProfile(params);
    if (status >= 200 && status < 300 && data.ok && data.user) {
      setUser(data.user);
      return { ok: true, user: data.user };
    }
    return {
      ok: false,
      error: data.error || 'Could not update profile.',
      fieldErrors: data.fieldErrors,
    };
  };

  const sendOtp = async (phone: string, mode: 'register' | 'login') => {
    const { data } = await requestPhoneOtp(phone, mode);
    return data;
  };

  const verifyOtp = async (params: {
    phone: string;
    code: string;
    mode: 'register' | 'login';
    rememberMe: boolean;
  }) => {
    const { status, data } = await verifyPhoneOtp(params);
    if (status >= 200 && status < 300 && data.ok && data.user) {
      if (data.sessionToken) {
        setStoredSessionToken(data.sessionToken, params.rememberMe);
      }
      setAccessDeniedCode(null);
      setUser(data.user);
      setIsSupportTeam(Boolean(data.user.isSupportAdmin));
      if (data.user.accountRole === 'doctor') {
        void refreshDoctorVerification();
      } else {
        setDoctorVerification(null);
      }
    }
    return data;
  };

  const completeProfile = async (params: {
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
  }): Promise<AuthResult> => {
    const { status, data } = await saveUserProfile(params);
    if (status >= 200 && status < 300 && data.ok && data.user) {
      setUser(data.user);
      return { ok: true, user: data.user };
    }
    return {
      ok: false,
      error: data.error || 'Could not save profile.',
      fieldErrors: data.fieldErrors,
    };
  };

  const unlockSupportTeam = async (passcode: string) => {
    const { status, data } = await unlockSupportTeamAccess(passcode);
    if (status >= 200 && status < 300 && data.ok) {
      if (data.sessionToken) {
        setStoredSessionToken(data.sessionToken, false);
      }
      setIsSupportTeam(true);
      return { ok: true };
    }
    return { ok: false, error: data.error || 'Access denied.' };
  };

  const logout = async () => {
    try {
      await logoutSession();
    } catch {
      // Clear local session regardless
    }
    setStoredSessionToken(null, false);
    setUser(null);
    setDoctorVerification(null);
    setDoctorVerificationModalOpen(false);
    setAccessDeniedCode(null);
    setIsSupportTeam(false);
  };

  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    setAuthModalInitialTab(tab);
    setAuthModalOpen(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        effectiveRole,
        isVerifiedDoctor,
        isAuthenticated: Boolean(user),
        isSupportTeam,
        loadingAuth,
        configStatus,
        authModalOpen,
        authModalInitialTab,
        doctorVerification,
        doctorVerificationModalOpen,
        accessDeniedCode,
        openAuthModal,
        closeAuthModal: () => setAuthModalOpen(false),
        openDoctorVerificationModal: () => {
          void refreshDoctorVerification();
          setDoctorVerificationModalOpen(true);
        },
        closeDoctorVerificationModal: () => setDoctorVerificationModalOpen(false),
        clearAccessDenied: () => setAccessDeniedCode(null),
        refreshSession,
        refreshConfigStatus,
        refreshDoctorVerification,
        requestDoctorCabinetAccess,
        submitDoctorVerification,
        registerAccount,
        loginWithPassword,
        updateProfile,
        sendOtp,
        verifyOtp,
        completeProfile,
        unlockSupportTeam,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

