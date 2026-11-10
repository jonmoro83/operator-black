/* ---------- interval timer ---------- */
// Black's HIC formats as guided intervals. The session is a list of segments timed from
// an absolute start, so it stays right through screen locks and reloads. Each change of
// interval beeps (3-2-1 then a tone) and, with alerts on, is queued as a push.
const IV={map:{work:60,rest:60,rounds:[8,10]},anaerobic:{work:30,rest:120,rounds:[6,8]},threshold:{work:240,rest:180,rounds:[4,4]},long:{work:180,rest:90,rounds:[5,5]},fobbit:{work:15,rest:120,lead:true,fob:true},
  /* TB III's Black sessions. Short, maximal, and well rested between efforts -- the
     book's point is that every rep is all out, so the rests are long on purpose. */
  sprints:{work:8,rest:90,rounds:[5,10],def:8},
  reset20:{work:20,rest:150,rounds:[3,5],def:4},
  hillsprint:{work:15,rest:90,rounds:[3,10],def:6},
  /* Endurance Predator is a Green session and the same shape as a FOBBIT: hold an easy
     base, step off it for a bout. So it rides the same machinery, with its spec here
     instead of in the FOBBIT catalog. Over 30 minutes it reads as an E, which is what
     the book calls it. */
  predator:{work:15,rest:420,lead:true,every:[300,600],count:'total',mins:[30,45,60],def:45,
    mv:[['Sprint 50 to 100 m',{s:15}]]},
  /* Freeform: your own hard and easy times for a length in minutes. The rounds fall out
     of the length, and unlike the book formats the last easy period is kept, so 15
     minutes of 15 s / 45 s is fifteen rounds and fifteen minutes on the clock. */
  free:{work:15,rest:45,mins:15,free:true}};
/* Tactical Barbell II's named sessions as timer shapes. `seq` is one round: a timed
   segment has `s`, a bout of reps or distance has `hold` and the timer waits at it until
   you tap Done, with `est` as our guess at its length for sizing the session. A function
   gets the round number and the count, for the ladders. `pre` runs once before the
   rounds and `post` once after; the last round's trailing rest is dropped, as it is for
   every other format. The book's rest ranges take the low end, like everywhere else. */
