import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_MEDMOBILE_SCHEDULE,
  INITIAL_NOTIFICATIONS,
  INITIAL_PATIENTS,
  INITIAL_RAPID_LABS,
  INITIAL_REFERRALS,
  INITIAL_REMINDERS,
  INITIAL_VILLAGES,
  MEDICAL_CLUSTERS,
  normalizeJourneyTo8Stages,
} from '../data/mockData';
import { TRANSLATIONS } from '../i18n/translations';
import {
  AccessibilitySettings,
  AppNotification,
  DemoPatient,
  JourneyStepStatus,
  Language,
  LocalizedText,
  MedicalCluster,
  MedMobileStop,
  ModuleId,
  PatientSymptoms,
  PatientVitals,
  PendingSyncItem,
  PreventiveReminder,
  RapidLabRecord,
  ReminderCategory,
  SmartReferral,
  UserRole,
  Village,
} from '../types/medradar';
import { analyzeRapidLabVitals, evaluatePatientRadar } from '../utils/aiRadarEngine';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'medradar_demo_state_v2';
const LEGACY_STORAGE_KEY = 'medradar_demo_state_v1';

interface PersistedState {
  language: Language;
  activePatientId: string;
  villages: Village[];
  patients: DemoPatient[];
  rapidLabs: RapidLabRecord[];
  medMobileSchedule: MedMobileStop[];
  referrals: SmartReferral[];
  reminders: PreventiveReminder[];
  notifications: AppNotification[];
  accessibility: AccessibilitySettings;
  pendingSync: PendingSyncItem[];
  lastSyncedAt: string;
}

const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  textSize: 'normal',
  highContrast: false,
  browserNotificationsEnabled: false,
  offlineDemoMode: false,
};

function stripDemoSuffix(text: string): string {
  return text
    .replace(/\s*\((?:ДЕМО|DEMO|ДЕМО-ДАННЫЕ|DEMO DATA|ДЕМО ДЕРЕКТЕР)\)/gi, '')
    .trim();
}

function mapLegacyCategory(cat: string): ReminderCategory {
  if (cat === 'appointment' || cat === 'examination' || cat === 'lab_result' || cat === 'follow_up' || cat === 'personal_task') {
    return cat;
  }
  if (cat === 'screening') return 'examination';
  if (cat === 'tele_followup') return 'follow_up';
  if (cat === 'vaccination' || cat === 'medication') return 'personal_task';
  return 'personal_task';
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.villages?.length === 80 && parsed.patients?.length) {
        const normalizedPatients: DemoPatient[] = parsed.patients.map((p, idx) => {
          const norm = normalizeJourneyTo8Stages(p.journeyHistory ?? [], p.journeyStage ?? 0);
          return {
            ...p,
            phone: p.phone ?? `+7 701 555 ${String(101 + idx).padStart(4, '0')}`,
            journeyStage: norm.journeyStage,
            journeyHistory: norm.journeyHistory,
          };
        });

        const normalizedReminders: PreventiveReminder[] = (parsed.reminders ?? INITIAL_REMINDERS).map(
          (r) => ({
            ...r,
            category: mapLegacyCategory(r.category as unknown as string),
          })
        );

        const sanitizedNotifications: AppNotification[] = (
          parsed.notifications ?? INITIAL_NOTIFICATIONS
        ).map((n) => ({
          ...n,
          title: {
            en: stripDemoSuffix(n.title.en),
            ru: stripDemoSuffix(n.title.ru),
            kk: stripDemoSuffix(n.title.kk),
          },
          message: {
            en: stripDemoSuffix(n.message.en),
            ru: stripDemoSuffix(n.message.ru),
            kk: stripDemoSuffix(n.message.kk),
          },
        }));

        return {
          language: parsed.language ?? 'ru',
          activePatientId: parsed.activePatientId ?? INITIAL_PATIENTS[0].id,
          villages: parsed.villages,
          patients: normalizedPatients,
          rapidLabs: parsed.rapidLabs ?? INITIAL_RAPID_LABS,
          medMobileSchedule: parsed.medMobileSchedule ?? INITIAL_MEDMOBILE_SCHEDULE,
          referrals: parsed.referrals ?? INITIAL_REFERRALS,
          reminders: normalizedReminders,
          notifications: sanitizedNotifications,
          accessibility: { ...DEFAULT_ACCESSIBILITY, ...(parsed.accessibility ?? {}) },
          pendingSync: parsed.pendingSync ?? [],
          lastSyncedAt: parsed.lastSyncedAt ?? '2026-11-19 09:00',
        };
      }
    }
  } catch {
    // Fallback to clean seed if localStorage is unavailable or malformed
  }

  return {
    language: 'ru',
    activePatientId: INITIAL_PATIENTS[0].id,
    villages: INITIAL_VILLAGES,
    patients: INITIAL_PATIENTS,
    rapidLabs: INITIAL_RAPID_LABS,
    medMobileSchedule: INITIAL_MEDMOBILE_SCHEDULE,
    referrals: INITIAL_REFERRALS,
    reminders: INITIAL_REMINDERS,
    notifications: INITIAL_NOTIFICATIONS,
    accessibility: DEFAULT_ACCESSIBILITY,
    pendingSync: [],
    lastSyncedAt: '2026-11-19 09:00',
  };
}

