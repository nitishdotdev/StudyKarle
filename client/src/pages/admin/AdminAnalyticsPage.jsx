import React from 'react';
import AppShell from '../../components/layout/AppShell';
import StatCard from '../../components/admin/StatCard';
import Skeleton from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { formatBytes } from '../../utils/formatBytes';
import { formatDate } from '../../utils/formatDate';
import useFetch from '../../hooks/useFetch';
import { fetchAdminStats, fetchAdminActivity } from '../../api/adminApi';

export default function AdminAnalyticsPage() {
  const statsState = useFetch(fetchAdminStats, []);
  const activityState = useFetch(function () {
    return fetchAdminActivity(50);
  }, []);

  return (
    <AppShell>
      <div className="mb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-text-primary mb-1">Analytics</h1>
        <p className="text-body-md text-text-secondary">Platform-wide engagement and content metrics.</p>
      </div>

      {statsState.loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter mb-stack-lg">
          <Skeleton type="card" count={4} />
        </div>
      ) : statsState.error ? (
        <ErrorState message={statsState.error} onRetry={statsState.reload} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter mb-stack-lg">
          <StatCard icon="description" label="Total Notes" value={statsState.data.totalNotes} iconBg="bg-primary/10" iconColor="text-primary" />
          <StatCard icon="group" label="Total Users" value={statsState.data.totalUsers} iconBg="bg-secondary/10" iconColor="text-secondary" />
          <StatCard icon="visibility" label="Total Views" value={statsState.data.totalViews} iconBg="bg-tertiary/10" iconColor="text-tertiary" />
          <StatCard icon="storage" label="Storage Used" value={formatBytes(statsState.data.totalSizeBytes)} iconBg="bg-error-container" iconColor="text-error" />
        </div>
      )}

      <div className="bg-white rounded-xl border border-border-subtle p-6">
        <h4 className="font-headline-md text-headline-md text-text-primary mb-4">Admin Activity Log</h4>
        {activityState.loading ? (
          <Skeleton type="row" count={5} />
        ) : activityState.error ? (
          <ErrorState message={activityState.error} onRetry={activityState.reload} />
        ) : activityState.data.length === 0 ? (
          <EmptyState icon="history" title="No activity yet" description="Admin actions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-text-muted text-label-sm uppercase tracking-wider border-b border-border-subtle">
                  <th className="py-3 pr-4 font-semibold">Admin</th>
                  <th className="py-3 pr-4 font-semibold">Action</th>
                  <th className="py-3 pr-4 font-semibold">Entity</th>
                  <th className="py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {activityState.data.map(function (activity) {
                  return (
                    <tr key={activity.id}>
                      <td className="py-3 pr-4 text-body-sm text-text-primary font-medium">{activity.admin_name || 'Admin'}</td>
                      <td className="py-3 pr-4 text-body-sm text-text-secondary">{activity.action}</td>
                      <td className="py-3 pr-4 text-body-sm text-text-secondary capitalize">{activity.entity_type}</td>
                      <td className="py-3 text-body-sm text-text-muted">{formatDate(activity.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
