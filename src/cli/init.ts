import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import pc from "./colors.js";
import { ACTION_REF, STATUS_CONTEXT } from "../core/certify.js";

const WORKFLOW_PATH = ".github/workflows/poppr.yml";

/**
 * The workflow, written out in full rather than assembled from fragments.
 *
 * Someone is going to read this file in their own repo and decide whether to
 * trust it, so it has to be readable as YAML here too. The fork-safety comment
 * ships with it deliberately: `pull_request_target` runs with a write token in
 * the base repo's context, and the usual way that becomes a supply chain hole is
 * checking out the PR head and running its code. This workflow does neither, and
 * the next person to edit it needs to know that is the invariant.
 */
function workflow(certify: boolean): string {
  // Only the `with:` block differs. An empty `with:` is legal YAML and pure
  // noise, so the whole block goes when there is nothing to configure.
  const step = certify
    ? `      - uses: ${ACTION_REF}\n        with:\n          certify: true\n`
    : `      - uses: ${ACTION_REF}\n`;

  // Reporting-only repos never reach a postStatus call and never read a
  // comment, so asking for `statuses: write` and waking a runner on every
  // comment in the repo would be scope and minutes spent on nothing. Under
  // pull_request_target that is not merely untidy: it is a write scope handed
  // to an npx-fetched package on every fork PR, for a code path that cannot
  // use it.
  const commentTrigger = certify
    ? `  issue_comment:\n    types: [created, edited]\n`
    : "";
  const statusScope = certify ? "  statuses: write\n" : "";
  const jobGuard = certify
    ? "github.event_name == 'pull_request_target' || github.event.issue.pull_request"
    : "github.event_name == 'pull_request_target'";

  return `name: PopPR

# Fork-safe by construction: this workflow never checks out or executes PR code,
# so pull_request_target's write token cannot be turned against the repo.

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
${commentTrigger}
permissions:
  contents: read
  pull-requests: write
${statusScope}
# Keyed by comment id as well as PR, because these runs must not cancel each
# other. A push should supersede the run it interrupted, but two comments in
# quick succession are independent: cancelling the first would kill the run that
# writes the success status, and nothing would heal it until the next push.
concurrency:
  group: poppr-\${{ github.event_name }}-\${{ github.event.pull_request.number || github.event.issue.number }}-\${{ github.event.comment.id }}
  cancel-in-progress: true

jobs:
  poppr:
    runs-on: ubuntu-latest
    if: ${jobGuard}
    steps:
${step}`;
}

/**
 * Write the workflow, or explain why we did not.
 *
 * Idempotent on purpose: `poppr init` is the sort of command people run twice
 * because they cannot remember whether they ran it once, and a second run that
 * silently rewrites a file the maintainer has since edited is how a setup
 * command loses trust.
 */
export async function runInit(opts: { certify?: boolean; force?: boolean }): Promise<void> {
  const path = join(process.cwd(), WORKFLOW_PATH);
  const wanted = workflow(!!opts.certify);
  const existing = await readFile(path, "utf8").catch(() => null);

  // Compare content, not bytes. A Windows checkout with core.autocrlf=true holds
  // this exact file with CRLF endings, and a byte-exact test called that
  // "differs from what I would write": `poppr init` told the maintainer their
  // own untouched file was modified, and exited 1. .gitattributes stops new
  // checkouts drifting; this keeps the ones that already have.
  if (existing !== null && existing.replace(/\r\n/g, "\n") === wanted.replace(/\r\n/g, "\n")) {
    console.log("");
    console.log(`  ${pc.dim(WORKFLOW_PATH)} is already set up. Nothing to do.`);
    console.log("");
    return;
  }

  if (existing !== null && !opts.force) {
    console.log("");
    console.log(
      pc.yellow(`  ${WORKFLOW_PATH} exists and differs from what I would write.`),
    );
    console.log(
      pc.dim("  Left it alone. Run `poppr init --force` to overwrite it, or edit it by hand."),
    );
    console.log("");
    // Non-zero so a script that chains off `poppr init` notices, without
    // aborting mid-write the way a throw would.
    process.exitCode = 1;
    return;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, wanted, "utf8");

  console.log("");
  console.log(`  ${pc.green("Wrote")} ${pc.bold(WORKFLOW_PATH)}`);
  console.log("");
  console.log("  Commit and push it. From the next PR on, PopPR comments what the diff");
  console.log("  touches and links to the quiz.");
  console.log("");

  if (!opts.certify) {
    console.log(
      pc.dim("  To require a passing quiz before merge: `poppr init --require --force`."),
    );
    console.log("");
    return;
  }

  console.log(`  The quiz is on, so the workflow reports a ${pc.bold(STATUS_CONTEXT)} check.`);
  console.log("  To make that check a hard gate, in your browser:");
  console.log("");
  console.log("    1. Settings");
  console.log("    2. Branches");
  console.log("    3. your branch protection rule for the default branch");
  console.log("    4. Require status checks to pass");
  console.log(`    5. add ${pc.bold(STATUS_CONTEXT)}`);
  console.log("");
  // The search box on that screen only lists checks GitHub has seen in the
  // last week, so a fresh install finds nothing there and the maintainer
  // concludes the check does not exist.
  console.log(
    pc.dim("  Open one PR first. That box only lists checks that have already run."),
  );
  console.log("");
  console.log(
    pc.dim("  Until it is marked required the check is informational: it reports, and"),
  );
  console.log(
    pc.dim("  nothing blocks on it. Making it required is your own act, on purpose. A"),
  );
  console.log(
    pc.dim("  tool that could start blocking merges the moment you installed it is a"),
  );
  console.log(pc.dim("  tool nobody installs."));
  console.log("");
}
