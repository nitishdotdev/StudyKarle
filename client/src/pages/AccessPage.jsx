import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Spinner from "../components/common/Spinner";
import ErrorState from "../components/common/ErrorState";
import FaqAccordion from "../components/payments/FaqAccordion";
import PaymentSupportFooter from "../components/payments/PaymentSupportFooter";
import { useToast } from "../context/ToastContext";
import useAuth from "../hooks/useAuth";
import {
  fetchPaymentOffer,
  previewCheckout,
  startCheckout,
  submitPaymentProof,
} from "../api/paymentApi";

const OFFER_FAQ = [
  {
    question: "How does it work?",
    answer:
      "Pick your semester, pay by UPI, send your screenshot. Your login arrives on Instagram or WhatsApp after verification.",
  },
  {
    question: "How long does access last?",
    answer: "Access is for the current semester.",
  },
  {
    question: "Is this a subscription?",
    answer:
      "No. It's a one-time UPI payment. Nothing renews or charges automatically — next semester you decide whether to buy again.",
  },
  {
    question: "When will my account be activated?",
    answer: "Usually activated within a few minutes after payment verification.",
  },
  {
    question: "Can I use it on more than one device?",
    answer:
      "Yes. You can keep up to two devices registered to your account and switch between them whenever needed.",
  },
  {
    question: "What happens when new resources are added?",
    answer: "New material for your courses appears in your account automatically during the semester.",
  },
  {
    question: "I paid but closed the page",
    answer: "Don't pay again. Recover your payment with the SK code from your UPI payment's note.",
  },
];

const TROUBLESHOOT_FAQ = [
  {
    question: "Still processing?",
    answer: "Don't pay again. Wait for your UPI app to confirm, then complete setup.",
  },
  {
    question: "Failed and no money left your account?",
    answer: "Pay again with the QR or UPI ID above.",
  },
  {
    question: "Money deducted but it shows failed, or you paid twice?",
    answer: "Don't pay again — complete setup and mention it in the note.",
  },
  {
    question: "Paid from someone else's UPI?",
    answer: "That's fine.",
  },
];

function statusCopy(reason, status) {
  if (status === "pending" || reason === "PAYMENT_PENDING") {
    return "Payment verification is in progress. You will get Year 1 and Year 2 access after an administrator approves your screenshot.";
  }
  if (status === "rejected" || reason === "PAYMENT_REJECTED") {
    return "This payment was not approved. You can submit a clearer screenshot or a UTR and we will review it again.";
  }
  if (status === "expired" || reason === "PAYMENT_EXPIRED") {
    return "Your previous semester access has ended. Pay ₹9 again for the current semester.";
  }
  return "Pay ₹9 once to unlock every Year 1 and Year 2 note, PDF, question paper, and worksheet until the current semester ends.";
}

function Card({ children, className }) {
  return (
    <div
      className={
        "rounded-2xl border border-border-subtle bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] " +
        (className || "")
      }
    >
      {children}
    </div>
  );
}

