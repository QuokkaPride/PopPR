import { spawn } from "node:child_process";
import type { Provider } from "../types.js";

/** Same trick as the Claude Code provider, for people living in Cursor. */
export function cursorAgentProvider(bin = "cursor-agent"): Provider {
  return {
    name: "cursor-agent",
    generate(prompt: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const child = spawn(bin, ["--print", "--output-format", "text"], {
          stdio: ["pipe", "pipe", "pipe"],
        });

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
