"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import {
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

function TrainerDashboardContent() {
  const t = useTranslations("Dashboard");
  const { profile } = useAuth();
  const { data, status, error, reload } = useDashboardSummary("trainer");

  const programDays = useMemo(
    () => daysForProgram(data?.days ?? [], data?.program?.id),
    [data],
  );
  const tasks = useMemo(
    () =>
      buildTasks(
        programDays,
        (day) => day.trainer_report,
        (day) => `/trainer/${day.training_day_id}`,
        "taskReportRequired",
      ),
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
      <WelcomeBanner name={profile?.name ?? ""} subtitleKey="welcomeSubtitleTrainer" />
      <StatCards stats={data?.stats ?? null} />
      <div className="dashboard-grid">
        <UpcomingSessionCard
          entry={nextEntry}
          statusBadge={
            nextEntry ? <SurveyAvailabilityBadge availability={nextEntry.trainer_report} /> : null
          }
          action={
            nextEntry ? (
              <Link className="button" href={`/trainer/${nextEntry.training_day_id}`}>
                {nextEntry.trainer_report?.response?.state === "submitted"
                  ? t("viewReport")
                  : t("openReport")}
              </Link>
            ) : null
          }
        />
        <TaskList tasks={tasks} viewAllHref="/trainer/days" />
      </div>
      <div className="dashboard-grid dashboard-grid--wide-first">
        <ProgramMessageNotice />
        <QuickStatsBars
          items={[
            {
              labelKey: "quickStatReports",
              ratio: submittedSurveyRatio(programDays, (day) => day.trainer_report),
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

export default function TrainerDashboardPage() {
  return (
    <ProtectedRoute role="trainer">
      <TrainerDashboardContent />
    </ProtectedRoute>
  );
}
