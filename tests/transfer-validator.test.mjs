import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const validator = fileURLToPath(
  new URL("../scripts/validate-release-transfer.mjs", import.meta.url)
);

function runValidator(...args) {
  return spawnSync(process.execPath, [validator, ...args], { encoding: "utf8" });
}

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
