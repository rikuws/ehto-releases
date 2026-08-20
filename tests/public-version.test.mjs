import assert from "node:assert/strict";
import test from "node:test";

import { validatePublicVersion } from "../scripts/validate-public-version.mjs";

test("accepts newer major, minor, and patch versions", () => {
  assert.doesNotThrow(() => validatePublicVersion("1.0.0", "v0.9.9"));
  assert.doesNotThrow(() => validatePublicVersion("0.5.0", "v0.4.9"));
  assert.doesNotThrow(() => validatePublicVersion("0.4.5", "v0.4.4"));
});

test("rejects equal, older, prefixed, and prerelease candidates", () => {
  assert.throws(() => validatePublicVersion("0.4.4", "v0.4.4"), /must be newer/);
  assert.throws(() => validatePublicVersion("0.3.9", "v0.4.4"), /must be newer/);
  assert.throws(() => validatePublicVersion("v0.4.5", "v0.4.4"), /candidate version/);
  assert.throws(() => validatePublicVersion("0.4.5-beta.1", "v0.4.4"), /candidate version/);
});
