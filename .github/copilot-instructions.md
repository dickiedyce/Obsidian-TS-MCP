# Obsidian-TS-MCP -- Copilot Instructions

This is an MCP server written in TypeScript that wraps the official Obsidian CLI
(v1.12+). It exposes 26 tools over the Model Context Protocol for AI agents to
read, write, search, and manage notes in an Obsidian vault.

## Project context

- **Language:** TypeScript (ES2022, Node16 module resolution, strict mode).
- **Build:** `tsc` to `dist/`.  No bundler.
- **Test framework:** Vitest.  Tests live in `tests/` and mock the CLI layer.
- **Runtime dependency:** `@modelcontextprotocol/sdk` (reference MCP SDK).
- **External dependency:** The `obsidian` CLI binary, which requires the
  Obsidian desktop app to be running and a Catalyst licence.

## Architecture

| Module | Role |
|---|---|
| `src/cli.ts` | Low-level CLI wrapper (`runObsidian`, `buildArgs`, `ObsidianCliError`). |
| `src/tools.ts` | 16 MCP tool definitions (names, descriptions, JSON schemas). |
| `src/handlers.ts` | Dispatches tool calls to CLI commands (`handleTool`). |
| `src/validation.ts` | Input validation against tool schemas (`validateInput`, `ValidationError`). |
| `src/server.ts` | MCP server entry-point (stdio transport, error formatting). |

## Coding conventions

- Prefer explicit types over inference for exported functions.
- Use JSDoc `@module` headers on every source file.
- Keep tool definitions in `tools.ts` and handler logic in `handlers.ts`
  strictly separated.
- Boolean CLI flags are passed as bare names (no `=true`).  String and number
  params use `key=value` format.
- Do not use emojis in code comments, commit messages, or documentation.
- When adding a new tool: add the definition in `tools.ts`, the handler case
  in `handlers.ts`, and tests in both `handlers.test.ts` and `tools.test.ts`.
