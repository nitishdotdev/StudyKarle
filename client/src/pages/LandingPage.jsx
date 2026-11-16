import React, { useState } from "react";
import { Link } from "react-router-dom";
import HeroImage from "../assets/illustrations/hero.png";

const features = [
  {
    icon: "calendar_month",
    title: "Semester-wise Organization",
    description:
      "Find notes, papers, and files arranged by semester so you reach the right resource faster.",
  },
  {
    icon: "description",
    title: "Previous Year Papers",
    description:
      "Access curated PYQs that help you understand exam patterns, difficulty, and repeated concepts.",
  },
  {
    icon: "menu_book",
    title: "High Quality Notes",
    description:
      "Review clean, readable notes made for revision, clarity, and exam-focused preparation.",
  },
  {
    icon: "assignment",
    title: "Assignments",
    description:
      "Keep your submissions on track with easy access to coursework and assignment materials.",
  },
  {
    icon: "verified_user",
    title: "Secure Login",
    description:
      "Protected access keeps the platform organized and gives students a trusted study environment.",
  },
  {
    icon: "travel_explore",
    title: "Smart Search",
    description:
      "Search across subjects and resource types to find what you need without wasting time.",
  },
];

const steps = [
  {
    icon: "person_add",
    title: "Create Account",
    description:
      "Sign in once and unlock a clean workspace for all your academic resources.",
  },
  {
    icon: "folder_open",
    title: "Browse Resources",
    description:
      "Move through subjects, semesters, and years with a structured browsing flow.",
  },
  {
    icon: "download",
    title: "Download and Study",
    description:
      "Open the files you need, save time, and focus on actual preparation.",
  },
];

function Icon({ name, className = "" }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

function SectionHeading({ eyebrow, title, description, align = "center" }) {
  const alignClass =
    align === "left" ? "items-start text-left" : "items-center text-center";
  const descClass = align === "left" ? "mx-0" : "mx-auto";

  return (
    <div className={`flex flex-col gap-3 ${alignClass}`}>
      {eyebrow ? (
        <p className="text-label-md uppercase tracking-[0.18em] text-text-secondary">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="max-w-3xl text-headline-lg font-headline-lg text-text-primary">
        {title}
      </h2>
      {description ? (
        <p
          className={`max-w-2xl text-body-md text-text-secondary ${descClass}`}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-text-primary">
      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-0 top-28 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-container px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
              <div className="space-y-8 text-center lg:col-span-6 lg:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-white/80 px-4 py-2 text-body-sm text-text-secondary shadow-sm backdrop-blur">
                  <span
                    className="inline-flex h-2 w-2 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  Built for engineering students
                </div>

                <div className="space-y-5">
                  <h1 className="font-headline-xl text-headline-xl leading-tight text-text-primary">
                    Your academic resources,
                    <br />
                    <span className="text-primary">
                      organized like a real product.
                    </span>
                  </h1>
                  <p className="mx-auto max-w-2xl text-body-lg leading-relaxed text-text-secondary lg:mx-0">
                    StudyKarle organizes notes, previous year papers,
                    assignments, lab files, practical files, and
                    semester-wise study resources in one clean platform.
                    Students can request the current ₹9 Year 1 or Year 2
                    access after creating an account and submitting payment
                    proof for approval.
                  </p>
                </div>

                <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 font-label-md text-label-md text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary-container active:translate-y-0"
                  >
                    Get Started
                    <Icon name="arrow_forward" className="text-[20px]" />
                  </Link>

                  <Link
                    to="/about"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border-subtle bg-white px-7 py-4 font-label-md text-label-md text-text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    Read More
                    <Icon name="search" className="text-[20px]" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative mx-auto max-w-xl">
                  <div className="absolute -left-6 top-8 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
                  <div className="absolute -right-2 bottom-10 h-28 w-28 rounded-full bg-secondary/20 blur-3xl" />

                  <div className="relative overflow-hidden rounded-[2rem] border border-border-subtle bg-white p-4 shadow-2xl sm:p-6">
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/8 to-transparent" />
                    <div className="relative overflow-hidden rounded-[1.5rem] bg-slate-50">
                      <img
                        src={HeroImage}
                        alt="StudyKarle student illustration"
                        className="h-full w-full select-none object-contain"
                        draggable={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
