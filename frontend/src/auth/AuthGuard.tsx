import { useAuth } from "./useAuth";

const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL as string;
const APP_PREFIX    = import.meta.env.VITE_APP_PREFIX as string;

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg text-text-secondary">
        Verificando sessão...
      </div>
    );
  }

  if (!user) {
    // Fix 4 — next com href completo
    const next = encodeURIComponent(window.location.href);
    window.location.href = `${AUTH_BASE_URL}/${APP_PREFIX}/login/?next=${next}`;
    return null;
  }

  return <>{children}</>;
}
