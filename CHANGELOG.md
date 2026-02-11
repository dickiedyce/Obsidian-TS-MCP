# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
