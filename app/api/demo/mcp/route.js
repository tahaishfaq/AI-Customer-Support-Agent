/**
 * F13-T3 — Local demo MCP endpoint (JSON-RPC over HTTP).
 * Tools: get_demo_time (READ), create_demo_note (WRITE).
 */
import { NextResponse } from "next/server";

const TOOLS = [
  {
    name: "get_demo_time",
    description: "Return the current server time (demo READ tool).",
    inputSchema: {
      type: "object",
      properties: {
        timezone: { type: "string", description: "Optional IANA timezone label" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_demo_note",
    description: "Create a demo note (WRITE — requires confirmation in AIDE).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Note body" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
];

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

function handleCall(name, args = {}) {
  if (name === "get_demo_time") {
    const tz = typeof args.timezone === "string" ? args.timezone : "UTC";
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            timezone: tz,
            iso: new Date().toISOString(),
            source: "aide_demo_mcp",
          }),
        },
      ],
    };
  }
  if (name === "create_demo_note") {
    const text = String(args.text || "").trim();
    if (!text) {
      return {
        isError: true,
        content: [{ type: "text", text: "text is required" }],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            id: `note_${Date.now()}`,
            text,
          }),
        },
      ],
    };
  }
  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const { id, method, params } = body;

  if (method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "aide-demo-mcp", version: "0.1.0" },
    });
  }

  if (method === "notifications/initialized") {
    return new NextResponse(null, { status: 204 });
  }

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments || {};
    if (!name) return jsonRpcError(id, -32602, "Missing tool name");
    return jsonRpcResult(id, handleCall(name, args));
  }

  if (method === "ping") {
    return jsonRpcResult(id, {});
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "aide-demo-mcp",
    hint: "POST JSON-RPC: initialize · tools/list · tools/call",
    tools: TOOLS.map((t) => t.name),
  });
}
