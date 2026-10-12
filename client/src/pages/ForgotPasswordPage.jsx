import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import useAuth from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
import * as authApi from "../api/authApi";
import LoginImage from "../assets/illustrations/login.png";

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

export default function ForgotPasswordPage() {
  const { isAuthenticated, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
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

  function handleRequest(e) {
    e.preventDefault();
    const next = {};
    if (!email) {
      next.email = "Email is required";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    authApi
      .requestPasswordReset({ email: email })
      .then(function (data) {
        toast.success(data.message || "If an eligible account exists, a reset code has been sent.");
        setStep(2);
        startResendTimer();
      })
      .catch(function (err) {
        toast.error(err.message || "Unable to send reset code");
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function handleVerify(e) {
    e.preventDefault();
    const next = {};
    if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
      next.otp = "Enter a valid 6-digit code";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    authApi
      .verifyPasswordResetOtp({ email: email, otp: otp })
      .then(function (data) {
        setResetToken(data.resetToken);
        toast.success(data.message || "Code verified. Set a new password.");
        setStep(3);
      })
      .catch(function (err) {
        toast.error(err.message || "Invalid or expired code");
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function handleResend() {
    if (resendTimer > 0 || submitting) return;
    setSubmitting(true);
    authApi
      .resendPasswordReset({ email: email })
      .then(function (data) {
        toast.success(data.message || "If an eligible account exists, a new code has been sent.");
        startResendTimer();
      })
      .catch(function (err) {
        toast.error(err.message || "Failed to resend code");
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function handleReset(e) {
    e.preventDefault();
    const next = {};
    if (!password || password.length < 8) {
      next.password = "Password must be at least 8 characters";
    } else if (!/\d/.test(password)) {
      next.password = "Password must contain at least one number";
    }
    if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    authApi
      .resetPassword({
        resetToken: resetToken,
        password: password,
        confirmPassword: confirmPassword,
      })
      .then(function (data) {
        toast.success(data.message || "Password updated. You can now log in.");
        setStep(4);
      })
      .catch(function (err) {
        toast.error(err.message || "Unable to update password");
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function renderStep() {
    if (step === 1) {
      return (
        <form onSubmit={handleRequest} className="space-y-4" noValidate>
          <Input
            id="email"
            label="Email"
            name="email"
            type="email"
            icon="mail"
            value={email}
            onChange={function (e) {
              setEmail(e.target.value);
            }}
            placeholder="you@example.com"
            error={errors.email}
            disabled={submitting}
            autoComplete="email"
            required
          />
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Sending code..." : "Send reset code"}
          </Button>
        </form>
      );
    }

    if (step === 2) {
      return (
        <form onSubmit={handleVerify} className="space-y-4" noValidate>
          <p className="text-center text-sm text-text-secondary">
            If an eligible account exists for <strong>{email}</strong>, a 6-digit
            code was sent.
          </p>
          <Input
            id="otp"
            label="Verification Code"
            name="otp"
            value={otp}
            onChange={function (e) {
              setOtp(String(e.target.value || "").replace(/\D/g, "").slice(0, 6));
            }}
            onPaste={function (e) {
              const text =
                (e.clipboardData && e.clipboardData.getData("text")) || "";
              const digits = String(text).replace(/\D/g, "").slice(0, 6);
              if (digits) {
                e.preventDefault();
                setOtp(digits);
              }
            }}
            placeholder="000000"
            maxLength={6}
            error={errors.otp}
            disabled={submitting}
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            pattern="[0-9]*"
          />
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Verifying..." : "Verify code"}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || submitting}
              className="text-sm text-primary hover:underline disabled:text-text-muted"
            >
              {resendTimer > 0
                ? "Resend code in " + resendTimer + "s"
                : "Resend code"}
            </button>
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={function () {
                setStep(1);
                setOtp("");
                setErrors({});
              }}
              className="text-sm text-text-muted hover:text-text-primary"
            >
              Use a different email
            </button>
          </div>
        </form>
      );
    }

    if (step === 3) {
      return (
        <form onSubmit={handleReset} className="space-y-4" noValidate>
          <div className="relative">
            <Input
              id="password"
              label="New password"
              name="password"
              type={showPassword ? "text" : "password"}
              icon="lock"
              value={password}
              onChange={function (e) {
                setPassword(e.target.value);
              }}
              placeholder="At least 8 characters with a number"
              error={errors.password}
              disabled={submitting}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-[38px] text-text-muted hover:text-text-primary"
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
          <div className="relative">
            <Input
              id="confirmPassword"
              label="Confirm password"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              icon="lock"
              value={confirmPassword}
              onChange={function (e) {
                setConfirmPassword(e.target.value);
              }}
              placeholder="Re-enter your new password"
              error={errors.confirmPassword}
              disabled={submitting}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-[38px] text-text-muted hover:text-text-primary"
              onClick={function () {
                setShowConfirm(!showConfirm);
              }}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {showConfirm ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Updating..." : "Set new password"}
          </Button>
        </form>
      );
    }

    return (
      <div className="space-y-4 text-center">
        <p className="text-body-sm text-text-secondary">
          Your password has been updated. You can now log in with your new
          password.
        </p>
        <Button
          type="button"
          className="w-full"
          onClick={function () {
            navigate("/login", { replace: true });
          }}
        >
          Back to login
        </Button>
      </div>
    );
  }

  const titles = {
    1: "Forgot your password?",
    2: "Enter the reset code",
    3: "Set a new password",
    4: "Password updated",
  };
  const subtitles = {
    1: "Enter the email for your account and we will send a reset code if it is eligible.",
    2: "Check your inbox for a 6-digit code.",
    3: "Choose a strong password with at least 8 characters and one number.",
    4: "You can now sign in with your new password.",
  };

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
        <main className="flex min-h-[600px] w-full max-w-[1000px] flex-col overflow-hidden rounded-[1.75rem] border border-border-subtle bg-white shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] md:flex-row">
          <section className="relative hidden flex-col justify-between overflow-hidden bg-surface-container-low p-10 md:flex md:w-1/2">
            <div className="relative z-10">
              <Link to="/" className="mb-10 inline-flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon name="school" className="text-[22px]" />
                </span>
                <span className="text-headline-md font-semibold tracking-tight text-primary">
                  StudyKarle
                </span>
              </Link>
              <h2 className="font-headline-xl text-headline-xl leading-tight text-text-primary">
                Reset your password
              </h2>
              <p className="mt-4 max-w-sm text-body-md leading-relaxed text-text-secondary">
                We will email a one-time code, then let you choose a new
                password.
              </p>
              <div className="mt-8 flex flex-col items-center">
                <img
                  src={LoginImage}
                  alt="Book catalogue illustration"
                  className="max-h-[260px] w-full max-w-[360px] object-contain drop-shadow-[0_16px_30px_rgba(15,23,42,0.12)]"
                />
              </div>
            </div>
          </section>

          <section className="flex w-full flex-col justify-center p-6 sm:p-10 md:w-1/2">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 flex items-center justify-center gap-2.5 md:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon name="school" className="text-[22px]" />
                </span>
                <span className="text-headline-md font-semibold tracking-tight text-primary">
                  StudyKarle
                </span>
              </div>

              <div className="mb-7">
                <h2 className="font-headline-lg text-headline-lg text-text-primary">
                  {titles[step]}
                </h2>
                <p className="mt-2 text-body-sm text-text-secondary">
                  {subtitles[step]}
                </p>
              </div>

              {renderStep()}

              <p className="mt-8 text-center text-body-sm text-text-muted">
                Remembered your password?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-primary hover:underline"
                >
                  Log in
                </Link>
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
