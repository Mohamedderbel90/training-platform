"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDashboardSummary } from "@/lib/dashboard/useDashboardSummary";
import {
  buildAttendanceTasks,
  prioritizeTasks,
  buildTasks,
  closedDaysRatio,
  completedCoursesRatio,
  daysForProgram,
  submittedSurveyRatio,
} from "@/lib/dashboard/derive";
import { ApiErrorView } from "@/components/ApiErrorView";
import { AttendanceStatusGroup, SurveyStatusGroup } from "@/components/DayCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ProgramMessageCard } from "@/components/dashboard/ProgramMessageCard";
import { NoProgramState } from "@/components/dashboard/NoProgramState";
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
    () =>
      prioritizeTasks([
        ...buildAttendanceTasks(
          programDays,
          (day) => `/supervisor/${day.training_day_id}/attendance`,
          "taskAttendanceRequired",
          Infinity,
        ),
        ...buildTasks(
          programDays,
          (day) => day.survey,
          (day) => `/supervisor/${day.training_day_id}/survey`,
          "taskSupervisorSurveyRequired",
          Infinity,
        ),
      ]),
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
      <WelcomeBanner name={profile?.name ?? ""} subtitleKey="welcomeSubtitleSupervisor" />
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
                  <>
                    <AttendanceStatusGroup
                      attendance={nextEntry.attendance}
                      dayStatus={nextEntry.state}
                      href={`/supervisor/${nextEntry.training_day_id}/attendance`}
                      primary={nextEntry.state === "open" && !nextEntry.attendance?.complete}
                    />
                    <SurveyStatusGroup
                      availability={nextEntry.survey}
                      dayStatus={nextEntry.state}
                      dateFields={nextEntry}
                      timeZone={profile?.tz}
                      kind="evaluation"
                      href={`/supervisor/${nextEntry.training_day_id}/survey`}
                    />
                  </>
                ) : null
              }
            />
            <TaskList tasks={tasks} viewAllHref="/supervisor/days" hasDays={hasDays} />
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
                  labelKey: "quickStatSurveys",
                  ratio: submittedSurveyRatio(programDays, (day) => day.survey),
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

export default function SupervisorDashboardPage() {
  return (
    <ProtectedRoute role="supervisor">
      <SupervisorDashboardContent />
    </ProtectedRoute>
  );
}
