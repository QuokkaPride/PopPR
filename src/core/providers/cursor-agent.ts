import type { Provider } from "../types.js";
import { spawnCli } from "./spawn.js";

/** Same trick as the Claude Code provider, for people living in Cursor. */
export function cursorAgentProvider(
  bin = "cursor-agent",
  resolved: string | null = null,
): Provider {
  return {
    name: "cursor-agent",
    generate(prompt: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const child = spawnCli(bin, resolved, ["--print", "--output-format", "text"]);

        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += d));
        child.stderr.on("data", (d) => (stderr += d));

        child.on("error", (err) =>
          reject(new Error(`Could not run \`${bin}\`: ${err.message}`)),
        );
        child.on("close", (code) => {
          if (code !== 0) {
            return reject(
              new Error(`cursor-agent exited with code ${code}.${stderr ? `\n${stderr.trim()}` : ""}`),
            );
          }
          resolve(stdout);
        });

        child.stdin.write(prompt);
        child.stdin.end();
      });
    },
  };
}
