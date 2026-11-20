import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Stethoscope,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedradar } from '../context/MedradarContext';
import { Language, UserRole } from '../types/medradar';

export const COUNTRY_CODES = [
  { code: '+7', label: '+7 (KZ/RU)' },
  { code: '+998', label: '+998 (UZ)' },
  { code: '+996', label: '+996 (KG)' },
  { code: '+992', label: '+992 (TJ)' },
  { code: '+994', label: '+994 (AZ)' },
  { code: '+375', label: '+375 (BY)' },
  { code: '+1', label: '+1 (US/CA)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+49', label: '+49 (DE)' },
];

export function validateMessages(lang: Language) {
  if (lang === 'kk') {
    return {
      firstNameReq: 'Атыңызды енгізіңіз (кемінде 2 таңба).',
      lastNameReq: 'Тегіңізді енгізіңіз (кемінде 2 таңба).',
      ageReq: 'Жасыңызды енгізіңіз (тек сан).',
      ageRange: 'Жас 1 мен 120 аралығындағы бүтін сан болуы керек.',
      phoneReq: 'Телефон нөмірін енгізіңіз.',
      phoneFormat: 'Ел кодымен дұрыс телефон нөмірін енгізіңіз (мысалы, 701 555 0101).',
      emailReq: 'Электрондық поштаны енгізіңіз.',
      emailFormat: 'Дұрыс электрондық пошта мекенжайын енгізіңіз.',
      passwordReq: 'Құпиясөзді енгізіңіз.',
      passwordLen: 'Құпиясөз кемінде 6 таңбадан тұруы керек.',
      confirmReq: 'Құпиясөзді растаңыз.',
      passwordMismatch: 'Құпиясөздер сәйкес келмейді.',
      identifierReq: 'Электрондық пошта немесе телефон нөмірін енгізіңіз.',
      otpFormat: 'SMS арқылы келген сандық кодты енгізіңіз.',
    };
  }
  if (lang === 'en') {
    return {
      firstNameReq: 'Enter your first name (at least 2 characters).',
      lastNameReq: 'Enter your last name (at least 2 characters).',
      ageReq: 'Enter your age (numbers only).',
      ageRange: 'Age must be a whole number between 1 and 120.',
      phoneReq: 'Enter your phone number.',
      phoneFormat: 'Enter a valid phone number (7 to 13 digits after country code).',
      emailReq: 'Enter your email address.',
      emailFormat: 'Enter a valid email address.',
      passwordReq: 'Enter a password.',
      passwordLen: 'Password must be at least 6 characters long.',
      confirmReq: 'Please confirm your password.',
      passwordMismatch: 'Passwords do not match.',
      identifierReq: 'Enter your email address or phone number.',
      otpFormat: 'Enter the numeric SMS verification code.',
    };
  }
  return {
    firstNameReq: 'Введите имя (минимум 2 символа).',
    lastNameReq: 'Введите фамилию (минимум 2 символа).',
    ageReq: 'Укажите возраст (только цифры).',
    ageRange: 'Возраст должен быть целым числом от 1 до 120.',
    phoneReq: 'Введите номер телефона.',
    phoneFormat: 'Введите корректный номер телефона (7–13 цифр после кода страны).',
    emailReq: 'Введите адрес электронной почты.',
    emailFormat: 'Введите корректный адрес электронной почты.',
    passwordReq: 'Введите пароль.',
    passwordLen: 'Пароль должен содержать минимум 6 символов.',
    confirmReq: 'Подтвердите пароль.',
    passwordMismatch: 'Пароли не совпадают.',
    identifierReq: 'Введите электронную почту или номер телефона.',
    otpFormat: 'Введите числовой код из SMS.',
  };
}

interface AuthFormPanelProps {
  initialMode?: 'login' | 'register';
  onAuthSuccess?: () => void;
}

