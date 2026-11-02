import React from "react";

export default function Input({ label, id, error, icon, className, required, ...rest }) {
  const describedBy = error ? id + "-error" : undefined;
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="block font-label-md text-label-md text-text-primary mb-2">
          {label}
          {required ? (
            <span className="text-error"> *</span>
          ) : null}
        </label>
      ) : null}
      <div className="relative">
        {icon ? (
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[20px]"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={
            "w-full min-h-[44px] py-2.5 bg-white border rounded-lg outline-none transition-all font-body-md text-body-md text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary/20 focus:border-primary " +
            (icon ? "pl-10 pr-4" : "px-4") +
            (error ? " border-error" : " border-border-subtle")
          }
          {...rest}
        />
      </div>
      {error ? (
        <p id={id + "-error"} className="mt-1.5 text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
