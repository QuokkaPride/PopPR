/**
 * The terminal mode the full-frame screens run in, and the paint itself.
 *
 * The game repaints everything four times a second so the clock and the
 * draining point value are visibly moving. On the normal screen buffer that is
 * destructive in the terminals most people actually use: VS Code, Cursor and
 * iTerm answer "erase display" by pushing the old viewport into scrollback
 * instead of discarding it, so a three minute run files roughly eleven thousand
 * lines of near-identical frames into someone's terminal history. The first
 * report of this read as "it generated all the questions at once", because
 * scrolling up shows the same question stacked over and over, and the real
 * scrollback that was there before is gone.
 *
 * The alternate screen buffer is what every full-screen program uses for this
 * reason. It has no scrollback to pollute, and the terminal puts back whatever
 * was on screen when we leave. Everything worth keeping (the review screen, the
 * certification comment, the second-pass summary) prints after we leave, so it
 * lands in the real scrollback and stays there.
 */

const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

let active = false;
let painted: string | null = null;

const onSignal = (): void => {
  leaveFullScreen();
  process.exit(130);
};

export function enterFullScreen(): void {
  if (active || !process.stdout.isTTY) return;
  active = true;
  painted = null;
  // ?1049h switches buffers and saves the cursor position in one sequence. ?25l
  // hides the cursor, which would otherwise blink wherever the last line ended.
  process.stdout.write("\x1b[?1049h\x1b[H\x1b[2J\x1b[?25l");
  // A signal must not strand someone in the alternate buffer with no cursor,
  // needing `reset` to get their shell back. The handlers come and go with the
  // screen so the rest of the CLI keeps default signal behaviour.
  process.on("exit", leaveFullScreen);
  for (const sig of SIGNALS) process.on(sig, onSignal);
}

export function leaveFullScreen(): void {
  if (!active) return;
  active = false;
  painted = null;
  process.stdout.write("\x1b[?25h\x1b[?1049l");
  process.off("exit", leaveFullScreen);
  for (const sig of SIGNALS) process.off(sig, onSignal);
}

/**
 * Full-frame redraw. Simpler than diffing, and at 4fps nobody can tell.
 *
 * A frame identical to the one already up is dropped. Most ticks change nothing
 * visible, and repainting those is flicker carrying no information.
 */
export function draw(lines: string[]): void {
  const frame = lines.join("\n");
  if (frame === painted) return;
  painted = frame;
  process.stdout.write((process.stdout.isTTY ? "\x1b[H\x1b[2J" : "") + frame + "\n");
}

/**
 * Adds to the frame already on screen, for the untimed screens that reveal an
 * answer underneath the question that earned it.
 */
export function append(lines: string[]): void {
  painted = null;
  process.stdout.write(lines.join("\n") + "\n");
}