export default function AccessPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reason = params.get("reason");

  const [offer, setOffer] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [stage, setStage] = useState("offer");

  useEffect(
    function () {
      if (isAdmin) {
        navigate("/dashboard", { replace: true });
      }
    },
    [isAdmin, navigate]
  );

  function applyCheckout(data) {
    setCheckout(data);
    if (data.alreadyActive) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (data.submitted) {
      setSubmitted(true);
      setStage("submitted");
      return;
    }
    setStage("pay");
  }

  function load() {
    setLoading(true);
    setError(null);
    fetchPaymentOffer()
      .then(function (data) {
        setOffer(data);
        if (data.hasAccess) {
          navigate("/dashboard", { replace: true });
          return;
        }
        if (data.status === "pending") {
          return previewCheckout().then(applyCheckout);
        }
        if (data.status === "rejected" || data.status === "expired") {
          setStage("offer");
        }
      })
      .catch(function (err) {
        setError(err.message);
      })
      .finally(function () {
        setLoading(false);
      });
  }

  useEffect(
    function () {
      load();
    },
    []
  );

  function handleStartPay() {
    setBusy(true);
    previewCheckout()
      .then(applyCheckout)
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function handleCompleteSetup() {
    setBusy(true);
    startCheckout(checkout && checkout.paymentReference)
      .then(function (data) {
        if (data.alreadyActive) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setCheckout(data);
        setStage(data.submitted ? "submitted" : "proof");
        navigate("/access?reason=PAYMENT_PENDING", { replace: true });
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function copyText(value, label) {
    if (!value) return;
    navigator.clipboard.writeText(value).then(function () {
      setCopied(label);
      toast.success(label + " copied");
      setTimeout(function () {
        setCopied("");
      }, 2000);
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      toast.error("Upload a payment screenshot first.");
      return;
    }
    const form = new FormData();
    form.append("screenshot", file);
    if (utr.trim()) form.append("utr", utr.trim());
    setBusy(true);
    submitPaymentProof(form)
      .then(function (data) {
        setSubmitted(true);
        setStage("submitted");
        toast.success("Proof submitted. Verification is in progress.");
        setCheckout(function (current) {
          return Object.assign({}, current || {}, {
            paymentReference: data.paymentReference,
            status: data.status,
            submitted: true,
            persisted: true,
          });
        });
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={load} />
      </AppShell>
    );
  }

  const available = offer ? offer.available : true;
  const persisted = !!(checkout && checkout.persisted);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        {stage === "offer" ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="space-y-6 lg:col-span-7">
              <Card className="p-6 sm:p-8">
                <p className="text-label-sm font-semibold uppercase tracking-[0.14em] text-primary">
                  Semester access
                </p>
                <h1 className="mt-3 font-headline-xl text-headline-xl text-text-primary">
                  Get StudyKarle access
                </h1>
                <p className="mt-3 text-body-lg leading-relaxed text-text-secondary">
                  {statusCopy(reason, offer && offer.status)}
                </p>
                <div className="mt-8 flex items-baseline gap-3">
                  <span className="font-headline-xl text-headline-xl text-text-primary">₹9</span>
                  <span className="text-body-md leading-relaxed text-text-secondary">
                    One-time payment for the current semester
                  </span>
                </div>
                <p className="mt-5 text-body-sm leading-relaxed text-text-secondary">
                  Uploading a screenshot never unlocks materials automatically. An administrator
                  reviews every payment.
                </p>
                {!available ? (
                  <p
                    className="mt-6 rounded-lg bg-error-container px-4 py-3 text-body-sm text-error"
                    role="alert"
                  >
                    {offer.unavailableReason || "Checkout is temporarily unavailable."}
                  </p>
                ) : (
                  <Button
                    className="mt-8 w-full sm:w-auto"
                    size="lg"
                    onClick={handleStartPay}
                    loading={busy}
                  >
                    Continue to payment · ₹9
                  </Button>
                )}
              </Card>
              <FaqAccordion title="Questions" items={OFFER_FAQ} />
            </div>
            <aside className="space-y-6 lg:col-span-5">
              <Card className="p-6 sm:p-7">
                <h2 className="font-headline-md text-headline-md text-text-primary">
                  What is included
                </h2>
                <ul className="mt-5 space-y-3.5 text-body-md leading-relaxed text-text-secondary">
                  {[
                    "All Year 1 and Year 2 notes and PDFs",
                    "Question papers and worksheets",
                    "One payment covers every protected file",
                    "Access until the configured semester end date",
                    "Browse the catalogue before you pay",
                  ].map(function (item) {
                    return (
                      <li key={item} className="flex gap-3">
                        <span
                          className="material-symbols-outlined mt-0.5 text-status-success text-[20px]"
                          aria-hidden="true"
                        >
                          check_circle
                        </span>
                        <span>{item}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
              <Card className="p-6 sm:p-7">
                <h2 className="font-headline-md text-headline-md text-text-primary">
                  Honest preview policy
                </h2>
                <p className="mt-3 text-body-sm leading-relaxed text-text-secondary">
                  Approved students can open PDFs in the StudyKarle viewer, including text
                  selection and copy.
                </p>
                <Link
                  to="/dashboard"
                  className="mt-5 inline-flex min-h-[44px] items-center text-primary font-semibold"
                >
                  Browse the library
                </Link>
              </Card>
            </aside>
          </div>
        ) : null}

        {stage === "pay" && checkout ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
            <section className="lg:col-span-7">
              <Card className="p-6 sm:p-8">
                <p className="text-label-sm font-semibold uppercase tracking-[0.14em] text-primary">
                  {persisted ? "Checkout saved" : "Pay with UPI"}
                  {checkout.paymentReference ? " · " + checkout.paymentReference : ""}
                </p>
                <h1 className="mt-3 font-headline-xl text-headline-xl text-text-primary">
                  Pay ₹{checkout.amountRupees}
                </h1>
                <p className="mt-3 text-body-md leading-relaxed text-text-secondary">
                  Pay, then tap I have paid — complete setup.
                </p>
                <div className="mt-8 flex flex-col items-start gap-8 sm:flex-row">
                  {checkout.qrDataUrl ? (
                    <img
                      src={checkout.qrDataUrl}
                      alt="UPI payment QR code"
                      width="280"
                      height="280"
                      className="h-56 w-56 rounded-xl border border-border-subtle bg-white p-2"
                    />
                  ) : (
                    <a
                      href={checkout.upiUri}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-white"
                    >
                      Open UPI app
                    </a>
                  )}
                  <div className="min-w-0 space-y-4">
                    <p className="text-label-sm uppercase tracking-wide text-text-muted">
                      Pay using UPI ID
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="break-all text-body-md text-text-primary">
                        {checkout.upiId}
                      </code>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={function () {
                          copyText(checkout.upiId, "UPI ID");
                        }}
                      >
                        {copied === "UPI ID" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <p className="text-body-sm leading-relaxed text-text-secondary">
                      Amount <strong>₹{checkout.amountFormatted}</strong>
                    </p>
                    <p className="text-body-sm leading-relaxed text-text-secondary">
                      Payment note{" "}
                      <strong className="text-primary">{checkout.paymentReference}</strong>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        onClick={function () {
                          copyText(checkout.paymentReference, "Payment note");
                        }}
                      >
                        Copy note
                      </Button>
                    </p>
                    <p className="text-body-sm leading-relaxed text-text-muted">
                      Add this code as the payment note. Payee shows as {checkout.payeeName}.
                    </p>
                  </div>
                </div>
                <Button
                  className="mt-8 w-full sm:w-auto"
                  size="lg"
                  loading={busy}
                  onClick={handleCompleteSetup}
                >
                  I have paid — complete setup
                </Button>
              </Card>
            </section>
            <aside className="space-y-6 lg:col-span-5">
              <Card className="p-6 sm:p-7">
                <h2 className="font-headline-md text-headline-md text-text-primary">
                  Before you pay
                </h2>
                <p className="mt-3 text-body-md leading-relaxed text-text-secondary">
                  Take a screenshot of the successful payment — you will need it to verify
                  your access. Verification is manual and does not happen automatically.
                </p>
              </Card>
              <FaqAccordion title="Payment problems?" items={TROUBLESHOOT_FAQ} />
            </aside>
          </div>
        ) : null}

        {stage === "proof" && checkout ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
            <section className="max-w-xl lg:col-span-7 lg:max-w-none">
              <Card className="p-6 sm:p-8">
                <h1 className="font-headline-lg text-headline-lg text-text-primary">
                  Upload payment proof
                </h1>
                <p className="mt-3 text-body-md leading-relaxed text-text-secondary">
                  Reference <strong>{checkout.paymentReference}</strong>. JPEG, PNG, or WEBP up to
                  5MB.
                </p>
                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label
                      htmlFor="screenshot"
                      className="mb-2 block font-label-md text-label-md text-text-primary"
                    >
                      Payment screenshot
                    </label>
                    <input
                      id="screenshot"
                      name="screenshot"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={function (event) {
                        setFile(
                          event.target.files && event.target.files[0] ? event.target.files[0] : null
                        );
                      }}
                      className="block w-full text-body-sm"
                    />
                  </div>
                  <Input
                    id="utr"
                    label="UTR / transaction reference (optional)"
                    value={utr}
                    onChange={function (event) {
                      setUtr(event.target.value);
                    }}
                    placeholder="12-digit UTR"
                  />
                  <Button type="submit" loading={busy} fullWidth>
                    Submit for verification
                  </Button>
                </form>
              </Card>
            </section>
            <aside className="space-y-6 lg:col-span-5">
              <Card className="p-6 sm:p-7">
                <h2 className="font-headline-md text-headline-md text-text-primary">
                  Before you pay
                </h2>
                <p className="mt-3 text-body-md leading-relaxed text-text-secondary">
                  Take a screenshot of the successful payment — you will need it to verify
                  your access. Verification is manual and does not happen automatically.
                </p>
              </Card>
              <FaqAccordion title="Payment problems?" items={TROUBLESHOOT_FAQ} />
            </aside>
          </div>
        ) : null}

        {stage === "submitted" && checkout ? (
          <section className="max-w-xl">
            <Card className="p-6 sm:p-8">
              <p className="text-label-sm font-semibold uppercase tracking-wide text-primary">
                Verification in progress
              </p>
              <h1 className="mt-3 font-headline-lg text-headline-lg text-text-primary">
                We have your payment proof
              </h1>
              <p className="mt-3 text-body-md leading-relaxed text-text-secondary">
                Reference <strong>{checkout.paymentReference}</strong>. Status: pending.
                Materials stay locked until an administrator approves this request.
              </p>
              <Link to="/dashboard" className="mt-8 inline-flex">
                <Button variant="secondary">Back to library</Button>
              </Link>
            </Card>
          </section>
        ) : null}

        <PaymentSupportFooter />
      </div>
    </AppShell>
  );
}