interface MedradarContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  role: UserRole;
  activeModule: ModuleId;
  setActiveModule: (mod: ModuleId) => void;
  activePatientId: string;
  setActivePatientId: (id: string) => void;
  selectedVillageId: string | null;
  setSelectedVillageId: (id: string | null) => void;

  clusters: MedicalCluster[];
  villages: Village[];
  patients: DemoPatient[];
  rapidLabs: RapidLabRecord[];
  medMobileSchedule: MedMobileStop[];
  referrals: SmartReferral[];
  reminders: PreventiveReminder[];

  notifications: AppNotification[];
  unreadNotificationCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  enableBrowserNotifications: () => Promise<'granted' | 'denied' | 'unsupported'>;
  disableBrowserNotifications: () => void;

  accessibility: AccessibilitySettings;
  updateAccessibility: (patch: Partial<AccessibilitySettings>) => void;

  isBrowserOnline: boolean;
  isOfflineActive: boolean;
  pendingSync: PendingSyncItem[];
  lastSyncedAt: string;
  syncNow: () => void;

  highlightedTourTarget: string | null;
  setHighlightedTourTarget: (target: string | null) => void;

  getCluster: (id: string) => MedicalCluster | undefined;
  getVillage: (id: string) => Village | undefined;
  getPatient: (id: string) => DemoPatient | undefined;

  recordRapidLab: (patientId: string, vitals: PatientVitals, performedBy?: string) => RapidLabRecord;
  updatePatientClinicalState: (
    patientId: string,
    vitals: PatientVitals,
    symptoms: PatientSymptoms
  ) => void;
  advancePatientJourney: (patientId: string, noteText?: string) => void;
  setJourneyStepStatus: (patientId: string, stage: number, status: JourneyStepStatus) => void;

  addMedMobileStop: (stop: Omit<MedMobileStop, 'id'>) => void;
  cycleMedMobileStatus: (stopId: string) => void;
  bookMedMobileSlot: (stopId: string) => void;

  createSmartReferral: (input: {
    patientId: string;
    specialty: string;
    scheduledDate: string;
    timeSlot: string;
    patientPhone?: string;
    doctorNotes: string;
  }) => SmartReferral;
  updateReferralStatus: (referralId: string, status: SmartReferral['status']) => void;
  closeCareLoop: (referralId: string, doctorNotes: string) => void;

  toggleReminderStatus: (reminderId: string, status: PreventiveReminder['status']) => void;
  rescheduleReminder: (reminderId: string, dueDate: string, dueTime?: string) => void;
  deleteReminder: (reminderId: string) => void;
  addPreventiveReminder: (input: {
    patientId: string;
    title: string;
    category: PreventiveReminder['category'];
    dueDate: string;
    dueTime?: string;
    linkedReferralId?: string;
    priority: PreventiveReminder['priority'];
  }) => PreventiveReminder;

  resetDemoData: () => void;
}

const MedradarContext = createContext<MedradarContextValue | null>(null);

