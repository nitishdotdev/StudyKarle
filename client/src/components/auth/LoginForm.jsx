import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Input from "../common/Input";
import Button from "../common/Button";
import GoogleButton, { AuthSeparator } from "./GoogleButton";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";

export default function LoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo =
    (location.state && location.state.from && location.state.from.pathname) ||
    "/dashboard";

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(function (prev) {
      return Object.assign({}, prev, { [name]: value });
    });
  }

  function validate() {
    const next = {};
    if (!form.email) {
      next.email = "Email is required";
    }
    if (!form.password) {
      next.password = "Password is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) {
      return;
    }
    setSubmitting(true);
    login(form)
      .then(function () {
        toast.success("Welcome back!");
        navigate(redirectTo, { replace: true });
      })
      .catch(function (err) {
        toast.error(err.message);
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
          error={errors.email}
          autoComplete="email"
          required
        />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="password"
              className="font-label-md text-label-md text-text-primary"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-label-sm font-semibold text-primary hover:underline"
            >
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
              error={errors.password}
              autoComplete="current-password"
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
        </div>
        <Button type="submit" fullWidth loading={submitting}>
          Login
        </Button>
      </form>
    </div>
  );
}
