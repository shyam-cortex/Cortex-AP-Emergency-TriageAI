export enum ESILevel {
  LEVEL_1 = 1, // Resuscitation (Immediate)
  LEVEL_2 = 2, // Emergent (High Risk/Pain/Confusion)
  LEVEL_3 = 3, // Urgent (2+ Resources)
  LEVEL_4 = 4, // Less Urgent (1 Resource)
  LEVEL_5 = 5  // Non-Urgent (No Resources)
}

export interface VitalSigns {
  hr?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  rr?: number;
  o2?: number;
  temp?: number;
  painScale?: number; // 0-10
}

export interface Patient {
  id: string;
  name?: string;
  age?: number;
  gender?: string;
  chiefComplaint: string;
  triageLevel: ESILevel;
  rationale: string;
  vitals?: VitalSigns;
  arrivalTime: Date;
  status: 'Waiting' | 'In-Room' | 'Discharged';
}

export interface TriageResult {
  patientName?: string;
  triageLevel: ESILevel;
  rationale: string;
  summary: string;
  recommendedResources: string[];
  extractedVitals?: VitalSigns;
}

export type ViewState = 'DASHBOARD' | 'NEW_TRIAGE' | 'DETAILS';