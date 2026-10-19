import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import PageLoader from "../components/common/PageLoader";
import useAuth from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
import * as authApi from "../api/authApi";
import { consumeOAuthHash, clearOAuthTicket } from "../utils/oauthTicket";

function Icon({ name, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined leading-none ${className}`}
      style={{ fontVariationSettings: "'FILL' 1" }}
    >
      {name}
    </span>
  );
}

function safeRedirect(path) {
  if (
    typeof path === "string" &&
    path.charAt(0) === "/" &&
    path.indexOf("//") !== 0 &&
    path.indexOf("://") === -1
  ) {
    return path;
  }
  return "/dashboard";
}

export default function GoogleLinkPage() {
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const startedRef = useRef(false);
  const [ticket, setTicket] = useState(null);
  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);

  // Capture the one-time ticket from the URL fragment, then immediately
  // strip it from the address bar / browser history so it cannot be
  // replayed from history or leaked via referrer.
  useEffect(
    function () {
      if (startedRef.current) {
        return;
      }
      startedRef.current = true;

      const captured = consumeOAuthHash().ticket;
      if (!captured) {
        clearOAuthTicket();
        toast.error("This Google linking link is invalid or has expired.");
        navigate("/login", { replace: true });
        return;
      }
      setTicket(captured);

      authApi
        .googleLinkInfo({ ticket: captured })
        .then(function (data) {
          setInfo(data);
        })
        .catch(function (err) {
          setLoadError(
            (err && err.message) ||
              "This Google linking request is invalid or has expired."
          );
        })
        .finally(function () {
          setLoadingInfo(false);
        });
    },
    // Intentionally run once on mount: the ticket is captured and stripped from
    // the URL a single time, then exchanged for the server-bound challenge.
    []
  );

  function completeLogin(result) {
    clearOAuthTicket();
    setUser(result.user);
    toast.success("Google account connected. You're signed in.");
    navigate(safeRedirect(result.redirect), { replace: true });
  }

  function handleSubmitPassword(e) {
    e.preventDefault();
    if (submitting) return;
    if (!password) {
      setFormError("Enter your existing StudyKarle password.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    authApi
      .googleLinkVerify({ ticket: ticket, password: password })
      .then(function (result) {
        completeLogin(result);
      })
      .catch(function (err) {
        setFormError(
          (err && err.message) || "Could not connect your account. Please try again."
        );
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function handleRequestRecovery(e) {
    e.preventDefault();
    if (recoverySubmitting) return;
    setRecoveryError(null);
    setRecoverySubmitting(true);
    authApi
      .googleLinkRecoveryRequest({ ticket: ticket })
      .then(function (data) {
        setOtpSent(true);
        startResendTimer();
        toast.success(
          "Verification code sent to " + (data.email || "your email")
        );
      })
      .catch(function (err) {
        setRecoveryError(
          (err && err.message) ||
            "Could not send a verification code. Please try again."
        );
      })
      .finally(function () {
        setRecoverySubmitting(false);
      });
  }

  function handleVerifyRecovery(e) {
    e.preventDefault();
    if (recoverySubmitting) return;
    if (!otp || otp.length !== 6) {
      setRecoveryError("Enter the 6-digit code from your email.");
      return;
    }
    setRecoveryError(null);
    setRecoverySubmitting(true);
    authApi
      .googleLinkRecoveryVerify({ ticket: ticket, otp: otp })
      .then(function (result) {
        completeLogin(result);
      })
      .catch(function (err) {
        setRecoveryError(
          (err && err.message) || "Invalid or expired verification code."
        );
      })
      .finally(function () {
        setRecoverySubmitting(false);
      });
  }

  function startResendTimer() {
    setResendTimer(60);
    const interval = setInterval(function () {
      setResendTimer(function (prev) {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const busy = submitting || recoverySubmitting;
  const email = (info && info.email) || "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-text-primary">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="flex min-h-screen items-center justify-center p-4 py-10 sm:p-6">
        <main className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-border-subtle bg-white p-6 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] sm:p-10">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon name="school" className="text-[22px]" />
            </span>
            <span className="text-headline-md font-semibold tracking-tight text-primary">
              StudyKarle
            </span>
          </Link>

          {loadingInfo ? (
            <PageLoader label="Checking your Google account..." />
          ) : loadError ? (
            <div role="alert" className="text-center">
              <h2 className="font-headline-lg text-headline-lg text-text-primary">
                Linking unavailable
              </h2>
              <p className="mt-3 text-body-sm text-text-secondary">{loadError}</p>
              <Button
                type="button"
                fullWidth
                className="mt-6"
                onClick={function () {
                  clearOAuthTicket();
                  navigate("/login", { replace: true });
                }}
              >
                Back to login
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-6 text-center">
                <h2 className="font-headline-lg text-headline-lg text-text-primary">
                  Connect your Google account
                </h2>
                <p className="mt-2 text-body-sm text-text-secondary">
                  An account already exists for{" "}
                  <strong className="text-text-primary">
                    {email || "this email"}
                  </strong>
                  .{" "}
                  {info && info.hasPassword
                    ? "Enter your existing StudyKarle password to connect Google and sign in."
                    : "Verify your email to connect Google and sign in."}
                </p>
              </div>

              {info && info.hasPassword ? (
                <form onSubmit={handleSubmitPassword} noValidate>
                  <div className="mb-2">
                    <label
                      htmlFor="link-password"
                      className="font-label-md text-label-md text-text-primary"
                    >
                      StudyKarle password
                    </label>
                  </div>
                  <div className="relative">
                    <Input
                      id="link-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      icon="lock"
                      placeholder="Enter your StudyKarle password"
                      value={password}
                      onChange={function (e) {
                        setPassword(e.target.value);
                      }}
                      error={formError || undefined}
                      autoComplete="current-password"
                      disabled={busy}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-[13px] text-text-muted hover:text-text-primary"
                      onClick={function () {
                        setShowPassword(!showPassword);
                      }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>

                  <p className="mt-2 text-body-sm text-text-muted">
                    We never ask for your Google password.
                  </p>

                  <Button
                    type="submit"
                    fullWidth
                    loading={submitting}
                    className="mt-5"
                  >
                    Connect Google and sign in
                  </Button>

                  <p className="mt-4 text-center text-body-sm text-text-muted">
                    Forgot your password?{" "}
                    <Link
                      to="/forgot-password"
                      className="font-semibold text-primary hover:underline"
                    >
                      Reset it
                    </Link>
                  </p>
                </form>
              ) : (
                <div>
                  {!otpSent ? (
                    <form onSubmit={handleRequestRecovery}>
                      <p className="mb-4 text-body-sm text-text-secondary">
                        This account was created with Google and has no password.
                        We'll email you a one-time code to confirm it's yours.
                      </p>
                      <Button
                        type="submit"
                        fullWidth
                        loading={recoverySubmitting}
                      >
                        Send verification code
                      </Button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyRecovery} noValidate>
                      <p className="mb-3 text-body-sm text-text-secondary">
                        We sent a 6-digit code to{" "}
                        <strong className="text-text-primary">{email}</strong>.
                      </p>
                      <Input
                        id="link-otp"
                        label="Verification code"
                        name="otp"
                        value={otp}
                        onChange={function (e) {
                          setOtp(
                            String(e.target.value || "")
                              .replace(/\D/g, "")
                              .slice(0, 6)
                          );
                        }}
                        placeholder="000000"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        error={recoveryError || undefined}
                        disabled={busy}
                        autoFocus
                      />
                      <Button
                        type="submit"
                        fullWidth
                        loading={recoverySubmitting}
                        className="mt-5"
                      >
                        Verify and sign in
                      </Button>
                      <div className="mt-4 text-center">
                        <button
                          type="button"
                          onClick={handleRequestRecovery}
                          disabled={resendTimer > 0 || busy}
                          className="text-body-sm font-semibold text-primary hover:underline disabled:text-text-muted disabled:no-underline"
                        >
                          {resendTimer > 0
                            ? "Resend code in " + resendTimer + "s"
                            : "Resend code"}
                        </button>
                      </div>
                    </form>
                  )}

                  {recoveryError && !otpSent ? (
                    <p role="alert" className="mt-3 text-body-sm text-error">
                      {recoveryError}
                    </p>
                  ) : null}
                </div>
              )}

              <div className="mt-6 border-t border-border-subtle pt-5 text-center">
                <button
                  type="button"
                  onClick={function () {
                    clearOAuthTicket();
                    navigate("/login", { replace: true });
                  }}
                  disabled={busy}
                  className="text-body-sm font-semibold text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  Cancel and return to login
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-2 text-text-muted opacity-70">
            <Icon name="verified_user" className="text-[16px]" />
            <span className="text-label-sm">
              Nothing is linked until you confirm
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
