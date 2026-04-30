import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/auth/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
