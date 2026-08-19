/** Reserved operator email from env. Never a Google/customer signup. */
export function reservedAdminEmail() {
  return String(process.env.ADMIN_BOOTSTRAP_EMAIL || "")
    .trim()
    .toLowerCase();
}

export function isReservedAdminEmail(email) {
  const reserved = reservedAdminEmail();
  if (!reserved || !email) return false;
  return String(email).trim().toLowerCase() === reserved;
}
