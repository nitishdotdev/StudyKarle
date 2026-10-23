import React from 'react';
import { Link } from 'react-router-dom';
import { formatBytes } from '../../utils/formatBytes';
import { formatDate } from '../../utils/formatDate';
import Button from '../common/Button';
import { paymentAccessPath } from '../../utils/paymentRedirect';

export default function SavedFileItem({ file }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-border-subtle shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-6">
      <div className="w-16 h-20 bg-error-container/30 rounded-lg flex flex-col items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-error text-4xl" aria-hidden="true">
          picture_as_pdf
        </span>
        <span className="text-[10px] font-bold text-error mt-1">PDF</span>
      </div>

      <div className="flex-1 text-center md:text-left min-w-0">
        <h3 className="font-headline-md text-headline-md text-text-primary mb-2 truncate">
          {file.name}
        </h3>
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-y-2 gap-x-4">
          <div className="flex items-center text-body-sm text-text-muted">
            <span className="material-symbols-outlined text-[18px] mr-1" aria-hidden="true">
              save
            </span>
            {formatBytes(file.size_bytes)}
          </div>
          {file.modified_time ? (
            <div className="flex items-center text-body-sm text-text-muted">
              <span className="material-symbols-outlined text-[18px] mr-1" aria-hidden="true">
                event
              </span>
              {formatDate(file.modified_time)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0">
        <Link
          to={
            file.protected && !file.canPreview
              ? paymentAccessPath(file.accessCode)
              : "/drive/file/" + encodeURIComponent(file.driveId)
          }
        >
          <Button variant="primary" size="md">
            {file.protected && !file.canPreview ? "Unlock" : "Preview"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
