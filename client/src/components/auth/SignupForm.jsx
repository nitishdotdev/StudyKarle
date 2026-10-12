import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../common/Input";
import Button from "../common/Button";
import GoogleButton, { AuthSeparator } from "./GoogleButton";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";

export default function SignupForm() {
  const { requestOtp, verifyOtp, resendOtp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = details, 2 = OTP
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(function (prev) {
      return Object.assign({}, prev, { [name]: value });
    });
  }

  function validateStep1() {
    const next = {};
    if (!form.name || form.name.trim().length < 2) {
      next.name = "Name must be at least 2 characters";
    }
    if (!form.email) {
      next.email = "Email is required";
    }
    if (!form.password || form.password.length < 8) {
      next.password = "Password must be at least 8 characters";
    } else if (!/\d/.test(form.password)) {
      next.password = "Password must contain at least one number";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateOtp() {
    const next = {};
    if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
      next.otp = "Enter a valid 6-digit code";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleRequestOtp(e) {
    e.preventDefault();
    if (!validateStep1()) return;

    setSubmitting(true);
    requestOtp(form)
      .then(function (data) {
        toast.success(data.message || "Verification code sent to your email");
        setStep(2);
        startResendTimer();
      })
      .catch(function (err) {
        toast.error(err.message || "Failed to send verification code");
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function handleVerifyOtp(e) {
    e.preventDefault();
    if (!validateOtp()) return;

    setSubmitting(true);
    verifyOtp({ email: form.email, otp: otp })
      .then(function (data) {
        toast.success("Account created. Welcome to StudyKarle!");
        navigate("/dashboard", { replace: true });
      })
      .catch(function (err) {
        toast.error(err.message || "Invalid or expired code");
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function handleResendOtp() {
    if (resendTimer > 0) return;

    setSubmitting(true);
    resendOtp({ email: form.email })
      .then(function (data) {
        toast.success(
          "New code sent. Remaining attempts: " + data.remainingAttempts
        );
        startResendTimer();
      })
      .catch(function (err) {
        toast.error(err.message || "Failed to resend code");
      })
      .finally(function () {
        setSubmitting(false);
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

  // Step 1: Collect name, email, password
  if (step === 1) {
    return (
      <div>
      <GoogleButton disabled={submitting} />
      <AuthSeparator />
      <form onSubmit={handleRequestOtp} className="space-y-4">
        <div>
          <Input
            label="Full Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter your name"
            error={errors.name}
            disabled={submitting}
          />
        </div>
        <div>
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            error={errors.email}
            disabled={submitting}
            autoComplete="email"
          />
        </div>
        <div>
          <Input
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="At least 8 characters with a number"
            error={errors.password}
            disabled={submitting}
          />
        </div>
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? "Sending code..." : "Continue"}
        </Button>
      </form>
      </div>
    );
  }

  // Step 2: Enter OTP
  return (
    <form onSubmit={handleVerifyOtp} className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-600">
          We sent a 6-digit code to <strong>{form.email}</strong>
        </p>
      </div>
      <div>
        <Input
          id="signup-otp"
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
      </div>
      <Button type="submit" loading={submitting} className="w-full">
        {submitting ? "Verifying..." : "Verify & Create Account"}
      </Button>
      <div className="text-center">
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={resendTimer > 0 || submitting}
          className="text-sm text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
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
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Use a different email
        </button>
      </div>
    </form>
  );
}
