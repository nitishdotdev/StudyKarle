import React from 'react';
import { Link } from 'react-router-dom';
import { formatBytes } from '../../utils/formatBytes';
import { formatDate } from '../../utils/formatDate';
import Badge from '../common/Badge';

export default function NotesTable({ notes, onDelete, onToggleStatus }) {
  return (
    <React.Fragment>
      <div className="hidden md:block overflow-x-auto bg-white rounded-xl border border-border-subtle">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-low text-text-secondary text-label-sm uppercase tracking-wider">
              <th className="px-6 py-3 font-semibold">Note Title</th>
              <th className="px-6 py-3 font-semibold">Subject</th>
              <th className="px-6 py-3 font-semibold">Size</th>
              <th className="px-6 py-3 font-semibold">Date</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {notes.map(function (note) {
              return (
                <tr key={note.id} className="hover:bg-surface-low transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-error" aria-hidden="true">
                        picture_as_pdf
                      </span>
                      <Link to={"/notes/" + note.id} className="font-medium text-primary hover:underline">{note.title}</Link>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-body-sm text-text-secondary">{note.subject_name}</td>
                  <td className="px-6 py-4 text-body-sm text-text-muted">{formatBytes(note.size_bytes)}</td>
                  <td className="px-6 py-4 text-body-sm text-text-muted">{formatDate(note.created_at)}</td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      aria-label={(note.status === "published" ? "Unpublish " : "Publish ") + note.title}
                      onClick={function () {
                        onToggleStatus(note);
                      }}
                    >
                      <Badge variant={note.status === 'published' ? 'success' : 'neutral'}>
                        {note.status}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={function () {
                        onDelete(note);
                      }}
                      className="text-text-muted hover:text-error transition-colors p-1"
                      aria-label={'Delete ' + note.title}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {notes.map(function (note) {
          return (
            <div key={note.id} className="bg-white p-4 rounded-xl border border-border-subtle">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-error shrink-0" aria-hidden="true">
                    picture_as_pdf
                  </span>
                  <Link to={"/notes/" + note.id} className="truncate font-medium text-primary hover:underline">{note.title}</Link>
                </div>
                <button
                  type="button"
                  onClick={function () {
                    onDelete(note);
                  }}
                  className="text-text-muted hover:text-error transition-colors p-1 shrink-0"
                  aria-label={'Delete ' + note.title}
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
              <p className="text-body-sm text-text-secondary mb-1">{note.subject_name}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-body-sm text-text-muted">
                  {formatBytes(note.size_bytes)} • {formatDate(note.created_at)}
                </span>
                <button
                  type="button"
                  aria-label={(note.status === "published" ? "Unpublish " : "Publish ") + note.title}
                  onClick={function () {
                    onToggleStatus(note);
                  }}
                >
                  <Badge variant={note.status === 'published' ? 'success' : 'neutral'}>{note.status}</Badge>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}
