"use client";

/**
 * Shared loading/empty/error presentational states (M5 point 3/9).
 * Every data-fetching page uses these instead of inventing its own
 * ad-hoc "Loading..."/error text, so behavior (and translation) stays
 * consistent across the app.
 */

import { AlertIcon, InboxIcon } from "@/components/icons";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="state-view state-view--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  return (
    <div className="state-view state-view--empty">
      <span className="state-view__icon">
        <InboxIcon />
      </span>
      <p className="state-view__title">{title}</p>
      {message ? <p className="state-view__message">{message}</p> : null}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  requestId,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  requestId?: string | null;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="state-view state-view--error" role="alert">
      <span className="state-view__icon">
        <AlertIcon />
      </span>
      <p className="state-view__title">{title}</p>
      <p className="state-view__message">{message}</p>
      {requestId ? (
        <p className="state-view__request-id">
          <code>{requestId}</code>
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" className="button button--secondary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
