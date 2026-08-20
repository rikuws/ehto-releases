import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const validator = fileURLToPath(
  new URL("../scripts/validate-release-transfer.mjs", import.meta.url)
);
const stager = fileURLToPath(
  new URL("../scripts/stage-release-bundles.mjs", import.meta.url)
);

function runValidator(...args) {
  return spawnSync(process.execPath, [validator, ...args], { encoding: "utf8" });
}

function runStager(...args) {
  return spawnSync(process.execPath, [stager, ...args], { encoding: "utf8" });
}

test("stages only exact signed macOS products and leaves sidecars behind", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ehto-public-staging-"));
  const source = join(fixture, "source");
  const destination = join(fixture, "staged");
  const dmg = join(source, "dmg");
  const macos = join(source, "macos");
  try {
    mkdirSync(dmg, { recursive: true });
    mkdirSync(join(macos, "Nokeval Ehto.app"), { recursive: true });
    writeFileSync(join(dmg, "Nokeval Ehto_0.4.5_aarch64.dmg"), "dmg");
    writeFileSync(join(dmg, ".DS_Store"), "runner metadata");
    writeFileSync(join(macos, "Nokeval Ehto.app", "app"), "app");
    writeFileSync(join(macos, "Nokeval Ehto.app.tar.gz"), "archive");
    writeFileSync(join(macos, "Nokeval Ehto.app.tar.gz.sig"), "signature");
    writeFileSync(join(macos, "build.log"), "not a release product");

    const staged = runStager(source, destination, "macos-latest");
    assert.equal(staged.status, 0, staged.stderr);
    assert.deepEqual(readdirSync(join(destination, "dmg")), [
      "Nokeval Ehto_0.4.5_aarch64.dmg"
    ]);
    assert.deepEqual(readdirSync(join(destination, "macos")).sort(), [
      "Nokeval Ehto.app",
      "Nokeval Ehto.app.tar.gz",
      "Nokeval Ehto.app.tar.gz.sig"
    ]);
    assert.equal(runValidator("bundles", destination, "macos-latest").status, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("accepts an exact macOS release tree and rejects extra files", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ehto-public-transfer-"));
  const bundle = join(fixture, "bundle");
  const dmg = join(bundle, "dmg");
  const macos = join(bundle, "macos");
  try {
    mkdirSync(dmg, { recursive: true });
    mkdirSync(join(macos, "Nokeval Ehto.app"), { recursive: true });
    writeFileSync(join(dmg, "Nokeval Ehto_0.4.4_aarch64.dmg"), "dmg");
    writeFileSync(join(macos, "Nokeval Ehto.app", "app"), "app");
    writeFileSync(join(macos, "Nokeval Ehto.app.tar.gz"), "archive");
    writeFileSync(join(macos, "Nokeval Ehto.app.tar.gz.sig"), "signature");

    assert.equal(runValidator("bundles", bundle, "macos-latest").status, 0);
    writeFileSync(join(bundle, "source.rs"), "private source");
    const rejected = runValidator("bundles", bundle, "macos-latest");
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /only required release directories/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("rejects symlinks in a transferred Windows bundle", () => {
  const fixture = mkdtempSync(join(tmpdir(), "ehto-public-transfer-link-"));
  const nsis = join(fixture, "bundle", "nsis");
  try {
    mkdirSync(nsis, { recursive: true });
    writeFileSync(join(fixture, "payload"), "payload");
    symlinkSync(join(fixture, "payload"), join(nsis, "Nokeval_Ehto-setup.exe"));
    writeFileSync(join(nsis, "Nokeval_Ehto-setup.exe.sig"), "signature");

    const rejected = runValidator("bundles", join(fixture, "bundle"), "windows-latest");
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /must not contain symbolic links/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
