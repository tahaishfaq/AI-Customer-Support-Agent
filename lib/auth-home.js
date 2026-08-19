export function homePathForRole(role) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}
