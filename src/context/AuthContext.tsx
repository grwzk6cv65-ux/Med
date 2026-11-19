import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  fetchAuthMe,
  fetchConfigStatus,
  logoutSession,
  requestPhoneOtp,
  saveUserProfile,
  setStoredSessionToken,
  unlockSupportTeamAccess,
  verifyPhoneOtp,
} from '../services/api';
import { AuthUser, ServerConfigStatus, UserRole } from '../types/medradar';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isSupportTeam: boolean;
  loadingAuth: boolean;
  configStatus: ServerConfigStatus | null;
  authModalOpen: boolean;
  authModalInitialTab: 'login' | 'register';
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  refreshSession: () => Promise<void>;
  refreshConfigStatus: () => Promise<void>;
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
    fullName: string;
    villageName: string;
    email: string;
    accountRole: UserRole;
  }) => Promise<{ ok: boolean; user?: AuthUser; error?: string }>;
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

  const refreshSession = useCallback(async () => {
    setLoadingAuth(true);
    try {
      const data = await fetchAuthMe();
      if (data.authenticated && data.user) {
        setUser(data.user);
        setIsSupportTeam(Boolean(data.isSupportTeam));
      } else {
        setUser(null);
        setIsSupportTeam(Boolean(data.isSupportTeam));
      }
    } catch {
      // Ignore when offline
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    void refreshConfigStatus();
    void refreshSession();
  }, [refreshConfigStatus, refreshSession]);

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
      setUser(data.user);
      setIsSupportTeam(Boolean(data.user.isSupportAdmin));
    }
    return data;
  };

  const completeProfile = async (params: {
    fullName: string;
    villageName: string;
    email: string;
    accountRole: UserRole;
  }) => {
    const { status, data } = await saveUserProfile(params);
    if (status >= 200 && status < 300 && data.ok && data.user) {
      setUser(data.user);
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data.error || 'Could not save profile.' };
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
        isAuthenticated: Boolean(user),
        isSupportTeam,
        loadingAuth,
        configStatus,
        authModalOpen,
        authModalInitialTab,
        openAuthModal,
        closeAuthModal: () => setAuthModalOpen(false),
        refreshSession,
        refreshConfigStatus,
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
