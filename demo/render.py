#!/usr/bin/env python3
"""Render PopPR demo frames to an animated GIF for the README."""
import json, re, sys
from PIL import Image, ImageDraw, ImageFont

FRAMES = json.load(open(sys.argv[1]))
OUT = sys.argv[2]

# A dark terminal palette that reads well on both GitHub themes.
BG      = (13, 17, 23)
CHROME  = (22, 27, 34)
FG      = (201, 209, 217)
DIM     = (110, 118, 129)
WHITE   = (240, 246, 252)
GREEN   = (63, 185, 80)
RED     = (248, 81, 73)
YELLOW  = (210, 153, 34)
CYAN    = (57, 197, 207)
MAGENTA = (188, 140, 255)

STYLES = {
    "d": DIM, "W": WHITE, "g": GREEN, "G": GREEN, "r": RED, "R": RED,
    "y": YELLOW, "c": CYAN, "C": CYAN, "M": MAGENTA, "k": (39, 45, 54),
    "P": GREEN, "F": RED,
}
BOLD_KEYS = {"W", "M", "G", "R", "C"}

# Regular and bold candidates, in preference order. The Linux paths were the
# only ones here originally, which made `npm run demo` fail on the Mac this is
# developed on. Menlo ships with macOS and is a .ttc collection, so PIL needs
# the face index: 0 is regular, 1 is bold.
FONT_CANDIDATES = [
    ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 0,
     "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 0),
    ("/System/Library/Fonts/Menlo.ttc", 0, "/System/Library/Fonts/Menlo.ttc", 1),
    ("/System/Library/Fonts/Supplemental/Andale Mono.ttf", 0,
     "/System/Library/Fonts/Supplemental/Andale Mono.ttf", 0),
]
SIZE = 15


def _load():
    for regular, r_idx, bold_path, b_idx in FONT_CANDIDATES:
        try:
            return (
                ImageFont.truetype(regular, SIZE, index=r_idx),
                ImageFont.truetype(bold_path, SIZE, index=b_idx),
                ImageFont.truetype(bold_path, SIZE * 6, index=b_idx),
            )
        except OSError:
            continue
    raise SystemExit(
        "No monospace font found. Install DejaVu Sans Mono, or add your font "
        "to FONT_CANDIDATES in demo/render.py."
    )


font, bold, hero = _load()


def _missing(f, ch):
    """True if `ch` renders as tofu. A .notdef box has a bbox like any glyph,
    so compare against a private-use codepoint that is guaranteed absent."""
    def raster(c):
        im = Image.new("L", (60, 60), 0)
        ImageDraw.Draw(im).text((5, 5), c, font=f, fill=255)
        return im.tobytes()
    return raster(ch) == raster("")


# The CLI spins with braille dots. macOS system monospace fonts have no braille
# block, so on a Mac those frames rendered as tofu boxes. Swap in quadrants,
# which every candidate font has. Only the spinner is affected; every other
# glyph in the demo (█ ✓ ✗ · → ⚡) is present everywhere we checked.
BRAILLE = "⠋⠙⠹⠸⠼⠴⠦⠧"
SPINNER_FALLBACK = "▖▘▘▝▝▗▗▖"
SPINNER_MAP = (
    {b: SPINNER_FALLBACK[i] for i, b in enumerate(BRAILLE)}
    if _missing(font, BRAILLE[0])
    else {}
)

CW = font.getbbox("M")[2] - font.getbbox("M")[0]  # cell width
LH = 22                                            # line height
COLS, ROWS = FRAMES["width"], 22
PAD_X, PAD_Y = 18, 14
TITLE_H = 30
W = COLS * CW + PAD_X * 2
H = ROWS * LH + PAD_Y * 2 + TITLE_H

TOKEN = re.compile(r"\{([a-zA-Z]):((?:[^{}]|\{[^}]*\})*)\}")
SWATCH = re.compile(r"\[(green|red|yellow)\]")


def spans(line):
    """Split a markup line into (text, colour, bold) spans."""
    out, pos = [], 0
    for m in TOKEN.finditer(line):
        if m.start() > pos:
            out.append((line[pos:m.start()], FG, False))
        key = m.group(1)
        out.append((m.group(2), STYLES.get(key, FG), key in BOLD_KEYS))
        pos = m.end()
    if pos < len(line):
        out.append((line[pos:], FG, False))
    return out


def draw_titlebar(d):
    d.rectangle([0, 0, W, TITLE_H], fill=CHROME)
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([PAD_X + i * 20, 11, PAD_X + i * 20 + 9, 20], fill=c)
    label = "poppr"
    d.text((W // 2 - len(label) * CW // 2, 7), label, font=font, fill=DIM)


def render(frame):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    draw_titlebar(d)
    y = TITLE_H + PAD_Y
    # A flash frame is centred, so the tick reads as a hit rather than a note
    is_flash = any(l.strip().startswith(("{P:", "{F:")) for l in frame["lines"])
    if is_flash:
        y = TITLE_H + (H - TITLE_H) // 2 - LH * 4
    for line in frame["lines"][:ROWS]:
        if SPINNER_MAP:
            line = line.translate(str.maketrans(SPINNER_MAP))
        x = PAD_X
        # Scorecard swatches are drawn as real squares — the emoji font does not
        # scale down cleanly, and rectangles look sharper at this size anyway.
        if line.strip() == "[rule]":
            d.line([PAD_X, y + LH // 2, W - PAD_X, y + LH // 2], fill=(48, 54, 61))
            y += LH
            continue
        if SWATCH.search(line):
            for m in SWATCH.finditer(line):
                col = {"green": GREEN, "red": RED, "yellow": YELLOW}[m.group(1)]
                d.rounded_rectangle([x, y + 3, x + CW * 2 - 3, y + 3 + CW * 2 - 3],
                                    radius=3, fill=col)
                x += CW * 2 + 2
            y += LH
            continue
        hero_spans = [sp for sp in spans(line) if sp[1] in (GREEN, RED)]
        if line.strip().startswith("{P:") or line.strip().startswith("{F:"):
            text, colour, _ = hero_spans[0]
            bb = d.textbbox((0, 0), text, font=hero)
            d.text(((W - (bb[2] - bb[0])) // 2 - bb[0], y), text, font=hero, fill=colour)
            y += LH * 5
            continue
        parts = spans(line.strip())
        if is_flash and line.strip():
            x = (W - sum(len(t) for t, _, _ in parts) * CW) // 2
        else:
            parts = spans(line)
        for text, colour, is_bold in parts:
            # Replace glyphs the mono font lacks with drawn equivalents.
            d.text((x, y), text, font=bold if is_bold else font, fill=colour)
            x += len(text) * CW
        y += LH
    return img


images = [render(f) for f in FRAMES["frames"]]
durations = [max(40, f["ms"]) for f in FRAMES["frames"]]

images[0].save(
    OUT, save_all=True, append_images=images[1:],
    duration=durations, loop=0, optimize=False, disposal=2,
)
print(f"{OUT}  {len(images)} frames  {W}x{H}")
