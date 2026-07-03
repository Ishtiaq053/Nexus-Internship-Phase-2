import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, also enforce a specific role. */
  role?: 'entrepreneur' | 'investor';
}

/**
 * Wraps protected routes. Redirects to /login when there's no valid session.
 * Passes `from` as location state so the user is sent back after login.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, role }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // While we're restoring the session from sessionStorage, show nothing (avoid flash)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading your session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-gated: if the logged-in user has the wrong role, send to their correct dashboard
  if (role && user?.role !== role) {
    const fallback = user?.role === 'investor' ? '/dashboard/investor' : '/dashboard/entrepreneur';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};
