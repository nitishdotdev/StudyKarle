import React, { useState } from "react";
import { API_URL } from "../../api/axiosClient";

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.96-2.184l-2.908-2.258c-.806.54-1.837.86-3.052.86-2.347 0-4.335-1.585-5.043-3.71H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.957 10.708c-.18-.54-.282-1.117-.282-1.708s.102-1.168.282-1.708V4.96H.957C.348 6.175 0 7.55 0 9s.348 2.825.957 4.04l3-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.957 7.29C4.665 5.165 6.653 3.58 9 3.58z"
      />
    </svg>
  );
}

export default function GoogleButton({ disabled, redirectTo }) {
  const [starting, setStarting] = useState(false);

  function handleClick() {
    if (disabled || starting) {
      return;
    }
    setStarting(true);
    const base = API_URL.replace(/\/$/, "");
    const target = redirectTo
      ? base + "/auth/google?redirect=" + encodeURIComponent(redirectTo)
      : base + "/auth/google";
    window.location.assign(target);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || starting}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border-subtle bg-white px-6 py-2.5 text-label-md font-semibold text-text-primary transition-all duration-150 hover:bg-surface-low active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {starting ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        <GoogleIcon />
      )}
      Continue with Google
    </button>
  );
}

export function AuthSeparator() {
  return (
    <div className="my-5 flex items-center gap-3" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-border-subtle" />
      <span className="text-label-sm uppercase tracking-wider text-text-muted">
        or
      </span>
      <span className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}
