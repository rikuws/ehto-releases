import { pathToFileURL } from "node:url";

export function validatePublicVersion(candidate, latestTag) {
  const candidateParts = parseVersion(candidate, false, "candidate version");
  const latestParts = parseVersion(latestTag, true, "latest public tag");

  for (let index = 0; index < candidateParts.length; index += 1) {
    if (candidateParts[index] > latestParts[index]) return;
    if (candidateParts[index] < latestParts[index]) break;
  }

  throw new Error(`v${candidate} must be newer than ${latestTag}.`);
}

function parseVersion(value, allowPrefix, label) {
  const pattern = allowPrefix ? /^v(\d+)\.(\d+)\.(\d+)$/ : /^(\d+)\.(\d+)\.(\d+)$/;
  const match = pattern.exec(value ?? "");
  if (!match) throw new Error(`Unexpected ${label}: ${value}`);
  return match.slice(1).map(Number);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [candidate, latestTag] = process.argv.slice(2);
  validatePublicVersion(candidate, latestTag);
  console.log(`Validated v${candidate} as newer than ${latestTag}.`);
}
