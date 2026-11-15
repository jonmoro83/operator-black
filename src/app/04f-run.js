/* ---------------- MTI's running plan ----------------
Asked for 2026-11-15: a beginner running program and progressions for intermediate
runners. Neither Tactical Barbell nor MTI has a separate beginner program; both start
beginners inside one they have. So this is MTI's Running Improvement Plan (Plan Focus,
2017-04-24), the user's pick, entered at the week MTI gives for your level:

  "new to running? Begin the plan on week 1 ... some running experience but need lots
   of work? Start at week 6 ... an experienced runner wanting to be pushed? Start at
   week 11." Alongside a strength program, "start this plan on Week 6 and drop the
   Tuesday and Thursday strength days": your template's days take their place.

What the article gives: three five-week blocks (a 1.5-mile test and 800 m repeats, a
3-mile test and 1-mile repeats, a 6-mile test and 2-mile repeats); intervals Monday and
Wednesday, a test on some Mondays; easy distance runs Friday and Saturday, "3 miles on
week one" rising "to 12 miles on week 15". The paces are MTI's Running Calculator, whose
factors it published (Lab Rat Calculator, 2015): a time for each interval and a range
per mile for easy running, each a fraction of your test time.

What it does not give, the plan's day-by-day sessions being paid, is ours and said so:
which Mondays test (the first and fourth of each block, after MTI's "mid-cycle we
usually program in a re-assessment", Programming Holy Grail part 3, 2019), how many
repeats, and the rest between them (five minutes, from MTI's 800 m mini-study, 2018). */
const RUN_BLOCKS=[
  {test:'mtit15',rep:'mti800',dist:1.5,repLabel:'800 m',reps:[4,5,6,5,6],
   iv:[.3113,.3147],easy:[.8977,.96324]},
  {test:'mtit3',rep:'mti1mi',dist:3,repLabel:'1 mile',reps:[3,3,4,3,4],
   iv:[.3067,.31],easy:[.4266,.4577]},
  {test:'mtit6',rep:'mti2mi',dist:6,repLabel:'2 miles',reps:[2,2,3,2,3],
   iv:[.302,.3053],easy:[.2,.215]},
];
const RUN_TEST_K=[1,4];          // which weeks of a block test: ours
const RUN_REST=300;
function runFrom(){ return [1,6,11].includes(+plan.runFrom)?+plan.runFrom:1 }
/* The plan's week for a calendar week: weeks of this program so far, not counting
   Base Building, weeks off, the bridge or travel, from the week you entered at. After
   week 15 the last block runs again. */
function runWeekOf(wk){
  if(!wk||!wk.monday) return {w:runFrom(),b:Math.floor((runFrom()-1)/5),k:(runFrom()-1)%5+1};
  const list=weeks(Math.max(0,wk.idx!=null?wk.idx:idxOf(wk.monday))+1);
  let n=0;
  for(const x of list){ if(x.monday>wk.monday) break; if(!['bb','off','bridge','bridge3','travel'].includes(x.kind)) n++ }
  let w=runFrom()+Math.max(1,n)-1;
  if(w>15) w=11+((w-11)%5);
  return {w,b:Math.floor((w-1)/5),k:(w-1)%5+1};
}
// Your latest test time at a distance, in seconds, logged on or before `upto`.
function runTestTime(fmt,upto){
  let best=null;
  for(const [d,L] of Object.entries(logs)){
    const h=L&&L.hic; if(!h||h.format!==fmt||!h.time||(upto&&d>upto)) continue;
    const s=toSecs(h.time); if(s&&(!best||d>best.d)) best={d,s};
  }
  return best;
}
// A test's time sets the format on the day it is logged, so it can be found again.
function runTestStamp(date){
  const f=effFmt(date), L=lg(date).hic||{};
  if(!L.format&&RUN_BLOCKS.some(B=>B.test===f)) setLog(date,'hic.format',f);
}
function runPaceStr(lo,hi){ return lo===hi?mmss(lo):mmss(lo)+'–'+mmss(hi) }
function runMi(mi){ return u()==='kg'?`${n(+(mi*1.609).toFixed(1))} km`:`${n(mi)} mi` }
// Per mile, or per km on metric.
function runPerUnit(lo,hi){ const k=u()==='kg'?1/1.609:1; return runPaceStr(lo*k,hi*k)+(u()==='kg'?' per km':' per mile') }
function runEasyMiles(w){ return Math.round(3+(Math.min(15,w)-1)*9/14) }
function runSessions(wk){
  const r=runWeekOf(wk), B=RUN_BLOCKS[r.b], test=RUN_TEST_K.includes(r.k);
  const t=runTestTime(B.test,wk&&wk.monday?addDays(wk.monday,6):null), T=t&&t.s;
  const reps=B.reps[r.k-1], from=T?` From your ${B.dist}-mile test of ${mmss(T)}.`:'';
  const repNote=T?`${reps} × ${B.repLabel}, each in ${runPaceStr(T*B.iv[0],T*B.iv[1])}, resting ${RUN_REST/60} minutes between.${from}`
    :`${reps} × ${B.repLabel}, a little faster than your ${B.dist}-mile test pace and even across all of them, resting ${RUN_REST/60} minutes between. Log a ${B.dist}-mile test and the times are worked out for you.`;
  const rep={t:'hic',fmt:B.rep,mod:'run',short:B.repLabel+' ×'+reps,note:repNote,run:{w:r.w,reps}};
  const mi=runEasyMiles(r.w);
  const easy=(i)=>({t:'hic',fmt:'liss',mod:'run',short:'Easy '+runMi(mi),
    note:`Easy distance run, ${runMi(mi)}${T?` at ${runPerUnit(T*B.easy[0],T*B.easy[1])}`:', at a pace you could talk at'}.${i?' The second of two on back-to-back days.':''} Walk-run is fine while you are new to it.`});
  return [
    test?{t:'hic',fmt:B.test,mod:'run',short:B.dist+'-mile test',note:`Week ${r.w} of 15. Run ${B.dist} miles for time, as fast as you can hold, on a track or a measured route. Log the time: it sets the paces until the next test. New to running? Walk-run it if you must, but try to run it.`,run:{w:r.w}}
        :Object.assign({},rep,{note:`Week ${r.w} of 15. `+rep.note}),
    rep, easy(0), easy(1),
  ];
}
// The day's repeat count, for the timer.
function runDayReps(date){ const dp=dayPlan(date); return dp&&dp.run&&dp.run.reps||null }
