export const ADMIN_STATIC_TOKEN_STORAGE_KEY = "oyano_admin_token";
export const ADMIN_BEARER_TOKEN_STORAGE_KEY = "oyano_admin_bearer_token";

export function adminHeaders(): HeadersInit {
  const bearerToken = window.localStorage.getItem(ADMIN_BEARER_TOKEN_STORAGE_KEY)?.trim();
  if (bearerToken) return { Authorization: `Bearer ${bearerToken}` };

  const staticToken = window.localStorage.getItem(ADMIN_STATIC_TOKEN_STORAGE_KEY)?.trim();
  return staticToken ? { "x-admin-token": staticToken } : {};
}
