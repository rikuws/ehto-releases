import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const [mode, rootArgument, platform = ""] = process.argv.slice(2);

if (!rootArgument || !["binary", "bundles"].includes(mode)) {
  fail("Expected a release-transfer validation mode and root directory.");
}

const root = resolve(rootArgument);
const rootReal = validateTree(root);

if (mode === "binary") {
  const binaryName = platform;
  if (!binaryName) {
    fail("Expected the transferred native-binary name.");
  }
  requireRegularFile(join(root, binaryName), rootReal, "native binary");
} else if (platform.startsWith("macos")) {
  validateMacosBundles(root, rootReal);
} else if (platform.startsWith("windows")) {
  validateWindowsBundles(root, rootReal);
} else {
  fail("Unsupported release-bundle platform.");
}

console.log("Release transfer contains only expected, contained regular files.");

function validateTree(treeRoot) {
  const rootStat = lstat(treeRoot, "release-transfer root");
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    fail("Release-transfer root must be a real directory.");
  }

  const canonicalRoot = realpathSync(treeRoot);
  const pending = [treeRoot];

  while (pending.length > 0) {
    const path = pending.pop();
    const stat = lstat(path, "release-transfer entry");

    if (stat.isSymbolicLink()) {
      fail("Release transfer must not contain symbolic links.");
    }
    assertContained(canonicalRoot, realpathSync(path));

    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) {
        pending.push(join(path, entry));
      }
    } else if (!stat.isFile()) {
      fail("Release transfer must contain only directories and regular files.");
    }
  }

  return canonicalRoot;
}

function validateMacosBundles(bundleRoot, canonicalRoot) {
  requireExactChildNames(
    bundleRoot,
    ["dmg", "macos"],
    "macOS bundle root"
  );
  const dmgDirectory = requireDirectory(join(bundleRoot, "dmg"), canonicalRoot, "DMG");
  const macosDirectory = requireDirectory(
    join(bundleRoot, "macos"),
    canonicalRoot,
    "macOS bundle"
  );

  requireChildCount(dmgDirectory, 1, "DMG directory");
  requireOne(
    dmgDirectory,
    (name) => name.endsWith(".dmg"),
    canonicalRoot,
    "DMG"
  );
  requireChildCount(macosDirectory, 3, "macOS bundle directory");
  requireOneDirectory(
    macosDirectory,
    (name) => name.endsWith(".app"),
    canonicalRoot,
    "app bundle"
  );
  requireOne(
    macosDirectory,
    (name) => name.endsWith(".app.tar.gz"),
    canonicalRoot,
    "macOS updater archive"
  );
  requireOne(
    macosDirectory,
    (name) => name.endsWith(".app.tar.gz.sig"),
    canonicalRoot,
    "macOS updater signature"
  );
}

function validateWindowsBundles(bundleRoot, canonicalRoot) {
  requireExactChildNames(bundleRoot, ["nsis"], "Windows bundle root");
  const nsisDirectory = requireDirectory(
    join(bundleRoot, "nsis"),
    canonicalRoot,
    "NSIS bundle"
  );

  requireChildCount(nsisDirectory, 2, "NSIS bundle directory");
  requireOne(
    nsisDirectory,
    (name) => name.endsWith("-setup.exe"),
    canonicalRoot,
    "NSIS installer"
  );
  requireOne(
    nsisDirectory,
    (name) => name.endsWith("-setup.exe.sig"),
    canonicalRoot,
    "Windows updater signature"
  );
}

function requireExactChildNames(directory, expectedNames, label) {
  const actualNames = readdirSync(directory).sort();
  const requiredNames = [...expectedNames].sort();

  if (
    actualNames.length !== requiredNames.length ||
    actualNames.some((name, index) => name !== requiredNames[index])
  ) {
    fail(`Expected ${label} to contain only required release directories.`);
  }
}

function requireChildCount(directory, expectedCount, label) {
  if (readdirSync(directory).length !== expectedCount) {
    fail(`Expected ${label} to contain only required release artifacts.`);
  }
}

function requireOne(directory, matches, canonicalRoot, label) {
  const paths = readdirSync(directory)
    .filter(matches)
    .map((name) => join(directory, name));

  if (paths.length !== 1) {
    fail(`Expected exactly one ${label}.`);
  }
  requireRegularFile(paths[0], canonicalRoot, label);
}

function requireOneDirectory(directory, matches, canonicalRoot, label) {
  const paths = readdirSync(directory)
    .filter(matches)
    .map((name) => join(directory, name));

  if (paths.length !== 1) {
    fail(`Expected exactly one ${label}.`);
  }
  requireDirectory(paths[0], canonicalRoot, label);
}

function requireRegularFile(path, canonicalRoot, label) {
  const stat = lstat(path, label);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`Expected ${label} to be a regular non-symlink file.`);
  }
  assertContained(canonicalRoot, realpathSync(path));
  return path;
}

function requireDirectory(path, canonicalRoot, label) {
  const stat = lstat(path, label);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`Expected ${label} to be a real directory.`);
  }
  assertContained(canonicalRoot, realpathSync(path));
  return path;
}

function assertContained(canonicalRoot, canonicalPath) {
  const child = relative(canonicalRoot, canonicalPath);
  if (child === "" || (!isAbsolute(child) && child !== ".." && !child.startsWith(`..${sep}`))) {
    return;
  }
  fail("Release-transfer entry resolves outside its expected root.");
}

function lstat(path, label) {
  try {
    return lstatSync(path);
  } catch {
    fail(`Missing or unreadable ${label}.`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
