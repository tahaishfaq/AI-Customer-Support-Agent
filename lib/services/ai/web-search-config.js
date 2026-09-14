export const DEFAULT_WEB_SEARCH_MODEL = "gpt-4.1-mini";

export function isHostedWebSearchDeploymentEnabled() {
  return process.env.OPENAI_WEB_SEARCH_ENABLED === "true";
}

export function isHostedWebSearchAllowed({ agentEnabled = false } = {}) {
  return isHostedWebSearchDeploymentEnabled() && Boolean(agentEnabled);
}

export function getWebSearchModel() {
  return process.env.OPENAI_WEB_SEARCH_MODEL?.trim() || DEFAULT_WEB_SEARCH_MODEL;
}
