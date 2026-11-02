import React from "react";
import Button from "./Button";
import useDelayedFlag from "../../hooks/useDelayedFlag";

export default function SlowLoadNotice({ active, onRetry, label }) {
  const show = useDelayedFlag(!!active, 4000);

  if (!show) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex flex-col gap-3 rounded-lg border border-border-subtle bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-body-sm text-text-secondary">
        {label || "This is taking longer than usual. You can wait or try again."}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
