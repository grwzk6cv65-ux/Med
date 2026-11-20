import { pickLocalized } from '../i18n/translations';
import {
  DemoPatient,
  Language,
  MedicalCluster,
  MedMobileStop,
  ModuleId,
  PreventiveReminder,
  RapidLabRecord,
  SmartReferral,
  UserRole,
  Village,
} from '../types/medradar';
import { evaluatePatientRadar } from './aiRadarEngine';

export interface AssistantContextSnapshot {
  language: Language;
  role: UserRole;
  activePatient: DemoPatient;
  clusters: MedicalCluster[];
  villages: Village[];
  patients: DemoPatient[];
  rapidLabs: RapidLabRecord[];
  medMobileSchedule: MedMobileStop[];
  referrals: SmartReferral[];
  reminders: PreventiveReminder[];
}

export interface AssistantAction {
  label: string;
  module?: ModuleId;
  patientId?: string;
  villageId?: string;
  openReminderForm?: boolean;
  openSupportForm?: boolean;
}

export interface AssistantReply {
  text: string;
  actions?: AssistantAction[];
  offeredSupport?: boolean;
}

/**
 * 100% Free Local Rule-Based Assistant Simulation for NANO.
 * - Uses ONLY actual saved data in MEDRADAR state (never invents records).
 * - Respects Patient View privacy (scopes queries to activePatient only).
 * - Never diagnoses or replaces a qualified healthcare professional.
 * - Fluent in Kazakh (kk), Russian (ru), and English (en).
 */
