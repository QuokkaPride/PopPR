import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function gh(args: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await exec("gh", args, { cwd, maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  } catch {
    return null;
  }
}

export interface PrRef {
  number: number;
  title: string;
  url: string;
  state: string;
  headRefName: string;
}

/**
 * Find the PR to quiz on, with no arguments from the user.
 *
 * The design assumption is that PopPR runs in the minute after you ship, so the
 * right answer is almost always "the thing I just pushed". We look for the PR on
 * the current branch first, and only fall back to your most recent PR anywhere
 * in the repo if this branch has none.
 */
export async function findRecentPr(cwd = process.cwd()): Promise<PrRef | null> {
  const onBranch = await gh(
    ["pr", "view", "--json", "number,title,url,state,headRefName"],
    cwd,
  );
  if (onBranch) {
    try {
      return JSON.parse(onBranch) as PrRef;
    } catch {
      /* fall through */
    }
  }

  const mine = await gh(
    [
      "pr",
      "list",
      "--author",
      "@me",
      "--state",
      "all",
      "--limit",
      "1",
      "--json",
      "number,title,url,state,headRefName",
    ],
    cwd,
  );
  if (!mine) return null;
  try {
    const list = JSON.parse(mine) as PrRef[];
    return list[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * owner/repo, from the cheapest source that knows it.
 *
 * The git remote first, because it is local and free. `gh repo view` is a
 * GraphQL round trip measured at 288ms, and this used to run it on every single
 * run before the mode was even considered, for a value whose only consumer is a
 * label in history.json. That was 84% of what `--quick` spent, on a flag whose
 * whole promise is "no AI, no network, no key". Both sources return the same
 * string; only one of them needs the internet.
 */
export async function repoName(cwd = process.cwd()): Promise<string> {
  try {
    const { stdout } = await exec("git", ["remote", "get-url", "origin"], { cwd });
    const name = stdout.trim().replace(/\.git$/, "").split(/[:/]/).slice(-2).join("/");
    if (name) return name;
  } catch {
    // No remote, or not a git repo. Fall through to gh, which may still know.
  }

  const out = await gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], cwd);
  return out?.trim() || "local";
}

export async function hasGh(): Promise<boolean> {
  return (await gh(["auth", "status"], process.cwd())) !== null;
}
