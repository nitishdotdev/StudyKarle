import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authReturnQuery } from '../../utils/sessionReturn';
import useAuth from '../../hooks/useAuth';
import Spinner from '../common/Spinner';
import ErrorState from '../common/ErrorState';

export default function AdminRoute({ children }) {
  const location = useLocation();
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
    return <Navigate to={"/login" + authReturnQuery(location.pathname + location.search)} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
