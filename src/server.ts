#!/usr/bin/env node
/**
 * @module server
 *
 * MCP server entry-point.  Connects to an MCP client (such as VS Code) over
 * stdio and exposes the Obsidian tool set defined in {@link ./tools.ts}.
 *
 * Tool calls are dispatched by {@link handleTool} in {@link ./handlers.ts},
 * which translates each call into an Obsidian CLI invocation.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { tools } from "./tools.js";
import { ObsidianCliError } from "./cli.js";
import { ValidationError } from "./validation.js";
import { handleTool } from "./handlers.js";
import type { ToolInput } from "./handlers.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export const SERVER_NAME = "obsidian-ts-mcp";
export const SERVER_VERSION = pkg.version;

/**
 * Format an error caught during tool execution into a user-facing message.
 */
export function formatToolError(error: unknown): string {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof ObsidianCliError)
    return `Obsidian CLI error (exit ${error.exitCode}): ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Create and configure an MCP server instance with all tool handlers
 * registered. Does not start or connect the server -- call
 * `server.connect(transport)` to begin serving.
 */
export function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const input = (args ?? {}) as ToolInput;

    try {
      const result = await handleTool(name, input);
      return {
        content: [{ type: "text", text: result || "(no output)" }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: formatToolError(error) }],
        isError: true,
      };
    }
  });

  return server;
}

// ── Start ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