const BK_W=(l,s)=>({k:'work',l,s}), BK_R=(s,l)=>({k:'easy',l:l||'Rest',s}), BK_H=(l,est,k)=>({k:k||'work',l,hold:true,est});
const BK_WALK=(est)=>BK_H('Walk back',est||60,'easy');
const BK_PS=(()=>{const x=[];for(let j=0;j<3;j++){for(let i=0;i<3;i++){x.push(BK_W('Plank',30),BK_W('Shank',30))}if(j<2)x.push(BK_R(45))}return x})();
const IV_BOOK={
  connaught:{rounds:[5,10],def:10,seq:(i,n)=>[BK_H(`${n-i+1} burpees`,4*(n-i+1)),BK_H('Sprint 100 m',20)]},
  fast5:{rounds:[1,1],def:1,seq:[BK_H('Tempo run 5 km',1500)]},
  resets600:{rounds:[4,10],def:6,seq:[BK_H('Sprint 600 m',120),BK_R(180)]},
  bagresets:{rounds:[4,10],def:5,seq:[BK_W('Heavy bag',90),BK_R(120)]},
  indoorpower:{rounds:[3,5],def:5,seq:[BK_W('Max effort',120),BK_R(180)]},
  sledgedrill:{rounds:[3,5],def:5,seq:[BK_W('Sledge',60),BK_W('Jump rope',60),BK_W('Sledge',30),BK_W('Jump rope',30),BK_R(120)]},
  boo:{rounds:[3,5],def:5,seq:[BK_W('Kettlebell swings',60),BK_H('Run 800 m',210),BK_R(120)]},
  boo2:{rounds:[2,5],def:3,seq:[BK_H('10 burpees',40),BK_H('Run 800 m',210),BK_H('5 burpees',20),BK_H('Run 400 m, max effort',90),BK_R(120)]},
  shorthills:{rounds:[5,20],def:10,seq:[BK_H('Hill sprint',15),BK_H('Walk down',45,'easy')]},
  oxygendebt:{rounds:[2,4],def:3,seq:[BK_H('Sprint 200 m',35),BK_R(30),BK_H('Sprint 200 m',35),BK_R(30),BK_H('Sprint 200 m',35),BK_R(180)]},
  seladder:{rounds:[1,3],def:1,seq:[BK_H('Sprint 400 m',70),BK_R(40),BK_H('Sprint 300 m',50),BK_R(30),BK_H('Sprint 200 m',35),BK_R(20),BK_H('Sprint 100 m',18),BK_R(10),
    BK_H('Sprint 100 m',18),BK_R(20),BK_H('Sprint 200 m',35),BK_R(30),BK_H('Sprint 300 m',50),BK_R(40),BK_H('Sprint 400 m',70),BK_R(120)]},
  meateater:{rounds:[5,15],def:10,seq:[BK_H('Sprint 100 m',18),BK_H('20 swings',40),BK_WALK(60)]},
  meateater2:{rounds:[5,10],def:10,seq:[BK_H('10 swings',20),BK_H('10 burpees',40),BK_R(60)]},
  disarmed:{rounds:[3,5],def:3,seq:[BK_H('10 burpees',40),BK_W('Heavy bag',120),BK_R(60)],post:[BK_R(90,'Rest before the finisher')].concat(BK_PS)},
  stdhills:{rounds:[3,10],def:5,seq:[BK_H('Hill sprint',40),BK_H('Walk down',60,'easy'),BK_R(60)]},
  apex:{rounds:[3,15],def:5,seq:[BK_H('Hill sprint',40),BK_H('10 swings',20),BK_H('Walk down',60,'easy'),BK_R(60)]},
  bloodylungs:{rounds:[5,10],def:5,seq:[BK_H('10 plank push-ups',40),BK_H('Hill sprint',40),BK_H('10 burpees',40),BK_H('Walk down',60,'easy')]},
  bloodylungs2:{rounds:[5,12],def:5,seq:[BK_H('10 burpees',40),BK_H('Hill sprint',40),BK_H('5 snatches per arm',30),BK_H('Walk down',60,'easy'),BK_R(60)]},
  anaerobiccap:{rounds:[1,1],def:1,seq:[BK_H('Jog 800 m',270,'easy'),BK_H('Sprint 400 m',75),BK_H('Jog 800 m',270,'easy'),BK_H('Sprint 400 m',75),BK_H('Jog 400 m',135,'easy'),BK_H('Sprint 200 m',35),BK_H('Jog 400 m',135,'easy'),BK_H('Sprint 200 m',35)],
    post:[BK_H('50 plank push-ups',180)]},
  /* Pepper Potting is a base-first shape like a FOBBIT: an easy ruck, broken every five
     minutes by a bout. Over 30 minutes it would read as an E, so the choices stop at 30. */
  pepperpot:{work:45,rest:300,lead:true,every:300,count:'total',mins:[20,25,30],def:30,mv:[['Pepper-pot 100 m',{s:45}]]},
  buffalo:{rounds:[4,6],def:4,seq:[BK_H('10 burpees',40),BK_H('Run 400 m',90),BK_H('10 swings',20),BK_R(45)]},
  meateater3:{rounds:[4,8],def:4,seq:[BK_H('10 double KB clean and press',45),BK_H('Sprint 300 m',55),BK_H('Lunge 100 m back',120)]},
  trinity:{rounds:[2,5],def:5,seq:[BK_W('Swings',60),BK_W('Burpees',60),BK_W('Heavy bag',60),BK_R(60)]},
  gc1:{rounds:[1,3],def:1,seq:[BK_W('Burpees',180),BK_R(180),BK_W('Burpees',120),BK_R(120),BK_W('Burpees',60),BK_R(60)]},
  gc2:{rounds:[5,10],def:10,seq:(i,n)=>{const r=n-i+1;return [BK_H(`${r} pull-ups`,3*r),BK_H(`${r} burpees`,4*r),BK_H(`${r} squat jumps`,2*r),BK_H(`${r} plyo push-ups`,2*r)]}},
  gc3:{rounds:[3,5],def:3,seq:[BK_W('Burpees',30),BK_W('Dips',30),BK_W('Burpees',30),BK_W('Squats',30),BK_W('Burpees',30),BK_W('Back extensions',30),BK_R(60)]},
  gc4:{rounds:[1,2],def:1,seq:[BK_H('100 pull-ups',300),BK_H('Run 400 m',110),BK_H('100 push-ups',240),BK_H('Run 400 m',110),BK_H('100 swings',200),BK_H('Run 400 m',110)]},
  gc5:{rounds:[3,3],def:3,seq:[BK_W('Max dips',60),BK_R(90),BK_W('Max push-ups',60),BK_R(90)],
    post:[BK_R(120,'Rest before B'),BK_H('5 pull-ups',15),BK_H('10 burpees',40),BK_H('5 pull-ups',15),BK_H('10 burpees',40),BK_H('5 pull-ups',15),BK_H('10 burpees',40)]},
  gc6:{rounds:[3,5],def:3,seq:[BK_W('AMRAP: 10 sledge, 5 burpees, 10 squats',300),BK_R(60)]},
  gc7:{rounds:[1,5],def:3,seq:[BK_H('50 burpees',200),BK_H('50 squats',90),BK_H('50 diamond push-ups',120),BK_H('Run 800 m',210)]},
  gc8:{rounds:[2,4],def:4,seq:[BK_H('10 snatches per arm',50),BK_H('25 box jumps',60),BK_H('25 knees to elbows',60),BK_H('25 dips',60),BK_H('5 burpees',20)],
    post:[BK_R(120,'Rest before B'),BK_W('Handstand hold',60),BK_R(120),BK_W('Handstand hold',60),BK_R(120),BK_W('Handstand hold',60)]},
  gc9:{rounds:[1,1],def:1,seq:[BK_W('AMRAP: 3 pull-ups, 5 burpees, 10 squats',600)],
    post:[BK_R(120,'Rest before B')].concat(...Array.from({length:10},(_,i)=>[BK_H(`Sprint 100 m (${i+1} of 10)`,18),BK_WALK(50)]))},
  gc10:{rounds:[4,4],def:4,seq:[BK_W('Jog',120),BK_H('25 burpees',90)]},
  gc11:{rounds:[5,5],def:5,seq:[BK_H('Sprint 100 m',18),BK_H('Bear crawl 50 m',60)],post:[BK_H('100 sledge strikes',240)]},
  gc12:{rounds:[1,3],def:3,pre:[BK_H('Run 1.5 miles',720),BK_R(120,'Rest before B')],seq:[BK_H('20 push presses',60),BK_H('20 back extensions',60),BK_H('20 pull-ups',60)]},
  bwplyo:{rounds:[2,3],def:3,seq:[BK_H('10 plyo push-ups',20),BK_R(90),BK_H('10 jump squats',20),BK_R(90),BK_H('5 to 10 plyo pull-ups',20),BK_R(120)],
    post:[].concat(...Array.from({length:5},(_,i)=>[BK_H(`Sprint 50 m (${i+1} of 5)`,10),BK_WALK(40)]))},
  powercomplex:{rounds:[2,3],def:3,seq:[BK_H('Push press × 5',20),BK_R(90),BK_H('10 KB squat jumps',20),BK_R(90),BK_H('Snatch × 5 per arm',30),BK_R(90),BK_H('5 plyo pull-ups',15),BK_R(90)]},
  kinetic:{rounds:[2,3],def:3,seq:[BK_H('Sprint 50 m, 5 plyo push-ups',25),BK_R(120),BK_H('Sprint 50 m, 5 squat jumps',25),BK_R(120)]},
  transition:{rounds:[2,3],def:2,seq:[BK_H('Front squat × 3',20),BK_H('10 squat jumps',20),BK_R(120),BK_H('Overhead press × 3',20),BK_H('10 plyo push-ups',20),BK_R(120),BK_H('Weighted pull-ups × 3',20),BK_H('10 med ball slams',20),BK_R(120)]},
};
for(const [k,v] of Object.entries(IV_BOOK)){ if(!v.lead){ v.work=0; v.rest=0 } IV[k]=v }
// One round of a book session as segments. The sub-label names the round, and the
// trailing rest of the last round is dropped, as it is for every other format.
function bookRound(r,i,n){
  const items=typeof r.seq==='function'?r.seq(i,n):r.seq;
  return items.map(x=>({k:x.k,l:x.l,sub:'Round '+i+' of '+n,s:x.hold?x.est:x.s,round:i,hold:!!x.hold,est:!!x.hold,reps:x.hold?'':undefined}));
}
function bookOnce(items,lead){ return (items||[]).map(x=>({k:x.k,l:x.l,sub:lead?'Before the rounds':'After the rounds',s:x.hold?x.est:x.s,hold:!!x.hold,est:!!x.hold,reps:x.hold?'':undefined,lead:!!lead,post:!lead})) }
const FREE_PRESETS=[[15,45,15],[20,40,20],[30,30,20],[10,50,10],[20,10,4]];
const FREE_MAX_ROUNDS=100;
// The shape a freeform day used, from what it logged, then what you last ran, then the default.
function freeShape(date){
  const o=((lg(date).hic||{}).iv)||{}, last=plan.ivFree||{}, d=IV.free;
  const pick=(k,lo,hi)=>{const v=o[k]!=null&&o[k]!==''?+o[k]:last[k]!=null?+last[k]:d[k];return Math.min(hi,Math.max(lo,Math.round(v)||d[k]))};
  const work=pick('work',5,600), rest=pick('rest',5,600), mins=pick('mins',1,90);
  return {work,rest,mins,rounds:Math.min(FREE_MAX_ROUNDS,Math.max(1,Math.round(mins*60/(work+rest))))};
}
function freeLabel(x){return secsLabel(x.work)+' hard / '+secsLabel(x.rest)+' easy'}
let iv=LS.get('ob.iv'), ivTick=null, ivLast={idx:-1,left:-1}, ivStopArm=0;
// How far into a segment a change cue is still worth sounding. The tick is 200 ms, so
// anything past a second and a half means the page was not running.
const IV_CUE_LATE=1.5;
function mmss(t){t=Math.max(0,Math.round(t));return Math.floor(t/60)+':'+pad(t%60)}
/* Two different reasons to go easier, and only one of them is the book's.

   TB2, under BLACK PROTOCOL - EASY WEEK PRINCIPLE: "Every third week, (3, 6, 9) make
   your conditioning sessions easy. Cut the number of rounds in half, lower the
   duration and/or intensity. Don't strain -- just 'grease the groove' with little
   effort." The same page says the easy week "purposely coincides with Tactical
   Barbell's strength training heavy weeks (90%-95% loads)", which is how `easyCondWeek`
   finds it, so the timing was already right. The amount was not: this used to take the
   lowest prescribed option, and for map, anaerobic, threshold and long the lowest
   option is the default -- so on four of seven formats the easy week changed nothing
   while the card said it had.

   A soft day is ours: readiness came back under par, so drop to the lowest option the
   format offers. That is a smaller cut than halving, and when both apply the lower of
   the two wins.

   Odd numbers round up, because the book says to grease the groove rather than to
   stop, and three rounds of five is nearer that than two. */
