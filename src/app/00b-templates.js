/* ---------------- program templates ----------------
Two independent choices, which is how the books actually present it. TB II's sample weeks
are headed "Black + Zulu", "Black + Operator", "Black + Fighter": the strength template
says how many lifting days you take and what is on each, and the conditioning protocol
says what sits between them. A week is composed from the two.

The alternative was a hardcoded seven-day array per combination, which is what the code
did when Operator was the only option. It does not survive contact with a second template:
the combinations multiply, and hand-maintained grids drift apart from each other.

So a template is data, and `composeWeek` is the only function that knows how a week is
laid out. Adding Fighter is then a `days:` array, not another branch in dayPlanSlot. */

// A lifting day names its lift set rather than listing lifts, because Lift 3 is chosen
// per session and can only be resolved against a date.
const LIFTSET={
  SBP:date=>['squat','bench',l3For(date)],     // squat, bench, press (whichever Lift 3)
  SBD:()=>['squat','bench','dead'],
  A:date=>halfLifts('a',date),                 // Zulu's two halves of the cluster
  B:date=>halfLifts('b',date),
  SB:()=>['squat','bench'],
  // Mass works bench, squat and the weighted pull-up three times a week. The book wants
  // WPUs if you can do twelve bodyweight ones and names a pull as the substitute if not,
  // which is the choice Lift 3 already models — so it takes the WPU when you have one
  // and a pulldown or row when you do not. Never the overhead press: every substitute
  // the book names is a pull.
  MASS:()=>['bench','squat',l3On().includes('wpu')?'wpu':'pull'],
  D:()=>['dead'],
  GMA:()=>['bench','squat'],                   // Grey Man's two halves of the main cluster
  GLA:()=>['squat','ohp'],                     // Gladiator's, which the book pairs differently
  GLB:()=>['bench','dead'],
  GMB:()=>['ohp','dead'],
};
// A template's lifting days may depend on the week: Grey Man alternates A-B-A one week
// and B-A-B the next, so the same weekday is a different session a week later.
function tplDays(T,wk){
  const d=typeof T.days==='function'?T.days(wk||{w:1}):T.days;
  return Array.isArray(d)?d:[];
}
// And so may the days it uses. Mass drops its third session in week three, tapering
// into the peak week, so the week has four lifting days and then three.
function tplSlots(T,wk,sd){
  const v=typeof T.slots==='function'?T.slots(wk||{w:1}):T.slots;
  return Array.isArray(v)?v:(sd||[]).map((_,i)=>i*2);
}

/* Zulu runs half the cluster at a time, twice each per week. The book's suggested split
   is Bench/Squat against Deadlift/Overhead Press, which is the default here, but the
   halves are yours to set: TB's whole cluster idea is that you pick the lifts.

   'l3' is a token, not a lift — it means whichever Lift 3 the rotation gives that day. */
const HALF_KEYS=['squat','bench','dead','l3'];
const HALF_DEF={a:['squat','bench'],b:['dead','l3']};
function halvesOf(){
  const h=plan.halves||{};
  const pick=k=>{
    const v=h[k];
    return Array.isArray(v)?v.filter(x=>HALF_KEYS.includes(x)):null;
  };
  const a=pick('a'), b=pick('b');
  // A half with nothing in it is not a session, so fall back rather than draw a blank day.
  return {a:a&&a.length?a:HALF_DEF.a, b:b&&b.length?b:HALF_DEF.b};
}
function halfLifts(which,date){
  return halvesOf()[which].map(k=>k==='l3'?l3For(date):k);
}
function halfOfDay(dp){ return dp&&dp.half||null }
/* What the day's supplementary work is prescribed at, when the template says.

   Operator's accessories are deliberately unprogramd — a couple of sets short of
   failure, skipped on heavy weeks, and that is the whole instruction. Tactical Barbell
   III's supplementary clusters are not like that: Grey Man gives them their own sets,
   reps and percentage, lighter and longer than the main lifts, and runs them every week
   including the heavy one. A template that prescribes them therefore also overrides the
   skip rule, because skipping them is Operator's idea and not every program's. */
