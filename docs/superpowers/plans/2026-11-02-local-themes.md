# Local Shumora Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working Theme section to Library's Add-ons tab with local JSON import, preview, activation, deletion and built-in fallback.

**Architecture:** Treat themes as declarative JSON data, never CSS or executable code. Validate a strict schema and colors; store a small bounded theme list in localStorage, reuse AppearanceProvider for applying palette variables, and show installed themes in Library. Retain existing Packages/Plugins behavior and settings theme choices.

**Tech Stack:** React, TypeScript, CSS variables, Vitest/Testing Library.

**Spec:** `ai-artifacts/plans/2026-11-02-shumora-addons-idea.md`; operator selected local import as first phase.

## Global Constraints

- Scope only Theme add-ons; GitHub distribution, Integrations and Features later.
- No remote requests, scripts, CSS injection, file paths or arbitrary properties from imported data.
- Max 64 KiB JSON file, max 20 installed themes; schema `shumora-theme/v1`, slug id, display name, light/dark mode and complete fixed palette.
- No commits or unrelated edits to the already-dirty workspace.

## Review Focus

- Malicious CSS value or unexpected property rejected by strict validation; test parser.
- Oversized or invalid file shows error without changing active theme; test Library.
- Corrupt saved theme storage falls back to built-in; test provider.
- Removing active theme resets built-in mode and CSS variables; test provider.
- Preview never applies globally before explicit activation; test Library.

---

### Task 1: Strict theme format and persistence

**Files:** Create `src/renderer/src/local-themes.ts`, `tests/local-themes.test.ts`, `docs/theme-template.json`.

**Interfaces:** `parseTheme(raw: string): LocalTheme`; `loadThemes(): LocalTheme[]`; `saveThemes(themes: LocalTheme[]): void`. Complete palette matches 10 CSS variables in style.css. Reject unknown fields, invalid ids/colors, oversized data and duplicate ids on import. Template documents manual editing.

- [ ] Write tests for valid template, malicious/unknown values, corrupt persisted data and bounded storage.
- [ ] Run `npx vitest run tests/local-themes.test.ts` and confirm red.
- [ ] Implement parser and persistence; keep the example template valid.
- [ ] Re-run focused tests and confirm green.

### Task 2: Appearance application and rollback

**Files:** Modify `src/renderer/src/Appearance.tsx`; test `tests/theme.test.ts` or new `tests/local-theme-appearance.test.tsx`.

**Interfaces:** Extend `useAppearance()` with `localThemes`, `installTheme(theme)`, `removeTheme(id)`, `selectLocalTheme(id)` while preserving `theme`/`setTheme` light/dark/auto API. Built-in selection clears local selection. Apply fixed palette only to the root inline CSS variables and remove all overrides on switching back/removal.

- [ ] Write tests for activation, persistence, rollback, corrupted storage.
- [ ] Run tests and confirm red.
- [ ] Implement provider state, document root overrides and cleanup.
- [ ] Re-run focused tests and confirm green.

### Task 3: Library Add-ons Theme UI

**Files:** Modify `src/renderer/src/Library.tsx`, `src/renderer/src/style.css`, locale files; create `src/renderer/src/ThemeAddons.tsx`; test `tests/ThemeAddons.test.tsx`.

**Interfaces:** Add Library tab `Add-ons` with Theme section, input accept `.json`, local preview (never global), explicit install/activate and remove, built-in reset. Show errors and installation state without remote requests. Document template path in UI.

- [ ] Write UI tests for import/preview/install/activate/reset/delete and invalid file.
- [ ] Run focused tests and confirm red.
- [ ] Implement accessible, compact UI following Library styling and localizations.
- [ ] Run focused tests, `npm run typecheck`, `npm run build`, and full suite; report baseline failures.
