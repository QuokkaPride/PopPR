import { spawn } from "node:child_process";
import type { Provider } from "../types.js";

/**
 * Shells out to Claude Code's headless mode. This is the default backend
 * because the people writing incomprehensible AI-generated PRs are, by
 * definition, the people who already have Claude Code installed — so poppr
 * costs them nothing extra and costs us nothing at all.
 */
export function claudeCodeProvider(bin = "claude"): Provider {
  return {
    name: "claude-code",
    generate(prompt: string): Promise<string> {
      return new Promise((resolve, reject) => {
        // --print: non-interactive. Tools are disabled because we hand the model
        // the entire diff up front; letting it wander the filesystem would be
        // slower and would leak repo contents we deliberately filtered out.
        const child = spawn(
          bin,
          ["--print", "--output-format", "json", "--allowed-tools", ""],
          { stdio: ["pipe", "pipe", "pipe"] },
        );

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
              new Error(`claude exited with code ${code}.${stderr ? `\n${stderr.trim()}` : ""}`),
            );
          }
          try {
            const parsed = JSON.parse(stdout);
            const text = parsed.result ?? parsed.text ?? parsed.content;
            if (typeof text !== "string") {
              return reject(new Error("Unexpected response shape from claude --print."));
            }
            resolve(text);
          } catch {
            // Older versions, or a non-JSON fallback, just print the answer.
            resolve(stdout);
          }
        });

        child.stdin.write(prompt);
        child.stdin.end();
      });
    },
  };
}
