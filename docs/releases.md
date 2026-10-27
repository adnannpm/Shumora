# Release process

## Source of truth

`package.json` defines the application version. `changelogs/<version>.md` defines the notes for that version. The application bundles that exact file and GitHub Release uses it as its body. Notes render as formatted Markdown in the app, with headings, lists, emphasis, and code. Raw HTML is skipped and remote images are not loaded. Link destinations are displayed as text, not opened automatically. They are available offline.

The What's New dialog appears until dismissed for the installed version. Dismissal is recorded locally. Settings → About → Release notes reopens it. Settings → Updates separately checks published stable GitHub Releases using electron-updater. Downloads start only on request. After download, Restart & install opens a Shumora confirmation dialog, stops managed Pi sessions, and invokes the installer. No background download or automatic install-on-exit is enabled.

## Prepare a version

From a clean working branch:

```bash
npm run release:prepare -- 0.2.0
```

Choose patch/minor/major explicitly. The command requires a stable version higher than the current one. It changes package metadata and lock version and creates a release-note template; it does not create tags, push, build installers, or publish.

Edit `changelogs/0.2.0.md` to describe user-visible changes, remove TODOs, then run:

```bash
npm run release:check
npm test
npm run build
```

Commit the version and notes together and submit a PR. Merge only after review. Merge to main runs CI but does not automatically raise the version, build installers or publish. The owner chooses when the candidate is ready.

## Cross-platform pre-merge checks

Every PR and push to main runs `npm ci`, the complete test suite, the production build, and unsigned unpacked packaging on the same four OS/architecture targets as the release workflow. These jobs never publish. The final `verify` check succeeds only if every platform passes; failed or cancelled platform jobs fail that gate. Superseded CI runs are cancelled to avoid testing stale revisions unnecessarily.

Require **CI / verify** (check context `verify`) in the main branch ruleset and wait for it on the exact approved main SHA before dispatching a release. A workflow file alone cannot prevent an administrator from merging without a required-check rule. Keep the platform matrix synchronized with release; `tests/ci-workflow.test.ts` enforces matching targets and the aggregate gate.

Unpacked CI packaging validates native dependencies and resource layout, not final NSIS/DMG/AppImage creation, signing, installation or live-agent behavior. The release pipeline still tests and builds its immutable source and is the authority for final installer success. Never skip a failing platform or blanket-retry test failures to make a release green. Diagnose the failure, add regression coverage, merge the fix and dispatch a new run for the new SHA; rerunning an old release still uses its old source.

## Approve and build

After the workflow has been merged into main:

1. Open GitHub Actions → **Approve and build release** → **Run workflow**.
2. Select **main**.
3. Enter the version and full 40-character SHA of the approved main head.
4. Run the workflow as the repository owner (`adnannpm` for this repository).

The owner dispatch is the approval gate. Collaborators cannot use this workflow to publish because the authorization job requires `github.actor == github.repository_owner`. Re-runs also require `github.triggering_actor` to be the owner. GitHub workflow modification/admin access must remain restricted. Existing main rules requiring PRs and admin-only merge authority should remain enabled. This gate assumes a personal repository; revisit approval rules before transferring to an organization.

The workflow validates main head at approval, then checks out that immutable commit in every job. Later commits cannot silently enter the approved build. Existing release tags/releases are rejected. Only the publisher job receives repository write permission.

## Artifacts

| Platform | Architecture | Artifacts |
| --- | --- | --- |
| Linux | x64 | AppImage |
| Windows | x64 | NSIS installer (.exe) |
| macOS | Apple Silicon arm64 | DMG and ZIP |
| macOS | Intel x64 | DMG and ZIP |

Builds run natively on hosted runners. All build jobs must succeed before publishing. The pipeline includes `latest.yml`, `latest-linux.yml`, and blockmaps for Windows/Linux updates. macOS metadata is intentionally not published while auto-install is disabled, avoiding architecture collisions from separate macOS matrix jobs. The publisher verifies metadata version, release-note equality, asset sizes and SHA-512 hashes, creates a draft with the exact changelog, uploads assets, then makes it public. If upload/publish fails, a draft or tag may remain; inspect and explicitly clean up that failed candidate before retrying. The workflow never overwrites an existing release/tag.

## Signing and limits

These initial artifacts are **unsigned**. Windows code signing and macOS Developer ID/notarization are not configured; users may see OS security warnings or launch restrictions. Do not present unsigned builds as production-ready. Signing credentials must be stored in GitHub secrets when a separately reviewed signing workflow is added.

Hosted runners (including `macos-15-intel`), native dependencies, and installers must be validated in actual GitHub Actions runs. Local tests/build do not prove that cross-platform packaging works. This change does not run a release, bump the current version, or provision signing credentials. Windows NSIS and Linux AppImage updates are enabled only in packaged applications; macOS auto-install remains disabled until signed/notarized distribution is configured. Development and non-AppImage Linux installations show an unsupported explanation. Real end-to-end installation between two published versions has not been verified.

For reproducible public releases, review dependency/action versions and consider pinning action references to audited commit SHAs before release use.
