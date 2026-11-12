/* ---------- Black's conditioning, recommended ----------
The book's Black does not name its sessions (TB II p58–59). It asks for at least two
HICs a week and an E at least every other week, and leaves the choice to you, with three
pieces of advice the app turns into a recommendation:

  - mix them: most HICs from #1–36, aerobic/anaerobic and general conditioning both,
    and "avoid doing only AA, or only GC" (p112)
  - the author's preferred way to progress: a cluster of two or three HICs plus E work,
    each kept in rotation until you can do its Advanced version, then swapped (p187)
  - sessions from elsewhere are welcome, filed by kind (p189), which is how MTI's are

The rules are the book's; the order they are applied in, and "least recently done" as
the tie-break, are the app's. The recommendation is only that: the day's card offers the
rest of the cluster and the sessions that meet the same need, the books' and MTI's, and
whatever you pick is what the day becomes. */
const HIC_CLUSTER0=['map','anaerobic','threshold'];
// Your cluster: [{f, since}]. Unset, it is the app's three interval shapes, because
// they run on whatever you have; the card asks for a general conditioning session to
// complete the mix rather than guessing what equipment you own.
function hicCluster(){
  const c=Array.isArray(plan.hicCluster)?plan.hicCluster.filter(x=>x&&HIC[x.f]&&hicTbCat(x.f)!=='E'):[];
  return c.length?c:HIC_CLUSTER0.map(f=>({f,since:''}));
}
function hicE(){ return HIC[plan.hicE]&&hicTbCat(plan.hicE)==='E'?plan.hicE:'liss' }
let recC={v:'',m:{},grad:null};
function recVer(){ const v=planV+':'+logsV+':'+todayStr(); if(recC.v!==v) recC={v,m:{},grad:null}; return recC }
// Cluster sessions whose Advanced version you have logged since they joined: the book's
// signal to swap them for a new one.
function hicGrad(f){
  const C=recVer();
  if(!C.grad){
    C.grad=new Set();
    for(const c of hicCluster()){
      const b=(HIC[c.f]||{}).book; if(!b||!b.advanced) continue;
      for(const [d,L] of Object.entries(logs)) if(d>=(c.since||'')&&L.hic&&L.hic.format===c.f&&L.hic.ver==='advanced'){ C.grad.add(c.f); break }
    }
  }
  return C.grad.has(f);
}
function hicRecOn(wk){
  const P=CPROTO[wk.cpr]||cprotoOf();
  return !!P.recommend&&wk.kind==='cycle'&&!(plan.hicRecFrom&&wk.monday<plan.hicRecFrom);
}
// The format for a recommended slot, and the reasons. A week that has passed carries
// what it was recommended, frozen; a week before the change keeps the old rotation.
function hicRecSlot(wk,ci){
  const P=CPROTO[wk.cpr]||cprotoOf();
  if(!hicRecOn(wk)){ const x=(P.legacy?P.legacy(wk):[])[ci]||{}; const o={fmt:x.fmt||'map'}; if(x.note) o.note=x.note; return o }
  if(wk.recs&&HIC[wk.recs[ci]]) return {fmt:wk.recs[ci]};
  const s=recWeek(wk.monday).slots[ci];
  return s?{fmt:s.f,rec:s}:{fmt:'map'};
}
// What you did, newest first, in the three weeks before `monday`. Ahead of today it is
// what is planned, so next week's recommendation follows on from this week's.
function hicHistory(monday){
  const out=[], today=todayStr();
  for(let i=1;i<=21;i++){
    const d=addDays(monday,-i), L=logs[d];
    if(d<today&&!(L&&(L.hic||L.done))) continue;
    const f=effFmt(d);
    if(f&&HIC[f]) out.push({d,f});
  }
  return out;
}
function recWeek(monday){
  const C=recVer();
  if(C.m[monday]) return C.m[monday];
  // Each week ahead leans on the one before it, so build them in order rather than
  // recursing a year deep from the far end of the calendar.
  const cur=mondayOf(todayStr());
  for(let m=addDays(cur,7);m<monday;m=addDays(m,7)) if(!C.m[m]) recWeek(m);
  const R=C.m[monday]={slots:[]};
  const wk=weekAt(monday); if(!wk||!hicRecOn(wk)) return R;
  const P=CPROTO[wk.cpr]||cprotoOf(), cs=P.sessions(wk), hist=hicHistory(monday), week=[];
  condDays(wk).forEach((d,ci)=>{
    const date=addDays(monday,d), s=hicPick(cs[ci]||{},week,hist,monday);
    s.date=date; R.slots.push(s);
    const lf=((logs[date]||{}).hic||{}).format;
    week.push(HIC[lf]?lf:s.f);
  });
  return R;
}
function hicPick(slot,week,hist,monday){
  const why=[], cat=hicTbCat, seq=[...week.slice().reverse(),...hist.map(h=>h.f)];
  const eWeek=week.some(f=>cat(f)==='E'), ePrev=hist.some(h=>h.d>=addDays(monday,-7)&&cat(h.f)==='E');
  if(slot.eOk&&!eWeek&&!ePrev&&week.length>=2){
    why.push(['An E session is due. Black asks for one at least every other week, and last week had none.','TB II p59']);
    why.push(['Repeat one or two E sessions you like. Variety matters less here.','TB II p85']);
    return {f:hicE(),need:'E',why};
  }
  const cl=hicCluster(), pool=cl.map(c=>c.f);
  const recent=seq.filter(f=>['AA','GC','PD'].includes(cat(f))).slice(0,6);
  let need=null;
  if(recent.length>=3){
    if(!recent.some(f=>cat(f)==='GC')&&pool.some(f=>cat(f)==='GC')) need='GC';
    else if(!recent.some(f=>cat(f)==='AA')&&pool.some(f=>cat(f)==='AA')) need='AA';
  }
  const score=f=>{ let s=week.includes(f)?-50:seq.indexOf(f)<0?99:seq.indexOf(f); if(need&&cat(f)===need) s+=100; if(hicGrad(f)) s-=40; return s };
  const f=pool.map((x,i)=>[x,score(x),i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2])[0][0];
  if(need) why.push([`No ${TB_CAT[need].toLowerCase()} in your last ${recent.length} hard sessions. The book asks for a mix: avoid doing only one kind.`,'TB II p112']);
  why.push([week.includes(f)?'From your cluster. Every session in it has had a turn this week.':seq.indexOf(f)<0?'From your cluster, and not done in the last three weeks.':'From your cluster, and the one done least recently.','TB II p187']);
  const b=(HIC[f]||{}).book;
  if(b&&b.advanced) why.push([hicGrad(f)?'You have done the Advanced version, which is when the book says to swap it for a new session.':'Keep it in rotation until you can do the Advanced version, then swap it for a new one.','TB II p187']);
  return {f,need:need||cat(f),why};
}
/* Sessions that meet the same need as `f`: its TB category, nearest first by system,
   the books' and MTI's apart. Not the cluster, not challenge sessions, not E. */
function hicLike(c,f,exclude,n){
  const sys=(HIC[f]||{}).sys, own=new Set(exclude);
  const xs=Object.keys(HIC).filter(k=>hicTbCat(k)===c&&!own.has(k)&&!(HIC[k].book&&HIC[k].book.cat==='challenge')&&k!=='free'&&k!=='fobbit')
    .map((k,i)=>[k,(HIC[k].sys===sys?2:0)+(HIC[k].book&&HIC[k].book.n?1:0),i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2]).map(x=>x[0]);
  return {books:xs.filter(k=>!hicMti(k)).slice(0,n),mti:xs.filter(hicMti).slice(0,n)};
}
// A done session keeps the format it was done as. Without this, changing your cluster
// would rewrite this week's finished days into whatever is recommended now.
function hicStamp(date){
  const L=logs[date]; if(!L||(L.hic&&L.hic.format)) return;
  const dp=dayPlan(date);
  if(dp&&dp.rec&&HIC[dp.fmt]) setPath(L,'hic.format',dp.fmt);
}
