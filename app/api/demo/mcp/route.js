/**
 * F13-T3 / DS1 — Local demo MCP endpoint (JSON-RPC over HTTP).
 * Primary tools: aide_demo_get_time (READ), aide_demo_create_note (WRITE).
 * Legacy aliases: get_demo_time, create_demo_note.
 */
import { NextResponse } from "next/server";
import {
  DEMO_MCP_PROTOCOL_VERSION,
  DEMO_MCP_SERVER_INFO,
  callDemoMcpTool,
  listDemoMcpTools,
} from "@/lib/mcp/demo-tools";

function jsonRpcResult(id, result) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function jsonRpcError(id, code, message) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const { id, method, params } = body;

  if (method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: DEMO_MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { ...DEMO_MCP_SERVER_INFO },
    });
  }

  if (method === "notifications/initialized") {
    return new NextResponse(null, { status: 204 });
  }

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: listDemoMcpTools() });
  }

  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments || {};
    if (!name) return jsonRpcError(id, -32602, "Missing tool name");
    return jsonRpcResult(id, callDemoMcpTool(name, args));
  }

  if (method === "ping") {
    return jsonRpcResult(id, {});
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

export async function GET() {
  const tools = listDemoMcpTools();
  return NextResponse.json({
    ok: true,
    ...DEMO_MCP_SERVER_INFO,
    protocolVersion: DEMO_MCP_PROTOCOL_VERSION,
    hint: "POST JSON-RPC: initialize · tools/list · tools/call. Prefer aide_demo_* tool names.",
    tools: tools.map((t) => t.name),
  });
}
