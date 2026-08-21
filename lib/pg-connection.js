/**
 * node-pg v8 treats sslmode=require as verify-full and warns.
 * Keep that stricter behavior explicitly so the warning goes away.
 */
export function withVerifyFullSsl(connectionString) {
  if (!connectionString) return connectionString;
  if (/[?&]sslmode=/i.test(connectionString)) {
    return connectionString.replace(
      /([?&]sslmode=)(require|prefer|verify-ca)\b/i,
      "$1verify-full"
    );
  }
  const sep = connectionString.includes("?") ? "&" : "?";
  return `${connectionString}${sep}sslmode=verify-full`;
}
