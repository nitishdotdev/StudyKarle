import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import Seo from '../components/seo/Seo';

export default function NotFoundPage() {
  return (
    <>
      <Seo path="/not-found" noindex />
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center p-6">
      <span className="material-symbols-outlined text-text-muted text-[64px] mb-4" aria-hidden="true">
        search_off
      </span>
      <h1 className="font-headline-xl text-headline-xl text-text-primary mb-2">Page Not Found</h1>
      <p className="text-body-md text-text-secondary mb-8 max-w-sm">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link to="/">
        <Button icon="home">Back to Home</Button>
      </Link>
      </div>
    </>
  );
}
