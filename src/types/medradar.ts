export type Language = 'en' | 'ru' | 'kk';

export type UserRole = 'doctor' | 'patient';

export type ModuleId =
  | 'dashboard'
  | 'map'
  | 'rapid_lab'
  | 'ai_radar'
  | 'medmobile'
  | 'passport_referrals'
  | 'care_loop'
  | 'analytics'
  | 'support'
  | 'profile';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export type HealthConcern =
  | 'cardiovascular'
  | 'diabetes'
  | 'respiratory'
  | 'maternal'
  | 'preventive';

export interface LocalizedText {
  en: string;
  ru: string;
  kk: string;
}

export interface MedicalCluster {
  id: string;
  name: LocalizedText;
  region: LocalizedText;
  hubHospital: LocalizedText;
  lat: number;
  lng: number;
  capacityStatus: 'optimal' | 'busy' | 'strained';
  medMobileUnit: string;
  leadPhysician: string;
  availableBeds: number;
  specialists: string[];
}

export interface Village {
  id: string;
  name: string;
  clusterId: string;
  lat: number;
  lng: number;
  population: number;
  distanceToHubKm: number;
  riskIndex: number;
  riskLevel: RiskLevel;
  rapidLabEquipped: boolean;
  lastMedMobileVisit: string;
  nextMedMobileVisit: string;
  activePatientsCount: number;
  screenedLast30d: number;
  dominantConcern: HealthConcern;
}

export interface PatientVitals {
  systolicBP: number;
  diastolicBP: number;
  heartRate: number;
  spo2: number;
  glucoseMmol: number;
  hba1c: number;
  hemoglobin: number;
  crp: number;
  cholesterol: number;
  bmi: number;
  temperature: number;
}

export interface PatientSymptoms {
  chestPain: boolean;
  shortnessOfBreath: boolean;
  dizziness: boolean;
  persistentCough: boolean;
  fatigue: boolean;
  missedMedication: boolean;
}

export interface VaccinationRecord {
  name: LocalizedText;
  date: string;
  status: 'up_to_date' | 'due';
}

export type JourneyStepStatus = 'completed' | 'in_progress' | 'waiting' | 'upcoming';

export interface JourneyStep {
  stage: number; // 0..7 (8 clinical & care stages)
  date: string;
  status: JourneyStepStatus;
  note: LocalizedText;
  actor: string;
  completed: boolean;
}

export interface DemoPatient {
  id: string;
  demoCode: string;
  fullName: string;
  phone?: string;
  age: number;
  sex: 'M' | 'F';
  villageId: string;
  clusterId: string;
  bloodType: string;
  chronicConditions: LocalizedText[];
  allergies: LocalizedText[];
  vaccinations: VaccinationRecord[];
  vitals: PatientVitals;
  symptoms: PatientSymptoms;
  missedScreeningsCount: number;
  lastLabDate: string;
  journeyStage: number; // 0 to 7
  journeyHistory: JourneyStep[];
  passportHash: string;
}

export interface RapidLabRecord {
  id: string;
  patientId: string;
  villageId: string;
  timestamp: string;
  vitals: PatientVitals;
  abnormalFlags: string[];
  summaryKey: string;
  performedBy: string;
}

export interface MedMobileStop {
  id: string;
  unitId: string;
  clusterId: string;
  villageId: string;
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  timeWindow: string;
  specialtyFocus: 'cardiology' | 'diagnostics' | 'maternal' | 'endocrinology' | 'general';
  teamLead: string;
  bookedSlots: number;
  maxSlots: number;
  status: 'scheduled' | 'en_route' | 'completed' | 'delayed';
}

export interface SmartReferral {
  id: string;
  patientId: string;
  clusterId: string;
  hospitalName: LocalizedText;
  specialty: string;
  scheduledDate: string;
  timeSlot: string;
  urgency: RiskLevel;
  distanceKm: number;
  status: 'pending' | 'confirmed' | 'completed' | 'overdue';
  loopClosed: boolean;
  doctorNotes: string;
  patientPhone?: string;
  createdAt: string;
}

export type ReminderCategory =
  | 'appointment'
  | 'examination'
  | 'lab_result'
  | 'follow_up'
  | 'personal_task';

export interface PreventiveReminder {
  id: string;
  patientId: string;
  title: LocalizedText;
  category: ReminderCategory;
  dueDate: string;
  dueTime?: string;
  linkedReferralId?: string;
  status: 'due' | 'completed' | 'snoozed';
  priority: 'routine' | 'priority';
}

export interface AppNotification {
  id: string;
  dedupKey: string;
  patientId?: string;
  title: LocalizedText;
  message: LocalizedText;
  category: 'appointment' | 'reminder' | 'lab' | 'system';
  module?: ModuleId;
  createdAt: string;
  read: boolean;
}

export type TextSizeSetting = 'normal' | 'large' | 'xlarge';

export interface AccessibilitySettings {
  textSize: TextSizeSetting;
  highContrast: boolean;
  browserNotificationsEnabled: boolean;
  offlineDemoMode: boolean;
}

export interface PendingSyncItem {
  id: string;
  action: string;
  createdAt: string;
}

export interface RouteExplanation {
  primaryCluster: MedicalCluster;
  alternativeCluster: MedicalCluster | null;
  primaryDistanceKm: number;
  alternativeDistanceKm: number | null;
  estimatedTimeMin: number;
  estimatedSavedMin: number | null;
  isClosest: boolean;
  hasRequiredService: boolean;
  requiredSpecialty: string;
  isEstimateNotice: true;
}

export interface RadarFactor {
  ruleId: string;
  labelKey: string;
  observed: string;
  threshold: string;
  points: number;
  severity: RiskLevel;
}

export interface RadarAssessment {
  totalScore: number;
  riskTier: RiskLevel;
  recommendedSpecialty: string;
  recommendedActionKey: string;
  factors: RadarFactor[];
  isSimulation: true;
}

export type DoctorVerificationStatus =
  | 'none'
  | 'unverified'
  | 'pending'
  | 'approved'
  | 'rejected';

export interface DoctorVerificationRecord {
  id: string;
  userId: string;
  userEmail?: string;
  userPhone?: string;
  fullName: string;
  specialty: string;
  institutionName: string;
  licenseNumber: string;
  issuingRegion: string;
  issueDate: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  age: number | null;
  phoneE164: string;
  countryCode?: string;
  localPhone?: string;
  villageName: string;
  email: string;
  accountRole: UserRole;
  doctorVerificationStatus: DoctorVerificationStatus;
  doctorRejectionReason?: string;
  doctorVerifiedAt?: string;
  isSupportAdmin: boolean;
  profileCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SupportTicketStatus = 'New' | 'In Progress' | 'Resolved';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string | null;
  submittedByName: string;
  phoneNumber: string;
  replyEmail: string;
  subject: string;
  message: string;
  pageFeature: string;
  status: SupportTicketStatus;
  emailDelivery: {
    sent: boolean;
    configured: boolean;
    recipient: string;
    sentAt?: string;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ServerConfigStatus {
  smsConfigured: boolean;
  smsProvider: 'twilio_verify' | 'twilio_sms' | 'none';
  missingSmsVars: string[];
  emailConfigured: boolean;
  supportEmailPlaceholder: boolean;
  supportEmailPreview: string;
  missingEmailVars: string[];
  supportTeamPasscodeConfigured: boolean;
  adminConfigured: boolean;
}



