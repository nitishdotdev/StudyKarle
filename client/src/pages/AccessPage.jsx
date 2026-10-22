import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Spinner from "../components/common/Spinner";
import ErrorState from "../components/common/ErrorState";
import { useToast } from "../context/ToastContext";
import useAuth from "../hooks/useAuth";
import {
  fetchPaymentOffer,
  startCheckout,
  submitPaymentProof,
} from "../api/paymentApi";
import { formatDate } from "../utils/formatDate";

const SUPPORT_URL = "https://www.instagram.com/nitishdotdev/";

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
          return startCheckout().then(function (chk) {
            setCheckout(chk);
            setStage(chk.submitted ? "submitted" : "pay");
            setSubmitted(!!chk.submitted);
          });
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
    startCheckout()
      .then(function (data) {
        if (data.alreadyActive) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setCheckout(data);
        setStage(data.submitted ? "submitted" : "pay");
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

  const endsAt = (checkout && checkout.accessEndsAt) || (offer && offer.accessEndsAt);
  const available = offer ? offer.available : true;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {stage === "offer" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <section className="lg:col-span-7 bg-white rounded-2xl border border-border-subtle p-6 sm:p-8">
              <p className="text-label-sm font-semibold uppercase tracking-[0.14em] text-primary">
                Semester access
              </p>
              <h1 className="mt-2 font-headline-xl text-headline-xl text-text-primary">
                Get StudyKarle access
              </h1>
              <p className="mt-3 text-body-lg text-text-secondary">
                {statusCopy(reason, offer && offer.status)}
              </p>
              <div className="mt-6 flex items-baseline gap-3">
                <span className="font-headline-xl text-headline-xl text-text-primary">₹9</span>
                <span className="text-body-md text-text-secondary">
                  One-time payment for the current semester
                </span>
              </div>
              {endsAt ? (
                <p className="mt-2 text-body-sm text-text-muted">
                  Access lasts until {formatDate(endsAt)}.
                </p>
              ) : null}
              <p className="mt-4 text-body-sm text-text-secondary">
                Uploading a screenshot never unlocks materials automatically. An administrator
                reviews every payment.
              </p>
              {!available ? (
                <p className="mt-6 rounded-lg bg-error-container px-4 py-3 text-body-sm text-error" role="alert">
                  {offer.unavailableReason || "Checkout is temporarily unavailable."}
                </p>
              ) : (
                <Button
                  className="mt-6 w-full sm:w-auto"
                  size="lg"
                  onClick={handleStartPay}
                  loading={busy}
                >
                  Continue to payment · ₹9
                </Button>
              )}
              <p className="mt-6 text-body-sm text-text-muted">
                Need help?{" "}
                <a
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold"
                >
                  Message @nitishdotdev on Instagram
                </a>
              </p>
            </section>
            <aside className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-2xl border border-border-subtle p-6">
                <h2 className="font-headline-md text-headline-md text-text-primary mb-4">
                  What is included
                </h2>
                <ul className="space-y-3 text-body-md text-text-secondary">
                  {[
                    "All Year 1 and Year 2 notes and PDFs",
                    "Question papers and worksheets",
                    "One payment covers every protected file",
                    "Access until the configured semester end date",
                    "Browse the catalogue before you pay",
                  ].map(function (item) {
                    return (
                      <li key={item} className="flex gap-2">
                        <span className="material-symbols-outlined text-status-success text-[20px]" aria-hidden="true">
                          check_circle
                        </span>
                        <span>{item}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="bg-white rounded-2xl border border-border-subtle p-6">
                <h2 className="font-headline-md text-headline-md text-text-primary mb-2">
                  Honest preview policy
                </h2>
                <p className="text-body-sm text-text-secondary">
                  Approved students can open PDFs in the StudyKarle viewer, including text
                  selection and copy. Downloads of Year 1 and Year 2 files are removed.
                  Browser viewing cannot stop screenshots.
                </p>
                <Link to="/dashboard" className="inline-flex mt-4 text-primary font-semibold">
                  Browse the library
                </Link>
              </div>
            </aside>
          </div>
        ) : null}

        {stage === "pay" && checkout ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <section className="lg:col-span-7 bg-white rounded-2xl border border-border-subtle p-6 sm:p-8">
              <p className="text-label-sm font-semibold text-status-success">
                Checkout saved · {checkout.paymentReference}
              </p>
              <h1 className="mt-2 font-headline-xl text-headline-xl text-text-primary">
                Pay ₹{checkout.amountRupees}
              </h1>
              <p className="mt-2 text-body-md text-text-secondary">
                Pay, then come back here and tap I have paid.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-6 items-start">
                {checkout.qrDataUrl ? (
                  <img
                    src={checkout.qrDataUrl}
                    alt="UPI payment QR code"
                    width="280"
                    height="280"
                    className="w-56 h-56 bg-white rounded-xl border border-border-subtle p-2"
                  />
                ) : (
                  <a
                    href={checkout.upiUri}
                    className="inline-flex items-center justify-center rounded-lg bg-primary text-white px-5 py-3 font-semibold"
                  >
                    Open UPI app
                  </a>
                )}
                <div className="space-y-3 min-w-0">
                  <p className="text-label-sm uppercase tracking-wide text-text-muted">
                    Pay using UPI ID
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-body-md text-text-primary break-all">
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
                  <p className="text-body-sm text-text-secondary">
                    Amount <strong>₹{checkout.amountFormatted}</strong>
                  </p>
                  <p className="text-body-sm text-text-secondary">
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
                  <p className="text-body-sm text-text-muted">
                    Add this code as the payment note. Payee shows as {checkout.payeeName}.
                  </p>
                </div>
              </div>
              <Button className="mt-8" size="lg" onClick={function () { setStage("proof"); }}>
                I have paid — complete setup
              </Button>
            </section>
            <aside className="lg:col-span-5 bg-white rounded-2xl border border-border-subtle p-6">
              <h2 className="font-headline-md text-headline-md text-text-primary mb-2">
                Before you pay
              </h2>
              <p className="text-body-md text-text-secondary">
                Take a screenshot of the successful payment — you will need it to verify
                your access. Verification is manual and does not happen automatically.
              </p>
              <p className="mt-4 text-body-sm text-text-muted">
                Something went wrong?{" "}
                <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">
                  DM @nitishdotdev
                </a>{" "}
                with your code.
              </p>
            </aside>
          </div>
        ) : null}

        {stage === "proof" && checkout ? (
          <section className="max-w-xl bg-white rounded-2xl border border-border-subtle p-6 sm:p-8">
            <h1 className="font-headline-lg text-headline-lg text-text-primary">
              Upload payment proof
            </h1>
            <p className="mt-2 text-body-md text-text-secondary">
              Reference <strong>{checkout.paymentReference}</strong>. JPEG, PNG, or WEBP up to 5MB.
            </p>
            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="screenshot" className="block font-label-md text-label-md text-text-primary mb-2">
                  Payment screenshot
                </label>
                <input
                  id="screenshot"
                  name="screenshot"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={function (event) {
                    setFile(event.target.files && event.target.files[0] ? event.target.files[0] : null);
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
          </section>
        ) : null}

        {(stage === "submitted" || submitted) && checkout ? (
          <section className="max-w-xl bg-white rounded-2xl border border-border-subtle p-6 sm:p-8">
            <p className="text-label-sm font-semibold uppercase tracking-wide text-primary">
              Verification in progress
            </p>
            <h1 className="mt-2 font-headline-lg text-headline-lg text-text-primary">
              We have your payment proof
            </h1>
            <p className="mt-3 text-body-md text-text-secondary">
              Reference <strong>{checkout.paymentReference}</strong>. Status: pending.
              Materials stay locked until an administrator approves this request.
            </p>
            <Link to="/dashboard" className="inline-flex mt-6">
              <Button variant="secondary">Back to library</Button>
            </Link>
            <p className="mt-4 text-body-sm text-text-muted">
              Questions?{" "}
              <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">
                Instagram @nitishdotdev
              </a>
            </p>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
