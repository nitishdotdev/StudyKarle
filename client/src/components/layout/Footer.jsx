import React from "react";
import { Link } from "react-router-dom";
import { SOCIAL_LINKS, SOCIAL_REL } from "../../utils/socialLinks";

function Icon({ name, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined leading-none ${className}`}
    >
      {name}
    </span>
  );
}

function FooterLink({ to, children, external = false }) {
  const baseClass =
    "text-body-sm text-text-secondary transition-colors duration-200 hover:text-primary";

  if (external) {
    return (
      <a href={to} target="_blank" rel={SOCIAL_REL} className={baseClass}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={baseClass}>
      {children}
    </Link>
  );
}

const footerColumns = [
  {
    title: "Explore",
    links: [
      { label: "Home", to: "/" },
      { label: "Features", to: "/features" },
      { label: "How It Works", to: "/how-it-works" },
      { label: "About", to: "/about" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact", to: "/contact" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-white">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-subtle to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute -top-24 right-0 h-48 w-48 rounded-full bg-primary/5 blur-3xl"
      />

      <div className="mx-auto max-w-container px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
          <div className="space-y-6">
            <Link
              to="/"
              className="inline-flex items-center gap-3"
              aria-label="StudyKarle home"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <Icon name="menu_book" className="text-[20px]" />
              </span>
              <div>
                <span className="block text-headline-md font-semibold tracking-tight text-text-primary">
                  StudyKarle
                </span>
                <span className="block text-label-sm text-text-muted">
                  Learn. Share. Grow.
                </span>
              </div>
            </Link>

            <p className="max-w-xl text-body-sm leading-relaxed text-text-secondary">
              StudyKarle makes academic resources easier to access so every
              student can learn with confidence, stay organized, and grow
              throughout their journey.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {SOCIAL_LINKS.map(function (link) {
                return (
                  <a
                    key={link.id}
                    href={link.href}
                    target="_blank"
                    rel={SOCIAL_REL}
                    aria-label={link.label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle text-text-secondary transition-colors duration-200 hover:border-primary/30 hover:text-primary"
                  >
                    <Icon name={link.icon} className="text-[18px]" />
                  </a>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <span className="rounded-full bg-primary/5 px-3 py-1 text-label-sm text-primary">
                Built for every learner
              </span>
              <span className="rounded-full bg-text-primary/5 px-3 py-1 text-label-sm text-secondary">
                Shared knowledge
              </span>
              <span className="rounded-full bg-text-primary/5 px-3 py-1 text-label-sm text-tertiary">
                Simple and organized
              </span>
            </div>
          </div>

          {/* Explore / Support columns — laptop and up only */}
          <div className="hidden lg:grid gap-10 sm:grid-cols-2">
            {footerColumns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h3 className="text-label-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {column.title}
                </h3>
                <ul className="mt-5 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLink to={link.to}>{link.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-border-subtle/70 pt-5">
          <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p className="text-label-sm text-text-muted">
              © {new Date().getFullYear()} StudyKarle. All rights reserved.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
              <FooterLink to="/privacy">Privacy</FooterLink>
              <FooterLink to="/terms">Terms</FooterLink>
              <FooterLink to="/contact">Contact</FooterLink>
            </div>
          </div>

          <p className="mt-4 text-center text-label-sm text-text-muted">
            Made with <span className="text-red-500">❤️</span> by{" "}
            <FooterLink to={SOCIAL_LINKS[0].href} external>
              Nitish Kumar
            </FooterLink>
          </p>
        </div>
      </div>
    </footer>
  );
}
