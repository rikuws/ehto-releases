import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/package-release.yml", "utf8");

test("is a trusted manual release workflow with no pull-request or tag trigger", () => {
  assert.match(workflow, /on:\n  workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^  pull_request:/m);
  assert.doesNotMatch(workflow, /^  pull_request_target:/m);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(workflow, /GITHUB_REF" != "refs\/heads\/main"/);
  assert.match(workflow, /Release v\$VERSION already exists/);
  assert.match(workflow, /validate-public-version\.mjs "\$VERSION" "\$latest_tag"/);
});

test("checks out only the exact private revision with a read-only token", () => {
  assert.match(workflow, /permission-contents: read/);
  assert.match(workflow, /repository: rikuws\/ehto/);
  assert.match(workflow, /ref: \$\{\{ inputs\.source_sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /git\/ref\/tags\/v\$VERSION/);
  assert.match(workflow, /compare\/\$SOURCE_SHA\.\.\.main/);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.doesNotMatch(workflow, /source_run_id/);
});

test("keeps private command output runner-local and publishes only bundles", () => {
  assert.match(workflow, /private-source-verify\.log/);
  assert.match(workflow, /private-source-build-\$\{\{ matrix\.transfer_id \}\}\.log/);
  assert.match(workflow, /private logs were not published/);
  assert.match(workflow, /\) >"\$private_log" 2>&1/);
  assert.match(workflow, /stage-release-bundles\.mjs/);
  assert.match(workflow, /signed-release-\$\{\{ matrix\.transfer_id \}\}/);
  const uploadStep = workflow.match(
    /uses: actions\/upload-artifact@[0-9a-f]{40}[\s\S]*?(?=\n      - (?:name|uses|run):|\n  upload:)/
  )?.[0];
  assert.ok(uploadStep, "expected one artifact-upload step");
  assert.doesNotMatch(uploadStep, /path:\s*private-source/);
});

test("keeps release credentials step-scoped and publishes with the local token", () => {
  assert.doesNotMatch(workflow, /^env:/m);
  assert.doesNotMatch(workflow, /secrets\.RELEASE_REPO_TOKEN/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /environment:\n      name: release/g);
  assert.match(workflow, /actions\/create-github-app-token@[0-9a-f]{40}/);
  assert.match(workflow, /latest\.json does not identify the validated source revision/);
  assert.match(workflow, /GH_REPO: \$\{\{ github\.repository \}\}/);
});

test("pins every external action to an immutable commit", () => {
  const useLines = workflow.match(/^\s+- uses: .+$/gm) ?? [];
  const uses = useLines.map((line) => line.match(/uses: ([^\s]+)/)?.[1]);
  assert.ok(uses.length > 0);
  for (const action of uses) {
    assert.match(action, /@[0-9a-f]{40}$/);
  }
});
