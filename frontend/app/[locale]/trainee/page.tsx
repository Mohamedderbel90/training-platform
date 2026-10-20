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
import { ClockIcon } from "@/components/icons";

function TraineeDashboardContent() {
  const t = useTranslations("Dashboard");
  const { profile } = useAuth();
  const { data, status, error, reload } = useDashboardSummary("trainee");

  const programDays = useMemo(
    () => daysForProgram(data?.days ?? [], data?.program?.id),
    [data],
  );
  const tasks = useMemo(
    () =>
      buildTasks(
        programDays,
        (day) => day.survey,
        (day) => `/trainee/${day.training_day_id}`,
        "taskSurveyRequired",
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
      <WelcomeBanner name={profile?.name ?? ""} subtitleKey="welcomeSubtitleTrainee" />
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
                    availability={nextEntry.survey}
                    dayStatus={nextEntry.state}
                    dateFields={nextEntry}
                    timeZone={profile?.tz}
                    href={`/trainee/${nextEntry.training_day_id}`}
                  />
                ) : null
              }
              action={
                nextEntry ? (
                  <Link className="button button--secondary" href="/trainee/days">
                    {t("viewDetails")}
                  </Link>
                ) : null
              }
            />
            <TaskList tasks={tasks} viewAllHref="/trainee/days" hasDays={hasDays} />
          </div>
          <StatCards
            stats={data?.stats ?? null}
            daysRatio={closedDaysRatio(programDays)}
            coursesRatio={completedCoursesRatio(programDays)}
          />
          <div className="dashboard-grid dashboard-grid--three">
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
            <RecentActivityCard />
          </div>
        </>
      )}
    </div>
  );
}

/** No activity-log/notifications model exists in the backend yet
 * either (same limitation as the header's notification bell) -- an
 * honest "not available" state rather than fabricated demo entries. */
function RecentActivityCard() {
  const t = useTranslations("Dashboard");
  return (
    <section className="card dashboard-note-card" aria-labelledby="dash-activity-title">
      <h2 className="card__title card__title--with-icon" id="dash-activity-title">
        <ClockIcon aria-hidden="true" /> {t("recentActivityTitle")}
      </h2>
      <p className="card__meta">{t("recentActivityUnavailable")}</p>
    </section>
  );
}

export default function TraineeDashboardPage() {
  return (
    <ProtectedRoute role="trainee">
      <TraineeDashboardContent />
    </ProtectedRoute>
  );
}
