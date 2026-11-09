/* ---------------- linear progression ----------------

Every other program in this app works from a percentage of a max. A true beginner has
no max worth taking a percentage of, and on a linear-progression program the working
weight *is* the program: it starts light, goes up every session you finish, and comes
down when you stall. So nothing in here reads plan.maxes, and nothing in here needs a
cycle — LP ends when it stops working, not on a date. `cycleWeeks()` returning Infinity
is the whole of "open-ended" as far as the schedule engine is concerned.

The weight for a session is folded forward out of the log rather than stored anywhere,
which is how the rest of the app does this kind of thing (pullupState, accLast) and
buys two behaviours the program actually asks for:

  a week you missed costs you nothing, because a session you never logged never
  happened — LP progresses per session, not per calendar week; and

  a session you typed a different weight into becomes the base for the next one,
  because on this program the bar is the truth and the plan is only a guess at it.

Source: StrongLifts 5×5 as commonly published — five sets of five, +5 lb a session
(+10 on the deadlift), three consecutive failed sessions and the weight comes down 10%.
It is not one of the four Tactical Barbell books, the app has no corpus for it, and so
it is labelled **ours** and quoted nowhere. Where this departs from the published
program it says so on the card rather than in a comment. */

const LP_STRIKES=3;                 // failed sessions in a row before the weight drops
const LP_DROP=0.9;                  // and how far it drops
const LP_END=2;                     // resets on one lift before the app says LP is done
/* Five sets of five on everything except the deadlift, which is one. Five sets of
   deadlift three times a week is the one part of the program nobody actually runs. */
const LP_SETS={squat:5,bench:5,ohp:5,pull:5,wpu:5,dead:1};
/* Per session, not per week. The deadlift climbs twice as fast because it starts
   furthest below what you could already do. */
const LP_INC={lb:{dead:10,def:5},kg:{dead:5,def:2.5}};

function lpOn(tpl){ const T=tpl?STEMPL[tpl]:stemplOf(); return !!(T&&T.lp) }
/* The lifts this program actually runs, read off its own days. Not activeLifts()'s
   squat / bench / Lift 3 / deadlift: StrongLifts runs the press and the row both, as
   fixed lifts rather than as a Lift 3 rotation, so the Lift 3 setting has no say. */
function lpLifts(){
  const T=stemplOf(), out=[];
  for(const d of tplDays(T,{w:1})){
    const f=LIFTSET[d.lifts]; if(typeof f!=='function') continue;
    for(const k of f(todayStr())||[]) if(k&&!out.includes(k)) out.push(k);
  }
  return out;
}
function lpRx(k){ return {s:LP_SETS[k]||5,r:5,lp:true} }
function lpInc(k){
  const v=+(((plan.lp||{}).inc||{})[k]);
  if(v>0) return v;
  const t=LP_INC[u()]||LP_INC.lb;
  return t[k]||t.def;
}
/* Where the bar starts. The program's own answer is "light enough that the first few
   weeks are easy", which for most people is the empty bar: the point of LP is the
   slope, not the intercept, and starting too heavy is the commonest way to waste it.
   The deadlift is the exception — pulling an empty bar off the floor is a worse
   position than pulling a loaded one, so it starts at a plated bar. */
function lpStart(k){
  const v=+(((plan.lp||{}).start||{})[k]);
  if(v>0) return v;
  const bar=+plan.bar||45;
  return k==='dead'?rnd(bar*2,plan.round[k]):bar;
}
/* Nearest loadable weight rather than the one below it: at a beginner's weights the
   increment is coarse against the bar, and flooring a 10% cut off 60 lb lands on 50,
   which is 17%. Always at least one increment though, or a drop at a light weight
   would not be a drop at all -- and never below the empty bar. */
function lpDrop(w,k){
  const inc=+plan.round[k]||5;
  return Math.max(+plan.bar||0,Math.min(rnd(w*LP_DROP,inc),w-inc));
}

/* Every day you have logged this lift on, oldest first. Log-driven rather than
   schedule-driven on purpose: a day you squatted is a day that counts, whatever the
   calendar has since been rearranged into, and rescheduling is a thing this app
   deliberately makes easy.

   A day with nothing ticked is not a failed session, it is a session that did not
   happen — it neither advances the weight nor spends a strike. */
