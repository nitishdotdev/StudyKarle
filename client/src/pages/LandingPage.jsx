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

const stats = [
  { value: "800+", label: "Notes" },
  { value: "50+", label: "Subjects" },
  { value: "4+", label: "Years Covered" },
  { value: "100+", label: "Students" },
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

const testimonials = [
  {
    name: "Aarav Sharma",
    role: "CSE Student",
    rating: 5,
    feedback:
      "StudyKarle brings all my study resources together in one place, making it easier to learn, stay organized, and prepare with confidence.",
  },
  {
    name: "Priya Verma",
    role: "AIML Student",
    rating: 5,
    feedback:
      "It feels great to have a platform where students can access quality notes, learn together, and support each other's academic journey.",
  },
  {
    name: "Rohan Gupta",
    role: "ECE Student",
    rating: 4,
    feedback:
      "StudyKarle makes learning more accessible by helping students quickly find the resources they need to improve, grow, and succeed.",
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
                    StudyKarle gives students fast access to notes, previous
                    year papers, assignments, lab files, practical files, and
                    semester-wise study resources in one clean, trusted
                    platform.
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

        <section className="border-t border-border-subtle bg-white/60">
          <div className="mx-auto max-w-container px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-3xl border border-border-subtle bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-3xl font-headline-xl text-primary">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-body-sm text-text-secondary">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-container px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <SectionHeading
              eyebrow="Student Feedback"
              title="Built to support every student's learning journey."
              description="StudyKarle brings notes and study resources together so every student can learn, improve, and succeed."
            />

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <article
                  key={testimonial.name}
                  className="rounded-[1.75rem] border border-border-subtle bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    className="flex items-center gap-1 text-amber-500"
                    aria-label={`${testimonial.rating} out of 5 stars`}
                  >
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Icon
                        key={index}
                        name={
                          index < testimonial.rating ? "star" : "star_border"
                        }
                        className="text-[20px]"
                      />
                    ))}
                  </div>

                  <p className="mt-4 text-body-sm leading-relaxed text-text-secondary">
                    {testimonial.feedback}
                  </p>

                  <div className="mt-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon name="person" className="text-[24px]" />
                    </div>
                    <div>
                      <p className="text-headline-md font-headline-md text-text-primary">
                        {testimonial.name}
                      </p>
                      <p className="text-body-sm text-text-secondary">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