export function generateAssistantReply(
  query: string,
  ctx: AssistantContextSnapshot
): AssistantReply {
  const q = query.toLowerCase().trim();
  const {
    language,
    role,
    patients,
    villages,
    clusters,
    referrals,
    reminders,
    medMobileSchedule,
    activePatient,
  } = ctx;

  // Enforce patient privacy boundary when in Patient View
  const scopedReferrals =
    role === 'patient'
      ? referrals.filter((r) => r.patientId === activePatient.id)
      : referrals;
  const scopedReminders =
    role === 'patient'
      ? reminders.filter((r) => r.patientId === activePatient.id)
      : reminders;

  const activePatientReferrals = referrals.filter((r) => r.patientId === activePatient.id);
  const activePatientDueReminders = reminders.filter(
    (r) => r.patientId === activePatient.id && r.status === 'due'
  );

  // 0. Technical support & problem recognition (EN / RU / KK)
  const problemSignals = [
    'not working',
    'doesn\'t work',
    'does not open',
    'won\'t open',
    'cannot ',
    'can\'t ',
    'problem',
    'issue',
    'error',
    'bug',
    'broken',
    'support',
    'human',
    'contact team',
    'не работает',
    'не открывается',
    'не могу',
    'проблема',
    'ошибка',
    'сбой',
    'поддержк',
    'техподдерж',
    'оператор',
    'істемейді',
    'ашылмайды',
    'қате',
    'мәселе',
    'қолдау',
    'көмек қызмет',
  ];
  if (problemSignals.some((sig) => q.includes(sig))) {
    if (language === 'ru') {
      return {
        offeredSupport: true,
        text:
          'Мне жаль, что у вас возникли трудности с MEDRADAR. Я могу отправить ваш вопрос нашей команде поддержки. Хотите, чтобы я это сделал?',
        actions: [
          { label: 'Да, отправить в поддержку', openSupportForm: true },
          { label: 'Поддержка и заявки', module: 'support' },
        ],
      };
    }
    if (language === 'kk') {
      return {
        offeredSupport: true,
        text:
          'MEDRADAR жүйесінде қиындық туындағанына өкінемін. Сұрағыңызды қолдау тобына жібере аламын. Мұны жасауымды қалайсыз ба?',
        actions: [
          { label: 'Иә, қолдауға жіберу', openSupportForm: true },
          { label: 'Қолдау және өтінімдер', module: 'support' },
        ],
      };
    }
    return {
      offeredSupport: true,
      text:
        'I’m sorry you’re having trouble with MEDRADAR. I can send your question to our support team. Would you like me to do that?',
      actions: [
        { label: 'Yes, send to Support', openSupportForm: true },
        { label: 'Support & Tickets', module: 'support' },
      ],
    };
  }

  // 1. Preparation instructions for medical appointments & tests
  if (
    q.includes('подготов') ||
    q.includes('натощак') ||
    q.includes('экг') ||
    q.includes('анализ') ||
    q.includes('prep') ||
    q.includes('fast') ||
    q.includes('ecg') ||
    q.includes('дайын') ||
    q.includes('аш қарын') ||
    q.includes('талдау')
  ) {
    if (language === 'ru') {
      return {
        text:
          'Проверенные общие рекомендации по подготовке (подтвердите детали у врача или клиники):\n\n' +
          '• Глюкоза натощак и липидный профиль: не есть 8–12 часов до сдачи крови, пить только обычную воду.\n' +
          '• HbA1c (гликированный гемоглобин): специальное голодание не требуется.\n' +
          '• Измерение АД и ЭКГ: отдохните сидя 5–10 минут до процедуры, за 30 минут исключите кофеин и курение, возьмите список текущих лекарств.\n\n' +
          'Важно: NANO не ставит диагнозы и не заменяет врача.',
        actions: [
          { label: 'Открыть Rapid Lab', module: 'rapid_lab', patientId: activePatient.id },
          { label: 'Мои направления', module: 'passport_referrals', patientId: activePatient.id },
        ],
      };
    }
    if (language === 'kk') {
      return {
        text:
          'Тексерілген жалпы дайындық нұсқаулығы (нақты талаптарды емханадан растаңыз):\n\n' +
          '• Аш қарынға глюкоза және липидті бейін: талдау алдында 8–12 сағат тамақ ішпеңіз, тек таза су ішуге болады.\n' +
          '• HbA1c: арнайы аш жүру қажет емес.\n' +
          '• ҚҚ өлшеу және ЭКГ: 5–10 минут тыныш отырып демалыңыз, 30 минут бұрын кофе мен темекіден бас тартыңыз.\n\n' +
          'Маңызды: NANO диагноз қоймайды және дәрігерді алмастырмайды.',
        actions: [
          { label: 'Rapid Lab ашу', module: 'rapid_lab', patientId: activePatient.id },
          { label: 'Жолдамаларым', module: 'passport_referrals', patientId: activePatient.id },
        ],
      };
    }
    return {
      text:
        'Verified general appointment preparation (confirm specifics with your clinic):\n\n' +
        '• Fasting Glucose & Lipid Panel: fast for 8–12 hours beforehand; plain water is allowed.\n' +
        '• HbA1c test: fasting is not required.\n' +
        '• Blood Pressure & ECG: rest calmly for 5–10 minutes prior, avoid caffeine/smoking 30 minutes before, and bring your current medication list.\n\n' +
        'Note: NANO does not make medical diagnoses or replace a healthcare professional.',
      actions: [
        { label: 'Open Rapid Lab', module: 'rapid_lab', patientId: activePatient.id },
        { label: 'View Referrals', module: 'passport_referrals', patientId: activePatient.id },
      ],
    };
  }

  // 2. Reminders: inspect actual saved due reminders or open quick reminder creator
  if (
    q.includes('напомин') ||
    q.includes('созда') ||
    q.includes('remind') ||
    q.includes('task') ||
    q.includes('еске') ||
    q.includes('қос')
  ) {
    const dueList = (role === 'patient' ? activePatientDueReminders : scopedReminders.filter((r) => r.status === 'due')).slice(0, 4);
    const formatted = dueList
      .map((r) => {
        const p = patients.find((pt) => pt.id === r.patientId);
        const owner = role === 'doctor' && p ? `${p.fullName}: ` : '';
        return `• ${owner}${pickLocalized(r.title, language)} (${r.dueDate}${r.dueTime ? ` ${r.dueTime}` : ''})`;
      })
      .join('\n');

    if (language === 'ru') {
      return {
        text: dueList.length
          ? `Сохранённые активные напоминания (${dueList.length}):\n\n${formatted}\n\nВы можете создать новое напоминание прямо здесь или управлять всеми напоминаниями в разделе «Маршрут и контроль».`
          : `Для ${activePatient.fullName} сейчас нет активных невыполненных напоминаний. Можете создать новое напоминание прямо сейчас.`,
        actions: [
          { label: 'Создать напоминание сейчас', openReminderForm: true },
          { label: 'Все напоминания', module: 'care_loop', patientId: activePatient.id },
        ],
      };
    }
    if (language === 'kk') {
      return {
        text: dueList.length
          ? `Сақталған белсенді еске салғыштар (${dueList.length}):\n\n${formatted}\n\nЖаңа еске салғышты осында жасай аласыз.`
          : `${activePatient.fullName} үшін қазір белсенді еске салғыштар жоқ. Жаңасын дәл қазір қоса аласыз.`,
        actions: [
          { label: 'Еске салғыш қосу', openReminderForm: true },
          { label: 'Барлық еске салғыштар', module: 'care_loop', patientId: activePatient.id },
        ],
      };
    }
    return {
      text: dueList.length
        ? `Saved active reminders (${dueList.length}):\n\n${formatted}\n\nYou can create a new reminder right here or manage all reminders in Care Loop & Journey.`
        : `There are currently no due reminders saved for ${activePatient.fullName}. You can create one right now.`,
      actions: [
        { label: 'Create Reminder Now', openReminderForm: true },
        { label: 'Manage All Reminders', module: 'care_loop', patientId: activePatient.id },
      ],
    };
  }

  // 3. Upcoming saved appointments / referrals (strictly from saved data)
  if (
    q.includes('запис') ||
    q.includes('прием') ||
    q.includes('приём') ||
    q.includes('направлен') ||
    q.includes('визит') ||
    q.includes('appoint') ||
    q.includes('book') ||
    q.includes('refer') ||
    q.includes('жазыл') ||
    q.includes('қабылда') ||
    q.includes('жолдама')
  ) {
    const upcoming = (role === 'patient' ? activePatientReferrals : scopedReferrals)
      .filter((r) => r.status !== 'completed')
      .slice(0, 4);

    const listText = upcoming
      .map((r) => {
        const p = patients.find((pt) => pt.id === r.patientId);
        const owner = role === 'doctor' && p ? `${p.fullName} — ` : '';
        return `• ${owner}${r.specialty} · ${pickLocalized(r.hospitalName, language)} (${r.scheduledDate} ${r.timeSlot}) [${r.status}]`;
      })
      .join('\n');

    if (language === 'ru') {
      return {
        text: upcoming.length
          ? `Актуальные сохранённые записи:\n\n${listText}\n\nЧтобы записаться на новый приём или посмотреть объяснение маршрута, откройте «Паспорт и направления».`
          : `Для ${activePatient.fullName} сейчас нет предстоящих открытых записей. Вы можете оформить новую запись в разделе «Паспорт и направления».`,
        actions: [
          { label: 'Паспорт и направления', module: 'passport_referrals', patientId: activePatient.id },
          { label: 'Напомнить об этом приёме', openReminderForm: true },
        ],
      };
    }
    if (language === 'kk') {
      return {
        text: upcoming.length
          ? `Нақты сақталған жазылулар:\n\n${listText}\n\nЖаңа қабылдауға жазылу үшін «Төлқұжат және жолдама» бөлімін ашыңыз.`
          : `${activePatient.fullName} үшін алдағы ашық жазылулар жоқ. «Төлқұжат және жолдама» бөлімінде жазыла аласыз.`,
        actions: [
          { label: 'Төлқұжат және жолдама', module: 'passport_referrals', patientId: activePatient.id },
          { label: 'Еске салғыш қосу', openReminderForm: true },
        ],
      };
    }
    return {
      text: upcoming.length
        ? `Actual saved upcoming appointments:\n\n${listText}\n\nOpen Passport & Referrals to book a new slot or view route explanations.`
        : `No upcoming open appointments are currently saved for ${activePatient.fullName}. You can book one in Passport & Referrals.`,
      actions: [
        { label: 'Open Passport & Referrals', module: 'passport_referrals', patientId: activePatient.id },
        { label: 'Set Appointment Reminder', openReminderForm: true },
      ],
    };
  }

  // 4. How to use MEDRADAR / navigation / features / offline / accessibility
  if (
    q.includes('как ') ||
    q.includes('где ') ||
    q.includes('помог') ||
    q.includes('функц') ||
    q.includes('навига') ||
    q.includes('how ') ||
    q.includes('where') ||
    q.includes('help') ||
    q.includes('feature') ||
    q.includes('қалай') ||
    q.includes('қайда') ||
    q.includes('көмек')
  ) {
    if (language === 'ru') {
      return {
        text:
          'Навигатор MEDRADAR:\n' +
          '1. Запись к врачу и паспорт — «Паспорт и направления».\n' +
          '2. Анализы и тесты — «Rapid Lab».\n' +
          '3. Поиск клиник, сёл и объяснение маршрутов — «Карта региона» и «График MedMobile».\n' +
          '4. 8-этапный маршрут лечения и напоминания — «Маршрут и контроль».\n' +
          '5. Шрифт, высокая контрастность и офлайн-режим — «Настройки» в верхней панели.',
        actions: [
          { label: 'Карта региона', module: 'map' },
          { label: 'Паспорт и направления', module: 'passport_referrals' },
          { label: 'Маршрут и контроль', module: 'care_loop' },
        ],
      };
    }
    if (language === 'kk') {
      return {
        text:
          'MEDRADAR нұсқаулығы:\n' +
          '1. Дәрігерге жазылу және төлқұжат — «Төлқұжат және жолдама».\n' +
          '2. Экспресс-талдаулар — «Rapid Lab».\n' +
          '3. Клиникалар, ауылдар және бағыт түсіндірмесі — «Өңірлік карта» және «MedMobile кестесі».\n' +
          '4. 8 кезеңді маршрут және еске салғыштар — «Бағыт және бақылау».\n' +
          '5. Мәтін өлшемі, жоғары контраст және офлайн режим — жоғарғы панельдегі «Баптаулар».',
        actions: [
          { label: 'Өңірлік карта', module: 'map' },
          { label: 'Төлқұжат және жолдама', module: 'passport_referrals' },
          { label: 'Бағыт және бақылау', module: 'care_loop' },
        ],
      };
    }
    return {
      text:
        'MEDRADAR Quick Navigation:\n' +
        '1. Book appointments & Digital Passport — Passport & Referrals.\n' +
        '2. Lab tests & vitals — Rapid Lab.\n' +
        '3. Find doctors, 80 villages & route explanations — Regional Map & MedMobile Schedule.\n' +
        '4. 8-stage Patient Timeline & Smart Reminders — Care Loop & Journey.\n' +
        '5. Text size, high contrast & offline demo mode — Accessibility button in the top bar.',
      actions: [
        { label: 'Regional Map', module: 'map' },
        { label: 'Passport & Referrals', module: 'passport_referrals' },
        { label: 'Care Loop & Journey', module: 'care_loop' },
      ],
    };
  }

  // 5. Map / villages / doctors / MedMobile
  if (
    q.includes('карт') ||
    q.includes('сел') ||
    q.includes('врач') ||
    q.includes('клиник') ||
    q.includes('медмобил') ||
    q.includes('map') ||
    q.includes('village') ||
    q.includes('doctor') ||
    q.includes('medmobile') ||
    q.includes('карта') ||
    q.includes('ауыл') ||
    q.includes('дәрігер')
  ) {
    const activeCluster = clusters.find((c) => c.id === activePatient.clusterId) ?? clusters[0];
    const nextStops = medMobileSchedule.filter((s) => s.status !== 'completed').slice(0, 2);
    const stopsText = nextStops
      .map((s) => {
        const v = villages.find((vil) => vil.id === s.villageId);
        return `• ${s.unitId} -> ${v?.name ?? s.villageId} (${s.dayOfWeek} ${s.timeWindow})`;
      })
      .join('\n');

    if (language === 'ru') {
      return {
        text: `Ваш кластерный центр: ${pickLocalized(activeCluster.hubHospital, 'ru')} (${activeCluster.leadPhysician}). Доступные профили: ${activeCluster.specialists.join(', ')}.\n\nБлижайшие выезды MedMobile:\n${stopsText}`,
        actions: [
          { label: 'Карта и объяснение маршрута', module: 'map', villageId: activePatient.villageId },
          { label: 'График MedMobile', module: 'medmobile' },
        ],
      };
    }
    if (language === 'kk') {
      return {
        text: `Кластерлік орталық: ${pickLocalized(activeCluster.hubHospital, 'kk')} (${activeCluster.leadPhysician}). Қолжетімді мамандар: ${activeCluster.specialists.join(', ')}.\n\nЖақын MedMobile сапарлары:\n${stopsText}`,
        actions: [
          { label: 'Карта және бағыт', module: 'map', villageId: activePatient.villageId },
          { label: 'MedMobile кестесі', module: 'medmobile' },
        ],
      };
    }
    return {
      text: `Your assigned cluster hub: ${pickLocalized(activeCluster.hubHospital, 'en')} (${activeCluster.leadPhysician}). Specialists: ${activeCluster.specialists.join(', ')}.\n\nUpcoming MedMobile stops:\n${stopsText}`,
      actions: [
        { label: 'Map & Route Reason', module: 'map', villageId: activePatient.villageId },
        { label: 'MedMobile Schedule', module: 'medmobile' },
      ],
    };
  }

  // 6. Doctor-only triage summary (strictly blocked from leaking other patients in Patient View)
  if (
    role === 'doctor' &&
    (q.includes('риск') || q.includes('триаж') || q.includes('risk') || q.includes('қауіп'))
  ) {
    const ranked = patients
      .map((p) => {
        const v = villages.find((vil) => vil.id === p.villageId);
        return { p, v, r: evaluatePatientRadar(p, v?.distanceToHubKm ?? 35) };
      })
      .sort((a, b) => b.r.totalScore - a.r.totalScore)
      .slice(0, 3);
    const summary = ranked
      .map((item, i) => `${i + 1}. ${item.p.fullName} — ${item.r.totalScore}/100 (${item.r.recommendedSpecialty})`)
      .join('\n');

    return {
      text:
        language === 'ru'
          ? `Топ приоритета по симуляции AI Health Radar (не диагноз):\n\n${summary}`
          : language === 'kk'
            ? `AI Health Radar симуляциясы бойынша басым кезек (диагноз емес):\n\n${summary}`
            : `Top priority queue from AI Health Radar simulation (non-diagnostic):\n\n${summary}`,
      actions: [{ label: 'AI Health Radar', module: 'ai_radar', patientId: ranked[0]?.p.id }],
    };
  }

  // Default friendly NANO summary scoped cleanly to active role & saved data
  if (language === 'ru') {
    return {
      text: `Я NANO, ваш помощник в MEDRADAR. Сейчас выбран профиль: ${activePatient.fullName}.\n\nАктивных напоминаний: ${activePatientDueReminders.length}, открытых записей: ${activePatientReferrals.filter((r) => r.status !== 'completed').length}.\n\nСпросите меня про ближайшие записи, подготовку к анализам, напоминания или навигацию по сайту.`,
      actions: [
        { label: 'Мои записи', module: 'passport_referrals', patientId: activePatient.id },
        { label: '+ Создать напоминание', openReminderForm: true },
      ],
    };
  }

  if (language === 'kk') {
    return {
      text: `Мен NANO, MEDRADAR көмекшісімін. Белсенді бейін: ${activePatient.fullName}.\n\nБелсенді еске салғыштар: ${activePatientDueReminders.length}, ашық жазылулар: ${activePatientReferrals.filter((r) => r.status !== 'completed').length}.\n\nЖазылулар, талдауға дайындық немесе еске салғыштар туралы сұраңыз.`,
      actions: [
        { label: 'Жолдамаларым', module: 'passport_referrals', patientId: activePatient.id },
        { label: '+ Еске салғыш қосу', openReminderForm: true },
      ],
    };
  }

  return {
    text: `Hi! I am NANO, your MEDRADAR guide. Active profile: ${activePatient.fullName}.\n\nDue reminders: ${activePatientDueReminders.length} · Open appointments: ${activePatientReferrals.filter((r) => r.status !== 'completed').length}.\n\nAsk me about your saved appointments, exam prep instructions, reminders, or navigating MEDRADAR.`,
    actions: [
      { label: 'Saved Appointments', module: 'passport_referrals', patientId: activePatient.id },
      { label: '+ Create Reminder', openReminderForm: true },
    ],
  };
}
