import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Spinner from '../common/Spinner';
import ErrorState from '../common/ErrorState';

export default function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading, sessionError, refreshUser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" label="Loading StudyKarle..." />
      </div>
    );
  }

  if (sessionError && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorState message={sessionError} onRetry={refreshUser} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
