import React from "react";
import useNetworkStatus from "../../hooks/useNetworkStatus";

export default function OfflineBanner() {
  const { offline } = useNetworkStatus();

  if (!offline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] border-b border-border-subtle bg-surface-low px-4 py-2.5 text-center"
    >
      <p className="text-body-sm text-text-primary">
        <span className="font-semibold">You're offline.</span>{" "}
        Saved notes on this device stay listed. New pages, search, PDFs, and downloads still need a connection.
      </p>
    </div>
  );
}
