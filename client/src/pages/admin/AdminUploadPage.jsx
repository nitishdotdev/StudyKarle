import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import UploadForm from '../../components/admin/UploadForm';

export default function AdminUploadPage() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="mb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-text-primary mb-1">Upload Notes</h1>
        <p className="text-body-md text-text-secondary">Add a new PDF note to StudyKarle.</p>
      </div>

      <div className="max-w-xl bg-white rounded-xl border border-border-subtle p-6 md:p-8">
        <UploadForm
          onUploaded={function () {
            navigate('/admin/notes');
          }}
        />
      </div>
    </AppShell>
  );
}