function accRxFor(wk){
  const T=STEMPL[wk&&wk.tpl]||stemplOf();
  if(typeof T.accRx!=='function'||!wk||wk.kind!=='cycle') return null;
  return T.accRx(wk)||null;
}
// Move one lift into a half, or out of both. Refuses to empty a half, because a half
// with nothing in it is not a session.
function setHalf(k,to){
  if(!HALF_KEYS.includes(k)) return false;
  if(to!=='a'&&to!=='b'&&to!=='') return false;
  const H=halvesOf(), next={a:H.a.filter(x=>x!==k),b:H.b.filter(x=>x!==k)};
  if(to) next[to]=[...next[to],k];
  if(!next.a.length||!next.b.length) return false;
  mutatePlan(p=>{p.halves=next});
  return true;
}

const STEMPL={
  operator:{
    name:'Operator', book:'TB1', slots:[0,2,4],   // the book's days 1, 3, 5
    blurb:'Three full-body days a week, the same cluster every session, never near failure. The default, and what Black is built around.',
    days:[
      {lifts:'SBP',acc:'mon',short:'Op 1',label:'Operator 1'},
      {lifts:'SBP',acc:'wed',short:'Op 2',label:'Operator 2'},
      {lifts:'SBD',acc:'fri',short:'Op 3',label:'Operator 3'},
    ],
    // TB1's Operator table, row for row.
    wave:[{s:3,r:5,p:70},{s:3,r:5,p:80},{s:3,r:3,p:90},{s:3,r:5,p:75},{s:3,r:5,p:85},{s:3,r:2,p:95}],
  },
  zulu:{
    name:'Zulu', book:'TB1', slots:[0,1,3,4], split:true,
    blurb:'Four shorter days a week. The cluster is split in two and each half runs twice, which leaves far more room for assistance work than Operator does.',
    days:[
      {lifts:'A',half:'a',acc:'z1',short:'Zulu A',label:'Zulu A'},
      {lifts:'B',half:'b',acc:'z2',short:'Zulu B',label:'Zulu B'},
      {lifts:'A',half:'a',acc:'z1',short:'Zulu A'},
      {lifts:'B',half:'b',acc:'z2',short:'Zulu B'},
    ],
    // TB1's Zulu table, one prescription per week across all four lifting days.
    wave:[{s:3,r:5,p:70},{s:3,r:5,p:80},{s:4,r:3,p:90},{s:3,r:5,p:75},{s:3,r:5,p:85},{s:4,r:3,p:90}],
  },
  gladiator:{
    name:'Gladiator', book:'TB3', slots:[0,1,3,4], split:true,
    blurb:'A specialist, not a staple \u2014 the book says use it sparingly. Four sessions a week over two pairs of lifts, high frequency and high volume, finishing on a peak set of each.',
    // The book names day 1 outright: "squat for 4 to 5 sets of 8 using 60%. Do the same
    // with the overhead press." Its week-3 table then peaks squat on day 1, bench on
    // day 2, overhead press on day 4 and deadlift on day 5, which pins the other three.
    days:[
      {lifts:'GLA',half:'a',acc:'gl1',short:'Glad A',label:'Gladiator A \u00b7 squat + overhead press'},
      {lifts:'GLB',half:'b',acc:'gl2',short:'Glad B',label:'Gladiator B \u00b7 bench + deadlift'},
      {lifts:'GLA',half:'a',acc:'gl1',short:'Glad A'},
      {lifts:'GLB',half:'b',acc:'gl2',short:'Glad B'},
    ],
    wave:[{s:4,sMax:5,r:8,p:60},{s:4,sMax:5,r:6,p:70},{s:4,r:3,p:80}],
    rx(wk,day,k){
      const w=((wk.w||1)-1)%3;
      const base=[{s:4,sMax:5,r:8,p:60},{s:4,sMax:5,r:6,p:70},{s:4,r:3,p:80}][w];
      // One lift peaks per session in week three, and each of the four gets a turn.
      if(w===2&&k==={1:'squat',2:'bench',3:'ohp',4:'dead'}[day]) return Object.assign({},base,{amrap:true});
      return base;
    },
  },
  mass:{
    name:'Mass', book:'TB3',
    blurb:'Tactical Barbell III\u2019s headline template, and Operator\u2019s forefather. Bench, squat and the weighted pull-up three times a week on alternate days; the deadlift gets a day of its own at the end. Hypertrophy first, strength alongside it.',
    // Days 1, 3 and 5 plus a deadlift day — except in week three, where the third
    // session comes out and the week tapers into the peak.
    slots:wk=>((wk&&wk.w||1)-1)%3===2?[0,2,5]:[0,2,4,5],
    days:wk=>{
      const main=i=>({lifts:'MASS',acc:'ms1',short:'Mass '+i,label:'Mass '+i});
      const dl={lifts:'D',acc:'ms2',short:'Mass DL',label:'Mass deadlift'};
      return ((wk&&wk.w||1)-1)%3===2?[main(1),main(2),dl]:[main(1),main(2),main(3),dl];
    },
    wave:[{s:4,r:8,p:65},{s:4,r:6,p:75},{s:4,r:3,p:80}],
    rx(wk,day,k){
      const w=((wk.w||1)-1)%3, last=tplDays(STEMPL.mass,wk).length;   // the deadlift day
      if(day===last) return [{s:4,r:5,p:65},{s:4,r:5,p:75},
        {s:1,r:3,p:80,note:'Then a heavier single, or as many reps as you have in you on the last set.'}][w];
      const base=[{s:4,r:8,p:65},{s:4,r:6,p:75},{s:4,r:3,p:80}][w];
      // Week three peaks one lift per session: squat on the first day, bench on the
      // second. Either work up above the prescribed weight, or take the last set out.
      if(w===2&&k===(day===1?'squat':'bench')) return Object.assign({},base,{amrap:true});
      return base;
    },
  },
  greyman:{
    name:'Grey Man', book:'TB3', slots:[0,2,4],
    blurb:'Two main lifts a day, then supplementary work of your own choosing. Alternates A-B-A one week and B-A-B the next, which leaves four days clear for conditioning and recovery.',
    // The book's GM exercise schedule: bench and squat against overhead press and
    // deadlift, swapping over each week so neither pair always lands on a Monday.
    days:wk=>{
      const A={lifts:'GMA',half:'a',acc:'gm1',short:'GM A',label:'Grey Man A'};
      const B={lifts:'GMB',half:'b',acc:'gm2',short:'GM B',label:'Grey Man B'};
      return ((wk&&wk.w||1)%2)?[A,B,A]:[B,A,B];
    },
    wave:[{s:4,sMax:5,r:8,p:70},{s:4,sMax:5,r:6,p:75},{s:4,sMax:5,r:3,p:80}],
    // The supplementary cluster runs its own numbers, lighter and longer than the main
    // lifts, and it is programd every week — including the heavy one.
    accRx:wk=>[{s:4,r:12,p:55},{s:4,r:10,p:60},{s:4,r:8,p:65}][(((wk&&wk.w||1)-1)%3)],
  },
  fighterht:{
    name:'Fighter HT', book:'TB3', slots:[0,3,5],  // the book's days 1, 4 and 6
    blurb:'Mass building for the minimalist. Squat and bench twice a week, deadlift on its own day, five sets of everything. Three-week blocks, and week three finishes with an all-out set.',
    days:[
      {lifts:'SB',acc:'h1',short:'HT 1',label:'Fighter HT 1'},
      {lifts:'SB',acc:'h1',short:'HT 2',label:'Fighter HT 2'},
      {lifts:'D',acc:'h2',short:'HT DL',label:'Fighter HT deadlift'},
    ],
    // Days 1 and 2. The deadlift day runs its own numbers — see rx below.
    wave:[{s:5,r:8,p:60},{s:5,r:6,p:70},{s:5,r:3,p:80}],
    // The book's table is per day, not per week: the deadlift day diverges from week 2,
    // and week 3 ends on an all-out set of whichever lift the day is named for.
    rx(wk,day,k){
      const w=((wk.w||1)-1)%3;                   // three-week block, then again
      if(day===3) return [{s:5,r:8,p:60},{s:5,r:5,p:70},
        {s:1,r:3,p:80,note:'Then a deadlift single above this, or ten sets of three at 80%.'}][w];
      const base=[{s:5,r:8,p:60},{s:5,r:6,p:70},{s:5,r:3,p:80}][w];
      // Week 3: the last set of the day's named lift goes as far as it will go.
      if(w===2&&k===(day===1?'squat':'bench')) return Object.assign({},base,{amrap:true});
      return base;
    },
  },
  fighter:{
    name:'Fighter', book:'TB1', slots:[0,3],       // the book's days 1 and 4
    blurb:'The two-day template. Same idea as Operator on half the lifting days, for when something else — skills, running, shift work — is taking the time.',
    days:[
      {lifts:'SBP',acc:'f1',short:'Ftr 1',label:'Fighter 1'},
      {lifts:'SBD',acc:'f2',short:'Ftr 2',label:'Fighter 2'},
    ],
    // TB1's Fighter table: a three-week block run twice, and 3-4 sets rather than 3.
    // `sMax` is the app's existing "up to" ceiling, which is exactly what 3-4 means.
    wave:[{s:3,sMax:4,r:5,p:75},{s:3,sMax:4,r:5,p:80},{s:3,sMax:4,r:3,p:90},
          {s:3,sMax:4,r:5,p:75},{s:3,sMax:4,r:5,p:80},{s:3,sMax:4,r:3,p:90}],
  },
};

