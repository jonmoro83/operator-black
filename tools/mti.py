#!/usr/bin/env python3
"""Build Mountain Tactical Institute's article archive into SQL you load into D1.

Every post in mtntactical.com's "Articles / Research" category (Rob Shaul's research
write-ups, Q&As and programming notes, 2011 on), fetched through the site's public
WordPress API. Like the books it is someone else's writing and the repo is public, so
the raw pages and the SQL go into library/, which .gitignore excludes, and from there
straight into D1 behind Cloudflare Access.

    python3 tools/mti.py fetch      # library/mti/p1.json .. pN.json, about 45 MB
    python3 tools/mti.py build      # library/mti.sql
    npx wrangler d1 execute operator-black --remote --file=library/mti.sql

Run fetch again to pick up new articles; build replaces the whole doc either way.

Chunked by paragraph within an article rather than by page, since there are no pages.
Each chunk's ref is the article's title and year, which is what a person types into the
site's search to find it again.
"""
import html, json, os, re, sys, time, urllib.request
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(__file__))
from library import sql_str, MIN_CHARS, MAX_CHARS

DOC, TITLE, SHORT = 'mti', 'Mountain Tactical Institute articles', 'MTI'
CATEGORY = 433                                # "Articles / Research", slug "knowledge"
API = 'https://mtntactical.com/wp-json/wp/v2/posts'
RAW = os.path.join('library', 'mti')
# The default urllib agent is refused by the site's firewall; a browser's is not.
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

def fetch():
    os.makedirs(RAW, exist_ok=True)
    page, pages, total = 1, None, 0
    while pages is None or page <= pages:
        url = (f'{API}?categories={CATEGORY}&per_page=100&page={page}&orderby=date&order=desc'
               '&_fields=id,date,slug,link,title,content')
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=120) as r:
            pages = int(r.headers['X-WP-TotalPages']); body = r.read()
        posts = json.loads(body)
        total += len(posts)
        tmp = os.path.join(RAW, f'p{page}.json.tmp')
        open(tmp, 'wb').write(body); os.replace(tmp, tmp[:-4])
        print(f'page {page}/{pages}: {len(posts)} posts')
        page += 1; time.sleep(1)
    # A page from an earlier, longer run would otherwise be read as current.
    for f in os.listdir(RAW):
        m = re.fullmatch(r'p(\d+)\.json', f)
        if m and int(m.group(1)) > pages: os.remove(os.path.join(RAW, f))
    print(f'{total} posts in {pages} pages -> {RAW}/')

class Text(HTMLParser):
    """Paragraphs out of a post body. Block tags become blank lines so the chunker can
    cut between paragraphs; scripts, styles and embedded media leave nothing."""
    BLOCK = {'p', 'br', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'tr', 'blockquote', 'table'}
    def __init__(self):
        super().__init__(); self.out = []; self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'iframe', 'noscript'): self.skip += 1
        if tag in self.BLOCK: self.out.append('\n\n')
        if tag == 'li': self.out.append('- ')
        # A row stays one line with its cells apart, or "Athlete Age" reads "AthleteAge".
        if tag in ('td', 'th'): self.out.append(' | ')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'iframe', 'noscript'): self.skip = max(0, self.skip - 1)
        if tag in self.BLOCK: self.out.append('\n\n')
    def handle_data(self, d):
        if not self.skip: self.out.append(d)

def paragraphs(rendered):
    t = Text(); t.feed(rendered)
    paras = [re.sub(r'\s+', ' ', p).strip() for p in html.unescape(''.join(t.out)).split('\n\n')]
    return [p for p in paras if p and p != '-']

def chunks_of(paras):
    """Paragraphs packed into chunks of MIN_CHARS..MAX_CHARS, the same bounds as the
    books. A paragraph longer than the cap is cut at a sentence."""
    out, buf = [], ''
    for p in paras:
        while len(p) > MAX_CHARS:
            cut = p.rfind('. ', 0, MAX_CHARS)
            cut = cut + 1 if cut > MAX_CHARS // 2 else MAX_CHARS
            if buf: out.append(buf); buf = ''
            out.append(p[:cut].strip()); p = p[cut:].strip()
        if buf and len(buf) + 1 + len(p) > MAX_CHARS:
            out.append(buf); buf = ''
        buf = f'{buf} {p}'.strip()
        if len(buf) >= MIN_CHARS and len(buf) >= MAX_CHARS * 0.7:
            out.append(buf); buf = ''
    if buf:
        # A short tail rides on the chunk before it rather than standing alone.
        if out and len(buf) < MIN_CHARS and len(out[-1]) + len(buf) < MAX_CHARS * 1.3: out[-1] += ' ' + buf
        else: out.append(buf)
    return out

def ref_of(post):
    title = re.sub(r'\s+', ' ', html.unescape(post['title']['rendered'])).strip()
    if len(title) > 110: title = title[:110].rsplit(' ', 1)[0].rstrip(',:;–-') + '…'
    year = post['date'][:4]
    # Twenty-odd posts carry the epoch as their date, which is a fault on the site.
    return f'{title} ({year})' if year > '1990' else title

def build():
    files = sorted((f for f in os.listdir(RAW) if re.fullmatch(r'p\d+\.json', f)), key=lambda f: int(f[1:-5]))
    if not files: sys.exit(f'nothing in {RAW}/ -- run fetch first')
    posts = {}
    for f in files:
        for p in json.load(open(os.path.join(RAW, f), encoding='utf-8')): posts[p['id']] = p
    lines = [f'DELETE FROM lib_chunk WHERE doc = {sql_str(DOC)};', f'DELETE FROM lib_doc WHERE id = {sql_str(DOC)};']
    n = chars = empty = 0
    for p in sorted(posts.values(), key=lambda p: p['date']):
        cs = chunks_of(paragraphs(p['content']['rendered']))
        if not cs: empty += 1; continue
        ref = ref_of(p)
        for body in cs:
            lines.append(f'INSERT INTO lib_chunk (doc, ref, body) VALUES ({sql_str(DOC)}, {sql_str(ref)}, {sql_str(body)});')
            n += 1; chars += len(body)
    lines.append('INSERT INTO lib_doc (id, title, short, chunks, updated_at) VALUES '
                 f'({sql_str(DOC)}, {sql_str(TITLE)}, {sql_str(SHORT)}, {n}, {int(time.time() * 1000)});')
    out = os.path.join('library', DOC + '.sql')
    tmp = out + '.tmp'
    open(tmp, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    os.replace(tmp, out)
    print(f'{DOC}: {len(posts)} articles ({empty} with no text), {n} chunks, {chars:,} chars -> {out}')
    print(f'  npx wrangler d1 execute operator-black --remote --file={out}')

if __name__ == '__main__':
    {'fetch': fetch, 'build': build}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: sys.exit(__doc__))()
