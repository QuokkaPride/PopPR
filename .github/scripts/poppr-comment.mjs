/**
 * Renders the PR comment from `poppr --detect --json`.
 *
 * The tone matters more than it looks. This comment lands on someone's PR
 * uninvited, so it says what the change touches and stops. No score demand, no
 * checkbox to tick, no implication that a reviewer should wait for anything.
 * The moment it reads like a gate, people turn the workflow off.
 */
import { readFileSync } from "node:fs";

const MARKER = "<!-- poppr-scorecard -->";
const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const pkg = "@quokkapride/poppr";

const out = [MARKER, ""];

if (!data.concepts.length) {
  out.push(
    `**PopPR** found no bank concepts in this diff.`,
    "",
    `The bank covers JS/TS, React, Python, Go and SQL. For questions written about this specific code, \`npx ${pkg} --deep\`.`,
  );
} else {
  const n = data.concepts.length;
  out.push(
    `**PopPR** · this PR touches ${n} concept${n === 1 ? "" : "s"} with ${data.questions} question${data.questions === 1 ? "" : "s"} in the bank.`,
    "",
    "| concept | where |",
    "| --- | --- |",
  );
  for (const c of data.concepts.slice(0, 8)) {
    const files = c.files.slice(0, 2).map((f) => `\`${f}\``).join(", ");
    const more = c.files.length > 2 ? ` +${c.files.length - 2}` : "";
    out.push(`| \`${c.concept}\` | ${files}${more} |`);
  }
  if (data.concepts.length > 8) {
    out.push(`| | and ${data.concepts.length - 8} more |`);
  }
  // The link is the whole point: one click, no install, no account. It works
  // because public repos need no GitHub token, which is also why open source
  // is the right first audience for this.
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  const [owner, name] = repo.split("/");
  const pr = process.env.PR ?? "";
  if (owner && name && pr) {
    out.push(
      "",
      `**[Take the quiz](https://${owner.toLowerCase()}.github.io/${name}/?pr=${owner}/${name}/${pr})** · three minutes in your browser, nothing to install.`,
    );
  }

  out.push(
    "",
    "<details><summary>Prefer the terminal?</summary>",
    "",
    "```bash",
    `npx ${pkg} ${pr}`.trim(),
    "```",
    "",
    "Same quiz. Required for private repositories, where the browser version cannot read the diff.",
    "</details>",
  );
}

process.stdout.write(out.join("\n") + "\n");
