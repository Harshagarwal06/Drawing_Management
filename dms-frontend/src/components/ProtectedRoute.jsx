import { Navigate, Outlet } from "react-router-dom";

/**
 * Wraps all authenticated routes.
 * If currentUser is null (not logged in or token cleared), redirect to /login.
 */
export default function ProtectedRoute({ currentUser }) {
  if (!currentUser) return <Navigate to="/login" replace />;
  return <Outlet />;
}
