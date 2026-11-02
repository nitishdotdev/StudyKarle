import React from "react";

const VARIANTS = {
  primary: "bg-primary text-white hover:bg-primary-container active:scale-[0.98]",
  secondary:
    "bg-white border border-border-subtle text-text-primary hover:bg-surface-low active:scale-[0.98]",
  danger: "bg-error text-white hover:opacity-90 active:scale-[0.98]",
  ghost: "text-text-secondary hover:bg-surface-low",
};

const SIZES = {
  sm: "px-4 py-2 text-body-sm min-h-[44px]",
  md: "px-6 py-2.5 text-label-md min-h-[44px]",
  lg: "px-8 py-3.5 text-label-md min-h-[48px]",
};

export default function Button({
  children,
  variant,
  size,
  icon,
  loading,
  disabled,
  type,
  className,
  onClick,
  fullWidth,
  ...rest
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <button
      type={type || "button"}
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      onClick={onClick}
      className={
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed " +
        variantClass +
        " " +
        sizeClass +
        (fullWidth ? " w-full" : "") +
        (className ? " " + className : "")
      }
      {...rest}
    >
      {loading ? (
        <span
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : icon ? (
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
