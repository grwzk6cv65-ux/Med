import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  FileBadge2,
  Lock,
  Map as MapIcon,
  Radar,
  RefreshCcw,
  Stethoscope,
  Truck,
} from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';
import { evaluatePatientRadar } from '../utils/aiRadarEngine';
import { DoctorStatusBadge } from './DoctorVerificationModal';
import { RiskStatusTag, WorkflowStatusTag } from './StatusIndicator';

export function DashboardView() {
  const {
    t,
    language,
    role,
    clusters,
    villages,
    patients,
    activePatientId,
    setActivePatientId,
    medMobileSchedule,
    referrals,
    reminders,
    setActiveModule,
    setSelectedVillageId,
    closeCareLoop,
    toggleReminderStatus,
    createSmartReferral,
  } = useMedradar();
  const { user, requestDoctorCabinetAccess } = useAuth();

  const rankedPatients = useMemo(() => {
    return patients
      .map((p) => {
        const v = villages.find((vil) => vil.id === p.villageId);
        const c = clusters.find((cl) => cl.id === p.clusterId);
        const radar = evaluatePatientRadar(p, v?.distanceToHubKm ?? 35);
        return { patient: p, village: v, cluster: c, radar };
      })
      .sort((a, b) => b.radar.totalScore - a.radar.totalScore);
  }, [patients, villages, clusters]);

  const highRiskCount = rankedPatients.filter(
    (item) => item.radar.riskTier === 'critical' || item.radar.riskTier === 'high'
  ).length;

  const closedLoopRate = useMemo(() => {
    if (referrals.length === 0) return 0;
    const closed = referrals.filter((r) => r.loopClosed).length;
    return Math.round((closed / referrals.length) * 100);
  }, [referrals]);

  const totalScreened30d = useMemo(
    () => villages.reduce((sum, v) => sum + v.screenedLast30d, 0),
    [villages]
  );

  // Patient View Data
  const activePatientEntry =
    rankedPatients.find((item) => item.patient.id === activePatientId) ?? rankedPatients[0];
  const patientReminders = reminders.filter(
    (r) => r.patientId === activePatientEntry.patient.id
  );
  const patientReferrals = referrals.filter(
    (r) => r.patientId === activePatientEntry.patient.id
  );
  const patientMedMobile = medMobileSchedule.find(
    (s) =>
      s.villageId === activePatientEntry.patient.villageId ||
      s.clusterId === activePatientEntry.patient.clusterId
  );

  if (user?.accountRole === 'doctor' && user.doctorVerificationStatus !== 'approved') {
    return (
      <div className="space-y-6">
        <div className="bg-zinc-950 text-white border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 max-w-2xl">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-lg sm:text-xl font-bold text-white">{t('doc_gate_title')}</h1>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {t('doc_gate_desc')}
                </p>
              </div>
            </div>
            <DoctorStatusBadge status={user.doctorVerificationStatus} />
          </div>

          {user.doctorVerificationStatus === 'pending' && (
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{t('doc_pending_notice')}</span>
            </div>
          )}

          {user.doctorVerificationStatus === 'rejected' && user.doctorRejectionReason && (
            <div className="p-4 bg-red-950/50 border border-red-800/70 rounded-xl text-xs text-red-200 space-y-1">
              <div className="font-bold">{t('doc_rejection_reason')}:</div>
              <div>{user.doctorRejectionReason}</div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void requestDoctorCabinetAccess()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-colors"
            >
              <Stethoscope className="w-4 h-4" />
              <span>
                {user.doctorVerificationStatus === 'rejected'
                  ? t('doc_verif_resubmit')
                  : t('doc_verif_btn')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('profile')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-colors"
            >
              <span>{t('nav_profile')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'patient') {
    const { patient, village, cluster, radar } = activePatientEntry;
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
              {t('dash_patient_title')}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 max-w-2xl">{t('dash_patient_sub')}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs font-medium text-zinc-500 whitespace-nowrap">
              {t('dash_select_patient')}:
            </label>
            <select
              value={patient.id}
              onChange={(e) => setActivePatientId(e.target.value)}
              className="h-9 px-3 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.demoCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sleek Matte Black Patient Summary Banner */}
        <div className="bg-zinc-950 text-white border border-zinc-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-5 items-center">
          <div className="md:col-span-2 space-y-1">
            <div className="text-xs font-mono text-emerald-400">
              {patient.demoCode} · {village?.name} · {cluster ? pickLocalized(cluster.name, language) : ''}
            </div>
            <div className="text-xl font-bold text-white">{patient.fullName}</div>
            <div className="text-xs text-zinc-400">
              {patient.chronicConditions.map((c) => pickLocalized(c, language)).join(' · ')}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-400">{t('radar_score_label')}</div>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                {radar.totalScore}/100
              </span>
              <RiskStatusTag level={radar.riskTier} />
            </div>
          </div>

          <div className="flex flex-wrap md:justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveModule('passport_referrals')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileBadge2 className="w-4 h-4" />
              <span>{t('nav_passport_referrals')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Next MedMobile Visit & Active Referrals */}
          <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>{t('dash_patient_next_visit')}</span>
              </h2>
              <button
                type="button"
                onClick={() => setActiveModule('medmobile')}
                className="text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap"
              >
                {t('nav_medmobile')}
              </button>
            </div>

            {patientMedMobile ? (
              <div className="flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-zinc-950 text-sm">
                    {patientMedMobile.unitId} · {village?.name}
                  </div>
                  <div className="text-zinc-600 mt-0.5">
                    {patientMedMobile.dayOfWeek} ·{' '}
                    <span className="font-mono tabular-nums">{patientMedMobile.timeWindow}</span> ·{' '}
                    {t(`spec_${patientMedMobile.specialtyFocus}`)}
                  </div>
                  <div className="text-zinc-500 mt-0.5">{patientMedMobile.teamLead}</div>
                </div>
                <WorkflowStatusTag status={patientMedMobile.status} />
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                {t('map_next_medmobile')}: <span className="font-mono">{village?.nextMedMobileVisit}</span>
              </div>
            )}

            <div className="border-t border-zinc-200 pt-4">
              <h3 className="text-xs font-semibold text-zinc-700 mb-2.5">{t('ref_title')}</h3>
              {patientReferrals.length === 0 ? (
                <div className="text-xs text-zinc-500 py-2">No active specialist referrals.</div>
              ) : (
                <div className="divide-y divide-zinc-200">
                  {patientReferrals.map((ref) => (
                    <div key={ref.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-semibold text-zinc-950">
                          {pickLocalized(ref.hospitalName, language)} · {ref.specialty}
                        </div>
                        <div className="font-mono tabular-nums text-zinc-500 mt-0.5">
                          {ref.scheduledDate} {ref.timeSlot}
                        </div>
                      </div>
                      <WorkflowStatusTag status={ref.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Personal Preventive Reminders */}
          <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>{t('dash_patient_reminders')}</span>
              </h2>
              <button
                type="button"
                onClick={() => setActiveModule('care_loop')}
                className="text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap"
              >
                {t('nav_care_loop')}
              </button>
            </div>

            {patientReminders.length === 0 ? (
              <div className="text-xs text-zinc-500 py-6 text-center">
                No preventive reminders assigned.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200">
                {patientReminders.map((rem) => (
                  <div key={rem.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-zinc-950">
                        {pickLocalized(rem.title, language)}
                      </div>
                      <div className="font-mono tabular-nums text-zinc-500 mt-0.5">
                        {rem.dueDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <WorkflowStatusTag status={rem.status} />
                      {rem.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => toggleReminderStatus(rem.id, 'completed')}
                          className="px-2.5 py-1 text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md"
                        >
                          {t('rem_done')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Care Journey Preview */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
            <h2 className="text-sm font-semibold text-zinc-950">
              {t('dash_patient_journey_preview')}
            </h2>
            <button
              type="button"
              onClick={() => setActiveModule('care_loop')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
            >
              <span>{t('nav_care_loop')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {patient.journeyHistory.map((step) => (
              <div
                key={step.stage}
                className={`p-3 rounded-lg border-2 text-xs ${
                  step.status === 'completed'
                    ? 'bg-emerald-50/70 border-emerald-300 text-zinc-950'
                    : step.status === 'in_progress'
                      ? 'bg-zinc-950 border-zinc-950 text-white'
                      : step.status === 'waiting'
                        ? 'bg-amber-50/50 border-amber-400 border-dashed text-zinc-950'
                        : 'bg-zinc-50 border-zinc-200 border-dotted text-zinc-600'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[11px] opacity-80">
                  <span>0{step.stage + 1}</span>
                  <span className="inline-flex items-center gap-1 font-sans text-[10px] font-semibold">
                    {step.status === 'completed' && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                    )}
                    {t(`journey_status_${step.status}`)}
                  </span>
                </div>
                <div className="font-semibold mt-1">{t(`stage_${step.stage}`)}</div>
                <div className="font-mono text-[10px] opacity-75 mt-1">{step.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // DOCTOR VIEW
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            {t('dash_doctor_title')}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('dash_doctor_sub')}</p>
        </div>
        <button
          type="button"
          onClick={() => setActiveModule('map')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <MapIcon className="w-4 h-4 text-emerald-400" />
          <span>{t('dash_open_map')}</span>
        </button>
      </div>

      {/* 4-Column KPI Strip: Matte Black Hero KPI + Clean White KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-950 text-white border border-zinc-800 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-400">{t('kpi_villages')}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {villages.length}
          </div>
          <div className="mt-1 text-xs text-zinc-400 font-mono tabular-nums">
            {clusters.length} {t('kpi_clusters')}
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">{t('kpi_high_risk')}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-red-600">
            {highRiskCount}
          </div>
          <div className="mt-1 text-xs text-zinc-500">AI Health Radar</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">{t('kpi_closed_loop')}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-600">
            {closedLoopRate}%
          </div>
          <div className="mt-1 text-xs text-zinc-500 font-mono tabular-nums">
            {referrals.filter((r) => r.loopClosed).length}/{referrals.length} verified
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">{t('kpi_screenings_30d')}</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-zinc-950">
            {totalScreened30d.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-zinc-500 font-mono tabular-nums">
            {medMobileSchedule.length} {t('kpi_medmobile_active')}
          </div>
        </div>
      </div>

      {/* Priority Triage Queue */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
            <Radar className="w-4 h-4 text-emerald-600" />
            <span>{t('dash_triage_queue')}</span>
          </h2>
          <button
            type="button"
            onClick={() => setActiveModule('ai_radar')}
            className="text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap"
          >
            {t('dash_open_radar')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Patient</th>
                <th className="py-2.5 px-4">Village / Cluster</th>
                <th className="py-2.5 px-4 text-right">Radar Score</th>
                <th className="py-2.5 px-4">Risk Tier</th>
                <th className="py-2.5 px-4">Pathway</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs">
              {rankedPatients.slice(0, 6).map(({ patient, village, cluster, radar }) => (
                <tr key={patient.id} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-zinc-950">{patient.fullName}</div>
                    <div className="font-mono text-[11px] text-zinc-500">
                      {patient.demoCode} · {patient.age}y {patient.sex}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (village) setSelectedVillageId(village.id);
                        setActiveModule('map');
                      }}
                      className="text-left hover:underline"
                    >
                      <div className="font-medium text-zinc-900">{village?.name}</div>
                      <div className="text-[11px] text-zinc-500">
                        {cluster ? pickLocalized(cluster.name, language) : ''} · {village?.distanceToHubKm} km
                      </div>
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-zinc-950">
                    {radar.totalScore} / 100
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <RiskStatusTag level={radar.riskTier} />
                  </td>
                  <td className="py-3 px-4 text-zinc-700">
                    <div className="font-medium text-zinc-900">{radar.recommendedSpecialty}</div>
                    <div className="text-[11px] text-zinc-500">{t(radar.recommendedActionKey)}</div>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePatientId(patient.id);
                          setActiveModule('ai_radar');
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-md"
                      >
                        {t('dash_open_radar')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          createSmartReferral({
                            patientId: patient.id,
                            specialty: radar.recommendedSpecialty,
                            scheduledDate: '2026-11-22',
                            timeSlot: '11:00',
                            doctorNotes: `Triaged from Doctor Command (${radar.totalScore}/100)`,
                          });
                          setActivePatientId(patient.id);
                          setActiveModule('passport_referrals');
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md"
                      >
                        {t('dash_book_referral')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-2">
            <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              <span>{t('dash_todays_medmobile')}</span>
            </h2>
            <button
              type="button"
              onClick={() => setActiveModule('medmobile')}
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              {t('nav_medmobile')}
            </button>
          </div>
          <div className="divide-y divide-zinc-200 text-xs">
            {medMobileSchedule.slice(0, 5).map((stop) => {
              const v = villages.find((vil) => vil.id === stop.villageId);
              return (
                <div key={stop.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-950">
                      {stop.unitId} · {v?.name ?? stop.villageId}
                    </div>
                    <div className="text-zinc-500 mt-0.5 font-mono tabular-nums">
                      {stop.dayOfWeek} {stop.timeWindow} · {t(`spec_${stop.specialtyFocus}`)}
                    </div>
                  </div>
                  <WorkflowStatusTag status={stop.status} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-2">
            <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-emerald-600" />
              <span>{t('dash_loop_alerts')}</span>
            </h2>
            <button
              type="button"
              onClick={() => setActiveModule('care_loop')}
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              {t('nav_care_loop')}
            </button>
          </div>
          <div className="divide-y divide-zinc-200 text-xs">
            {referrals
              .filter((r) => !r.loopClosed)
              .slice(0, 5)
              .map((ref) => {
                const p = patients.find((pt) => pt.id === ref.patientId);
                return (
                  <div key={ref.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-950 truncate">
                        {p?.fullName ?? ref.patientId} · {ref.specialty}
                      </div>
                      <div className="text-zinc-500 mt-0.5 truncate">
                        {pickLocalized(ref.hospitalName, language)} ·{' '}
                        <span className="font-mono tabular-nums">{ref.scheduledDate}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => closeCareLoop(ref.id, 'Verified from Doctor Command')}
                      className="px-2.5 py-1 text-[11px] font-medium bg-zinc-950 hover:bg-zinc-800 text-emerald-400 rounded-md whitespace-nowrap shrink-0"
                    >
                      {t('dash_close_loop')}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
