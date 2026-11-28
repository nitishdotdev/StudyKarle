import React from "react";

const steps = [
  {
    icon: "person_add",
    title: "Create Account",
    description:
      "Sign up in a few seconds and request the current ₹9 Year 1 or Year 2 semester access.",
  },
  {
    icon: "folder_open",
    title: "Browse Resources",
    description:
      "After payment proof is approved, explore semester-wise notes, previous year papers, assignments, lab files, and practical resources.",
  },
  {
    icon: "picture_as_pdf",
    title: "Open a PDF",
    description:
      "Open resources in the StudyKarle viewer. Protected materials require approved semester access.",
  },
];

function Icon({ name }) {
  return <span className="material-symbols-outlined">{name}</span>;
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="text-center mb-12">
      <p className="text-text-secondary uppercase tracking-widest">{eyebrow}</p>

      <h1 className="text-headline-lg font-headline-lg mt-2">{title}</h1>

      <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
        {description}
      </p>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      <main className="min-h-screen bg-background text-text-primary py-20">
        <section className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How It Works"
            title="A simple flow that keeps the focus on studying."
            description="Three clear steps. No confusion. No unnecessary distractions. Just a clean path from sign up to learning."
          />

          <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="group rounded-[1.75rem] border border-border-subtle bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon name={step.icon} />
                  </div>

                  <span className="font-label-md text-label-md text-text-secondary">
                    Step {index + 1}
                  </span>
                </div>

                <h3 className="mt-5 font-headline-md text-headline-md">
                  {step.title}
                </h3>

                <p className="mt-3 text-body-sm text-text-secondary">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
