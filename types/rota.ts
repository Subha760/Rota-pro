export type NormalizedShift =
  | "MORNING"
  | "EVENING"
  | "NIGHT"
  | "GENERAL_DAY"
  | "LONG_DAY"
  | "SPLIT"
  | "ON_CALL"
  | "OFF"
  | "GH"
  | "CL"
  | "SL"
  | "EL"
  | "COMP_OFF"
  | "MATERNITY"
  | "PATERNITY"
  | "ON_DUTY"
  | "CUSTOM";
export interface SplitSegment {
  start: string;
  end: string;
  title: string;
}
export interface ScheduleDay {
  day: number;
  day_of_week: string;
  raw_code: string;
  normalized_type: NormalizedShift;
  is_split_shift: boolean;
  split_segments?: SplitSegment[];
  confidence: number;
  is_ambiguous: boolean;
  modified?: boolean;
  previous_code?: string;
}
export interface RotaMetadata {
  detected_month: number;
  detected_year: number;
  staff_name: string;
  staff_id?: string;
  ward_unit?: string;
  total_days: number;
  timezone?: string;
}
export interface RotaExtractionResult {
  metadata: RotaMetadata;
  schedule: ScheduleDay[];
  warnings?: string[];
}
export interface RotaProfile {
  id: string;
  nurseId: string;
  staffName: string;
  staffId?: string;
  wardUnit?: string;
  timezone: string;
  reminderMinutes: number;
  includeLeave: boolean;
  includeOff: boolean;
  webcalToken?: string;
  syncSecret?: string;
}
export interface RotaRevision {
  key: string;
  nurseId: string;
  year: number;
  month: number;
  sequence: number;
  updatedAt: string;
  schedule: ScheduleDay[];
}
export interface DiffRecord {
  day: number;
  before?: ScheduleDay;
  after?: ScheduleDay;
  kind: "ADDED" | "CHANGED" | "CANCELLED" | "UNCHANGED";
}
export interface CalendarEventInput {
  day: ScheduleDay;
  metadata: RotaMetadata;
  nurseId: string;
  sequence: number;
  reminderMinutes?: number;
  cumulativeHours?: number;
  cancelled?: boolean;
}
export interface FeedRecord {
  token: string;
  profile: RotaProfile;
  revision: RotaRevision;
  previousSchedule?: ScheduleDay[];
  updatedAt: string;
}
