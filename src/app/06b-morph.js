/* ---------------- morphing the DOM instead of replacing it ----------------

   Every render used to be `main.innerHTML = html`, which throws away the whole screen
   and builds it again. That loses anything the browser was holding and the app was
   not: which field has focus, where the caret is in it, how far the page is scrolled,
   whether a <details> is open. The app had grown three separate workarounds for that
   -- saving and restoring the focused element's id and selection on every render, and
   keeping panel open/closed state in JS Sets so a re-render could not forget it.

   Morphing walks the new HTML against the DOM that is already there and changes only
   what differs. Nodes that have not changed are never touched, so the browser keeps
   everything it was holding and the workarounds stop being necessary.

   Two rules earn their place:

   - An element with an id is matched to the element with that id, wherever it moved
     to. Without that, inserting a card above a focused input replaces every node
     below it and focus is lost anyway.
   - The value of a field the person is typing in is never written. The DOM is the
     truth while they are typing; the render is a frame behind by definition. */

// No real DOM (the test harness, or a very old browser): fall back to replacing.
// Morphing is an optimisation of correctness, not a requirement for it.
function canMorph(root){
  return !!(root&&root.childNodes&&typeof document!=='undefined'&&document.createElement);
}
function morph(root,html){
  if(!canMorph(root)){ root.innerHTML=html; return false }
  const next=document.createElement('div');
  next.innerHTML=html;
  morphChildren(root,next);
  return true;
}
// Two nodes are the same slot if they are the same kind of thing. For elements that
// means the same tag and the same id -- an id that changes is a different element,
// however similar it looks.
function morphSame(a,b){
  if(a.nodeType!==b.nodeType) return false;
  if(a.nodeType!==1) return true;
  return a.tagName===b.tagName&&(a.id||'')===(b.id||'');
}
function morphChildren(oldP,newP){
  const olds=[];
  for(let i=0;i<oldP.childNodes.length;i++) olds.push(oldP.childNodes[i]);
  const news=[];
  for(let i=0;i<newP.childNodes.length;i++) news.push(newP.childNodes[i]);
  const byId=new Map();
  for(const n of olds) if(n.nodeType===1&&n.id) byId.set(n.id,n);

  let i=0;
  for(const nn of news){
    const id=nn.nodeType===1?(nn.id||''):'';
    let on=olds[i];
    // A kept element that has moved: carry it to where it now belongs rather than
    // rebuilding it. This is what keeps focus when something is inserted above it.
    if(id&&byId.has(id)&&byId.get(id)!==on){
      const keep=byId.get(id);
      const was=olds.indexOf(keep);
      if(was>=0) olds.splice(was,1);
      oldP.insertBefore(keep,olds[i]||null);
      olds.splice(i,0,keep);
      on=keep;
    }
    if(on&&morphSame(on,nn)){ morphNode(on,nn); i++; continue }
    const fresh=nn.cloneNode(true);
    oldP.insertBefore(fresh,on||null);
    olds.splice(i,0,fresh);
    i++;
  }
  for(let j=olds.length-1;j>=i;j--) oldP.removeChild(olds[j]);
}
function morphNode(o,n){
  if(o.nodeType!==1){ if(o.nodeValue!==n.nodeValue) o.nodeValue=n.nodeValue; return }
  morphAttrs(o,n);
  const tag=o.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') morphField(o,n);
  // A textarea's value is its text content, and writing children under one while it
  // is focused would move the caret; a select's options are morphed by morphField
  // before it reads the selection off them. Both are already done.
  if(tag!=='TEXTAREA'&&tag!=='SELECT') morphChildren(o,n);
}
function morphAttrs(o,n){
  const want=n.attributes, seen={};
  for(let i=0;i<want.length;i++){
    const a=want[i]; seen[a.name]=1;
    if(o.getAttribute(a.name)!==a.value) o.setAttribute(a.name,a.value);
  }
  const have=o.attributes;
  for(let i=have.length-1;i>=0;i--){ const nm=have[i].name; if(!seen[nm]) o.removeAttribute(nm) }
}
/* A field being typed in is the one place the DOM outranks the render: the render was
   built from state that is at best a keystroke old. So the value is written only when
   the field does not have focus. */
function morphField(o,n){
  const active=typeof document!=='undefined'&&document.activeElement===o;
  const tag=o.tagName;
  if(tag==='INPUT'){
    const t=(o.type||'').toLowerCase();
    if(t==='checkbox'||t==='radio'){ const c=n.hasAttribute('checked'); if(o.checked!==c) o.checked=c; return }
    if(active) return;
    const v=n.getAttribute('value'); if(v!=null&&o.value!==v) o.value=v;
    return;
  }
  if(tag==='TEXTAREA'){ if(active) return; const v=n.textContent||''; if(o.value!==v) o.value=v; return }
  if(tag==='SELECT'){
    morphChildren(o,n);
    if(active) return;
    let want=null;
    for(let i=0;i<n.childNodes.length;i++){ const c=n.childNodes[i];
      if(c.nodeType===1&&c.tagName==='OPTION'&&c.hasAttribute('selected')) want=c.getAttribute('value') }
    if(want!=null&&o.value!==want) o.value=want;
  }
}
