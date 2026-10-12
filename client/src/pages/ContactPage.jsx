import React from "react";
import { SOCIAL_LINKS, SOCIAL_REL } from "../utils/socialLinks";

const contactPoints = [
  {
    icon: "mail",
    title: "Email Us",
    description: "nikusi099@gmail.com",
  },
  {
    icon: "help",
    title: "Help Center",
    description: "Browse answers to common questions before reaching out.",
  },
  {
    icon: "schedule",
    title: "Response Time",
    description: "We usually reply within 12 to 24 hours on business days.",
  },
];

const socialLinks = SOCIAL_LINKS.map(function (link) {
  return {
    icon: link.icon,
    title: link.label,
    description: link.description,
    href: link.href,
  };
});

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

export default function ContactPage() {
  return (
    <>
      <main className="min-h-screen bg-background text-text-primary py-20">
        <section className="max-w-container mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Get in Touch"
            title="Questions, feedback, or an issue to report?"
            description="We're here to help. Reach out and our team will get back to you as soon as possible."
          />

          {/* Contact Info Cards */}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {contactPoints.map((point) => (
              <article
                key={point.title}
                className="group rounded-[1.75rem] border border-border-subtle bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon name={point.icon} />
                </div>

                <h3 className="mt-5 font-headline-md text-headline-md">
                  {point.title}
                </h3>

                <p className="mt-3 text-body-sm text-text-secondary">
                  {point.description}
                </p>
              </article>
            ))}
          </div>

          {/* Social / Connect Links */}
          <div className="mt-12 rounded-[1.75rem] border border-border-subtle bg-white p-7 shadow-sm sm:p-10">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-headline-md text-headline-md text-text-primary">
                Connect with us
              </h2>
              <p className="mt-2 text-body-sm text-text-secondary">
                Prefer social? Find us here.
              </p>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {socialLinks.map((link) => (
                <a
                  key={link.title}
                  href={link.href}
                  target="_blank"
                  rel={SOCIAL_REL}
                  className="group flex flex-col items-center text-center rounded-2xl border border-border-subtle p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon name={link.icon} />
                  </div>

                  <h3 className="mt-5 font-headline-md text-headline-md">
                    {link.title}
                  </h3>

                  <p className="mt-3 text-body-sm text-text-secondary">
                    {link.description}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
