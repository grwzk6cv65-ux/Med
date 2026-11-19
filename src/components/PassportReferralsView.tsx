import { CalendarCheck, Check, FileBadge2, Hospital, Lock, Plus, QrCode, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useMedradar } from '../context/MedradarContext';
import { pickLocalized } from '../i18n/translations';
import { evaluatePatientRadar } from '../utils/aiRadarEngine';
import { buildRouteExplanation } from '../utils/routeExplainer';
import { validateReferralInput } from '../utils/validation';
import { RouteExplanationCard } from './RouteExplanationCard';
import { RiskStatusTag, WorkflowStatusTag } from './StatusIndicator';

export function PassportReferralsView() {
  const {
    t,
    language,
    role,
    clusters,
    patients,
    activePatientId,
    setActivePatientId,
    getVillage,
    getCluster,
    referrals,
    createSmartReferral,
    updateReferralStatus,
  } = useMedradar();

  const patient = patients.find((p) => p.id === activePatientId) ?? patients[0];
  const village = getVillage(patient.villageId);
  const cluster = getCluster(patient.clusterId);
  const radar = evaluatePatientRadar(patient, village?.distanceToHubKm ?? 35);

  const [showBooking, setShowBooking] = useState(false);
  const [specialty, setSpecialty] = useState(radar.recommendedSpecialty);
  const [scheduledDate, setScheduledDate] = useState('2026-11-23');
  const [timeSlot, setTimeSlot] = useState('10:30');
  const [patientPhone, setPatientPhone] = useState(patient.phone ?? '+7 701 555 0101');
  const [doctorNotes, setDoctorNotes] = useState(
    `AI Health Radar score ${radar.totalScore}/100 · ${t(radar.recommendedActionKey)}`
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setSpecialty(radar.recommendedSpecialty);
    setPatientPhone(patient.phone ?? '+7 701 555 0101');
    setDoctorNotes(`AI Health Radar score ${radar.totalScore}/100 · ${t(radar.recommendedActionKey)}`);
    setFormErrors({});
  }, [patient.id]);

  // Privacy scoping: Patient View shows only the active patient's referrals
  const visibleReferrals = useMemo(() => {
    return role === 'patient'
      ? referrals.filter((r) => r.patientId === patient.id)
      : referrals;
  }, [referrals, role, patient.id]);

  const routeExplanation = useMemo(() => {
    if (!village) return null;
    return buildRouteExplanation(village, clusters, specialty);
  }, [village, clusters, specialty]);

  const handleBookReferral = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateReferralInput(
      {
        specialty,
        scheduledDate,
        timeSlot,
        patientPhone,
        doctorNotes,
      },
      language
    );

    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setFormErrors({});
    createSmartReferral({
      patientId: patient.id,
      specialty,
      scheduledDate,
      timeSlot,
      patientPhone: patientPhone.trim(),
      doctorNotes: doctorNotes.trim(),
    });
    setShowBooking(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{t('pass_title')}</h1>
          <p className="mt-1 text-sm text-zinc-600 max-w-3xl">{t('pass_sub')}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {role === 'doctor' ? (
            <>
              <label
                htmlFor="passport-patient-select"
                className="text-xs font-medium text-zinc-500 whitespace-nowrap"
              >
                {t('lab_patient_select')}:
              </label>
              <select
                id="passport-patient-select"
                value={patient.id}
                onChange={(e) => {
                  setActivePatientId(e.target.value);
                  setFormErrors({});
                }}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Matte Black Digital Health Passport Card */}
        <div className="lg:col-span-5 bg-zinc-950 text-white border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-800">
              <div>
                <div className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                  <FileBadge2 className="w-3.5 h-3.5" />
                  <span>{t('pass_card_header')}</span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">{patient.fullName}</h2>
                <div className="text-xs text-zinc-400 mt-0.5 tabular-nums">
                  {patient.demoCode} · {patient.age} yrs · {patient.sex} · {village?.name} ({village?.distanceToHubKm} km)
                </div>
                {patient.phone && (
                  <div className="text-xs font-mono text-zinc-400 mt-0.5">{patient.phone}</div>
                )}
              </div>
              <RiskStatusTag level={radar.riskTier} />
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-zinc-400">{t('pass_blood_type')}</div>
                <div className="font-mono font-bold text-base text-white mt-0.5">{patient.bloodType}</div>
              </div>
              <div>
                <div className="text-zinc-400">{t('radar_score_label')}</div>
                <div className="font-mono font-bold text-base text-emerald-400 tabular-nums mt-0.5">
                  {radar.totalScore}/100
                </div>
              </div>
              <div>
                <div className="text-zinc-400">Last Lab</div>
                <div className="font-mono font-medium text-zinc-200 tabular-nums mt-1">{patient.lastLabDate}</div>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4 space-y-3 text-xs">
              <div>
                <div className="font-semibold text-zinc-300 mb-1">{t('pass_conditions')}</div>
                <div className="text-zinc-400">
                  {patient.chronicConditions.map((c) => pickLocalized(c, language)).join(' · ')}
                </div>
              </div>
              <div>
                <div className="font-semibold text-zinc-300 mb-1">{t('pass_allergies')}</div>
                <div className="text-zinc-400">
                  {patient.allergies.map((a) => pickLocalized(a, language)).join(' · ')}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <div className="text-xs font-semibold text-zinc-300 mb-2.5">{t('pass_latest_vitals')}</div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="text-[11px] font-sans text-zinc-400">BP</div>
                  <div className="font-semibold text-white">
                    {patient.vitals.systolicBP}/{patient.vitals.diastolicBP}
                  </div>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="text-[11px] font-sans text-zinc-400">SpO2</div>
                  <div className="font-semibold text-white">{patient.vitals.spo2}%</div>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="text-[11px] font-sans text-zinc-400">HbA1c</div>
                  <div className="font-semibold text-white">{patient.vitals.hba1c}%</div>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="text-[11px] font-sans text-zinc-400">Glucose</div>
                  <div className="font-semibold text-white">{patient.vitals.glucoseMmol}</div>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="text-[11px] font-sans text-zinc-400">Hgb</div>
                  <div className="font-semibold text-white">{patient.vitals.hemoglobin} g/L</div>
                </div>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <div className="text-[11px] font-sans text-zinc-400">CRP</div>
                  <div className="font-semibold text-white">{patient.vitals.crp} mg/L</div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <div className="text-xs font-semibold text-zinc-300 mb-2">{t('pass_vaccinations')}</div>
              <div className="divide-y divide-zinc-800 text-xs">
                {patient.vaccinations.map((v, idx) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between">
                    <span className="text-zinc-200">{pickLocalized(v.name, language)}</span>
                    <span className="font-mono tabular-nums text-zinc-400">
                      {v.date} ·{' '}
                      <span className={v.status === 'due' ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                        {v.status === 'due' ? t('status_due') : 'OK'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4 mt-5 flex items-center justify-between text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <QrCode className="w-4 h-4 text-emerald-400" />
              {patient.passportHash}
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('pass_qr_label')}
            </span>
          </div>
        </div>

        {/* Crisp White Smart Referrals & Route Explanation Panel */}
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-5 flex flex-col space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-200">
            <div>
              <h2 className="text-base font-semibold text-zinc-950">{t('ref_title')}</h2>
              <div className="text-xs text-zinc-500 mt-0.5">
                {cluster ? pickLocalized(cluster.hubHospital, language) : ''} · ~{village?.distanceToHubKm ?? 35} km
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBooking((s) => !s)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{t('ref_new_btn')}</span>
            </button>
          </div>

          {routeExplanation && <RouteExplanationCard explanation={routeExplanation} />}

          {showBooking && (
            <form
              onSubmit={handleBookReferral}
              noValidate
              className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ref-specialty" className="block text-xs font-medium text-zinc-700 mb-1">
                    {t('ref_specialty')}
                  </label>
                  <select
                    id="ref-specialty"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    aria-invalid={Boolean(formErrors.specialty)}
                    className={`w-full h-10 px-2.5 text-xs bg-white border rounded-lg ${
                      formErrors.specialty ? 'border-red-500' : 'border-zinc-200'
                    }`}
                  >
                    {(cluster?.specialists ?? ['Cardiology', 'Endocrinology', 'Pulmonology', 'General Practice']).map(
                      (sp) => (
                        <option key={sp} value={sp}>
                          {sp}
                        </option>
                      )
                    )}
                  </select>
                  {formErrors.specialty && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.specialty}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="ref-phone" className="block text-xs font-medium text-zinc-700 mb-1">
                    {t('ref_phone')}
                  </label>
                  <input
                    id="ref-phone"
                    type="tel"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder="+7 701 555 0101"
                    aria-invalid={Boolean(formErrors.patientPhone)}
                    className={`w-full h-10 px-3 text-xs font-mono bg-white border rounded-lg ${
                      formErrors.patientPhone ? 'border-red-500 bg-red-50/40' : 'border-zinc-200'
                    }`}
                  />
                  {formErrors.patientPhone && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.patientPhone}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="ref-date" className="block text-xs font-medium text-zinc-700 mb-1">
                    {t('ref_date')}
                  </label>
                  <input
                    id="ref-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    aria-invalid={Boolean(formErrors.scheduledDate)}
                    className={`w-full h-10 px-2.5 text-xs font-mono bg-white border rounded-lg ${
                      formErrors.scheduledDate ? 'border-red-500 bg-red-50/40' : 'border-zinc-200'
                    }`}
                  />
                  {formErrors.scheduledDate && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.scheduledDate}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="ref-slot" className="block text-xs font-medium text-zinc-700 mb-1">
                    {t('ref_slot')}
                  </label>
                  <select
                    id="ref-slot"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    aria-invalid={Boolean(formErrors.timeSlot)}
                    className={`w-full h-10 px-2.5 text-xs font-mono bg-white border rounded-lg ${
                      formErrors.timeSlot ? 'border-red-500' : 'border-zinc-200'
                    }`}
                  >
                    <option value="09:00">09:00</option>
                    <option value="10:30">10:30</option>
                    <option value="12:00">12:00</option>
                    <option value="14:30">14:30</option>
                    <option value="16:00">16:00</option>
                  </select>
                  {formErrors.timeSlot && (
                    <p className="text-[11px] text-red-600 mt-1">{formErrors.timeSlot}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="ref-notes" className="block text-xs font-medium text-zinc-700 mb-1">
                  {t('ref_notes')}
                </label>
                <input
                  id="ref-notes"
                  type="text"
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  aria-invalid={Boolean(formErrors.doctorNotes)}
                  className={`w-full h-10 px-3 text-xs bg-white border rounded-lg ${
                    formErrors.doctorNotes ? 'border-red-500 bg-red-50/40' : 'border-zinc-200'
                  }`}
                />
                {formErrors.doctorNotes && (
                  <p className="text-[11px] text-red-600 mt-1">{formErrors.doctorNotes}</p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {t('ref_submit')}
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-zinc-200">
            {visibleReferrals.map((ref) => {
              const p = patients.find((pt) => pt.id === ref.patientId);
              const isSelectedPatient = ref.patientId === patient.id;
              return (
                <div
                  key={ref.id}
                  className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelectedPatient ? 'bg-emerald-50/50 -mx-2 px-2 rounded-lg' : ''
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-zinc-500">{ref.id}</span>
                      <span className="font-semibold text-sm text-zinc-950">
                        {p?.fullName ?? ref.patientId}
                      </span>
                      <RiskStatusTag level={ref.urgency} />
                      <WorkflowStatusTag status={ref.status} />
                    </div>
                    <div className="text-xs text-zinc-600 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-medium text-zinc-900">
                        <Hospital className="w-3.5 h-3.5 text-emerald-600" />
                        {pickLocalized(ref.hospitalName, language)}
                      </span>
                      <span>·</span>
                      <span>{ref.specialty}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        {ref.scheduledDate} {ref.timeSlot}
                      </span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">~{ref.distanceKm} km</span>
                    </div>
                    <div className="text-xs text-zinc-500">{ref.doctorNotes}</div>
                  </div>

                  {role === 'doctor' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {ref.status === 'pending' || ref.status === 'overdue' ? (
                        <button
                          type="button"
                          onClick={() => updateReferralStatus(ref.id, 'confirmed')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <CalendarCheck className="w-3.5 h-3.5" />
                          <span>{t('ref_confirm')}</span>
                        </button>
                      ) : null}
                      {ref.status === 'confirmed' ? (
                        <button
                          type="button"
                          onClick={() => updateReferralStatus(ref.id, 'completed')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-emerald-400 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('ref_complete')}</span>
                        </button>
                      ) : null}
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
