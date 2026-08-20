import { cpSync, lstatSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

const [sourceArgument, destinationArgument, platform = ""] = process.argv.slice(2);

if (!sourceArgument || !destinationArgument || !platform) {
  fail("Expected source, destination, and platform arguments.");
}

const sourceRoot = resolve(sourceArgument);
const destinationRoot = resolve(destinationArgument);
requireRealDirectory(sourceRoot, "source bundle root");
mkdirSync(destinationRoot, { recursive: true });
requireRealDirectory(destinationRoot, "staged bundle root");

const sourceReal = realpathSync(sourceRoot);
const destinationReal = realpathSync(destinationRoot);
const destinationFromSource = relative(sourceReal, destinationReal);
if (
  destinationFromSource === "" ||
  (!destinationFromSource.startsWith(`..${sep}`) && destinationFromSource !== "..")
) {
  fail("Staged bundles must be outside the source bundle tree.");
}
if (readdirSync(destinationRoot).length !== 0) {
  fail("Staged bundle root must be empty.");
}

if (platform.startsWith("macos")) {
  stageMacosBundles();
} else if (platform.startsWith("windows")) {
  stageWindowsBundles();
} else {
  fail("Unsupported release-bundle platform.");
}

console.log("Staged only the expected signed release products.");

function stageMacosBundles() {
  const dmgSource = join(sourceRoot, "dmg");
  const macosSource = join(sourceRoot, "macos");
  requireRealDirectory(dmgSource, "DMG source directory");
  requireRealDirectory(macosSource, "macOS source directory");

  const dmgDestination = join(destinationRoot, "dmg");
  const macosDestination = join(destinationRoot, "macos");
  mkdirSync(dmgDestination);
  mkdirSync(macosDestination);

  copyOne(dmgSource, dmgDestination, (name) => name.endsWith(".dmg"), "file", "DMG");
  copyOne(macosSource, macosDestination, (name) => name.endsWith(".app"), "directory", "app bundle");
  copyOne(
    macosSource,
    macosDestination,
    (name) => name.endsWith(".app.tar.gz"),
    "file",
    "macOS updater archive"
  );
  copyOne(
    macosSource,
    macosDestination,
    (name) => name.endsWith(".app.tar.gz.sig"),
    "file",
    "macOS updater signature"
  );
}

function stageWindowsBundles() {
  const nsisSource = join(sourceRoot, "nsis");
  requireRealDirectory(nsisSource, "NSIS source directory");
  const nsisDestination = join(destinationRoot, "nsis");
  mkdirSync(nsisDestination);

  copyOne(
    nsisSource,
    nsisDestination,
    (name) => name.endsWith("-setup.exe"),
    "file",
    "NSIS installer"
  );
  copyOne(
    nsisSource,
    nsisDestination,
    (name) => name.endsWith("-setup.exe.sig"),
    "file",
    "Windows updater signature"
  );
}

function copyOne(sourceDirectory, destinationDirectory, matches, expectedType, label) {
  const candidates = readdirSync(sourceDirectory)
    .filter(matches)
    .map((name) => join(sourceDirectory, name));

  if (candidates.length !== 1) {
    fail(`Expected exactly one ${label}.`);
  }

  const source = candidates[0];
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) {
    fail(`Expected ${label} to be a non-symlink ${expectedType}.`);
  }
  if (
    (expectedType === "file" && !stat.isFile()) ||
    (expectedType === "directory" && !stat.isDirectory())
  ) {
    fail(`Expected ${label} to be a ${expectedType}.`);
  }

  cpSync(source, join(destinationDirectory, basename(source)), {
    recursive: expectedType === "directory",
    errorOnExist: true,
    force: false,
    preserveTimestamps: true
  });
}

function requireRealDirectory(path, label) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    fail(`Missing or unreadable ${label}.`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`Expected ${label} to be a real directory.`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
