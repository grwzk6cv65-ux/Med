import { Activity, AlertTriangle, CheckCircle2, FlaskConical, Lock, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';
import { PatientVitals } from '../types/medradar';
import { analyzeRapidLabVitals } from '../utils/aiRadarEngine';
import { validateRapidLabVitals } from '../utils/validation';

const FLAG_LABELS: Record<string, string> = {
  BP_HIGH: 'BP >= 140/90',
  GLUCOSE_HIGH: 'Glucose >= 7.0',
  HBA1C_HIGH: 'HbA1c >= 6.5%',
  SPO2_LOW: 'SpO2 <= 94%',
  HGB_LOW: 'Hemoglobin < 110',
  CRP_HIGH: 'CRP >= 10 mg/L',
  CHOL_HIGH: 'Cholesterol >= 5.5',
};

type NumericVitalKey =
  | 'systolicBP'
  | 'diastolicBP'
  | 'heartRate'
  | 'spo2'
  | 'glucoseMmol'
  | 'hba1c'
  | 'hemoglobin'
  | 'crp'
  | 'cholesterol';

function vitalsToStrings(v: PatientVitals): Record<NumericVitalKey, string> {
  return {
    systolicBP: String(v.systolicBP),
    diastolicBP: String(v.diastolicBP),
    heartRate: String(v.heartRate),
    spo2: String(v.spo2),
    glucoseMmol: String(v.glucoseMmol),
    hba1c: String(v.hba1c),
    hemoglobin: String(v.hemoglobin),
    crp: String(v.crp),
    cholesterol: String(v.cholesterol),
  };
}

export function RapidLabView() {
  const {
    t,
    language,
    role,
    patients,
    activePatientId,
    setActivePatientId,
    getVillage,
    getCluster,
    rapidLabs,
    recordRapidLab,
    setActiveModule,
  } = useMedradar();

  const activePatient = patients.find((p) => p.id === activePatientId) ?? patients[0];
  const [rawInputs, setRawInputs] = useState<Record<NumericVitalKey, string>>(() =>
    vitalsToStrings(activePatient.vitals)
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    setRawInputs(vitalsToStrings(activePatient.vitals));
    setFormErrors({});
    setSavedNotice(false);
  }, [activePatient.id, activePatient.vitals]);

  const parsedVitals: PatientVitals = useMemo(
    () => ({
      ...activePatient.vitals,
      systolicBP: rawInputs.systolicBP.trim() === '' ? Number.NaN : Number(rawInputs.systolicBP),
      diastolicBP: rawInputs.diastolicBP.trim() === '' ? Number.NaN : Number(rawInputs.diastolicBP),
      heartRate: rawInputs.heartRate.trim() === '' ? Number.NaN : Number(rawInputs.heartRate),
      spo2: rawInputs.spo2.trim() === '' ? Number.NaN : Number(rawInputs.spo2),
      glucoseMmol: rawInputs.glucoseMmol.trim() === '' ? Number.NaN : Number(rawInputs.glucoseMmol),
      hba1c: rawInputs.hba1c.trim() === '' ? Number.NaN : Number(rawInputs.hba1c),
      hemoglobin: rawInputs.hemoglobin.trim() === '' ? Number.NaN : Number(rawInputs.hemoglobin),
      crp: rawInputs.crp.trim() === '' ? Number.NaN : Number(rawInputs.crp),
      cholesterol: rawInputs.cholesterol.trim() === '' ? Number.NaN : Number(rawInputs.cholesterol),
    }),
    [activePatient.vitals, rawInputs]
  );

  const liveAnalysis = analyzeRapidLabVitals({
    ...activePatient.vitals,
    systolicBP: Number.isNaN(parsedVitals.systolicBP) ? activePatient.vitals.systolicBP : parsedVitals.systolicBP,
    diastolicBP: Number.isNaN(parsedVitals.diastolicBP) ? activePatient.vitals.diastolicBP : parsedVitals.diastolicBP,
    heartRate: Number.isNaN(parsedVitals.heartRate) ? activePatient.vitals.heartRate : parsedVitals.heartRate,
    spo2: Number.isNaN(parsedVitals.spo2) ? activePatient.vitals.spo2 : parsedVitals.spo2,
    glucoseMmol: Number.isNaN(parsedVitals.glucoseMmol) ? activePatient.vitals.glucoseMmol : parsedVitals.glucoseMmol,
    hba1c: Number.isNaN(parsedVitals.hba1c) ? activePatient.vitals.hba1c : parsedVitals.hba1c,
    hemoglobin: Number.isNaN(parsedVitals.hemoglobin) ? activePatient.vitals.hemoglobin : parsedVitals.hemoglobin,
    crp: Number.isNaN(parsedVitals.crp) ? activePatient.vitals.crp : parsedVitals.crp,
    cholesterol: Number.isNaN(parsedVitals.cholesterol) ? activePatient.vitals.cholesterol : parsedVitals.cholesterol,
  });

  const village = getVillage(activePatient.villageId);
  const cluster = getCluster(activePatient.clusterId);

  const visibleLogs = useMemo(() => {
    return role === 'patient'
      ? rapidLabs.filter((rec) => rec.patientId === activePatient.id)
      : rapidLabs;
  }, [rapidLabs, role, activePatient.id]);

  // Never silently clamp or discard user-typed values
  const handleField = (key: NumericVitalKey, val: string) => {
    setRawInputs((prev) => ({ ...prev, [key]: val }));
    setSavedNotice(false);
  };

  const handleSimulateAbnormal = () => {
    setRawInputs({
      systolicBP: '172',
      diastolicBP: '104',
      heartRate: '98',
      spo2: '91',
      glucoseMmol: '11.6',
      hba1c: '8.6',
      hemoglobin: '101',
      crp: '18.4',
      cholesterol: '6.3',
    });
    setFormErrors({});
    setSavedNotice(false);
  };

  const handleSaveLab = () => {
    const validation = validateRapidLabVitals(parsedVitals, language);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      setSavedNotice(false);
      return;
    }
    setFormErrors({});
    recordRapidLab(activePatient.id, parsedVitals, `Rapid Lab (${village?.name ?? 'Rural Post'})`);
    setSavedNotice(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t('lab_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('lab_sub')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {role === 'doctor' ? (
            <>
              <label
                htmlFor="rapid-lab-patient"
                className="text-xs font-medium text-zinc-500 whitespace-nowrap"
              >
                {t('lab_patient_select')}:
              </label>
              <select
                id="rapid-lab-patient"
                value={activePatient.id}
                onChange={(e) => setActivePatientId(e.target.value)}
                className="h-10 px-3 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {patients.map((p) => {
                  const v = getVillage(p.villageId);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({v?.name ?? p.villageId})
                    </option>
                  );
                })}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-zinc-200">
              <div>
                <div className="text-base font-semibold text-zinc-950">{activePatient.fullName}</div>
                <div className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                  {activePatient.demoCode} · {activePatient.age} yrs · {village?.name} ·{' '}
                  {cluster ? pickLocalized(cluster.name, language) : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSimulateAbnormal}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('lab_randomize')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              {(
                [
                  { key: 'systolicBP', label: t('lab_sys_bp'), step: '1', warn: parsedVitals.systolicBP >= 140 },
                  { key: 'diastolicBP', label: t('lab_dia_bp'), step: '1', warn: parsedVitals.diastolicBP >= 90 },
                  { key: 'heartRate', label: t('lab_hr'), step: '1', warn: parsedVitals.heartRate >= 100 },
                  { key: 'spo2', label: t('lab_spo2'), step: '1', warn: parsedVitals.spo2 <= 94 },
                  { key: 'glucoseMmol', label: t('lab_glucose'), step: '0.1', warn: parsedVitals.glucoseMmol >= 7.0 },
                  { key: 'hba1c', label: t('lab_hba1c'), step: '0.1', warn: parsedVitals.hba1c >= 6.5 },
                  { key: 'hemoglobin', label: t('lab_hgb'), step: '1', warn: parsedVitals.hemoglobin < 110 },
                  { key: 'crp', label: t('lab_crp'), step: '0.5', warn: parsedVitals.crp >= 10 },
                  { key: 'cholesterol', label: t('lab_chol'), step: '0.1', warn: parsedVitals.cholesterol >= 5.5 },
                ] as const
              ).map((field) => {
                const err = formErrors[field.key];
                return (
                  <div key={field.key}>
                    <label
                      htmlFor={`lab-${field.key}`}
                      className="block text-xs font-medium text-zinc-700 mb-1.5"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`lab-${field.key}`}
                      type="number"
                      step={field.step}
                      value={rawInputs[field.key]}
                      onChange={(e) => handleField(field.key, e.target.value)}
                      aria-invalid={Boolean(err)}
                      className={`w-full h-10 px-3 text-sm font-mono tabular-nums rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                        err
                          ? 'bg-red-50/60 border-red-500 text-red-950 font-semibold'
                          : field.warn
                            ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-semibold'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-950'
                      }`}
                    />
                    {err && <p className="text-[11px] text-red-600 mt-1">{err}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
            {savedNotice ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('lab_saved_notice')}</span>
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                Rapid Lab · {village?.rapidLabEquipped ? t('map_rapid_lab_yes') : t('map_rapid_lab_no')}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveModule('ai_radar')}
                className="px-3.5 py-2.5 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap"
              >
                {t('dash_open_radar')}
              </button>
              <button
                type="button"
                onClick={handleSaveLab}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap"
              >
                <FlaskConical className="w-4 h-4" />
                <span>{t('lab_run_analysis')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Lab Readout & Flags */}
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h2 className="text-base font-semibold text-zinc-950">{t('lab_flags')}</h2>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>

            <div
              className={`p-3.5 rounded-lg border text-sm font-medium flex items-start gap-2.5 ${
                liveAnalysis.summaryKey === 'lab_summary_urgent'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : liveAnalysis.summaryKey === 'lab_summary_attention'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {liveAnalysis.summaryKey === 'lab_summary_normal' ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{t(liveAnalysis.summaryKey)}</span>
            </div>

            {liveAnalysis.abnormalFlags.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">{t('lab_no_flags')}</div>
            ) : (
              <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-lg">
                {liveAnalysis.abnormalFlags.map((flag) => (
                  <div key={flag} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-zinc-950">{flag}</span>
                    <span className="text-amber-800 font-medium">{FLAG_LABELS[flag] ?? flag}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-200">
            <h3 className="text-xs font-semibold text-zinc-700 mb-2.5">{t('lab_recent_logs')}</h3>
            <div className="divide-y divide-zinc-100 max-h-52 overflow-y-auto">
              {visibleLogs.slice(0, 6).map((rec) => {
                const p = patients.find((pt) => pt.id === rec.patientId);
                const v = getVillage(rec.villageId);
                return (
                  <div key={rec.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-950 truncate">
                        {p?.fullName ?? rec.patientId}
                      </div>
                      <div className="text-zinc-500 font-mono tabular-nums text-[11px]">
                        {rec.id} · {v?.name} · {rec.timestamp}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums shrink-0">
                      {rec.abnormalFlags.length > 0 ? (
                        <span className="text-red-600 font-semibold">{rec.abnormalFlags.length} flags</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Normal</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
