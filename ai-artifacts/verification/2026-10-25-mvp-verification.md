# MVP verification — 2026-10-25

## Passed

- `npm test`: 4 files, 15 tests passed. Covers independent session I/O, bounded replay/sequence, failed spawn, process exit, stop/restart, input/resize validation, cleanup, executable launch selection, startup UI, creation/selection, directory picker, and three-session split focus regression.
- `npm run build`: TypeScript check and electron-vite main/preload/renderer production bundles passed.
- `npm audit --omit=dev`: 0 vulnerabilities at verification time.
- Actual Electron 42.11.18 native PTY test: `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron scripts/native-pty-smoke.cjs` received 11,708 output characters from installed Pi. No model prompt was submitted. This verifies native ABI, PTY spawn, and Pi producing output, not full UI rendering.

## Not passed / not yet verified

- `node scripts/smoke.mjs`: timed out connecting Playwright to Chromium DevTools in this environment. Electron starts and exposes debugger endpoints, but test never reaches its first-window assertions. No end-to-end desktop or screenshot success is claimed.
- `npm run pack`: Linux unpacked directory built successfully at `release/linux-unpacked`. Packaged Electron successfully loaded node-pty from app.asar and printed `PACKAGED_PTY_OK` from a real PTY. Packaged GUI, AppImage installer, and end-to-end UI remain unverified.
- Windows native PTY, launcher and installer have not been run; launcher behavior only unit-tested.
- App termination behavior with Pi-created descendants and forced crashes remains a limitation.

## Dependency setup observations

Electron's automatic downloader stalled. The official Linux archive was downloaded with curl and its SHA-256 checked against the installed Electron package checksums before local extraction. This was a local dependency repair, not a change to Electron source or release packaging.

## Parallel review

- UI reviewer identified an inability to select arbitrary split pairs with 3+ sessions. Fixed by tracking the secondary session explicitly and adding a regression test, observed failing before the fix and passing afterward.
- Packaging reviewer exceeded its turn limit without a final report; no packaging approval is claimed.
- Backend reviewer hit its turn limit but returned partial findings. These are not a completed security approval. Parent checked the referenced implementation: retained stopped sessions consume the 32-entry cap with no discard action; production HTML retains localhost connect-src allowances intended for development; a synchronous PTY kill error propagates through restart; output trimming can bisect a UTF-16 surrogate pair. These remain open, not fixed. The retained-session cap is consistent with the documented 32 sessions per app, but missing discard is a usability limitation. Do not swallow arbitrary kill errors without checking whether the old process is still alive, because restarting could create an untracked duplicate process. Reviewer test counts reflect an earlier snapshot; final parent verification was 4 files / 15 tests.
