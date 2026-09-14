export const queryKeys = {
  agents: {
    all: ["agents"],
    detail: (id) => ["agents", id],
  },
  conversations: {
    list: (filters = {}) => ["conversations", "list", filters],
  },
  billing: {
    status: ["billing", "status"],
    plans: ["billing", "plans"],
  },
  desk: {
    waiting: ["desk", "waiting"],
    inbox: (filters = {}) => ["desk", "inbox", filters],
    stats: (days = 7) => ["desk", "stats", days],
    thread: (conversationId) => ["desk", "thread", conversationId],
  },
  analytics: {
    overview: (filters = {}) => ["analytics", "overview", filters],
    dashboard: (filters = {}) => ["analytics", "dashboard", filters],
  },
  workspaces: {
    list: ["workspaces"],
  },
  knowledge: {
    list: (agentId) => ["knowledge", agentId],
  },
  actions: {
    list: (agentId) => ["actions", agentId],
  },
  mcp: {
    list: (agentId) => ["mcp", agentId],
  },
  admin: {
    overview: ["admin", "overview"],
    users: (filters = {}) => ["admin", "users", filters],
    restoreRequests: (status = "PENDING") => ["admin", "restore-requests", status],
    platformDashboard: (range = "7d") => ["admin", "platform-dashboard", range],
  },
};
