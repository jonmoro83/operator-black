/* ---------------- the year planner ----------------
Asked for 2026-11-15: "plan future cycles ... it would be nice to be able to plan an
entire year of training using the chooser." Prototyped the same day, and the user's
calls: plan back from a goal date with the books' sequences, then see and change the
year as a list ("C feeding A"); a week off every few months is a warning with a fix,
not a rule the planner enforces.

The year is plan.nextPrograms, the queue the chooser lines programs up in: programs
({stempl, cproto, bb, path, cycles?, weeks?}) and weeks off ({off:true}), in order.
The first one carries `start`, when the program you are on hands over; every other
start follows from the lengths before it, and is pinned when the one before it starts.
Only the first is ever acted on. The rest are a plan, changed freely until they start. */
let yrSel=-1, yrAdd=null, yg=null;

function yrItems(){ const q=plan.nextPrograms; return Array.isArray(q)?q.filter(it=>it&&(it.off||CPROTO[it.cproto])):[] }
// Cycles before the retest: the item's own, or the beginner path's one 9-week block, or
// the book's two (TB I p33).
function itemCycles(it){ return it.cycles||(it.path==='tb1beg'?1:DEF.testEvery) }
function itemFixed(it){ const T=it.stempl&&STEMPL[it.stempl]; return !!(it.weeks||!T||T.lp||it.cproto==='mtirun') }
// How long a block runs: Base Building, its cycles, then the retest. A block with a
// length of its own keeps it: TB II p200's Black, nine weeks, and anything with no
// wave to count (Progressive SE, nine weeks at most, TB II p73; a linear progression).
function itemWeeks(it){
  if(it.off) return 1;
  const bb=it.bb?bbLen(it.bb):0, T=it.stempl&&STEMPL[it.stempl];
  if(it.weeks) return bb+it.weeks;
  if(it.cproto==='mtirun') return bb+16-(it.runFrom||1);
  if(!T) return bb+9;
  if(T.lp) return bb+12;
  const wl=it.stempl==='operator'&&it.path==='tb1beg'?9:T.wave.length;
  return bb+itemCycles(it)*wl+1;
}
function itemName(it){ return it.off?'Week off':pickLine(it) }
function yrFirstStart(){ const q=yrItems(); return (q[0]&&q[0].start)||progSwitchMonday() }
/* Every block with its dates, and the week-off check: a block that comes after more
   than 18 weeks without one is flagged, counting the program you are on from its start.
   TB I p58 says "every few months"; 18 weeks is ours, a little over four. */
const YR_OFF_AFTER=18;
function yrBlocks(){ return yrLay(yrItems()) }
function yrLay(items){
  let at=(items[0]&&items[0].start)||progSwitchMonday(), run=Math.max(0,Math.round((D(at)-D(plan.startMonday))/(7*864e5)));
  return items.map((it,i)=>{
    const w=itemWeeks(it), b={it,i,start:at,end:addDays(at,w*7-1),weeks:w,warn:false};
    if(it.off) run=0; else { run+=w; if(run>YR_OFF_AFTER){b.warn=true;b.since=run-w;run=w} }
    at=addDays(at,w*7); return b;
  });
}
function yrEnd(){ const b=yrBlocks(); return b.length?b[b.length-1].end:addDays(yrFirstStart(),-1) }
// Writing the year back. The handover stays with whatever is first.
function yrSet(list){
  const st=(yrItems()[0]||{}).start;
  list=list.map(it=>{const o=Object.assign({},it);delete o.start;return o});
  if(list[0]&&st) list[0].start=st;
  mutatePlan(p=>{p.nextPrograms=list});
}
function yrMove(i,d){ const q=yrItems(), j=i+d; if(!q[i]||j<0||j>=q.length) return false; [q[i],q[j]]=[q[j],q[i]]; yrSel=j; yrSet(q); return true }
function yrRemove(i){ const q=yrItems(); if(!q[i]) return false; q.splice(i,1); yrSel=-1; yrSet(q); return true }
function yrInsert(i,it){ const q=yrItems(); q.splice(Math.max(0,Math.min(i,q.length)),0,it); yrAdd=null; yrSet(q); return true }
function yrOffBefore(i){ return yrInsert(i,{off:true}) }
function yrCycles(i,d){
  const q=yrItems(), it=q[i]; if(!it||it.off||itemFixed(it)) return false;
  const c=Math.max(1,Math.min(4,itemCycles(it)+d)); if(c===itemCycles(it)) return false;
  q[i]=Object.assign({},it,{cycles:c}); yrSet(q); return true;
}
// The books' next step after block i-1, or after the program you are on.
function yrBookAfter(i){
  const q=yrItems(); let j=i-1; while(j>=0&&q[j].off) j--;
  return j<0?chzBookNext():nextProgram(q[j],carryMaxes());
}