export function AuthFormPanel({ initialMode = 'login', onAuthSuccess }: AuthFormPanelProps) {
  const { t, language, setActiveModule } = useMedradar();
  const {
    configStatus,
    registerAccount,
    loginWithPassword,
    sendOtp,
    verifyOtp,
    openDoctorVerificationModal,
  } = useAuth();

  const msgs = validateMessages(language);

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loginMethod, setLoginMethod] = useState<'password' | 'sms'>('password');
  const [smsStep, setSmsStep] = useState<'phone' | 'otp'>('phone');

  // Registration fields
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [countryCode, setCountryCode] = useState('+7');
  const [localPhone, setLocalPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // SMS OTP login fields
  const [smsCountryCode, setSmsCountryCode] = useState('+7');
  const [smsLocalPhone, setSmsLocalPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [missingSmsVars, setMissingSmsVars] = useState<string[]>([]);

  useEffect(() => {
    setMode(initialMode);
    setFormError(null);
    setFieldErrors({});
    setInfoMsg(null);
  }, [initialMode]);

  const fullRegPhone = `${countryCode}${localPhone.replace(/\D/g, '')}`;
  const fullSmsPhone = `${smsCountryCode}${smsLocalPhone.replace(/\D/g, '')}`;

  const clearFieldError = (key: string) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (formError) setFormError(null);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);

    const errors: Record<string, string> = {};
    const fn = firstName.trim();
    const ln = lastName.trim();
    const ageClean = age.trim();
    const phoneDigits = localPhone.replace(/\D/g, '');
    const emailClean = email.trim();

    if (!selectedRole) {
      errors.accountRole = t('auth_role_required_err');
    }
    if (fn.length < 2) errors.firstName = msgs.firstNameReq;
    if (ln.length < 2) errors.lastName = msgs.lastNameReq;

    if (!ageClean) {
      errors.age = msgs.ageReq;
    } else if (!/^\d+$/.test(ageClean)) {
      errors.age = msgs.ageReq;
    } else {
      const parsedAge = Number.parseInt(ageClean, 10);
      if (parsedAge < 1 || parsedAge > 120) {
        errors.age = msgs.ageRange;
      }
    }

    if (!phoneDigits) {
      errors.phone = msgs.phoneReq;
    } else if (!/^\+[1-9]\d{7,14}$/.test(fullRegPhone) || phoneDigits.length < 7 || phoneDigits.length > 13) {
      errors.phone = msgs.phoneFormat;
    }

    if (!emailClean) {
      errors.email = msgs.emailReq;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      errors.email = msgs.emailFormat;
    }

    if (!password) {
      errors.password = msgs.passwordReq;
    } else if (password.length < 6) {
      errors.password = msgs.passwordLen;
    }

    if (!confirmPassword) {
      errors.confirmPassword = msgs.confirmReq;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = msgs.passwordMismatch;
    }

    if (Object.keys(errors).length > 0 || !selectedRole) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const result = await registerAccount({
        accountRole: selectedRole,
        firstName: fn,
        lastName: ln,
        age: Number.parseInt(ageClean, 10),
        countryCode,
        localPhone: phoneDigits,
        phone: fullRegPhone,
        email: emailClean,
        password,
        confirmPassword,
        rememberMe,
      });

      if (result.ok && result.user) {
        if (result.user.accountRole === 'doctor') {
          setActiveModule('dashboard');
          openDoctorVerificationModal();
        } else {
          setActiveModule('profile');
        }
        onAuthSuccess?.();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setFormError(result.error ?? 'Could not complete registration.');
      }
    } catch {
      setFormError('Network error while creating your account.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);

    const errors: Record<string, string> = {};
    if (!loginIdentifier.trim()) {
      errors.identifier = msgs.identifierReq;
    }
    if (!loginPassword) {
      errors.password = msgs.passwordReq;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const result = await loginWithPassword({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
        rememberMe,
      });

      if (result.ok && result.user) {
        if (result.user.accountRole === 'doctor') {
          setActiveModule('dashboard');
          if (result.user.doctorVerificationStatus !== 'approved') {
            openDoctorVerificationModal();
          }
        } else {
          setActiveModule('profile');
        }
        onAuthSuccess?.();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setFormError(result.error ?? 'Invalid login credentials.');
      }
    } catch {
      setFormError('Network error while signing in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);
    setMissingSmsVars([]);

    const digits = smsLocalPhone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 13 || !/^\+[1-9]\d{7,14}$/.test(fullSmsPhone)) {
      setFieldErrors({ smsPhone: msgs.phoneFormat });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const data = await sendOtp(fullSmsPhone, 'login');
      if (data.ok) {
        setSmsStep('otp');
        setInfoMsg(`SMS verification code sent to ${fullSmsPhone}.`);
      } else {
        if (data.code === 'SMS_NOT_CONFIGURED' && data.missingVars) {
          setMissingSmsVars(data.missingVars);
        }
        setFormError(data.error ?? 'Failed to send SMS verification code.');
      }
    } catch {
      setFormError('Network error while contacting SMS verification service.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);

    if (!/^\d{4,10}$/.test(otpCode.trim())) {
      setFieldErrors({ otpCode: msgs.otpFormat });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const data = await verifyOtp({
        phone: fullSmsPhone,
        code: otpCode.trim(),
        mode: 'login',
        rememberMe,
      });

      if (data.ok && data.user) {
        if (data.user.accountRole === 'doctor') {
          setActiveModule('dashboard');
          if (data.user.doctorVerificationStatus !== 'approved') {
            openDoctorVerificationModal();
          }
        } else {
          setActiveModule('profile');
        }
        onAuthSuccess?.();
      } else {
        setFormError(data.error ?? 'Verification failed.');
      }
    } catch {
      setFormError('Network error while verifying code.');
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    'w-full h-10 px-3 text-xs bg-zinc-50 border rounded-lg focus:outline-none focus:bg-white focus:ring-2 transition-colors';

  const inputClass = (field: string) =>
    `${inputBase} ${
      fieldErrors[field]
        ? 'border-red-500 focus:ring-red-500 bg-red-50/40'
        : 'border-zinc-200 focus:ring-emerald-600'
    }`;

  return (
    <div className="space-y-4">
      {/* Mode Switch Tabs: Sign In / Register */}
      <div className="grid grid-cols-2 p-1 bg-zinc-100 border border-zinc-200 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setFormError(null);
            setFieldErrors({});
            setInfoMsg(null);
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
            setFormError(null);
            setFieldErrors({});
            setInfoMsg(null);
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

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>{formError}</div>
        </div>
      )}

      {infoMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>{infoMsg}</div>
        </div>
      )}

      {mode === 'register' ? (
        <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3">
          {/* Mandatory Account Role Selection: Patient or Doctor */}
          <div>
            <div className="block text-xs font-semibold text-zinc-800 mb-1.5">
              {t('auth_role_label')} <span className="text-red-600">*</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('patient');
                  clearFieldError('accountRole');
                }}
                aria-pressed={selectedRole === 'patient'}
                className={`p-3 rounded-xl border text-left transition-colors flex items-start gap-2.5 ${
                  selectedRole === 'patient'
                    ? 'bg-zinc-950 text-white border-emerald-500 ring-2 ring-emerald-500/40'
                    : fieldErrors.accountRole
                      ? 'bg-red-50/40 border-red-400 text-zinc-900 hover:border-red-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 hover:border-zinc-300'
                }`}
              >
                <User
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    selectedRole === 'patient' ? 'text-emerald-400' : 'text-emerald-600'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold">{t('role_choice_patient')}</div>
                  <div
                    className={`text-[11px] mt-0.5 leading-snug ${
                      selectedRole === 'patient' ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {t('auth_role_patient_desc')}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRole('doctor');
                  clearFieldError('accountRole');
                }}
                aria-pressed={selectedRole === 'doctor'}
                className={`p-3 rounded-xl border text-left transition-colors flex items-start gap-2.5 ${
                  selectedRole === 'doctor'
                    ? 'bg-zinc-950 text-white border-emerald-500 ring-2 ring-emerald-500/40'
                    : fieldErrors.accountRole
                      ? 'bg-red-50/40 border-red-400 text-zinc-900 hover:border-red-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 hover:border-zinc-300'
                }`}
              >
                <Stethoscope
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    selectedRole === 'doctor' ? 'text-emerald-400' : 'text-emerald-600'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold">{t('role_choice_doctor')}</div>
                  <div
                    className={`text-[11px] mt-0.5 leading-snug ${
                      selectedRole === 'doctor' ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {t('auth_role_doctor_desc')}
                  </div>
                </div>
              </button>
            </div>
            {fieldErrors.accountRole && (
              <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.accountRole}</p>
            )}
          </div>

          {/* 1. First Name & 2. Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-first-name" className="block text-xs font-semibold text-zinc-800 mb-1">
                {t('auth_first_name')} <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-first-name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    clearFieldError('firstName');
                  }}
                  placeholder={language === 'en' ? 'Amina' : 'Амина'}
                  className={`${inputClass('firstName')} pl-8`}
                />
              </div>
              {fieldErrors.firstName && (
                <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.firstName}</p>
              )}
            </div>

            <div>
              <label htmlFor="reg-last-name" className="block text-xs font-semibold text-zinc-800 mb-1">
                {t('auth_last_name')} <span className="text-red-600">*</span>
              </label>
              <input
                id="reg-last-name"
                type="text"
                required
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  clearFieldError('lastName');
                }}
                placeholder={language === 'en' ? 'Nurlanova' : 'Нурланова'}
                className={inputClass('lastName')}
              />
              {fieldErrors.lastName && (
                <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.lastName}</p>
              )}
            </div>
          </div>

          {/* 3. Age & 5. Email */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <label htmlFor="reg-age" className="block text-xs font-semibold text-zinc-800 mb-1">
                {t('auth_age')} <span className="text-red-600">*</span>
              </label>
              <input
                id="reg-age"
                type="text"
                inputMode="numeric"
                required
                value={age}
                onChange={(e) => {
                  const raw = e.target.value;
                  // Allow typing so user sees clear error if pasting non-digits, or accept clean numeric input
                  setAge(raw);
                  clearFieldError('age');
                }}
                placeholder="28"
                className={`${inputClass('age')} font-mono`}
              />
              {fieldErrors.age && (
                <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.age}</p>
              )}
            </div>

            <div className="sm:col-span-8">
              <label htmlFor="reg-email" className="block text-xs font-semibold text-zinc-800 mb-1">
                {t('auth_email_req')} <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError('email');
                  }}
                  placeholder="amina@example.com"
                  className={`${inputClass('email')} pl-8`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.email}</p>
              )}
            </div>
          </div>

          {/* 4. Phone Number with Country Code Selector */}
          <div>
            <label htmlFor="reg-phone" className="block text-xs font-semibold text-zinc-800 mb-1">
              {t('auth_phone_label')} <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5 sm:col-span-4">
                <select
                  aria-label={t('auth_country_code')}
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value);
                    clearFieldError('phone');
                  }}
                  className="w-full h-10 px-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-7 sm:col-span-8 relative">
                <Phone className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  value={localPhone}
                  onChange={(e) => {
                    setLocalPhone(e.target.value);
                    clearFieldError('phone');
                  }}
                  placeholder="701 555 0101"
                  className={`${inputClass('phone')} pl-8 font-mono`}
                />
              </div>
            </div>
            {fieldErrors.phone && (
              <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.phone}</p>
            )}
          </div>

          {/* 6. Password & 7. Confirm Password with Show/Hide toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-zinc-800 mb-1">
                {t('auth_password')} <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError('password');
                  }}
                  placeholder="••••••"
                  className={`${inputClass('password')} pl-8 pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth_hide_password') : t('auth_show_password')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-900 rounded"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-zinc-800 mb-1">
                {t('auth_confirm_password')} <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearFieldError('confirmPassword');
                  }}
                  placeholder="••••••"
                  className={`${inputClass('confirmPassword')} pl-8 pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? t('auth_hide_password') : t('auth_show_password')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-900 rounded"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer pt-0.5">
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
            className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
          >
            {loading ? t('auth_registering') : t('auth_register_submit')}
          </button>
        </form>
      ) : (
        <div className="space-y-3.5">
          {/* Login Method Selector: Password vs SMS OTP */}
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setLoginMethod('password');
                setFormError(null);
                setFieldErrors({});
                setInfoMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                loginMethod === 'password'
                  ? 'bg-zinc-950 text-white border-zinc-950'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:text-zinc-950'
              }`}
            >
              {t('auth_login_method_password')}
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('sms');
                setSmsStep('phone');
                setFormError(null);
                setFieldErrors({});
                setInfoMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                loginMethod === 'sms'
                  ? 'bg-zinc-950 text-white border-zinc-950'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:text-zinc-950'
              }`}
            >
              {t('auth_login_method_sms')}
            </button>
          </div>

          {loginMethod === 'password' ? (
            <form onSubmit={handlePasswordLoginSubmit} noValidate className="space-y-3.5">
              <div>
                <label htmlFor="login-identifier" className="block text-xs font-semibold text-zinc-800 mb-1">
                  {t('auth_login_identifier')} <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => {
                      setLoginIdentifier(e.target.value);
                      clearFieldError('identifier');
                    }}
                    placeholder={t('auth_login_identifier_ph')}
                    className={`${inputClass('identifier')} pl-8`}
                  />
                </div>
                {fieldErrors.identifier && (
                  <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.identifier}</p>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-zinc-800 mb-1">
                  {t('auth_password')} <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      clearFieldError('password');
                    }}
                    placeholder="••••••"
                    className={`${inputClass('password')} pl-8 pr-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    aria-label={showLoginPassword ? t('auth_hide_password') : t('auth_show_password')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-900 rounded"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.password}</p>
                )}
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
                className="w-full py-2.5 text-xs font-bold text-white bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 rounded-lg transition-colors"
              >
                {loading ? t('auth_logging_in') : t('auth_login_submit')}
              </button>
            </form>
          ) : (
            <div className="space-y-3.5">
              {(missingSmsVars.length > 0 || (configStatus && !configStatus.smsConfigured)) && (
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

              {smsStep === 'phone' ? (
                <form onSubmit={handleRequestOtp} noValidate className="space-y-3.5">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <label className="block text-xs font-semibold text-zinc-800 mb-1">
                        {t('auth_country_code')}
                      </label>
                      <select
                        value={smsCountryCode}
                        onChange={(e) => {
                          setSmsCountryCode(e.target.value);
                          clearFieldError('smsPhone');
                        }}
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
                      <label className="block text-xs font-semibold text-zinc-800 mb-1">
                        {t('auth_phone_label')}
                      </label>
                      <input
                        type="tel"
                        required
                        value={smsLocalPhone}
                        onChange={(e) => {
                          setSmsLocalPhone(e.target.value);
                          clearFieldError('smsPhone');
                        }}
                        placeholder="701 555 0101"
                        className={`${inputClass('smsPhone')} font-mono`}
                      />
                    </div>
                  </div>
                  {fieldErrors.smsPhone && (
                    <p className="text-[11px] font-medium text-red-600">{fieldErrors.smsPhone}</p>
                  )}

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
                    className="w-full py-2.5 text-xs font-bold text-white bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {loading ? t('auth_sending') : t('auth_send_code')}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} noValidate className="space-y-3.5">
                  <div className="flex items-center justify-between text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                    <span className="font-mono font-semibold text-zinc-950">{fullSmsPhone}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSmsStep('phone');
                        setOtpCode('');
                        setFormError(null);
                      }}
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      {t('auth_change_phone')}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-800 mb-1">
                      {t('auth_code_label')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.target.value);
                        clearFieldError('otpCode');
                      }}
                      placeholder="123456"
                      className="w-full h-11 px-3 text-center text-base tracking-[0.25em] font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                    />
                    {fieldErrors.otpCode && (
                      <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.otpCode}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {loading ? t('auth_verifying') : t('auth_verify_btn')}
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-zinc-100 flex items-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{t('profile_privacy_note')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
