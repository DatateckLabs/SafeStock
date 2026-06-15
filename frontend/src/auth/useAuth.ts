import { useState, useEffect, createContext, useContext } from "react";
import type { MeResponse } from "../types";

const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL as string;
const APP_PREFIX    = import.meta.env.VITE_APP_PREFIX as string;
const API_BASE_URL  = import.meta.env.VITE_API_BASE_URL as string;

interface AuthState {
  user: MeResponse | null;
  loading: boolean;
  logout: () => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthState {
  const [user, setUser]       = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken  = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken) {
      sessionStorage.setItem("access_token", accessToken);
      if (refreshToken) sessionStorage.setItem("refresh_token", refreshToken);
      window.history.replaceState({}, "", window.location.pathname);
    }

    const token = sessionStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    // Busca role real no backend (admin/gestor/operador via UserProfile)
    fetch(`${API_BASE_URL}/api/v1/me/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((me: MeResponse) => setUser(me))
      .catch(() => sessionStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    sessionStorage.clear();
    // Fix 4 — next com href completo
    const next = encodeURIComponent(window.location.href);
    window.location.href = `${AUTH_BASE_URL}/${APP_PREFIX}/login/?next=${next}`;
  }

  return { user, loading, logout };
}
