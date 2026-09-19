/**
 * Typed DTOs mirroring the Operational API's serializers exactly
 * (custom_addons/training_management/models/{training_day,survey_*}.py
 * `_get_*_dto()` methods; see docs/adr/ADR-005-operational-api-authentication.md
 * section 11 for the documented field-name mappings). This file is the
 * single place that knows the shape of API responses -- no component
 * should re-declare or guess a DTO shape.
 */

export type OperationalRole = "trainee" | "supervisor" | "trainer";

export interface OperationalProfile {
  id: number;
  partner_id: number;
  name: string;
  locale: string;
  roles: OperationalRole[];
  capabilities: string[];
}

export type ResponseState = "not_started" | "in_progress" | "submitted";

export interface SurveyStatusDto {
  response_id: number;
  state: ResponseState;
  submitted_at: string | null;
  editable: boolean;
}

/** Non-raising availability wrapper returned by dashboards and the
 * `.../status` endpoints -- distinct from SurveyStatusDto itself. */
export interface SurveyAvailabilityDto {
  configured: boolean;
  response: SurveyStatusDto | null;
  can_submit: boolean;
  reason: string | null;
}

export type QuestionType =
  | "simple_choice"
  | "multiple_choice"
  | "char_box"
  | "text_box"
  | "numerical_box"
  | "scale";

export interface SurveyOptionDto {
  id: number;
  label: string;
}

export interface SurveyQuestionDto {
  question_id: number;
  title: string;
  question_type: QuestionType;
  required: boolean;
  kpi_category: string | null;
  options: SurveyOptionDto[] | null;
}

export interface SurveySectionDto {
  id: number;
  title: string | null;
  questions: SurveyQuestionDto[];
}

export interface SurveyDefinitionDto {
  survey_id: number;
  title: string;
  version_no: number;
  sections: SurveySectionDto[];
}

/** Shape accepted by submit/draft endpoints AND returned by
 * `_get_answers_dto()` for resuming a draft -- one entry per answered
 * question. Exactly one of the value fields is set, depending on the
 * question's type. */
export interface SurveyAnswerDto {
  question_id: number;
  answer_option_id?: number;
  answer_option_ids?: number[];
  text?: string;
  value?: number;
}

export interface TrainerReportDto {
  definition: SurveyDefinitionDto;
  status: SurveyAvailabilityDto;
  answers: SurveyAnswerDto[] | null;
}

export type AttendanceStatus = "present" | "absent" | "late";

export interface AttendanceItemDto {
  trainee_id: number; // training.enrollment id, NOT res.partner id
  name: string;
  status: AttendanceStatus | null;
  late_minutes: number | null;
}

export interface AttendanceSummaryDto {
  recorded_count: number;
  total_enrolled: number;
  complete: boolean;
}

export type TrainingDayState =
  | "planned"
  | "open"
  | "closed"
  | "postponed"
  | "cancelled";

export interface DashboardEntryDto {
  training_day_id: number;
  date: string | null;
  course_name: string;
  program_name: string;
  state: TrainingDayState;
  survey_open_at: string | null;
  survey_close_at: string | null;
  // Role-specific (see training_day.py `_build_dashboard_entry`):
  survey?: SurveyAvailabilityDto; // trainee, supervisor
  attendance?: AttendanceSummaryDto; // supervisor only
  trainer_report?: SurveyAvailabilityDto; // trainer only
}

export interface DashboardResponseDto {
  days: DashboardEntryDto[];
}

export interface AttendanceListResponseDto {
  items: AttendanceItemDto[];
}
