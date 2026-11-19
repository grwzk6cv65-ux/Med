import { ArrowRight, CheckCircle2, Cpu, Lock, Radar, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';
import { PatientSymptoms, PatientVitals } from '../types/medradar';
import { evaluateHealthRadar } from '../utils/aiRadarEngine';
import { RiskStatusTag } from './StatusIndicator';

export function AiHealthRadarView() {
  const {
    t,
    language,
    role,
    patients,
    activePatientId,
    setActivePatientId,
    getVillage,
    getCluster,
    updatePatientClinicalState,
    createSmartReferral,
    setActiveModule,
  } = useMedradar();

  const activePatient = patients.find((p) => p.id === activePatientId) ?? patients[0];
  const village = getVillage(activePatient.villageId);
  const cluster = getCluster(activePatient.clusterId);

  const [simVitals, setSimVitals] = useState<PatientVitals>(activePatient.vitals);
  const [simSymptoms, setSimSymptoms] = useState<PatientSymptoms>(activePatient.symptoms);
  const [simDistance, setSimDistance] = useState<number>(village?.distanceToHubKm ?? 36);
  const [simMissed, setSimMissed] = useState<number>(activePatient.missedScreeningsCount);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    setSimVitals(activePatient.vitals);
    setSimSymptoms(activePatient.symptoms);
    setSimDistance(village?.distanceToHubKm ?? 36);
    setSimMissed(activePatient.missedScreeningsCount);
    setFeedbackMsg(null);
  }, [activePatient.id, activePatient.vitals, activePatient.symptoms, activePatient.missedScreeningsCount, village?.distanceToHubKm]);

  const assessment = evaluateHealthRadar({
    age: activePatient.age,
    vitals: simVitals,
    symptoms: simSymptoms,
    distanceToHubKm: simDistance,
    missedScreeningsCount: simMissed,
  });

  const handleApplyToPatient = () => {
    updatePatientClinicalState(activePatient.id, simVitals, simSymptoms);
    setFeedbackMsg(`${activePatient.fullName} · ${assessment.totalScore}/100`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleGenerateReferral = () => {
    updatePatientClinicalState(activePatient.id, simVitals, simSymptoms);
    createSmartReferral({
      patientId: activePatient.id,
      specialty: assessment.recommendedSpecialty,
      scheduledDate: '2026-11-22',
      timeSlot: '10:30',
      doctorNotes: `AI Health Radar Simulation (${assessment.totalScore}/100): ${t(assessment.recommendedActionKey)}`,
    });
    setActiveModule('passport_referrals');
  };

  const scoreBarColor =
    assessment.riskTier === 'critical'
      ? 'bg-red-500'
      : assessment.riskTier === 'high'
        ? 'bg-orange-500'
        : assessment.riskTier === 'moderate'
          ? 'bg-amber-500'
          : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1.5">
            <Cpu className="w-3.5 h-3.5" />
            <span>{t('radar_badge')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t('radar_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('radar_sub')}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {role === 'doctor' ? (
            <>
              <label className="text-xs font-medium text-zinc-500 whitespace-nowrap">
                {t('radar_load_patient')}:
              </label>
              <select
                value={activePatient.id}
                onChange={(e) => setActivePatientId(e.target.value)}
                className="h-9 px-3 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.age} yrs)
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium bg-zinc-100 border border-zinc-200 rounded-lg text-zinc-800">
              <Lock className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>
                {activePatient.fullName} ({activePatient.demoCode})
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Main Split: White Controls + Matte Black & Emerald Score Readout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-950">{t('radar_sliders_header')}</h2>
              <div className="text-xs text-zinc-500 mt-0.5">
                {activePatient.fullName} · {village?.name} · {cluster ? pickLocalized(cluster.name, language) : ''}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                label: t('lab_sys_bp'),
                val: simVitals.systolicBP,
                min: 90,
                max: 210,
                step: 1,
                unit: 'mmHg',
                onChange: (v: number) => setSimVitals((s) => ({ ...s, systolicBP: v })),
              },
              {
                label: t('lab_hba1c'),
                val: simVitals.hba1c,
                min: 4.5,
                max: 12.0,
                step: 0.1,
                unit: '%',
                onChange: (v: number) => setSimVitals((s) => ({ ...s, hba1c: v })),
              },
              {
                label: t('lab_spo2'),
                val: simVitals.spo2,
                min: 82,
                max: 100,
                step: 1,
                unit: '%',
                onChange: (v: number) => setSimVitals((s) => ({ ...s, spo2: v })),
              },
              {
                label: t('lab_crp'),
                val: simVitals.crp,
                min: 0.5,
                max: 40,
                step: 0.5,
                unit: 'mg/L',
                onChange: (v: number) => setSimVitals((s) => ({ ...s, crp: v })),
              },
              {
                label: t('lab_hgb'),
                val: simVitals.hemoglobin,
                min: 75,
                max: 170,
                step: 1,
                unit: 'g/L',
                onChange: (v: number) => setSimVitals((s) => ({ ...s, hemoglobin: v })),
              },
              {
                label: t('radar_distance_km'),
                val: simDistance,
                min: 5,
                max: 80,
                step: 1,
                unit: 'km',
                onChange: (v: number) => setSimDistance(v),
              },
              {
                label: t('radar_missed_screenings'),
                val: simMissed,
                min: 0,
                max: 5,
                step: 1,
                unit: '',
                onChange: (v: number) => setSimMissed(v),
              },
            ].map((slider) => (
              <div key={slider.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-zinc-700">{slider.label}</span>
                  <span className="font-mono tabular-nums font-semibold text-zinc-950">
                    {slider.val} {slider.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={slider.val}
                  onChange={(e) => slider.onChange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
            ))}
          </div>

          <div className="border-t border-zinc-200 pt-4">
            <h3 className="text-xs font-semibold text-zinc-700 mb-2.5">{t('radar_symptoms_header')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: 'chestPain', label: t('sym_chest_pain') },
                  { key: 'shortnessOfBreath', label: t('sym_sob') },
                  { key: 'dizziness', label: t('sym_dizziness') },
                  { key: 'persistentCough', label: t('sym_cough') },
                  { key: 'fatigue', label: t('sym_fatigue') },
                  { key: 'missedMedication', label: t('sym_missed_meds') },
                ] as const
              ).map((sym) => {
                const checked = simSymptoms[sym.key];
                return (
                  <button
                    key={sym.key}
                    type="button"
                    onClick={() =>
                      setSimSymptoms((prev) => ({ ...prev, [sym.key]: !prev[sym.key] }))
                    }
                    className={`px-3 py-2 text-left text-xs font-medium rounded-lg border transition-colors flex items-center justify-between ${
                      checked
                        ? 'bg-zinc-950 border-zinc-950 text-emerald-400'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <span className="truncate">{sym.label}</span>
                    <span className="font-mono text-[11px] ml-2">{checked ? 'ON' : 'OFF'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Matte Black Score & Transparent Rule Breakdown */}
        <div className="lg:col-span-6 bg-zinc-950 text-white border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <div className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                  <Radar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('radar_score_label')}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-bold font-mono tabular-nums text-emerald-400">
                    {assessment.totalScore}
                  </span>
                  <span className="text-sm font-mono text-zinc-500">/ 100</span>
                </div>
              </div>
              <RiskStatusTag level={assessment.riskTier} />
            </div>

            <div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${scoreBarColor}`}
                  style={{ width: `${assessment.totalScore}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="text-zinc-400">{t('radar_recommended_specialty')}</div>
                  <div className="font-semibold text-white mt-0.5">
                    {assessment.recommendedSpecialty}
                  </div>
                </div>
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="text-zinc-400">{t('radar_recommended_pathway')}</div>
                  <div className="font-semibold text-emerald-400 mt-0.5">
                    {t(assessment.recommendedActionKey)}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-zinc-300 mb-2.5 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t('radar_rule_breakdown')}</span>
              </h3>
              {assessment.factors.length === 0 ? (
                <div className="p-4 text-xs text-zinc-400 border border-zinc-800 rounded-lg text-center">
                  {t('radar_no_factors')}
                </div>
              ) : (
                <div className="border border-zinc-800 rounded-lg divide-y divide-zinc-800 bg-zinc-900/60">
                  {assessment.factors.map((f) => (
                    <div
                      key={f.ruleId}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-white">{t(f.labelKey)}</div>
                        <div className="text-zinc-400 font-mono text-[11px] mt-0.5">
                          {f.ruleId} · {f.observed} ({f.threshold})
                        </div>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-emerald-400 shrink-0">
                        +{f.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4 mt-5 flex flex-wrap items-center justify-between gap-2">
            {feedbackMsg ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{feedbackMsg}</span>
              </div>
            ) : (
              <span className="text-[11px] text-zinc-500">Rule Engine v1.0 · Local Browser JS</span>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleApplyToPatient}
                className="px-3.5 py-2 text-xs font-semibold text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors whitespace-nowrap"
              >
                {t('radar_apply_to_patient')}
              </button>
              <button
                onClick={handleGenerateReferral}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors whitespace-nowrap"
              >
                <span>{t('radar_generate_referral')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