const CPROTO={
  black:{
    name:'Black', book:'TB2', blurb:'The standard continuation protocol. Strength and high-intensity conditioning weighted equally, with endurance kept ticking over.',
    // Three hard sessions. The last alternates so both aerobic-power qualities stay in
    // rotation, which is what this week has always done.
    sessions:wk=>[
      {t:'hic',fmt:'map'},
      {t:'hic',fmt:'anaerobic'},
      {t:'hic',fmt:wk.w%2?'threshold':'long',note:'Swap to LISS if the week has been heavy.'},
    ],
  },
  green:{
    name:'Green', book:'TB2',
    blurb:'Endurance first. Easy aerobic work most days, a strength-endurance circuit each week, and one hard session every other week. Built for rucking, selection prep and long events. The book runs it alongside two lifting days, so it sits best with Fighter.',
    sessions:wk=>{
      const hicWeek=((wk&&wk.w||1)%2)===0;    // one hard session every other week
      const E=note=>({t:'hic',fmt:'liss',short:'E',note});
      const r=greenSeReps(wk);
      return [
        E('Conversational the whole way. Run, ruck, swim or ride \u2014 45 to 90 min.'),
        E('Easy again. Run-walk-run is still aerobic and still counts.'),
        hicWeek?{t:'hic',fmt:'map',short:'HIC'}
               :E('The long one. You have a rest day behind you, so push the duration.'),
        {t:'se',circuits:3,reps:r,short:'SE 3\u00d7'+r},
      ];
    },
  },
  greense:{
    name:'Green \u00b7 Progressive SE', book:'TB2', noStrength:true,
    blurb:'The no-barbell variation. Three strength-endurance circuits and two easy aerobic sessions a week, climbing over a three-week block. For when you have no equipment \u2014 the book says not to run it past nine weeks without going back to maximal strength.',
    sessions:wk=>{
      const [r,last]=GREEN_SE[(((wk&&wk.w||1)-1)%3)];
      const se=(c,n)=>({t:'se',circuits:c,reps:n,short:'SE '+c+'\u00d7'+n});
      return [
        se(3,r),
        {t:'hic',fmt:'liss',short:'E',note:'Conversational. Minimum 30 min.'},
        se(3,r),
        {t:'hic',fmt:'liss',short:'E',note:'Easy. Longer than the first if you have it in you.'},
        se(2,last),
        {t:'hic',fmt:'liss',short:'E',note:'Easy, or swap it for a HIC if you have the legs.'},
      ];
    },
  },
};

