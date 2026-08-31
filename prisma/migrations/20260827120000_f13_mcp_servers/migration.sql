-- F13-T3 — MCP servers + discovered tools
CREATE TYPE "McpTransport" AS ENUM ('HTTP', 'SSE');
CREATE TYPE "McpAuthType" AS ENUM ('NONE', 'BEARER', 'HEADER');

CREATE TABLE "AgentMcpServer" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "transport" "McpTransport" NOT NULL DEFAULT 'HTTP',
    "url" TEXT NOT NULL,
    "frozenHost" TEXT,
    "authType" "McpAuthType" NOT NULL DEFAULT 'NONE',
    "headerName" TEXT,
    "credentialId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastProbeAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMcpServer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentMcpTool" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "functionName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "inputSchemaJson" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "riskLevel" "ActionRiskLevel" NOT NULL DEFAULT 'READ',
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMcpTool_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ToolRun" ADD COLUMN "mcpToolId" TEXT;

CREATE UNIQUE INDEX "AgentMcpServer_agentId_name_key" ON "AgentMcpServer"("agentId", "name");
CREATE INDEX "AgentMcpServer_agentId_idx" ON "AgentMcpServer"("agentId");
CREATE INDEX "AgentMcpServer_agentId_enabled_idx" ON "AgentMcpServer"("agentId", "enabled");
CREATE INDEX "AgentMcpServer_credentialId_idx" ON "AgentMcpServer"("credentialId");

CREATE UNIQUE INDEX "AgentMcpTool_serverId_name_key" ON "AgentMcpTool"("serverId", "name");
CREATE UNIQUE INDEX "AgentMcpTool_serverId_functionName_key" ON "AgentMcpTool"("serverId", "functionName");
CREATE INDEX "AgentMcpTool_serverId_enabled_idx" ON "AgentMcpTool"("serverId", "enabled");

CREATE INDEX "ToolRun_mcpToolId_idx" ON "ToolRun"("mcpToolId");

ALTER TABLE "AgentMcpServer" ADD CONSTRAINT "AgentMcpServer_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentMcpServer" ADD CONSTRAINT "AgentMcpServer_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ActionCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentMcpTool" ADD CONSTRAINT "AgentMcpTool_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "AgentMcpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolRun" ADD CONSTRAINT "ToolRun_mcpToolId_fkey" FOREIGN KEY ("mcpToolId") REFERENCES "AgentMcpTool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
