import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import StatCard from '../../components/admin/StatCard';
import NoteCard from '../../components/notes/NoteCard';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import { formatBytes } from '../../utils/formatBytes';
import { formatRelativeTime, formatDateTime } from '../../utils/formatDate';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import Badge from '../../components/common/Badge';
import {
  fetchAdminStats,
  fetchDriveSyncStatus,
  triggerDriveSync,
  clearAdminPdfActivity,
} from '../../api/adminApi';

const ACTIVITY_VERBS = {
  pdf_opened: 'opened',
  pdf_downloaded: 'downloaded',
  pdf_shared: 'shared',
};

function activityDisplayName(activity) {
  return activity.userName || activity.userEmail || 'Unknown user';
}

// The PDF title opens the same preview route normal users use — the stable
// Drive node id (/drive/file/:nodeId) or the legacy note id (/notes/:noteId).
// If the resource was deleted since the event, we render its historical name
// snapshot as plain text instead of a dead link.
function ActivityPdfName({ item }) {
  const previewRoute =
    item.resourceType === 'note'
      ? '/notes/' + item.pdfId
      : '/drive/file/' + item.pdfId;

  if (item.pdfExists) {
    return (
      <Link
        to={previewRoute}
        className="font-medium text-primary hover:underline"
      >
        {item.pdfName}
      </Link>
    );
  }
  return <span className="font-medium text-text-primary">{item.pdfName}</span>;
}

