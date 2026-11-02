import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Input from "../common/Input";
import Button from "../common/Button";
import GoogleButton, { AuthSeparator } from "./GoogleButton";
import useAuth from "../../hooks/useAuth";
import useDraft from "../../hooks/useDraft";
import { useToast } from "../../context/ToastContext";
import { firstInvalidField, focusField, mergeServerFieldErrors, validateLogin } from "../../utils/formValidation";
import { clearReturnTo, isSafeReturnPath, readReturnTo } from "../../utils/sessionReturn";

export default function LoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const draft = useDraft("login", { email: form.email }, setForm);

  const from = location.state && location.state.from;
  const fromPath = from ? (from.pathname || "") + (from.search || "") : "";
  const storedReturn = readReturnTo();
  const redirectTo =
    (isSafeReturnPath(fromPath) && fromPath) || storedReturn || "/dashboard";

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
    const next = validateLogin(form);
    if (next[e.target.name]) {
      setErrors(function (prev) {
        return Object.assign({}, prev, { [e.target.name]: next[e.target.name] });
      });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const next = validateLogin(form);
    setErrors(next);
    if (Object.keys(next).length) {
      focusField(firstInvalidField(next));
      return;
    }
    setSubmitting(true);
    login(form)
      .then(function () {
        draft.discard();
        clearReturnTo();
        toast.success("Welcome back!");
        navigate(redirectTo, { replace: true });
      })
      .catch(function (err) {
        const merged = mergeServerFieldErrors(next, err);
        if (Object.keys(merged).length > Object.keys(next).length) {
          setErrors(merged);
          focusField(firstInvalidField(merged));
        } else {
          toast.error(err.message || "Couldn't sign in. Check your email and password.");
        }
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  return (
    <div>
      <GoogleButton disabled={submitting} redirectTo={redirectTo} />
      <AuthSeparator />
      <form className="space-y-stack-md" onSubmit={handleSubmit} noValidate>
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          icon="mail"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.email}
          autoComplete="email"
          required
        />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="password" className="font-label-md text-label-md text-text-primary">
              Password
            </label>
            <Link to="/forgot-password" className="text-label-sm font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              icon="lock"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.password}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-[13px] min-w-[44px] min-h-[44px] text-text-muted hover:text-text-primary"
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
        </div>
        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? "Signing in..." : "Login"}
        </Button>
      </form>
    </div>
  );
}