function nowStamp(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

export function MedradarProvider({ children }: { children: React.ReactNode }) {
  const { effectiveRole } = useAuth();
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>('V-03');
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [highlightedTourTarget, setHighlightedTourTarget] = useState<string | null>(null);

  const isOfflineActive = !isBrowserOnline || state.accessibility.offlineDemoMode;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }, [state]);

  // Apply Accessibility Preferences globally to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = state.accessibility.textSize;
    if (state.accessibility.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
  }, [state.accessibility.textSize, state.accessibility.highContrast]);

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const pushNotification = useCallback(
    (input: {
      dedupKey: string;
      patientId?: string;
      title: LocalizedText;
      message: LocalizedText;
      category: AppNotification['category'];
      module?: ModuleId;
    }) => {
      setState((prev) => {
        if (prev.notifications.some((n) => n.dedupKey === input.dedupKey)) {
          return prev;
        }
        const notif: AppNotification = {
          id: `NOTIF-${Math.floor(100 + Math.random() * 899)}`,
          dedupKey: input.dedupKey,
          patientId: input.patientId,
          title: input.title,
          message: input.message,
          category: input.category,
          module: input.module,
          createdAt: nowStamp(),
          read: false,
        };

        // Fire Browser Notification ONLY if explicitly enabled and permission granted
        if (
          prev.accessibility.browserNotificationsEnabled &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification(input.title[prev.language] || input.title.en, {
              body: input.message[prev.language] || input.message.en,
              tag: input.dedupKey,
            });
          } catch {
            // Ignore browser notification errors in restricted frames
          }
        }

        return {
          ...prev,
          notifications: [notif, ...prev.notifications].slice(0, 30),
        };
      });
    },
    []
  );

  const syncNow = useCallback(() => {
    setState((prev) => {
      if (prev.pendingSync.length === 0) {
        return { ...prev, lastSyncedAt: nowStamp() };
      }
      const syncedCount = prev.pendingSync.length;
      const stamp = nowStamp();
      const dedupKey = `sync-${stamp.slice(0, 15)}-${syncedCount}`;
      const hasNotif = prev.notifications.some((n) => n.dedupKey === dedupKey);
      const syncNotif: AppNotification = {
        id: `NOTIF-${Math.floor(100 + Math.random() * 899)}`,
        dedupKey,
        title: {
          en: 'Offline Demo Queue Synchronized',
          ru: 'Офлайн-очередь синхронизирована',
          kk: 'Офлайн кезек синхрондалды',
        },
        message: {
          en: `${syncedCount} offline demo update(s) reconciled with local MEDRADAR storage.`,
          ru: `${syncedCount} офлайн-изменений синхронизированы в локальном хранилище MEDRADAR.`,
          kk: `${syncedCount} офлайн өзгеріс MEDRADAR жергілікті жадына синхрондалды.`,
        },
        category: 'system',
        createdAt: stamp,
        read: false,
      };
      return {
        ...prev,
        pendingSync: [],
        lastSyncedAt: stamp,
        notifications: hasNotif ? prev.notifications : [syncNotif, ...prev.notifications].slice(0, 30),
      };
    });
  }, []);

  // Automatically synchronize queued offline actions when connection returns
  useEffect(() => {
    if (!isOfflineActive && state.pendingSync.length > 0) {
      syncNow();
    }
  }, [isOfflineActive, state.pendingSync.length, syncNow]);

  const t = useCallback(
    (key: string): string => {
      return TRANSLATIONS[state.language][key] ?? TRANSLATIONS.en[key] ?? key;
    },
    [state.language]
  );

  const getCluster = (id: string) => MEDICAL_CLUSTERS.find((c) => c.id === id);
  const getVillage = (id: string) => state.villages.find((v) => v.id === id);
  const getPatient = (id: string) => state.patients.find((p) => p.id === id);

  const setLanguage = (language: Language) => setState((prev) => ({ ...prev, language }));
  const setActivePatientId = (activePatientId: string) =>
    setState((prev) => ({ ...prev, activePatientId }));

  const updateAccessibility = (patch: Partial<AccessibilitySettings>) => {
    setState((prev) => ({
      ...prev,
      accessibility: { ...prev.accessibility, ...patch },
    }));
  };

  const enqueueIfOffline = (actionLabel: string, prev: PersistedState): PendingSyncItem[] => {
    if (!isOfflineActive) return prev.pendingSync;
    return [
      ...prev.pendingSync,
      { id: `SYNC-${Date.now()}`, action: actionLabel, createdAt: nowStamp() },
    ];
  };

  const recordRapidLab = (
    patientId: string,
    vitals: PatientVitals,
    performedBy = 'Rapid Lab Demo Console'
  ): RapidLabRecord => {
    const patient = state.patients.find((p) => p.id === patientId) ?? state.patients[0];
    const analysis = analyzeRapidLabVitals(vitals);
    const now = nowStamp();
    const record: RapidLabRecord = {
      id: `RL-${Math.floor(1000 + Math.random() * 8999)}`,
      patientId: patient.id,
      villageId: patient.villageId,
      timestamp: now,
      vitals,
      abnormalFlags: analysis.abnormalFlags,
      summaryKey: analysis.summaryKey,
      performedBy,
    };

    const village = state.villages.find((v) => v.id === patient.villageId);
    const nextStage = Math.max(patient.journeyStage, 4);
    const updatedPatient: DemoPatient = {
      ...patient,
      vitals,
      lastLabDate: now.slice(0, 10),
      journeyStage: nextStage,
      journeyHistory: patient.journeyHistory.map((step) => {
        if (step.stage <= 4) {
          return {
            ...step,
            completed: true,
            status: 'completed' as JourneyStepStatus,
            date: step.stage === 4 || step.date === '—' ? now.slice(0, 10) : step.date,
          };
        }
        if (step.stage === 5 && step.status === 'upcoming') {
          return { ...step, status: 'in_progress' as JourneyStepStatus };
        }
        return step;
      }),
    };

    const radar = evaluatePatientRadar(updatedPatient, village?.distanceToHubKm ?? 35);

    setState((prev) => ({
      ...prev,
      rapidLabs: [record, ...prev.rapidLabs],
      patients: prev.patients.map((p) => (p.id === patient.id ? updatedPatient : p)),
      villages: prev.villages.map((v) =>
        v.id === patient.villageId
          ? {
              ...v,
              screenedLast30d: v.screenedLast30d + 1,
              riskIndex: Math.round((v.riskIndex * 3 + radar.totalScore) / 4),
            }
          : v
      ),
      pendingSync: enqueueIfOffline(`Rapid Lab ${record.id}`, prev),
    }));

    pushNotification({
      dedupKey: `lab-${record.id}`,
      patientId: patient.id,
      title: {
        en: 'Rapid Lab Results Recorded',
        ru: 'Результаты Rapid Lab сохранены',
        kk: 'Rapid Lab нәтижелері сақталды',
      },
      message: {
        en: `${patient.fullName} · Flags: ${analysis.abnormalFlags.length}`,
        ru: `${patient.fullName} · Отклонений: ${analysis.abnormalFlags.length}`,
        kk: `${patient.fullName} · Ауытқулар: ${analysis.abnormalFlags.length}`,
      },
      category: 'lab',
      module: 'rapid_lab',
    });

    return record;
  };

  const updatePatientClinicalState = (
    patientId: string,
    vitals: PatientVitals,
    symptoms: PatientSymptoms
  ) => {
    setState((prev) => ({
      ...prev,
      patients: prev.patients.map((p) =>
        p.id === patientId
          ? {
              ...p,
              vitals,
              symptoms,
              journeyStage: Math.max(p.journeyStage, 2),
              journeyHistory: p.journeyHistory.map((step) =>
                step.stage <= 2
                  ? {
                      ...step,
                      completed: true,
                      status: 'completed',
                      date: step.date === '—' ? new Date().toISOString().slice(0, 10) : step.date,
                    }
                  : step
              ),
            }
          : p
      ),
      pendingSync: enqueueIfOffline(`Radar Update ${patientId}`, prev),
    }));
  };

  const advancePatientJourney = (patientId: string, noteText?: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setState((prev) => ({
      ...prev,
      patients: prev.patients.map((p) => {
        if (p.id !== patientId) return p;
        const nextStage = Math.min(7, p.journeyStage + 1);
        return {
          ...p,
          journeyStage: nextStage,
          journeyHistory: p.journeyHistory.map((step) => {
            if (step.stage < nextStage || (nextStage === 7 && step.stage === 7)) {
              return {
                ...step,
                completed: true,
                status: 'completed',
                date: step.date === '—' ? today : step.date,
                note:
                  step.stage === nextStage && noteText
                    ? { en: noteText, ru: noteText, kk: noteText }
                    : step.note,
              };
            }
            if (step.stage === nextStage) {
              return {
                ...step,
                completed: false,
                status: 'in_progress',
                date: step.date === '—' ? today : step.date,
                note: noteText ? { en: noteText, ru: noteText, kk: noteText } : step.note,
              };
            }
            if (step.stage === nextStage + 1) {
              return { ...step, completed: false, status: 'waiting' };
            }
            return { ...step, completed: false, status: 'upcoming' };
          }),
        };
      }),
      pendingSync: enqueueIfOffline(`Journey Advance ${patientId}`, prev),
    }));
  };

  const setJourneyStepStatus = (patientId: string, stage: number, status: JourneyStepStatus) => {
    const today = new Date().toISOString().slice(0, 10);
    setState((prev) => ({
      ...prev,
      patients: prev.patients.map((p) => {
        if (p.id !== patientId) return p;
        return {
          ...p,
          journeyStage: status === 'in_progress' ? stage : p.journeyStage,
          journeyHistory: p.journeyHistory.map((step) =>
            step.stage === stage
              ? {
                  ...step,
                  status,
                  completed: status === 'completed',
                  date: step.date === '—' && status !== 'upcoming' ? today : step.date,
                }
              : step
          ),
        };
      }),
      pendingSync: enqueueIfOffline(`Journey Status ${patientId} #${stage}`, prev),
    }));
  };

  const addMedMobileStop = (stop: Omit<MedMobileStop, 'id'>) => {
    const newStop: MedMobileStop = {
      ...stop,
      id: `SCH-${Math.floor(100 + Math.random() * 899)}`,
    };
    setState((prev) => ({
      ...prev,
      medMobileSchedule: [newStop, ...prev.medMobileSchedule],
      pendingSync: enqueueIfOffline(`MedMobile Stop ${newStop.id}`, prev),
    }));
  };

  const cycleMedMobileStatus = (stopId: string) => {
    const order: MedMobileStop['status'][] = ['scheduled', 'en_route', 'completed', 'delayed'];
    setState((prev) => ({
      ...prev,
      medMobileSchedule: prev.medMobileSchedule.map((s) => {
        if (s.id !== stopId) return s;
        const nextIdx = (order.indexOf(s.status) + 1) % order.length;
        return { ...s, status: order[nextIdx] };
      }),
    }));
  };

  const bookMedMobileSlot = (stopId: string) => {
    setState((prev) => ({
      ...prev,
      medMobileSchedule: prev.medMobileSchedule.map((s) =>
        s.id === stopId && s.bookedSlots < s.maxSlots
          ? { ...s, bookedSlots: s.bookedSlots + 1 }
          : s
      ),
    }));
  };

  const createSmartReferral = (input: {
    patientId: string;
    specialty: string;
    scheduledDate: string;
    timeSlot: string;
    patientPhone?: string;
    doctorNotes: string;
  }): SmartReferral => {
    const patient = state.patients.find((p) => p.id === input.patientId) ?? state.patients[0];
    const cluster = getCluster(patient.clusterId) ?? MEDICAL_CLUSTERS[0];
    const village = getVillage(patient.villageId);
    const radar = evaluatePatientRadar(patient, village?.distanceToHubKm ?? 35);

    const referral: SmartReferral = {
      id: `REF-${Math.floor(600 + Math.random() * 399)}`,
      patientId: patient.id,
      clusterId: cluster.id,
      hospitalName: cluster.hubHospital,
      specialty: input.specialty,
      scheduledDate: input.scheduledDate,
      timeSlot: input.timeSlot,
      urgency: radar.riskTier,
      distanceKm: village?.distanceToHubKm ?? 38,
      status: 'confirmed',
      loopClosed: false,
      patientPhone: input.patientPhone ?? patient.phone,
      doctorNotes: input.doctorNotes,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setState((prev) => ({
      ...prev,
      referrals: [referral, ...prev.referrals],
      patients: prev.patients.map((p) =>
        p.id === patient.id
          ? {
              ...p,
              phone: input.patientPhone ?? p.phone,
              journeyStage: Math.max(p.journeyStage, 3),
              journeyHistory: p.journeyHistory.map((step) => {
                if (step.stage <= 3) {
                  return {
                    ...step,
                    completed: true,
                    status: 'completed',
                    date: step.date === '—' ? input.scheduledDate : step.date,
                  };
                }
                if (step.stage === 4 && step.status === 'upcoming') {
                  return { ...step, status: 'waiting' };
                }
                return step;
              }),
            }
          : p
      ),
      pendingSync: enqueueIfOffline(`Referral ${referral.id}`, prev),
    }));

    pushNotification({
      dedupKey: `ref-${referral.id}`,
      patientId: patient.id,
      title: {
        en: 'Appointment Confirmed',
        ru: 'Запись на приём подтверждена',
        kk: 'Қабылдауға жазылу расталды',
      },
      message: {
        en: `${patient.fullName} · ${referral.specialty} on ${referral.scheduledDate} at ${referral.timeSlot}`,
        ru: `${patient.fullName} · ${referral.specialty} · ${referral.scheduledDate} в ${referral.timeSlot}`,
        kk: `${patient.fullName} · ${referral.specialty} · ${referral.scheduledDate}, ${referral.timeSlot}`,
      },
      category: 'appointment',
      module: 'passport_referrals',
    });

    return referral;
  };

  const updateReferralStatus = (referralId: string, status: SmartReferral['status']) => {
    setState((prev) => {
      const target = prev.referrals.find((r) => r.id === referralId);
      return {
        ...prev,
        referrals: prev.referrals.map((r) => (r.id === referralId ? { ...r, status } : r)),
        patients:
          target && status === 'completed'
            ? prev.patients.map((p) =>
                p.id === target.patientId
                  ? {
                      ...p,
                      journeyStage: Math.max(p.journeyStage, 5),
                      journeyHistory: p.journeyHistory.map((step) =>
                        step.stage <= 5
                          ? {
                              ...step,
                              completed: true,
                              status: 'completed',
                              date:
                                step.date === '—'
                                  ? new Date().toISOString().slice(0, 10)
                                  : step.date,
                            }
                          : step.stage === 6
                            ? { ...step, status: 'waiting' }
                            : step
                      ),
                    }
                  : p
              )
            : prev.patients,
        pendingSync: enqueueIfOffline(`Referral Status ${referralId}`, prev),
      };
    });
  };

  const closeCareLoop = (referralId: string, doctorNotes: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setState((prev) => {
      const target = prev.referrals.find((r) => r.id === referralId);
      return {
        ...prev,
        referrals: prev.referrals.map((r) =>
          r.id === referralId
            ? {
                ...r,
                status: 'completed',
                loopClosed: true,
                doctorNotes: doctorNotes || r.doctorNotes,
              }
            : r
        ),
        patients: target
          ? prev.patients.map((p) =>
              p.id === target.patientId
                ? {
                    ...p,
                    journeyStage: 7,
                    journeyHistory: p.journeyHistory.map((step) => ({
                      ...step,
                      completed: true,
                      status: 'completed',
                      date: step.date === '—' ? today : step.date,
                    })),
                  }
                : p
            )
          : prev.patients,
        pendingSync: enqueueIfOffline(`Close Loop ${referralId}`, prev),
      };
    });
  };

  const toggleReminderStatus = (reminderId: string, status: PreventiveReminder['status']) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((rem) => (rem.id === reminderId ? { ...rem, status } : rem)),
      pendingSync: enqueueIfOffline(`Reminder Status ${reminderId}`, prev),
    }));
  };

  const rescheduleReminder = (reminderId: string, dueDate: string, dueTime?: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((rem) =>
        rem.id === reminderId
          ? { ...rem, dueDate, dueTime: dueTime ?? rem.dueTime, status: 'due' }
          : rem
      ),
      pendingSync: enqueueIfOffline(`Reminder Reschedule ${reminderId}`, prev),
    }));
  };

  const deleteReminder = (reminderId: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((rem) => rem.id !== reminderId),
      pendingSync: enqueueIfOffline(`Reminder Delete ${reminderId}`, prev),
    }));
  };

  const addPreventiveReminder = (input: {
    patientId: string;
    title: string;
    category: PreventiveReminder['category'];
    dueDate: string;
    dueTime?: string;
    linkedReferralId?: string;
    priority: PreventiveReminder['priority'];
  }): PreventiveReminder => {
    const reminder: PreventiveReminder = {
      id: `REM-${Math.floor(300 + Math.random() * 699)}`,
      patientId: input.patientId,
      title: { en: input.title, ru: input.title, kk: input.title },
      category: input.category,
      dueDate: input.dueDate,
      dueTime: input.dueTime || undefined,
      linkedReferralId: input.linkedReferralId,
      status: 'due',
      priority: input.priority,
    };
    setState((prev) => ({
      ...prev,
      reminders: [reminder, ...prev.reminders],
      pendingSync: enqueueIfOffline(`Reminder Added ${reminder.id}`, prev),
    }));

    const patient = state.patients.find((p) => p.id === input.patientId);
    pushNotification({
      dedupKey: `rem-created-${reminder.id}`,
      patientId: input.patientId,
      title: {
        en: 'Smart Reminder Scheduled',
        ru: 'Напоминание создано',
        kk: 'Еске салғыш жасалды',
      },
      message: {
        en: `${patient?.fullName ?? input.patientId} · ${input.title} (${input.dueDate}${input.dueTime ? ` ${input.dueTime}` : ''})`,
        ru: `${patient?.fullName ?? input.patientId} · ${input.title} (${input.dueDate}${input.dueTime ? ` ${input.dueTime}` : ''})`,
        kk: `${patient?.fullName ?? input.patientId} · ${input.title} (${input.dueDate}${input.dueTime ? ` ${input.dueTime}` : ''})`,
      },
      category: 'reminder',
      module: 'care_loop',
    });

    return reminder;
  };

  // Patient privacy filter: in Patient View, only expose notifications belonging to the active patient or general system alerts
  const visibleNotifications = useMemo(() => {
    if (effectiveRole === 'doctor') return state.notifications;
    return state.notifications.filter(
      (n) => !n.patientId || n.patientId === state.activePatientId
    );
  }, [state.notifications, effectiveRole, state.activePatientId]);

  const unreadNotificationCount = useMemo(
    () => visibleNotifications.filter((n) => !n.read).length,
    [visibleNotifications]
  );

  const markNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  };

  const markAllNotificationsRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  };

  const enableBrowserNotifications = async (): Promise<'granted' | 'denied' | 'unsupported'> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        updateAccessibility({ browserNotificationsEnabled: true });
        return 'granted';
      }
      updateAccessibility({ browserNotificationsEnabled: false });
      return 'denied';
    } catch {
      return 'denied';
    }
  };

  const disableBrowserNotifications = () => {
    updateAccessibility({ browserNotificationsEnabled: false });
  };

  const resetDemoData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setState({
      language: state.language,
      activePatientId: INITIAL_PATIENTS[0].id,
      villages: INITIAL_VILLAGES,
      patients: INITIAL_PATIENTS,
      rapidLabs: INITIAL_RAPID_LABS,
      medMobileSchedule: INITIAL_MEDMOBILE_SCHEDULE,
      referrals: INITIAL_REFERRALS,
      reminders: INITIAL_REMINDERS,
      notifications: INITIAL_NOTIFICATIONS,
      accessibility: state.accessibility,
      pendingSync: [],
      lastSyncedAt: nowStamp(),
    });
  };

  return (
    <MedradarContext.Provider
      value={{
        language: state.language,
        setLanguage,
        t,
        role: effectiveRole,
        activeModule,
        setActiveModule,
        activePatientId: state.activePatientId,
        setActivePatientId,
        selectedVillageId,
        setSelectedVillageId,
        clusters: MEDICAL_CLUSTERS,
        villages: state.villages,
        patients: state.patients,
        rapidLabs: state.rapidLabs,
        medMobileSchedule: state.medMobileSchedule,
        referrals: state.referrals,
        reminders: state.reminders,
        notifications: visibleNotifications,
        unreadNotificationCount,
        markNotificationRead,
        markAllNotificationsRead,
        enableBrowserNotifications,
        disableBrowserNotifications,
        accessibility: state.accessibility,
        updateAccessibility,
        isBrowserOnline,
        isOfflineActive,
        pendingSync: state.pendingSync,
        lastSyncedAt: state.lastSyncedAt,
        syncNow,
        highlightedTourTarget,
        setHighlightedTourTarget,
        getCluster,
        getVillage,
        getPatient,
        recordRapidLab,
        updatePatientClinicalState,
        advancePatientJourney,
        setJourneyStepStatus,
        addMedMobileStop,
        cycleMedMobileStatus,
        bookMedMobileSlot,
        createSmartReferral,
        updateReferralStatus,
        closeCareLoop,
        toggleReminderStatus,
        rescheduleReminder,
        deleteReminder,
        addPreventiveReminder,
        resetDemoData,
      }}
    >
      {children}
    </MedradarContext.Provider>
  );
}

export function useMedradar() {
  const ctx = useContext(MedradarContext);
  if (!ctx) throw new Error('useMedradar must be used within MedradarProvider');
  return ctx;
}