function easeRounds(r,fmt,soft,easyWk){
  const base=((plan.ivRounds||{})[fmt])||r.def||r.rounds[0];
  const cuts=[];
  if(soft) cuts.push(r.rounds[0]);
  if(easyWk) cuts.push(Math.max(1,Math.round(base/2)));
  return cuts.length?Math.min(...cuts):base;
}
function ivOpts(date,fmt){
  const o=((lg(date).hic||{}).iv)||{}, r=IV[fmt];
  const soft=(lv0=>!!(lv0&&lv0.k!=='go'))(rLevel(readiness(ci(date))));
  const easyWk=easyCondWeek(date);
  const ease=soft||easyWk;
  // A FOBBIT is picked in minutes, because that is the number the sources argue about
  // and the number that decides whether it is a HIC or an E. Rounds fall out of it.
  if(r&&r.lead){
    const id=r.fob?fobOf(date):null, F=r.fob?FOBBIT[id]:r, opts=specMinOpts(F);
    // Before FOBBITs carried their own interval the stored number was rounds of a
    // two-minute base, so read a legacy value that way and old sessions keep their length.
    const stored=o.mins!=null?+o.mins:(o.rounds!=null?+o.rounds*2:null);
    const mins=stored||(ease?opts[0]:specDefMins(F));
    return {fob:id, mins, minOpts:opts, every:specEvery(F), count:specCount(F),
      rounds:specRounds(F,mins), isE:fobIsE(mins),
      warm:o.warm!=null?o.warm:false, cool:!!o.cool, lissMin:o.lissMin||(ease?25:35), ease,
      bouts:specBouts(F,ease,(lg(date).hic||{}).what)};
  }
  // Freeform is your own dose, so neither the easy week nor a soft day trims it.
  if(r&&r.free){const x=freeShape(date);
    return Object.assign(x,{warm:o.warm!=null?o.warm:false, cool:!!o.cool, lissMin:35, ease:false, bouts:null})}
  const def=r?easeRounds(r,fmt,soft,easyWk):null;
  return {rounds:o.rounds||def, warm:o.warm!=null?o.warm:(fmt!=='liss'), cool:!!o.cool, lissMin:o.lissMin||(ease?25:35), ease, bouts:null};
}
function ivSegments(fmt,o){
  const seg=[];
  if(o.warm&&fmt!=='liss'){seg.push({k:'easy',l:'Warm-up',s:300});for(let i=1;i<=3;i++){seg.push({k:'work',l:'Pickup',sub:'Pickup '+i+' of 3',s:15});seg.push({k:'easy',l:'Easy',sub:i<3?'Then pickup '+(i+1):'Intervals next',s:i<3?45:60})}}
  if(fmt==='liss') seg.push({k:'easy',l:'Steady',sub:'Conversational pace',s:o.lissMin*60});
  else {const r=IV[fmt], wk=o.burst||r.work;
    // A base-first format (FOBBIT) counts only the base: two easy minutes before every
    // burst, until the base adds up. The bursts sit on top, so the session runs longer
    // than its nominal length. The book alternates two movements, hence A and B.
    if(r.lead){
      const bs=(o.bouts&&o.bouts.length)?o.bouts:[{name:'Burst',reps:'Set',hold:true,secs:null}];
      const ev=o.every||r.rest;
      for(let i=1;i<=o.rounds;i++){
        const b=bs[(i-1)%bs.length];
        seg.push({k:'easy',l:'Base',sub:'Before burst '+i+' of '+o.rounds,s:ev,round:i,lead:i===1});
        seg.push({k:'work',l:b.name,sub:doseLabel(b),s:b.secs||FOB_HELD,round:i,hold:!!b.hold,reps:b.reps});
      }
    }
    else if(r.seq){
      seg.push(...bookOnce(r.pre,true));
      for(let i=1;i<=o.rounds;i++){
        const rd=bookRound(r,i,o.rounds);
        if(i===o.rounds&&rd.length>1&&rd[rd.length-1].k==='easy'&&!rd[rd.length-1].hold) rd.pop();
        seg.push(...rd);
      }
      seg.push(...bookOnce(r.post,false));
    }
    else {const w=r.free?o.work:wk, e=r.free?o.rest:r.rest;
      for(let i=1;i<=o.rounds;i++){seg.push({k:'work',l:'Hard',sub:'Round '+i+' of '+o.rounds,s:w,round:i});if(i<o.rounds||r.free)seg.push({k:'easy',l:'Easy',sub:'Round '+i+' of '+o.rounds+' done',s:e,round:i})}}}
  if(o.cool) seg.push({k:'easy',l:'Cool-down',sub:'Easy spin-down',s:300});
  return seg;
}
function ivTotal(segs){return segs.reduce((a,x)=>a+x.s,0)}
// Where the minutes go: everything before the first round is the warm-up, a trailing
// Cool-down segment is the cool-down, the rest is the work. The work total has one fewer
// easy period than hard ones — the timer does not make you stand there resting after the
// last round — so 8 × 1:00/1:00 is 15 minutes of intervals, not 16.
function ivParts(segs){
  const i=segs.findIndex(x=>x.round||x.lead);
  const hasCool=segs.length&&segs[segs.length-1].l==='Cool-down';
  const cool=hasCool?segs[segs.length-1].s:0;
  const warm=i<0?0:segs.slice(0,i).reduce((a,x)=>a+x.s,0);
  // Rep bursts are not on the clock. A book session's held bouts carry an estimate and
  // are part of its length, so those stay in.
  const held=segs.reduce((a0,x)=>a0+(x.hold&&!x.est?x.s:0),0);
  return {warm,work:ivTotal(segs)-warm-cool-held,cool,rounds:new Set(segs.filter(x=>x.round&&x.k==='work').map(x=>x.round)).size};
}
function ivPartsLabel(f,o){
  const segs=ivSegments(f,o), p=ivParts(segs), m=s0=>Math.round(s0/60), bits=[];
  if(p.warm) bits.push(m(p.warm)+' min warm-up');
  const lead=(IV[f]||{}).lead, held=segs.reduce((a0,x)=>a0+(x.hold?x.s:0),0);
  const tot=lead&&o.count==='total'?p.work+held:p.work;
  bits.push(m(tot)+(f==='liss'?' min steady':lead?(o.count==='total'?' min in all':' min of base'):' min of intervals'));
  if(p.cool) bits.push(m(p.cool)+' min cool-down');
  return {text:bits.join(' + '),rounds:p.rounds,total:m(p.warm+tot+p.cool)};
}
function ivElapsed(){if(!iv)return 0;return ((iv.paused||Date.now())-iv.start-iv.pausedMs)/1000}
// A held burst is not part of the session's length, so the countdown reports base only.
function ivBaseLeft(p,t){let acc=0;for(let i=p.i;i<iv.segs.length;i++){const g=iv.segs[i];if(g.hold&&!g.est)continue;acc+=i===p.i?p.left:g.s}return Math.max(0,Math.round(acc))}
// Wall-clock time since the first round began: what a session done "for time" scores.
function ivWall(){ if(!iv||!iv.t0) return 0; return Math.max(0,Math.round(((iv.t1||Date.now())-iv.t0)/1000)) }
function ivPos(el){let acc=0;for(let i=0;i<iv.segs.length;i++){if(el<acc+iv.segs[i].s)return {i,left:acc+iv.segs[i].s-el,into:el-acc};acc+=iv.segs[i].s}return {i:iv.segs.length,left:0,into:0}}
// tone() lived here: the second audio path, with none of beep()'s fixes. See sfx().
function vib(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
function ivStart(fmt){
  const o=ivOpts(sel,fmt), segs=ivSegments(fmt,o);
  // The rest's alert and the session's are separate slots on the server now, so the
  // rest being cancelled here cannot race the interval schedule and erase it.
  unlockAudio(); stopRest();
  iv={date:sel,fmt,mod:modOf(sel),segs,start:Date.now()+1500,paused:null,pausedMs:0,mini:false,rounds:o.rounds||0,done:false};
  // Freeform remembers the whole shape, and the day logs it, so the history can say what it was.
  if(IV[fmt]&&IV[fmt].free){plan.ivFree={work:o.work,rest:o.rest,mins:o.mins};planV++;queueWrite('plan/main',()=>plan);
    for(const k of ['work','rest','mins']) setLog(sel,'hic.iv.'+k,o[k])}
  else if(IV[fmt]) plan.ivRounds=Object.assign({},plan.ivRounds||{},{[fmt]:o.rounds}),planV++,queueWrite('plan/main',()=>plan);
  ivLast={idx:-1,left:-1}; LS.set('ob.iv',iv); syncScreen(); ivShow(); alarmSync();
}
// What the server should hold for this session: one alert per change still to come.
function ivAlerts(){
  const now=Date.now(), list=[]; let acc=0;
  iv.segs.forEach((x,i)=>{acc+=x.s; const at=iv.start+iv.pausedMs+acc*1000; if(at<=now+1000) return;
    const nx=iv.segs[i+1];
    // Worded to be read aloud (Siri Announce Notifications): no symbols or clock times.
    if(nx&&nx.est) list.push({at,title:nx.l,body:(nx.sub?nx.sub+'. ':'')+'Tap done when finished.'});
    else if(nx) list.push({at,title:nx.l==='Pickup'?'Pickup':nx.k==='work'?(nx.l&&nx.l!=='Hard'?nx.l:'Go hard'):nx.l,body:nx.l==='Pickup'?durText(nx.s)+'.':nx.k==='work'?(nx.sub?nx.sub+', ':'')+durText(nx.s)+'.':durText(nx.s)+(nx.sub&&nx.l==='Easy'&&/done$/.test(nx.sub)?'. '+nx.sub+'.':'.')});
    else list.push({at,title:'Intervals done',body:'Log your result in the app.'});
  });
  return list;
}
function ivShow(){
  const el=document.getElementById('iv');
  showCover();
  if(!iv){el.hidden=true;document.body.classList.remove('iv-mini');clearInterval(ivTick);ivTick=null;return}
  el.hidden=false; el.classList.toggle('mini',!!iv.mini); document.body.classList.toggle('iv-mini',!!iv.mini);
  document.getElementById('iv-size').textContent=iv.mini?'Expand':'Minimize';
  document.getElementById('iv-title').textContent=hicTitle(iv.mod,iv.fmt);
  if(!ivTick) ivTick=setInterval(ivRender,200);
  showWake();
  ivRender();
}
function ivRender(){
  if(!iv) return;
  const el=document.getElementById('iv'), t=ivElapsed();
  if(t<0){ // 1.5 s lead-in
    el.className=(iv.mini?'mini ':'')+'easy';
    document.getElementById('iv-phase').textContent='Get ready';document.getElementById('iv-time').textContent=Math.ceil(-t);
    document.getElementById('iv-sub').textContent='';document.getElementById('iv-next').textContent='First: '+iv.segs[0].l+' '+mmss(iv.segs[0].s);return;
  }
  const p=ivPos(t);
  if(p.i>=iv.segs.length){ ivFinish(); return; }
  const seg=iv.segs[p.i], nx=iv.segs[p.i+1], left=Math.ceil(p.left);
  // The clock for a session done for time starts at the first round and stops at the
  // cool-down; the holds pause the segment clock but not the wall clock, which is the point.
  if(!iv.t0&&(seg.round||seg.lead)){ iv.t0=Date.now(); LS.set('ob.iv',iv); }
  if(iv.t0&&!iv.t1&&seg.l==='Cool-down'){ iv.t1=Date.now(); LS.set('ob.iv',iv); }
  if(seg.hold&&!iv.paused&&!iv.done){ iv.paused=Date.now(); LS.set('ob.iv',iv); }
  // A held bout is not a pause: it shows what to do, and for a book session a stopwatch.
  el.className=(iv.mini?'mini ':'')+(iv.paused&&!seg.hold?'paused':seg.k);
  document.getElementById('iv-phase').textContent=iv.paused&&!seg.hold?'Paused':seg.l;
  document.getElementById('iv-time').textContent=seg.hold?(seg.est&&iv.paused?mmss((Date.now()-iv.paused)/1000):seg.reps):mmss(left);
  document.getElementById('iv-sub').textContent=(seg.sub||'')+(iv.paused?'':'');
  const isBook=!!(IV[iv.fmt]&&IV[iv.fmt].seq);
  document.getElementById('iv-next').textContent=(nx?'Next: '+nx.l+(nx.hold?(nx.reps?' '+nx.reps:''):' '+mmss(nx.s))+' · ':'Last one · ')+(isBook?'Elapsed '+mmss(ivWall()):mmss(ivBaseLeft(p,t))+' of base left');
  document.getElementById('iv-fill').style.width=(seg.hold?0:100*p.into/seg.s)+'%';
  document.getElementById('iv-pause').textContent=seg.hold?'Done':iv.paused?'Resume':'Pause';
  document.getElementById('iv-done').hidden=true; document.getElementById('iv-btns').hidden=false;
  if(!iv.paused){
    // Ticking at 5 Hz, a change is caught within 200 ms of it happening. Being a long way
    // into a segment means the page was frozen -- the screen slept, or the app was away --
    // and the cue for a round that started while you were gone is worse than no cue: it
    // sounds like a change that is not happening. Pick the session up silently instead.
    if(p.i!==ivLast.idx){
      if(p.into<IV_CUE_LATE){ if(seg.k==='work'){sfx('go');vib([300])} else {sfx('easy');vib([150,80,150])} setTimeout(()=>say(ivSpeech(seg)),450) }
      else tlog('iv','came back '+Math.round(p.into)+' s into '+seg.l+', no cue');
      ivLast.idx=p.i;
    }
    if(left<=4&&left>0) sfxArm();
    audioClockSample(); showArm(); showCover();
    if(left!==ivLast.left&&left<=3&&left>=1&&p.left<seg.s-0.5){ sfx('tick'); }
    ivLast.left=left;
    // iOS lets the screen lock go mid-session; this is what notices. Free while it holds.
    syncScreen();
  }
}
function durText(t){const m=Math.floor(t/60),sec=t%60,mins=m+(m===1?' minute':' minutes');return t<60?t+' seconds':sec?mins+' '+sec+' seconds':mins}
function ivSpeech(seg){
  const dur=durText(seg.s);
  if(seg.l==='Pickup') return 'Pickup. '+dur+'.';
  if(seg.est) return (seg.sub?seg.sub+'. ':'')+seg.l+'. Tap done when finished.';
  if(seg.k==='work') return (seg.sub?seg.sub+'. ':'')+(seg.l&&seg.l!=='Hard'?seg.l+'. ':'Go hard. ')+dur+'.';
  if(seg.l==='Warm-up') return 'Warm up. Easy for '+dur+'.';
  if(seg.l==='Cool-down') return 'Cool down. '+dur+' easy.';
  if(seg.l==='Steady') return 'Steady pace for '+dur+'.';
  return 'Easy. '+dur+'.';
}
function ivFinish(){
  if(!iv.done){setTimeout(()=>say('Intervals done. Nice work. Log your result.'),900);iv.done=true;if(iv.t0&&!iv.t1)iv.t1=Date.now();LS.set('ob.iv',iv);syncScreen();sfx('ivdone');vib([200,100,200,100,400]);
    if(IV[iv.fmt]) setLog(iv.date,'hic.rounds',iv.rounds);
    if(!(lg(iv.date).hic||{}).format&&iv.fmt!==dayPlan(iv.date).fmt) setLog(iv.date,'hic.format',iv.fmt);
    // the session you actually did, not the one that was planned
    if((lg(iv.date).hic||{}).min==null||(lg(iv.date).hic||{}).min==='') setLog(iv.date,'hic.min',Math.max(1,Math.round(ivElapsed()/60)));
  }
  const el=document.getElementById('iv'); el.className=(iv.mini?'mini ':'')+'easy';
  document.getElementById('iv-phase').textContent='Done';
  document.getElementById('iv-time').textContent=mmss(ivTotal(iv.segs));
  document.getElementById('iv-sub').textContent=IV[iv.fmt]?iv.rounds+' rounds complete':'Steady session complete';
  document.getElementById('iv-next').textContent=''; document.getElementById('iv-fill').style.width='100%';
  const met=metricFor(iv.mod,iv.fmt), box=document.getElementById('iv-done');
  if(box.hidden){ box.hidden=false; document.getElementById('iv-btns').hidden=true;
    const cur=met?((lg(iv.date).hic||{})[met[0]]):null;
    // A session done for time gets the wall clock from the first round to the end,
    // ready to save; change it if the watch says otherwise.
    const inp=met&&met[0]==='time'?`<input type="text" inputmode="numeric" id="iv-result" value="${esc(cur||(iv.t0?mmss(ivWall()):''))}" placeholder="m:ss">`
      :`<input type="number" inputmode="decimal" step="any" id="iv-result" value="${cur??''}" placeholder="Enter your result">`;
    box.innerHTML=(met?`<label class="f" style="text-align:left">${metricLabel(met)}${inp}</label>`:'')+`<button class="btn primary" data-iv="save">${met?'Save and close':'Close'}</button>`;
  }
}
function ivClose(){iv=null;LS.set('ob.iv',null);syncScreen();ivShow();alarmSync();render()}
document.getElementById('iv').addEventListener('click',e=>{
  if(e.target.id==='iv-size'){iv.mini=!iv.mini;LS.set('ob.iv',iv);ivShow();return}
  const b=e.target.closest('[data-iv]'); if(!b||!iv) return; const a=b.dataset.iv;
  if(a==='cover'){ coverTap(); return }
  if(a==='arm'){ ivShow(); return }
  unlockAudio();
  if(a==='pause'){ const held=(()=>{const t=ivElapsed();return t>=0&&(iv.segs[ivPos(t).i]||{}).hold})();
    if(iv.paused){iv.pausedMs+=Date.now()-iv.paused;iv.paused=null;syncScreen();
      if(held){const p=ivPos(ivElapsed()); iv.start-=p.left*1000; ivLast.idx=-1}
    } else iv.paused=Date.now(); LS.set('ob.iv',iv); ivRender(); alarmSync(); }
  else if(a==='skip'){ const t=ivElapsed(); if(t<0){iv.start=Date.now()-iv.pausedMs}else{const p=ivPos(t); iv.start-=p.left*1000;} ivLast.idx=-1; LS.set('ob.iv',iv); ivRender(); alarmSync(); }
  else if(a==='stop'){ if(Date.now()-ivStopArm<3000){ ivClose(); } else { ivStopArm=Date.now(); const s=document.getElementById('iv-stop'); s.textContent='Tap again to end'; setTimeout(()=>{s.textContent='End'},3000); } }
  else if(a==='save'){ const inp=document.getElementById('iv-result'), met=metricFor(iv.mod,iv.fmt); if(inp&&met&&inp.value!==''){ if(!(lg(iv.date).hic||{}).mod) setLog(iv.date,'hic.mod',iv.mod); setLog(iv.date,'hic.'+met[0],met[0]==='time'?String(inp.value).trim():+inp.value); } ivClose(); }
});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') syncScreen() });
