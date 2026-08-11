const AUTH_PUBLIC_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/google",
]);

function normalizePath(path) {
  if (!path) return "";
  try {
    if (path.startsWith("http")) {
      return new URL(path).pathname;
    }
  } catch {
    // fall through
  }
  return path.split("?")[0];
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : path;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { message: text } };
    }
  }

  if (!response.ok) {
    const pathname = normalizePath(path);
    const isPublicAuth = AUTH_PUBLIC_PATHS.has(pathname);

    // Logged-in user hit 401 → session dead (not wrong password on login form)
    if (response.status === 401 && !isPublicAuth) {
      const { useAuthStore } = await import("@/store/auth-store");
      if (useAuthStore.getState().user) {
        useAuthStore.getState().markSessionExpired();
      }
    }

    const message =
      data?.error?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data?.error?.details || {};
    error.data = data;
    throw error;
  }

  return data;
}