// Green's circuits climb over a three-week block and start again. Progressive SE's
// numbers are the book's table; Green standard runs one circuit a week on the same climb.
const GREEN_SE=[[30,35],[40,45],[50,50]];
function greenSeReps(wk){ return GREEN_SE[(((wk&&wk.w||1)-1)%3)][0] }

/* ---------------- pairings the books have an opinion about ----------------
Not every template goes with every protocol, and where the books say so they say it
plainly. These are their words turned into checks, each one traceable to a page:

  TB II, Black variations:  "I don't recommend using TB Mass template here. Mass is a
                             specialist template that requires a reduction in
                             conditioning... no more than 2 HIC sessions per week. No E
                             at all." And: "Gladiator template can be used, but I
                             recommend using a training max/conservative 1rm numbers."
  TB III, Conditioning:     "Green is used alongside General Mass (Mass Template,
                             Gladiator, Fighter HT)... Black is used during Specificity."
  TB II, Green guidelines:  two strength sessions a week.

A warning is not a block. The books are advice, people have reasons, and the app's job
is to say what the book says and then get out of the way. */
const MASS_TEMPLATES=['mass','gladiator','fighterht','greyman'];
function programWarnings(t,c,bb){
  const T=STEMPL[t], P=CPROTO[c], out=[];
  if(!T||!P) return out;
  const days=tplDays(T,{w:1}).length;
  if(P.noStrength) out.push({k:'nostrength',text:`${P.name} does no barbell work at all \u2014 the book is explicit \u2014 so ${T.name} is set aside for as long as you run it. It comes back the moment you switch off.`});
  if(t==='mass'&&c==='black') out.push({k:'mass-black',text:'Tactical Barbell II advises against Mass with Black: Mass is a specialist template that needs conditioning cut back, no more than two hard sessions a week and no endurance work at all. Green is what Mass Protocol pairs it with.'});
  else if(t==='gladiator'&&c==='black') out.push({k:'glad-black',text:'Gladiator with Black is allowed, but the book asks for a training max or conservative 1RMs when you do it. You can set that under Percent of in Setup.'});
  else if(MASS_TEMPLATES.includes(t)&&c==='black') out.push({k:'mass-black-soft',text:`Mass Protocol pairs its mass templates with Green, not Black \u2014 Green is lower intensity and longer, and is there to aid recovery rather than compete with it. ${T.name} with Black will be a lot of hard work in one week.`});
  if(c==='green'&&days>2) out.push({k:'green-days',text:`Green asks for two strength sessions a week and ${T.name} runs ${days}. The week will still lay out, but endurance is meant to be the priority on Green and four lifting days is not that.`});
  if(bb) out.push({k:'bb',text:'Base Building runs first and replaces the program for eight weeks: strength-endurance circuits, easy aerobic work and two spartan strength days. Your template and protocol start when it finishes.'});
  return out;
}

