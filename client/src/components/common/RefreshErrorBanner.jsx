import React from "react";
import Button from "./Button";

export default function RefreshErrorBanner({ message, onRetry }) {
  if (!message) {
    return null;
  }
  return (
    <div
      role="alert"
      className="mb-4 flex flex-col gap-3 rounded-lg border border-error/30 bg-error-container px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-body-sm text-text-primary">
        {message} Previously loaded content is still on screen.
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
