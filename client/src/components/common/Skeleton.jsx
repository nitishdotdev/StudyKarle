import React from "react";

function pulseClass() {
  return "bg-surface-high rounded motion-safe:animate-pulse";
}

export function SkeletonCard() {
  return (
    <div className="bg-white p-6 rounded-xl border border-border-subtle" aria-hidden="true">
      <div className={"w-12 h-12 rounded-lg mb-4 " + pulseClass()} />
      <div className={"h-5 w-3/4 mb-2 " + pulseClass()} />
      <div className={"h-4 w-1/2 " + pulseClass()} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="bg-white p-4 rounded-xl border border-border-subtle flex items-center gap-4" aria-hidden="true">
      <div className={"w-12 h-12 rounded-lg shrink-0 " + pulseClass()} />
      <div className="flex-1 space-y-2">
        <div className={"h-4 w-2/3 " + pulseClass()} />
        <div className={"h-3 w-1/3 " + pulseClass()} />
      </div>
    </div>
  );
}

export default function Skeleton({ type, count, label }) {
  const items = Array.from({ length: count || 3 });
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label || "Loading content"}</span>
      {items.map(function (_, i) {
        return type === "card" ? <SkeletonCard key={i} /> : <SkeletonRow key={i} />;
      })}
    </div>
  );
}
