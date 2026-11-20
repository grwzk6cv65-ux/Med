import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileBadge2,
  FileCheck2,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Upload,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedradar } from '../context/MedradarContext';
import { fetchProtectedDocumentBlobUrl } from '../services/api';
import { DoctorVerificationStatus } from '../types/medradar';

const SPECIALTY_OPTIONS = [
  'Кардиолог',
  'Терапевт',
  'Хирург',
  'Педиатр',
  'Эндокринолог',
  'Невролог',
  'Акушер-гинеколог',
  'Врач общей практики',
  'Другое',
];

export function DoctorStatusBadge({ status }: { status: DoctorVerificationStatus }) {
  const { t } = useMedradar();
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
        <span>{t('doc_status_approved')}</span>
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-zinc-950 text-emerald-400 border border-zinc-800 rounded-md">
        <Clock className="w-3.5 h-3.5" />
        <span>{t('doc_status_pending')}</span>
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-red-100 text-red-900 border border-red-300 rounded-md">
        <XCircle className="w-3.5 h-3.5 text-red-700" />
        <span>{t('doc_status_rejected')}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
      <span>{t('doc_status_unverified')}</span>
    </span>
  );
}

export function DoctorVerificationModal() {
  const { t, language, setActiveModule } = useMedradar();
  const {
    user,
    doctorVerification,
    doctorVerificationModalOpen,
    closeDoctorVerificationModal,
    submitDoctorVerification,
    refreshDoctorVerification,
  } = useAuth();

  const [fullName, setFullName] = useState('');
  const [specialtyChoice, setSpecialtyChoice] = useState('Кардиолог');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [issuingRegion, setIssuingRegion] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [documentFileName, setDocumentFileName] = useState('');
  const [documentDataUrl, setDocumentDataUrl] = useState('');
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!doctorVerificationModalOpen || !user) return;
    void refreshDoctorVerification();
  }, [doctorVerificationModalOpen, user, refreshDoctorVerification]);

  useEffect(() => {
    if (!user) return;
    const defaultName =
      doctorVerification?.fullName ||
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.fullName ||
      '';
    setFullName(defaultName);

    if (doctorVerification) {
      const matchedOpt = SPECIALTY_OPTIONS.find(
        (opt) => opt !== 'Другое' && opt.toLowerCase() === doctorVerification.specialty.toLowerCase()
      );
      if (matchedOpt) {
        setSpecialtyChoice(matchedOpt);
        setCustomSpecialty('');
      } else if (doctorVerification.specialty) {
        setSpecialtyChoice('Другое');
        setCustomSpecialty(doctorVerification.specialty);
      }
      setInstitutionName(doctorVerification.institutionName || '');
      setLicenseNumber(doctorVerification.licenseNumber || '');
      setIssuingRegion(doctorVerification.issuingRegion || '');
      setIssueDate(doctorVerification.issueDate || '');
      setDocumentFileName(doctorVerification.fileName || '');
    }
  }, [user, doctorVerification, doctorVerificationModalOpen]);

  useEffect(() => {
    return () => {
      if (previewDocUrl) URL.revokeObjectURL(previewDocUrl);
    };
  }, [previewDocUrl]);

  if (!doctorVerificationModalOpen || !user || user.accountRole !== 'doctor') {
    return null;
  }

  const status: DoctorVerificationStatus = user.doctorVerificationStatus || 'unverified';
  const showForm = status === 'unverified' || status === 'rejected';

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        document:
          language === 'ru'
            ? 'Допустимые форматы: JPG, PNG, WEBP или PDF.'
            : language === 'kk'
              ? 'Рұқсат етілген форматтар: JPG, PNG, WEBP немесе PDF.'
              : 'Allowed formats: JPG, PNG, WEBP, or PDF.',
      }));
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        document:
          language === 'ru'
            ? 'Размер файла не должен превышать 4 МБ.'
            : language === 'kk'
              ? 'Файл өлшемі 4 МБ-тан аспауы керек.'
              : 'File size must not exceed 4 MB.',
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDocumentDataUrl(reader.result);
        setDocumentFileName(file.name);
        clearFieldError('document');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenSubmittedDoc = async () => {
    const res = await fetchProtectedDocumentBlobUrl('/api/doctor/verification/document');
    if (res.ok && res.objectUrl) {
      const nextUrl = res.objectUrl;
      setPreviewDocUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } else if (res.error) {
      setFormError(res.error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    const errors: Record<string, string> = {};
    const resolvedSpecialty =
      specialtyChoice === 'Другое' ? customSpecialty.trim() : specialtyChoice;

    if (fullName.trim().length < 3) {
      errors.fullName =
        language === 'ru'
          ? 'Укажите имя и фамилию (минимум 3 символа).'
          : 'Enter your full name (at least 3 characters).';
    }
    if (resolvedSpecialty.length < 2) {
      errors.specialty =
        language === 'ru' ? 'Укажите медицинскую специализацию.' : 'Enter your specialty.';
    }
    if (institutionName.trim().length < 2) {
      errors.institutionName =
        language === 'ru'
          ? 'Укажите название медицинского учреждения.'
          : 'Enter the medical institution name.';
    }
    if (licenseNumber.trim().length < 4) {
      errors.licenseNumber =
        language === 'ru'
          ? 'Укажите корректный номер медицинской лицензии.'
          : 'Enter a valid medical license number.';
    }
    if (issuingRegion.trim().length < 2) {
      errors.issuingRegion =
        language === 'ru'
          ? 'Укажите регион выдачи лицензии.'
          : 'Enter the license issuing region.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate.trim())) {
      errors.issueDate =
        language === 'ru' ? 'Укажите дату выдачи лицензии.' : 'Select the license issue date.';
    }
    if (!documentDataUrl) {
      errors.document =
        language === 'ru'
          ? 'Загрузите фотографию или скан медицинской лицензии.'
          : 'Upload a photo or scan of your medical license.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await submitDoctorVerification({
        fullName: fullName.trim(),
        specialty: resolvedSpecialty,
        institutionName: institutionName.trim(),
        licenseNumber: licenseNumber.trim(),
        issuingRegion: issuingRegion.trim(),
        issueDate: issueDate.trim(),
        fileName: documentFileName || 'license',
        documentDataUrl,
      });

      if (res.ok) {
        setSuccessMsg(t('doc_pending_notice'));
      } else {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        setFormError(res.error || 'Could not submit verification request.');
      }
    } catch {
      setFormError('Network error while submitting verification details.');
    } finally {
      setSubmitting(false);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/65 backdrop-blur-[2px] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doctor-verif-modal-title"
    >
      <div className="w-full max-w-2xl bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Matte Black Header */}
        <div className="px-5 py-4 bg-zinc-950 text-white flex items-start justify-between gap-3 border-b border-zinc-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <Stethoscope className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 id="doctor-verif-modal-title" className="text-sm sm:text-base font-bold text-white">
                {t('doc_verif_title')}
              </h2>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{t('doc_verif_desc')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDoctorVerificationModal}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 max-h-[82vh] overflow-y-auto space-y-4">
          {/* Current Status Strip */}
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-zinc-700">{t('doc_status_label')}:</div>
            <DoctorStatusBadge status={status} />
          </div>

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {formError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {status === 'rejected' && user.doctorRejectionReason && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-950 space-y-1">
              <div className="font-bold">{t('doc_rejection_reason')}:</div>
              <div>{user.doctorRejectionReason}</div>
            </div>
          )}

          {status === 'approved' ? (
            <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 space-y-1">
                  <div className="font-bold text-sm">{t('doc_status_approved')}</div>
                  <p>{t('dash_doctor_sub')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModule('dashboard');
                  closeDoctorVerificationModal();
                }}
                className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                {t('doc_verif_open_cabinet')}
              </button>
            </div>
          ) : status === 'pending' && doctorVerification ? (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl text-xs leading-relaxed flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{t('doc_pending_notice')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div className="text-[11px] text-zinc-500">{t('doc_field_full_name')}</div>
                  <div className="font-semibold text-zinc-950 mt-0.5">{doctorVerification.fullName}</div>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div className="text-[11px] text-zinc-500">{t('doc_field_specialty')}</div>
                  <div className="font-semibold text-zinc-950 mt-0.5">{doctorVerification.specialty}</div>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div className="text-[11px] text-zinc-500">{t('doc_field_institution')}</div>
                  <div className="font-semibold text-zinc-950 mt-0.5">
                    {doctorVerification.institutionName}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div className="text-[11px] text-zinc-500">{t('doc_field_license_number')}</div>
                  <div className="font-mono font-semibold text-zinc-950 mt-0.5">
                    {doctorVerification.licenseNumber}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div className="text-[11px] text-zinc-500">{t('doc_field_region')}</div>
                  <div className="font-semibold text-zinc-950 mt-0.5">
                    {doctorVerification.issuingRegion}
                  </div>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div className="text-[11px] text-zinc-500">{t('doc_field_issue_date')}</div>
                  <div className="font-mono font-semibold text-zinc-950 mt-0.5">
                    {doctorVerification.issueDate}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleOpenSubmittedDoc}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('doc_view_uploaded_doc')}</span>
                </button>

                <button
                  type="button"
                  onClick={closeDoctorVerificationModal}
                  className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg"
                >
                  OK
                </button>
              </div>

              {previewDocUrl && (
                <div className="border border-zinc-200 rounded-xl p-2 bg-zinc-50">
                  {doctorVerification.mimeType === 'application/pdf' ? (
                    <iframe
                      src={previewDocUrl}
                      title="Uploaded medical license"
                      className="w-full h-72 rounded-lg bg-white"
                    />
                  ) : (
                    <img
                      src={previewDocUrl}
                      alt="Uploaded medical license"
                      className="max-h-72 mx-auto rounded-lg object-contain"
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            showForm && (
              <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
                {/* 1. Имя и фамилия */}
                <div>
                  <label htmlFor="doc-fullname" className="block text-xs font-semibold text-zinc-800 mb-1">
                    {t('doc_field_full_name')} <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="doc-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        clearFieldError('fullName');
                      }}
                      className={`${inputClass('fullName')} pl-8`}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.fullName}</p>
                  )}
                </div>

                {/* 2. Специализация + 3. Медучреждение */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="doc-specialty"
                      className="block text-xs font-semibold text-zinc-800 mb-1"
                    >
                      {t('doc_field_specialty')} <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="doc-specialty"
                      value={specialtyChoice}
                      onChange={(e) => {
                        setSpecialtyChoice(e.target.value);
                        clearFieldError('specialty');
                      }}
                      className={inputClass('specialty')}
                    >
                      {SPECIALTY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    {specialtyChoice === 'Другое' && (
                      <input
                        type="text"
                        value={customSpecialty}
                        onChange={(e) => {
                          setCustomSpecialty(e.target.value);
                          clearFieldError('specialty');
                        }}
                        placeholder={t('doc_field_specialty_other')}
                        className={`${inputClass('specialty')} mt-2`}
                      />
                    )}
                    {fieldErrors.specialty && (
                      <p className="mt-1 text-[11px] font-medium text-red-600">
                        {fieldErrors.specialty}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="doc-institution"
                      className="block text-xs font-semibold text-zinc-800 mb-1"
                    >
                      {t('doc_field_institution')} <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="doc-institution"
                        type="text"
                        required
                        value={institutionName}
                        onChange={(e) => {
                          setInstitutionName(e.target.value);
                          clearFieldError('institutionName');
                        }}
                        placeholder="Городская поликлиника №1"
                        className={`${inputClass('institutionName')} pl-8`}
                      />
                    </div>
                    {fieldErrors.institutionName && (
                      <p className="mt-1 text-[11px] font-medium text-red-600">
                        {fieldErrors.institutionName}
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Номер лицензии + 5. Регион + 6. Дата выдачи */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="doc-license-num"
                      className="block text-xs font-semibold text-zinc-800 mb-1"
                    >
                      {t('doc_field_license_number')} <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <FileBadge2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="doc-license-num"
                        type="text"
                        required
                        value={licenseNumber}
                        onChange={(e) => {
                          setLicenseNumber(e.target.value);
                          clearFieldError('licenseNumber');
                        }}
                        placeholder="KZ-MED-049218"
                        className={`${inputClass('licenseNumber')} pl-8 font-mono`}
                      />
                    </div>
                    {fieldErrors.licenseNumber && (
                      <p className="mt-1 text-[11px] font-medium text-red-600">
                        {fieldErrors.licenseNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="doc-region"
                      className="block text-xs font-semibold text-zinc-800 mb-1"
                    >
                      {t('doc_field_region')} <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="doc-region"
                        type="text"
                        required
                        value={issuingRegion}
                        onChange={(e) => {
                          setIssuingRegion(e.target.value);
                          clearFieldError('issuingRegion');
                        }}
                        placeholder="Акмолинская область"
                        className={`${inputClass('issuingRegion')} pl-8`}
                      />
                    </div>
                    {fieldErrors.issuingRegion && (
                      <p className="mt-1 text-[11px] font-medium text-red-600">
                        {fieldErrors.issuingRegion}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="doc-issue-date"
                      className="block text-xs font-semibold text-zinc-800 mb-1"
                    >
                      {t('doc_field_issue_date')} <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="doc-issue-date"
                        type="date"
                        required
                        value={issueDate}
                        onChange={(e) => {
                          setIssueDate(e.target.value);
                          clearFieldError('issueDate');
                        }}
                        className={`${inputClass('issueDate')} pl-8 font-mono`}
                      />
                    </div>
                    {fieldErrors.issueDate && (
                      <p className="mt-1 text-[11px] font-medium text-red-600">
                        {fieldErrors.issueDate}
                      </p>
                    )}
                  </div>
                </div>

                {/* 7. Загрузка фото или скана лицензии */}
                <div>
                  <label
                    htmlFor="doc-file"
                    className="block text-xs font-semibold text-zinc-800 mb-1"
                  >
                    {t('doc_field_document')} <span className="text-red-600">*</span>
                  </label>
                  <label
                    htmlFor="doc-file"
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                      fieldErrors.document
                        ? 'border-red-400 bg-red-50/40'
                        : documentDataUrl
                          ? 'border-emerald-500 bg-emerald-50/50'
                          : 'border-zinc-300 bg-zinc-50 hover:border-emerald-500'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {documentDataUrl ? (
                        <FileCheck2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <Upload className="w-5 h-5 text-zinc-500 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-zinc-800 truncate">
                        {documentFileName || t('doc_field_document_pick')}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-950 text-white rounded-md shrink-0">
                      JPG / PNG / PDF
                    </span>
                    <input
                      id="doc-file"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  {fieldErrors.document && (
                    <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors.document}</p>
                  )}

                  {documentDataUrl && documentDataUrl.startsWith('data:image/') && (
                    <div className="mt-2 p-2 bg-zinc-50 border border-zinc-200 rounded-xl">
                      <img
                        src={documentDataUrl}
                        alt={documentFileName || 'License preview'}
                        className="max-h-40 mx-auto rounded-lg object-contain"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {submitting ? t('doc_verif_submitting') : t('doc_verif_submit')}
                </button>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}
