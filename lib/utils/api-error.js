export function formatApiError(err, fallback = "Something went wrong") {
  const details = err?.details;
  if (details && typeof details === "object") {
    const bits = Object.values(details).filter(
      (value) => typeof value === "string" && value.trim()
    );
    if (bits.length) return bits.join(" · ");
  }
  if (err?.status === 429) {
    return err.message || "Too many requests. Try again shortly.";
  }
  return err?.message || fallback;
}
