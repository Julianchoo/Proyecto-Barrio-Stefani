# Repository Guidelines

## Project Structure & Module Organization
- `src/app` hosts the Next.js App Router; treat each route folder as a self-contained module with colocated layouts, loaders, and `route.ts` handlers.
- Shared UI sits in `src/components`, while `src/lib` houses domain helpers (env parsing, storage adapters) and `src/types` captures DTOs.
- Database schemas, migrations, and snapshots live in `drizzle/`; never edit generated SQL without regenerating via the CLI.
- Operational scripts (`scripts/setup.ts`, `scripts/seed-parcelas.ts`) run with `npx tsx`, docs/specs sit in `docs/`, and static assets — including local uploads — belong in `public/` (use `public/uploads` for dev storage).
- Import code via the `@/` alias instead of deep relative paths to keep ownership boundaries clear.

## Build, Test, and Development Commands
- `pnpm dev` – start the Turbopack dev server on `localhost:3000`.
- `pnpm build` – run Drizzle migrations (`db:migrate`) and compile the Next.js production bundle.
- `pnpm start` – serve the production build locally.
- `pnpm lint`, `pnpm typecheck`, `pnpm check` – gate changes with ESLint, `tsc --noEmit`, or both.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:studio` – manage schema changes, apply them, seed reference data, and open the Drizzle Studio UI.
- `pnpm setup` or `pnpm env:check` – bootstrap required env vars and verify configuration before collaborating.

## Coding Style & Naming Conventions
- Prettier (run via `pnpm format`) enforces 2-space indentation, trailing commas, and double quotes; do not hand-tune formatting.
- Components and React Server Components use PascalCase filenames (`ContactForm.tsx`), hooks stay camelCase with a `use` prefix, and Drizzle table definitions use singular nouns (`parcelTable`).
- Keep Next.js app folders kebab-case (`strategic-location`) and export a single default component per route file unless streaming multiple segments.
- Favor small, pure utilities in `src/lib`, and centralize configuration (feature flags, constants) in that folder to avoid circular imports.

## Testing Guidelines
- Today the starter relies on `pnpm lint`, `pnpm typecheck`, and manual smoke testing through `pnpm dev`; treat these as mandatory before opening a PR.
- When you add automated tests, colocate them with the feature using `*.spec.ts(x)` filenames and keep shared mocks under `__mocks__`.
- Seed prerequisite data with `pnpm db:seed` (or targeted fixtures) so auth, chat, and parcel flows have deterministic inputs.
- Aim for coverage of both success and failure paths on any form, mutation, or long-running background action; document gaps directly in the PR description if unavoidable.

## Commit & Pull Request Guidelines
- Follow the existing git history: short, imperative summaries that capture both action and scope (e.g., “Revamp landing page UI and add strategic location content”).
- Keep commits scoped to a single concern (UI, schema, scripts) and mention follow-up items inline with TODO comments when necessary.
- Every PR description should cover purpose, notable implementation details, commands run (`pnpm check`, migrations), screenshots for UI work, and any env/schema changes.
- Link related issues, request review from the domain owner, and confirm Drizzle migrations are backward compatible before merging.

## Security & Configuration Tips
- Copy new secrets from `env.example` into `.env`, run `pnpm env:check`, and never commit real keys.
- Prefer ORM-powered queries and typed env accessors in `src/lib/env.ts` to avoid injection or undefined-variable crashes.
- Clear `public/uploads` of sensitive artifacts before pushing, and rotate OpenRouter or Google credentials whenever sharing preview deployments.
