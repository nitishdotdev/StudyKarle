import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../common/Input";
import Button from "../common/Button";
import GoogleButton, { AuthSeparator } from "./GoogleButton";
import useAuth from "../../hooks/useAuth";
import useDraft from "../../hooks/useDraft";
import { useToast } from "../../context/ToastContext";
import { firstInvalidField, focusField, mergeServerFieldErrors, validateSignup } from "../../utils/formValidation";

export default function SignupForm() {
  const { requestOtp, verifyOtp, resendOtp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const draft = useDraft("signup", { name: form.name, email: form.email }, setForm);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(function (prev) {
      return Object.assign({}, prev, { [name]: value });
    });
    if (errors[name]) {
      setErrors(function (prev) {
        const next = Object.assign({}, prev);
        delete next[name];
        return next;
      });
    }
  }

  function handleBlur(e) {
    const next = validateSignup(form);
    if (next[e.target.name]) {
      setErrors(function (prev) {
        return Object.assign({}, prev, { [e.target.name]: next[e.target.name] });
      });
    }
  }

  function handleRequestOtp(e) {
    e.preventDefault();
    const next = validateSignup(form);
    setErrors(next);
    if (Object.keys(next).length) {
      focusField(firstInvalidField(next));
      return;
    }

    setSubmitting(true);
    requestOtp(form)
      .then(function (data) {
        toast.success(data.message || "Verification code sent to your email");
        setStep(2);
        startResendTimer();
      })
      .catch(function (err) {
        const merged = mergeServerFieldErrors(next, err);
        if (Object.keys(merged).length > Object.keys(next).length) {
          setErrors(merged);
          focusField(firstInvalidField(merged));
        } else {
          toast.error(err.message || "Failed to send verification code");
        }
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function handleVerifyOtp(e) {
    e.preventDefault();
    const next = {};
    if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
      next.otp = "Enter the 6-digit code from your email";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      focusField("signup-otp");
      return;
    }

    setSubmitting(true);
    verifyOtp({ email: form.email, otp: otp })
      .then(function () {
        draft.discard();
        toast.success("Account created. Welcome to StudyKarle!");
        navigate("/dashboard", { replace: true });
      })
      .catch(function (err) {
        setErrors({ otp: err.message || "Invalid or expired code" });
        focusField("signup-otp");
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
        toast.success("New code sent. Remaining attempts: " + data.remainingAttempts);
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

  if (step === 1) {
    return (
      <div>
        <GoogleButton disabled={submitting} />
        <AuthSeparator />
        <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
          <Input
            id="name"
            label="Full Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter your name"
            error={errors.name}
            disabled={submitting}
            required
          />
          <Input
            id="email"
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="you@example.com"
            error={errors.email}
            disabled={submitting}
            autoComplete="email"
            required
          />
          <Input
            id="password"
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="At least 8 characters with a number"
            error={errors.password}
            disabled={submitting}
            autoComplete="new-password"
            required
          />
          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Sending code..." : "Continue"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
      <div className="text-center mb-4">
        <p className="text-sm text-gray-600">
          We sent a 6-digit code to <strong>{form.email}</strong>
        </p>
      </div>
      <Input
        id="signup-otp"
        label="Verification Code"
        name="otp"
        value={otp}
        onChange={function (e) {
          setOtp(String(e.target.value || "").replace(/\D/g, "").slice(0, 6));
        }}
        onPaste={function (e) {
          const text = (e.clipboardData && e.clipboardData.getData("text")) || "";
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
        required
      />
      <Button type="submit" loading={submitting} className="w-full">
        {submitting ? "Verifying..." : "Verify & Create Account"}
      </Button>
      <div className="text-center">
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={resendTimer > 0 || submitting}
          className="text-sm text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 min-h-[44px]"
        >
          {resendTimer > 0 ? "Resend code in " + resendTimer + "s" : "Resend code"}
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
          className="text-sm text-gray-500 hover:text-gray-700 min-h-[44px]"
        >
          Use a different email
        </button>
      </div>
    </form>
  );
}
