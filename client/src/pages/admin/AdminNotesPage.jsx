import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import NotesTable from '../../components/admin/NotesTable';
import Pagination from '../../components/common/Pagination';
import Skeleton from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import useDebounce from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { fetchAdminNotes, deleteAdminNote, updateAdminNote } from '../../api/adminApi';

export default function AdminNotesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetchAdminNotes({ search: debouncedSearch, page: page })
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

  function handleToggleStatus(note) {
    const nextStatus = note.status === 'published' ? 'draft' : 'published';
    updateAdminNote(note.id, { status: nextStatus })
      .then(function () {
        toast.success('Note status updated');
        load();
      })
      .catch(function (err) {
        toast.error(err.message);
      });
  }

  function confirmDelete() {
    if (!noteToDelete) {
      return;
    }
    setDeleting(true);
    deleteAdminNote(noteToDelete.id)
      .then(function () {
        toast.success('Note deleted');
        setNoteToDelete(null);
        load();
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setDeleting(false);
      });
  }

  return (
    <AppShell>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-stack-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-text-primary mb-1">All Notes</h1>
          <p className="text-body-md text-text-secondary">Manage every note uploaded to StudyKarle.</p>
        </div>
        <Link to="/admin/upload">
          <Button icon="cloud_upload">Upload Note</Button>
        </Link>
      </div>

      <Input
        id="admin-notes-search"
        icon="search"
        placeholder="Search notes by title..."
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
      ) : data.notes.length === 0 ? (
        <EmptyState icon="description" title="No notes found" description="Try a different search term or upload a new note." />
      ) : (
        <React.Fragment>
          <NotesTable notes={data.notes} onDelete={setNoteToDelete} onToggleStatus={handleToggleStatus} />
          <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
        </React.Fragment>
      )}

      <Modal
        open={!!noteToDelete}
        onClose={function () {
          setNoteToDelete(null);
        }}
        title="Delete Note"
        footer={
          <React.Fragment>
            <Button variant="secondary" onClick={function () { setNoteToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              Delete
            </Button>
          </React.Fragment>
        }
      >
        <p className="text-body-md text-text-secondary">
          Are you sure you want to delete "{noteToDelete ? noteToDelete.title : ''}"? This will permanently
          remove the file from storage and cannot be undone.
        </p>
      </Modal>
    </AppShell>
  );
}
