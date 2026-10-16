#!/usr/bin/env python3
"""Build the private library: a local PDF becomes SQL you load into D1.

The books are commercial and the repository is public, so nothing this produces is
ever committed. It writes into library/, which .gitignore excludes, and the text goes
from there straight into D1 -- which sits behind Cloudflare Access -- with wrangler.

    python3 tools/pdfextract.py ~/Downloads/TB_MP.pdf library/tb3.txt
    python3 tools/library.py tb3 "Tactical Barbell III: Mass Protocol" "TB III" library/tb3.txt
    npx wrangler d1 execute operator-black --remote --file=library/tb3.sql

Chunking is by page, with short pages folded into the next one so a chunk is big
enough to carry its own context. Each chunk keeps the page it came from, because an
answer that cannot be checked against the book is worth very little.
"""
import os, re, sys

MIN_CHARS = 400          # fold a page forward until a chunk is at least this long
MAX_CHARS = 2600         # but never past this, or retrieval returns an essay

def chunks_from(text):
    pages = re.split(r'===== page (\d+) =====', text)
    out, buf, first = [], [], None
    def flush():
        if not buf: return
        body = re.sub(r'\s+', ' ', ' '.join(buf)).strip()
        if body: out.append((f'p{first}' if first == last else f'p{first}-{last}', body))
        buf.clear()
    last = None
    for i in range(1, len(pages), 2):
        n, body = int(pages[i]), pages[i + 1].strip()
        if not body: continue
        if first is None: first = n
        buf.append(body); last = n
        if sum(len(x) for x in buf) >= MIN_CHARS:
            flush(); first = None
    flush()
    # A page that ran long on its own is split rather than truncated.
    final = []
    for ref, body in out:
        while len(body) > MAX_CHARS:
            cut = body.rfind('. ', 0, MAX_CHARS)
            cut = cut + 1 if cut > MAX_CHARS // 2 else MAX_CHARS
            final.append((ref, body[:cut].strip())); body = body[cut:].strip()
        if body: final.append((ref, body))
    return final

def clean(s):
    """Strip what a decoded PDF leaves behind that SQL cannot carry.

    Control characters survive a `\\s+` collapse -- form feeds, NULs, the odd stray
    byte from a glyph table with no /ToUnicode map -- and a raw one inside a quoted
    literal ends the statement early.
    """
    s = ''.join(' ' if ord(c) < 0x20 else c for c in s)
    return re.sub(r'\s+', ' ', s).strip()

def sql_str(s):
    return "'" + clean(s).replace("'", "''") + "'"

def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    doc, title, short, src = sys.argv[1:]
    if not re.fullmatch(r'[a-z0-9]{2,12}', doc):
        sys.exit('doc id should be short and lowercase, e.g. tb3')
    text = open(src, encoding='utf-8', errors='replace').read()
    cs = chunks_from(text)
    if not cs: sys.exit('no chunks -- did the extractor produce page markers?')

    out = os.path.join('library', doc + '.sql')
    os.makedirs('library', exist_ok=True)
    # No BEGIN/COMMIT: remote D1 batches a --file itself and rejects an explicit
    # transaction outright, though a local one accepts it. Keep the two the same.
    lines = [f'DELETE FROM lib_chunk WHERE doc = {sql_str(doc)};',
             f'DELETE FROM lib_doc WHERE id = {sql_str(doc)};']
    for ref, body in cs:
        lines.append(f'INSERT INTO lib_chunk (doc, ref, body) VALUES ({sql_str(doc)}, {sql_str(ref)}, {sql_str(body)});')
    lines.append('INSERT INTO lib_doc (id, title, short, chunks, updated_at) VALUES '
                 f'({sql_str(doc)}, {sql_str(title)}, {sql_str(short)}, {len(cs)}, {int(__import__("time").time() * 1000)});')
    tmp = out + '.tmp'
    open(tmp, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    os.replace(tmp, out)
    print(f'{doc}: {len(cs)} chunks, {sum(len(b) for _, b in cs):,} chars -> {out}')
    print(f'  npx wrangler d1 execute operator-black --remote --file={out}')

if __name__ == '__main__':
    main()