// The seven roles a week would have under a given pairing, before anyone reorders it.
// Used to answer "what else is on the day you want to put plyos on".
function weekRolesFor(t,c,wk){
  const T=STEMPL[t]||STEMPL.operator, P=CPROTO[c]||CPROTO.black, w=wk||{w:1};
  const cs=(typeof P.sessions==='function'?P.sessions(w):P.sessions)||[];
  return weekShape(P.noStrength?[]:tplSlots(T,w,tplDays(T,w)),cs);
}
/* What is already on the day you are about to put plyos on.

   The app's own position, stated on every plyo card: they go first because they are a
   nervous-system stimulus and want you fresh, with ten minutes before hard conditioning.
   That makes a lifting day a real trade rather than a preference. The rest-day one is
   arithmetic, and the impact one the app already says on the day itself.

   Deliberately not warned about: landing on the day after a lifting day. In a week that
   alternates, every conditioning day does, so it would fire on the default Thursday and
   on most of the alternatives — a warning that is always true tells you nothing. The
   pull-back rule it would have come from is on the plyo card, where it belongs. */
function plyoWarnings(t,c,d,cardio,d2){
  // A day outside the week simply has no role, so nothing below matches it.
  const out=[], roles=weekRolesFor(t,c), here=roles[d];
  if(here==='S'||here==='SC') out.push({k:'lift',text:`${DAYN[d]} already lifts. Plyos go first because they want you fresh, so the barbell work is what takes the hit \u2014 which is backwards if strength is the point of the block.`});
  if(here==='R'&&roles.filter(v=>v==='R').length===1) out.push({k:'rest',text:`${DAYN[d]} is the only day this week has nothing on it. Plyos are short, but it stops being a rest day.`});
  // Two sessions a week is the common recommendation and is often called the optimal
  // number for a moderately trained athlete, but the same sources ask for 48 to 72 hours
  // between them. Two days apart on the loop is the least that buys.
  const second=d2!=null?+d2:(plyoPerWeek()===2?plyoDow2():null);
  if(second!=null&&second>=0&&second<=6){
    const g=plyoGap(d,second);
    if(g===0) out.push({k:'same',text:'Both sessions are on the same day, which makes it one session. Pick a different day for the second.'});
    else if(g<2) out.push({k:'gap',text:`${DAYN[d]} and ${DAYN[second]} are back to back. Plyometric work is usually given 48 to 72 hours to recover from, so three or four days apart suits it better \u2014 the app's own suggestion is ${DAYN[(d+3)%7]}.`});
  }
  if((here==='C'||here==='SC')&&['run','hill','ruck'].includes(cardio)) out.push({k:'impact',text:`Your conditioning is ${(MOD[cardio]||{}).name||cardio}, which is landing work of its own. On a day that also has plyos, keep the volume at the low end or ride instead.`});
  return out;
}

