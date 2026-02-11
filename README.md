# obsidian-ts-mcp

A Model Context Protocol (MCP) server that wraps the official Obsidian CLI,
letting AI agents in VS Code (and any other MCP client) read, write, search,
and manage notes inside an Obsidian vault.

## Prerequisites

| Requirement               | Minimum version         |
| ------------------------- | ----------------------- |
| Node.js                   | 18                      |
| Obsidian desktop app      | 1.12 (with CLI enabled) |
| Obsidian Catalyst licence | Required for CLI access |

The Obsidian desktop app must be running when the MCP server is in use.
The `obsidian` binary must be available on your `PATH`.

## Installation

```sh
git clone https://github.com/dd/obsidian-ts-mcp.git
cd obsidian-ts-mcp
npm install
npm run build
```

## Configuration

### VS Code (user-level MCP)

Add the following to your VS Code MCP configuration:

| OS      | Path                                               |
| ------- | -------------------------------------------------- |
| macOS   | `~/Library/Application Support/Code/User/mcp.json` |
| Linux   | `~/.config/Code/User/mcp.json`                     |
| Windows | `%APPDATA%\Code\User\mcp.json`                     |

```json
{
  "servers": {
    "obsidian": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/obsidian-ts-mcp/dist/server.js"],
      "env": {
        "OBSIDIAN_VAULT": "My Vault"
      }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/absolute/path/to/obsidian-ts-mcp/dist/server.js"],
      "env": {
        "OBSIDIAN_VAULT": "My Vault"
      }
    }
  }
}
```

Set `OBSIDIAN_VAULT` to the name of the vault you want to target. The name
must match exactly what Obsidian shows in the vault switcher.

### Environment variables

| Variable         | Description                                    |
| ---------------- | ---------------------------------------------- |
| `OBSIDIAN_VAULT` | Default vault name appended to every CLI call. |

## Available tools

The server exposes 16 tools organised into four groups.

### Core -- note management

| Tool              | Description                                      |
| ----------------- | ------------------------------------------------ |
| `create_note`     | Create a new note, optionally from a template.   |
| `read_note`       | Read the full markdown contents of a note.       |
| `append_to_note`  | Append content to the end of a note.             |
| `prepend_to_note` | Prepend content after the frontmatter of a note. |
| `search_vault`    | Full-text search with Obsidian query syntax.     |
| `daily_note`      | Get or create today's daily note.                |
| `daily_append`    | Append content to today's daily note.            |

### Discovery and context

| Tool             | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `get_vault_info` | Vault name, path, file/folder counts, size.             |
| `list_files`     | List files, optionally filtered by folder or extension. |
| `get_tags`       | List all tags with occurrence counts.                   |
| `get_backlinks`  | Find notes that link to a given note.                   |
| `get_outline`    | Heading structure of a note.                            |

### Properties and metadata

| Tool            | Description                           |
| --------------- | ------------------------------------- |
| `set_property`  | Set a frontmatter property on a note. |
| `read_property` | Read a frontmatter property value.    |

### Tasks

| Tool          | Description                                               |
| ------------- | --------------------------------------------------------- |
| `list_tasks`  | List tasks, with filters for status, file, or daily note. |
| `toggle_task` | Toggle a task checkbox on or off.                         |

## Project structure

```
src/
  cli.ts          -- Low-level Obsidian CLI wrapper (exec, arg building, errors).
  tools.ts        -- MCP tool definitions (names, descriptions, JSON schemas).
  handlers.ts     -- Dispatches tool calls to the appropriate CLI commands.
  server.ts       -- MCP server entry-point (stdio transport, error handling).
  validation.ts   -- Input validation against tool schemas.
tests/
  cli.test.ts           -- Unit tests for argument building and error types.
  runObsidian.test.ts   -- Tests for CLI execution, timeouts, vault targeting.
  handlers.test.ts      -- Tests for all 16 tool handlers (CLI is mocked).
  tools.test.ts         -- Schema validation for every tool definition.
  validation.test.ts    -- Input validation tests (types, enums, required fields).
  server.test.ts        -- Server factory, error formatting, version checks.
```

## Development

```sh
npm run dev           # Watch-mode TypeScript compilation
npm test              # Run the test suite once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run build         # One-shot compilation
npm run lint          # Run ESLint
npm run format:check  # Check Prettier formatting
npm start             # Start the MCP server on stdio
```

## How it works

1. An MCP client (VS Code, Claude Desktop, etc.) launches the server over
   stdio.
2. The client calls `tools/list` and receives the 16 tool definitions from
   `src/tools.ts`.
3. When the client invokes a tool, `src/server.ts` routes the call to
   `handleTool()` in `src/handlers.ts`.
4. `handleTool()` validates input against the tool schema, then uses
   `buildArgs()` and `runObsidian()` from `src/cli.ts` to execute the
   corresponding `obsidian` CLI command.
5. The CLI output is returned to the client as a text content block.

## Testing

Tests use Vitest and mock the CLI layer so they never invoke the real
Obsidian binary. Run:

```sh
npm test
```

## Security considerations

- **Full vault access.** The server has read/write access to every note in the
  targeted vault. Limit `OBSIDIAN_VAULT` to vaults you are comfortable
  exposing to AI agents.
- **No authentication.** The stdio transport has no built-in auth. Access
  control depends entirely on who can launch the server process.
- **Input validation.** All tool inputs are validated against their declared
  schemas before execution. The server uses `execFile` (not `exec`) to avoid
  shell injection, but note that file/path values are passed directly to the
  Obsidian CLI.
- **Environment inheritance.** The child process inherits the parent's
  environment variables. Avoid storing secrets in env vars visible to the
  server process.

## Troubleshooting

**Symptom**
: `obsidian: command not found`  
 **Cause**: CLI binary not on PATH  
 **Fix**: Ensure Obsidian 1.12+ is installed and the CLI is enabled in Settings > General

**Symptom**
: `Command timed out after 15000ms`  
 **Cause**: Obsidian desktop app not running  
 **Fix**: Start the Obsidian app before using the MCP server

**Symptom**
: `vault not found`  
 **Cause**: Vault name mismatch  
 **Fix**: Check that `OBSIDIAN_VAULT` matches the exact name in Obsidian’s vault switcher

**Symptom**
: `Catalyst licence required`  
 **Cause**: Missing licence  
 **Fix**: The Obsidian CLI requires a Catalyst licence — purchase one at obsidian.md

**Symptom**
: Server exits immediately  
 **Cause**: Node.js version too old  
 **Fix**: Ensure Node.js >= 18 (`node --version`)

## Licence

[MIT](LICENSE)
