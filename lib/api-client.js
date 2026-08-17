const AUTH_PUBLIC_PATHS = new Set([
  "/api/auth/register",
  "/api/auth/providers",
  "/api/auth/csrf",
  "/api/auth/session",
  "/api/auth/signin",
  "/api/auth/callback",
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

function isPublicAuthPath(pathname) {
  if (AUTH_PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) {
    // NextAuth catch-all (signin, callback, etc.) — not agents APIs
    return (
      pathname.includes("/callback") ||
      pathname.includes("/signin") ||
      pathname.includes("/signout") ||
      pathname.includes("/session") ||
      pathname.includes("/csrf") ||
      pathname.includes("/providers") ||
      pathname.includes("/error")
    );
  }
  return false;
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
    const isPublicAuth = isPublicAuthPath(pathname);

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