function stemplOf(){ return STEMPL[plan.stempl]||STEMPL.operator }
function stemplKey(){ return STEMPL[plan.stempl]?plan.stempl:'operator' }
function cprotoOf(){ return CPROTO[plan.cproto]||CPROTO.black }
function cprotoKey(){ return CPROTO[plan.cproto]?plan.cproto:'black' }
// The wave belongs to the template: Fighter's is a three-week block run twice, not
// Operator's six. Yours, once you have edited it, lives under plan.waves by template,
// so switching templates does not carry one program's numbers into another.
function waveOf(tpl){
  const k=tpl&&STEMPL[tpl]?tpl:stemplKey();
  const w=(plan.waves||{})[k];
  return Array.isArray(w)&&w.length?w:STEMPL[k].wave;
}
// How long a cycle runs. Derived, so a template with a three- or nine-week wave works.
function cycleWeeks(){ return Math.max(1,waveOf().length) }

// Only hard sessions have to be kept apart. An easy aerobic day can sit next to
// anything, which is why Green's own template runs E on days 5 and 6.
/* Is this a hard conditioning session, for the purpose of not stacking two together?
   LISS never is. A FOBBIT is one only while it stays under half an hour: "any Fobbit
   over 30 minutes is an E - anything under is HIC" (TB, FOBBITs Part II). Laying out a
   week we only know the default FOBBIT, so that is what the schedule reasons about; a
   session logged longer is reclassified where logged sessions are counted. */
function sessHard(x){
  if(!x||x.fmt==='liss') return false;
  if(x.fmt==='fobbit') return !fobIsE(fobDefMins(defFob()));
  return true;
}

/* Lay out a week: the lifting days where the template's table puts them, then the
   conditioning sessions spread through what is left.

   The books number the lifting days — Operator trains on days 1, 3 and 5, Fighter on 1
   and 4, Zulu on 1, 2, 4 and 5 — so that is data on the template rather than something
   to infer. Two hard days of the same kind must not touch (see ADJACENT_BAN), so a hard
   session skips a slot that would put it next to another hard one; easy days go anywhere.

   When the sessions will not fit in the days left over, the overflow goes *on* a lifting
   day rather than taking the rest day. That is what TB II's own "Black + Zulu" week does:
   four lifting days, and the first one carries a HIC after the barbell work. A week keeps
   one rest day as long as it has a slot to spare.

   `sessions` is the protocol's list for the week. Returns seven of 'S' (lift), 'C'
   (conditioning), 'SC' (both) and 'R' (rest), plus which session index sits where. */
