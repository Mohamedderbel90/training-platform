"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import {
  buildAttendanceTasks,
  buildTasks,
  closedDaysRatio,
  completedCoursesRatio,
  daysForProgram,
  submittedSurveyRatio,
} from "@/lib/dashboard/derive";
import { LoadingState } from "@/components/StateViews";
import { ApiErrorView } from "@/components/ApiErrorView";
import { SurveyAvailabilityBadge } from "@/components/DayCard";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { StatCards } from "@/components/dashboard/StatCards";
import { UpcomingSessionCard } from "@/components/dashboard/UpcomingSessionCard";
import { TaskList } from "@/components/dashboard/TaskList";
import { QuickStatsBars } from "@/components/dashboard/QuickStatsBars";

function SupervisorDashboardContent() {
  const t = useTranslations("Dashboard");
  const { profile } = useAuth();
  const { data, status, error, reload } = useDashboardSummary("supervisor");

  const programDays = useMemo(
    () => daysForProgram(data?.days ?? [], data?.program?.id),
    [data],
  );
  const tasks = useMemo(
    () => [
      ...buildAttendanceTasks(
        programDays,
        (day) => `/supervisor/${day.training_day_id}/attendance`,
        "taskAttendanceRequired",
      ),
      ...buildTasks(
        programDays,
        (day) => day.survey,
        (day) => `/supervisor/${day.training_day_id}/survey`,
        "taskSupervisorSurveyRequired",
      ),
    ],
    [programDays],
  );

  if (status === "loading") {
    return <LoadingState label={t("loading")} />;
  }
  if (status === "error" && error) {
    return <ApiErrorView error={error} onRetry={reload} />;
  }

  const nextEntry = data?.next_session ?? null;

  return (
    <div className="dashboard">
      <WelcomeBanner name={profile?.name ?? ""} subtitleKey="welcomeSubtitleSupervisor" />
      <StatCards stats={data?.stats ?? null} />
      <div className="dashboard-grid">
        <UpcomingSessionCard
          entry={nextEntry}
          statusBadge={nextEntry ? <SurveyAvailabilityBadge availability={nextEntry.survey} /> : null}
          action={
            nextEntry ? (
              <>
                <Link
                  className="button button--secondary"
                  href={`/supervisor/${nextEntry.training_day_id}/attendance`}
                >
                  {t("manageAttendance")}
                </Link>
                <Link className="button" href={`/supervisor/${nextEntry.training_day_id}/survey`}>
                  {nextEntry.survey?.response?.state === "submitted"
                    ? t("viewSurvey")
                    : t("openSurvey")}
                </Link>
              </>
            ) : null
          }
        />
        <TaskList tasks={tasks} viewAllHref="/supervisor/days" />
      </div>
      <div className="dashboard-grid dashboard-grid--wide-first">
        <ProgramMessageNotice />
        <QuickStatsBars
          items={[
            {
              labelKey: "quickStatSurveys",
              ratio: submittedSurveyRatio(programDays, (day) => day.survey),
            },
            { labelKey: "quickStatDays", ratio: closedDaysRatio(programDays) },
            { labelKey: "quickStatCourses", ratio: completedCoursesRatio(programDays) },
          ]}
        />
      </div>
    </div>
  );
}

function ProgramMessageNotice() {
  const t = useTranslations("Dashboard");
  return (
    <section className="card dashboard-note-card">
      <p className="card__meta">{t("programMessageUnavailable")}</p>
    </section>
  );
}

export default function SupervisorDashboardPage() {
  return (
    <ProtectedRoute role="supervisor">
      <SupervisorDashboardContent />
    </ProtectedRoute>
  );
}