function lpHist(k,before){
  const out=[];
  for(const [d,L] of progLogs()){
    if(before&&d>=before) continue;
    const x=(L.lifts||{})[k];
    if(!x||!(x.sets||[]).some(Boolean)) continue;
    out.push([d,x]);
  }
  return out.sort((a,b)=>a[0]<b[0]?-1:1);
}
let lpCache={v:'',m:{}};
/* What the bar should hold on `date`, and how the program is going. Everything before
   `date` counts and `date` itself does not, so today's prescription is a fold over
   everything you have already done. */
function lpState(k,date){
  const ver=planV+':'+logsV+':'+stemplKey(), key=k+'|'+(date||'');
  if(lpCache.v!==ver) lpCache={v:ver,m:{}};
  if(lpCache.m[key]) return lpCache.m[key];
  const need=LP_SETS[k]||5;
  let w=lpStart(k), fails=0, resets=0, last=null, done=0;
  for(const [d,x] of lpHist(k,date)){
    // What was on the bar, which is what you typed if you typed anything.
    const used=x.used!=null&&x.used!==''?+x.used:w;
    const made=(x.sets||[]).filter(Boolean).length>=need;
    last={d,w:used,made,sets:(x.sets||[]).filter(Boolean).length,need};
    done++;
    if(made){ w=used+lpInc(k); fails=0 }
    else if(++fails>=LP_STRIKES){ w=lpDrop(used,k); fails=0; resets++ }
    else w=used;
  }
  return lpCache.m[key]={w,fails,resets,last,done};
}
function lpWeight(k,date){ return lpState(k,date).w }
/* When to stop. Two resets on the same lift is the usual sign that the novice phase is
   over — the weight is no longer the thing holding you back — and the honest thing is
   to say so rather than let somebody ride the same 10% up and down for ever. Ours: the
   published program keeps going and changes the set scheme instead. */
function lpSpent(k,date){ return lpState(k,date).resets>=LP_END }
/* What to say on the lift card: where the weight came from, and what is about to
   happen to it. One line, because it is read mid-session. */
function lpNote(k,date){
  const st=lpState(k,date), inc=lpInc(k), un=' '+u();
  if(!st.last) return {tone:'note',text:`First session on this lift. Finish all ${LP_SETS[k]||5} sets and the next one is ${n(st.w)}${un} — every session, for as long as it keeps working.`};
  const when=fmtD(st.last.d,true);
  if(st.fails>0){
    const left=LP_STRIKES-st.fails;
    return {tone:'warn',text:`Missed ${st.fails===1?'the last session':st.fails+' sessions in a row'} (${st.last.sets} of ${st.last.need} sets on ${when}). Same weight again. ${left===1?'Miss it once more':'Miss it '+left+' more times'} and it comes down to ${n(lpDrop(st.w,k))}${un}.`};
  }
  if(st.resets&&st.last&&!st.last.made) return {tone:'warn',text:`Down to ${n(st.w)}${un} after three misses in a row. Work back up from here \u2014 the second run at a weight usually goes through.`};
  return {tone:'note',text:`Up ${n(inc)}${un} from ${n(st.last.w)} on ${when}. ${st.resets?`Reset ${st.resets===1?'once':st.resets+' times'} so far. `:''}Finish all ${st.last.need} sets and the next one is ${n(st.w+inc)}${un}.`};
}
/* The one thing the program will not tell you itself. Said once, on the card for the
   lift it applies to, rather than as a banner that would sit there for weeks. */
function lpSpentNote(k,date){
  if(!lpSpent(k,date)) return '';
  return `<div class="banner info"><div class="small"><b>This lift has reset ${lpState(k,date).resets} times.</b> That is normally where a beginner program has given you what it has: adding weight every session has stopped working, and the answer is a program that does not try to. Operator is the obvious next one — three days a week, the same lifts, and a six-week wave instead of a straight line. Change it in Setup → Template whenever you are ready; everything you have logged stays where it is.</div></div>`;
}
