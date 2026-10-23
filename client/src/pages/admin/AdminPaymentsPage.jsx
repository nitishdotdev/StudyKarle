import React, { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Skeleton from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import Modal from "../../components/common/Modal";
import { formatDateTime } from "../../utils/formatDate";
import { useToast } from "../../context/ToastContext";
import {
  fetchAdminPayments,
  approveAdminPayment,
  rejectAdminPayment,
} from "../../api/paymentApi";
import useAuthenticatedImage from "../../hooks/useAuthenticatedImage";

function statusVariant(status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "primary";
}

function AdminPaymentScreenshot({ paymentId }) {
  const { src, failed } = useAuthenticatedImage(
    paymentId ? "/admin/payments/" + encodeURIComponent(paymentId) + "/screenshot" : null
  );
  if (failed) {
    return <p className="text-body-sm text-text-muted">Screenshot could not be loaded.</p>;
  }
  if (!src) {
    return <p className="text-body-sm text-text-muted">Loading screenshot...</p>;
  }
  return (
    <img
      src={src}
      alt="Payment screenshot"
      className="w-full rounded-lg border border-border-subtle"
    />
  );
}

export default function AdminPaymentsPage() {
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetchAdminPayments({ status: status || undefined })
      .then(setData)
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
    [status]
  );

  function handleApprove() {
    if (!selected) return;
    setBusy(true);
    approveAdminPayment(selected.id)
      .then(function () {
        toast.success("Payment approved");
        setSelected(null);
        load();
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function handleReject() {
    if (!selected) return;
    setBusy(true);
    rejectAdminPayment(selected.id, note)
      .then(function () {
        toast.success("Payment rejected");
        setSelected(null);
        setNote("");
        load();
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  const payments = data && data.payments ? data.payments : [];

  return (
    <AppShell>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-headline-lg text-text-primary mb-1">
          Payment review
        </h2>
        <p className="text-body-md text-text-secondary">
          Approve or reject ₹9 semester-access requests. Approval uses the server
          semester end date, not a date from the student.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {["pending", "approved", "rejected", ""].map(function (value) {
          const label = value || "All";
          const active = status === value;
          return (
            <button
              key={label}
              type="button"
              onClick={function () {
                setStatus(value);
              }}
              className={
                "px-4 py-2 rounded-lg text-label-md font-semibold border transition-colors " +
                (active
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-text-primary border-border-subtle hover:bg-surface-low")
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Skeleton type="row" count={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : payments.length === 0 ? (
        <EmptyState icon="payments" title="No payments" description="Nothing to review in this filter." />
      ) : (
        <div className="bg-white rounded-xl border border-border-subtle overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-subtle text-label-sm uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">UTR</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Review</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(function (row) {
                return (
                  <tr key={row.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-label-md text-text-primary">{row.studentName || "Student"}</div>
                      <div className="text-body-sm text-text-muted">{row.studentEmail}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-body-sm">{row.paymentReference}</td>
                    <td className="px-4 py-3">₹{row.amountRupees}</td>
                    <td className="px-4 py-3 text-body-sm">{row.utr || "—"}</td>
                    <td className="px-4 py-3 text-body-sm">
                      {row.submittedAt ? formatDateTime(row.submittedAt) : formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={function () {
                          setSelected(row);
                        }}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={function () {
          if (!busy) setSelected(null);
        }}
        title={selected ? "Review " + selected.paymentReference : "Review payment"}
        footer={
          selected && selected.status === "pending" ? (
            <div className="flex flex-wrap gap-3 justify-end">
              <Button variant="danger" onClick={handleReject} loading={busy}>
                Reject
              </Button>
              <Button onClick={handleApprove} loading={busy}>
                Approve
              </Button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-body-sm">
              <div>
                <dt className="text-text-muted">Student</dt>
                <dd className="text-text-primary">{selected.studentName}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Email</dt>
                <dd className="text-text-primary break-all">{selected.studentEmail}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Amount</dt>
                <dd className="text-text-primary">₹{selected.amountRupees}</dd>
              </div>
              <div>
                <dt className="text-text-muted">UTR</dt>
                <dd className="text-text-primary">{selected.utr || "—"}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Reviewed at</dt>
                <dd className="text-text-primary">
                  {selected.reviewedAt ? formatDateTime(selected.reviewedAt) : "Not reviewed"}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Reviewed by</dt>
                <dd className="text-text-primary">{selected.reviewedBy || "—"}</dd>
              </div>
            </dl>
            {selected.hasScreenshot ? (
              <AdminPaymentScreenshot paymentId={selected.id} />
            ) : (
              <p className="text-body-sm text-text-muted">No screenshot uploaded yet.</p>
            )}
            {selected.status === "pending" ? (
              <label className="block">
                <span className="block font-label-md text-label-md text-text-primary mb-2">
                  Rejection note (optional)
                </span>
                <textarea
                  value={note}
                  onChange={function (event) {
                    setNote(event.target.value);
                  }}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border-subtle rounded-lg"
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
