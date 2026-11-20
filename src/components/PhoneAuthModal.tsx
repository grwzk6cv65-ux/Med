import {
  LogOut,
  Phone,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedradar } from '../context/MedradarContext';
import { AuthFormPanel } from './AuthFormPanel';

export function PhoneAuthModal() {
  const { t, setActiveModule } = useMedradar();
  const {
    user,
    authModalOpen,
    authModalInitialTab,
    closeAuthModal,
    logout,
  } = useAuth();

  const [loading, setLoading] = useState(false);

  if (!authModalOpen) return null;

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      closeAuthModal();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-[2px] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Matte Black Header */}
        <div className="px-5 py-4 bg-zinc-950 text-white flex items-center justify-between gap-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-sm font-bold text-white">
                {t('auth_modal_title')}
              </h2>
              <p className="text-[11px] text-zinc-400">{t('auth_modal_sub')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[82vh] overflow-y-auto">
          {user ? (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-950 text-white rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{t('profile_section_title')}</span>
                    </div>
                    <div className="text-base font-bold text-white truncate mt-0.5">
                      {user.firstName || user.lastName
                        ? `${user.firstName} ${user.lastName}`.trim()
                        : user.fullName || user.phoneE164}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('auth_logout')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800 text-xs text-zinc-300">
                  <div>
                    <span className="text-zinc-500">{t('profile_field_age')}: </span>
                    <span className="font-mono font-semibold text-white">
                      {user.age !== null ? `${user.age} ${t('profile_age_years')}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="font-mono text-white truncate">{user.phoneE164}</span>
                  </div>
                  <div className="sm:col-span-2 truncate">
                    <span className="text-zinc-500">{t('profile_field_email')}: </span>
                    <span className="text-white">{user.email || '—'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveModule('profile');
                  closeAuthModal();
                }}
                className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                {t('profile_cabinet_title')} — {t('profile_edit_btn')}
              </button>
            </div>
          ) : (
            <AuthFormPanel
              initialMode={authModalInitialTab}
              onAuthSuccess={closeAuthModal}
            />
          )}
        </div>
      </div>
    </div>
  );
}
