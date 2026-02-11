# Contributing to obsidian-ts-mcp

Thank you for considering a contribution. This document explains how to get
started and what to expect.

## Development setup

```sh
git clone https://github.com/dickiedyce/obsidian-ts-mcp.git
cd obsidian-ts-mcp
npm install
npm run build
```

Node.js 18 or later is required (see `.node-version`).

## Running tests

```sh
npm test              # single run
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

Tests mock the Obsidian CLI so the desktop app is **not** needed to run them.

## Linting and formatting

```sh
npm run lint          # ESLint
npm run format:check  # Prettier (check only)
npm run format        # Prettier (auto-fix)
```

CI runs both checks on every push and pull request.

## Adding a new tool

1. Add the tool definition in `src/tools.ts` (name, description, JSON schema).
2. Add the handler case in `src/handlers.ts`.
3. Add tests in `tests/handlers.test.ts` and `tests/tools.test.ts`.
4. If the tool has required fields or enum constraints, the validation module
   (`src/validation.ts`) picks them up automatically from the schema.

## Commit messages

Use concise, imperative-tense messages (e.g. "Add get_outline tool").
No emoji prefixes.

## Pull requests

- Keep PRs focused -- one feature or fix per PR.
- Ensure `npm run lint`, `npm run format:check`, `npm run build`, and
  `npm test` all pass before opening.
- Update the README if the change affects user-facing behaviour.

## Code style

- Explicit return types on exported functions.
- JSDoc `@module` headers on every source file.
- Tool definitions in `tools.ts`, handler logic in `handlers.ts` -- keep them
  strictly separated.
- Boolean CLI flags are bare names; string/number params use `key=value`.
- No emoji in code comments, commit messages, or documentation.

## Licence

By contributing you agree that your work will be licensed under the project's
[MIT licence](LICENSE).
