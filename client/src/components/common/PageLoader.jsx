import React from "react";

export default function PageLoader({ label }) {
  return (
    <div className="flex items-center justify-center min-h-[40vh]" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-9 w-9 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="text-body-sm text-text-secondary">{label || "Loading StudyKarle"}</p>
      </div>
    </div>
  );
}
