# Nokeval Ehto releases

This public repository contains the macOS and Windows installers, Tauri updater
archives, signatures, and update feed for Nokeval Ehto.

[Download the latest Nokeval Ehto release](https://github.com/rikuws/ehto-releases/releases/latest)

The application source is maintained separately in a private repository. No
source Excel or ZIP files and no production data are uploaded here. Installed
apps request only public version/platform metadata and signed update artifacts.

Every in-app update is verified against the updater public key embedded in
Nokeval Ehto. Platform trust is a separate layer: a release description will
state whether its macOS artifacts are Apple-notarized and whether its Windows
installer is Authenticode-signed.

## Private-source release builds

This repository contains a minimal Tauri packaging harness, not the application
source. Its manually dispatched workflow checks out one exact tagged revision
from the private `rikuws/ehto` repository into an ephemeral GitHub-hosted runner,
then compiles, signs, packages, and publishes the release. Private build and test
output is redirected to runner-local files and deleted; only signed application
bundles are transferred or uploaded as public artifacts.

The workflow uses a GitHub App installed only on `rikuws/ehto`. The installation
has read-only access to Contents, Actions, and mandatory Metadata, while each
workflow token explicitly requests only **Contents: read**. The App cannot write
to the private repository. Configure the public repository's protected `release`
environment with:

- variable `SOURCE_APP_CLIENT_ID`
- secret `SOURCE_APP_PRIVATE_KEY`
- secrets `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`,
  `APPLE_PASSWORD`, and `APPLE_TEAM_ID`

The environment should require approval. The workflow accepts only an exact
numeric version and full source commit SHA. It requires the matching immutable
private tag, verifies that the commit belongs to private `main`, checks that the
private and public updater keys match, and rejects additional files, symlinks,
and special archive entries before any release upload.
