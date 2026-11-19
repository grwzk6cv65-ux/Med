import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  LogOut,
  Phone,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedradar } from '../context/MedradarContext';
import { UserRole } from '../types/medradar';

const COUNTRY_CODES = [
  { code: '+7', label: '+7 (KZ)' },
  { code: '+998', label: '+998 (UZ)' },
  { code: '+996', label: '+996 (KG)' },
  { code: '+992', label: '+992 (TJ)' },
  { code: '+994', label: '+994 (AZ)' },
  { code: '+1', label: '+1 (US/CA)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+49', label: '+49 (DE)' },
];

export function PhoneAuthModal() {
  const { t, setRole } = useMedradar();
  const {
    user,
    configStatus,
    authModalOpen,
    authModalInitialTab,
    closeAuthModal,
    sendOtp,
    verifyOtp,
    completeProfile,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(authModalInitialTab);
  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [countryCode, setCountryCode] = useState('+7');
  const [localPhone, setLocalPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [fullName, setFullName] = useState('');
  const [villageName, setVillageName] = useState('');
  const [email, setEmail] = useState('');
  const [accountRole, setAccountRole] = useState<UserRole>('patient');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [missingSmsVars, setMissingSmsVars] = useState<string[]>([]);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(authModalInitialTab);
  }, [authModalInitialTab]);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setVillageName(user.villageName);
      setEmail(user.email);
      setAccountRole(user.accountRole);
      if (!user.profileCompleted) {
        setStep('profile');
      }
    } else {
      setStep('phone');
      setOtpCode('');
    }
    setErrorMsg(null);
    setInfoMsg(null);
    setMissingSmsVars([]);
  }, [user, authModalOpen]);

  if (!authModalOpen) return null;

  const fullPhone = `${countryCode}${localPhone.replace(/\D/g, '')}`;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setMissingSmsVars([]);

    const digits = localPhone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 13) {
      setErrorMsg('Please enter a valid mobile phone number.');
      return;
    }

    setLoading(true);
    try {
      const data = await sendOtp(fullPhone, mode);
      if (data.ok) {
        setStep('otp');
        setInfoMsg(`SMS verification code sent to ${fullPhone}.`);
      } else {
        if (data.code === 'SMS_NOT_CONFIGURED' && data.missingVars) {
          setMissingSmsVars(data.missingVars);
        }
        setErrorMsg(data.error ?? 'Failed to send SMS verification code.');
      }
    } catch {
      setErrorMsg('Network error while contacting SMS verification service.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!/^\d{4,10}$/.test(otpCode.trim())) {
      setErrorMsg('Enter the numeric SMS verification code you received.');
      return;
    }

    setLoading(true);
    try {
      const data = await verifyOtp({
        phone: fullPhone,
        code: otpCode.trim(),
        mode,
        rememberMe,
      });

      if (data.ok && data.user) {
        if (!data.user.profileCompleted || data.isNewAccount) {
          setStep('profile');
          setInfoMsg('Phone number verified. Complete your profile to finish registration.');
        } else {
          setRole(data.user.accountRole);
          closeAuthModal();
        }
      } else {
        setErrorMsg(data.error ?? 'Verification failed.');
      }
    } catch {
      setErrorMsg('Network error while verifying code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (fullName.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }

    setLoading(true);
    try {
      const data = await completeProfile({
        fullName: fullName.trim(),
        villageName: villageName.trim(),
        email: email.trim(),
        accountRole,
      });

      if (data.ok) {
        setRole(data.user?.accountRole ?? accountRole);
        setInfoMsg(t('auth_saved_notice'));
        setTimeout(() => closeAuthModal(), 700);
      } else {
        setErrorMsg(data.error ?? 'Could not save account details.');
      }
    } catch {
      setErrorMsg('Network error while saving profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      setStep('phone');
      setOtpCode('');
      closeAuthModal();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Matte Black Header */}
        <div className="px-5 py-4 bg-zinc-950 text-white flex items-center justify-between gap-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <Phone className="w-4 h-4 text-emerald-400" />
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

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {infoMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>{infoMsg}</div>
            </div>
          )}

          {(missingSmsVars.length > 0 || (configStatus && !configStatus.smsConfigured && !user)) && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                <span>{t('auth_sms_setup_title')}</span>
              </div>
              <p className="text-amber-900 leading-relaxed">{t('auth_sms_setup_desc')}</p>
              <div className="font-mono text-[11px] bg-white/80 border border-amber-200 rounded-lg p-2 space-y-0.5">
                {(missingSmsVars.length > 0
                  ? missingSmsVars
                  : configStatus?.missingSmsVars ?? [
                      'TWILIO_ACCOUNT_SID',
                      'TWILIO_AUTH_TOKEN',
                      'TWILIO_VERIFY_SERVICE_SID',
                    ]
                ).map((v) => (
                  <div key={v}>{v}</div>
                ))}
              </div>
            </div>
          )}

          {/* Signed-in Account Profile / Completion View */}
          {user ? (
            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div className="p-3.5 bg-zinc-950 text-white rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified Phone</span>
                  </div>
                  <div className="font-mono text-sm font-bold mt-0.5">{user.phoneE164}</div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('auth_logout')}</span>
                </button>
              </div>

              <div className="text-xs font-bold text-zinc-950 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>{t('auth_profile_title')}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  {t('auth_fullname')} *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    {t('auth_village')}
                  </label>
                  <input
                    type="text"
                    value={villageName}
                    onChange={(e) => setVillageName(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    {t('auth_role_label')}
                  </label>
                  <select
                    value={accountRole}
                    onChange={(e) => setAccountRole(e.target.value as UserRole)}
                    className="w-full h-10 px-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                  >
                    <option value="patient">{t('role_patient')}</option>
                    <option value="doctor">{t('role_doctor')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  {t('auth_email_opt')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-10 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                {t('auth_save_profile')}
              </button>
            </form>
          ) : (
            <>
              {/* Sign In / Register Mode Tabs */}
              {step === 'phone' && (
                <div className="grid grid-cols-2 p-1 bg-zinc-100 border border-zinc-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                      mode === 'login' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {t('auth_tab_login')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg(null);
                    }}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                      mode === 'register'
                        ? 'bg-emerald-600 text-white'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {t('auth_tab_register')}
                  </button>
                </div>
              )}

              {step === 'phone' ? (
                <form onSubmit={handleRequestOtp} className="space-y-3.5">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        {t('auth_country_code')}
                      </label>
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-full h-10 px-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-7">
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        {t('auth_phone_label')}
                      </label>
                      <input
                        type="tel"
                        required
                        value={localPhone}
                        onChange={(e) => setLocalPhone(e.target.value)}
                        placeholder="701 555 0101"
                        className="w-full h-10 px-3 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-zinc-300 accent-emerald-600"
                    />
                    <span>{t('auth_remember_me')}</span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {loading ? t('auth_sending') : t('auth_send_code')}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                  <div className="flex items-center justify-between text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                    <span className="font-mono font-semibold text-zinc-950">{fullPhone}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('phone');
                        setOtpCode('');
                        setErrorMsg(null);
                      }}
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      {t('auth_change_phone')}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      {t('auth_code_label')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full h-11 px-3 text-center text-base tracking-[0.25em] font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {loading ? t('auth_verifying') : t('auth_verify_btn')}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
