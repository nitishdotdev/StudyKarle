import React, { useMemo, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import Skeleton from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import useFetch from "../../hooks/useFetch";
import { formatDate } from "../../utils/formatDate";
import { fetchAdminViewHistory } from "../../api/adminApi";

function normalizeHistoryRow(row) {
  return {
    id: row.id,
    userName: row.user_name || row.userName || row.name || "Unknown User",
    email: row.email || row.user_email || "",
    noteTitle: row.note_title || row.title || "Untitled Note",
    subjectName: row.subject_name || row.subject || "Unknown Subject",
    semesterLabel: row.semester_label || row.semester || "",
    yearLabel: row.year_label || row.year || "",
    viewedAt: row.viewed_at || row.created_at || null,
  };
}

function getDisplayDate(value) {
  if (!value) return "—";
  return formatDate(value);
}

export default function AdminViewHistoryPage() {
  const { data, loading, error, reload } = useFetch(function () {
    return fetchAdminViewHistory(200);
  }, []);

  const [query, setQuery] = useState("");

  const rows = useMemo(
    function () {
      const rawRows = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];

      return rawRows.map(normalizeHistoryRow);
    },
    [data]
  );

  const filteredRows = useMemo(
    function () {
      const q = query.trim().toLowerCase();
      if (!q) return rows;

      return rows.filter(function (row) {
        return (
          row.userName.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q) ||
          row.noteTitle.toLowerCase().includes(q) ||
          row.subjectName.toLowerCase().includes(q) ||
          row.semesterLabel.toLowerCase().includes(q) ||
          row.yearLabel.toLowerCase().includes(q)
        );
      });
    },
    [rows, query]
  );

  const summary = useMemo(
    function () {
      const totalViews = rows.length;
      const uniqueUsers = new Set(
        rows.map(function (row) {
          return row.email || row.userName;
        })
      ).size;
      const uniqueNotes = new Set(
        rows.map(function (row) {
          return row.noteTitle;
        })
      ).size;

      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);
      const todaysViews = rows.filter(function (row) {
        if (!row.viewedAt) return false;
        return new Date(row.viewedAt).toISOString().slice(0, 10) === todayKey;
      }).length;

      return { totalViews, uniqueUsers, uniqueNotes, todaysViews };
    },
    [rows]
  );

  return (
    <AppShell>
      <div className="mb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-text-primary mb-1">
          View History
        </h1>
        <p className="text-body-md text-text-secondary">
          Admin-only activity log of which users opened which notes.
        </p>
      </div>

      {loading ? (
        <div className="space-y-stack-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter">
            <Skeleton type="card" count={4} />
          </div>
          <Skeleton type="row" count={8} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <React.Fragment>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter mb-stack-lg">
            <div className="bg-white rounded-xl border border-border-subtle p-6 shadow-sm">
              <p className="text-text-muted text-[11px] uppercase tracking-wider font-bold mb-2">
                Total Views
              </p>
              <h3 className="font-headline-lg text-headline-lg text-text-primary">
                {summary.totalViews}
              </h3>
            </div>

            <div className="bg-white rounded-xl border border-border-subtle p-6 shadow-sm">
              <p className="text-text-muted text-[11px] uppercase tracking-wider font-bold mb-2">
                Unique Users
              </p>
              <h3 className="font-headline-lg text-headline-lg text-text-primary">
                {summary.uniqueUsers}
              </h3>
            </div>

            <div className="bg-white rounded-xl border border-border-subtle p-6 shadow-sm">
              <p className="text-text-muted text-[11px] uppercase tracking-wider font-bold mb-2">
                Unique Notes
              </p>
              <h3 className="font-headline-lg text-headline-lg text-text-primary">
                {summary.uniqueNotes}
              </h3>
            </div>

            <div className="bg-white rounded-xl border border-border-subtle p-6 shadow-sm">
              <p className="text-text-muted text-[11px] uppercase tracking-wider font-bold mb-2">
                Today
              </p>
              <h3 className="font-headline-lg text-headline-lg text-text-primary">
                {summary.todaysViews}
              </h3>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border-subtle p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
              <div>
                <h3 className="font-headline-md text-headline-md text-text-primary">
                  Recent Note Views
                </h3>
                <p className="text-body-sm text-text-secondary">
                  Search by user, email, note title, subject, semester, or year.
                </p>
              </div>

              <div className="w-full lg:max-w-md">
                <Input
                  id="viewHistorySearch"
                  name="viewHistorySearch"
                  label="Search"
                  placeholder="Search users or notes"
                  value={query}
                  onChange={function (e) {
                    setQuery(e.target.value);
                  }}
                />
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <EmptyState
                icon="history"
                title="No view history found"
                description={
                  query.trim()
                    ? "No records match your search."
                    : "No note views have been recorded yet."
                }
                action={
                  query.trim() ? (
                    <Button
                      variant="secondary"
                      onClick={function () {
                        setQuery("");
                      }}
                    >
                      Clear Search
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted text-label-sm uppercase tracking-wider">
                      <th className="py-3 pr-4 font-semibold">User</th>
                      <th className="py-3 pr-4 font-semibold">Email</th>
                      <th className="py-3 pr-4 font-semibold">Subject</th>
                      <th className="py-3 pr-4 font-semibold">Note</th>
                      <th className="py-3 pr-4 font-semibold">
                        Semester / Year
                      </th>
                      <th className="py-3 font-semibold">Viewed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {filteredRows.map(function (row) {
                      return (
                        <tr
                          key={
                            row.id ||
                            `${row.userName}-${row.noteTitle}-${row.viewedAt}`
                          }
                        >
                          <td className="py-4 pr-4">
                            <div className="font-label-md text-label-md text-text-primary">
                              {row.userName}
                            </div>
                          </td>
                          <td className="py-4 pr-4 text-body-sm text-text-secondary">
                            {row.email || "—"}
                          </td>
                          <td className="py-4 pr-4 text-body-sm text-text-secondary">
                            {row.subjectName}
                          </td>
                          <td className="py-4 pr-4 text-body-sm text-text-secondary">
                            {row.noteTitle}
                          </td>
                          <td className="py-4 pr-4 text-body-sm text-text-secondary">
                            {row.semesterLabel || row.yearLabel ? (
                              <span>
                                {row.semesterLabel || "—"}
                                {row.yearLabel ? ` • ${row.yearLabel}` : ""}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-4 text-body-sm text-text-muted whitespace-nowrap">
                            {getDisplayDate(row.viewedAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </React.Fragment>
      )}
    </AppShell>
  );
}
