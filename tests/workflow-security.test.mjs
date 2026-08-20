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

test("reads only private Actions artifacts and never checks out private source", () => {
  assert.match(workflow, /permission-actions: read/);
  assert.doesNotMatch(workflow, /permission-contents: read/);
  assert.doesNotMatch(workflow, /git clone/);
  assert.doesNotMatch(workflow, /npm run build/);
  assert.doesNotMatch(workflow, /cargo (build|test|clippy)/);
  assert.match(workflow, /repository: rikuws\/ehto/);
  assert.match(workflow, /run-id: \$\{\{ inputs\.source_run_id \}\}/);
});

test("keeps release credentials step-scoped and publishes with the local token", () => {
  assert.doesNotMatch(workflow, /^env:/m);
  assert.doesNotMatch(workflow, /RELEASE_REPO_TOKEN/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /environment:\n      name: release/g);
  assert.match(workflow, /actions\/create-github-app-token@[0-9a-f]{40}/);
  assert.match(workflow, /latest\.json does not identify the validated source revision/);
});

test("pins every external action to an immutable commit", () => {
  const useLines = workflow.match(/^\s+- uses: .+$/gm) ?? [];
  const uses = useLines.map((line) => line.match(/uses: ([^\s]+)/)?.[1]);
  assert.ok(uses.length > 0);
  for (const action of uses) {
    assert.match(action, /@[0-9a-f]{40}$/);
  }
});
