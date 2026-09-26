"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
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
import { ApiErrorView } from "@/components/ApiErrorView";
import { SurveyStatusGroup } from "@/components/DayCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ProgramMessageCard } from "@/components/dashboard/ProgramMessageCard";
import { NoProgramState } from "@/components/dashboard/NoProgramState";
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
        5,
        "report",
      ),
    [programDays],
  );

  if (status === "loading") {
    return <DashboardSkeleton label={t("loading")} />;
  }
  if (status === "error" && error) {
    return <ApiErrorView error={error} onRetry={reload} />;
  }

  const nextEntry = data?.next_session ?? null;
  const hasDays = programDays.length > 0;
  const notAssigned = !data?.program && !hasDays && !nextEntry;

  return (
    <div className="dashboard">
      <WelcomeBanner name={profile?.name ?? ""} subtitleKey="welcomeSubtitleTrainer" />
      {notAssigned ? (
        <NoProgramState />
      ) : (
        <>
          <div className="dashboard-grid">
            <UpcomingSessionCard
              entry={nextEntry}
              hasDays={hasDays}
              surveyGroup={
                nextEntry ? (
                  <SurveyStatusGroup
                    kind="report"
                    availability={nextEntry.trainer_report}
                    dayStatus={nextEntry.state}
                    href={`/trainer/${nextEntry.training_day_id}`}
                  />
                ) : null
              }
            />
            <TaskList tasks={tasks} viewAllHref="/trainer/days" hasDays={hasDays} />
          </div>
          <StatCards
            stats={data?.stats ?? null}
            daysRatio={closedDaysRatio(programDays)}
            coursesRatio={completedCoursesRatio(programDays)}
          />
          <div className="dashboard-grid dashboard-grid--wide-first">
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
            <ProgramMessageCard />
          </div>
        </>
      )}
    </div>
  );
}

export default function TrainerDashboardPage() {
  return (
    <ProtectedRoute role="trainer">
      <TrainerDashboardContent />
    </ProtectedRoute>
  );
}
