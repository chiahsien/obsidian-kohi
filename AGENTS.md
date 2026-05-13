# AGENTS.md

Obsidian plugin (desktop-only) that imports KOReader highlights into vault notes via Lua metadata parsing and Nunjucks templates.

## Commands

| Task | Command |
|---|---|
| Dev (watch) | `npm run dev` |
| Build | `npm run build` (runs `tsc -noEmit` then esbuild) |
| Lint | `npm run lint` |
| Test | `npm test` |
| Single test file | `npx vitest run src/lua-parser.test.ts` |

Run order when verifying: `lint` -> `build` -> `test`. Build includes type-check.

## Architecture

Single-package, single entry point at `src/main.ts` -> esbuild bundles to `main.js` (CJS, committed is gitignored build artifact).

Pipeline: `scanner.ts` (find `.sdr` dirs) -> `lua-parser.ts` (recursive descent Lua parser) -> `book-parser.ts` (extract BookData) -> `note-generator.ts` (Nunjucks render) -> `note-writer.ts` (vault write + filename sanitization).

- `lua-parser.ts` is a hand-written recursive descent parser (~325 lines), not a library. Treat it as fragile/precise code.
- `multi-select-modal.ts` — fuzzy-search book picker UI.
- `settings.ts` — plugin settings tab.
- `types.ts` — shared interfaces: `Book`, `Highlight`, `ChapterGroup`, `BookData`, `PluginSettings`.

## Testing

- **Framework**: Vitest, `node` environment.
- **Obsidian mock**: `src/__mocks__/obsidian.ts` — aliased via `vitest.config.ts` `resolve.alias`. Minimal stubs (`Plugin`, `Notice`, `TFile`, `TFolder`, `normalizePath`). Extend this mock when tests need more Obsidian APIs.
- **Test files**: co-located as `*.test.ts` next to source. Tests exist for `lua-parser`, `scanner`, `book-parser`, `note-generator`, `note-writer`.
- **Scanner tests** use real filesystem (`mkdtempSync` + `rmSync` cleanup) — no mocking.

## Lint

ESLint with `eslint-plugin-obsidianmd` (recommended config). Custom rule: `obsidianmd/ui/sentence-case` with brand exceptions `["KOHi", "KOReader", "KOBOeReader"]`. Keep UI strings sentence-case and respect these brand names.

## TypeScript

Strict-ish: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `useUnknownInCatchVariables`. `baseUrl` is `src` — imports use bare names (e.g. `./scanner` not `../src/scanner`).

## Build

esbuild bundles `src/main.ts` -> `main.js`. Externals: `obsidian`, `electron`, all `@codemirror/*`, `@lezer/*`, Node builtins. Output format: CJS, target ES2018. `main.js` is gitignored.

## Conventions

- Only runtime dependency besides `obsidian`: `nunjucks`.
- `manifest.json` and `versions.json` are Obsidian plugin registry files — keep `version` in sync with `package.json`.
- `data.json` is user settings (gitignored).
- `styles.css` is hand-written, no preprocessor. CSS classes prefixed `kohi-`.
- Plugin ID: `kohi`.
