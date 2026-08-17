import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promisify } from "node:util";
import { extname, resolve as resolvePath, sep } from "node:path";

const exec = promisify(execFile);

/** Extensions Windows will actually execute, in the order we prefer them. */
function executableExtensions(): string[] {
  return (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Pick the entry Windows would run, out of everything `where` listed.
 *
 * npm writes THREE siblings for every global CLI: an extensionless `#!/bin/sh`
 * script for Git Bash, plus `name.cmd` and `name.ps1`. `where` lists the
 * extensionless one first, so taking the first line resolved every
 * npm-installed backend to a shell script that Windows cannot execute. The
 * launch then failed in a way that looked like a broken backend rather than a
 * bad lookup, which is precisely the detect-says-yes, exec-says-no disagreement
 * this file exists to end.
 */
export function pickExecutable(lines: string[]): string | null {
  const exts = executableExtensions();
  let best: string | null = null;
  let bestRank = 0;

  for (const line of lines) {
    const ext = extname(line).toLowerCase();
    if (!exts.includes(ext)) continue; // extensionless sh shim, .ps1, and friends
    if (unsafeForCmd(line)) continue; // a `%` would expand inside cmd's quotes
    const rank = ext === ".exe" || ext === ".com" ? 2 : 1;
    if (rank > bestRank) {
      bestRank = rank;
      best = line;
    }
  }
  return best;
}

/**
 * Where a CLI actually lives, or null when it is not on PATH.
 *
 * Returning the resolved path rather than a boolean is the whole point. libuv's
 * Windows path search appends only `.com` and `.exe` to a bare name and never
 * consults PATHEXT, so `spawn("claude")` cannot find the `claude.cmd` that
 * `npm i -g @anthropic-ai/claude-code` installs. The old probe asked `where`,
 * which does find the shim, and then handed the bare name to spawn, which does
 * not: detection said the backend was present and every launch failed ENOENT.
 * Asking one question and acting on that answer keeps the two in agreement.
 *
 * `which` prints one path. `where` prints every match, newline separated, and
 * the first is the one Windows would actually run.
 */
export async function resolveBin(bin: string): Promise<string | null> {
  if (process.platform !== "win32") {
    try {
      const { stdout } = await exec("which", [bin]);
      return stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? null;
    } catch {
      return null;
    }
  }

  // `$PATH:name` restricts the search to the directories named by PATH. A plain
  // `where name` searches the CURRENT DIRECTORY first, and this process runs in
  // the repository being quizzed: on someone else's branch, a committed
  // `claude.cmd` would be resolved and then executed with the diff on its stdin.
  const listings = await Promise.all([
    whereLines(`$PATH:${bin}`),
    whereLines(bin),
  ]);

  const cwd = resolvePath(process.cwd());
  const fromPath = pickExecutable(listings[0]);
  if (fromPath) return fromPath;

  // Older `where` builds reject the $PATH: form. Fall back to the plain lookup,
  // minus anything inside the working tree, which is the part that was unsafe.
  const fallback = pickExecutable(
    listings[1].filter((p) => !resolvePath(p).startsWith(cwd + sep)),
  );
  return fallback;
}

async function whereLines(pattern: string): Promise<string[]> {
  try {
    const { stdout } = await exec("where", [pattern]);
    return stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** npm writes its global CLIs as these on Windows, and Node will not exec one directly. */
const BATCH = /\.(cmd|bat)$/i;

/**
 * spawn() for a resolved CLI, with the one Windows special case.
 *
 * Node refuses to execute a .cmd or .bat directly since the fix for
 * CVE-2024-27980 (Node 18.20.2+, 20.12.2+): it throws EINVAL unless the call
 * goes through a shell. npm installs every global CLI as exactly that kind of
 * shim, so routing batch files through ComSpec is what makes the AI backends
 * reachable on Windows at all. `windowsVerbatimArguments` is what satisfies the
 * guard, and it means we own the quoting.
 *
 * The POSIX branch deliberately still spawns the bare name. Passing an absolute
 * path there would bypass version-manager shims (asdf, mise, volta) that
 * re-resolve the name at exec time, and would break a `claude` that is a shell
 * function. Windows has no equivalent, so using the resolved path there is free.
 */
/**
 * Every child we started that has not exited.
 *
 * Generation outlives the game by design: batches keep landing while you play.
 * But a ChildProcess holds a ref on the event loop, so once the AI path became
 * the default, an ordinary `poppr` on a machine with Claude Code installed
 * printed the review screen and then refused to return to the shell until
 * generation finished, which CLAUDE.md puts at two to four minutes. Nothing in
 * the run needs a batch that lands after the clock has stopped.
 */
const live = new Set<ChildProcessWithoutNullStreams>();

/**
 * Stop everything still running. Safe to call when nothing is.
 *
 * On Windows a batch shim makes the real process a grandchild of cmd.exe, and
 * killing cmd.exe orphans it, so the whole tree goes via taskkill.
 */
export function terminateAll(): void {
  for (const child of live) {
    try {
      if (process.platform === "win32" && child.pid) {
        // The batch shim makes the real process a grandchild of cmd.exe, so /T
        // is what reaches it. Killing cmd.exe alone orphans the rest.
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else if (child.pid) {
        // The negative pid is the point: it signals the whole process GROUP.
        // Killing just the child leaves any grandchild it spawned holding our
        // stdio pipes open, and node waits on those pipes, not on the process.
        // Measured: SIGTERM to the child at 1s, "close" at 45s.
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      // ESRCH: already gone. The normal case, not a problem.
    }
    // Belt and braces. Even a correct group kill can race a grandchild that has
    // already inherited the descriptors, and node keeps the loop alive for a
    // readable stream regardless of who is on the other end.
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.stdin?.destroy();
  }
  live.clear();
}

function track(child: ChildProcessWithoutNullStreams): ChildProcessWithoutNullStreams {
  live.add(child);
  child.on("close", () => live.delete(child));
  child.on("error", () => live.delete(child));
  return child;
}

export function spawnCli(
  bin: string,
  resolved: string | null,
  args: string[],
): ChildProcessWithoutNullStreams {
  const stdio = ["pipe", "pipe", "pipe"] as const;

  if (process.platform === "win32" && resolved && BATCH.test(resolved)) {
    // `cmd /d /s /c "<line>"` strips the outer quotes and runs the rest.
    const line = [resolved, ...args].map(quote).join(" ");
    return track(
      spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"${line}"`], {
        stdio: [...stdio],
        windowsVerbatimArguments: true,
        windowsHide: true,
      }) as ChildProcessWithoutNullStreams,
    );
  }

  return track(
    spawn(process.platform === "win32" && resolved ? resolved : bin, args, {
      stdio: [...stdio],
      windowsHide: true,
      // Its own process group, so terminateAll can signal the group and reach
      // anything the backend spawns underneath itself. Windows has no
      // equivalent and uses taskkill /T instead.
      detached: process.platform !== "win32",
    }) as ChildProcessWithoutNullStreams,
  );
}

/**
 * Quote a token for the cmd.exe command line.
 *
 * Unconditional, not "only when it contains a space". The resolved path is not
 * a literal we control: it comes back from `where`, so it can hold `&`, `^`,
 * `(` or `)`, all of which cmd acts on when they are bare. Quotes neutralise
 * every one of them and cost nothing on a token that did not need them. Empty
 * strings need it too, or `--allowed-tools ""` silently loses its argument.
 *
 * `%` is the exception quotes do not cover, since cmd expands `%VAR%` inside
 * them. A path containing one is rejected by the caller rather than escaped.
 */
function quote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/** True when a resolved path cannot be passed through cmd.exe safely. */
export function unsafeForCmd(resolved: string): boolean {
  return resolved.includes("%");
}