/* Planning back from a goal. Each goal is the books' sequence that ends on the date,
   longest first, and what is said when there is not room for the whole of it. The
   weeks before are filled with whole blocks of the books' next step after what you are
   on, a week off before each; what is left over, too short for a block, is the program
   you are on running that much longer before it hands over. */
const YR_GOALS={
  race:{label:'A race, 5K to 10K',date:'Race day',name:'the race',
    seq:()=>[[{off:true},{stempl:'fighter',cproto:'mtirun',bb:'standard',runFrom:6,why:['Base Building first, its E sessions run (walk-run is fine, TB II p89), then MTI’s plan from week 6 with Fighter.','TB II p17, MTI']}],
             [{off:true},{stempl:'fighter',cproto:'mtirun',runFrom:6,why:['MTI’s plan from week 6 with Fighter: the 3-mile test, then the 6-mile.',RUN_SRC]}],
             [{off:true},{stempl:'fighter',cproto:'mtirun',runFrom:11,why:['MTI’s last block with Fighter: the 6-mile test and 2-mile repeats.',RUN_SRC]}]],
    cut:'No room for Base Building, so MTI’s plan starts at week 6.',cut2:'Not enough room for week 6: MTI’s plan starts at week 11, which MTI pitches at experienced runners.',cite:RUN_SRC},
  event:{label:'Selection or a test',date:'Event date',name:'the event',
    seq:()=>[[{off:true},{stempl:'fighter',cproto:'black',bb:'standard',weeks:9,why:['The book’s 17-week program: 8 weeks of Base Building, then 9 of Black with Fighter, run on until your benchmarks are met.','TB II p200']}],
             [{off:true},{stempl:'fighter',cproto:'black',weeks:9,why:['Black with Fighter. The book starts with 8 weeks of Base Building; there is not room for it.','TB II p200']}]],
    cut:'No room for Base Building, so Black starts straight away.',cite:'TB II p200'},
  size:{label:'Put on size',date:'By',name:'your size goal',
    seq:()=>[[{off:true},{stempl:'mass',cproto:'massgreen',bb:'mass',why:['Six weeks of Base Building, then General Mass with Green.','TB III p129']},{stempl:'specalpha',cproto:'massblack',cycles:1,why:['Then Specificity with Black, in three-week blocks.','TB III p129, p58']}],
             [{off:true},{stempl:'mass',cproto:'massgreen',why:['General Mass with Green.','TB III p129']},{stempl:'specalpha',cproto:'massblack',cycles:1,why:['Then Specificity with Black.','TB III p129']}]],
    cut:'No room for the six weeks of Mass Base Building.',cite:'TB III p129'},
  strength:{label:'Get stronger',date:'Retest by',name:'the retest',
    seq:()=>{const nx=chzBookNext();return [[{off:true},Object.assign(pickOf(nx),{why:nx.why[0]})]]},
    cut:'',cite:'TB I p49'},
};
function ygOpen(){ return yg={goal:(plan.yearGoal||{}).goal||'event',date:(plan.yearGoal||{}).date||addDays(yrFirstStart(),7*26+5)} }
function ygPlan(goal,date){
  const G=YR_GOALS[goal]; if(!G||!date) return null;
  const from=progSwitchMonday(), gap=Math.max(0,Math.round((D(addDays(mondayOf(date),7))-D(from))/(7*864e5)));
  const seqs=G.seq(), len=s=>s.reduce((t,it)=>t+itemWeeks(it),0);
  let k=seqs.findIndex(s=>len(s)<=gap); const short=k<0; if(short) k=seqs.length-1;
  const tail=seqs[k];
  let free=gap-len(tail); const items=[];
  const nx=chzBookNext(), fill=[{off:true},Object.assign(pickOf(nx),{why:nx.why[0]})], fl=len(fill);
  while(free>=fl){items.push(...fill.map(x=>Object.assign({},x)));free-=fl}
  items.push(...tail.map(x=>Object.assign({},x)));
  const extra=Math.max(0,free);
  if(items[0]) items[0].start=addDays(from,extra*7);
  return {items,gap,extra,short,cut:k>1&&G.cut2?G.cut2:k>0?G.cut:'',need:len(seqs[seqs.length-1]),cite:G.cite,G};
}
// Taking it: the year is replaced, and the goal kept so planning again starts there.
function ygUse(){
  const r=yg&&ygPlan(yg.goal,yg.date); if(!r||r.short) return false;
  mutatePlan(p=>{p.nextPrograms=r.items;p.yearGoal={goal:yg.goal,date:yg.date}});
  yg=null; yrSel=-1; return true;
}
