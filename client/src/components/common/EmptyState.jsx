import React from "react";
import { Link } from "react-router-dom";
import Button from "./Button";

export default function EmptyState({ icon, title, description, action, actionLabel, actionTo }) {
  const resolvedAction =
    action ||
    (actionTo && actionLabel ? (
      <Link to={actionTo}>
        <Button icon={icon === "search_off" ? "search" : undefined}>{actionLabel}</Button>
      </Link>
    ) : null);

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-surface-low flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-text-muted text-[32px]" aria-hidden="true">
          {icon || "inbox"}
        </span>
      </div>
      <h3 className="font-headline-md text-headline-md text-text-primary mb-1">{title}</h3>
      {description ? (
        <p className="text-body-sm text-text-muted max-w-sm mb-6">{description}</p>
      ) : (
        <div className="mb-6" />
      )}
      {resolvedAction}
    </div>
  );
}
