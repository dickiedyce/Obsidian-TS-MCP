# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `src/fs-ops.ts` -- direct filesystem operations module that bypasses the
  Obsidian CLI when exact path control is needed (mkdir, read, write).
- `create_note` now accepts a `path` parameter for placing notes in
  subdirectories reliably.
- `OBSIDIAN_VAULT_PATH` environment variable for specifying the vault root
  without a CLI round-trip.
- 11 project management tools: `project_create`, `project_list`,
  `project_overview`, `project_context`, `project_summary`,
  `project_dashboard`, `backlog_add`, `backlog_read`, `backlog_done`,
  `backlog_prioritise`, `backlog_reorder`.
- Server now exposes 37 tools (up from 26).
- Tests expanded to 345 (up from 238).
- `tests/fs-ops.test.ts` for filesystem operations.

### Fixed

- `project_create` now creates `Projects/<name>/` directories and files on
  disk instead of silently failing (the CLI ignored directory components in
  the `name` parameter).
- `create_note` with directory paths (e.g. `Projects/Foo/note`) now writes
  to the correct location instead of the vault root.
- `prepend_to_note` and `append_to_note` no longer fuzzy-match when `file`
  contains directory separators -- slashes in `file` are automatically
  converted to a `path` parameter for exact matching.
- Backlog operations (`backlog_add`, `backlog_done`, `backlog_reorder`,
  `backlog_prioritise`) now use direct filesystem I/O for reliable
  path-based reads and writes.

## [0.2.0] - 2026-02-11

### Added

- 10 new tools: `daily_read`, `daily_prepend`, `list_templates`,
  `read_template`, `get_links`, `list_properties`, `remove_property`,
  `get_tag_info`, `move_file`, `query_base`.
- Server now exposes 26 tools (up from 16).
- Tests expanded to 238 (up from 171).

### Changed

- Updated README with documentation for all 26 tools.

## [0.1.0] - 2026-02-11

### Added

- Initial release with 16 MCP tools covering note management, discovery,
  properties, and tasks.
- Obsidian CLI wrapper (`src/cli.ts`) with timeout and vault-targeting support.
- MCP server entry-point with stdio transport (`src/server.ts`).
- Input validation module validating required fields, types, and enum
  constraints against tool schemas (`src/validation.ts`).
- Comprehensive test suite (171 tests across 6 suites) using Vitest with
  mocked CLI layer.
- ESLint (typescript-eslint strict) and Prettier configuration.
- GitHub Actions CI workflow running lint, format check, build, and tests
  across Node.js 18, 20, and 22.
- VS Code and Claude Desktop configuration examples in README.
- Security considerations and troubleshooting guide in README.
