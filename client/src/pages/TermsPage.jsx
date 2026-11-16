import React from "react";

const sections = [
  {
    title: "Acceptance of Terms",
    body: "By creating an account or using StudyKarle, you agree to these Terms of Service. If you do not agree, please do not use the platform.",
  },
  {
    title: "Use of the Platform",
    body: "StudyKarle provides academic notes, previous year papers, and related resources for personal, non-commercial study use. You agree not to redistribute, resell, or scrape content from the platform without permission.",
  },
  {
    title: "Account Responsibility",
    body: "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately if you suspect unauthorized access.",
  },
  {
    title: "Content Accuracy",
    body: "While we strive to keep notes and resources accurate and up to date, StudyKarle does not guarantee completeness or correctness of any material. Resources are provided for reference and revision purposes only.",
  },
  {
    title: "Prohibited Conduct",
    body: "You agree not to upload malicious files, attempt to gain unauthorized access to other accounts or admin features, or use the platform in any way that disrupts service for other students.",
  },
  {
    title: "Termination",
    body: "We reserve the right to suspend or terminate accounts that violate these terms or misuse the platform.",
  },
  {
    title: "Changes to These Terms",
    body: "These Terms may be updated periodically. Continued use of StudyKarle after changes are posted constitutes acceptance of the updated Terms.",
  },
  {
    title: "Contact",
    body: "Questions about these Terms can be sent to nikusi099@gmail.com.",
  },
];

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="text-center mb-12">
      <p className="text-text-secondary uppercase tracking-widest">{eyebrow}</p>
      <h1 className="text-headline-lg font-headline-lg mt-2">{title}</h1>
      {description ? (
        <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-text-primary py-20">
      <section className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Legal"
          title="Terms of Service"
          description="Last updated: July 2026. Please read these terms carefully before using StudyKarle."
        />

        <div className="mx-auto max-w-3xl space-y-8">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-[1.5rem] border border-border-subtle bg-white p-7 shadow-sm"
            >
              <h2 className="font-headline-md text-headline-md text-text-primary mb-3">
                {section.title}
              </h2>
              <p className="text-body-sm leading-relaxed text-text-secondary">
                {section.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
