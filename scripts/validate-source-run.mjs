import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const EXPECTED_JOBS = [
  "Verify release source",
  "Compile macOS Apple Silicon",
  "Compile macOS Intel",
  "Compile Windows x64"
];

const EXPECTED_ARTIFACTS = [
  "release-binary-macos-aarch64",
  "release-binary-macos-x86_64",
  "release-binary-windows-x86_64"
];

export function validateSourceRun({ version, sourceSha, sourceRunId, run, jobs, artifacts }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("Release version must be numeric and must not include a v prefix.");
  }
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error("Source revision must be a full lowercase Git commit SHA.");
  }
  if (!/^\d+$/.test(sourceRunId) || Number(sourceRunId) < 1) {
    throw new Error("Source run ID must be a positive integer.");
  }

  if (run.id !== Number(sourceRunId)) {
    throw new Error("The retrieved workflow run does not match the requested run ID.");
  }
  if (run.repository?.full_name !== "rikuws/ehto") {
    throw new Error("The source workflow run belongs to an unexpected repository.");
  }
  if (run.event !== "push" || run.head_branch !== `v${version}`) {
    throw new Error("The source workflow must be a push run for the matching immutable tag.");
  }
  if (run.head_sha !== sourceSha) {
    throw new Error("The source workflow revision does not match the requested commit.");
  }
  if (run.path !== ".github/workflows/release.yml") {
    throw new Error("The source artifacts came from an unexpected workflow.");
  }

  const latestJobs = new Map(jobs.jobs.map((job) => [job.name, job]));
  for (const name of EXPECTED_JOBS) {
    const job = latestJobs.get(name);
    if (!job || job.status !== "completed" || job.conclusion !== "success") {
      throw new Error(`Required source job did not succeed: ${name}.`);
    }
  }

  const actualArtifacts = [...artifacts.artifacts].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const actualNames = actualArtifacts.map((artifact) => artifact.name);
  if (
    actualNames.length !== EXPECTED_ARTIFACTS.length ||
    actualNames.some((name, index) => name !== [...EXPECTED_ARTIFACTS].sort()[index])
  ) {
    throw new Error("The source workflow did not produce exactly the expected binary artifacts.");
  }

  for (const artifact of actualArtifacts) {
    if (artifact.expired || artifact.size_in_bytes < 1) {
      throw new Error(`Source artifact is expired or empty: ${artifact.name}.`);
    }
    if (artifact.workflow_run?.id !== run.id) {
      throw new Error(`Source artifact is not bound to the validated run: ${artifact.name}.`);
    }
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [version, sourceSha, sourceRunId, runPath, jobsPath, artifactsPath] =
    process.argv.slice(2);
  if (!artifactsPath) {
    throw new Error("Expected release inputs plus run, jobs, and artifacts JSON files.");
  }
  validateSourceRun({
    version,
    sourceSha,
    sourceRunId,
    run: readJson(runPath),
    jobs: readJson(jobsPath),
    artifacts: readJson(artifactsPath)
  });
  console.log("Validated source revision, successful compile jobs, and exact binary artifacts.");
}
