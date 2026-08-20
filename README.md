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

## Source-free release packaging

This repository contains a minimal Tauri packaging harness, not the application
source. Its manually dispatched workflow downloads exactly three prebuilt native
binary artifacts from a validated tagged run in the private `rikuws/ehto`
repository. Only those binaries are restored, signed, packaged, and published.

The workflow uses a GitHub App installed only on `rikuws/ehto`, with **Actions:
read** permission and no repository-contents permission. Configure the public
repository's protected `release` environment with:

- variable `SOURCE_APP_CLIENT_ID`
- secret `SOURCE_APP_PRIVATE_KEY`
- secrets `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`,
  `APPLE_PASSWORD`, and `APPLE_TEAM_ID`

The environment should require approval. The workflow accepts only an exact
numeric version, full source commit SHA, and private Actions run ID. It rejects
unexpected jobs, expired artifacts, additional files, symlinks, and special
archive entries before any release upload.
