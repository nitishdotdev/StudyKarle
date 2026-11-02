import React from "react";
import { Link } from "react-router-dom";
import Button from "./Button";
import { describeRequestError } from "../../utils/uiState";
import { getBrowserOnline } from "../../utils/networkStatus";

export default function ErrorState({
  title,
  message,
  onRetry,
  onBack,
  error,
  errorStatus,
  preserveHint,
}) {
  const described = describeRequestError(
    error || { status: errorStatus || 0, message: message },
    { online: getBrowserOnline() }
  );
  const heading = title || described.title;
  const body = message || described.message;
  const canRetry = onRetry && described.canRetry !== false;
  const actionTo = described.actionTo;
  const actionLabel = described.actionLabel;

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4" role="alert">
      <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-error text-[32px]" aria-hidden="true">
          {described.kind === "offline" ? "wifi_off" : "error"}
        </span>
      </div>
      <h3 className="font-headline-md text-headline-md text-text-primary mb-1">{heading}</h3>
      <p className="text-body-sm text-text-muted max-w-sm mb-2">{body}</p>
      {preserveHint ? (
        <p className="text-body-sm text-text-secondary max-w-sm mb-6">{preserveHint}</p>
      ) : (
        <div className="mb-6" />
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {canRetry ? (
          <Button variant="secondary" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {actionTo ? (
          <Link to={actionTo}>
            <Button>{actionLabel || "Continue"}</Button>
          </Link>
        ) : null}
        {onBack ? (
          <Button variant="ghost" icon="arrow_back" onClick={onBack}>
            Go back
          </Button>
        ) : null}
        <Link to="/contact" className="text-body-sm font-semibold text-primary hover:underline">
          Contact support
        </Link>
      </div>
    </div>
  );
}
