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
 * The design assumption is that poppr runs in the minute after you ship, so the
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

export async function repoName(cwd = process.cwd()): Promise<string> {
  const out = await gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], cwd);
  if (out?.trim()) return out.trim();
  try {
    const { stdout } = await exec("git", ["remote", "get-url", "origin"], { cwd });
    return stdout.trim().replace(/\.git$/, "").split(/[:/]/).slice(-2).join("/");
  } catch {
    return "local";
  }
}

export async function hasGh(): Promise<boolean> {
  return (await gh(["auth", "status"], process.cwd())) !== null;
}
