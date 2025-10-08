# Repository Guidelines

## Project Structure & Module Organization
- `src/app.js` boots the Express server and wires authentication, scanning, and reporting routes.
- Feature code lives under `src/` in focused folders: `auth/`, `scanner/`, `reporting/`, `storage/`, and shared helpers in `config/` and `utils/`.
- Database tasks are scripted in `database/migrate.js`; generated SQLite files and Jest output stay under `coverage/`.
- Integration tests belong in `tests/integration`; mirror the runtime route layout when adding new suites.

## Build, Test, and Development Commands
- `npm install` sets up Node 18+ dependencies; rerun after updating `package.json`.
- `npm run migrate` initializes or upgrades the embedded SQLite schema before local runs.
- `npm start` launches the production server; `npm run dev` adds `nodemon` reloads for iterative work.
- `npm test` executes the Jest suite once; `npm run test:watch` keeps Jest running during active development.

## Coding Style & Naming Conventions
- Follow the existing 2-space indentation, trailing commas avoided, and CommonJS `require`/`module.exports`.
- Group logic by capability: services end with `.service.js`, repositories with `.repository.js`, route definitions with `.routes.js`.
- Prefer `const` for imports and immutable references, and reuse `logger`/`error-handler` utilities for HTTP middleware.
- Place environment lookups behind config modules (`src/config/*`) so callers import configuration objects, not `process.env`.

## Testing Guidelines
- Write Jest specs under `tests/integration`, naming files `<feature>.spec.js` to match the default runner pattern.
- Target observable behavior: hit HTTP endpoints with SuperTest or mock the Graph client when database access is not required.
- Keep fixtures under `tests/__fixtures__/` (create if missing) and reset SQLite state via `npm run migrate` in test hooks.
- Aim for coverage on critical flows (auth handshake, full scan orchestration, export reporting) before opening a pull request.

## Commit & Pull Request Guidelines
- Use imperative, descriptive commit subjects (e.g., `Add token cleanup scheduler`) following the concise style in recent history.
- Keep individual commits focused; include context in the body when touching auth, database, or scanning concurrency.
- Pull requests should summarize the change, note config or migration impacts, link tracking issues, and confirm `npm test` passes.
- Add screenshots or JSON samples whenever altering report outputs or introducing new endpoints to aid reviewer context.

## Security & Configuration Tips
- Never commit `.env` or SQLite artifacts; rely on `.env.example` for documenting required variables.
- Generate strong `SESSION_SECRET` values and set `SCAN_MODE`/`DB_TYPE` explicitly when deviating from local defaults.
- Review new scopes before requesting Azure consent—limit to the minimum needed by the added feature.
