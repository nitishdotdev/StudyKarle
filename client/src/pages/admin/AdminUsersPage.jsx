import React, { useEffect, useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import UsersTable from '../../components/admin/UsersTable';
import Pagination from '../../components/common/Pagination';
import Skeleton from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import useAuth from '../../hooks/useAuth';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { fetchAdminUsers, updateUserRole, deleteAdminUser } from '../../api/adminApi';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingRoleChange, setPendingRoleChange] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetchAdminUsers({ search: debouncedSearch, page: page })
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [debouncedSearch, page]
  );

  function handleRoleChangeRequest(user, newRole) {
    setPendingRoleChange({ user: user, newRole: newRole });
  }

  function confirmRoleChange() {
    if (!pendingRoleChange) {
      return;
    }
    setBusy(true);
    updateUserRole(pendingRoleChange.user.id, pendingRoleChange.newRole)
      .then(function () {
        toast.success('Role updated');
        setPendingRoleChange(null);
        load();
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function confirmDelete() {
    if (!userToDelete) {
      return;
    }
    setBusy(true);
    deleteAdminUser(userToDelete.id)
      .then(function () {
        toast.success('User deleted');
        setUserToDelete(null);
        load();
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  return (
    <AppShell>
      <div className="mb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-text-primary mb-1">Manage Users</h1>
        <p className="text-body-md text-text-secondary">View and manage all registered students and admins.</p>
      </div>

      <Input
        id="admin-users-search"
        icon="search"
        placeholder="Search by name or email..."
        value={search}
        onChange={function (e) {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-md mb-stack-lg"
      />

      {loading ? (
        <Skeleton type="row" count={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data.users.length === 0 ? (
        <EmptyState icon="group" title="No users found" description="Try a different search term." />
      ) : (
        <React.Fragment>
          <UsersTable
            users={data.users}
            currentUserId={currentUser ? currentUser.id : null}
            onRoleChange={handleRoleChangeRequest}
            onDelete={setUserToDelete}
          />
          <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
        </React.Fragment>
      )}

      <Modal
        open={!!pendingRoleChange}
        onClose={function () {
          setPendingRoleChange(null);
        }}
        title="Change User Role"
        footer={
          <React.Fragment>
            <Button variant="secondary" onClick={function () { setPendingRoleChange(null); }}>
              Cancel
            </Button>
            <Button loading={busy} onClick={confirmRoleChange}>
              Confirm
            </Button>
          </React.Fragment>
        }
      >
        <p className="text-body-md text-text-secondary">
          Change {pendingRoleChange ? pendingRoleChange.user.name : ''}'s role to{' '}
          <strong>{pendingRoleChange ? pendingRoleChange.newRole : ''}</strong>?
        </p>
      </Modal>

      <Modal
        open={!!userToDelete}
        onClose={function () {
          setUserToDelete(null);
        }}
        title="Delete User"
        footer={
          <React.Fragment>
            <Button variant="secondary" onClick={function () { setUserToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={confirmDelete}>
              Delete
            </Button>
          </React.Fragment>
        }
      >
        <p className="text-body-md text-text-secondary">
          Are you sure you want to delete "{userToDelete ? userToDelete.name : ''}"? This cannot be undone.
        </p>
      </Modal>
    </AppShell>
  );
}
