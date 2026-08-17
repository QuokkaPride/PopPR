---
description: Cut a release, which publishes to npm from CI with provenance
---

Release version: **$ARGUMENTS** (omit to pick one from the changes since the last tag)

Publishing is automated. A GitHub release triggers `.github/workflows/publish.yml`,
which runs the tests and publishes via npm **trusted publishing**: GitHub hands npm
a short-lived OIDC identity, npm verifies this workflow in this repository asked to
publish, and attaches a SLSA provenance attestation.

**Never run `npm publish` by hand.** It needs a long-lived token this project
deliberately does not have, and it ships without provenance. Every version from
0.3.1 on carries an attestation; a hand-published one would visibly break that.

## 1. Pick the version

Still 0.x, so: **patch** for fixes, **minor** for anything that changes what an
existing command does. Changing a default is a minor bump even when no flag is
added, because someone's next run behaves differently.

## 2. Check CI is green on `main`

```bash
gh run list --branch main --workflow CI --limit 1
```

The matrix covers ubuntu, windows and macos across Node 18/20/22. Windows is not
optional: the package spawns CLIs and reads git output, and both behave
differently there. `publish.yml` only tests on ubuntu, so the matrix on `main` is
the only thing standing between a Windows bug and the registry.

## 3. Bump and record

```bash
npm version <major|minor|patch> --no-git-tag-version
```

Then add a `CHANGELOG.md` entry under the new version. Lead with what changes for
someone already using it, not with the internals. If a default moved, say so in
the first line.

Commit both, plus `package-lock.json`.

## 4. Cut the release

```bash
git push
v="v$(node -p "require('./package.json').version")"
awk '/^## /{n++} n==1' CHANGELOG.md > /tmp/notes.md
gh release create "$v" --title "$v" --notes-file /tmp/notes.md
```

`awk` rather than `sed` for the changelog slice: the GNU `sed` label syntax that
does this in one expression is a parse error on the BSD `sed` macOS ships.

The tag must be `v` plus the exact `package.json` version. `publish.yml` compares
them and fails the release rather than publishing a mismatch.

## 5. Watch it land

```bash
gh run watch "$(gh run list --workflow Publish --limit 1 --json databaseId -q '.[0].databaseId')"
npm view @quokkapride/poppr version
```

Confirm the attestation survived:

```bash
curl -s https://registry.npmjs.org/@quokkapride/poppr \
  | python3 -c "import json,sys; d=json.load(sys.stdin); v=d['dist-tags']['latest']; print(v, 'provenance:', bool(d['versions'][v]['dist'].get('attestations')))"
```

## If the publish step fails

`npm error 404` or `E401` on a trusted publish usually means the Trusted Publisher
entry is missing or stale. It is configured once per package on npmjs.com under
**Access → Trusted Publisher → GitHub Actions**, and it must name the repository
and the workflow filename `publish.yml`. Re-run the workflow after fixing it:
nothing was published, so the version is still free.