export default function AdminOverviewPage() {
  const { data: stats, loading, error, reload } = useFetch(fetchAdminStats, []);
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const syncState = useFetch(fetchDriveSyncStatus, []);

  const pdfActivity = (stats && stats.pdfActivity) || [];

  const handleSync = useCallback(
    function () {
      setSyncing(true);
      triggerDriveSync()
        .then(function (result) {
          if (result.status === 'unconfigured') {
            toast.error('Library refresh is not configured on the server.');
          } else if (result.status === 'error') {
            toast.error('Refresh failed: ' + (result.error || 'unknown error'));
          } else if (result.status === 'already-running') {
            toast.info('A refresh is already running.');
          } else {
            toast.success(
              'Updated ' +
                (result.counts ? result.counts.folders : 0) +
                ' folders and ' +
                (result.counts ? result.counts.files : 0) +
                ' PDFs'
            );
          }
          syncState.reload();
          reload();
        })
        .catch(function (err) {
          toast.error(err.message || 'Failed to refresh library');
        })
        .finally(function () {
          setSyncing(false);
        });
    },
    [syncState, reload, toast]
  );

  function handleClear() {
    setClearing(true);
    clearAdminPdfActivity()
      .then(function () {
        toast.success('Recent activity cleared');
        setClearOpen(false);
        reload();
      })
      .catch(function (err) {
        toast.error(err.message || 'Failed to clear recent activity');
      })
      .finally(function () {
        setClearing(false);
      });
  }

  return (
    <AppShell>
      <Modal
        open={clearOpen}
        onClose={function () {
          setClearOpen(false);
        }}
        title="Clear recent activity"
      >
        <p className="text-body-sm text-text-secondary">
          Clear all recent activity? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={function () {
              setClearOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            icon="delete_sweep"
            loading={clearing}
            onClick={handleClear}
          >
            Clear
          </Button>
        </div>
      </Modal>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-stack-lg">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-text-primary">Admin Dashboard</h2>
          <p className="text-body-md text-text-secondary">Overview of StudyKarle resources and engagement.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          <Skeleton type="card" count={4} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <React.Fragment>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter mb-stack-lg">
            <StatCard icon="description" label="Total Notes" value={stats.totalNotes} iconBg="bg-primary/10" iconColor="text-primary" />
            <StatCard icon="group" label="Total Users" value={stats.totalUsers} iconBg="bg-secondary/10" iconColor="text-secondary" />
            <StatCard icon="visibility" label="Total Views" value={stats.totalViews} iconBg="bg-tertiary/10" iconColor="text-tertiary" />
            <StatCard icon="storage" label="Storage Used" value={formatBytes(stats.totalSizeBytes)} iconBg="bg-error-container" iconColor="text-error" />
          </div>

          {/* Library refresh status */}
          <div className="bg-white rounded-xl border border-border-subtle p-6 mb-stack-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-headline-md text-headline-md text-text-primary mb-1">
                  Content Library
                </h4>
                {syncState.loading ? (
                  <p className="text-body-sm text-text-muted">Loading library status…</p>
                ) : (
                  <p className="text-body-sm text-text-secondary">
                    {syncState.data && syncState.data.configured
                      ? 'Library ready. Last updated ' +
                        (syncState.data.last_synced_at
                          ? formatRelativeTime(syncState.data.last_synced_at)
                          : 'never') +
                        (syncState.data.folders_count != null
                          ? ' — ' + syncState.data.folders_count + ' folders, ' + syncState.data.files_count + ' PDFs'
                          : '')
                      : 'Library refresh is not configured on the server.'}
                    {syncState.data && syncState.data.status === 'syncing'
                      ? ' (updating right now…)'
                      : ''}
                    {syncState.data && syncState.data.status === 'error'
                      ? ' Last attempt failed.'
                      : ''}
                  </p>
                )}
                {syncState.data && syncState.data.configured && (
                  <p className="text-body-sm text-text-muted mt-1 truncate">
                    Folder id: {syncState.data.rootFolderId}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  icon="refresh"
                  loading={syncing}
                  onClick={handleSync}
                  disabled={syncing || (syncState.data && syncState.data.status === 'syncing')}
                >
                  Refresh Now
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            <div className="lg:col-span-2 bg-white rounded-xl border border-border-subtle overflow-hidden">
              <div className="px-6 py-5 border-b border-border-subtle">
                <h4 className="font-headline-md text-headline-md text-text-primary">Recent Uploads</h4>
              </div>
              {stats.recentUploads.length === 0 ? (
                <p className="p-6 text-body-sm text-text-muted">No notes uploaded yet.</p>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {stats.recentUploads.map(function (note) {
                    return <NoteCard key={note.id} note={note} />;
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-border-subtle p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h4 className="font-headline-md text-headline-md text-text-primary">
                  Recent Activity
                </h4>
                {pdfActivity.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="delete_sweep"
                    onClick={function () {
                      setClearOpen(true);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {pdfActivity.length === 0 ? (
                <p className="text-body-sm text-text-muted">No recent activity.</p>
              ) : (
                <ul className="space-y-3">
                  {pdfActivity.map(function (activity) {
                    const isLogin = activity.activityType === 'user_login';
                    const verb =
                      ACTIVITY_VERBS[activity.activityType] ||
                      activity.activityType;
                    const when = formatDateTime(activity.createdAt);
                    return (
                      <li
                        key={activity.id}
                        className="text-body-sm text-text-secondary border-b border-border-subtle last:border-0 pb-3 last:pb-0"
                      >
                        {isLogin ? (
                          <div>
                            <Badge variant="primary">User Login</Badge>
                            <p className="mt-1.5">
                              <span className="font-medium text-text-primary">
                                {activityDisplayName(activity)}
                              </span>{' '}
                              logged in
                              {activity.userName && activity.userEmail ? (
                                <span className="text-text-muted">
                                  {' '}
                                  ({activity.userEmail})
                                </span>
                              ) : null}
                            </p>
                          </div>
                        ) : (
                          <p>
                            <span className="font-medium text-text-primary">
                              {activityDisplayName(activity)}
                            </span>{' '}
                            {verb} <ActivityPdfName item={activity} />
                          </p>
                        )}
                        <span
                          className="block text-text-muted text-[12px] mt-0.5"
                          title={when}
                        >
                          {when}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </React.Fragment>
      )}
    </AppShell>
  );
}
