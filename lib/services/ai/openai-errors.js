export function isOpenAiCreditError(error) {
  const code = String(error?.code || error?.error?.code || "").toLowerCase();
  const type = String(error?.type || error?.error?.type || "").toLowerCase();
  const message = String(error?.message || error?.error?.message || "").toLowerCase();
  return (
    code === "insufficient_quota" ||
    code === "billing_not_active" ||
    type === "insufficient_quota" ||
    type === "billing_not_active" ||
    /insufficient\s+(quota|credits)|billing.+(inactive|disabled)|quota.+exceeded/.test(message)
  );
}

export function normalizeOpenAiError(error) {
  if (isOpenAiCreditError(error)) {
    return {
      status: 402,
      message: "AI credits are unavailable. Add credits or configure a funded OpenAI API key, then try again.",
      code: "credit_balance_exhausted",
    };
  }
  return null;
}