function weekShape(slots,sessions){
  const cs=Array.isArray(sessions)?sessions:new Array(Math.max(0,sessions|0)).fill({});
  const nC=cs.length;
  const out=new Array(7).fill('R');
  const S=(Array.isArray(slots)?slots:[]).filter(v=>v>=0&&v<7);
  for(const i of S) out[i]='S';
  const free=[]; for(let i=0;i<7;i++) if(out[i]==='R') free.push(i);
  // Every protocol in the book asks for a rest day a week. Hold one back whenever that
  // is possible at all: either a slot is spare, or a lifting day can carry the overflow.
  const keepRest=(free.length>nC||S.length)?1:0;
  const room=Math.max(0,free.length-keepRest);
  const take=[];
  for(const i of free){
    if(take.length>=Math.min(nC,room)) break;
    const prev=take.length?take[take.length-1]:-9;
    // A hard session will not sit next to another hard one. Easy days are free to.
    if(i-prev===1&&sessHard(cs[take.length])&&sessHard(cs[take.length-1])) continue;
    take.push(i);
  }
  for(const i of take) out[i]='C';
  // What did not fit rides along with a lifting day, earliest first. Riding along is
  // preferred over two hard days back to back, which is the trade the book makes.
  let over=nC-take.length;
  for(const i of S){ if(over<=0) break; out[i]='SC'; over-- }
  // Nothing left to ride on: fill what is free, rest day included, rather than drop one.
  for(const i of free){ if(over<=0) break; if(out[i]==='R'){ out[i]='C'; over-- } }
  return out;
}

// One slot of a composed week. `wk` carries the week number, `date` resolves Lift 3.
function composeSlot(date,wk,d){
  // A week frozen in the past carries the template it was trained under, so changing
  // program now does not rewrite what you already did into something else.
  const T=STEMPL[wk.tpl]||stemplOf(), P=CPROTO[wk.cpr]||cprotoOf();
  const cs=(typeof P.sessions==='function'?P.sessions(wk):P.sessions)||[];
  // A protocol may say there is no barbell work at all: Green's Progressive SE variation
  // exists for having no equipment, and the book is explicit that you do none. Dropping
  // the slots is enough — with no 'S' roles the template's days are never reached.
  const sd=tplDays(T,wk);
  const shape=weekShape(P.noStrength?[]:tplSlots(T,wk,sd),cs);
  let si=0, ci=0;
  for(let i=0;i<7;i++){
    const role=shape[i];
    if(i===d){
      if(role==='S'||role==='SC'){
        const x=sd[si], o={t:'lift',day:si+1,lifts:(LIFTSET[x.lifts]||LIFTSET.SBD)(date),acc:x.acc,short:x.short};
        if(x.half) o.half=x.half;              // which half of the cluster, for adjacency
        if(role==='SC'){
          // The session rides along after the barbell work, the way the book's Black +
          // Zulu week does. Its own fields come with it so the right card is drawn: a
          // circuit is not a bike session and must not be rendered as one.
          const c=cs[ci]||{};
          o.ride=c.t==='se'?'se':'hic';
          o.short=x.short+' + '+(c.short||(c.fmt==='liss'?'E':'HIC'));
          if(o.ride==='se'){ o.circuits=c.circuits; o.reps=c.reps }
          else { o.cardio=true; o.fmt=c.fmt||'map' }
          if(c.note) o.condNote=c.note;
        }
        return o;
      }
      if(role==='C'){
        const x=cs[ci];
        return Object.assign({short:'HIC'},x,{t:x.t||'hic'});
      }
      return {t:'off',short:'Off'};
    }
    if(role==='S') si++; else if(role==='C') ci++; else if(role==='SC'){ si++; ci++ }
  }
  return {t:'off',short:'Off'};
}
