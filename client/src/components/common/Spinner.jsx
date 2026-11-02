import React from "react";

export default function Spinner({ size, className, label }) {
  const dimension = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-5 h-5" : "w-7 h-7";
  return (
    <div className={"flex flex-col items-center justify-center gap-3 py-10 " + (className || "")} role="status">
      <span
        className={
          dimension +
          " border-[3px] border-primary/20 border-t-primary rounded-full animate-spin motion-reduce:animate-none"
        }
        aria-hidden="true"
      />
      {label ? <p className="text-body-sm text-text-muted">{label}</p> : null}
      <span className="sr-only">{label || "Loading"}</span>
    </div>
  );
}
