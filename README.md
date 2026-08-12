# Kantama releases

This public repository contains the macOS and Windows installers, Tauri updater
archives, signatures, and update feed for Kantama.

[Download the latest Kantama release](https://github.com/rikuws/kantama-releases/releases/latest)

The application source is maintained separately in a private repository. No
source Excel or ZIP files and no production data are uploaded here. Installed
apps request only public version/platform metadata and signed update artifacts.

Every in-app update is verified against the updater public key embedded in
Kantama. Platform trust is a separate layer: a release description will state
whether its macOS artifacts are Apple-notarized and whether its Windows installer
is Authenticode-signed.
