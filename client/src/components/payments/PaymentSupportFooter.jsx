import React from "react";

const SUPPORT_URL = "https://www.instagram.com/nitishdotdev/";

export default function PaymentSupportFooter() {
  return (
    <p className="mt-10 text-center text-body-sm leading-relaxed text-text-muted">
      Something went wrong? DM{" "}
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-secondary underline decoration-border-subtle underline-offset-2 transition-colors duration-200 hover:text-primary hover:decoration-primary/40"
      >
        @nitishdotdev
      </a>{" "}
      with your code
    </p>
  );
}

export { SUPPORT_URL };
