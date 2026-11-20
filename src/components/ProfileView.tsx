import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit3,
  FileBadge2,
  LifeBuoy,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
  User,
  UserCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedradar } from '../context/MedradarContext';
import { AuthFormPanel, COUNTRY_CODES, validateMessages } from './AuthFormPanel';
import { DoctorStatusBadge } from './DoctorVerificationModal';

function extractPhoneParts(phoneE164: string, savedCC?: string, savedLocal?: string) {
  if (savedCC && savedLocal) {
    return { countryCode: savedCC, localPhone: savedLocal };
  }
  const matched = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => phoneE164.startsWith(c.code));
  if (matched) {
    return {
      countryCode: matched.code,
      localPhone: phoneE164.slice(matched.code.length),
    };
  }
  return {
    countryCode: '+7',
    localPhone: phoneE164.replace(/^\+/, ''),
  };
}

export function ProfileView() {
  const { t, language, setActiveModule } = useMedradar();
  const { user, loadingAuth, updateProfile, logout, requestDoctorCabinetAccess } = useAuth();
  const msgs = validateMessages(language);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [countryCode, setCountryCode] = useState('+7');
  const [localPhone, setLocalPhone] = useState('');
  const [email, setEmail] = useState('');
  const [villageName, setVillageName] = useState('');

  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const derivedParts = user.fullName ? user.fullName.trim().split(/\s+/) : [];
      setFirstName(user.firstName || derivedParts[0] || '');
      setLastName(user.lastName || derivedParts.slice(1).join(' ') || '');
      setAge(user.age !== null && user.age !== undefined ? String(user.age) : '');
      const phoneParts = extractPhoneParts(user.phoneE164 || '', user.countryCode, user.localPhone);
      setCountryCode(phoneParts.countryCode);
      setLocalPhone(phoneParts.localPhone);
      setEmail(user.email || '');
      setVillageName(user.villageName || '');
    }
  }, [user]);

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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    const errors: Record<string, string> = {};
    const fn = firstName.trim();
    const ln = lastName.trim();
    const ageClean = age.trim();
    const phoneDigits = localPhone.replace(/\D/g, '');
    const fullPhone = `${countryCode}${phoneDigits}`;
    const emailClean = email.trim();

    if (fn.length < 2) errors.firstName = msgs.firstNameReq;
    if (ln.length < 2) errors.lastName = msgs.lastNameReq;

    if (!ageClean || !/^\d+$/.test(ageClean)) {
      errors.age = msgs.ageReq;
    } else {
      const ageNum = Number.parseInt(ageClean, 10);
      if (ageNum < 1 || ageNum > 120) {
        errors.age = msgs.ageRange;
      }
    }

    if (!phoneDigits || !/^\+[1-9]\d{7,14}$/.test(fullPhone) || phoneDigits.length < 7 || phoneDigits.length > 13) {
      errors.phone = msgs.phoneFormat;
    }

    if (!emailClean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      errors.email = msgs.emailFormat;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      const result = await updateProfile({
        firstName: fn,
        lastName: ln,
        age: Number.parseInt(ageClean, 10),
        countryCode,
        localPhone: phoneDigits,
        phone: fullPhone,
        email: emailClean,
        villageName: villageName.trim(),
      });

      if (result.ok && result.user) {
        setEditing(false);
        setSuccessMsg(t('auth_saved_notice'));
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setFormError(result.error ?? 'Could not save profile changes.');
      }
    } catch {
      setFormError('Network error while saving profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      const derivedParts = user.fullName ? user.fullName.trim().split(/\s+/) : [];
      setFirstName(user.firstName || derivedParts[0] || '');
      setLastName(user.lastName || derivedParts.slice(1).join(' ') || '');
      setAge(user.age !== null && user.age !== undefined ? String(user.age) : '');
      const phoneParts = extractPhoneParts(user.phoneE164 || '', user.countryCode, user.localPhone);
      setCountryCode(phoneParts.countryCode);
      setLocalPhone(phoneParts.localPhone);
      setEmail(user.email || '');
      setVillageName(user.villageName || '');
    }
    setFieldErrors({});
    setFormError(null);
    setEditing(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setEditing(false);
      setSuccessMsg(null);
    } finally {
      setLoggingOut(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-xs text-zinc-500">
        Loading...
      </div>
    );
  }

  // Unauthenticated view: Full MEDRADAR Registration / Login Page
  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            {t('profile_cabinet_title')}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1">{t('auth_modal_sub')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Matte Black Feature Highlight Column */}
          <div className="lg:col-span-5 bg-zinc-950 text-white rounded-2xl p-6 border border-zinc-800 space-y-5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">{t('auth_modal_title')}</h2>
              <p className="text-xs text-zinc-300 leading-relaxed">{t('profile_privacy_note')}</p>
            </div>
            <ul className="space-y-2.5 text-xs text-zinc-200 pt-2 border-t border-zinc-800">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{t('profile_field_full_name')}, {t('profile_field_age').toLowerCase()}, {t('profile_field_phone').toLowerCase()}, {t('profile_field_email').toLowerCase()}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{t('profile_quick_passport')} & {t('profile_quick_journey')}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{t('profile_quick_support')}</span>
              </li>
            </ul>
          </div>

          {/* White Auth Form Card (Defaults to Register) */}
          <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-xs">
            <AuthFormPanel initialMode="register" />
          </div>
        </div>
      </div>
    );
  }

  const displayName =
    user.firstName || user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.fullName || user.phoneE164;

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'U';

  const inputBase =
    'w-full h-10 px-3 text-xs bg-zinc-50 border rounded-lg focus:outline-none focus:bg-white focus:ring-2 transition-colors';
  const inputClass = (field: string) =>
    `${inputBase} ${
      fieldErrors[field]
        ? 'border-red-500 focus:ring-red-500 bg-red-50/40'
        : 'border-zinc-200 focus:ring-emerald-600'
    }`;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            {t('profile_cabinet_title')}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1">{t('profile_cabinet_sub')}</p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-900 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-zinc-200 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('auth_logout')}</span>
        </button>
      </div>

      {/* Matte Black Hero Card */}
      <div className="bg-zinc-950 text-white border border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-zinc-950 font-extrabold text-lg flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white truncate">{displayName}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-md">
                <UserCheck className="w-3 h-3" />
                {user.accountRole === 'doctor' ? t('role_choice_doctor') : t('role_choice_patient')}
              </span>
              {user.accountRole === 'doctor' && (
                <DoctorStatusBadge status={user.doctorVerificationStatus} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5 font-mono text-zinc-200">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                {user.phoneE164}
              </span>
              {user.email && (
                <span className="inline-flex items-center gap-1.5 text-zinc-200">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  {user.email}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                {t('profile_member_since')}: {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => {
              setSuccessMsg(null);
              setEditing(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-colors shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{t('profile_edit_btn')}</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {formError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Content: "Мой профиль" Card + Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Мой профиль (View or Edit) */}
        <section className="lg:col-span-8 bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-zinc-950">{t('profile_section_title')}</h3>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setSuccessMsg(null);
                  setEditing(true);
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-600 inline-flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{t('profile_edit_btn')}</span>
              </button>
            )}
          </div>

          {!editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-medium text-zinc-500">{t('profile_field_full_name')}</div>
                <div className="text-sm font-bold text-zinc-950 mt-1">{displayName}</div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-medium text-zinc-500">{t('profile_field_age')}</div>
                <div className="text-sm font-bold text-zinc-950 font-mono mt-1">
                  {user.age !== null ? `${user.age} ${t('profile_age_years')}` : '—'}
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-medium text-zinc-500">{t('profile_field_phone')}</div>
                <div className="text-sm font-bold text-zinc-950 font-mono mt-1">{user.phoneE164}</div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-medium text-zinc-500">{t('profile_field_email')}</div>
                <div className="text-sm font-bold text-zinc-950 mt-1 break-all">
                  {user.email || '—'}
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-medium text-zinc-500">{t('profile_field_village')}</div>
                <div className="text-sm font-semibold text-zinc-900 mt-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{user.villageName || '—'}</span>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-medium text-zinc-500">{t('auth_role_label')}</div>
                <div className="text-sm font-semibold text-zinc-900 mt-1">
                  {user.accountRole === 'doctor' ? t('role_choice_doctor') : t('role_choice_patient')}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{t('auth_role_locked_note')}</div>
              </div>

              {user.accountRole === 'doctor' && (
                <div className="sm:col-span-2 p-4 bg-zinc-950 text-white rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4" />
                        <span>{t('doc_status_label')}</span>
                      </span>
                      <DoctorStatusBadge status={user.doctorVerificationStatus} />
                    </div>
                    {user.doctorVerificationStatus === 'rejected' && user.doctorRejectionReason && (
                      <p className="text-xs text-red-300">
                        {t('doc_rejection_reason')}: {user.doctorRejectionReason}
                      </p>
                    )}
                    {user.doctorVerificationStatus !== 'approved' && (
                      <p className="text-[11px] text-zinc-300">{t('doc_gate_desc')}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await requestDoctorCabinetAccess();
                      if (res === 'granted') setActiveModule('dashboard');
                    }}
                    className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {user.doctorVerificationStatus === 'approved'
                      ? t('doc_verif_open_cabinet')
                      : t('doc_verif_btn')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveEdit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="edit-first-name" className="block text-xs font-semibold text-zinc-800 mb-1">
                    {t('auth_first_name')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-first-name"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      clearFieldError('firstName');
                    }}
                    className={inputClass('firstName')}
                  />
                  {fieldErrors.firstName && (
                    <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.firstName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="edit-last-name" className="block text-xs font-semibold text-zinc-800 mb-1">
                    {t('auth_last_name')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-last-name"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      clearFieldError('lastName');
                    }}
                    className={inputClass('lastName')}
                  />
                  {fieldErrors.lastName && (
                    <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-4">
                  <label htmlFor="edit-age" className="block text-xs font-semibold text-zinc-800 mb-1">
                    {t('auth_age')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-age"
                    type="text"
                    inputMode="numeric"
                    required
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value);
                      clearFieldError('age');
                    }}
                    className={`${inputClass('age')} font-mono`}
                  />
                  {fieldErrors.age && (
                    <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.age}</p>
                  )}
                </div>

                <div className="sm:col-span-8">
                  <label htmlFor="edit-email" className="block text-xs font-semibold text-zinc-800 mb-1">
                    {t('auth_email_req')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError('email');
                    }}
                    className={inputClass('email')}
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="edit-phone" className="block text-xs font-semibold text-zinc-800 mb-1">
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
                  <div className="col-span-7 sm:col-span-8">
                    <input
                      id="edit-phone"
                      type="tel"
                      required
                      value={localPhone}
                      onChange={(e) => {
                        setLocalPhone(e.target.value);
                        clearFieldError('phone');
                      }}
                      className={`${inputClass('phone')} font-mono`}
                    />
                  </div>
                </div>
                {fieldErrors.phone && (
                  <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.phone}</p>
                )}
              </div>

              <div>
                <label htmlFor="edit-village" className="block text-xs font-semibold text-zinc-800 mb-1">
                  {t('auth_village')}
                </label>
                <input
                  id="edit-village"
                  type="text"
                  value={villageName}
                  onChange={(e) => setVillageName(e.target.value)}
                  className={inputClass('villageName')}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {t('auth_save_profile')}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                >
                  {t('profile_cancel_edit')}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Right Side: Privacy Guarantee & Quick MEDRADAR Navigation */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-950">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>MEDRADAR Privacy</span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">{t('profile_privacy_note')}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-2.5">
            <button
              type="button"
              onClick={() => setActiveModule('passport_referrals')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-zinc-900 bg-zinc-50 hover:bg-emerald-50 hover:text-emerald-900 border border-zinc-200 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileBadge2 className="w-4 h-4 text-emerald-600" />
                {t('profile_quick_passport')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('care_loop')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-zinc-900 bg-zinc-50 hover:bg-emerald-50 hover:text-emerald-900 border border-zinc-200 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-2">
                <RefreshCcw className="w-4 h-4 text-emerald-600" />
                {t('profile_quick_journey')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('support')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-zinc-900 bg-zinc-50 hover:bg-emerald-50 hover:text-emerald-900 border border-zinc-200 rounded-xl transition-colors"
            >
              <span className="flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-emerald-600" />
                {t('profile_quick_support')}
              </span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
