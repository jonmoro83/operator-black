"""Extract text from a PDF through its /ToUnicode map.

The companion to pdfextract.py, for the books whose fonts carry a CMap. Those place
every glyph with its own Td, so pdfextract's line-move heuristic puts each character
on its own line and drops the spaces -- this one reads the map instead and keeps the
words intact.

    python3 tools/pdftext_cmap.py ~/Downloads/TB_MP.pdf library/tb3.txt

Which extractor a book needs is a property of the book. TB_MP wants this one; TB_V3
has no map at all and wants pdfextract.py with --glyph=29.
"""
import re,sys,zlib,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from pdfextract import objects, inflate, ref, cmap_of

src,out=sys.argv[1],sys.argv[2]
data=open(src,'rb').read()
objs=objects(data)
tou={}
for num,(head,raw) in objs.items():
    t=ref(head,rb'/ToUnicode')
    if t is None or t not in objs: continue
    body=inflate(*objs[t])
    if body: tou[num]=cmap_of(body)
# one merged map: this book's subsets agree, and the alternative is resolving
# /Resources per page, which it does not spell out inline
merged={}
for m in tou.values(): merged.update(m)

blocks=[]
for num,(head,raw) in objs.items():
    body=inflate(head,raw)
    if not body or b'Tj' not in body: continue
    imgs=[n.decode() for n in re.findall(rb'/(\w+)\s+Do',body)]
    buf=[]
    for g in re.finditer(rb'<([0-9A-Fa-f]+)>\s*Tj|(-?[\d.]+)\s+(-?[\d.]+)\s+Td',body):
        if g.group(1):
            h=g.group(1)
            buf.append(''.join(merged.get(int(h[i:i+4],16),'') for i in range(0,len(h),4)))
        elif g.group(3) and abs(float(g.group(3)))>2:    # a real line move, not an advance
            buf.append('\n')
    txt=re.sub(r'[ \t]+',' ',''.join(buf))
    txt=re.sub(r'\n +','\n',txt).strip()
    if txt: blocks.append((num,imgs,txt))
blocks.sort()
# Blocks come out in object order, which for these books is reading order. Numbered
# as pages so the output matches tools/pdfextract.py and library.py can chunk it.
with open(out,'w') as f:
    for i,(num,imgs,txt) in enumerate(blocks):
        f.write('\n\n===== page %d =====\n%s'%(i+1,txt))
print('pages with text:',len(blocks))
