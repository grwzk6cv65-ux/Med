import { Language, PatientVitals } from '../types/medradar';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const MESSAGES = {
  en: {
    required: 'This field is required.',
    nameInvalid: 'Enter a valid full name (at least 2 letters, no digits).',
    phoneInvalid: 'Enter a valid phone number (e.g. +7 701 234 5678, 10-15 digits).',
    dateInvalid: 'Enter a valid calendar date (YYYY-MM-DD).',
    timeInvalid: 'Enter a valid time in HH:MM format.',
    windowInvalid: 'Enter a valid time window (e.g. 09:00 - 14:00, start before end).',
    notesShort: 'Please provide at least 5 characters of clinical notes.',
    titleShort: 'Reminder title must be at least 3 characters.',
    rangeError: (min: number, max: number) => `Value must be between ${min} and ${max}.`,
    bpOrder: 'Systolic BP must be greater than Diastolic BP.',
  },
  ru: {
    required: 'Это поле обязательно для заполнения.',
    nameInvalid: 'Введите корректное имя (минимум 2 буквы, без цифр).',
    phoneInvalid: 'Введите корректный телефон (например +7 701 234 5678, 10–15 цифр).',
    dateInvalid: 'Укажите корректную дату в формате ГГГГ-ММ-ДД.',
    timeInvalid: 'Укажите корректное время в формате ЧЧ:ММ.',
    windowInvalid: 'Укажите интервал времени (напр. 09:00 - 14:00, начало раньше конца).',
    notesShort: 'Введите минимум 5 символов в примечании.',
    titleShort: 'Название напоминания должно содержать минимум 3 символа.',
    rangeError: (min: number, max: number) => `Допустимый диапазон: от ${min} до ${max}.`,
    bpOrder: 'Систолическое давление должно быть выше диастолического.',
  },
  kk: {
    required: 'Бұл өрісті толтыру міндетті.',
    nameInvalid: 'Дұрыс аты-жөнін енгізіңіз (кемінде 2 әріп, сандарсыз).',
    phoneInvalid: 'Дұрыс телефон нөмірін енгізіңіз (мысалы +7 701 234 5678, 10–15 цифр).',
    dateInvalid: 'ЖЖЖЖ-АА-КК пішіміндегі жарамды күнді енгізіңіз.',
    timeInvalid: 'СС:ММ пішіміндегі жарамды уақытты енгізіңіз.',
    windowInvalid: 'Дұрыс уақыт аралығын енгізіңіз (мыс. 09:00 - 14:00).',
    notesShort: 'Кемінде 5 таңбадан тұратын жазба енгізіңіз.',
    titleShort: 'Еске салғыш атауы кемінде 3 таңба болуы тиіс.',
    rangeError: (min: number, max: number) => `Мән ${min} мен ${max} аралығында болуы керек.`,
    bpOrder: 'Систолалық қысым диастолалық қысымнан жоғары болуы тиіс.',
  },
};

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isValidTime(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [h, m] = timeStr.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function isValidPhone(phoneStr: string): boolean {
  const trimmed = phoneStr.trim();
  if (!/^[+\d\s()-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidPersonName(nameStr: string): boolean {
  const trimmed = nameStr.trim();
  if (trimmed.length < 2) return false;
  if (/\d/.test(trimmed)) return false;
  return /[\p{L}]/u.test(trimmed);
}

export function validateReferralInput(
  input: {
    specialty: string;
    scheduledDate: string;
    timeSlot: string;
    patientPhone: string;
    doctorNotes: string;
  },
  lang: Language
): ValidationResult {
  const msg = MESSAGES[lang] ?? MESSAGES.en;
  const errors: Record<string, string> = {};

  if (!input.specialty.trim()) errors.specialty = msg.required;
  if (!isValidCalendarDate(input.scheduledDate)) errors.scheduledDate = msg.dateInvalid;
  if (!isValidTime(input.timeSlot)) errors.timeSlot = msg.timeInvalid;
  if (!input.patientPhone.trim()) {
    errors.patientPhone = msg.required;
  } else if (!isValidPhone(input.patientPhone)) {
    errors.patientPhone = msg.phoneInvalid;
  }
  if (input.doctorNotes.trim().length < 5) {
    errors.doctorNotes = msg.notesShort;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateReminderInput(
  input: {
    title: string;
    dueDate: string;
    dueTime?: string;
  },
  lang: Language
): ValidationResult {
  const msg = MESSAGES[lang] ?? MESSAGES.en;
  const errors: Record<string, string> = {};

  if (input.title.trim().length < 3) errors.title = msg.titleShort;
  if (!isValidCalendarDate(input.dueDate)) errors.dueDate = msg.dateInvalid;
  if (input.dueTime && input.dueTime.trim() !== '' && !isValidTime(input.dueTime.trim())) {
    errors.dueTime = msg.timeInvalid;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateMedMobileStopInput(
  input: {
    villageId: string;
    timeWindow: string;
    teamLead: string;
  },
  lang: Language
): ValidationResult {
  const msg = MESSAGES[lang] ?? MESSAGES.en;
  const errors: Record<string, string> = {};

  if (!input.villageId) errors.villageId = msg.required;

  const match = input.timeWindow.trim().match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!match || !isValidTime(match[1]) || !isValidTime(match[2]) || match[1] >= match[2]) {
    errors.timeWindow = msg.windowInvalid;
  }

  if (!isValidPersonName(input.teamLead)) {
    errors.teamLead = msg.nameInvalid;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateRapidLabVitals(
  vitals: PatientVitals,
  lang: Language
): ValidationResult {
  const msg = MESSAGES[lang] ?? MESSAGES.en;
  const errors: Record<string, string> = {};

  const checkRange = (key: keyof PatientVitals, min: number, max: number) => {
    const val = vitals[key];
    if (typeof val !== 'number' || Number.isNaN(val) || val < min || val > max) {
      errors[key] = msg.rangeError(min, max);
    }
  };

  checkRange('systolicBP', 60, 260);
  checkRange('diastolicBP', 40, 160);
  checkRange('heartRate', 35, 220);
  checkRange('spo2', 50, 100);
  checkRange('glucoseMmol', 1.5, 35);
  checkRange('hba1c', 3.5, 16);
  checkRange('hemoglobin', 50, 220);
  checkRange('crp', 0, 250);
  checkRange('cholesterol', 1.5, 15);

  if (!errors.systolicBP && !errors.diastolicBP && vitals.systolicBP <= vitals.diastolicBP) {
    errors.systolicBP = msg.bpOrder;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
