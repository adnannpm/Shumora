# Shumora

**A desktop workspace for terminal-based AI coding agents, with project terminals, split panes, and a local 9router dashboard in one app.**

[Download Shumora](https://www.shumora.my.id/) · [Documentation](https://www.shumora.my.id/docs) · [Source code](https://github.com/adnannpm/Shumora)

## What is Shumora?

Shumora gives your AI coding terminals a dedicated desktop workspace. Instead of switching between separate terminal windows, you can organize sessions into tabs, work on different project folders, and view multiple terminals side by side.

The coding agent still runs in a real terminal. Shumora provides the application around it: session management, layouts, tool setup, package browsing, Git review, and integrations. It does **not** replace the agent, provide an AI model of its own, or include a model subscription.

### How the pieces fit together

| Component | What it does |
| --- | --- |
| **Shumora** | The desktop workspace: terminals, project folders, layouts, settings, and integration controls. |
| **Pi / OpenCode** | The coding agent that reads your project, runs tools, and communicates with a model. Pi is the supported first-run setup path; OpenCode can be selected in terminal-agent settings when installed. |
| **AI provider** | Supplies model access. Credentials, subscriptions, credits, and model capabilities depend on your provider and agent configuration. |
| **9router** | An optional local AI gateway for provider connections, model routing, and an OpenAI-compatible endpoint. Shumora can display and manage its local dashboard data. |

You do not need to clone or modify Pi's source code to use Shumora. Agent tools are separate installations; Shumora can help you detect and install supported tools with your confirmation.

## Download and documentation

**To use Shumora, start at [www.shumora.my.id](https://www.shumora.my.id/)** and choose an available download for your operating system. You do not need to clone this repository or run the development commands below just to use a packaged application.

For installation instructions, configuration, and usage guides, visit **[Shumora Docs](https://www.shumora.my.id/docs)**.

Shumora is under active development. Available installers and platform support can vary by release; consult the website and release notes rather than assuming every packaging target has been validated.

## Your first session

1. **Install and open Shumora.** Download it from the website, then follow the installation instructions for your platform.
2. **Complete tool setup.** The first-run guide checks your installation tools and Pi. Missing supported tools can be reviewed through **Library → Plugins** before you approve installation. The current guide also checks the `pi-9router-ext` Pi extension; installing the local 9router service is optional.
3. **Configure model access.** Authenticate your coding agent with a supported provider, or configure it to use your gateway. Installing Shumora does not automatically sign you in to an AI provider.
4. **Open Terminals and choose your project folder.** Create a session in the repository you want the agent to work on. Separate sessions can use different folders.
5. **Start working in the agent's terminal interface.** Write prompts and use the commands supported by your selected agent. Split the workspace when you want to see multiple sessions at once.

Switching tabs or navigating to another page does not stop a running terminal. Closing a session or quitting the application can interrupt its work; review confirmation dialogs before continuing.

## What you can do

### Organize coding sessions

- Create and switch between session tabs, rename terminals, and choose project folders.
- Arrange sessions in **up to four panes**, with horizontal or vertical splits and resizable dividers.
- Keep sessions running while you view another tab or page.
- Stop or restart individual sessions and inspect launch errors.
- Select Pi or an installed OpenCode as the agent for new terminal sessions. Close terminal tabs before changing the agent.

### Manage tools and extensions

- Browse Pi packages and inspect package details before installing third-party code.
- Find supported tools in **Library → Plugins**, with search and category filters.
- Review installation status, updates, and operation output.
- Use **Settings** for appearance, language, terminal-agent selection, troubleshooting, and supported cache cleanup.

### Use 9router from the workspace

When 9router is installed, its integration appears in the sidebar:

- **Overview:** local service status, the API endpoint, and API-key management.
- **Providers:** provider connections and connection-management actions.
- **Quota & Usage:** provider-reported limits, credit balances, reset windows, account filters, and compact model lists.
- **Models:** model availability settings, search, provider filters, and routing aliases.
- **Logs:** output from a 9router process started by Shumora.

Sign in with your **local 9router dashboard password**, not a provider API key. This dashboard session is separate from your browser login and ends when Shumora closes or you sign out. Signing out does not stop 9router or delete provider accounts.

Quota is not a shared token wallet. Providers may report different units or omit balances and reset times. Shumora does not invent missing totals or combine unrelated provider balances.

An externally started 9router process must be managed outside Shumora. Shumora's service Stop and Restart controls apply only to processes it starts.

### Review project work

- Inspect Git changes and use the workspace's Git review controls.
- Use **Council** for the application's meeting workflow and role configuration. This is separate from ordinary terminal tabs; it is not a guarantee that independent agent sessions automatically share context.

## Requirements

### For desktop users

- A desktop environment supported by the installer you download.
- An installed coding agent, such as Pi, and any runtime required by that installation. Use the setup guide or Library to review supported installation options.
- Model access configured for your agent: a provider account, API credentials, or a compatible gateway, depending on your setup.
- On Linux, Electron's system libraries and appropriate sandbox support..

Shumora does not bundle provider subscriptions or grant access to paid models. Usage charges and account limits remain with your providers.

### For contributors building from source

- Node.js **22.19 or later**, using a version supported by the dependencies, and npm.
- A desktop display for launching Electron.
- A native build toolchain if compatible dependency binaries are unavailable: C/C++, make, and Python on Linux; appropriate Visual Studio Build Tools and Python on Windows.

Built with **Electron, React, TypeScript, xterm.js, node-pty, and SQLite**. Native dependencies are prepared for Electron during installation.

## Run from source

```bash
git clone https://github.com/adnannpm/Shumora.git
cd Shumora
npm install
npm run dev
```

If a packaged Shumora instance is already running, use a separate development profile to avoid the single-instance lock and keep development settings separate:

```bash
npm run dev -- -- --user-data-dir=/absolute/path/to/shumora-dev-profile
```

A separate profile also has separate Shumora settings and state. Coding agents still run under your OS user and can access their own existing configuration.

### Configure the Pi executable

If Pi is not available on the application's `PATH`, specify its executable before launching Shumora.

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

These variables must be available when the application launches. A desktop-menu launch may inherit a different `PATH` from your terminal. If a terminal will not open, use the terminal check in Settings and review the detected installation.

Pi package-manager installs also check the selected manager's global package and bin locations. Newly discovered bin directories are added to Shumora's process PATH (not the system PATH). If another Pi executable shadows the installed one, the operation reports both paths rather than replacing or deleting the existing installation.

Package-manager mutations have a 15-minute timeout and stream stdout/stderr into the operation log. For slower systems, set `SHUMORA_INSTALL_TIMEOUT_MS` before launching Shumora; accepted values are 120000–3600000 milliseconds. For example, `$env:SHUMORA_INSTALL_TIMEOUT_MS = '1800000'` in PowerShell allows 30 minutes. Failure logs include the executable, timeout, exit code, signal, and termination reason; an external signal is not labelled as a user cancellation.

## Development and validation

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the application in development mode |
| `npm test` | Run backend and UI regression tests |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Check release metadata and types, then build the application |
| `node scripts/smoke.mjs` | Run the desktop smoke test against an installed Pi runtime |
| `npm run pack` | Build an unpacked application directory |
| `npm run dist` | Build distribution artifacts for the current target platform |

Desktop smoke tests require a working display, Electron, and an installed Pi runtime. They do not establish that provider authentication, model requests, clipboard behavior, or every packaged platform works correctly. Unit tests and successful builds are not substitutes for testing an installer on its target OS.

## Release notes and packaging

Shumora bundles version-specific **What's New** notes and lets you reopen them from Settings. The application and GitHub Release use `changelogs/<version>.md` as the shared release-note source.

Build output goes to `out/`; packaged artifacts go to `release/`. Configured distribution targets are **Linux AppImage**, **Windows NSIS**, and **macOS DMG/ZIP**. A configured target is not a claim that the current release has been tested on that platform.

Supported packaged Windows NSIS and Linux AppImage installations have manual update checks, requested downloads, and a confirmed restart/install. Automatic downloads and install-on-exit are disabled. macOS automatic installation requires signing configuration. Save your work before installing an update because restarting stops managed sessions.

For version preparation, owner approval, publishing, signing limitations, and failure recovery, see the [release guide](docs/releases.md).

## Important limitations

- **A saved workspace is not a running process.** Restoring terminal entries or layouts does not preserve live agent processes across application exits. Restarting a terminal is not a guarantee of resuming its previous conversation; use the agent's own resume features where supported.
- Normal shutdown stops managed PTYs. Cleanup of agent-created child processes after forced termination is not guaranteed; Shumora is not a production process supervisor.
- Up to **32 open sessions** are supported. Stopped sessions retain their tab until closed. Running many agents can consume substantial RAM and CPU even when their tabs are hidden.
- Terminal output replay is bounded to **512,000 UTF-16 code units per session**. It is not a conversation archive or a complete terminal-screen snapshot.
- The workspace supports up to four panes, not arbitrary freeform docking.
- Process liveness does not necessarily mean the AI is actively working.
- Model capabilities, clipboard-image support, and authentication depend on your agent, terminal integration, platform, and provider. Do not assume that every model accepts images.
- Provider-reported quotas can be unavailable or stale. Refresh failures do not mean your balance is zero.

## Security

Coding agents run with your user's filesystem permissions, credentials, tools, and extensions. They may read or modify files and execute commands. Electron renderer isolation does **not** sandbox the agent's work.

Review third-party packages and installation actions before approving them. A gallery listing is not a security endorsement. Review diagnostic reports before sharing them, even when common secrets and home paths are masked.

Shumora uses an isolated renderer and a restricted preload API, but remains under active development. Do not treat it as production-hardened software or use it for sensitive work without an independent security review.

## Links

- **Downloads and website:** https://www.shumora.my.id/
- **Documentation:** https://www.shumora.my.id/docs
- **Source and issues:** https://github.com/adnannpm/Shumora
- **Pi Coding Agent:** https://pi.dev

## License

Licensed under the [MIT License](LICENSE).
