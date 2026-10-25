# Release process

## Source of truth

`package.json` defines the application version. `changelogs/<version>.md` defines the notes for that version. The application bundles that exact file and GitHub Release uses it as its body. Notes render as plain Markdown text in the app, with no HTML execution or remote content. They are available offline.

The What's New dialog appears until dismissed for the installed version. Dismissal is recorded locally. Settings → About → Release notes reopens it. This is not an automatic installer/updater or a remote update notification.

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

Builds run natively on hosted runners. All build jobs must succeed before publishing. The publisher verifies expected files, creates a draft with the exact changelog, uploads assets, then makes it public. If upload/publish fails, a draft or tag may remain; inspect and explicitly clean up that failed candidate before retrying. The workflow never overwrites an existing release/tag.

## Signing and limits

These initial artifacts are **unsigned**. Windows code signing and macOS Developer ID/notarization are not configured; users may see OS security warnings or launch restrictions. Do not present unsigned builds as production-ready. Signing credentials must be stored in GitHub secrets when a separately reviewed signing workflow is added.

Hosted runners (including `macos-15-intel`), native dependencies, and installers must be validated in actual GitHub Actions runs. Local tests/build do not prove that cross-platform packaging works. This change does not run a release, bump the current version, provision signing credentials, or enable automatic updates.

For reproducible public releases, review dependency/action versions and consider pinning action references to audited commit SHAs before release use.
