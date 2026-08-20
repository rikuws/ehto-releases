import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  throw new Error("Expected a numeric release version without a v prefix.");
}

const packagePath = "package.json";
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
packageJson.version = version;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const cargoPath = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8");
const versionLines = cargo.match(/^version = "[^"]+"$/gm) ?? [];
if (versionLines.length !== 1) {
  throw new Error("Expected exactly one package version in the packaging Cargo.toml.");
}
writeFileSync(cargoPath, cargo.replace(versionLines[0], `version = "${version}"`));

console.log(`Prepared the source-free packaging harness for v${version}.`);
