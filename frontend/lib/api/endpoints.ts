/**
 * One typed function per Operational API endpoint (M4/ADR-005 section
 * 10). No page/component builds a request path or body by hand --
 * everything goes through these, which in turn go through the single
 * `apiFetch()` envelope/error handler. Keeping this list 1:1 with the
 * addon's controllers/*.py also makes it easy to see at a glance that
 * no admin/CRUD/workflow endpoint is ever called from here.
 */
import { apiFetch } from "./client";
import type {
  AttendanceListResponseDto,
  AttendanceStatus,
  DashboardResponseDto,
  OperationalProfile,
  OperationalRole,
  SurveyAnswerDto,
  SurveyAvailabilityDto,
  SurveyDefinitionDto,
  SurveyStatusDto,
  TrainerReportDto,
} from "./types";

export interface AttendanceUpsertItem {
  trainee_id: number;
  status: AttendanceStatus;
  late_minutes?: number;
}

export const authApi = {
  login: (login: string, password: string, locale: string) =>
    apiFetch<OperationalProfile>("/auth/login", {
      method: "POST",
      body: { login, password },
      locale,
    }),
  logout: (locale: string) =>
    apiFetch<{ logged_out: boolean }>("/auth/logout", { method: "POST", locale }),
  me: (locale: string) => apiFetch<OperationalProfile>("/auth/me", { locale }),
};

export const dashboardApi = {
  get: (role: OperationalRole, locale: string) =>
    apiFetch<DashboardResponseDto>(`/dashboard/${role}`, { locale }),
};

export const traineeApi = {
  getSurvey: (dayId: number, locale: string) =>
    apiFetch<SurveyDefinitionDto>(`/training-days/${dayId}/my-survey`, { locale }),
  getSurveyStatus: (dayId: number, locale: string) =>
    apiFetch<SurveyAvailabilityDto>(`/training-days/${dayId}/my-survey/status`, {
      locale,
    }),
  submitSurvey: (dayId: number, answers: SurveyAnswerDto[], locale: string) =>
    apiFetch<SurveyStatusDto>(`/training-days/${dayId}/my-survey/submit`, {
      method: "POST",
      body: { answers },
      locale,
    }),
};

export const supervisorApi = {
  getAttendance: (dayId: number, locale: string) =>
    apiFetch<AttendanceListResponseDto>(`/training-days/${dayId}/attendance`, {
      locale,
    }),
  putAttendance: (dayId: number, items: AttendanceUpsertItem[], locale: string) =>
    apiFetch<AttendanceListResponseDto>(`/training-days/${dayId}/attendance`, {
      method: "PUT",
      body: { items },
      locale,
    }),
  getSurvey: (dayId: number, locale: string) =>
    apiFetch<SurveyDefinitionDto>(`/training-days/${dayId}/supervisor-survey`, {
      locale,
    }),
  getSurveyStatus: (dayId: number, locale: string) =>
    apiFetch<SurveyAvailabilityDto>(
      `/training-days/${dayId}/supervisor-survey/status`,
      { locale },
    ),
  submitSurvey: (dayId: number, answers: SurveyAnswerDto[], locale: string) =>
    apiFetch<SurveyStatusDto>(
      `/training-days/${dayId}/supervisor-survey/submit`,
      { method: "POST", body: { answers }, locale },
    ),
};

export const trainerApi = {
  getReport: (dayId: number, locale: string) =>
    apiFetch<TrainerReportDto>(`/training-days/${dayId}/trainer-report`, {
      locale,
    }),
  saveDraft: (dayId: number, answers: SurveyAnswerDto[], locale: string) =>
    apiFetch<SurveyStatusDto>(`/training-days/${dayId}/trainer-report/draft`, {
      method: "PUT",
      body: { answers },
      locale,
    }),
  submitReport: (dayId: number, answers: SurveyAnswerDto[], locale: string) =>
    apiFetch<SurveyStatusDto>(`/training-days/${dayId}/trainer-report/submit`, {
      method: "POST",
      body: { answers },
      locale,
    }),
};
