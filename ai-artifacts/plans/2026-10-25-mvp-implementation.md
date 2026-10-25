# Shumora MVP Implementation Plan

**Goal:** Build the approved terminal-first hybrid desktop MVP without cloning or changing Pi.
**Architecture:** React renders persistent xterm views; a sandboxed preload exposes narrow IPC; Electron owns independent node-pty processes and bounded output replay. Layout never owns process lifetime.
**Stack:** TypeScript, Electron, electron-vite, React, Tailwind CSS, xterm.js, node-pty, Vitest, electron-builder.
**Spec:** [Product design](2026-10-25-ai-workspace-design.md).

## Scope and implementation choices

- Auto-start one Pi session, sidebar create/select/stop/restart, single and two-column split.
- Use installed `pi` (optional executable path via `PI_EXECUTABLE`); do not invoke a general shell on Linux. Windows resolves installed executable or command shim via platform handling.
- Default cwd is user home; native directory picker changes cwd for subsequent sessions, not existing sessions.
- No SQLite, chat replacement, provider management, resume, prompt library, or agent coordination.
- Closing the last window terminates managed sessions after confirmation if processes remain live. Hide/switch does not stop them.
- Packaging configuration is included; OS-specific releases require native validation on both Linux and Windows.

## Review focus

- Early terminal output: snapshot plus sequence numbers must prevent loss/duplication during attachment.
- Failed spawn/missing Pi: session remains visible as an error, restart possible.
- Exited/stopped process: cleanup and repeated stop must not leak or affect another session.
- Invalid renderer requests: IDs, sizes, input, and sender must be validated before PTY operations.
- Hidden terminal: process stays alive, resize only with measurable dimensions.

## Task 1 — Backend lifecycle and foundation

Files: `package.json`, build/TS configs, `src/shared/types.ts`, `src/main/sessions.ts`, `tests/sessions.test.ts`.
- [ ] Set up build/test tooling.
- [ ] Write failing session tests for independent I/O, early output replay, bounded history, spawn errors, exit, stop, restart, resize validation and cleanup.
- [ ] Implement `SessionManager` with injected PTY spawn, event sink, public metadata, and per-session snapshots.
- [ ] Run `npm test` and TypeScript checks.

## Task 2 — Desktop and IPC

Files: `src/main/index.ts`, `src/preload/index.ts`, `src/main/launch.ts`, `tests/launch.test.ts`.
- [ ] Test executable resolution and platform launch behavior before implementation.
- [ ] Add isolated BrowserWindow, validated IPC, directory picker, PTY adapter, and close confirmation.
- [ ] Expose only typed session/workspace operations through preload.
- [ ] Verify renderer cannot directly access Node or arbitrary IPC.

## Task 3 — Workspace UI

Files: `src/renderer/src/App.tsx`, `TerminalPane.tsx`, `style.css`, renderer entry files, UI tests.
- [ ] Write tests for one startup session, create/select sessions, split visibility, and error presentation.
- [ ] Implement sidebar, layout controls, session lifecycle actions, and folder selection.
- [ ] Keep terminal instances mounted across layout changes; attach using snapshot sequence deduplication and bounded replay.
- [ ] Run full tests and production build.

## Task 4 — Verification and handoff

Files: `README.md`, `.gitignore`, smoke-test script as supported by environment.
- [ ] Verify actual native PTY under Electron, not just mocked backend tests.
- [ ] Launch application under available display/headless display and verify IPC, terminal output, isolation, and layout persistence.
- [ ] Document setup, run/build/package commands, external Pi dependency, safety/lifecycle, and remaining cross-platform validation.
- [ ] Record exact test/build results and limitations. No release readiness claim without both OS checks.
