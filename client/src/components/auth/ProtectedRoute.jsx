import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Spinner from '../common/Spinner';
import ErrorState from '../common/ErrorState';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, sessionError, refreshUser } = useAuth();
  const location = useLocation();

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
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
