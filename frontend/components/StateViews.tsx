"use client";

/**
 * Shared loading/empty/error presentational states (M5 point 3/9).
 * Every data-fetching page uses these instead of inventing its own
 * ad-hoc "Loading..."/error text, so behavior (and translation) stays
 * consistent across the app.
 */

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertIcon, InboxIcon, SearchIcon } from "@/components/icons";
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

/** Calm, neutral "nothing here" state. `search` and `filtered` variants
 * supply their own wording; `action` (e.g. a Clear button) is rendered
 * only when the caller passes one. */
export function EmptyState({
  title,
  message,
  variant = "default",
  query,
  action,
}: {
  title?: string;
  message?: string;
  variant?: "default" | "search" | "filtered";
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
        {variant === "default" ? <InboxIcon /> : <SearchIcon />}
      </span>
      {heading ? <p className="state-view__title">{heading}</p> : null}
      {body ? <p className="state-view__message">{body}</p> : null}
      {action ? <div className="state-view__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  requestId,
  actionLabel,
  onAction,
  action,
}: {
  title: string;
  message: string;
  requestId?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  /** Custom action (e.g. a sign-in link); shown instead of the retry button. */
  action?: ReactNode;
}) {
  const t = useTranslations("Errors");
  return (
    <div className="state-view state-view--error" role="alert">
      <span className="state-view__icon">
        <AlertIcon />
      </span>
      <p className="state-view__title">{title}</p>
      <p className="state-view__message">{message}</p>
      {requestId ? (
        <p className="state-view__request-id">
          <span>{t("reference")}: </span>
          <code>{requestId}</code>
        </p>
      ) : null}
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
