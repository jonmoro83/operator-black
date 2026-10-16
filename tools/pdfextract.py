import re,sys,zlib,os

def objects(data):
    """objnum -> (dict_bytes, stream_bytes|None), including objects inside /ObjStm."""
    objs={}
    for m in re.finditer(rb'(?<![0-9])(\d+)\s+0\s+obj\b',data):
        num=int(m.group(1)); s=m.end()
        eo=data.find(b'endobj',s); st=data.find(b'stream',s)
        end=eo if eo>=0 else len(data)
        if st>=0 and st<end:
            head=data[s:st]
            L=re.search(rb'/Length\s+(\d+)',head)
            b=st+6
            while b<len(data) and data[b] in (13,10): b+=1
            if L: raw=data[b:b+int(L.group(1))]
            else:
                e=data.find(b'endstream',b); raw=data[b:e if e>0 else end]
            objs[num]=(head,raw)
        else:
            objs[num]=(data[s:end],None)
    # objects packed into object streams
    for num,(head,raw) in list(objs.items()):
        if raw is None or b'/ObjStm' not in head: continue
        try: body=zlib.decompress(raw)
        except Exception: continue
        n=int(re.search(rb'/N\s+(\d+)',head).group(1))
        first=int(re.search(rb'/First\s+(\d+)',head).group(1))
        nums=body[:first].split()
        for i in range(n):
            on=int(nums[2*i]); off=int(nums[2*i+1])
            nxt=int(nums[2*i+3])+first if i+1<n else len(body)
            objs.setdefault(on,(body[first+off:nxt],None))
    return objs

def inflate(head,raw):
    if raw is None: return None
    if b'FlateDecode' not in head: return raw
    try: return zlib.decompress(raw)
    except Exception:
        try: return zlib.decompressobj().decompress(raw)
        except Exception: return None

def ref(head,key):
    m=re.search(key+rb'\s+(\d+)\s+0\s+R',head)
    return int(m.group(1)) if m else None

def cmap_of(body):
    """ToUnicode CMap -> {code:int -> str}"""
    out={}
    for m in re.finditer(rb'beginbfchar(.*?)endbfchar',body,re.S):
        for a,b in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>',m.group(1)):
            out[int(a,16)]=''.join(chr(int(b[i:i+4],16)) for i in range(0,len(b),4))
    for m in re.finditer(rb'beginbfrange(.*?)endbfrange',body,re.S):
        blk=m.group(1)
        for a,b,c in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>',blk):
            lo,hi,st=int(a,16),int(b,16),int(c,16)
            for i in range(min(hi-lo+1,65536)): out[lo+i]=chr(st+i)
        for a,b,arr in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]',blk,re.S):
            lo=int(a,16)
            for i,v in enumerate(re.findall(rb'<([0-9A-Fa-f]+)>',arr)):
                out[lo+i]=''.join(chr(int(v[j:j+4],16)) for j in range(0,len(v),4))
    return out

def main(path,out):
    data=open(path,'rb').read()
    objs=objects(data)
    tou={}                                        # font objnum -> cmap
    for num,(head,raw) in objs.items():
        t=ref(head,rb'/ToUnicode')
        if t is None or t not in objs: continue
        body=inflate(*objs[t])
        if body: tou[num]=cmap_of(body)

    pages=[]
    for num,(head,raw) in objs.items():
        if b'/Type' not in head or not re.search(rb'/Type\s*/Page\b',head): continue
        order=re.search(rb'/StructParents\s+(\d+)',head)
        # font name -> cmap, from this page's resources
        fonts={}
        res=head
        r=ref(head,rb'/Resources')
        if r in objs: res=objs[r][0]
        fm=re.search(rb'/Font\s*(\d+)\s+0\s+R',res)
        fdict=objs[int(fm.group(1))][0] if fm and int(fm.group(1)) in objs else res
        for nm,fo in re.findall(rb'/(\w+)\s+(\d+)\s+0\s+R',fdict):
            if int(fo) in tou: fonts[nm.decode()]=tou[int(fo)]
        # content
        cs=[]
        for m in re.finditer(rb'/Contents\s+(\d+)\s+0\s+R',head): cs.append(int(m.group(1)))
        m=re.search(rb'/Contents\s*\[(.*?)\]',head,re.S)
        if m: cs+= [int(x) for x in re.findall(rb'(\d+)\s+0\s+R',m.group(1))]
        body=b''.join((inflate(*objs[c]) or b'') for c in cs if c in objs)
        if not body: continue
        cur=None; buf=[]
        for t in re.finditer(rb'/(\w+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f\s]*)>|\((?:\\.|[^\\()])*\)|\bTD\b|\bTd\b|\bT\*\b|\bTJ\b|\bET\b|\bBT\b',body):
            g=t.group(0)
            if g.endswith(b'Tf'): cur=fonts.get(t.group(1).decode()); continue
            if g in (b'TD',b'Td',b'T*',b'ET',b'BT'): buf.append('\n'); continue
            if g==b'TJ': continue
            if g.startswith(b'<'):
                hx=re.sub(rb'\s',b'',t.group(2))
                if cur:
                    buf.append(''.join(cur.get(int(hx[i:i+4],16),'') for i in range(0,len(hx),4)))
                continue
            v=g[1:-1]
            v=re.sub(rb'\\([nrt()\\])',lambda mm:{b'n':b'\n',b'r':b'\r',b't':b'\t'}.get(mm.group(1),mm.group(1)),v)
            buf.append(v.decode('latin-1'))
        txt=''.join(buf)
        txt=re.sub(r'[ \t]+',' ',txt)
        txt=re.sub(r'\n\s*\n+','\n',txt).strip()
        if txt: pages.append((int(order.group(1)) if order else num,txt))
    pages.sort(key=lambda p:p[0])
    with open(out,'w') as f:
        for i,(k,t) in enumerate(pages): f.write('\n\n===== page %d =====\n%s'%(i+1,t))
    print('pages with text:',len(pages))

def glyph_decode(t, n):
    """Decode a PDF that ships raw glyph indices instead of characters.

    Some subset fonts have no /ToUnicode map and emit the font's own glyph numbers,
    which are the character codes moved along by a constant. TB_V3.pdf is one: its
    glyphs run 29 below ASCII, so 0x03 is a space, 0x0f a comma and 0x46 the letter
    "c". Two-byte codes arrive with a 0x00 high byte, and because every glyph is
    positioned individually the extractor has already put each on its own line -- so
    the per-glyph lines are what gets decoded, and real line breaks survive.
    """
    out, run = [], []
    def flush():
        if run: out.append(''.join(run)); run.clear()
    for line in t.split('\n'):
        g = line.replace('\x00', '')
        if len(g) == 1 and ord(g) < 0x60:
            run.append(chr(ord(g) + n))
        elif not g.strip():
            flush(); out.append('\n')
        else:
            flush(); out.append(line + '\n')
    flush()
    return ''.join(out)

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    glyph = next((int(a.split('=')[1]) for a in sys.argv[1:] if a.startswith('--glyph=')), 0)
    main(args[0], args[1])
    if glyph:
        body = open(args[1], encoding='utf-8', errors='replace').read()
        # Only the text between the markers is decoded; the markers are ours.
        parts = re.split(r'(===== page \d+ =====)', body)
        for i in range(len(parts)):
            if not parts[i].startswith('===== page '):
                parts[i] = glyph_decode(parts[i], glyph)
        tmp = args[1] + '.tmp'
        open(tmp, 'w', encoding='utf-8').write(''.join(parts))
        os.replace(tmp, args[1])
        print('post-processed: glyph offset %+d' % glyph)
