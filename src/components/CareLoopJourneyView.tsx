import {
  Activity,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Lock,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';
import { JourneyStepStatus, PreventiveReminder } from '../types/medradar';
import { validateReminderInput } from '../utils/validation';
import { RiskStatusTag, WorkflowStatusTag } from './StatusIndicator';

export function CareLoopJourneyView() {
  const {
    t,
    language,
    role,
    patients,
    activePatientId,
    setActivePatientId,
    getVillage,
    advancePatientJourney,
    setJourneyStepStatus,
    reminders,
    toggleReminderStatus,
    rescheduleReminder,
    deleteReminder,
    addPreventiveReminder,
    referrals,
    closeCareLoop,
  } = useMedradar();

  const patient = patients.find((p) => p.id === activePatientId) ?? patients[0];
  const village = getVillage(patient.villageId);

  const [showReminderForm, setShowReminderForm] = useState(false);
  const [remTitle, setRemTitle] = useState('');
  const [remCategory, setRemCategory] = useState<PreventiveReminder['category']>('appointment');
  const [remDate, setRemDate] = useState('2026-11-25');
  const [remTime, setRemTime] = useState('10:00');
  const [linkedRefId, setLinkedRefId] = useState('');
  const [remErrors, setRemErrors] = useState<Record<string, string>>({});

  // Reschedule state per reminder
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  const [reschedErrors, setReschedErrors] = useState<Record<string, string>>({});

  const [loopNotes, setLoopNotes] = useState<Record<string, string>>({});

  // Privacy scoping: Patient View displays only the active patient's records
  const visibleReminders = useMemo(() => {
    return role === 'patient'
      ? reminders.filter((r) => r.patientId === patient.id)
      : reminders;
  }, [reminders, role, patient.id]);

  const visibleReferrals = useMemo(() => {
    return role === 'patient'
      ? referrals.filter((r) => r.patientId === patient.id)
      : referrals;
  }, [referrals, role, patient.id]);

  const patientReferrals = useMemo(
    () => referrals.filter((r) => r.patientId === patient.id),
    [referrals, patient.id]
  );

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateReminderInput(
      { title: remTitle, dueDate: remDate, dueTime: remTime },
      language
    );
    if (!validation.valid) {
      setRemErrors(validation.errors);
      return;
    }

    addPreventiveReminder({
      patientId: patient.id,
      title: remTitle.trim(),
      category: remCategory,
      dueDate: remDate,
      dueTime: remTime.trim() || undefined,
      linkedReferralId: linkedRefId || undefined,
      priority: 'priority',
    });

    setRemErrors({});
    setRemTitle('');
    setLinkedRefId('');
    setShowReminderForm(false);
  };

  const handleStartReschedule = (rem: PreventiveReminder) => {
    setRescheduleId(rem.id);
    setReschedDate(rem.dueDate);
    setReschedTime(rem.dueTime ?? '10:00');
    setReschedErrors({});
  };

  const handleSaveReschedule = (rem: PreventiveReminder) => {
    const validation = validateReminderInput(
      {
        title: pickLocalized(rem.title, language),
        dueDate: reschedDate,
        dueTime: reschedTime,
      },
      language
    );
    if (!validation.valid) {
      setReschedErrors(validation.errors);
      return;
    }
    rescheduleReminder(rem.id, reschedDate, reschedTime.trim() || undefined);
    setRescheduleId(null);
    setReschedErrors({});
  };

  const renderJourneyStatusBadge = (status: JourneyStepStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
            <span>{t('journey_status_completed')}</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-500 text-zinc-950 rounded-md">
            <Activity className="w-3 h-3" aria-hidden="true" />
            <span>{t('journey_status_in_progress')}</span>
          </span>
        );
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
            <Clock className="w-3 h-3 text-amber-700" aria-hidden="true" />
            <span>{t('journey_status_waiting')}</span>
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-zinc-200/80 text-zinc-700 border border-zinc-300 rounded-md">
            <Circle className="w-3 h-3 text-zinc-500" aria-hidden="true" />
            <span>{t('journey_status_upcoming')}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t('loop_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('loop_sub')}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {role === 'doctor' ? (
            <>
              <label
                htmlFor="journey-patient-select"
                className="text-xs font-medium text-zinc-500 whitespace-nowrap"
              >
                {t('lab_patient_select')}:
              </label>
              <select
                id="journey-patient-select"
                value={patient.id}
                onChange={(e) => setActivePatientId(e.target.value)}
                className="h-10 px-3 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.demoCode})
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-800">
              <Lock className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>
                {patient.fullName} ({patient.demoCode})
              </span>
            </span>
          )}
        </div>
      </div>

      {/* 1. Complete 8-Stage Patient Journey Timeline */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">{t('journey_header')}</h2>
            <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
              {patient.fullName} · {village?.name} · {t('nano_step_of')} {patient.journeyStage + 1} / 8
            </div>
          </div>
          {role === 'doctor' && (
            <button
              type="button"
              onClick={() => advancePatientJourney(patient.id)}
              disabled={patient.journeyStage >= 7}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span>{t('journey_advance')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Legend (Never Color Alone: Icon + Text + Border Style) */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
          {renderJourneyStatusBadge('completed')}
          {renderJourneyStatusBadge('in_progress')}
          {renderJourneyStatusBadge('waiting')}
          {renderJourneyStatusBadge('upcoming')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {patient.journeyHistory.map((step) => {
            const cardStyle =
              step.status === 'completed'
                ? 'bg-emerald-50/70 border-emerald-300 border-solid text-zinc-950'
                : step.status === 'in_progress'
                  ? 'bg-zinc-950 text-white border-zinc-950 border-solid shadow-md'
                  : step.status === 'waiting'
                    ? 'bg-amber-50/50 border-amber-400 border-dashed text-zinc-950'
                    : 'bg-zinc-50 border-zinc-200 border-dotted text-zinc-700';

            return (
              <div
                key={step.stage}
                className={`p-4 rounded-xl border-2 flex flex-col justify-between gap-3 ${cardStyle}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        step.status === 'in_progress' ? 'text-emerald-400' : 'text-zinc-500'
                      }`}
                    >
                      0{step.stage + 1}
                    </span>
                    {renderJourneyStatusBadge(step.status)}
                  </div>

                  <div
                    className={`text-xs font-bold ${
                      step.status === 'in_progress' ? 'text-white' : 'text-zinc-950'
                    }`}
                  >
                    {t(`stage_${step.stage}`)}
                  </div>

                  <p
                    className={`text-[11px] leading-relaxed ${
                      step.status === 'in_progress' ? 'text-zinc-300' : 'text-zinc-600'
                    }`}
                  >
                    {pickLocalized(step.note, language)}
                  </p>
                </div>

                <div
                  className={`pt-2.5 border-t text-[11px] space-y-1.5 ${
                    step.status === 'in_progress'
                      ? 'border-zinc-800 text-zinc-300'
                      : 'border-zinc-200/80 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-mono tabular-nums">
                    <span>{step.date}</span>
                    <span className="truncate font-sans">{step.actor}</span>
                  </div>

                  {role === 'doctor' && (
                    <select
                      aria-label={`${t(`stage_${step.stage}`)} status`}
                      value={step.status}
                      onChange={(e) =>
                        setJourneyStepStatus(
                          patient.id,
                          step.stage,
                          e.target.value as JourneyStepStatus
                        )
                      }
                      className={`w-full h-7 px-2 text-[11px] rounded-md border ${
                        step.status === 'in_progress'
                          ? 'bg-zinc-900 border-zinc-700 text-white'
                          : 'bg-white border-zinc-200 text-zinc-800'
                      }`}
                    >
                      <option value="completed">{t('journey_status_completed')}</option>
                      <option value="in_progress">{t('journey_status_in_progress')}</option>
                      <option value="waiting">{t('journey_status_waiting')}</option>
                      <option value="upcoming">{t('journey_status_upcoming')}</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Smart Reminder System & Closed-Loop Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-200">
            <h2 className="text-base font-semibold text-zinc-950 flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-600" />
              <span>{t('rem_header')}</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowReminderForm((s) => !s);
                setRemErrors({});
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('rem_add')}</span>
            </button>
          </div>

          {showReminderForm && (
            <form
              onSubmit={handleAddReminder}
              noValidate
              className="mt-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5"
            >
              <div>
                <input
                  type="text"
                  value={remTitle}
                  onChange={(e) => setRemTitle(e.target.value)}
                  placeholder={`${patient.fullName} — ...`}
                  aria-invalid={Boolean(remErrors.title)}
                  className={`w-full h-9 px-3 text-xs rounded-lg border ${
                    remErrors.title ? 'border-red-500 bg-red-50/40' : 'border-zinc-200 bg-white'
                  }`}
                />
                {remErrors.title && (
                  <p className="text-[11px] text-red-600 mt-1">{remErrors.title}</p>
                )}
              </div>

              <select
                value={remCategory}
                onChange={(e) => setRemCategory(e.target.value as PreventiveReminder['category'])}
                className="w-full h-9 px-2.5 text-xs bg-white border border-zinc-200 rounded-lg"
              >
                <option value="appointment">{t('rem_cat_appointment')}</option>
                <option value="examination">{t('rem_cat_examination')}</option>
                <option value="lab_result">{t('rem_cat_lab_result')}</option>
                <option value="follow_up">{t('rem_cat_follow_up')}</option>
                <option value="personal_task">{t('rem_cat_personal_task')}</option>
              </select>

              {patientReferrals.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    {t('rem_link_ref')}
                  </label>
                  <select
                    value={linkedRefId}
                    onChange={(e) => {
                      const refId = e.target.value;
                      setLinkedRefId(refId);
                      const matched = patientReferrals.find((r) => r.id === refId);
                      if (matched) {
                        setRemDate(matched.scheduledDate);
                        setRemTime(matched.timeSlot);
                        if (!remTitle.trim()) {
                          setRemTitle(`${matched.specialty} (${matched.id})`);
                        }
                      }
                    }}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-zinc-200 rounded-lg"
                  >
                    <option value="">{t('rem_no_link')}</option>
                    {patientReferrals.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} · {r.specialty} ({r.scheduledDate} {r.timeSlot})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="date"
                    value={remDate}
                    onChange={(e) => setRemDate(e.target.value)}
                    aria-invalid={Boolean(remErrors.dueDate)}
                    className={`w-full h-9 px-2.5 text-xs font-mono rounded-lg border ${
                      remErrors.dueDate ? 'border-red-500 bg-red-50/40' : 'border-zinc-200 bg-white'
                    }`}
                  />
                  {remErrors.dueDate && (
                    <p className="text-[11px] text-red-600 mt-1">{remErrors.dueDate}</p>
                  )}
                </div>
                <div>
                  <input
                    type="time"
                    value={remTime}
                    onChange={(e) => setRemTime(e.target.value)}
                    aria-invalid={Boolean(remErrors.dueTime)}
                    className={`w-full h-9 px-2.5 text-xs font-mono rounded-lg border ${
                      remErrors.dueTime ? 'border-red-500 bg-red-50/40' : 'border-zinc-200 bg-white'
                    }`}
                  />
                  {remErrors.dueTime && (
                    <p className="text-[11px] text-red-600 mt-1">{remErrors.dueTime}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg"
              >
                {t('rem_add')}
              </button>
            </form>
          )}

          <div className="divide-y divide-zinc-200 mt-2">
            {visibleReminders.map((rem) => {
              const p = patients.find((pt) => pt.id === rem.patientId);
              const isEditing = rescheduleId === rem.id;
              return (
                <div key={rem.id} className="py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-950">
                        {pickLocalized(rem.title, language)}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                        {p?.fullName ?? rem.patientId} ·{' '}
                        <span className="font-mono">
                          {rem.dueDate}
                          {rem.dueTime ? ` ${rem.dueTime}` : ''}
                        </span>{' '}
                        · {t(`rem_cat_${rem.category}`)}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <WorkflowStatusTag status={rem.status} />
                        {rem.linkedReferralId && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-600">
                            {rem.linkedReferralId}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                      {rem.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => toggleReminderStatus(rem.id, 'completed')}
                          className="px-2.5 py-1 text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md transition-colors"
                        >
                          {t('rem_done')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartReschedule(rem)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md transition-colors"
                      >
                        <CalendarClock className="w-3 h-3" />
                        <span>{t('rem_reschedule')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteReminder(rem.id)}
                        aria-label={`${t('rem_delete')} ${pickLocalized(rem.title, language)}`}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="date"
                            value={reschedDate}
                            onChange={(e) => setReschedDate(e.target.value)}
                            className={`w-full h-8 px-2 text-xs font-mono bg-white border rounded ${
                              reschedErrors.dueDate ? 'border-red-500' : 'border-zinc-200'
                            }`}
                          />
                          {reschedErrors.dueDate && (
                            <p className="text-[10px] text-red-600 mt-0.5">{reschedErrors.dueDate}</p>
                          )}
                        </div>
                        <div>
                          <input
                            type="time"
                            value={reschedTime}
                            onChange={(e) => setReschedTime(e.target.value)}
                            className={`w-full h-8 px-2 text-xs font-mono bg-white border rounded ${
                              reschedErrors.dueTime ? 'border-red-500' : 'border-zinc-200'
                            }`}
                          />
                          {reschedErrors.dueTime && (
                            <p className="text-[10px] text-red-600 mt-0.5">{reschedErrors.dueTime}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRescheduleId(null)}
                          className="px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-950"
                        >
                          {t('rem_cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveReschedule(rem)}
                          className="px-3 py-1 text-[11px] font-semibold bg-zinc-950 text-white rounded-md"
                        >
                          {t('rem_save')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Closed-Loop Care Monitor */}
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-200">
            <h2 className="text-base font-semibold text-zinc-950 flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-emerald-600" />
              <span>{t('closed_header')}</span>
            </h2>
            <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">
              {visibleReferrals.filter((r) => r.loopClosed).length} / {visibleReferrals.length}{' '}
              {t('closed_verified')}
            </span>
          </div>

          <div className="divide-y divide-zinc-200 mt-2">
            {visibleReferrals.map((ref) => {
              const p = patients.find((pt) => pt.id === ref.patientId);
              return (
                <div key={ref.id} className="py-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">{ref.id}</span>
                      <span className="text-sm font-semibold text-zinc-950">
                        {p?.fullName ?? ref.patientId}
                      </span>
                      <RiskStatusTag level={ref.urgency} />
                    </div>
                    {ref.loopClosed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t('closed_verified')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800 rounded-md">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t('closed_open')}</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-zinc-600">
                    {pickLocalized(ref.hospitalName, language)} · {ref.specialty} ·{' '}
                    <span className="font-mono tabular-nums">{ref.scheduledDate}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{ref.doctorNotes}</div>

                  {role === 'doctor' && !ref.loopClosed && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        value={loopNotes[ref.id] ?? ''}
                        onChange={(e) =>
                          setLoopNotes((prev) => ({ ...prev, [ref.id]: e.target.value }))
                        }
                        placeholder={t('closed_note_placeholder')}
                        className="flex-1 h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => closeCareLoop(ref.id, loopNotes[ref.id] ?? '')}
                        className="px-3.5 h-9 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        {t('closed_verify_btn')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
