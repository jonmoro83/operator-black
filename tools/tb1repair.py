#!/usr/bin/env python3
"""Repair the TB1 extraction in place: turn its escape sequences back into characters.

Why this exists. `library/tb1.txt` was produced by a run of the glyph-offset extractor
that emitted the characters outside its base mapping as escape sequences instead of as
text: a BEL or NUL, the substitute glyph, and a newline. Two consequences, and the
second is the one that cost real work:

  1. The control bytes make the file binary, so `file` reports "data" and plain `grep`
     silently prints nothing for every pattern. Searching the book for "accessory",
     "creatine" or "90%" returned zero matches and looked like an answer. It is not --
     it is grep declining to search. Use `grep -a`, or run this.
  2. Nothing that reads the text gets the characters. "90%" is not in the file at all,
     so neither full-text search nor the coach can find a percentage in TB1.

The mapping is exact rather than guessed. Every control byte in the file belongs to
one of the eight sequences below -- there are no strays -- and two of them are pinned
by counting: the file holds 51 "(" and no ")" against exactly 51 NUL-\\f, and no "%"
at all against 53 NUL-\\b, in contexts like "4 sets of 3 reps at 90[%] of your
maximum". The quotes are pinned by their pairs, the apostrophe by "don[']t".

The two dashes are the one inference: both substitutes are dashes, and which is en and
which is em is not recoverable from the text. Thorn is the common one and separates
headings and list items, so it takes the en dash.

Run it once; it is idempotent, and it refuses a file that has already been repaired.

    python3 tools/tb1repair.py library/tb1.txt
    python3 tools/library.py tb1 "Tactical Barbell" "TB1" library/tb1.txt
    npx wrangler d1 execute operator-black --remote --file=library/tb1.sql
"""
import sys, re

# sequence -> what the book actually had there
FIXES = [
    ("\x07ä\n", "’"),   # right single quote, and every apostrophe
    ("\x07ã\n", "‘"),   # left single quote
    ("\x07ç\n", "“"),   # left double quote
    ("\x07è\n", "”"),   # right double quote
    ("\x07Þ\n", "–"),   # en dash: headings, "Gladiator - Bench/Squat"
    ("\x07î\n", "—"),   # em dash: asides, "Hmmm - so how do we solve this?"
    ("\x00\\f\n", ")"),           # 51 of them against 51 unmatched "("
    ("\x00\\b\n", "%"),           # "3 reps at 90% of your maximum"
]

def repair(text):
    for seq, ch in FIXES:
        text = text.replace(seq, ch)
    return text

"""The second defect, and it is a different one. The same run also dropped the space
where a PDF line wrapped, so the text is full of joins: "This onlyapplies", "teamsmay",
"3reps". That matters beyond reading -- the library is searched with FTS5 and a porter
tokenizer, and "thefield" does not match a search for "field", so joined text is text
the coach cannot retrieve.

Only the boundaries that cannot be anything else are repaired here. After punctuation
and after a digit, a letter means a join; there is no English word with a full stop in
the middle of it. URLs are the one exception and are held out.

Deliberately not done: splitting two joined lowercase words. It needs a vocabulary to
decide, and a vocabulary gets "counterproductive" wrong as readily as it gets
"strengthmay" right. What is left is counted rather than guessed at."""
URL = re.compile(r'https?://\S+|www\.\S+')
def respace(text):
    held = []
    def hold(m):
        held.append(m.group(0)); return f"\x01{len(held)-1}\x01"
    text = URL.sub(hold, text)
    # "maximum.It's rare" -> "maximum. It's rare";  "3reps" -> "3 reps"
    text = re.sub(r'([.,;:!?])([A-Za-z])', r'\1 \2', text)
    text = re.sub(r'(\d)([a-z]{3,})', r'\1 \2', text)
    return re.sub(r'\x01(\d+)\x01', lambda m: held[int(m.group(1))], text)
def joinsLeft(text):
    """What is left, and only the part of it that can be counted.

    This counts a lowercase run straight into a capital -- "cardioDay 3" -- which is a
    join but not the common one. The common one is lowercase into lowercase,
    "onlyapplies", and counting those is the same problem as splitting them: it needs a
    vocabulary, and the vocabulary is what cannot be trusted. So this number is a floor,
    not a total, and it is printed as one."""
    return len(re.findall(r'[a-z]{4,}[A-Z]', text))

def main(path):
    raw = open(path, "rb").read()
    text = raw.decode("utf-8", errors="strict")
    before = sum(1 for c in text if ord(c) < 32 and c != "\n")
    out = respace(repair(text))
    if out == text:
        print(f"{path}: already repaired, nothing to do")
        return 0
    after = [c for c in out if ord(c) < 32 and c != "\n"]
    if after:
        # Refuse a partial repair: an unmapped sequence means the mapping is incomplete,
        # and writing anyway would leave the file looking fixed while it is not.
        raise SystemExit(f"{path}: {len(after)} control characters left unmapped; not written")
    tmp = path + ".tmp"
    open(tmp, "w", encoding="utf-8").write(out)
    import os; os.replace(tmp, path)
    print(f"{path}: repaired {before} escape sequences")
    for seq, ch in FIXES:
        n = text.count(seq)
        if n: print(f"  {n:5d}  ->  {ch!r}")
    if before: 
        print(f"  escape sequences: {before}")
    print(f"  spaces restored after punctuation and digits: {len(out) - len(repair(text))}")
    print(f"  word joins left: at least {joinsLeft(out)} (lower-into-capital; the "
          f"lower-into-lower ones cannot be counted without a vocabulary)")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "library/tb1.txt"))
