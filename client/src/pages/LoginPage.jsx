import React, { useEffect } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import LoginForm from "../components/auth/LoginForm";
import useAuth from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
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

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(function () {
    const error = searchParams.get("error");
    if (error) {
      toast.error(error);
      searchParams.delete("error");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

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
            <div
              aria-hidden="true"
              className="absolute right-0 top-0 h-64 w-64 -translate-y-1/3 translate-x-1/3 rounded-full bg-primary/10 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-0 h-56 w-56 -translate-x-1/3 translate-y-1/3 rounded-full bg-secondary/10 blur-3xl"
            />

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
                Welcome back!
              </h2>
              <p className="mt-4 max-w-sm text-body-md leading-relaxed text-text-secondary">
                Log in to continue
              </p>

              <div className="mt-8 flex flex-col items-center">
                <img
                  src={LoginImage}
                  alt="Book catalogue illustration"
                  className="max-h-[260px] w-full max-w-[360px] object-contain drop-shadow-[0_16px_30px_rgba(15,23,42,0.12)]"
                />

                <p className="mt-6 max-w-[320px] text-center text-body-sm italic leading-relaxed text-text-muted">
                  "The beautiful thing about learning is that no one can take it
                  away from you."
                </p>
              </div>
            </div>
          </section>

          <section className="flex w-full flex-col justify-center p-6 sm:p-10 md:w-1/2">
            <div className="mx-auto w-full max-w-md">
              <a href="/">
                <div className="mb-8 flex items-center justify-center gap-2.5 md:hidden">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon name="school" className="text-[22px]" />
                  </span>
                  <span className="text-headline-md font-semibold tracking-tight text-primary">
                    StudyKarle
                  </span>
                </div>
              </a>

              <div className="mb-7">
                <h2 className="font-headline-lg text-headline-lg text-text-primary">
                  Log in to your account
                </h2>
                <p className="mt-2 text-body-sm text-text-secondary">
                  Enter your details to continue to your dashboard.
                </p>
              </div>

              <LoginForm />

              <p className="mt-8 text-center text-body-sm text-text-muted">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-primary hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
