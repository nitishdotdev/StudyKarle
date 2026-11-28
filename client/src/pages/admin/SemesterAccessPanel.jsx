import React, { useState } from "react";
import useFetch from "../../hooks/useFetch";
import useDebounce from "../../hooks/useDebounce";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ErrorState from "../../components/common/ErrorState";
import Pagination from "../../components/common/Pagination";
import Skeleton from "../../components/common/Skeleton";
import Modal from "../../components/common/Modal";
import { formatDateTime } from "../../utils/formatDate";
import { fetchAdminSemesterAccess, setAdminSemesterAccessRevoked } from "../../api/paymentApi";

export default function SemesterAccessPanel() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const search = useDebounce(email.trim(), 350);
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(
    () => fetchAdminSemesterAccess({ email: search, status, page }),
    [search, status, page]
  );

  async function updateAccess() {
    setBusy(true);
    try {
      const revoked = selected.status !== "revoked";
      await setAdminSemesterAccessRevoked(selected.id, revoked);
      toast.success(revoked ? "Semester access revoked" : "Semester access restored");
      setSelected(null);
      if (page > 1) setPage(1);
      else reload();
    } catch (err) {
      toast.error(err.message || "Unable to update semester access");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="semester-access-title" className="space-y-4">
      <h1 id="semester-access-title" className="font-headline-lg text-headline-lg text-text-primary">Semester access</h1>
      <div className="flex flex-wrap items-end gap-3">
        <Input id="access-email" label="Student email" type="search" value={email} maxLength={254}
          onChange={(event) => { setEmail(event.target.value); setPage(1); }} />
        <div className="flex flex-col gap-2 text-sm font-semibold">
          <label htmlFor="access-status">Status</label>
          <select id="access-status" className="min-h-[44px] rounded-lg border border-border-subtle bg-white px-3"
            value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
            <option value="">All records</option>
          </select>
        </div>
      </div>
      {loading ? <Skeleton type="row" count={4} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          {data?.items.length ? (
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {["Student", "Status", "Access dates", "Payment record", "Action"].map((heading) => (
                      <th key={heading} scope="col" className="p-3">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((record) => (
                    <tr key={record.id} className="border-b border-border-subtle">
                      <td className="p-3">
                        <div className="font-semibold">{record.name}</div>
                        <div className="text-text-secondary">{record.email}</div>
                      </td>
                      <td className="p-3 capitalize">
                        {record.status}
                        {record.revokedAt ? <div className="text-text-secondary">{formatDateTime(record.revokedAt)}</div> : null}
                      </td>
                      <td className="p-3">
                        <div>Started {formatDateTime(record.startsAt)}</div>
                        <div>Ends {formatDateTime(record.endsAt)}</div>
                      </td>
                      <td className="p-3">
                        {record.paymentReference || "—"}
                        {record.reviewedAt ? <div>Reviewed {formatDateTime(record.reviewedAt)}</div> : null}
                      </td>
                      <td className="p-3">
                        {record.status === "active" || (record.status === "revoked" && new Date(record.endsAt) > new Date()) ? (
                          <Button variant="secondary" size="sm" onClick={() => setSelected(record)}>
                            {record.status === "revoked" ? "Restore access" : "Revoke access"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p role="status" className="rounded-lg border border-border-subtle bg-white p-4">No access records match these filters.</p>}
          {data?.totalPages > 1 ? <Pagination page={page} totalPages={data.totalPages} onChange={setPage} /> : null}
        </>
      )}
      <Modal open={!!selected} onClose={() => { if (!busy) setSelected(null); }}
        title={selected?.status === "revoked" ? "Restore semester access?" : "Revoke semester access?"}>
        <p className="text-body-sm text-text-secondary">
          {selected?.status === "revoked"
            ? `Restore access for ${selected.email} through the original semester end date.`
            : `Remove access to protected materials for ${selected?.email}. Their payment and access records will be kept.`}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button>
          <Button variant={selected?.status === "revoked" ? "primary" : "danger"} loading={busy} onClick={updateAccess}>
            {selected?.status === "revoked" ? "Restore access" : "Revoke access"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
