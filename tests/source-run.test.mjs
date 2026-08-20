import assert from "node:assert/strict";
import test from "node:test";

import { validateSourceRun } from "../scripts/validate-source-run.mjs";

function fixture() {
  const run = {
    id: 1234567890,
    event: "push",
    head_branch: "v0.4.4",
    head_sha: "0123456789abcdef0123456789abcdef01234567",
    path: ".github/workflows/release.yml",
    repository: { full_name: "rikuws/ehto" }
  };
  const jobs = {
    jobs: [
      "Verify release source",
      "Compile macOS Apple Silicon",
      "Compile macOS Intel",
      "Compile Windows x64"
    ].map((name) => ({ name, status: "completed", conclusion: "success" }))
  };
  const artifacts = {
    artifacts: [
      "release-binary-macos-aarch64",
      "release-binary-macos-x86_64",
      "release-binary-windows-x86_64"
    ].map((name) => ({
      name,
      expired: false,
      size_in_bytes: 1024,
      workflow_run: { id: run.id }
    }))
  };
  return {
    version: "0.4.4",
    sourceSha: run.head_sha,
    sourceRunId: String(run.id),
    run,
    jobs,
    artifacts
  };
}

test("accepts exact artifacts from successful compile jobs for the immutable source tag", () => {
  assert.doesNotThrow(() => validateSourceRun(fixture()));
});

test("rejects a mismatched source revision", () => {
  const input = fixture();
  input.sourceSha = "0".repeat(40);
  assert.throws(() => validateSourceRun(input), /revision does not match/);
});

test("rejects an extra or expired artifact", () => {
  const extra = fixture();
  extra.artifacts.artifacts.push({
    name: "source-code",
    expired: false,
    size_in_bytes: 1,
    workflow_run: { id: extra.run.id }
  });
  assert.throws(() => validateSourceRun(extra), /exactly the expected binary artifacts/);

  const expired = fixture();
  expired.artifacts.artifacts[0].expired = true;
  assert.throws(() => validateSourceRun(expired), /expired or empty/);
});
