# Style and Conventions

- TypeScript ESM across all packages (`type: module`).
- Strict TypeScript is enabled in package tsconfigs.
- React components are function components with named exports and JSX runtime (`react-jsx`).
- Client state uses Zustand (`useWorld`) with typed store interfaces and immutable object updates.
- Shared protocol/domain contracts live in `packages/shared`; keep server/client behavior aligned through these types.
- Runtime constants and discriminated unions are used for protocol events and game ids.
- Tests use Vitest and are colocated under `packages/client/tests`, `packages/server/test`, and `packages/server/tests`.
- No ESLint/Prettier config was found in the repo root; follow existing formatting: two-space JSON, semicolons in TS, single quotes in imports/strings, concise comments where useful.
- Existing comments include Polish explanatory notes. Preserve the existing style when editing nearby code; do not mass-translate or churn comments unrelated to the task.
- Avoid broad refactors. This codebase separates shared protocol, server state/watchers/routes, and client rendering/HUD concerns.