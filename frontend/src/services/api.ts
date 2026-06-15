import axios, { type AxiosError } from "axios";

const API_URL       = import.meta.env.VITE_API_BASE_URL as string;
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL as string;
const APP_PREFIX    = import.meta.env.VITE_APP_PREFIX as string;

if (!API_URL || !AUTH_BASE_URL || !APP_PREFIX) {
  throw new Error("VITE_API_BASE_URL, VITE_AUTH_BASE_URL e VITE_APP_PREFIX são obrigatórios.");
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;

api.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    if (error.response?.status !== 401 || isRefreshing) {
      return Promise.reject(error);
    }
    isRefreshing = true;
    const refreshToken = sessionStorage.getItem("refresh_token");
    if (!refreshToken) {
      redirectToLogin();
      return Promise.reject(error);
    }
    try {
      const { data } = await axios.post(
        `${AUTH_BASE_URL}/${APP_PREFIX}/token/refresh`,
        {},
        { headers: { Authorization: `Bearer ${refreshToken}` } }
      );
      sessionStorage.setItem("access_token", data.access_token);
      if (error.config) {
        error.config.headers = error.config.headers ?? {};
        error.config.headers.Authorization = `Bearer ${data.access_token}`;
        return api(error.config);
      }
    } catch {
      redirectToLogin();
    } finally {
      isRefreshing = false;
    }
    return Promise.reject(error);
  }
);

function redirectToLogin() {
  sessionStorage.clear();
  const next = encodeURIComponent(window.location.href);
  window.location.href = `${AUTH_BASE_URL}/${APP_PREFIX}/login/?next=${next}`;
}
