"use client";

/**
 * Shared loading/empty/error presentational states (M5 point 3/9).
 * Every data-fetching page uses these instead of inventing its own
 * ad-hoc "Loading..."/error text, so behavior (and translation) stays
 * consistent across the app.
 */

import type { ReactNode } from "react";

type HeadingLevel = 1 | 2 | 3 | 4;

/** State titles are real headings (h2 by default: pages own the h1) that
 * keep the shared visual class. Level 1 is for the standalone screens
 * where the state is the whole page and nothing else supplies an h1. */
function StateTitle({ level = 2, children }: { level?: HeadingLevel; children: ReactNode }) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  return <Tag className="state-view__title">{children}</Tag>;
}
import { useTranslations } from "next-intl";
import { AlertIcon, CheckIcon, InboxIcon, SearchIcon } from "@/components/icons";
import { SkeletonCard } from "@/components/Skeleton";

export function LoadingState({
  label,
  variant = "spinner",
  count = 3,
}: {
  label: string;
  variant?: "spinner" | "skeleton";
  /** Number of placeholder cards for the skeleton variant. */
  count?: number;
}) {
  if (variant === "skeleton") {
    return (
      <div className="state-view--skeleton" role="status" aria-busy="true">
        <span className="visually-hidden">{label}</span>
        <div className="card-list" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="state-view state-view--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

/** Suspense fallback for list pages whose content suspends on the URL
 * search params: the same skeleton the content shows while loading, so
 * there is no blank frame. */
export function ListPageFallback() {
  const t = useTranslations("Dashboard");
  return <LoadingState label={t("loading")} variant="skeleton" count={4} />;
}

/** Calm, neutral "nothing here" state. `positive` is the "all done"
 * variant (check icon, success tint, no dashed border) for an empty list
 * that is good news, not a gap. `search` and `filtered` variants
 * supply their own wording; `action` (e.g. a Clear button) is rendered
 * only when the caller passes one. */
export function EmptyState({
  title,
  message,
  variant = "default",
  query,
  action,
  headingLevel,
}: {
  /** Semantic level of the title (default 2). */
  headingLevel?: HeadingLevel;
  title?: string;
  message?: string;
  variant?: "default" | "search" | "filtered" | "positive";
  /** The search text, shown in the `search` variant title. */
  query?: string;
  action?: ReactNode;
}) {
  const t = useTranslations("Ui");
  let heading = title;
  let body = message;
  if (variant === "search") {
    heading = title ?? (query ? t("noResultsFor", { query }) : t("noResults"));
    body = message ?? t("noResultsHint");
  } else if (variant === "filtered") {
    heading = title ?? t("noFilterMatch");
    body = message ?? t("noFilterMatchHint");
  }
  return (
    <div className={`state-view state-view--empty state-view--empty-${variant}`}>
      <span className="state-view__icon">
        {variant === "default" ? (
          <InboxIcon />
        ) : variant === "positive" ? (
          <CheckIcon />
        ) : (
          <SearchIcon />
        )}
      </span>
      {heading ? <StateTitle level={headingLevel}>{heading}</StateTitle> : null}
      {body ? <p className="state-view__message">{body}</p> : null}
      {action ? <div className="state-view__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  actionLabel,
  onAction,
  action,
  headingLevel,
}: {
  headingLevel?: HeadingLevel;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Custom action (e.g. a sign-in link); shown instead of the retry button. */
  action?: ReactNode;
}) {
  return (
    <div className="state-view state-view--error" role="alert">
      <span className="state-view__icon">
        <AlertIcon />
      </span>
      <StateTitle level={headingLevel}>{title}</StateTitle>
      <p className="state-view__message">{message}</p>
      {action ? (
        <div className="state-view__action">{action}</div>
      ) : actionLabel && onAction ? (
        <button type="button" className="button button--secondary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
