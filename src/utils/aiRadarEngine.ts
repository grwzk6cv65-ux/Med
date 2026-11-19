import { DemoPatient, PatientSymptoms, PatientVitals, RadarAssessment, RadarFactor, RiskLevel } from '../types/medradar';

export interface RadarSimulationInput {
  age: number;
  vitals: PatientVitals;
  symptoms: PatientSymptoms;
  distanceToHubKm: number;
  missedScreeningsCount: number;
}

/**
 * Transparent JavaScript Rule-Based Risk Assessment Simulation (AI HEALTH RADAR).
 * Runs 100% locally in the browser with deterministic clinical triage rules.
 * No external paid AI models or APIs are used.
 */
export function evaluateHealthRadar(input: RadarSimulationInput): RadarAssessment {
  const factors: RadarFactor[] = [];
  let score = 0;

  // Rule 1: Blood Pressure (Hypertensive crisis / Stage 2 / Stage 1)
  if (input.vitals.systolicBP >= 170 || input.vitals.diastolicBP >= 110) {
    const pts = 26;
    score += pts;
    factors.push({
      ruleId: 'R-BP-CRIT',
      labelKey: 'rule_bp_severe',
      observed: `${input.vitals.systolicBP}/${input.vitals.diastolicBP} mmHg`,
      threshold: '>= 170/110 mmHg',
      points: pts,
      severity: 'critical',
    });
  } else if (input.vitals.systolicBP >= 140 || input.vitals.diastolicBP >= 90) {
    const pts = 15;
    score += pts;
    factors.push({
      ruleId: 'R-BP-HIGH',
      labelKey: 'rule_bp_elevated',
      observed: `${input.vitals.systolicBP}/${input.vitals.diastolicBP} mmHg`,
      threshold: '>= 140/90 mmHg',
      points: pts,
      severity: 'high',
    });
  }

  // Rule 2: Glycemic control (HbA1c & fasting glucose)
  if (input.vitals.hba1c >= 8.5 || input.vitals.glucoseMmol >= 11.1) {
    const pts = 20;
    score += pts;
    factors.push({
      ruleId: 'R-GLY-HIGH',
      labelKey: 'rule_glycemic_critical',
      observed: `HbA1c ${input.vitals.hba1c.toFixed(1)}% · ${input.vitals.glucoseMmol.toFixed(1)} mmol/L`,
      threshold: 'HbA1c >= 8.5% or Glucose >= 11.1',
      points: pts,
      severity: 'high',
    });
  } else if (input.vitals.hba1c >= 6.5 || input.vitals.glucoseMmol >= 7.0) {
    const pts = 11;
    score += pts;
    factors.push({
      ruleId: 'R-GLY-MOD',
      labelKey: 'rule_glycemic_moderate',
      observed: `HbA1c ${input.vitals.hba1c.toFixed(1)}% · ${input.vitals.glucoseMmol.toFixed(1)} mmol/L`,
      threshold: 'HbA1c >= 6.5% or Glucose >= 7.0',
      points: pts,
      severity: 'moderate',
    });
  }

  // Rule 3: Oxygen saturation (SpO2)
  if (input.vitals.spo2 <= 90) {
    const pts = 24;
    score += pts;
    factors.push({
      ruleId: 'R-SPO2-CRIT',
      labelKey: 'rule_spo2_low',
      observed: `${input.vitals.spo2}%`,
      threshold: '<= 90%',
      points: pts,
      severity: 'critical',
    });
  } else if (input.vitals.spo2 <= 94) {
    const pts = 12;
    score += pts;
    factors.push({
      ruleId: 'R-SPO2-MOD',
      labelKey: 'rule_spo2_borderline',
      observed: `${input.vitals.spo2}%`,
      threshold: '<= 94%',
      points: pts,
      severity: 'moderate',
    });
  }

  // Rule 4: Inflammatory & Anemia markers (CRP / Hemoglobin)
  if (input.vitals.crp >= 15) {
    const pts = 10;
    score += pts;
    factors.push({
      ruleId: 'R-CRP',
      labelKey: 'rule_crp_elevated',
      observed: `${input.vitals.crp.toFixed(1)} mg/L`,
      threshold: '>= 15.0 mg/L',
      points: pts,
      severity: 'high',
    });
  }

  if (input.vitals.hemoglobin < 105) {
    const pts = 9;
    score += pts;
    factors.push({
      ruleId: 'R-HGB',
      labelKey: 'rule_anemia',
      observed: `${input.vitals.hemoglobin} g/L`,
      threshold: '< 105 g/L',
      points: pts,
      severity: 'moderate',
    });
  }

  // Rule 5: Red-flag symptoms
  const redFlags: string[] = [];
  if (input.symptoms.chestPain) redFlags.push('chestPain');
  if (input.symptoms.shortnessOfBreath) redFlags.push('shortnessOfBreath');
  if (input.symptoms.dizziness) redFlags.push('dizziness');
  if (input.symptoms.persistentCough) redFlags.push('persistentCough');

  if (redFlags.length >= 2 || input.symptoms.chestPain) {
    const pts = 16;
    score += pts;
    factors.push({
      ruleId: 'R-SYM-RED',
      labelKey: 'rule_symptoms_acute',
      observed: `${redFlags.length} active`,
      threshold: 'Chest pain or >= 2 acute symptoms',
      points: pts,
      severity: 'critical',
    });
  } else if (redFlags.length === 1 || input.symptoms.fatigue || input.symptoms.missedMedication) {
    const pts = 7;
    score += pts;
    factors.push({
      ruleId: 'R-SYM-MOD',
      labelKey: 'rule_symptoms_adherence',
      observed: input.symptoms.missedMedication ? 'Missed meds / mild symptoms' : 'Mild symptoms',
      threshold: 'Any symptom or missed therapy',
      points: pts,
      severity: 'moderate',
    });
  }

  // Rule 6: Rural access & screening continuity factor
  if (input.distanceToHubKm >= 40 && input.missedScreeningsCount >= 1) {
    const pts = 8;
    score += pts;
    factors.push({
      ruleId: 'R-ACCESS',
      labelKey: 'rule_rural_access_gap',
      observed: `${input.distanceToHubKm} km · ${input.missedScreeningsCount} missed`,
      threshold: '>= 40 km & >= 1 missed screening',
      points: pts,
      severity: 'moderate',
    });
  }

  // Rule 7: Age vulnerability modifier
  if (input.age >= 65) {
    const pts = 6;
    score += pts;
    factors.push({
      ruleId: 'R-AGE',
      labelKey: 'rule_age_senior',
      observed: `${input.age} yrs`,
      threshold: '>= 65 yrs',
      points: pts,
      severity: 'low',
    });
  }

  const totalScore = Math.min(100, Math.max(4, score));

  let riskTier: RiskLevel = 'low';
  if (totalScore >= 70) riskTier = 'critical';
  else if (totalScore >= 48) riskTier = 'high';
  else if (totalScore >= 24) riskTier = 'moderate';

  // Determine recommended specialty based on highest weighted domain
  let recommendedSpecialty = 'General Practice';
  if (input.vitals.systolicBP >= 140 || input.symptoms.chestPain) {
    recommendedSpecialty = 'Cardiology';
  } else if (input.vitals.spo2 <= 93 || input.symptoms.persistentCough) {
    recommendedSpecialty = 'Pulmonology';
  } else if (input.vitals.hba1c >= 6.5 || input.vitals.glucoseMmol >= 7.0) {
    recommendedSpecialty = 'Endocrinology';
  } else if (input.vitals.hemoglobin < 110) {
    recommendedSpecialty = 'Hematology / Therapy';
  }

  let recommendedActionKey = 'action_routine_preventive';
  if (riskTier === 'critical') recommendedActionKey = 'action_urgent_referral';
  else if (riskTier === 'high') recommendedActionKey = 'action_priority_medmobile';
  else if (riskTier === 'moderate') recommendedActionKey = 'action_telehealth_followup';

  return {
    totalScore,
    riskTier,
    recommendedSpecialty,
    recommendedActionKey,
    factors,
    isSimulation: true,
  };
}

