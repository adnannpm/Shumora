# Shumora

**A desktop workspace for managing multiple Pi Coding Agent sessions.**

Shumora brings independent Pi terminals into a single application, combining session tabs with focused and split-screen layouts. It preserves Pi’s native terminal experience while providing a dedicated interface for organizing your work.

Built with Electron, React, TypeScript, xterm.js, and node-pty. Shumora uses an existing Pi installation; cloning or modifying Pi’s source code is not required.

> **Project status:** Early MVP. Linux build and native PTY checks have passed. Full desktop end-to-end testing and Windows runtime validation remain outstanding.

## Features

- **Instant startup:** Opens one Pi session in your home directory when the application starts.
- **Session tabs:** Create sessions with the ＋ button, switch between tabs, and close them with ×. Running sessions require confirmation before they are stopped and removed.
- **Tab groups:** Split the active tab into a second group, arrange groups side by side or top to bottom, and resize the divider by dragging or using arrow keys.
- **Move and merge:** Move the active tab to the other group or merge both groups without restarting Pi. Closing the last tab in a group collapses that group.
- **Reserved sidebar:** The sidebar is intentionally empty for future features.
- **Background continuity:** Hidden sessions keep running when you switch views.
- **Working directory selection:** Choose a directory for newly created sessions without changing existing ones.
- **Session controls:** Stop or restart individual processes and inspect launch errors.
- **Exit confirmation:** Receive a warning before closing the application with active sessions.

## Requirements

- Node.js **22.19 or later**, using a version supported by the project’s dependencies, and npm.
- [Pi Coding Agent](https://pi.dev) installed and available through `pi`, with provider authentication configured in Pi.
- A Linux or Windows desktop environment. Linux requires Electron’s system libraries and appropriate sandbox support.

The native `node-pty` dependency is prepared for Electron during installation. If a compatible prebuilt binary is unavailable, you will need a native build toolchain: a C/C++ compiler, make, and Python on Linux; or the appropriate Visual Studio Build Tools and Python on Windows.

## Getting Started

```bash
git clone https://github.com/adnannpm/Shumora.git
cd Shumora
npm install
npm run dev
```

The first Pi session uses your home directory, not the application’s source directory. Use the folder selector to change the working directory for subsequent sessions.

Pi is an external dependency. Shumora does not bundle or automatically install it.

### Configuring the Pi Executable

If Pi is not available on the application’s `PATH`, specify its executable before launching Shumora.

**Linux**

```bash
PI_EXECUTABLE=/absolute/path/to/pi npm run dev
```

**Windows PowerShell**

```powershell
$env:PI_EXECUTABLE = 'C:\path\to\pi.exe'
npm run dev
```

On Windows, the launcher supports a native `.exe` or a standard npm installation with `pi.cmd` and `node.exe` available on `PATH`. For a nonstandard npm installation, provide explicit paths:

```powershell
$env:PI_EXECUTABLE = 'C:\path\to\pi.cmd'
$env:PI_NODE_EXECUTABLE = 'C:\Program Files\nodejs\node.exe'
$env:PI_CLI_PATH = 'C:\path\to\node_modules\@earendil-works\pi-coding-agent\dist\cli.js'
npm run dev
```

These environment variables must be available when the application launches. Applications opened from a desktop menu may inherit a different `PATH` from your terminal.

## Development and Validation

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the application in development mode |
| `npm test` | Run backend and UI regression tests |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Build the main process, preload, and renderer |
| `node scripts/smoke.mjs` | Run the desktop smoke test against an installed Pi runtime |
| `npm run pack` | Create an unpacked application directory |
| `npm run dist` | Build distribution artifacts for the current target platform |

The desktop smoke test requires a working display, an available Electron binary, and an installed Pi runtime. It checks startup, terminal output, renderer isolation, session creation, layout changes, hidden-session continuity, and process shutdown. It does not submit a model prompt. Playwright may disable the sandbox for its test process; the normal application window is configured with sandboxing enabled.

### Verification Status

- **Passed:** Backend/UI regression tests, TypeScript checks, and production build.
- **Passed:** Browser-rendered workspace fixtures at 1360px and 800px, covering tab groups, both split orientations, pointer resizing, stable terminal mounts, and closing all tabs. These fixtures do not exercise the native Electron confirmation dialog or a live Pi session.
- **Passed:** Native Electron PTY receiving output from the installed Pi runtime.
- **Passed:** Linux unpacked packaging and native PTY loading from the packaged application.
- **Outstanding:** Desktop smoke test, which currently times out during the DevTools connection in the development environment.
- **Outstanding:** Packaged GUI validation, Linux AppImage validation, and Windows runtime and installer testing.

Passing unit tests and packaging checks does not establish release readiness. Internal design notes and verification artifacts are maintained locally and are not included in this repository.

## Release Notes and Publishing

Shumora shows **What's New** once per installed version and lets you reopen it from **Settings → About → Release notes**. Notes are bundled for offline reading. The application and GitHub Release use the same `changelogs/<version>.md` file.

Prepare a version explicitly with `npm run release:prepare -- 0.2.0`, finish the notes, and submit the version changes through a PR. After merging to `main`, the repository owner approves the exact version and commit through the **Approve and build release** GitHub Actions workflow. All Linux, Windows, and macOS build jobs must succeed before publication.

This is not an automatic updater. Installers are initially unsigned, and hosted cross-platform packaging has not been validated by local tests. See [the release guide](docs/releases.md) for approval steps, artifact targets, and failure recovery.

## Packaging

Build output is written to `out/`; packaged artifacts are written to `release/`. Distribution targets are **Linux AppImage**, **Windows NSIS**, and **macOS DMG/ZIP**.

Build and validate releases on their target operating systems to ensure native dependencies are compatible. Code signing, automatic updates, and production installer polish are not configured yet. Release publication is handled separately by the owner-approved workflow.

## Current Limitations

- Workspace settings, layouts, and session selection are not persisted between application launches.
- Restarting creates a new Pi process; it does **not** resume the previous conversation.
- Normal application shutdown stops managed PTYs. There is no background daemon or process persistence after exit.
- Cleanup of Pi-created child processes after forced termination is not guaranteed. Shumora is not a production process supervisor.
- Up to 32 open sessions are supported. Stopped sessions retain their tab until closed; closing a tab releases its slot and output buffer. Closing the final tab leaves an empty workspace rather than automatically starting another process.
- Terminal output replay is limited to 512,000 UTF-16 code units per session. It is not a conversation archive or a complete terminal screen snapshot.
- A maximum of two tab groups is supported. The divider adjusts between 25% and 75%; arrow keys adjust it in 5% steps, Home/End select the limits, and double-click resets it. Freeform docking and drag-and-drop tab movement are not implemented.
- The `running` indicator describes process liveness, not whether the AI is actively working.
- Prompt libraries, model/provider management, native chat views, and inter-agent coordination are not included in this MVP.

## Security Considerations

Pi runs with the current user’s credentials, extensions, tools, and filesystem permissions. Electron renderer isolation does not sandbox the agent’s work or prevent Pi from modifying files.

The application uses an isolated renderer and a restricted preload API. Additional hardening remains necessary before production use, including tightening the production Content Security Policy. Do not treat this MVP as production-hardened software or use it for sensitive work without an independent security review.

## License

Licensed under the [MIT License](LICENSE).