export function evaluatePatientRadar(patient: DemoPatient, distanceToHubKm: number): RadarAssessment {
  return evaluateHealthRadar({
    age: patient.age,
    vitals: patient.vitals,
    symptoms: patient.symptoms,
    distanceToHubKm,
    missedScreeningsCount: patient.missedScreeningsCount,
  });
}

export function analyzeRapidLabVitals(vitals: PatientVitals): {
  abnormalFlags: string[];
  summaryKey: string;
} {
  const flags: string[] = [];
  if (vitals.systolicBP >= 140 || vitals.diastolicBP >= 90) flags.push('BP_HIGH');
  if (vitals.glucoseMmol >= 7.0) flags.push('GLUCOSE_HIGH');
  if (vitals.hba1c >= 6.5) flags.push('HBA1C_HIGH');
  if (vitals.spo2 <= 94) flags.push('SPO2_LOW');
  if (vitals.hemoglobin < 110) flags.push('HGB_LOW');
  if (vitals.crp >= 10) flags.push('CRP_HIGH');
  if (vitals.cholesterol >= 5.5) flags.push('CHOL_HIGH');

  let summaryKey = 'lab_summary_normal';
  if (flags.length >= 3 || vitals.systolicBP >= 170 || vitals.spo2 <= 90) {
    summaryKey = 'lab_summary_urgent';
  } else if (flags.length >= 1) {
    summaryKey = 'lab_summary_attention';
  }

  return { abnormalFlags: flags, summaryKey };
}
