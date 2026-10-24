(function(){
"use strict";
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
  // Specificity Alpha's standard maximal-strength cluster, in the book's order. Its
  // rule for building your own is a press, a pull and legs.
  MS:()=>['bench','squat','dead'],
  // A hypertrophy day has no barbell prescription at all: the whole session is the
  // cluster you built, which the app already models as supplementary work.
  NONE:()=>[],
  // Back "Break": upper body only, then the one lower-body lift on the last day.
  BBU:date=>['bench',...l3On()].slice(0,2),
  BBS:date=>['bench',...l3On()].slice(0,2).concat(['squat']),
  BBD:date=>['bench',...l3On()].slice(0,2).concat(['dead']),
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
function accRxFor(wk,day){
  const T=STEMPL[wk&&wk.tpl]||stemplOf();
  if(typeof T.accRx!=='function'||!wk||wk.kind!=='cycle') return null;
  return T.accRx(wk,day)||null;
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

/* Old Warhorse's four blocks, straight off the book's table. Volume falls and the set
   range tightens as the weights get heavier; blocks 1 and 2 run Operator I/A's flexible
   sets, 3 and 4 run Standard Operator's fixed ones. */
/* Back "Break"'s three-week progression, run twice per block. The squat version allows
   one to three down sets, the deadlift version one to two -- the book cuts the volume
   "just a bit" for the pull. The down-set percentage is of the best set you just did,
   not of a 1RM, which is why these carry `top` instead of `p`. */
const BB_TOP={
  squat:[{s:1,r:6,top:true,down:3,downPct:80},{s:1,r:5,top:true,down:3,downPct:85},{s:1,r:3,top:true,down:3,downPct:90}],
  dead: [{s:1,r:5,top:true,down:2,downPct:80},{s:1,r:4,top:true,down:2,downPct:85},{s:1,r:3,top:true,down:2,downPct:90}],
};
const OW_BLOCKS=[
  {s:5,sMax:10,ia:true, test:'No test this block.',
   note:'Block 1 of 4 · high volume, 5 to 10 sets. Open at about 80% of the best you hit in your last continuation phase — deliberately light, so take the sets. Up to three HIC a week, pushing the reps and intensity. No test.'},
  {s:4,sMax:8, ia:true, test:'Testing is your choice this block.',
   note:'Block 2 of 4 · moderate volume, 4 to 8 sets. Add 2 to 5% to the last block’s training max, and you can be a bit aggressive here. Up to three HIC a week. Test or do not, as you like.'},
  {s:4,sMax:5, ia:false,test:'Test within the block.',
   note:'Block 3 of 4 · moderate volume, 4 to 5 sets, and Standard Operator rather than I/A now the weights are heavier. Another 2 to 5% on the training max. Up to two HIC a week. Test within the block — a heavy single above 95%, or a rep max, on the last day before a recovery week.'},
  {s:3,sMax:4, ia:false,test:'Finish on a 3-rep max at 100 to 107% of your training max.',
   note:'Block 4 of 4 · low volume, 3 to 4 sets and minimal reps. Add 2 to 5% or more depending on how block 3 tested. One easy HIC and up to two LSS sessions of 20 to 30 minutes — the lifting is the load now. Finish on a 3-rep max at 100 to 107% of your training max, and that number opens the next four blocks.'},
];
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
      // The book's table puts the deadlift day straight after day 5, so those two are
      // consecutive by design. Marking them as different halves is what stops the Move
      // tool warning about the template's own layout -- the deadlift day really is a
      // different session, the same way Zulu's A and B are.
      const main=i=>({lifts:'MASS',half:'a',acc:'ms1',short:'Mass '+i,label:'Mass '+i});
      const dl={lifts:'D',half:'b',acc:'ms2',short:'Mass DL',label:'Mass deadlift'};
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
  /* Tactical Barbell III's Specificity block: three weeks, four lifting days, run
     after a stretch of General Mass. Alpha is half maximal strength and half
     hypertrophy; Bravo drops the barbell work entirely. Both tables are the book's,
     read off the page rather than remembered.

     TB III is also titled Mass Protocol, and they are one book, not two — its contents
     run Mass Template, Grey Man, Gladiator, Fighter HT, Specificity Alpha, Specificity
     Bravo. These two shipped briefly labelled 'Mass Protocol' while their four siblings
     from the same book said 'TB3'. */
  specalpha:{
    name:'Specificity Alpha', book:'TB3', slots:[0,1,3,4],
    blurb:'A three-week hypertrophy block that keeps heavy work in the mix. Two maximal-strength days on bench, squat and deadlift, and two days of your own cluster at higher reps. The book wants it after a stretch of General Mass.',
    days:[
      {lifts:'MS',half:'a',short:'Spec MS',label:'Specificity Alpha \u00b7 maximal strength'},
      {lifts:'NONE',half:'b',acc:'sp1',short:'Spec H1',label:'Specificity Alpha \u00b7 hypertrophy 1'},
      {lifts:'MS',half:'a',short:'Spec MS'},
      {lifts:'NONE',half:'b',acc:'sp2',short:'Spec H2',label:'Specificity Alpha \u00b7 hypertrophy 2'},
    ],
    wave:[{s:3,r:6,p:75},{s:3,r:5,p:80},{s:3,r:3,p:85}],
    rx(wk,day,k){
      const w=((wk.w||1)-1)%3;
      // The deadlift has its own programming in this block: one work set per session.
      if(k==='dead') return [{s:1,r:5,p:75},{s:1,r:4,p:80},{s:1,r:3,p:85}][w];
      return [{s:3,r:6,p:75},{s:3,r:5,p:80},{s:3,r:3,p:85}][w];
    },
    // The H cluster, six to twelve exercises split across the two hypertrophy days.
    accRx:wk=>[{s:4,r:12,p:65},{s:4,r:10,p:70},{s:4,r:8,p:75}][(((wk&&wk.w||1)-1)%3)],
  },
  specbravo:{
    name:'Specificity Bravo', book:'TB3', slots:[0,1,3,4],
    blurb:'Three weeks of nothing but hypertrophy. Eight to sixteen exercises split in two, each half trained twice a week at 50 to 75%. Dropping maximal strength for a block is the point of it, not an oversight.',
    days:[
      {lifts:'NONE',half:'a',acc:'sp1',short:'Spec H1',label:'Specificity Bravo \u00b7 hypertrophy 1'},
      {lifts:'NONE',half:'b',acc:'sp2',short:'Spec H2',label:'Specificity Bravo \u00b7 hypertrophy 2'},
      {lifts:'NONE',half:'a',acc:'sp1',short:'Spec H1'},
      {lifts:'NONE',half:'b',acc:'sp2',short:'Spec H2'},
    ],
    wave:[{s:4,sMax:5,r:12,p:50},{s:4,sMax:5,r:10,p:60},{s:4,sMax:5,r:8,p:70}],
    // The book's table runs the back half of the week five percent heavier than the
    // front, so this one is per day rather than per week.
    accRx(wk,day){
      const w=((wk&&wk.w||1)-1)%3, late=(+day||1)>=3;
      return [{s:4,sMax:5,r:12,p:late?55:50},{s:4,sMax:5,r:10,p:late?65:60},{s:4,sMax:5,r:8,p:late?75:70}][w];
    },
  },
  /* Ageless Athlete's Old Warhorse, from the book's four-block table (p.143). For
     advanced lifters who find 90%+ expensive: open the block at a deliberately low
     training max and force progression from block to block instead of testing.

     The programmable part is the volume band and whether the block runs Operator I/A's
     set ranges or Standard Operator's fixed sets. The training-max step between blocks
     is "2-5% addition (you can be a bit aggressive here)" -- a judgment call rather
     than a formula, so the app prompts for it at the start of each block instead of
     inventing a number. Same for the test column: it says No, then your choice, then
     test within the block, then a 3-rep max at 100-107%. */
  warhorse:{
    name:'Old Warhorse', book:'Ageless Athlete', slots:[0,2,4],
    blurb:'Four blocks that start deliberately light and force the numbers up rather than testing for them. Operator’s three days a week, but the volume falls and the sets tighten block by block: high and flexible at the start, low and fixed by the end. For experienced lifters who find heavy singles expensive to recover from.',
    days:[
      {lifts:'SBP',acc:'mon',short:'OW 1',label:'Old Warhorse 1'},
      {lifts:'SBP',acc:'wed',short:'OW 2',label:'Old Warhorse 2'},
      {lifts:'SBD',acc:'fri',short:'OW 3',label:'Old Warhorse 3'},
    ],
    // Operator's wave, unchanged -- the book says to use Operator's percentages.
    wave:[{s:3,r:5,p:70},{s:3,r:5,p:80},{s:3,r:3,p:90},{s:3,r:5,p:75},{s:3,r:5,p:85},{s:3,r:2,p:95}],
    rx(wk,day,k){
      const base=STEMPL.operator.wave[((wk.w||1)-1)%6];
      const b=OW_BLOCKS[(((wk.cycle||1)-1)%4)];
      return Object.assign({},base,{s:b.s,sMax:b.sMax,note:b.note});
    },
  },
  /* Ageless Athlete's Back "Break" templates (ch. 12). For a block when the spine
     wants a rest: one lower-body barbell lift, once a week, on the last day. Upper body
     proceeds per Operator as usual. You work up to a best set for that day rather than
     off a percentage, then take optional down sets at a percentage of that set.

     "This is not the best way to progress your squat or deadlift, but it might be
     exactly the breather you need to stay in the game."

     Two waves of the three-week progression per block, to line up with Operator's six.
     The book gives the Operator layout for deadlift-only and the Zulu layout for both;
     for squat-only on Operator it gives the rule rather than a table -- upper body as
     usual, squat on the last day of the week -- which is what this follows. */
  backsquat:{
    name:'Back Break · squat only', book:'Ageless Athlete', slots:[0,2,4],
    blurb:'A block that gives your back a rest without giving up lower-body work. Bench and the pull-up run as usual; you squat once a week, on the last day, working up to your best set for that day. Deadlift-style accessories carry the posterior chain on the other two days.',
    days:[
      {lifts:'BBU',half:'a',acc:'bb1',short:'BB 1',label:'Back Break 1 · upper'},
      {lifts:'BBU',half:'a',acc:'bb1',short:'BB 2',label:'Back Break 2 · upper'},
      {lifts:'BBS',half:'b',acc:'bb2',short:'BB SQ',label:'Back Break 3 · upper + squat'},
    ],
    wave:[{s:3,r:5,p:70},{s:3,r:5,p:80},{s:3,r:3,p:90},{s:3,r:5,p:75},{s:3,r:5,p:85},{s:3,r:2,p:95}],
    rx(wk,day,k){
      if(k!=='squat') return null;                       // upper body runs Operator's wave
      return BB_TOP.squat[(((wk.w||1)-1)%3)];
    },
  },
  backdead:{
    name:'Back Break · deadlift only', book:'Ageless Athlete', slots:[0,2,4],
    blurb:'The same idea for the pull. Bench and the pull-up as usual, one deadlift day a week worked up to your best set, and goblet squats, double-kettlebell front squats or pistols on the other two days to keep the legs honest.',
    days:[
      {lifts:'BBU',half:'a',acc:'bb3',short:'BB 1',label:'Back Break 1 · upper'},
      {lifts:'BBU',half:'a',acc:'bb3',short:'BB 2',label:'Back Break 2 · upper'},
      {lifts:'BBD',half:'b',acc:'bb4',short:'BB DL',label:'Back Break 3 · upper + deadlift'},
    ],
    wave:[{s:3,r:5,p:70},{s:3,r:5,p:80},{s:3,r:3,p:90},{s:3,r:5,p:75},{s:3,r:5,p:85},{s:3,r:2,p:95}],
    rx(wk,day,k){
      if(k!=='dead') return null;
      return BB_TOP.dead[(((wk.w||1)-1)%3)];
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
  /* Tactical Barbell III's own conditioning. The book is blunt about it: "Use the
     sessions provided in this book - NOT the Green/Black training found in Tactical
     Barbell II." Green runs alongside General Mass, Black alongside Specificity, and
     both are deliberately minimal -- enough to stay operational without opposing the
     thing you came for. */
  massgreen:{
    name:'Green · TB III', book:'TB3',
    blurb:'Three easy sessions a week while you build mass. Long, low intensity, and no intervals — the book picks these specifically because they do not work against hypertrophy. Pairs with the General Mass templates: Mass, Gladiator and Fighter HT.',
    // "Perform 1 to 3 conditioning sessions per week. No more than 3." Three is the cap
    // and the app schedules the cap; skip one and nothing complains.
    sessions:()=>[
      {t:'hic',fmt:'liss',short:'Ruck',mod:'ruck',note:'Ruck 30 to 60 minutes continuously, 10 to 50 lb — 30 is the sweet spot for most. A weight vest does the same job. Carrying a load tells the body to keep its structure, which is the opposite of what long running tells it.'},
      {t:'hic',fmt:'liss',short:'Easy run',note:'A recovery run, 20 to 30 minutes. Talk test, or breathe through your nose. Do not go past 30 minutes while mass is the objective, and cap it at 20 if you gain weight slowly. Cycling, swimming and rowing all count.'},
      {t:'hic',fmt:'predator',short:'Predator',note:'Endurance Predator. Walk, and every five to ten minutes break into an all-out sprint of 50 to 100 m. Vary the gaps. Hills and trails suit it. A 5 to 10 lb vest is optional.'},
    ],
  },
  massblack:{
    name:'Black · TB III', book:'TB3',
    blurb:'Two short, maximal sessions a week during a Specificity block. Sprints rather than intervals: the book picks them because brief all-out efforts drive an anabolic response instead of working against one. The book says to keep them off lifting days.',
    // "Perform 1 to 2 conditioning sessions per week. No more than 2." The third named
    // session is the FOBBIT, which already exists; these two rotate and you can swap
    // either one on the day.
    sessions:wk=>[
      {t:'hic',fmt:'sprints',short:'Sprints',note:'Anabolic Sprints. 30 m flat out, walk back, go again, 5 to 10 rounds. Warm up first with 5 to 10 minutes easy and a couple of sprints at half effort — hamstrings do not like being surprised. Intensity is the whole session.'},
      {t:'hic',fmt:(wk&&wk.w||1)%2?'reset20':'hillsprint',
        short:(wk&&wk.w||1)%2?'RESET-20':'Hills',
        note:(wk&&wk.w||1)%2?'RESET-20. Twenty seconds at absolute maximum, then two to five minutes of rest, three to five rounds. Be properly rested before each one. Stop at 15 to 20 minutes. An Airdyne, a rower or a heavy bag all work.'
          :'Hill Sprints. Find a steep hill and run up it flat out for 10 to 20 seconds, walk down, rest a minute or two, repeat. No more than ten sprints or 15 minutes, whichever comes first. A flat sprint of 15 to 20 seconds does the same job.'},
    ],
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
  const r=IV[x.fmt];
  if(r&&r.lead) return !fobIsE(specDefMins(r.fob?FOBBIT[defFob()]:r));
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

/* ---------------- constants ---------------- */
// Every lift the app knows. Lift 3 is one of L3K per session (see l3For).
const LK=['squat','bench','pull','ohp','wpu','dead'];
const L3K=['pull','ohp','wpu'];
const DAYN=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PCT5={1:1,2:.95,3:.93,4:.9,5:.87,6:.85,7:.83,8:.8,9:.77,10:.75};
const HIC={
  map:{name:'MAP',sess:'8–10 × 1 min hard / 1 min easy',sys:'Max aerobic power'},
  anaerobic:{name:'Anaerobic',sess:'6–8 × 30 sec near-max / 2 min easy',sys:'Glycolytic'},
  threshold:{name:'Threshold',sess:'4 × 4 min hard / 3 min easy',sys:'Threshold / VO2'},
  long:{name:'Long HIC',sess:'5 × 3 min hard / 90 sec easy',sys:'Aerobic power'},
  liss:{name:'LISS',sess:'30–45 min conversational',sys:'Aerobic base'},
  fobbit:{name:'FOBBIT',sess:'An easy base, broken by bouts of work',sys:'Aerobic base with bursts',noMetric:true},
  /* Tactical Barbell III's own named sessions. The book is explicit that these replace
     TB II's Green and Black work while mass is the objective: "Use the sessions
     provided in this book - NOT the Green/Black training found in Tactical Barbell II."
     Green is long and easy, Black is short and hard. Walk, Ruck and Recovery Run are
     already expressible as LISS on the right activity, so only these four are new. */
  predator:{name:'Endurance Predator',sess:'A long walk, broken by all-out sprints',sys:'Aerobic base with sprints',noMetric:true},
  sprints:{name:'Anabolic Sprints',sess:'30 m flat out \u00d7 5\u201310, walk back between',sys:'Alactic power'},
  reset20:{name:'RESET-20',sess:'20 sec flat out / 2\u20135 min rest \u00d7 3\u20135',sys:'Alactic / anaerobic'},
  hillsprint:{name:'Hill Sprints',sess:'10\u201320 sec up a steep hill \u00d7 3\u201310',sys:'Alactic power'}
};
// Activities for HIC/LISS days. Each logs the measure that makes sense for it:
// [field, unit] for HIC and for LISS. Results only compare within one activity + format.
// Units follow the Setup choice: metricFor turns 'mi' into 'km' and 'yd' into 'm' on
// metric. A distance you measure yourself is written here in its imperial form so the
// conversion reaches it.
//
// `fixedUnit` opts out, for the cases where the unit is not a preference: the rower and
// ski erg read meters on their own displays whatever you prefer, and a pool is measured
// in meters. Relabelling either would be telling you something untrue about the number
// in front of you.
const MOD={
  echo:{name:'Echo bike',hic:['cal','cal'],liss:['cal','cal'],wu:'5 min easy spin, then 3 × 15 s at HIC pace with 45 s easy between.'},
  rower:{name:'Rower',hic:['cal','cal'],liss:['dist','m'],fixedUnit:true,wu:'5 min easy row, then 3 × 15 s at HIC pace with 45 s easy between.'},
  ski:{name:'Ski erg',hic:['cal','cal'],liss:['dist','m'],fixedUnit:true,wu:'5 min easy, then 3 × 15 s at HIC pace with 45 s easy between.'},
  stair:{name:'Stair machine',hic:['floors','floors'],liss:['floors','floors'],
    wu:'5 min at an easy pace, then 3 \u00d7 15 s at HIC pace with 45 s easy between.',
    tip:'Hands off the rails. Leaning takes a large share of the work off your legs and makes the number meaningless next to a session where you did not \u2014 if you need them to hold the pace, the pace is too high. A floor is not the same distance on every machine either, so results only mean something against the same one.'},
  run:{name:'Run / sprints',hic:['dist','yd'],liss:['dist','mi'],wu:'5 min jog, leg swings, then 3–4 strides building up to HIC pace.',tip:'Running adds impact. Keep hard efforts smooth (about 90%) on MAP, threshold and long intervals, and save true sprints for anaerobic days. Hills are easier on the legs than flat sprints.'},
  cycle:{name:'Cycling',hic:['watts','avg W'],liss:['dist','mi'],wu:'10 min easy spin, then 3 × 15 s at HIC pace.'},
  trail:{name:'Trail run',hic:['dist','yd'],liss:['dist','mi'],elev:true,wu:'10 min easy jog on flat ground, then 3 × 20 s hard uphill with an easy jog back down.',tip:'Uneven ground makes pace meaningless, so run the hard efforts by breathing rather than by watch. Downhills are where the damage is: that is eccentric load, and it turns up as sore quads two days later, so take them easy before a squat day.'},
  ruck:{name:'Ruck',hic:['dist','mi'],liss:['dist','mi'],load:true,elev:true,tip:'Build ruck load gradually, starting around 10–15% of bodyweight. Rucking loads the back and hips, so keep it easy before heavy squat or deadlift days.'},
  hike:{name:'Hike',hic:['dist','mi'],liss:['dist','mi'],elev:true,wu:'10 min easy walking, then 3 × 20 s hard uphill with a walk back down.',tip:'Hills do the work: on HIC days use a steep section for the hard efforts and walk down easy. On LISS days keep it conversational the whole way.'},
  hill:{name:'Hill sprints',hic:['dist','yd'],liss:null,elev:true,
    wu:'10 min easy jog on the flat, leg swings, then 2\u20133 build-ups on the hill at about half effort, walking back down each time.',
    tip:'The safest way to sprint: the incline shortens the stride and caps the top speed, so most of the hamstring risk of flat sprinting goes with it. The cost is calves and Achilles, and these are a true anaerobic effort \u2014 keep them to anaerobic days, walk down slowly as the rest, and stop when your times start slipping rather than grinding out the last few. Log the total distance run, or let the elevation stand in for it.'},
  swim:{name:'Swim',hic:['dist','m'],liss:['dist','m'],fixedUnit:true,wu:'200 easy, then 4 × 25 building to HIC pace.'},
  other:{name:'Other',hic:null,liss:null}
};

/* FOBBITs. Named for the soldier who never leaves the forward operating base: a session
   with no ground to cover and barely any kit.

   A FOBBIT is not one session, it is a shape: hold an easy aerobic base, step off it
   every so often for a bout of work, get back on. Tactical Barbell II gives one of them
   (HIC #9, kettlebell swings and snatches), Mass Protocol gives a shorter one and says
   plainly that you are not restricted to kettlebells, and the author published three
   more as Mods on tacticalbarbell.com. They disagree on every axis, so every axis here
   is data rather than a constant:

     every   seconds of base between bouts. A number, or [lo,hi] when the source gives a
             range — the timer takes the low end and the prose says the range.
     count   what the minutes measure. 'base' counts only the base, which is how TB2
             reads ("until your treadmill reads 20 minutes"); 'total' counts the whole
             session, which is how the three Mods read.
     mv      the rotation, in order, one or more movements. TB2 alternates two, Mod #1 is
             a single lift, Mod #2 and #3 cycle three.
     mins    the duration choices, and `def` the one to start on.
     bpm     the pace band the source gives, where it gives one.

   A dose is a plain string when it is reps ('20', '10 / arm', '30 m' — a label rather
   than a number, because some are per side and one is a carry). It is an object when it
   is anything else: {s} for a timed bout in seconds, {r,pct,lift} for a set at a
   percentage of a 1RM.

   The governing rule, from Part II and stated in those words: any FOBBIT over 30 minutes
   is an E session, anything under is a HIC. That is `fobIsE`, and it is why duration is
   not just cosmetic here. */
const FOB_SRC={tb2:'Tactical Barbell II',mass:'Mass Protocol',mod1:'TB article, Mod #1',mod2:'TB article, Mod #2',mod3:'TB article, Mod #3',ours:'Ours'};
const FOB_EVERY=120, FOB_HELD=30;   // default base interval; and what a held set is assumed to cost when sizing by total time
const FOBBIT={
  kb:{name:'Kettlebell',gear:'One kettlebell',src:'tb2',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Kettlebell swing','20'],['Kettlebell snatch','10 / arm']],
    note:'The original, straight out of Tactical Barbell II. Set the base a notch below a comfortable jog — if your jog is level 5, run it at 4. One or two handed swings both count, and the swing and the snatch can use different bells.'},
  massfob:{name:'Mass Protocol',gear:'One kettlebell',src:'mass',every:120,count:'base',mins:[15,20],def:20,bpm:[120,150],
    mv:[['Kettlebell swing','10']],
    note:'The Mass Protocol version: the same shape, half the swings, and fifteen to twenty minutes with no longer allowed. It is general conditioning while you are growing, so the variety matters more than the numbers.'},
  maxstrength:{name:'Maximal strength',gear:'A press you can leave loaded',src:'mod1',every:[180,300],count:'total',mins:[30,45,60],def:45,bpm:[130,150],
    mv:[['Overhead press',{r:'3',pct:[70,75],lift:'ohp'}]],
    note:'Mod #1, from a reader the author published. Thirty minutes is the floor and sixty is fine once you are used to it; it defaults to forty-five because the article puts it in the week as the day-six E session, and thirty exactly would still count as a HIC. It buys press volume while you build an aerobic base, and it is deliberately easy: you should never be unreasonably fatigued when you get to the bar. Out of breath at the station means the base is too fast; tired at the press means lengthen the base, drop the load, or both. Walking back between sets is fine. Swap the press for bench if that is the volume you want, and change it week to week.'},
  se:{name:'Strength-endurance',gear:'A pull-up bar and a floor',src:'mod2',every:120,count:'total',mins:[20,30,45,60],def:30,bpm:[130,150],
    mv:[['Push-up','10'],['Pull-up','10'],['Sit-up','10']],
    note:'Mod #2. Three movements on rotation — the ones you are tested on, if you are tested. Scale the pull-ups to what you have: one to five is fine if ten is not. Keep strength-endurance to a tenth or a fifth of the training week; weeks of it at the expense of maximal strength goes backwards, because maximal strength is what feeds it.'},
  seamrap:{name:'Strength-endurance, AMRAP',gear:'A pull-up bar and a floor',src:'mod2',every:120,count:'total',mins:[20,30,45,60],def:30,bpm:[130,150],
    mv:[['Push-up',{s:60}],['Pull-up',{s:60}],['Sit-up',{s:60}]],
    note:'Mod #2 run on the clock instead of on a count: sixty seconds of as many as you can manage, rather than a fixed ten. The bouts are timed, so unlike the rep versions they do count toward the session.'},
  combat:{name:'Combat',gear:'A bag, or room to shadow box',src:'mod3',every:[60,90],count:'total',mins:[20,30,45,60],def:30,bpm:[130,150],
    mv:[['Heavy bag',{s:[120,180]}],['Straight punches',{s:[120,180]}],['Shadow boxing',{s:[120,180]}]],
    note:'Mod #3, and the one that runs the other way round: the drill is longer than the base. If you fight, set the work and rest to your event instead. Starting out, flip it — two minutes easy, sixty to ninety seconds of work. Gloves rule out the rower for the base. It is a more specific conditioning option, not a replacement for Base Building.'},
  sledge:{name:'Sledgehammer',gear:'A sledgehammer and a tire',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Sledgehammer strike','10 / side'],['Push-up','15']],
    note:'Mass Protocol names sledgehammer and tire drills as a work interval but gives no count, so the numbers here are ours. Alternate the top hand every set or one side does all the work.'},
  pushpress:{name:'Barbell push press',gear:'A loaded barbell',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Push press','10']],
    note:'Mass Protocol names the push press as a work interval but gives no load or count, so those are ours. Keep it light enough that the base is still the hard part.'},
  sandbag:{name:'Sandbag',gear:'One sandbag',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Shoulder it, alternating sides','10'],['Bear-hug squat','15']],
    note:'Drop it to the floor between reps rather than lowering it under control — the point is to keep moving, and eccentric lowering a bag this often is what makes people sore for days.'},
  sandbagheavy:{name:'Sandbag, heavy',gear:'A bag you would not want to carry far',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Ground to shoulder','6 / side'],['Front carry','30 m']],
    note:'The heavy version. The carry is the rest, so do not put the bag down during it — if you have to, the bag is too heavy for this session rather than you being unfit.'},
  sandbagbar:{name:'Sandbag over bar',gear:'A sandbag and a bar you can fix at a height',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Sandbag over the bar','5'],['Push-up','15']],
    note:'Explosive hip extension, so it is the first thing to go when you are tired — if the back is rounding to get the bag up, the set is over. Reset the bag on the floor each rep rather than catching it on the way back, and keep the bar at the same height every session or the count means nothing against the last one.'},
  sandbagtoss:{name:'Sandbag over the shoulder',gear:'One sandbag and room behind you',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Over-the-shoulder toss','10']],
    note:'Ground to shoulder, then keep it going and throw the bag over that shoulder behind you. Turn around, pick it up off the floor, do the other side. One movement is enough here because each rep is the whole chain, hip to shoulder to release. Alternate shoulders or one side does all the work. Check what is behind you before the first rep and do not try to guide the bag down — let it land. Like the over-the-bar version it is explosive hip extension, so it is the first thing to fall apart when you are tired: if the bag is going up by rounding your back, the bout is over.'},
  bodyweight:{name:'Bodyweight',gear:'Nothing at all',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Burpee','10'],['Push-up','15']],
    note:'The one you can do in a hotel room. Nothing here is loaded, so take the base a little faster to keep it honest.'},
  db:{name:'Dumbbells',gear:'Two dumbbells',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,
    mv:[['Thruster','10'],['Renegade row','10 / side']]},
  other:{name:'Something else',gear:'',src:'ours',every:120,count:'base',mins:[15,20,30],def:20,mv:null},
};
function defFob(){ return FOBBIT[plan.fobbit]?plan.fobbit:'kb' }
function fobOf(date){ const v=(logs[date]||{}).hic; return v&&FOBBIT[v.fob]?v.fob:defFob() }
function fobDef(id){ const F=FOBBIT[id]; return F&&F.mv&&F.mv.length?F:null }
/* The accessors below take a spec -- an object carrying every/count/mv/mins/def -- so
   that anything shaped like "hold a base, step off it for a bout" can use them. A
   FOBBIT catalog entry is one such spec; so is Endurance Predator, which lives on its
   interval-timer entry instead. The fob* wrappers are the FOBBIT-by-id versions. */
function specEvery(F){ return lo(F&&F.every)||FOB_EVERY }
function specCount(F){ return (F||{}).count==='total'?'total':'base' }
function specMinOpts(F){ return (F&&F.mins)||[15,20,30] }
function specDefMins(F){ return (F&&F.def)||20 }
function specEveryLabel(F){ return rangeLabel((F&&F.every)||FOB_EVERY,secsLabel) }
function specBouts(F,ease,what){
  if(!F||!F.mv||!F.mv.length){
    const w=String(what||'').trim().split('/').map(x=>x.trim()).filter(Boolean);
    return (w.length?w:['Burst']).map(n0=>Object.assign({name:n0},fobDose('Set',false)));
  }
  return F.mv.map(([n0,d])=>Object.assign({name:n0},fobDose(d,ease)));
}
function specRounds(F,mins){
  const ev=specEvery(F);
  if(specCount(F)==='base') return Math.max(1,Math.round(mins*60/ev));
  const bs=specBouts(F,false,'').map(b=>b.secs||FOB_HELD);
  return Math.max(1,Math.round(mins*60/(ev+bs.reduce((a,b)=>a+b,0)/bs.length)));
}
// Ranges read as [lo,hi]; the timer needs one number and takes the low end, which is the
// one that gives the session its full count of bouts.
function lo(v){ return Array.isArray(v)?v[0]:v }
function fobEvery(id){ return specEvery(FOBBIT[id]) }
function fobCount(id){ return specCount(FOBBIT[id]) }
function fobMinOpts(id){ return specMinOpts(FOBBIT[id]) }
function fobDefMins(id){ return specDefMins(FOBBIT[id]) }
/* The rule from Part II, in those words: over 30 minutes it is an E, under it is a HIC.
   So a 60-minute Mod #1 is not a hard session and must not be counted as one. */
function fobIsE(mins){ return +mins>30 }
// A dose, normalised for the timer. Reps are held — you tap Done, and they are not on
// the clock. Anything with seconds is timed and does count.
function fobDose(d,ease){
  if(d&&typeof d==='object'){
    if(d.s!=null) return {secs:lo(d.s),hold:false,reps:null,pct:null};
    // A set at a percentage of a 1RM is already three reps and deliberately easy. Halving
    // it makes it pointless rather than lighter, so the easy week shortens the session
    // instead, which it does anyway by dropping to the shortest length on offer.
    return {secs:null,hold:true,reps:d.r,pct:d.pct||null,lift:d.lift||null};
  }
  return {secs:null,hold:true,reps:ease?halveReps(d):d,pct:null,lift:null};
}
/* Halving for a low-readiness day or an easy conditioning week. It halves the leading
   count and leaves the rest, so "10 / arm" becomes "5 / arm" and "30 m" becomes "15 m",
   and a load written into the unit is not touched. Odd counts round up, because five and
   a half swings is not a thing. Timed bouts are left alone: an AMRAP is already
   self-limiting, and the easy week shortens the session instead. */
function halveReps(q){
  return String(q).replace(/^\s*(\d+)/,(m,d)=>String(Math.max(1,Math.ceil(+d/2))));
}
/* The rotation as the timer wants it: one entry per movement, cycled in order.

   `other` prescribes nothing, so it falls back to whatever was typed on the day and then
   to a neutral label — the structure still runs, it just does not tell you what to do. */
function fobBouts(id,ease,what){ return specBouts(fobDef(id),ease,what) }
// How many bouts fit. A base-counted FOBBIT divides the base by the interval; a
// total-counted one has to pay for the bouts too, and a held set is assumed to cost
// FOB_HELD seconds since nobody can know what it really takes.
function fobRounds(id,mins){ return specRounds(fobDef(id)||FOBBIT[id],mins) }
// Choosing one for a single session. Only a real difference from the default is worth
// storing as a swap, the same rule the activity picker follows.
function setFob(date,v){
  if(!FOBBIT[v]) return false;
  setLog(date,'hic.fob',v===defFob()?null:v);
  return true;
}
function secsLabel(s){ return (s>=120&&s%60===0)?(s/60)+' min':s+' s' }
function rangeLabel(v,f){ return Array.isArray(v)?f(v[0])+' to '+f(v[1]):f(v) }
// "every two minutes", "every 3 min to 5 min", "every 60 s to 90 s".
function fobEveryLabel(id){ return specEveryLabel(FOBBIT[id]) }
function doseLabel(b){
  if(b.secs!=null) return secsLabel(b.secs)+(b.secs<=60?' AMRAP':'');
  if(b.pct) return b.reps+' at '+rangeLabel(b.pct,p=>p+'%');
  return b.reps;
}
// The rotation as one line, for the day card, the Guide table and the week's record.
function boutsLine(bs){
  return (bs||[]).map((b,i)=>`${i?b.name.charAt(0).toLowerCase()+b.name.slice(1):b.name} × ${doseLabel(b)}`).join(', then ');
}
function fobLine(id,ease){ const F=fobDef(id); return F?boutsLine(fobBouts(id,ease,'')):'' }
function fobSrcLabel(id){ return FOB_SRC[(FOBBIT[id]||{}).src]||FOB_SRC.ours }
// Plyometric program and exercise library, from Plyometric_Program_Thursday.pdf.
// Contacts count ground impacts (one landing = one contact), as the program does.
/* Macro targets.

   For building, Tactical Barbell III gives a formula outright (p.108): "Multiply your
   bodyweight x 1.3 for grams of protein, and x 2 for carb. Divide your bodyweight in
   half for fat. That's it." It also says what to do when the scale stops moving: "If
   you're not putting on weight after a month or two, add another 500 calories per day
   using the same ratio."

   For losing or holding there is no formula in any of the books -- Mass Protocol is a
   mass protocol, and the others leave food alone -- so those two rows are the app's
   own and say so wherever they are shown. Protein stays high because a deficit is
   where muscle is at risk; fat has a floor rather than a target, because going very
   low is where people feel terrible; carbohydrate takes whatever calories are left,
   which is also the lever that moves when the target changes.

   Grams per pound of bodyweight. `c:null` means "fill the remainder". */
const MACRO={
  gain:    {src:'tb3',  p:1.3, c:2,    f:0.5},
  lose:    {src:'ours', p:1.1, c:null, f:0.4},
  maintain:{src:'ours', p:1.0, c:null, f:0.4},
};
const KCAL_G={p:4,c:4,f:9};
const MACRO_STEP=500;        // the book's increment when the scale will not move
function macroGoal(){ return MACRO[plan.goal]?plan.goal:'maintain' }
// Bodyweight in pounds, which is what every formula here is written in.
function bwLb(date){ const bw=bwFor(date); if(!bw) return null; return u()==='kg'?bw*2.2046:bw }
/* The calorie target the energy card already works to: your burn, moved by the goal.
   Pulled out so the macro split and that card cannot drift apart. */
function kcalTarget(date){
  const est=tdeeOn(date); if(!est) return null;
  const g=macroGoal();
  if(g==='lose') return est.tdee-Math.round(est.tdee*0.18/10)*10;
  if(g==='gain') return est.tdee+250;
  return est.tdee;
}
/* Today's grams. Building follows the book's formula and takes its calorie total from
   it; the other two start from the calorie target and split that up. `bump` is the
   book's 500-calorie step, applied in the same ratio, and is how a stalled scale gets
   answered rather than by inventing a new formula. */
function macroTarget(date,bump){
  const lb=bwLb(date); if(!lb) return null;
  // The stored adjustment unless a caller deliberately asks for a different one, so
  // nobody can show a target that quietly ignores it.
  bump=bump==null?(+plan.macroBump||0):+bump;
  const g=macroGoal(), M=MACRO[g], r=n=>Math.round(n/5)*5;
  const own=+plan.proteinPerLb>0?+plan.proteinPerLb:null;      // a setting of your own wins
  if(g==='gain'){
    const k=1+((+bump||0)*MACRO_STEP)/(lb*(M.p*KCAL_G.p+M.c*KCAL_G.c+M.f*KCAL_G.f));
    const P=r(lb*(own||M.p)*k), C=r(lb*M.c*k), F=r(lb*M.f*k);
    return {p:P,c:C,f:F,kcal:Math.round(P*KCAL_G.p+C*KCAL_G.c+F*KCAL_G.f),src:M.src,goal:g,bump:+bump||0};
  }
  const base=kcalTarget(date); if(base==null) return null;
  const kcal=Math.max(1200,base+(+bump||0)*MACRO_STEP);
  const P=r(lb*(own||M.p)), F=r(lb*M.f);
  const C=Math.max(0,r((kcal-P*KCAL_G.p-F*KCAL_G.f)/KCAL_G.c));
  return {p:P,c:C,f:F,kcal:Math.round(P*KCAL_G.p+C*KCAL_G.c+F*KCAL_G.f),src:M.src,goal:g,bump:+bump||0};
}
const PLIB={
  pogo:{name:'Pogo hop',
    setup:'Stand tall, feet hip width, arms at your sides or lightly bent. Weight on the balls of your feet.',
    exec:'Hop straight up repeatedly using only the ankles. Knees stay nearly straight and barely bend. Height is small, two to four inches. The goal is the shortest possible time on the ground, not air time.',
    cues:'Think “stiff spring.” Toes pulled up toward your shin before you land so the forefoot contacts first. The rhythm should sound fast and even.',
    errors:'Bending the knees to create height, which turns it into a squat jump and removes the ankle stimulus. Landing flat-footed or heel-first. Letting the rhythm slow as the set goes on.',
    note:'The lowest-stress drill in the program, and the one that most directly builds the Achilles and calf stiffness everything else relies on.'},
  askip:{name:'Ankle skip',
    setup:'Standing, ready to travel forward over about 20 meters.',
    exec:'Skip forward driving off the ankle with a minimal knee bend, opposite arm swinging. Cover ground with quick, light contacts rather than big bounds.',
    cues:'Light and quick. Contacts should be barely audible.',
    errors:'Turning it into a powerful A-skip with high knee drive. That is a different drill and adds fatigue you do not want before the main sets.'},
  broad:{name:'Broad jump (single effort)',
    setup:'Feet hip to shoulder width behind a line. Clear landing space of at least 3 meters. A flat, non-slip surface: grass or rubber gym flooring is ideal, concrete is the worst option.',
    exec:'Hinge and load by dipping to roughly a quarter squat, swinging the arms back. Jump forward and slightly up, driving the arms forward and fully extending hips, knees and ankles. Land on both feet with hips back and knees tracking over toes, then absorb and stick: no extra hop, no stagger.',
    cues:'Reach, don’t fall. Drive the arms hard; they contribute more distance than most people expect. Land like you are catching yourself in a quarter squat, not a deep one.',
    errors:'Landing stiff-legged with straight knees (jarring and risky). Knees collapsing inward on landing. Piking at the waist in the air. Taking a step after landing. If you cannot stick it, you jumped past your current ability to absorb it.',
    note:'Your measured lift for the block. Mark the takeoff line and measure to your rearmost heel. Log the best jump of each session.'},
  vertj:{name:'Vertical jump',
    setup:'Stand side on to a wall. Reach up with the near arm, feet flat, and mark the highest point your fingers reach: that is your standing reach. Chalk, tape or a coach\u2019s eye all work; a Vertec or a wall you can mark is easiest.',
    exec:'From a standstill, dip to about a quarter squat, swing both arms down and back, then jump as high as you can and touch the wall at the top with the near hand. No run-up and no step into it. Three attempts, resting fully between them, and keep the best.',
    cues:'Down fast, up faster: the dip should be quick and shallow. Throw the arms up as you extend. Reach at the top of the jump, not on the way up.',
    errors:'Dipping too deep or too slowly, which loses the stretch reflex. Taking a step in. Measuring the jump touch but forgetting the standing reach, which is the number you subtract.',
    note:'Jump height is the touch height minus your standing reach. Record the same way every time \u2014 same wall, same shoes, same arm \u2014 or the comparison is meaningless.'},
  triple:{name:'Standing triple jump',
    setup:'A line to start behind and about 10 meters of flat, forgiving space. Grass or rubber flooring; do not test this on concrete. Warm up fully first: it is the highest-force test in the set.',
    exec:'From a two-foot standstill, jump forward and land on one foot (the hop), immediately bound forward onto the opposite foot (the step), then jump off that foot and land on both feet (the jump). Three linked efforts, no pause between them. Measure from the line to your rearmost heel on the final landing.',
    cues:'Even, rhythmic, flowing. Aim for three jumps of similar length rather than an enormous first one that leaves you nothing to land on. Arms drive on every contact.',
    errors:'Attacking the hop so hard that the step and jump collapse. Pausing between contacts, which turns it into three standing jumps. Reaching for distance on the last landing and falling backwards \u2014 stick it or the attempt does not count.',
    note:'The most demanding jump test here, and the one that exposes single-leg elasticity and left-to-right differences the broad jump hides. Skip it if an ankle or Achilles is complaining.'},
  cbroad:{name:'Continuous broad jump',
    setup:'Same as the broad jump, with space for two to three consecutive jumps.',
    exec:'Perform a broad jump, and the instant you land, immediately jump again with minimal time on the ground. The landing of jump one is the loading for jump two.',
    cues:'Rebound, don’t reset. The whole point is that ground contact is short. Slightly shorter individual jumps with fast contacts beat long jumps with a pause.',
    errors:'Pausing to re-set between reps, which makes it separate single jumps. Sinking into a deep squat on each landing, which kills the elastic stimulus.'},
  box:{name:'Box jump, step down',
    setup:'A stable box or plyo platform at a height you can land on in a quarter squat, not a deep one: typically 18 to 24 inches. Stand about a foot back.',
    exec:'Dip, swing the arms, and jump onto the box, landing softly on both feet with hips slightly back. Stand fully upright on top, then step down one foot at a time.',
    cues:'Soft, quiet landing. If you hear a thud, you are landing too heavily or the box is too high.',
    errors:'Choosing a box so tall you have to tuck your knees to your chest to clear it. That measures hip flexibility, not power. Jumping down off the box, which adds eccentric load with none of the benefit.',
    note:'Always step down. Repeated jump-downs are where box jump injuries come from, and they add contacts you did not program.'},
  lbound:{name:'Lateral bound (stick 2 seconds)',
    setup:'Stand on one leg. Clear space to your side. Non-slip footing matters more here than anywhere else.',
    exec:'Push laterally off the standing leg and land on the opposite leg. Absorb on that single leg with a soft knee and the hip loaded, and hold the landing completely still for a two-count before bounding back the other way.',
    cues:'Land with the knee tracking over the middle of the foot and the hip taking the load. The two-second hold is the exercise: it trains deceleration and frontal-plane control.',
    errors:'Rushing the hold. Letting the knee cave inward. Landing on a stiff, straight leg. Bounding so far sideways you cannot control the landing. Distance is capped by your ability to stick it.'},
  slhop:{name:'Single-leg hop (straight line)',
    setup:'Balance on one leg, hands free. Flat surface with several meters ahead.',
    exec:'Hop forward on the same leg repeatedly, aiming for consistent distance and short contacts. Complete all reps on one leg, then switch.',
    cues:'Stay tall through the torso. Hips level: do not let the opposite hip drop on each landing.',
    errors:'Letting distance shrink through the set. Excessive side-to-side drift. Hunching forward at the waist.',
    note:'Compare left to right. A noticeable asymmetry in distance or landing control is worth addressing with unilateral strength work before adding jump volume.'},
  sllat:{name:'Single-leg lateral hop (continuous)',
    setup:'Balance on one leg. Optionally use a line or low object to hop over.',
    exec:'Hop side to side on the same leg, continuously, with short ground contacts. No pause between reps.',
    cues:'Small and fast beats big and slow. Knee tracks over the foot on every contact.',
    errors:'Knee caving inward as fatigue sets in: stop the set when you see it. Landing flat-footed.',
    note:'The highest frontal-plane demand in the program, and the most protective for ankles and knees.'},
  bdist:{name:'Bound for distance',
    setup:'Space of 20 to 30 meters. Start with a few walking steps into the first bound rather than from a dead stop.',
    exec:'Alternate legs in exaggerated running strides, driving off one leg and landing on the other, covering as much ground per contact as possible. Opposite arm drives forward with each bound.',
    cues:'Push the ground behind you and reach with the landing leg. Long, powerful, rhythmic.',
    errors:'Turning it into ordinary running. Landing heel-first. Leaning back to try to hang in the air.'},
  bheight:{name:'Bound for height',
    setup:'Same as bounding for distance, with the same run-in.',
    exec:'Alternate-leg bounds emphasizing vertical displacement rather than horizontal: drive the knee up and get as high as you can per contact, covering less ground.',
    cues:'Punch the knee up and the arms up. Think “up” on every contact.',
    errors:'Drifting back into distance bounding once you fatigue. Collapsing into a deep knee bend on landing.'},
  hurdle:{name:'Hurdle hop (low, continuous)',
    setup:'Three to five low hurdles, cones, or 6 to 12 inch objects in a line, roughly a meter apart. Use objects that fall over harmlessly if clipped.',
    exec:'Hop over each with both feet, landing and immediately rebounding into the next with minimal ground contact. Complete the line, walk back, repeat.',
    cues:'Minimal time on the ground. Land on the balls of the feet, ankles stiff.',
    errors:'Hurdles too high, which forces a knee tuck and a long pause on each landing. Pausing between hurdles to re-set.',
    note:'If you only have one or two objects, use fewer and reset between passes rather than raising the height.'},
  slam:{name:'Overhead med ball slam',
    setup:'Feet hip to shoulder width, a non-bouncy slam ball of 8–15 lb. Floor you do not mind hitting.',
    exec:'Reach the ball overhead with the whole body long, then throw it into the floor in front of your feet as hard as you can, folding at the hips and ribs. Pick it up, reset, repeat.',
    cues:'Throw the ball through the floor, not at it. The power comes from the hips and trunk, not the arms.',
    errors:'Bending only at the arms. Rushing the reset so the set turns into conditioning. Using a bouncy ball, which takes the finish away from you.',
    note:'Intent is the whole exercise. If the ball is heavy enough to slow you down, it is too heavy.'},
  chestpass:{name:'Med ball chest pass',
    setup:'A meter or two from a solid wall, ball at the sternum, athletic stance.',
    exec:'Push the ball into the wall as fast as you can, catch the rebound and reset. Feet stay planted.',
    cues:'Fast hands. Think of pushing the wall away rather than throwing at it.',
    errors:'Standing so close that the rebound arrives before you are set. Turning it into a rep count instead of a speed drill.'},
  rotthrow:{name:'Rotational med ball throw',
    setup:'Side on to a wall, feet shoulder width, ball at the hip furthest from it.',
    exec:'Turn the back hip through and release the ball into the wall across your body. Complete all reps on one side, then switch.',
    cues:'Hips lead, arms follow. The back heel should come off the floor as you turn.',
    errors:'Throwing with the arms while the hips stay square. Taking the ball too far behind the body and losing the whip.',
    note:'The only rotation in a week of squats, presses and riding. Worth keeping even when you cut everything else.'},
  scoop:{name:'Backward scoop toss',
    setup:'Feet slightly wider than the hips, ball held low between the legs, clear space behind you.',
    exec:'Dip into a quarter squat and throw the ball up and behind you, extending hips, knees and ankles fully.',
    cues:'One long push from the floor to the fingertips. Let it pull you onto your toes.',
    errors:'Squatting deep and turning it into a lift. Throwing with the back rather than the legs.'},
  plyopush:{name:'Plyometric push-up',
    setup:'Push-up position on a forgiving surface. Hands under the shoulders.',
    exec:'Lower under control, then drive up hard enough that the hands leave the floor. Land with soft elbows and go straight into the next rep only if you can keep the height.',
    cues:'Short time on the floor, ribs down, body in one line. Height over reps.',
    errors:'Letting the hips sag. Grinding out reps once the push-off slows, which is where shoulders get sore.',
    note:'The highest-stress movement in this block. Leave it out on weeks where the bench already feels heavy.'},
  speedpress:{name:'Speed bench or floor press',
    setup:'Bar at about 50–60% of your bench max, or a pair of dumbbells you could press 15 times. A spotter or safeties if you are on a bench.',
    exec:'Lower under control to the chest, pause for nothing, and drive the bar up as fast as you possibly can. Three reps, then rack it. Speed decides the set, never the weight.',
    cues:'Accelerate all the way through: the bar should feel like it wants to leave your hands at the top. Reset your brace before every rep.',
    errors:'Creeping the weight up until it stops moving fast, which turns this back into ordinary benching. Bouncing the bar off the chest. Running the reps together.',
    note:'The option that needs no new equipment. Because it is the same pattern as your work sets, it is also the one most likely to cost you on Friday: keep it light.'},
  plyopushbox:{name:'Push-up onto plates or low boxes',
    setup:'Two 25 lb plates, low boxes or steps, a little wider than shoulder width, with the floor between them.',
    exec:'From the floor, push up hard enough to land both hands on top of the plates, then lower back down between them and repeat. Or start on top and drop into the gap.',
    cues:'Land with the elbows soft and the body still in one line. Height and control over speed.',
    errors:'Plates too far apart, which throws the shoulders into a wide catch. Piking the hips to get airborne.',
    note:'Easier on the wrists and shoulders than clapping push-ups, and it gives the drop a defined height.'},
  dbsnatch:{name:'Single-arm dumbbell snatch',
    setup:'One moderate dumbbell or kettlebell between the feet, feet a little wider than the hips, chest up.',
    exec:'Hinge, then drive the floor away and pull the weight straight up past the ribs, punching the hand through overhead as the elbow turns over. Lock the arm out with the weight over the shoulder. Lower it down the same path and reset on the floor between reps.',
    cues:'Legs and hips throw it, the arm only guides it. One clean line close to the body.',
    errors:'Swinging it out in an arc and catching it on a bent, soft arm. Chasing reps for breath: this is a power set, not a circuit.',
    note:'The most total-body option here, and the closest thing in the block to an Olympic lift without needing the technique.'},
  highpull:{name:'Explosive high pull',
    setup:'A barbell at about 40–50% of your deadlift, or a pair of dumbbells. Start with the bar just above the knee rather than the floor.',
    exec:'Push the floor away, extend the hips hard, and let that speed carry the bar up the body to about sternum height with the elbows high and outside. Lower it back to the start under control.',
    cues:'The hips throw it; the arms only finish the ride. Bar stays close, elbows finish above the hands.',
    errors:'Turning it into an upright row by pulling early with the arms. Going heavy enough that the bar never gets above the navel. Leaning back at the top.'},
  explpull:{name:'Explosive pull-up',
    setup:'A bar you can do at least five clean pull-ups on. Full hang, no kipping.',
    exec:'From a dead hang, pull as violently as you can and aim to bring the chest to the bar, or to release the hands at the top if the bar and your grip allow it. Lower under control, re-hang, and reset for the next rep.',
    cues:'Every rep starts from a still hang. The aim is speed off the bottom, not getting the chin over by any means.',
    errors:'Swinging the legs to generate the pull. Grinding out reps once the speed goes: the set ends when the bar stops coming fast.',
    note:'The only explosive pulling in the program, and it pairs well with the pull-up progression you are already running.'},
  bandrow:{name:'Explosive band row',
    setup:'A band anchored at chest height, standing far enough back that it is under tension with your arms straight.',
    exec:'Snap both elbows back to the ribs as fast as you can, then let the band pull the arms straight again under control. Reset your stance between reps if it drags you forward.',
    cues:'Fast in, slow out. Shoulder blades move, the torso does not.',
    errors:'Leaning back to help. Band so heavy that the pull turns slow, which makes it strength work instead.'},
  bandrot:{name:'Band rotational punch',
    setup:'A band anchored at chest height behind you, side on, both hands on the handle at the ribs.',
    exec:'Turn the back hip through and punch the hands across the body as fast as you can, then return under control. All reps on one side, then switch.',
    cues:'Hips lead, arms follow, back heel turns. Same pattern as the med ball throw with no ball and no wall.',
    errors:'Rotating with the arms while the feet stay stuck. Letting the band snap you back around rather than controlling the return.',
    note:'The travel-friendly rotation option: one band and a door anchor.'},
  depth:{name:'Depth jump',
    setup:'Box 12 to 16 inches high. Stand at the edge. Landing area must be flat and non-slip with room to jump forward or up.',
    exec:'Step off the box. Do not jump off or down. Land on both feet on the balls of the feet and, as fast as humanly possible, rebound into a maximal vertical jump. The time between landing and takeoff is the entire exercise.',
    cues:'Land and leave. Imagine the floor is hot. Target roughly a quarter-second on the ground; if you sink into a deep squat before jumping, the box is too high.',
    errors:'Jumping off the box instead of stepping, which changes the landing force unpredictably. Using too high a box: the single most common error, and it converts an elastic drill into a heavy eccentric one. Pausing on landing.',
    note:'Highest-stress movement in the program. If your vertical rebound off the box is lower than a normal standing vertical jump, the box is too high. Lower it. Start at 12 inches even if that feels trivially easy.'}
};
// Variants for the lifts that have them. Barbell only, both slots: a movement whose
// limit is what you can hold (goblet, double kettlebell front) or that has no lockout to
// test (RDL) has no one-rep max to run percentages against, so it belongs in the
// accessory and travel-week lists instead.
// `r` is the variant's usual share of the reference lift's max, used to work out the
// weight when you have not tested the variant itself; enter a real max in Setup and that
// wins instead. The first entry in each list is the reference: the max everything else is
// derived from, the one retests measure, and what you get if you never touch this.
/* The rule, in the owner's words: a lift variant is a barbell. A straight bar, or a
   specialty bar -- safety squat, trap, football, axle. Dumbbell and landmine work is
   accessory work and lives in the accessory slots, which is where it already is.

   It happens to give the same answer as the mechanical test above and is easier to
   apply: a barbell lift has a lockout to test and a weight that does not depend on what
   your hands can hold, so there is an honest one-rep max to run percentages against.

   The weighted pull-up is the one cluster lift that is not a barbell, so it is the one
   exception, and it is an exception to the wording rather than to the reason: change
   the grip and it is still the same lift, with the same testable one-rep max, loaded
   off a belt. What it does need is different arithmetic -- see `varMax`, where a share
   of a bodyweight lift is a share of bodyweight plus the added weight, not of the
   added weight on its own. */
// The lift itself, as opposed to the variant of it you are running. `liftName()`
// resolves a key to the variant in use, which is what every prescription wants and is
// wrong anywhere the subject is the lift: a table of squat variants headed with the
// squat you happen to be squatting reads as nonsense.
const VAR_OF={squat:'Squat',bench:'Bench press',ohp:'Overhead press',wpu:'Weighted pull-up',dead:'Deadlift'};
const VARS={
  squat:{
    high:{name:'High-bar back squat',short:'High bar',r:1,note:'Bar on the traps, upright torso, deeper knee bend. The reference: everything else here is a share of it.'},
    low:{name:'Low-bar back squat',short:'Low bar',r:1.03,note:'Bar on the rear delts, more hip and more forward lean. Usually a few percent heavier than high bar.'},
    ssb:{name:'Safety squat bar squat',short:'SSB',r:.9,note:'Cambered bar, handles in front. The weight sits forward and wants to fold you, so the upper back works hard. Usually about 10% under a straight-bar squat, but the gap is personal.'},
    front:{name:'Front squat',short:'Front',r:.85,note:'Rack position, vertical torso, quads and upper back. About 85% of a back squat, and the upper back usually gives out first.'},
    box:{name:'Box squat',short:'Box',r:.95,note:'Sit to a box at or just below parallel, pause, drive up. Kills the stretch reflex, so it is honest hip strength.'},
    pause:{name:'Paused squat',short:'Paused',r:.9,note:'Two seconds in the hole, no bounce. Exposes whether the bottom position is actually under control.'},
    zercher:{name:'Zercher squat',short:'Zercher',r:.77,note:'Bar in the crooks of the elbows. Brutal on the upper back and trunk, and the limiter is usually how much your arms will take.'}
  },
  bench:{
    flat:{name:'Bench press',short:'Bench',r:1,note:'Straight bar, flat, feet down, touch and press. The reference: everything else here is a share of it.'},
    close:{name:'Close-grip bench',short:'Close grip',r:.92,note:'Hands about shoulder width, elbows tucked. More triceps, less shoulder, and the usual answer to a front delt that complains on the wide grip.'},
    incline:{name:'Incline barbell bench',short:'Incline',r:.82,note:'Thirty to forty-five degrees. Upper chest and front delt, which is the one gap three days of flat pressing leaves.'},
    floor:{name:'Floor press',short:'Floor',r:.92,note:'Flat on the floor, upper arms stop on the way down. No leg drive and no stretch at the bottom, so it is lockout strength and it is kind to the shoulder.'},
    pause:{name:'Paused bench',short:'Paused',r:.93,note:'A dead stop on the chest, no bounce. The chest gives you a reference to settle against and start from, which is why this is the one that carries over to a competition bench.'},
    spoto:{name:'Spoto press',short:'Spoto',r:.9,note:'Stop an inch or two above the chest and hold it there \u2014 no contact at all. Nothing to settle against, in the worst leverage of the lift, so it is harder than a paused bench and it catches a bar that was quietly sinking into the chest.'},
    neutral:{name:'Neutral-grip bar bench',short:'Neutral grip',r:.92,note:'Football or Swiss bar, palms facing. The one to run for a whole block when the shoulder will not tolerate a straight bar.'},
    pin:{name:'Pin or board press',short:'Pins',r:1.05,note:'Short range from pins or boards, overloading the top half. Easy to flatter yourself with \u2014 pick one height and keep it.'}
  },
  ohp:{
    strict:{name:'Overhead press',short:'Strict',r:1,note:'Standing, strict, no leg drive and no layback beyond a braced trunk. The reference: everything else here is a share of it.'},
    push:{name:'Push press',short:'Push press',r:1.25,note:'A dip and drive off the legs, then press it out. More weight overhead and more total-body coordination; the lockout is still yours.'},
    seated:{name:'Seated barbell press',short:'Seated',r:.95,note:'Takes the legs and the hips out of it. Less weight, and nowhere to hide a sloppy brace.'},
    btn:{name:'Behind-the-neck press',short:'Behind neck',r:.9,note:'Wants genuine shoulder mobility and gives a narrow margin for error. Worth it for upper-back and overhead position if you have the range; skip it if you do not.'},
    z:{name:'Z press',short:'Z press',r:.72,note:'Seated on the floor, legs straight. Removes every bit of help from below the waist, which is why the number is so much lower.'},
    pin:{name:'Pin press',short:'Pins',r:1.05,note:'Dead start from pins at forehead height. No stretch reflex and no dip, so it is the sticking point on its own.'}
  },
  wpu:{
    pull:{name:'Weighted pull-up',short:'Pull-up',r:1,note:'Pronated, hands about shoulder width, chin over the bar. The reference: everything else here is a share of it.'},
    chin:{name:'Weighted chin-up',short:'Chin-up',r:1.05,note:'Supinated, hands shoulder width. More biceps and a shorter effective pull, so most people are strongest here.'},
    neutral:{name:'Neutral-grip pull-up',short:'Neutral',r:1.03,note:'Palms facing, on handles or a parallel bar. Usually the kindest on the elbow and the shoulder, and close to a chin-up for strength.'},
    wide:{name:'Wide-grip pull-up',short:'Wide',r:.95,note:'Hands well outside the shoulders. Shorter range but a worse angle for the lats and arms, and it goes down rather than up.'},
    c2b:{name:'Chest-to-bar pull-up',short:'Chest to bar',r:.92,note:'Pull until the chest touches. A longer range and real upper-back retraction at the top, which is where it gets expensive.'}
  },
  dead:{
    conv:{name:'Conventional deadlift',short:'Conventional',r:1,note:'The reference. Everything else here is expressed against it.'},
    sumo:{name:'Sumo deadlift',short:'Sumo',r:1,note:'Wide stance, hands inside the knees, shorter bar path and more quad. Treated as equal to conventional because the gap is personal — if yours differs, give it its own max.'},
    trap:{name:'Trap bar deadlift',short:'Trap bar',r:1.05,note:'Neutral grip, load closer to the hips, easier on the lower back. Usually a touch heavier than conventional, more so from the high handles.'},
    deficit:{name:'Deficit deadlift',short:'Deficit',r:.9,note:'Standing on 1–3 inches. Longer pull off the floor, harder start, and the reason to use it is a weak break from the floor.'},
    snatch:{name:'Snatch-grip deadlift',short:'Snatch grip',r:.85,note:'Wide grip, much longer range, heavy on the upper back. Grip usually decides the set.'},
    pause:{name:'Paused deadlift',short:'Paused',r:.85,note:'Pause an inch or two off the floor, or below the knee. Punishes any slack in the start position.'},
    block:{name:'Block or rack pull',short:'Blocks',r:1.1,note:'Bar raised to just below the knee. Shorter pull, heavier weight, and easy to overload — keep it honest.'}
  }
};
// The variants you can pick from: the built-in list plus anything you have defined
// yourself in Setup. A custom variant is just a name and a share of the reference lift's
// max, which is all the program needs to prescribe it.
function varsOf(k){
  if(!VARS[k]) return null;
  const out=Object.assign({},VARS[k]);
  for(const c of ((plan.customVar||{})[k]||[])){
    if(!c||!c.id||!c.name||!(+c.r>0)) continue;
    out[c.id]={name:c.name,short:c.short||c.name,r:+c.r,note:c.note||('Your own variant, at '+Math.round(+c.r*100)+'% of the '+VARS[k][varRef(k)].name.toLowerCase()+'.'),custom:true};
  }
  return out;
}
function varRef(k){return VARS[k]?Object.keys(VARS[k])[0]:null}
// The 12–15 min warm-up as a checklist. `s` marks the 7-minute short version.
const WARMUP=[
  {g:'Raise temp',n:'Bike, rower or easy jog',d:'4–5 min',s:1},
  {g:'Breathe / reset',n:'90/90 breathing (back, feet on bench or wall)',d:'5 breaths',s:1},
  {g:'Breathe / reset',n:'Cat / cow',d:'8–10 slow reps',s:1},
  {g:'Spine / t-spine',n:'Thread the needle',d:'6–8 per side'},
  {g:'Spine / t-spine',n:'Open book (side-lying rotation)',d:'8 per side'},
  {g:'Spine / t-spine',n:'Quadruped t-spine extension',d:'8 per side'},
  {g:'Hips',n:'90/90 hip switches, seated',d:'10 switches',s:1},
  {g:'Hips',n:'90/90 lean-forward hold',d:'20–30 sec per side'},
  {g:'Hips',n:'Couch stretch',d:'45–60 sec per side',s:1},
  {g:'Hips',n:'Frog stretch, gentle rocking',d:'10 rocks'},
  {g:'Hips',n:'World’s greatest stretch',d:'5 per side'},
  {g:'Activate',n:'Leg swings, both directions',d:'10 each way per leg'},
  {g:'Activate',n:'Band pull-aparts + shoulder dislocates',d:'15 each',s:1},
  {g:'Activate',n:'Glute bridge or bodyweight squat',d:'10 reps'}
];

/* Asked for: whichever routine is running, these two are in it. They are already in
   the list above, in their own positions, so that list is left exactly as it was and
   every tick logged against it on a past day still lines up. The other routines get
   them prepended. */
const WARM_CORE=[
  {g:'Always',n:'90/90 breathing (back, feet on bench or wall)',d:'5 breaths',s:1},
  {g:'Always',n:'90/90 hip switches, seated',d:'10 switches',s:1}
];
/* Joe DeFranco's Agile 8, from his own "Training Rules for Washed-up Meatheads", with
   his doses. Not Tactical Barbell and not ours -- the books prescribe no mobility
   routine at all, and Ageless Athlete says to bring your own: "If you have a
   flexibility or mobility protocol you like to follow (not a bad idea), incorporate
   that as much as you like."

   Copies of this routine differ. Several swap in frog jumps or a bent-knee iron cross;
   the original has mountain climbers and no iron cross, so that is what is here. */
const AGILE8=[
  {g:'Roll',n:'Foam roll IT band',d:'10\u201315 passes per leg'},
  {g:'Roll',n:'Foam roll adductors',d:'10\u201315 passes per leg'},
  {g:'Roll',n:'Glute and piriformis release, tennis ball',d:'30 sec per side'},
  {g:'Move',n:'Rollovers into V-sits',d:'10 reps'},
  {g:'Move',n:'Fire hydrant circles',d:'10 forward + 10 back per leg'},
  {g:'Move',n:'Mountain climbers',d:'20 total'},
  {g:'Move',n:'Groiners',d:'10 reps, hold the last 10 sec'},
  {g:'Stretch',n:'Static hip flexor stretch',d:'3 \u00d7 10 sec per leg'}
];
const WARM_ROUTINES={
  ours:{name:'Ours',mins:'12\u201315 min',short:'7 min',items:()=>WARMUP,core:false,
    note:'Built for this app, not taken from the books \u2014 none of them prescribe a mobility routine. Breathing and t-spine first, then hips, then something to switch the glutes on.'},
  agile8:{name:'Agile 8',mins:'10\u201315 min',items:()=>AGILE8,
    note:'Joe DeFranco\u2019s, from \u201cTraining Rules for Washed-up Meatheads\u201d, at his doses. Needs a foam roller and a tennis ball.'},
  mine:{name:'Mine',mins:'',items:()=>warmMine(),
    note:'Yours. One movement per line, dose after a comma.'}
};
// Mobility to finish each session. The program notes keep deep holds out of the warm-up
// and put them after training, so each session type ends with what it actually loaded.
const MOB={
  lift:{name:'Hips and t-spine',why:'Squats three times a week plus riding: hips first.',items:[
    ['Couch stretch','60–90 sec per side'],['90/90 lean-forward hold','45 sec per side'],
    ['Figure-4 glute stretch','45 sec per side'],['Thread the needle or open book','8 per side'],
    ['Child’s pose with lat reach','45 sec per side']]},
  dead:{name:'Posterior chain',why:'After deadlifts: decompress and open the hamstrings.',items:[
    ['Dead hang from the bar','20–30 sec'],['Standing forward fold, soft knees','45–60 sec'],
    ['Supine hamstring stretch (strap or doorway)','45 sec per side'],['Couch stretch','60–90 sec per side'],
    ['Figure-4 glute stretch','45 sec per side'],['Cat / cow, slow','8–10 reps']]},
  hic:{name:'Hip flexors and calves',why:'Riding in the same position compounds with squats. This is the antidote.',items:[
    ['Couch stretch','60–90 sec per side'],['Standing quad stretch','45 sec per side'],
    ['Straight-leg calf stretch against a wall','45 sec per side'],['Figure-4 glute stretch','45 sec per side'],
    ['Seated forward fold','45–60 sec']]},
  plyo:{name:'Ankles and calves',why:'Jumping loads the Achilles and calves hardest.',items:[
    ['Straight-leg calf stretch (gastroc)','45 sec per side'],['Bent-knee calf stretch (soleus)','45 sec per side'],
    ['Knee-to-wall ankle mobilization','10 reps per side'],['Foot / arch roll on a ball','60 sec per side'],
    ['Couch stretch','60–90 sec per side']]},
  off:{name:'Full mobility',why:'No training today: the best day for the long holds.',items:[
    ['Couch stretch','90 sec per side'],['Frog stretch, gentle rocking','2 min'],
    ['90/90 switches and lean holds','45 sec per side'],['Pigeon or figure-4','60–90 sec per side'],
    ['Thoracic extension over a foam roller','10 slow reps'],['Dead hang','30 sec'],
    ['Diaphragmatic breathing, legs up the wall','2–3 min']]}
};
const PLYO_WARMUP=[['pogo','Pogo hops','3 × 10','Wakes up the ankle spring; short, fast ground contacts'],['askip','Ankle skips','2 × 20 m','Rhythm and elastic timing through the calf and Achilles'],['broad','Submaximal broad jumps','3 × 1 at ~70%','Rehearses the landing pattern before full effort']];
const PLYO=[
  {name:'Extensive',target:60,desc:'Extensive means volume over intensity — plenty of contacts, none of them all-out. Bilateral, stick every landing. This phase is about teaching the landing and building tissue tolerance, not chasing distance.',
   ex:[{id:'broad',label:'Broad jump, single effort',s:5,r:'3',c:15,rest:60},{id:'box',label:'Box jump, step down',s:5,r:'3',c:15,rest:60},{id:'lbound',label:'Lateral bound, stick 2 sec',s:4,r:'4 / side',c:16,rest:60},{id:'pogo',label:'Pogo hops in place',s:4,r:'8',c:32,rest:45,low:true}]},
  {name:'Unilateral + reactive',target:80,desc:'Single-leg work enters. Measure and log your best broad jump every session from here on; it is your progress marker.',
   ex:[{id:'cbroad',label:'Broad jump, 2 continuous',s:5,r:'2 jumps',c:20,rest:90},{id:'slhop',label:'Single-leg hop, straight line',s:4,r:'4 / side',c:32,rest:90},{id:'bdist',label:'Bound for distance',s:4,r:'6 contacts',c:24,rest:90},{id:'hurdle',label:'Hurdle hops, low, continuous',s:3,r:'5',c:15,rest:90}]},
  {name:'Elastic',target:90,desc:'Depth jumps enter: the highest-stress sets in the block. Start at the lower box height and only raise it if landings stay silent and controlled.',
   ex:[{id:'depth',label:'Depth jump from 12–16 in',s:5,r:'3',c:15,rest:120},{id:'sllat',label:'Single-leg lateral hop, continuous',s:4,r:'5 / side',c:40,rest:90},{id:'cbroad',label:'Continuous broad jump, 3 reps',s:4,r:'3 jumps',c:24,rest:90},{id:'bheight',label:'Bound for height',s:3,r:'4',c:12,rest:90}]}
];
// Optional upper-body power. Off by default. Every slot offers a med ball, a bodyweight,
// a barbell/dumbbell and (where it works) a band option, so the block runs in any gym or
// none. Throws are counted separately from ground contacts: they add no impact, but they
// do add fatigue before Friday's bench.
const UP_THROW={name:'Total-body throw',opts:[
  {id:'slam',label:'Overhead slam',gear:'Slam ball',r:'5',rest:60},
  {id:'scoop',label:'Backward scoop toss',gear:'Med ball, space behind',r:'5',rest:60},
  {id:'dbsnatch',label:'Single-arm DB snatch',gear:'Dumbbell or kettlebell',r:'3 / side',rest:90},
  {id:'highpull',label:'Explosive high pull',gear:'Barbell or dumbbells',r:'3',rest:90}]};
const UP_PUSH={name:'Push',opts:[
  {id:'chestpass',label:'Chest pass into a wall',gear:'Med ball, wall',r:'5',rest:60},
  {id:'plyopush',label:'Plyometric push-up',gear:'Bodyweight',r:'4',rest:90},
  {id:'plyopushbox',label:'Push-up onto plates',gear:'Two plates or low boxes',r:'4',rest:90},
  {id:'speedpress',label:'Speed bench or floor press',gear:'Barbell or dumbbells, ~50%',r:'3',rest:90}]};
const UP_ROT={name:'Rotation',opts:[
  {id:'rotthrow',label:'Rotational throw',gear:'Med ball, wall',r:'5 / side',rest:60},
  {id:'bandrot',label:'Band rotational punch',gear:'Band',r:'6 / side',rest:60}]};
const UP_PULL={name:'Pull',opts:[
  {id:'explpull',label:'Explosive pull-up',gear:'Pull-up bar',r:'3',rest:90},
  {id:'bandrow',label:'Explosive band row',gear:'Band',r:'6',rest:60},
  {id:'highpull',label:'Explosive high pull',gear:'Barbell or dumbbells',r:'3',rest:90}]};
const PLYO_UPPER=[
  {name:'Power',slots:[{s:3,...UP_THROW},{s:3,...UP_PUSH}]},
  {name:'Rotation',slots:[{s:3,...UP_ROT},{s:3,...UP_PULL}]},
  {name:'Elastic',slots:[{s:3,...UP_PUSH,def:'plyopush'},{s:3,...UP_THROW},{s:2,...UP_ROT}]},
];
// The road to a weighted pull-up, in the order the strength actually arrives. `at` is the
// best clean rep count that puts you on this rung. What you do on Lift 3 days, and the
// one thing that moves you up.
const PULLUP=[
  {at:0,name:'Hangs and negatives',work:'5 × 10–20 s dead hang, then 4–6 negatives: jump or step to the top, lower for 5 seconds, no faster.',next:'One clean rep from a dead hang.',
   why:'The negative builds the top half and the grip at the same time, and it is the only thing that works when you cannot yet pull your own weight.'},
  {at:1,name:'Band-assisted volume',work:'4 × 4–6 with the lightest band that lets you finish the set clean. Keep the negatives.',next:'Five clean reps in one set.',
   why:'Volume is what moves this. A band you can barely finish with is doing too little; one that makes it easy is doing too much.'},
  {at:5,name:'Clean reps',work:'4–5 sets across, stopping two short of failure. Full hang at the bottom, chin clearly over at the top.',next:'Ten clean reps in one set.',
   why:'Reps in reserve matter more here than grinding: the set that leaves you shaking costs you the next two sessions.'},
  {at:10,name:'Ready to load',work:'Add weight: start at 10% of bodyweight for 4 × 3–5, and run it as Lift 3 on the Operator percentages.',next:'A weighted single at 25% of bodyweight.',
   why:'Ten clean reps is the usual threshold where adding weight beats adding reps. The app can run the weighted pull-up as Lift 3 from here.'},
  {at:15,name:'Weighted',work:'Weighted pull-ups as a cluster lift, retested like any other max.',next:'Keep adding, and keep one bodyweight set a week for the reps.',
   why:'From here it is ordinary strength work: the percentages apply to bodyweight plus the added weight.'}
];
function pullupStage(reps){let i=0;for(let j=0;j<PULLUP.length;j++) if(reps>=PULLUP[j].at) i=j;return i}
const PLYO_PULLBACK=['Broad jump distance is down more than 5% from recent sessions before you have even started the work sets.','Achilles, patellar tendon or shin soreness you can feel while walking. Tendon complaints build quietly over weeks, then stop you for months.','Sleep has been short or broken for several nights running.','The lifting session before this one was unusually heavy, or left you sore into today.'];
function libBody(e){return `<div class="plib">${[['Setup',e.setup],['Execution',e.exec],['Cues',e.cues],['Common errors',e.errors]].map(([t,x])=>`<p><b>${t}.</b> ${esc(x)}</p>`).join('')}${e.note?`<p class="plib-note">${esc(e.note)}</p>`:''}</div>`}
function plyoEntry(id){const e=PLIB[id];if(!e)return '';return `<div class="plib">${[['Setup',e.setup],['Execution',e.exec],['Cues',e.cues],['Common errors',e.errors]].map(([t,x])=>`<p><b>${t}.</b> ${esc(x)}</p>`).join('')}${e.note?`<p class="plib-note">${esc(e.note)}</p>`:''}</div>`}
// A week away from the barbell. Rep targets rather than percentages, so nothing here
// touches your maxes, and the cycle pauses rather than counting these as trained weeks.
const TRAVEL={
  day1:{name:'Squat pattern and push',items:[
    ['Goblet, double KB front or DB front squat','3 × 8–12'],['Push-up or DB bench press','3 × 10–15'],
    ['DB or band row','3 × 10–12'],['Plank','3 × 30–45 sec']]},
  day2:{name:'Single leg and overhead',items:[
    ['Rear-foot-elevated split squat','3 × 8–10 per side'],['DB overhead press','3 × 8–12'],
    ['Chin-up, band-assisted, or DB curl','3 × 8–12'],['Hollow hold','3 × 20–30 sec']]},
  day3:{name:'Hinge and carry',items:[
    ['DB Romanian deadlift','3 × 10–12'],['Floor press or dips','3 × 8–12'],
    ['Single-arm row','3 × 10 per side'],['Suitcase carry','3 × 30 m per side']]},
};
const ACC={
  mon:['Horizontal pull: chest-supported row','Rear delt / upper back: face pull or reverse fly','Core: Pallof press or hanging knee raise','Arms: curls + triceps pushdown'],
  wed:['Arms: curls + triceps pushdown','Shoulders: DB lateral raise','Pull-up progression'],
  fri:['Single-leg: rear-foot-elevated split squat','Posterior chain: Romanian deadlift, back extension or hamstring curl','Carry / grip: farmer carry']
};
const DEF={
  startMonday:'2026-09-28', bridge:true, unit:'lb', bar:45, bodyweight:null,
  maxes:{squat:null,bench:null,pull:null,ohp:null,wpu:null,dead:null},
  lift3Name:'Lat pulldown', machineNote:'',
  l3:{on:{pull:true,ohp:true,wpu:false},mode:'same',primary:'pull'},
  acc:null,
  basis:'1rm', tmPct:90,
  round:{squat:5,bench:5,pull:5,ohp:5,wpu:2.5,dead:5},
  // Calendar feed. mode 'allday' or 'timed'; time/weekend are HH:MM in your own local
  // time wherever you are; alarm is minutes before the start, null for none.
  cal:{mode:'allday',time:'06:00',weekend:'',alarm:null},
  // Accessories: which slots each day fills, what fills them this block and later,
  // and your own additions to the catalogue. See 01b-accessories.js.
  accSlots:{}, accPick:{}, accCycle:{}, accCustom:[], accRest:90,
  // Plyos ride on a weekday of their own rather than being welded to a session, so
  // moving the conditioning around does not drag them with it. plyoMove overrides the
  // default for one week. 0 = Monday.
  // plyoOn false drops them from the plan entirely; plyoDow is the usual weekday.
  // plyoPerWeek 2 splits the phase's contacts across two days rather than doubling them.
  plyoOn:true, plyoDow:3, plyoPerWeek:1, plyoDow2:null, plyoMove:{},
  // Which program this is. Two independent choices, composed into a week by
  // composeSlot — see 01c-templates.js.
  stempl:'operator', cproto:'black',
  // Zulu's two halves of the cluster. Empty means the template's default.
  halves:{},
  schema:0,   // 0 = written before versioning existed; migrate() brings it to SCHEMA
  waves:Object.fromEntries(Object.entries(STEMPL).map(([k,v])=>[k,v.wave.map(x=>Object.assign({},x))])),
  inc:{squat:10,bench:5,pull:5,ohp:5,wpu:2.5,dead:10},
  deloadEvery:0, testEvery:2,   // the book: retest after 2 blocks, no scheduled deload
  deload:{s:2,r:5,p:60},
  goal:'lose', sleepTarget:8, proteinPerLb:0.8, macroBump:0,
  /* Long-run goals, as opposed to `goal` just above, which is about food, and the
     per-session `aims` in the log, which are about today. Nothing in the app schedules
     off these -- they exist so the coach knows what you are training for, and so that
     you had to write it down once. `sticking` is keyed by lift. */
  programGoals:{aim:'',by:'',sticking:{},notes:''},
  rest:{squat:3,bench:3,pull:2,ohp:3,wpu:3,dead:3}, restWarn:10,
  warmRest:{squat:90,bench:90,pull:90,ohp:90,wpu:90,dead:90},
  cardio:{def:'echo'}, fobbit:'kb',
  askDeload:true, voice:false, guideAuto:true,
  // 'duck' shares the speaker with your music, 'takeover' seizes it, 'silent' is mute.
  soundMode:'duck',
  elevPer:{lb:1000,kg:190},
  se:{cluster:'bw',custom:[],rest:60},
  bbVer:{},
  plates:{lb:[45,35,25,10,5,2.5],kg:[25,20,15,10,5,2.5,1.25]},
  // A day's session moved onto another day in the same week. See 04-schedule.js.
  stack:{},
  cycleMaxes:{}, inserts:{}, skips:{}, recovery313:false
};

// Where a complaint plausibly comes from. Used to attach it to the right lifts in the
// cycle review, and spelled out there in words so the reasoning is never a mystery.
const PAIN_AT={
  shoulder:{name:'Shoulder',lifts:['bench','ohp','pull','wpu']},
  elbow:{name:'Elbow',lifts:['bench','ohp','pull','wpu']},
  wrist:{name:'Wrist or hand',lifts:['bench','ohp','pull','wpu']},
  back:{name:'Lower back',lifts:['dead','squat']},
  hip:{name:'Hip',lifts:['squat','dead']},
  knee:{name:'Knee',lifts:['squat','dead']},
  other:{name:'Somewhere else',lifts:[]}
};
const FEELS=[['easy','Easy'],['right','About right'],['hard','Hard']];
const PAINS=[['none','Nothing'],['niggle','A niggle'],['sharp','Sharp pain']];

/* Base Building — Tactical Barbell II, Block I. Eight weeks, straight from the book's
   template. Day rows are [kind, ...args]: se = circuits × reps, e = endurance minutes
   (one number, or a floor and a ceiling), ms = max strength, rec = recovery, rest. */
const BB_WEEKS=[
  [['se',3,20],['e',30],['e',30],['se',2,20],['rec'],['e',35,120],['rest']],
  [['se',3,30],['e',40],['e',40],['se',2,30],['rec'],['e',45,120],['rest']],
  [['se',3,40],['e',50],['e',50],['se',2,40],['rec'],['e',55,120],['rest']],
  [['se',1,50],['e',60],['e',60],['se',1,50],['rec'],['e',60,120],['rest']],
  [['se',3,50],['e',45,60],['e',45,60],['se',2,50],['rec'],['e',45,120],['rest']],
  [['ms'],['hic'],['rec'],['ms'],['hic'],['e',30,60],['rest']],
  [['ms'],['hic'],['rec'],['ms'],['hic'],['e',30,60],['rest']],
  [['ms'],['hic'],['rec'],['ms'],['hic'],['e',30,60],['rest']]
];
/* Tactical Barbell III's Base Building, which is not TB II's. Six weeks rather than
   eight, and only two domains: strength-endurance three times a week on alternate days,
   and endurance three times on the days between. No barbell strength week, no HIC, no
   recovery day -- the book strips it to what supports hypertrophy and nothing else.

   The reps climb within the week (10, 20, 30) rather than across it, and weeks 4 to 6
   add five percent to each. E is capped at 30 minutes and the book means the cap:
   "No more, no less." Asked outright whether you can do longer E sessions, it answers
   "The short answer is NO."  */
const BB_MASS=(()=>{
  const row=(a,b,c)=>[['se',3,a[0],a[1]],['e',30],['se',3,b[0],b[1]],['e',30],['se',3,c[0],c[1]],['e',30],['rest']];
  const early=row([10,15],[20,20],[30,25]), late=row([10,20],[20,25],[30,30]);
  return [early,early,early,late,late,late];
})();
// How long each version of the block runs. TB II's is eight weeks, TB III's is six.
const BB_LEN={standard:8,strength:8,mass:6};
// Strength-first reverses SE and Max Strength. The book says only "reverse it" and gives
// no rep scheme for the late SE weeks, so this ramp to 50 is ours, and says so on screen.
const BB_SF_SE=[[3,30],[3,40],[3,50]];
// The book's example clusters. Five to eight exercises covering the whole body.
const SE_CLUSTERS={
  mass:{name:'TB III barbell',ex:['Bench press','Squat','Romanian deadlift','Abs'],
      note:'The book’s cluster for TB III Base Building: the same lifts General Mass runs, so the base you build is the one you are about to need. It says not to use the conventional deadlift here — it is an awkward movement light and for high reps.'},
  bw:{name:'Bodyweight',ex:['Push-ups','Squats','Kipping pull-ups or inverted rows','Bicycle crunches','Dips','Back extensions'],
      note:'Add a weight vest or a pack with 5–10 lb to make it harder.'},
  bar:{name:'Barbell',ex:['Push press','Front squat','Row','Bench or floor press','Shrugs','Romanian deadlift'],
      note:'One bar, one light weight, the whole circuit. An Olympic bar with a pair of 10s is the right idea.'},
  kb:{name:'Kettlebell',ex:['Swings','Goblet squat','Renegade rows','Single-arm floor press','Kettlebell deadlift'],
      note:'Anything one arm or one leg at a time splits the reps: 30 means 15 a side.'},
  db:{name:'Dumbbell',ex:['Bench or floor press','Lunges','Rows','Dumbbell push press','Squats','Lying leg raises'],
      note:'A pair of light dumbbells for everything except the leg raises.'},
  mine:{name:'Mine',ex:[],note:'Your own five to eight, covering the whole body.'}
};
const SE_RESTS=[0,30,45,60,90,120];

/* ---------------- stored-data schema ----------------
Writes replace a whole document, and `deepMerge(clone(DEF), stored)` fills anything
missing from the defaults, so a field that quietly disappears looks exactly like one that
was never set. That is fine while every change is additive. It is not fine the first time
a field changes shape or meaning, and this is the machinery for that day.

Two halves, and the second is the one that actually protects the data:
  forwards  - old data meets a new app: run the migrations it has not had yet, once.
  backwards - new data meets an OLD app: that app sees a schema it does not know and
              stops writing instead of flattening what it cannot understand.

Adding one: append to MIGRATIONS with the next `to`, bump SCHEMA, write a test. Never
renumber or edit a shipped migration - someone's phone may be about to run it. */
const SCHEMA=7;
// Fields that are meant to be arrays. setPath builds arrays for numeric keys today, but
// data written before it did (and anything restored from an old export) can hold
// {"0":…,"1":…} instead, which is why wuList and two `Array.isArray` guards exist.
const ARRAY_FIELDS=['warmup','mobility','acc'];
function asArray(v){
  if(Array.isArray(v)||!v||typeof v!=='object') return v;
  const out=[]; for(const k of Object.keys(v)){ if(!/^\d+$/.test(k)) return v; out[+k]=v[k] }
  for(let i=0;i<out.length;i++) if(out[i]===undefined) out[i]=null;
  return out;
}
const MIGRATIONS=[
  {to:1,note:'Numeric-keyed objects in logs become arrays',run(d){
    const fix=L=>{ if(!L||typeof L!=='object') return;
      for(const f of ARRAY_FIELDS) if(f in L) L[f]=asArray(L[f]);
      for(const x of Object.values(L.lifts||{})){ if(!x||typeof x!=='object') continue;
        if('warmup' in x) x.warmup=asArray(x.warmup);
        if('sets' in x) x.sets=asArray(x.sets) }
      if(L.se&&typeof L.se==='object'){ if('done' in L.se) L.se.done=asArray(L.se.done); if('ex' in L.se) L.se.ex=asArray(L.se.ex) } };
    for(const L of Object.values(d.logs||{})) fix(L);
    for(const p of Object.values(d.programs||{})) for(const L of Object.values((p&&p.logs)||{})) fix(L);
  }},
  {to:2,note:'Accessory ticks move from positions to slots',run(d){
    // Ticks were stored by position, so editing a day's list re-pointed every old one.
    // Pin them to the slot they meant at the moment of migration and the drift stops.
    // Archived programs are left alone: their day layout is not this plan's, so the
    // reader falls back to reading the old array in place rather than guessing here.
    for(const [date,L] of Object.entries(d.logs||{})){
      if(!Array.isArray(L.acc)) continue;
      const dp=dayPlan(date), slots=dp&&dp.acc?accSlots(dp.acc):[];
      const done={};
      L.acc.forEach((v,i)=>{ if(v&&slots[i]) done[slots[i]]=true });
      L.acc=Object.keys(done).length?{done}:{};
    }
  }},
  {to:3,note:'Accessory picks are keyed by day as well as slot',run(d,p){
    // 1.53 picked one exercise per job. The same job now appears on more than one day,
    // so a pick that was {biceps:'ezcurl'} becomes that choice on every day that has it.
    const spread=o=>{
      if(!o||typeof o!=='object'||Array.isArray(o)) return null;
      if(Object.keys(o).some(k=>ACC_DAYS[k])) return o;         // already per day
      const out={};
      for(const day of Object.keys(ACC_DAYS)){
        for(const [slot,id] of Object.entries(o)) if(accSlots(day).includes(slot)) (out[day]||(out[day]={}))[slot]=id;
      }
      return out;
    };
    const pk=spread(p.accPick); if(pk) p.accPick=pk;
    const cy=p.accCycle;
    if(cy&&typeof cy==='object') for(const [c,v] of Object.entries(cy)){ const n=spread(v); if(n) cy[c]=n }
  }},
  {to:4,note:'Warm-up rests shorter than a minute become 90 s',run(d,p){
    // 30 s and 45 s used to be on offer and are no longer: too short between ramp singles.
    // Anything set that low was almost certainly the old default rather than a choice.
    const w=p.warmRest;
    if(w&&typeof w==='object') for(const [k,v] of Object.entries(w)) if(+v<60) w[k]=90;
  }},
  {to:5,note:'The wave moves under the template that owns it',run(d,p){
    // plan.wave was global because Operator was the only template. Fighter's wave is a
    // different shape, so an edited wave belongs to the program it was edited for.
    if(Array.isArray(p.wave)&&p.wave.length){
      p.waves=Object.assign({},p.waves,{[STEMPL[p.stempl]?p.stempl:'operator']:p.wave});
    }
    delete p.wave;
  }},
  {to:6,note:'Silent timers become a three-way sound choice',run(d,p){
    // The old setting was a yes/no: beeps, or your music. Both at once is what people
    // actually want, and ducking gives it whenever the ring switch is on.
    if(!p.soundMode) p.soundMode=p.quietTimer?'silent':'duck';
    delete p.quietTimer;
  }},
  {to:7,note:'A week of slots becomes sessions with dates',run(d,p){
    /* `order` was a permutation of seven slots over seven days and `stack` was a
       separate map for the one case it could not express. Both collapse into `at`,
       which says where a session happens and nothing else. A permutation is just the
       special case where every session is somewhere in its own week.

       Order first, then stack, because a stacked day was recorded against the day as
       the order had already arranged it. */
    const at=Object.assign({},p.at);
    const slotOnDay={};
    for(const [mon,ord] of Object.entries(p.order||{})){
      if(!Array.isArray(ord)||ord.length!==7) continue;
      slotOnDay[mon]={};
      for(let i=0;i<7;i++){
        const sl=ord[i]; if(!(sl>=0&&sl<7)) continue;
        slotOnDay[mon][i]=sl;
        if(sl!==i) at[mon+':'+sl]=addDays(mon,i);
      }
    }
    for(const [from,to] of Object.entries(p.stack||{})){
      if(typeof to!=='string') continue;
      const mon=mondayOf(from), i=dow(from);
      const sl=(slotOnDay[mon]&&slotOnDay[mon][i]!=null)?slotOnDay[mon][i]:i;
      at[mon+':'+sl]=to;
    }
    if(Object.keys(at).length) p.at=at;
    delete p.order; delete p.stack;
  }},
];

/* ---------------- warm-up and mobility library ---------------- */
// The same treatment the plyometric drills get: what it is for, how to set it up, what
// good looks like, and the ways it usually goes wrong. Most of these are done badly far
// more often than they are done wrong-exercise, so the cues matter more than the names.
const MLIB={
  raise:{name:'Raise the temperature',
    setup:'Any steady machine or an easy jog. Nothing that needs a decision.',
    exec:'Four to five minutes at a pace you could hold a conversation at, building slightly. You want warm, not tired.',
    cues:'Finish breathing a little deeper and faintly warm. If you are sweating hard you have gone too far.',
    errors:'Treating it as conditioning. Skipping it because the gym is already warm — the point is blood flow and joint fluid, not air temperature.'},
  breath9090:{name:'90/90 breathing',
    setup:'On your back, feet flat on a bench or against a wall, hips and knees at 90 degrees. Low back flat.',
    exec:'Breathe in through the nose for four, out through the mouth for six to eight, emptying completely. Five breaths.',
    cues:'The ribs should move down and in on the exhale, not up. Push gently through the heels to keep the pelvis tucked.',
    errors:'Arching the low back on the inhale. Rushing the exhale — the long out-breath is what settles the nervous system before a heavy session.',
    note:'Thirty seconds, and it is the difference between walking in distracted and starting the first warm-up set present.'},
  catcow:{name:'Cat / cow',
    setup:'On hands and knees, hands under shoulders, knees under hips.',
    exec:'Round the spine one segment at a time from the tailbone up, then reverse into extension the same way. Slow, eight to ten reps.',
    cues:'Move the whole spine, not just the lower back. Breathe out as you round, in as you extend.',
    errors:'Hinging at one point and letting the rest stay rigid. Going fast enough that it becomes a rock rather than a stretch.'},
  thread:{name:'Thread the needle',
    setup:'On hands and knees. One arm reaches up toward the ceiling, eyes following the hand.',
    exec:'Thread that arm under the opposite shoulder, reaching across until the shoulder and ear rest toward the floor, then open back up. Six to eight per side.',
    cues:'Rotate from the ribs, not the neck. Keep the hips square and over the knees the whole time.',
    errors:'Letting the hips swing away to get more range. Twisting the head instead of the thoracic spine.'},
  openbook:{name:'Open book',
    setup:'On your side, knees stacked and bent at 90 degrees, arms straight out in front, palms together. A foam roller or cushion under the top knee keeps the hips honest.',
    exec:'Keeping the knees pinned, open the top arm in a wide arc toward the floor behind you and follow it with your eyes. Hold a breath at the end, then return. Eight per side.',
    cues:'The knees staying down is the exercise. Exhale into the last few degrees rather than forcing it.',
    errors:'Letting the top knee lift, which turns it into a lumbar twist. Snapping back rather than controlling the return.'},
  quadtspine:{name:'Quadruped t-spine extension',
    setup:'On hands and knees, one hand behind the head, elbow out.',
    exec:'Rotate the elbow down toward the opposite wrist, then open it up toward the ceiling, opening the chest. Eight per side.',
    cues:'Sit back toward the heels a little first — it locks the low back out and makes the mid-back do the work.',
    errors:'Arching the lower back to fake the range. Letting the supporting elbow collapse.'},
  hip9090:{name:'90/90 hip switches',
    setup:'Sitting on the floor, one leg bent in front at 90 degrees, the other out to the side at 90. Hands behind you at first.',
    exec:'Keeping the feet where they are, drop both knees across to the other side and sit up tall. Ten switches.',
    cues:'Lead with the knees, not the torso. Chest stays tall — hands on the floor behind you is fine while the hips are tight.',
    errors:'Rolling the pelvis back and rounding the spine to get down. Dropping the knees with a bang rather than lowering them.'},
  lean9090:{name:'90/90 lean-forward hold',
    setup:'In the 90/90 position, front shin roughly parallel to your chest.',
    exec:'Sit tall, then hinge forward over the front shin and hold for 20 to 45 seconds, breathing.',
    cues:'Hinge at the hip with a long spine. The stretch should be in the outside of the front hip, not the knee.',
    errors:'Rounding over instead of hinging. Any pain on the inside of the front knee — open the angle until there is none.'},
  couch:{name:'Couch stretch',
    setup:'Back foot up on a bench, sofa or against a wall, knee on a pad close to the base. Front foot planted.',
    exec:'Squeeze the back glute and tuck the pelvis under, then come up tall. Hold 60 to 90 seconds per side, breathing.',
    cues:'The pelvic tuck is the whole exercise. If you can lean back comfortably straight away, you have not tucked.',
    errors:'Arching the low back to get upright, which feels like more stretch and is less. Knee pain from being too far from the wall or on a hard floor.',
    note:'Three lifting days plus riding is a lot of hip flexor in a shortened position. This is the single most valuable thing in the mobility list.'},
  frog:{name:'Frog stretch',
    setup:'Knees wide on a padded floor, shins in line with the knees, ankles flexed, forearms down.',
    exec:'Rock the hips gently back toward the heels and forward again, ten slow rocks, going a little further as it opens.',
    cues:'Keep the low back neutral and let the movement come from the hips. Rock, do not sit and strain.',
    errors:'Pushing into a static end-range hold on cold adductors. Letting the knees slide wider than is comfortable.'},
  wgs:{name:'World’s greatest stretch',
    setup:'From a long lunge, front foot flat, back leg straight, hands on the floor inside the front foot.',
    exec:'Drop the back of the front hip toward the floor, then rotate the inside arm up to the ceiling and follow it with your eyes. Five per side.',
    cues:'Back knee off the floor and back leg long. The rotation comes from the mid-back with the hips stable.',
    errors:'Letting the back knee drop, which removes the hip flexor part. Rotating with a bent back leg and calling it done.'},
  legswing:{name:'Leg swings',
    setup:'Hold something solid. Stand tall on one leg.',
    exec:'Swing the free leg front to back ten times, then side to side ten times, building range gradually. Both legs.',
    cues:'Stay upright and let the leg swing from a relaxed hip. Range builds over the set — the first swing is not the biggest.',
    errors:'Throwing the leg to its end range on rep one. Twisting the whole torso to get height.'},
  bandpull:{name:'Band pull-aparts and dislocates',
    setup:'A light band held at shoulder width for pull-aparts, and wide for dislocates. Wide enough that nothing pinches.',
    exec:'Fifteen pull-aparts, squeezing the shoulder blades together with straight arms, then fifteen slow dislocates taking the band overhead and behind.',
    cues:'Keep the ribs down and the neck long. Widen the grip on dislocates until the path is smooth.',
    errors:'Shrugging on the pull-aparts. A band so heavy the dislocates turn into a shoulder jam — lighter and wider is better.'},
  glutebridge:{name:'Glute bridge or bodyweight squat',
    setup:'On your back, feet flat and close to the hips — or standing, for squats.',
    exec:'Ten reps. Bridges: drive through the heels and squeeze the glutes at the top. Squats: full depth, controlled.',
    cues:'Finish the bridge with the glutes, not the low back. The squats are a rehearsal of your pattern, not a set.',
    errors:'Hyperextending the lower back at the top of the bridge. Rushing — this is the last thing before the bar, so it should look like what you are about to do.'},
  fig4:{name:'Figure-4 glute stretch',
    setup:'On your back, one ankle crossed over the opposite thigh just above the knee.',
    exec:'Reach through and pull the supporting thigh toward you until you feel it in the crossed glute. Hold 45 seconds per side.',
    cues:'Keep the crossed knee pushed gently away. Head and shoulders stay down.',
    errors:'Pulling on the crossed knee itself. Lifting the head and neck to get closer.'},
  childlat:{name:'Child’s pose with lat reach',
    setup:'Kneeling, sitting back toward the heels, arms extended in front.',
    exec:'Walk both hands to one side until you feel it down the opposite side of the ribs and under the armpit. Hold 45 seconds per side.',
    cues:'Keep the hips back over the heels and press the opposite ribs toward the floor.',
    errors:'Letting the hips drift forward, which turns it into a shoulder stretch instead of a lat one.'},
  deadhang:{name:'Dead hang',
    setup:'A bar you can hang from with the feet clear, or knees bent if it is low.',
    exec:'Hang relaxed for 20 to 30 seconds, letting the shoulders come up around the ears and the spine lengthen.',
    cues:'Let it be passive. Breathe. Grip is the usual limit, not the shoulders.',
    errors:'Holding an active shrug-down the whole time — that is a different exercise. Dropping off rather than stepping down.',
    note:'The cheapest spinal decompression there is, and it doubles as grip work on a deadlift day.'},
  fold:{name:'Standing forward fold',
    setup:'Feet hip width, knees soft, not locked.',
    exec:'Hinge and let the upper body hang, hands wherever they reach. Hold 45 to 60 seconds, breathing out into it.',
    cues:'Soft knees and a long spine beat straight legs and a rounded back. Let gravity do it.',
    errors:'Locking the knees and bouncing. Chasing the floor with the fingers at the cost of the hamstrings doing the work.'},
  hamstring:{name:'Supine hamstring stretch',
    setup:'On your back, a strap, belt or towel around the foot of one leg. A doorway works instead.',
    exec:'Raise the leg with the knee nearly straight until you feel the hamstring, keeping the other leg flat. Hold 45 seconds per side.',
    cues:'Keep the opposite leg on the floor and the pelvis down. A slight knee bend is fine.',
    errors:'Letting the other leg creep up, which hides the range. Pulling into pain behind the knee rather than mid-belly stretch.'},
  quadstand:{name:'Standing quad stretch',
    setup:'Hold something for balance, heel pulled to the backside.',
    exec:'Tuck the pelvis, then draw the knee back and down. Hold 45 seconds per side.',
    cues:'Squeeze the glute on the side you are stretching. Knees stay together.',
    errors:'Arching the back and calling it a stretch. Yanking the ankle into the backside, which is a knee complaint waiting to happen.'},
  calfstraight:{name:'Straight-leg calf stretch',
    setup:'Hands on a wall, one leg back, heel down, both feet pointing forward.',
    exec:'Keep the back knee straight and press the hips forward until the upper calf stretches. Hold 45 seconds per side.',
    cues:'Back heel stays glued down and the back foot points straight ahead, not out.',
    errors:'Letting the heel lift, which removes the stretch. Turning the foot out to fake range.'},
  calfbent:{name:'Bent-knee calf stretch',
    setup:'Same position as the straight-leg version.',
    exec:'Bend the back knee while keeping the heel down. The stretch drops lower, near the Achilles. Hold 45 seconds per side.',
    cues:'A small bend is enough. This one targets the soleus, which is what a plyo session beats up.',
    errors:'Bending so far the heel lifts. Skipping it because the straight-leg version felt like enough — they are different muscles.'},
  kneewall:{name:'Knee-to-wall ankle mobilization',
    setup:'Stand facing a wall, toes a few inches back from it, foot pointing straight at it.',
    exec:'Drive the knee forward over the middle of the foot until it touches the wall, keeping the heel down. Ten reps per side, moving the foot back as it improves.',
    cues:'Heel stays down and the knee tracks over the second toe, not inward.',
    errors:'Letting the heel lift or the arch collapse. Measuring progress by distance alone while losing the heel.',
    note:'Ankle range is the quietest limiter on squat depth and the most common reason a landing collapses.'},
  footroll:{name:'Foot and arch roll',
    setup:'A lacrosse or tennis ball under the arch of a bare foot, seated or standing.',
    exec:'Roll slowly heel to toe for 60 seconds per side, pausing a few seconds on sore spots.',
    cues:'Slow enough to feel individual spots. Pressure you can breathe through, not pressure you brace against.',
    errors:'Rolling fast, which does nothing. Standing full weight on a hard ball on a sore foot.'},
  seatedfold:{name:'Seated forward fold',
    setup:'Sitting with legs straight out, sit bones under you. Sit on a folded towel if the low back rounds immediately.',
    exec:'Hinge forward with a long spine, reaching for the feet, and hold 45 to 60 seconds.',
    cues:'Lead with the chest, not the head. The last thing to round is the lower back.',
    errors:'Rounding from the start and pulling on the toes. Bouncing.'},
  pigeon:{name:'Pigeon',
    setup:'Front shin across in front of you, back leg long behind. A cushion under the front hip if it does not reach the floor.',
    exec:'Square the hips forward and fold over the front shin. Hold 60 to 90 seconds per side.',
    cues:'Hips square is what makes it work. Back toes pointed straight back, not out to the side.',
    errors:'Collapsing onto the front hip, which twists the knee. Ignoring front-knee pain — use figure-4 on your back instead, it does the same job.'},
  foamtspine:{name:'Thoracic extension over a foam roller',
    setup:'Roller across the mid-back, hands behind the head, hips down or lifted.',
    exec:'Extend back over the roller, breathe out at the end, come up, move the roller an inch and repeat. Ten slow reps up the mid-back.',
    cues:'Stay above the bottom of the ribs — never extend over the low back. The exhale is what gets the range.',
    errors:'Rolling up and down fast. Flaring the ribs and arching the lumbar spine instead of extending the thoracic one.'},
  breathwall:{name:'Legs up the wall breathing',
    setup:'On your back with the legs resting up a wall, backside close to it.',
    exec:'Two to three minutes of slow nasal breathing, long exhales.',
    cues:'Nothing to achieve. Let the legs be heavy and make the out-breath longer than the in-breath.',
    errors:'Checking your phone. Treating it as a stretch and pushing the hamstrings.',
    note:'The best-value two minutes on an off day: it is the one block that is purely about coming down.'},
  /* Agile 8. The descriptions follow DeFranco's own text where he gives one. For the
     rollovers, the fire hydrants and the mountain climbers he shows the movement in a
     video instead of describing it, so those three are the standard form of a common
     movement and their notes say so rather than putting words in his mouth. */
  a8itb:{name:'Foam roll IT band',
    setup:'On your side on the roller, the outer thigh on it, top leg forward for balance and weight on the forearm.',
    exec:'Start just under the hip and roll up and down to mid-thigh ten to fifteen times. Then roll from mid-thigh down to the outside of the knee, another ten to fifteen. Work the tight spots.',
    cues:'Slow. The roller should move about an inch a second, not sweep the whole leg.',
    errors:'Rolling fast enough that nothing changes. Rolling straight over the knee or the hip bone rather than stopping short of both.'},
  a8add:{name:'Foam roll adductors',
    setup:'Face down with the roller under the inside of one thigh, that leg out to the side at about ninety degrees.',
    exec:'Same method as the IT band, on the inner thigh. Start just below the groin crease, roll up and down to mid-thigh ten to fifteen times, then from mid-thigh to the inside of the knee for another ten to fifteen.',
    cues:'Let the leg be heavy. Shift your weight onto the roller rather than pressing with the arms.',
    errors:'Staying too far from the groin, which is usually where the tight part is.'},
  a8glute:{name:'Glute and piriformis release, tennis ball',
    setup:'Sitting on the ball on one cheek, tilted slightly onto that side, with that leg crossed over the other knee.',
    exec:'Roll around for about thirty seconds, then switch sides.',
    cues:'Crossing the leg is what opens the glute up to the ball. Hunt for the spot rather than rolling evenly.',
    errors:'Sitting square, which puts the ball on bone rather than muscle.',
    note:'DeFranco’s whole note on this one: “Feel free to cry.”'},
  a8roll:{name:'Rollovers into V-sits',
    setup:'Sitting on the floor, knees tucked, hands on the floor behind you.',
    exec:'Roll backwards onto your shoulders and take the knees to the ears, then roll forward into a straddle and reach for the toes. Ten reps, continuous.',
    cues:'Use the momentum of the roll to get into the straddle rather than hauling yourself up.',
    errors:'Rolling onto the neck instead of the upper back. Going so fast the forward reach never happens.',
    note:'DeFranco shows this one in a video rather than describing it, so this is the standard movement, not his wording.'},
  a8hydrant:{name:'Fire hydrant circles',
    setup:'On hands and knees, back flat, weight even.',
    exec:'Lift one knee out to the side and draw a circle with it, ten forward and ten backward, then the other leg.',
    cues:'Make the circle at the hip. The knee stays bent throughout.',
    errors:'Rotating the whole torso to get a bigger circle. Letting the low back arch.',
    note:'DeFranco shows this one in a video rather than describing it, so this is the standard movement, not his wording.'},
  a8mtn:{name:'Mountain climbers',
    setup:'A push-up position, hands under the shoulders, body in a line.',
    exec:'Drive one knee to the chest and switch feet, twenty in total. Brisk, not a sprint — this is a warm-up.',
    cues:'Hips stay low and level. The shoulders should not travel back over the hands.',
    errors:'Letting the hips ride up. Treating it as conditioning and arriving at the bar out of breath.',
    note:'DeFranco shows this one in a video rather than describing it, so this is the standard movement, not his wording.'},
  a8groiner:{name:'Groiners',
    setup:'A push-up position.',
    exec:'Jump both feet up outside the hands, then back. Ten reps, and hold the last one for ten seconds.',
    cues:'In the hold, use your upper arms to push the knees outward while you drop your butt down. That is DeFranco’s own cue.',
    errors:'Landing with the feet behind the hands, which gives you none of the hip opening.'},
  a8hipflex:{name:'Static hip flexor stretch',
    setup:'Half-kneeling, back knee on a pad, front foot flat, and tuck the pelvis under before you start.',
    exec:'Three holds of ten seconds on one leg, then all three on the other. Finish one side before switching.',
    cues:'The stretch comes from the pelvic tuck and squeezing the back glute, not from pushing the hips forward.',
    errors:'Arching the low back to feel more. Alternating sides instead of doing three in a row, which is not what the routine asks for.'},
};
// The names in WARMUP and MOB are editable text, so entries are matched by a normalized
// name through this table. A test asserts every built-in item still resolves.
function mnorm(s){return String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9/]+/g,' ').trim()}
const MLIB_ALIAS={};
(function(){
  const pairs=[
    ['bike rower or easy jog','raise'],['90/90 breathing back feet on bench or wall','breath9090'],
    ['cat / cow','catcow'],['cat / cow slow','catcow'],
    ['thread the needle','thread'],['thread the needle or open book','thread'],
    ['open book side lying rotation','openbook'],['quadruped t spine extension','quadtspine'],
    ['90/90 hip switches seated','hip9090'],['90/90 switches and lean holds','hip9090'],
    ['90/90 lean forward hold','lean9090'],['couch stretch','couch'],
    ['frog stretch gentle rocking','frog'],['worlds greatest stretch','wgs'],
    ['leg swings both directions','legswing'],['band pull aparts shoulder dislocates','bandpull'],
    ['glute bridge or bodyweight squat','glutebridge'],['figure 4 glute stretch','fig4'],
    ['childs pose with lat reach','childlat'],['dead hang from the bar','deadhang'],['dead hang','deadhang'],
    ['foam roll it band','a8itb'],['foam roll adductors','a8add'],
    ['glute and piriformis release tennis ball','a8glute'],['rollovers into v sits','a8roll'],
    ['fire hydrant circles','a8hydrant'],['mountain climbers','a8mtn'],
    ['groiners','a8groiner'],['static hip flexor stretch','a8hipflex'],
    ['standing forward fold soft knees','fold'],['supine hamstring stretch strap or doorway','hamstring'],
    ['standing quad stretch','quadstand'],['straight leg calf stretch against a wall','calfstraight'],
    ['straight leg calf stretch gastroc','calfstraight'],['bent knee calf stretch soleus','calfbent'],
    ['knee to wall ankle mobilization','kneewall'],
    // The app said "mobilisation" until 1.92. Anyone who had edited their mobility list
    // has that spelling saved in it, so it still has to resolve.
    ['knee to wall ankle mobilisation','kneewall'],
    ['foot / arch roll on a ball','footroll'],
    ['seated forward fold','seatedfold'],['pigeon or figure 4','pigeon'],
    ['thoracic extension over a foam roller','foamtspine'],
    ['diaphragmatic breathing legs up the wall','breathwall']
  ];
  for(const [k,v] of pairs) MLIB_ALIAS[k]=v;
})();
function mlibId(name){const n=mnorm(name);return MLIB_ALIAS[n]||(MLIB[n]?n:null)}
function mlibEntry(name){const id=mlibId(name);return id?MLIB[id]:null}

/* ---------------- accessories ----------------
Accessories used to be lines of text with a tick box, and the ticks were stored by
position: edit the list in Setup and every old checkmark silently pointed at a different
movement. This replaces that with slots.

A **slot** is the job (Horizontal pull, Biceps, Carry). An **exercise** fills it. You pick
the exercise per cycle, the way cluster lifts work, and you can swap one for a single
session when the barbell is taken. Everything is logged against the slot, so nothing
re-points when a list changes, and against the exercise, so a year from now the log still
says which curl it was.

The catalogue is here; your own additions live in `plan.accCustom` and sync with the rest
of the plan. There is no separate admin screen: one person uses this app, and adding a
name to a list is not worth a second login. */

const ASLOT={
  hpull: {name:'Horizontal pull',  why:'Balances the pressing, and sits on the overhead day for that reason. The one accessory worth never skipping.'},
  rdelt: {name:'Rear delt / upper back', why:'Shoulder health under a lot of benching.'},
  core:  {name:'Core',             why:'Anti-rotation and anti-extension, not sit-ups.'},
  biceps:{name:'Biceps',           why:'Elbow health as much as size, with this much pulling.'},
  triceps:{name:'Triceps',         why:'Lockout strength that carries to the bench.'},
  spress:{name:'Shoulder press',   why:'A lighter overhead push than the main lift, on the day the main lift is not pressing overhead.'},
  // Kept as `delts` rather than renamed: everything already logged and picked is keyed by
  // it, and its catalogue was only ever lateral raises, so the id still means what it did.
  delts: {name:'Lateral raise',    why:'Side delts, which pressing alone misses. Away from the overhead press day.'},
  pullup:{name:'Pull-up progression', why:'Whatever rung you are on. The app prescribes it.'},
  sleg:  {name:'Single-leg',       why:'Catches the imbalance a bar hides.'},
  pchain:{name:'Posterior chain',  why:'Hamstrings and back, away from a maximal pull.'},
  carry: {name:'Carry / grip',     why:'Grip, trunk and a lot of general hardiness, cheaply. Last, because a fried grip makes everything after it worse \u2014 core work included.'},
};

// gear: what you need, so the picker reads usefully when the rack is busy.
const ALIB={
  csrow:   {slot:'hpull', name:'Chest-supported row',       gear:'Bench + dumbbells, or a machine'},
  bbrow:   {slot:'hpull', name:'Barbell bent-over row',     gear:'Barbell'},
  dbrow:   {slot:'hpull', name:'Single-arm dumbbell row',   gear:'Dumbbell + bench'},
  cablerow:{slot:'hpull', name:'Seated cable row',          gear:'Cable'},
  invrow:  {slot:'hpull', name:'Inverted row',              gear:'Bar or rings'},
  tbar:    {slot:'hpull', name:'T-bar row',                 gear:'T-bar or landmine'},
  kbrow:   {slot:'hpull', name:'Kettlebell row',            gear:'Kettlebell'},

  facepull:{slot:'rdelt', name:'Face pull',                 gear:'Cable or band'},
  revfly:  {slot:'rdelt', name:'Reverse fly',               gear:'Dumbbells'},
  pullapart:{slot:'rdelt',name:'Band pull-apart',           gear:'Band'},
  prone_y: {slot:'rdelt', name:'Prone Y-raise',             gear:'Bench, light plates'},

  pallof:  {slot:'core',  name:'Pallof press',              gear:'Cable or band'},
  hangknee:{slot:'core',  name:'Hanging knee raise',        gear:'Bar'},
  hangleg: {slot:'core',  name:'Hanging leg raise',         gear:'Bar'},
  abwheel: {slot:'core',  name:'Ab wheel',                  gear:'Wheel'},
  plank:   {slot:'core',  name:'Plank',                     gear:'Nothing'},
  sideplank:{slot:'core', name:'Side plank',                gear:'Nothing'},
  copen:   {slot:'core',  name:'Copenhagen plank',          gear:'Bench or box'},
  deadbug: {slot:'core',  name:'Dead bug',                  gear:'Nothing'},
  cablecr: {slot:'core',  name:'Cable crunch',              gear:'Cable'},
  // A circuit rather than a single movement, so it carries its own prescription. From a
  // book that is not in the app's library: recorded exactly as it was given, with
  // nothing added -- no tempo, no rest, no progression, because none was given.
  abtriad: {slot:'core',  name:'Ab triad',                  gear:'Bar',
    rx:'3 to 5 rounds, back to back: 5 hanging leg raises, 5 hanging knee raises, 5 toes-to-bar. Log each round as a set.',
    src:'From a book that is not in this app\u2019s library, recorded as you gave it.'},

  bbcurl:  {slot:'biceps',name:'Barbell curl',              gear:'Barbell'},
  ezcurl:  {slot:'biceps',name:'EZ-bar curl',               gear:'EZ bar'},
  dbcurl:  {slot:'biceps',name:'Dumbbell curl',             gear:'Dumbbells'},
  hammer:  {slot:'biceps',name:'Hammer curl',               gear:'Dumbbells'},
  inccurl: {slot:'biceps',name:'Incline dumbbell curl',     gear:'Dumbbells + bench'},
  cablecurl:{slot:'biceps',name:'Cable curl',               gear:'Cable'},
  chinup:  {slot:'biceps',name:'Chin-up',                   gear:'Bar'},

  pushdown:{slot:'triceps',name:'Triceps pushdown',         gear:'Cable'},
  skull:   {slot:'triceps',name:'Skullcrusher',             gear:'EZ bar or dumbbells'},
  jmpress: {slot:'triceps',name:'JM press',                 gear:'Barbell or EZ bar'},
  ohext:   {slot:'triceps',name:'Overhead triceps extension',gear:'Dumbbell, cable or band'},
  cgbench: {slot:'triceps',name:'Close-grip bench',         gear:'Barbell'},
  dip:     {slot:'triceps',name:'Dip',                      gear:'Bars'},
  kickback:{slot:'triceps',name:'Triceps kickback',         gear:'Dumbbells'},

  dbohp:   {slot:'spress',name:'Dumbbell shoulder press',   gear:'Dumbbells'},
  seatedohp:{slot:'spress',name:'Seated dumbbell press',    gear:'Dumbbells + bench'},
  arnold:  {slot:'spress',name:'Arnold press',              gear:'Dumbbells'},
  landmine:{slot:'spress',name:'Landmine press',            gear:'Landmine or a barbell in a corner'},
  pushpress:{slot:'spress',name:'Push press',               gear:'Barbell'},
  machohp: {slot:'spress',name:'Machine shoulder press',    gear:'Machine'},
  kbpress: {slot:'spress',name:'Single-arm kettlebell press',gear:'Kettlebell'},
  pike:    {slot:'spress',name:'Pike push-up',              gear:'Nothing'},

  latraise:{slot:'delts', name:'Dumbbell lateral raise',    gear:'Dumbbells'},
  cablelat:{slot:'delts', name:'Cable lateral raise',       gear:'Cable'},
  machlat: {slot:'delts', name:'Machine lateral raise',     gear:'Machine'},
  uprow:   {slot:'delts', name:'Upright row',               gear:'Barbell or dumbbells'},
  bandlat: {slot:'delts', name:'Band lateral raise',        gear:'Band'},

  pu_prog: {slot:'pullup',name:'Pull-up progression',       gear:'Bar'},
  pu_band: {slot:'pullup',name:'Band-assisted pull-up',     gear:'Bar + band'},
  pu_neg:  {slot:'pullup',name:'Negative pull-up',          gear:'Bar'},
  pu_wt:   {slot:'pullup',name:'Weighted pull-up',          gear:'Bar + belt'},

  rfess:   {slot:'sleg',  name:'Rear-foot-elevated split squat', gear:'Dumbbells + bench'},
  lunge:   {slot:'sleg',  name:'Walking lunge',             gear:'Dumbbells'},
  revlunge:{slot:'sleg',  name:'Reverse lunge',             gear:'Dumbbells or barbell'},
  stepup:  {slot:'sleg',  name:'Step-up',                   gear:'Box + dumbbells'},
  cossack: {slot:'sleg',  name:'Cossack squat',             gear:'Nothing, or a light weight'},
  slrdl:   {slot:'sleg',  name:'Single-leg Romanian deadlift', gear:'Dumbbell or kettlebell'},

  rdl:     {slot:'pchain',name:'Romanian deadlift',         gear:'Barbell or dumbbells'},
  revhyper:{slot:'pchain',name:'Reverse hyper',             gear:'Reverse hyper, or a high bench'},
  backext: {slot:'pchain',name:'Back extension',            gear:'Bench or GHD'},
  hamcurl: {slot:'pchain',name:'Hamstring curl',            gear:'Machine'},
  goodmorn:{slot:'pchain',name:'Good morning',              gear:'Barbell'},
  ghr:     {slot:'pchain',name:'Glute-ham raise',           gear:'GHD'},
  nordic:  {slot:'pchain',name:'Nordic curl',               gear:'A partner or a strap'},
  kbswing: {slot:'pchain',name:'Kettlebell swing',          gear:'Kettlebell'},

  farmer:  {slot:'carry', name:'Farmer carry',              gear:'Dumbbells or handles'},
  suitcase:{slot:'carry', name:'Suitcase carry',            gear:'One dumbbell'},
  trapcarry:{slot:'carry',name:'Trap-bar carry',            gear:'Trap bar'},
  deadhang:{slot:'carry', name:'Dead hang',                 gear:'Bar'},
  pinch:   {slot:'carry', name:'Plate pinch',               gear:'Plates'},
  sandbag: {slot:'carry', name:'Sandbag carry',             gear:'Sandbag'},
};

// Which slots each lifting day fills, and what fills them unless you say otherwise.
// Same count per day as the lists these replaced; arms split across the two press days.
// Shoulders sit on OP1, away from whichever day the overhead press lands on, and the
// row moves to OP2 to balance it. Rear delts stay with the shoulders: that slot is
// shoulder health, not back volume.
// Posterior chain twice a week, not once: Operator squats three times and deadlifts on
// one of them, so a single hamstring job on Friday was the thinnest part of the split.
// It goes first on Monday, before the small stuff, because it is the biggest thing there.
const ACC_DAYS={ mon:['pchain','spress','rdelt','core','biceps','triceps'], wed:['hpull','delts','pullup','biceps','triceps'], fri:['sleg','pchain','biceps','triceps','carry'],
  // Fighter lifts twice a week, so the same jobs have to fit across two days instead of
  // three. Like the three-day split, this is the app's arrangement and not the book's:
  // TB1 prescribes no accessory work, it only says Fighter leaves less room for it.
  f1:['spress','hpull','core','biceps','triceps'], f2:['sleg','pchain','pullup','delts','carry'],
  // Zulu's halves run twice each, so the same two lists cover four days. The book says
  // Zulu leaves the most room for assistance work, so these are the fullest.
  // Zulu's A day is squat and bench with no hinge in it, and B already deadlifts, so
  // the posterior chain goes on A — which Zulu runs twice a week anyway.
  z1:['pchain','spress','rdelt','core','biceps','triceps'], z2:['hpull','delts','pullup','sleg','carry'],
  // Fighter HT is deliberately spare: the book says bodyweight finishers are fine and
  // anything more means you picked the wrong template.
  h1:['pullup','biceps','triceps'], h2:['core','rdelt'],
  // Grey Man's two supplementary clusters. The book says four to six exercises, split
  // in two, and that what goes in them is yours — these are a starting split.
  // Same reasoning for Grey Man's A day, and single-leg comes out to make room: the
  // book caps the supplementary clusters at "no more than four to six" exercises, and
  // six is what these are. Squat is already on this day, so single-leg was the most
  // redundant of the four.
  gm1:['pchain','spress','triceps'], gm2:['hpull','biceps','core'],
  // Specificity's H cluster: six to twelve exercises for Alpha, eight to sixteen for
  // Bravo, split in half and each half trained on its own day. The book leaves what
  // goes in them entirely to you and gives sample clusters; this is a starting split,
  // and like every accessory split here it is the app's, not the book's.
  sp1:['pchain','spress','rdelt','core','biceps','triceps'], sp2:['hpull','delts','pullup','sleg','carry','core'],
  // Back Break. Squat-only carries the posterior chain on the two non-squat days with
  // the deadlift-style work the book names (farmer carries, swings, plank and shank);
  // deadlift-only does the reverse with squat-pattern work. Which slots they map to is
  // the app's, as every accessory split here is.
  bb1:['pchain','carry','core'], bb2:['delts','biceps','triceps'],
  bb3:['sleg','core','delts'],   bb4:['hpull','biceps','triceps'],
  // Mass is spare on purpose: the book says weighted pull-ups cover the arms well
  // enough that you need not train them separately, and the deadlift day is its own
  // posterior chain. These are the app's, as every accessory split here is.
  ms1:['core','triceps'], ms2:['sleg','carry'],
  // Gladiator is high volume and high frequency and the book says use it sparingly, so
  // there is little room for anything else. Two jobs a day, and the deadlift day covers
  // the posterior chain on its own.
  gl1:['core','triceps'], gl2:['biceps','carry'] };
const ACC_DEF={ hpull:'csrow', rdelt:'facepull', core:'pallof', biceps:'bbcurl', triceps:'pushdown',
  spress:'dbohp', delts:'latraise', pullup:'pu_prog', sleg:'rfess', pchain:'rdl', carry:'farmer' };

/* ---------------- reading the choice ---------------- */

// Your own exercises, stored in the plan so they reach every device.
// Anything a person added before the catalogue was shared. Still resolved so nobody's
// choice breaks; no longer addable, because the list is curated now.
function accCustom(){ const a=(plan.accCustom||[]); return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name&&ASLOT[x.slot]):[] }
function accShared(){ return Array.isArray(catalog)?catalog.filter(x=>x&&x.id&&ASLOT[x.slot]):[] }

// Everything that can be resolved, hidden ones included. A retired movement still has
// to have a name: someone may be mid-cycle with it, and showing them a blank row or
// silently swapping their exercise would be worse than letting them finish with it.
function accAll(){
  const out=Object.assign({},ALIB);
  for(const x of accShared()){
    if(x.hidden&&!x.name){ if(out[x.id]) out[x.id]=Object.assign({},out[x.id],{hidden:true}); continue }
    out[x.id]={slot:x.slot,name:x.name,gear:x.gear||'',shared:true,hidden:!!x.hidden};
  }
  for(const x of accCustom()) if(!out[x.id]) out[x.id]={slot:x.slot,name:x.name,gear:x.gear||'',mine:true};
  return out;
}
function accEx(id){ return accAll()[id]||null }
function accName(id){ const e=accEx(id); return e?e.name:'' }
// What to offer in a picker: everything not retired, plus whatever is already chosen
// here so the dropdown still shows the right thing.
function accFor(slot,keep){
  const all=accAll();
  return Object.keys(all).filter(k=>all[k].slot===slot&&(!all[k].hidden||k===keep));
}

// The slots a day fills. Editable per day, falling back to the defaults above.
function accSlots(day){
  const a=(plan.accSlots||{})[day];
  return Array.isArray(a)?a.filter(s=>ASLOT[s]):(ACC_DAYS[day]||[]);
}

// What fills a slot, on a given day. Keyed by day as well as slot, because the same job
// turns up on more than one Operator day and there is no reason the same curl has to do
// it every time. Picked per cycle, like the cluster lifts: `accCycle[n]` is this block's
// choice and `accPick` is what later blocks start on.
function accPickFor(day,slot,cycle){
  const c=cycle!=null?(((plan.accCycle||{})[cycle]||{})[day]||{})[slot]:null;
  if(c&&accEx(c)) return c;
  const p=((plan.accPick||{})[day]||{})[slot];
  if(p&&accEx(p)) return p;
  return ACC_DEF[slot]||accFor(slot)[0]||null;
}
function accCycleOf(date){ const wk=weekOf(date); return wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):null }
function accDayOf(date){ const dp=dayPlan(date); return dp&&dp.acc||null }
// What you are actually doing in that slot today: a one-session swap wins over the block.
function accOn(date,slot){
  const d=((lg(date).acc||{}).ex||{})[slot];
  if(d&&accEx(d)) return d;
  return accPickFor(accDayOf(date),slot,accCycleOf(date));
}
function accSwapped(date,slot){
  const d=((lg(date).acc||{}).ex||{})[slot];
  return !!(d&&accEx(d)&&d!==accPickFor(accDayOf(date),slot,accCycleOf(date)));
}

/* ---------------- what you logged ---------------- */

function accSets(date,slot){ const A=lg(date).acc; if(Array.isArray(A)) return [];
  const s=((A||{}).sets||{})[slot]; return Array.isArray(s)?s:[] }
function accDone(date,slot){
  const A=lg(date).acc;
  // An archived program still holds the old by-position array. Read it where it sits
  // rather than rewriting history we cannot map with confidence.
  if(Array.isArray(A)){ const dp=dayPlan(date), sl=dp&&dp.acc?accSlots(dp.acc):[]; const i=sl.indexOf(slot); return i>=0&&!!A[i] }
  if(((A||{}).done||{})[slot]) return true;
  return accSets(date,slot).some(x=>x&&((x.w!=null&&x.w!=='')||(x.r!=null&&x.r!=='')));
}
function accDoneCount(date,day){ return accSlots(day).filter(s=>accDone(date,s)).length }
// Skipping is a decision about today, so it lives on the day rather than in the plan.
function accSkipped(date){ const A=lg(date).acc; return !!(A&&!Array.isArray(A)&&A.skip) }

/* The last time you did this movement, so the sets in front of you have something to
   beat. Matched on the exercise rather than the slot: swap the lat pulldown for a
   chin-up and comparing against the pulldown would be comparing against nothing.
   Days with the slot empty are skipped, so a session you did not log does not become
   the thing you are trying to match. */
function accLast(date,slot,id){
  let best=null;
  for(const [d,L] of progLogs()){
    if(d>=date) continue;
    const A=L.acc; if(!A||Array.isArray(A)) continue;      // the old by-position shape
    const raw=(A.sets||{})[slot]; if(!Array.isArray(raw)) continue;
    const sets=raw.filter(x=>x&&((x.w!=null&&x.w!=='')||(x.r!=null&&x.r!=='')));
    if(!sets.length||accOn(d,slot)!==id) continue;
    if(!best||d>best.d) best={d,sets};
  }
  return best;
}
// A loaded bodyweight movement reads as +25 x 8, which is how it would be written down.
function accSetText(x,bw){
  const w=x.w!=null&&x.w!==''?n(x.w):null, r=x.r!=null&&x.r!==''?n(x.r):null;
  if(w==null) return r==null?'':`${r} reps`;
  const lbl=bw?'+'+w:w;
  return r==null?String(lbl):`${lbl} \u00d7 ${r}`;
}
function accLastLine(date,slot,id){
  const p=accLast(date,slot,id); if(!p) return '';
  const txt=p.sets.map(x=>accSetText(x,isBWAcc(id))).filter(Boolean).join(' \u00b7 ');
  if(!txt) return '';
  return `<div class="small muted">Last time, ${fmtD(p.d,true)}: <b class="mono">${txt}</b></div>`;
}

/* ---------------- bands ----------------
A band has no number on it, only a color, and the color means different things by
brand. Worse, it means different things within one brand: Rogue's own Monster chart
lists Red twice, at 18 lb and at 115 lb, so a color alone cannot identify a band.
And the published figure is peak resistance at full stretch — the force at the bottom
of a rep is a fraction of it.

So the app does not pretend to a lookup. Your bands are a list you keep, each with the
number you want it logged as, and the presets below are a starting point you can edit.
They are Rogue's own published Monster Band figures; third-party charts for the same
bands disagree by enough (Black at 65 lb or at 100 lb) that only the maker's is worth
seeding from. */
const BAND_PRESETS={
  rogue:{name:'Rogue Monster',
    note:'Rogue publish one figure per band, their peak resistance at full stretch.',
    bands:[{n:'Rogue #0 Orange',w:9},{n:'Rogue #1 Red',w:18},{n:'Rogue #2 Blue',w:30},
           {n:'Rogue #3 Green',w:40},{n:'Rogue #4 Black',w:65},{n:'Rogue #5 Purple',w:95},
           {n:'Rogue #6 Red',w:115},{n:'Rogue #7 Silver',w:225}]},
  elitefts:{name:'elitefts Pro',
    note:'elitefts publish a range per band, and their own pages do not agree with each other \u2014 the Pro Mini is listed at 25\u201354 lb in one place and 5\u201335 lb in another. These are the midpoints of the higher, more consistent set. Treat them as a starting point and nothing more.',
    bands:[{n:'elitefts Micro',lo:13.8,hi:29.2},{n:'elitefts Mini',lo:25.5,hi:53.8},
           {n:'elitefts Monster Mini',lo:39.4,hi:91.5},{n:'elitefts Light',lo:56.8,hi:124.9},
           {n:'elitefts Average',lo:86.9,hi:192.5},{n:'elitefts Strong',lo:122.9,hi:275.1}]},
  westside:{name:'Westside Barbell',
    note:'Westside publish a range per band, and their own articles quote higher numbers again depending on whether the band is choked, doubled or anchored, and on how tall you are. These are the midpoints of the product-page ranges. There is no Average here because the product pages do not list one.',
    bands:[{n:'Westside Mini',lo:30,hi:70},{n:'Westside Monster Mini',lo:65,hi:105},
           {n:'Westside Light',lo:70,hi:130},{n:'Westside Strong',lo:180,hi:290}]},
};
// The number a preset seeds with: the published figure where there is one, the middle of
// the range where there is not. A range cannot be a log entry, and the midpoint is the
// least wrong single number to start from.
function bandPresetW(b){ return b.w!=null?b.w:Math.round((b.lo+b.hi)/2) }
function bandPresetLabel(b){ return b.w!=null?String(b.w):Math.round(b.lo)+'\u2013'+Math.round(b.hi) }

function bands(){
  const b=plan.bands;
  return Array.isArray(b)?b.filter(x=>x&&x.n&&+x.w>0).map(x=>({n:String(x.n),w:+x.w})):[];
}
// An exercise is banded if its gear says so. Data-driven, so a new band exercise needs
// no second list to be added to.
function isBandEx(id){ const e=accEx(id); return !!e&&/band/i.test(e.gear||'') }
function bandAdd(n,w){
  n=String(n||'').trim(); w=+w;
  if(!n||!(w>0)) return false;
  if(bands().some(b=>b.n.toLowerCase()===n.toLowerCase())) return false;
  mutatePlan(p=>{p.bands=[...bands(),{n,w}]});
  return true;
}
function bandRemove(n){
  const next=bands().filter(b=>b.n!==n);
  if(next.length===bands().length) return false;
  mutatePlan(p=>{p.bands=next});
  return true;
}
// Seeding converts, because the published chart is in pounds and your log is in whatever
// you train in. This is new data being created from a known unit, not a stored number
// being rewritten, so it is the one place a conversion belongs.
function bandSeed(brand){
  const set=BAND_PRESETS[brand]; if(!set) return 0;
  const kg=u()==='kg', have=new Set(bands().map(b=>b.n.toLowerCase()));
  const add=set.bands.filter(b=>!have.has(b.n.toLowerCase()))
    .map(b=>{const w=bandPresetW(b); return {n:b.n,w:kg?Math.round(w*0.4536*2)/2:w}});
  if(!add.length) return 0;
  mutatePlan(p=>{p.bands=[...bands(),...add]});
  return add.length;
}

/* ---------------- supersets ----------------
Pairing two jobs means doing a set of each back to back and resting once, which is how
most people run curls against pushdowns. Stored as the *first* slot of each pair, per
day, because a pair is defined by where it starts: `accSuper.mon = ['biceps']` pairs
biceps with whatever the day lists next.

Keeping it positional rather than storing both names means re-ordering a day's jobs, or
removing one, cannot leave a pair pointing at something that is no longer there. */
function accSuperSet(day){ const a=(plan.accSuper||{})[day]; return Array.isArray(a)?a:[] }
// The day's jobs grouped into runs: [[a,b],[c]] — a paired with b, then c on its own.
function accGroups(day){
  const slots=accSlots(day), on=new Set(accSuperSet(day)), out=[];
  for(let i=0;i<slots.length;i++){
    if(on.has(slots[i])&&i+1<slots.length){ out.push([slots[i],slots[i+1]]); i++ }
    else out.push([slots[i]]);
  }
  return out;
}
/* The order a session runs them in: everything else, then core work, then carries.

   Carries always go last, because a fried grip makes everything after it worse --
   including a hanging core movement. Core goes last otherwise, which is where TB III
   puts abs too: its strength-endurance circuit is "bench press... squat... finish up
   with RDL and abs", and a tired trunk is a worse brace for anything after it. The
   carry slot counts as a whole, dead hangs and plate pinches included, since they cost
   the grip the same way.

   Done on groups rather than slots, so a superset moves as a pair instead of being
   split, and a pair with a carry in it goes with the carries. Stable within each band,
   so everything else keeps your order. And only here: Setup keeps the order you set,
   because a pair is defined by which job comes next there. */
function accRank(group){ return group.includes('carry')?2:group.includes('core')?1:0 }
function accRunGroups(day){
  return accGroups(day).map((g,i)=>[g,i]).sort((a,b)=>accRank(a[0])-accRank(b[0])||a[1]-b[1]).map(x=>x[0]);
}
function accIsSuper(day,slot){ return accGroups(day).some(g=>g.length>1&&g[0]===slot) }
// Can only pair with something after it, and not with a job that is already the second
// half of a pair — otherwise one movement ends up in two supersets at once.
function accCanSuper(day,slot){
  const g=accGroups(day);
  const i=g.findIndex(x=>x[0]===slot);
  // The one after it has to be free as well. Without this, pairing a job could take the
  // first half of a pair that already existed and quietly re-draw someone else's.
  return i>=0&&g[i].length===1&&i+1<g.length&&g[i+1].length===1;
}
function accSuperToggle(day,slot){
  const cur=accSuperSet(day);
  if(cur.includes(slot)){ mutatePlan(p=>{p.accSuper=Object.assign({},p.accSuper,{[day]:cur.filter(s=>s!==slot)})}); return true }
  if(!accCanSuper(day,slot)) return false;
  mutatePlan(p=>{p.accSuper=Object.assign({},p.accSuper,{[day]:[...cur,slot]})});
  return true;
}

/* ---------------- supplements ----------------

Both books that have anything to say about supplements say it with doses and timing,
so this is a list out of them rather than a list of our own. The levels, the doses and
the warnings are theirs; what is ours is the tracking, which is labelled as ours.

TB3 has the chapter: "There are supplements that work, supplements that work for some
people, and supplements that probably don't work for anyone... Level 1 = Will make a
significant difference in training. Mandatory (if you have the budget/and cleared by
your physician). Level 2 = Can make a difference... Nice to have, but not necessary."
Its Level 1 is explicitly "in the context of building mass", which is why `ctx` is
recorded here and shown: creatine is not mandatory for someone running Operator.

TB2's list is for carrying a conditioning load rather than for mass, and it says so:
"Supplements aren't necessary, but they can be helpful and give you a bit of an edge."

TB1 prescribes none, and Ageless Athlete names supplementation as one of four recovery
practices without naming products, so neither adds an entry here.

`when` is daily or pre: the two pre-session ones have a window in front of training and
belong on the session card, not in the evening check-in. */
const SUPP={
  creatine:{name:'Creatine monohydrate',lvl:1,ctx:'both',when:'daily',src:'TB1 and TB3',rec:'highly recommended',
    dose:'5 g a day in TB1, 5 to 10 g in TB3 — training days and rest days alike',
    note:'TB1 puts it in the post-workout shake on training days and takes it on its own otherwise. TB3 is blunt about giving up early: you are not a non-responder until you have taken it for a month or two without skipping doses, and most people who say they are have not. Monohydrate, and Creapure if you can get it.'},
  magnesium:{name:'Magnesium or magnesium/potassium',lvl:2,ctx:'both',when:'daily',src:'TB1, TB2 and TB3',rec:'highly recommended for the active',
    dose:'200 to 300 mg a day; glycinate or malate, or a combined magnesium/potassium',
    note:'TB1 calls it "a big one" — ATP generation, heart muscle, blood pressure — and notes that deficiencies are common among the active because of stimulant and energy-drink use. TB2 adds that potassium, magnesium and sodium go quickly in sweat on long work. Some people react badly to glycinate and feel flat the next day; try malate before giving up on it.'},
  caffeine:{name:'Caffeine',lvl:2,ctx:'both',when:'pre',src:'TB1 and TB3',rec:'one of the two things that made the most difference in TB1',
    dose:'100 to 200 mg, 20 to 30 minutes before training',
    note:'TB3 says that if you have never trained on caffeine there is no reason to start: it does not drive mass gain. TB1 is honest that it may do nothing for strength but definitely moves mood and perceived energy, which is what gets you into the gym after a long shift. Tablets are a cheaper and cleaner substitute for a pre-workout.'},
  multi:{name:'Multivitamin',lvl:1,ctx:'mass',when:'daily',src:'TB3',rec:'the books disagree about this one',
    dose:'one a day while building mass; TB1 takes one every couple of days as insurance',
    note:'TB3 puts it on the mass list because gaining twenty or thirty pounds of muscle is a demanding job and the processes doing it need the raw material. TB1 is on the fence — "I am just not sure that is worth it" — and suggests it only if your diet is not as nutrient dense as it should be. Watch the zinc in it if you also take ZMA.'},
  zinc:{name:'Zinc or ZMA',lvl:null,ctx:'both',when:'daily',src:'TB1',rec:'controversial, and the book says so',
    dose:'as directed; ZMA is zinc, magnesium and vitamin B6 together',
    note:'Marketed as a testosterone booster, which it is not. A zinc deficiency lowers testosterone, and people who train regularly can become deficient, so it addresses a deficiency rather than pushing you past normal. The author reports a difference in mood, libido and energy.'},
  vitamind:{name:'Vitamin D',lvl:null,ctx:'both',when:'daily',src:'TB1',rec:'the author is skeptical',
    dose:'about 1000 to 2000 every other day, and get your level tested first',
    note:'"I am skeptical that Vitamin D is the cure all that it is being made out to be." The research still points to testing your level and supplementing until it is reasonable. Avoid mega-dosing.'},
  bcomplex:{name:'B complex',lvl:null,ctx:'both',when:'daily',src:'TB1',rec:'occasionally, not daily',
    dose:'once every two or three days, or after a hard session',
    note:'A noticeable difference in energy sometimes. The book says not to overdo it.'},
  fishoil:{name:'Fish oil or EFAs',lvl:null,ctx:'both',when:'daily',src:'TB1',rec:'the author is skeptical',
    dose:'as directed — avoid mega-dosing',
    note:'"I prefer eating fish a couple times a week. Again, I am a little skeptical that fish oil is the magic it is made out to be."'},
  citrulline:{name:'Citrulline malate',lvl:2,ctx:'mass',when:'pre',src:'TB3',rec:'worth having, not necessary',
    dose:'4 to 6 g, 30 to 45 minutes before training',
    note:'For work capacity and delaying fatigue. Less than 4 g may do nothing. Beet powder or extract is the alternative the book offers.'},
  beets:{name:'Beets or TMG',lvl:null,ctx:'cond',when:'daily',src:'TB2',rec:'worth having, not necessary',
    dose:'a couple of glasses of blended beets a day; TMG (betaine) if you would rather not',
    note:'The author’s own: noticeably more in the tank on long work, and fatigue taking longer to arrive. Canned sliced beets are fine.'},
  electrolyte:{name:'Electrolytes',lvl:null,ctx:'cond',when:'daily',src:'TB2',rec:'worth having, not necessary',
    dose:'magnesium, potassium and sodium, around long sessions',
    note:'Potassium, magnesium and sodium go quickly in sweat on long work, and caffeine and other diuretics speed it up.'},
};
const SUPP_LVL={1:'Level 1',2:'Level 2'};
// Mass Protocol is the context TB3's list is written for; TB2's is for carrying a
// conditioning load, which everything but a mass template is doing.
function suppCtx(){ return MASS_TEMPLATES.includes(plan.stempl)?'mass':'cond' }
// What the book calls it *for you*. Level 1 is mandatory only in the context it was
// written for, so outside that context it is on offer and nothing more.
function suppStanding(id){
  const s=SUPP[id]; if(!s) return '';
  // Written for the other context: on offer, but not prescribed for what you run.
  if(s.ctx!=='both'&&s.ctx!==suppCtx()) return `${s.src}${s.lvl?' '+SUPP_LVL[s.lvl]:''}, for ${s.ctx==='mass'?'building mass':'a conditioning load'}`;
  // "Mandatory" is TB3's word, from TB3's Level 1, and TB3 wrote that list for
  // building mass. Off a mass template the same supplement is recommended by TB1,
  // which has no level scheme and does not mandate anything, so the rec stands alone.
  if(s.lvl===1&&suppCtx()==='mass') return `TB3 Level 1 \u2014 the book calls it mandatory`;
  return `${s.src} \u00b7 ${s.rec}`;
}
/* Yours: anything the books do not cover. No dose and no level, because inventing
   either would be putting words in the book's mouth. */
function suppCustom(){ const a=plan.suppCustom; return Array.isArray(a)?a.filter(x=>x&&x.id&&x.name):[] }
function suppAll(){
  const out={};
  for(const [k,v] of Object.entries(SUPP)) out[k]=v;
  for(const x of suppCustom()) out[x.id]={name:x.name,when:x.when==='pre'?'pre':'daily',mine:true};
  return out;
}
function suppName(id){ const s=suppAll()[id]; return s?s.name:id }
// The ones you said you take, in catalogue order with your own after them.
function suppOn(when){
  const taking=plan.supps||{}, all=suppAll();
  return Object.keys(all).filter(k=>taking[k]&&(!when||all[k].when===when));
}
function suppTook(date,id){ return !!((lg(date).supps||{})[id]) }
function suppDoneCount(date,when){ const on=suppOn(when); return on.filter(k=>suppTook(date,k)).length }
/* Creatine is the one the book ties to a streak rather than to a dose: "you won't know
   you're a non-responder unless you try it for at least a month or two without skipping
   doses." So the run of unbroken days is the number worth keeping, and today does not
   break it until the day is over. */
function suppStreak(date,id){
  let n0=0;
  for(let i=1;i<400;i++){
    const d=addDays(date,-i);
    if(d<plan.startMonday) break;
    if(!suppTook(d,id)) break;
    n0++;
  }
  return suppTook(date,id)?n0+1:n0;
}

let suppNew={name:'',when:'daily'};
function suppRow(id,s){
  const on=!!(plan.supps||{})[id], std=s.mine?'':suppStanding(id);
  return `<div class="supp-r">
  <label class="check"><input type="checkbox" id="supp-${esc(id)}" data-pbind="supps.${esc(id)}" ${on?'checked':''}> <b>${esc(s.name)}</b></label>
  <div class="supp-m">${s.mine?`<span class="chip">Yours</span> <span class="small muted">${s.when==='pre'?'Before training':'Daily'}</span>`:`<span class="small muted">${esc(std)} · ${s.when==='pre'?'before training':'daily'}</span>`}</div>
  ${s.dose?`<div class="small"><b class="mono">${esc(s.dose)}</b></div>`:''}
  ${s.note?`<details class="plain"><summary>What the book says</summary><div class="small muted" style="margin-top:6px">${esc(s.note)}</div></details>`:''}
  ${s.mine&&!viewing?`<div><button class="btn sm ghost" data-act="supprm" data-id="${esc(id)}">Remove</button></div>`:''}</div>`;
}
function suppSetupCard(){
  const ctx=suppCtx(), mine=suppCustom();
  const book=Object.entries(SUPP), fits=book.filter(([,s])=>s.ctx==='both'||s.ctx===ctx), rest=book.filter(([,s])=>!(s.ctx==='both'||s.ctx===ctx));
  let h=`<div class="card"><h2>Supplements</h2>
  <p class="note" style="margin:0">The list is the books’, doses included. TB3: <i>"There are supplements that work, supplements that work for some people, and supplements that probably don’t work for anyone."</i> Tick what you take and it appears in the daily check-in and on session days. Tracking what you take is ours; none of the doses are.</p>
  <p class="small muted" style="margin:0">Protein powder is not on this list even though both books put it on theirs. It is food rather than a supplement, and the app already tracks protein as a macro with a target of its own \u2014 ticking it here as well would count the same thing twice. <b>Ours.</b></p>
  <p class="small muted" style="margin:0"><b>The book’s own caveat, kept:</b> Level 1 is mandatory <i>if you have the budget and are cleared by your physician</i>. This is general training guidance, not medical advice.</p>`;
  h+=`<div class="small" style="font-weight:650;margin-top:4px">For what you are running — ${ctx==='mass'?'a mass template, so TB3’s list applies':'a conditioning load, so TB2’s list applies'}</div>`;
  h+=`<div class="supps">${fits.map(([k,s])=>suppRow(k,s)).join('')}</div>`;
  h+=`<details class="plain"><summary>The rest of the books’ list</summary><div class="note" style="margin-top:6px">Written for the other context. Nothing stops you taking them; the book just does not prescribe them for the program you are on.</div><div class="supps">${rest.map(([k,s])=>suppRow(k,s)).join('')}</div></details>`;
  h+=`<div style="border-top:1px solid var(--line);padding-top:12px"><div class="small" style="font-weight:650">Yours</div>
  <p class="note" style="margin:2px 0 0">Anything the books do not cover. No dose is shown for these, because the books do not give one and making one up is not the app’s job.</p>`;
  if(mine.length) h+=`<div class="supps">${mine.map(x=>suppRow(x.id,suppAll()[x.id])).join('')}</div>`;
  if(!viewing) h+=`<div class="row" style="gap:8px;margin-top:8px;align-items:flex-end">
    <label class="f" style="flex:1">Name<input type="text" id="supp-new" data-suppnew="name" value="${esc(suppNew.name)}" placeholder="Fish oil"></label>
    <label class="f">When<select id="supp-when" data-suppnew="when"><option value="daily"${suppNew.when==='daily'?' selected':''}>Daily</option><option value="pre"${suppNew.when==='pre'?' selected':''}>Before training</option></select></label>
    <button class="btn sm" data-act="suppadd"${suppNew.name.trim()?'':' disabled'}>Add</button></div>`;
  return h+`</div></div>`;
}
/* The daily tick-list, on the check-in. Pre-training ones are not here: they have a
   window in front of the session and belong on the session card. */
function suppCard(date,when){
  const on=suppOn(when); if(!on.length) return '';
  const all=suppAll(), pre=when==='pre';
  const done=on.filter(k=>suppTook(date,k)).length;
  let h=`<div class="card"><div class="lift-h"><h3>${pre?'Before you start':'Supplements'}</h3><span class="small muted mono">${done} of ${on.length}</span></div>`;
  if(pre) h+=`<p class="small muted" style="margin:0">These have a window in front of the session, so they are here rather than in the check-in.</p>`;
  h+=`<div class="supp-ticks">${on.map(k=>{
    const s=all[k]||{name:k};
    return `<label class="check"><input type="checkbox" id="supt-${esc(k)}" data-bind="supps.${esc(k)}" ${suppTook(date,k)?'checked':''}> ${esc(s.name)}${s.dose?`<span class="small muted"> · ${esc(s.dose.split(';')[0])}</span>`:''}</label>`;
  }).join('')}</div>`;
  // Creatine is the one the book ties to not skipping, so it is the one that gets a run.
  if(!pre&&(plan.supps||{}).creatine){
    const st=suppStreak(date,'creatine');
    h+=`<div class="note">${st?`Creatine: <b class="mono">${st} day${st===1?'':'s'}</b> unbroken.${st<60?` The book asks for a month or two without skipping before you decide it does nothing for you.`:''}`:'Creatine not logged today. The book’s whole point about it is the doses you do not skip.'}</div>`;
  }
  return h+`</div>`;
}

/* ---------------- state ---------------- */
let plan=clone(DEF), logs={}, planV=0;
// Bumped whenever a log changes. Every other path that replaces `logs` wholesale already
// bumps planV, so planV + logsV together are a complete version of the data a view reads.
let logsV=0;
// Archived programs (id → {id, name, startMonday, end, archivedAt, plan}). While one is
// being viewed, `plan` is its frozen copy, `stash` holds the current plan, and every
// write is refused.
let programs={}, viewing=null, stash=null;
// Set when the stored data is newer than this copy of the app understands. Everything
// becomes read-only rather than risk writing an old shape over a new one.
let schemaAhead=false;
// Whether the server says this address administers the app. Set from /api/state only.
let amAdmin=false;
// The shared accessory catalogue, curated by an administrator and the same for everyone.
// Shared state, not yours, so it lives beside the plan rather than inside it.
let catalog=[];
let view='today', sel=todayStr(), planShow=26, planMode='list', calMonth=null;
try{const pm=localStorage.getItem('ob.planmode'); if(pm==='cal'||pm==='list') planMode=pm}catch(e){}
try{ const v=localStorage.getItem('ob.view'); if(v) view=v; }catch(e){}

/* ---------------- utils ---------------- */
function clone(o){return JSON.parse(JSON.stringify(o))}
function pad(n){return String(n).padStart(2,'0')}
function D(s){const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)}
function S(t){return new Date(t).toISOString().slice(0,10)}
function addDays(s,n){return S(D(s)+n*864e5)}
function realToday(){const n=new Date();return n.getFullYear()+'-'+pad(n.getMonth()+1)+'-'+pad(n.getDate())}
// In an archived program, "today" is its last day, so every view shows it as it ended.
function todayStr(){const t=realToday();return viewing&&viewing.end<t?viewing.end:t}
// The dates that belong to the program on screen (programs never overlap).
function inProgram(d){return d>=plan.startMonday&&(!viewing||d<=viewing.end)}
function progLogs(){return Object.entries(logs).filter(([d])=>inProgram(d))}
function dow(s){return (new Date(D(s)).getUTCDay()+6)%7}
function mondayOf(s){return addDays(s,-dow(s))}
function fmtD(s,withDow){const d=new Date(D(s));const t=(d.getUTCMonth()+1)+'/'+d.getUTCDate();return withDow?DAYN[dow(s)]+' '+t:t}
function fmtLong(s){const d=new Date(D(s));return DAYN[dow(s)]+', '+MON[d.getUTCMonth()]+' '+d.getUTCDate()+(d.getUTCFullYear()!==new Date().getFullYear()?', '+d.getUTCFullYear():'')}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function rnd(x,inc){inc=+inc||5;return Math.round(x/inc)*inc}
function floorTo(x,inc){inc=+inc||5;return Math.floor(x/inc+1e-9)*inc}
function n(x){if(x==null||x==='')return '—';const v=Math.round(x*100)/100;return String(v)}
function deepMerge(base,over){if(!over||typeof over!=='object')return base;for(const k of Object.keys(over)){const v=over[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&base[k]&&typeof base[k]==='object'&&!Array.isArray(base[k]))base[k]=deepMerge(base[k],v);else base[k]=v}return base}
function setPath(o,path,v){const ks=path.split('.');let c=o;for(let i=0;i<ks.length-1;i++){if(c[ks[i]]==null||typeof c[ks[i]]!=='object')c[ks[i]]=/^\d+$/.test(ks[i+1])?[]:{};c=c[ks[i]]}c[ks[ks.length-1]]=v}
function getPath(o,path){return path.split('.').reduce((c,k)=>c==null?undefined:c[k],o)}
function liftName(k,date){
  if(VARS[k]) return varsOf(k)[varOf(k,date)].name;
  return k==='pull'?(plan.lift3Name||'Lat pulldown'):{bench:'Bench',dead:'Deadlift',ohp:'Overhead press',wpu:'Weighted pull-up'}[k];
}
// Which variant of a lift a session uses. Two different things:
//
//   the block lift   what this cycle is built on. Tactical Barbell picks its cluster
//                    lifts for a block and runs them for the whole block, so this is a
//                    per-cycle choice and the max you store IS that lift's max. No ratio.
//   a one-off        a swap for a single session, because the rack is taken or your back
//                    is unhappy. The weight is scaled off the block lift's max by the
//                    ratio between the two, and the card says so.
//
// Retest and bridge weeks always use the block lift, even against a one-off, because
// their whole job is to measure the max the next block is built on.
function varOf(k,date){
  if(!VARS[k]) return null;
  const d=datestr(date), wk=d?weekOf(d):null, bv=blockVar(k,d);
  if(wk&&(wk.kind==='test'||wk.kind==='bridge')) return bv;
  const o=((logs[d]||{}).var||{})[k];
  return varsOf(k)[o]?o:bv;
}
/* A date argument is optional everywhere it appears, so `fn(k)` and `arr.map(fn)` look
   alike and the second quietly passes 0, 1, 2 as the date. Anything that is not a date
   string means "no date given". */
function datestr(d){ return (typeof d==='string'&&d)||sel }
function blockVar(k,date){
  if(!VARS[k]) return null;
  const d=datestr(date), wk=d?weekOf(d):null;
  const c=wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):null;
  const cv=((plan.cycleVar||{})[c]||{})[k];
  return varsOf(k)[cv]?cv:varDefault(k);
}
function varDefault(k){const v=(plan.liftVar||{})[k];return VARS[k]&&varsOf(k)[v]?v:varRef(k)}
// The max to work from. The block lift uses the max you stored, as it stands: that number
// is this lift's max. A one-off is scaled from it by the two variants' ratios.
function varMax(k,c,date){
  const base=maxFor(c)[k]; if(!base) return null;
  const bv=blockVar(k,date), v=varOf(k,date);
  if(v===bv) return {v:base.v,src:base.src,vr:v,bv};
  const V=varsOf(k), r=V[v].r/V[bv].r;
  /* A bodyweight lift stores the ADDED weight, but a grip variant is a share of what
     you actually lift, which is your bodyweight plus that. Scaling the added weight
     alone turns a chin-up that is 5% stronger into a belt 20% heavier: at 180 lb with
     +60, the system load is 240, 5% of which is 252 -- so +72, not +63. No bodyweight
     on file means no honest answer, the same as `loadFor` and `estMax`. */
  if(isBW(k)){ const bw=bwFor(datestr(date)); return bw?{v:(bw+base.v)*r-bw,src:'ratio',vr:v,bv,from:base.v,r,bw}:null }
  return {v:base.v*r,src:'ratio',vr:v,bv,from:base.v,r};
}
function l3On(){const on=(plan.l3&&plan.l3.on)||{};const xs=L3K.filter(k=>on[k]);return xs.length?xs:['pull']}
function activeLifts(){return ['squat','bench',...l3On(),'dead']}
function isBarbell(k){return k!=='pull'&&k!=='wpu'}
function isBW(k){return k==='wpu'}
// Which Lift 3 variant a session uses: a per-day swap wins, otherwise the rotation rule.
function l3Auto(date){
  const fw=weekOf(date); if(fw&&fw.l3&&fw.l3[slotOf(date)]) return fw.l3[slotOf(date)];
  const on=l3On(); if(on.length===1) return on[0];
  const mode=(plan.l3||{}).mode||'same';
  if(mode==='same') return on.includes(plan.l3.primary)?plan.l3.primary:on[0];
  const wk=weekOf(date); if(!wk) return on[0];
  const wi=wk.kind==='cycle'?wk.plyoIdx:wk.idx;
  const k=mode==='alt-day'?wi*2+(slotOf(date)===2?1:0):mode==='alt-week'?wi:(wk.kind==='cycle'?wk.cycle:wk.refCycle)-1;
  return on[((k%on.length)+on.length)%on.length];
}
function l3For(date){const o=(logs[date]||{}).l3;return o&&l3On().includes(o)?o:l3Auto(date)}
// Working load. Weighted pull-up percentages apply to bodyweight + added weight;
// the result is the weight to add (0 or less = bodyweight only).
function loadFor(k,max,pct,date){
  if(isBW(k)){const bw=bwFor(date||sel);if(!bw)return null;return rnd((bw+max)*mult()*pct/100-bw,plan.round[k])}
  return rnd(max*mult()*pct/100,plan.round[k]);
}
function estMax(k,w,r,date){
  if(w==null||w===''||!r) return null;
  if(isBW(k)){const bw=bwFor(date||sel);if(!bw)return null;const e=e1rm(bw+ +w,r);return e==null?null:e-bw}
  return e1rm(w,r);
}
function fmtLoad(k,w){return isBW(k)?(w>0?'+'+n(w):'BW'):n(w)}
function mult(){return plan.basis==='tm'?(+plan.tmPct||90)/100:1}
function tier(p){return p<=75?'light':p>=90?'heavy':'mid'}
function e1rm(w,r){w=+w;r=+r;if(!w||!r)return null;return w/(PCT5[r]||1/(1+r/30))}
function monAdd(m,i){return addDays(m,i)}
function elevUnit(){return u()==='kg'?'m':'ft'}
// Climbing counted as distance: the trail rule of thumb is 1,000 ft of gain ≈ 1 mile
// (190 m ≈ 1 km). One factor for every activity, so the numbers stay comparable.
function elevPerDist(){const v=+((plan.elevPer||{})[u()]);return v>0?v:(u()==='kg'?190:1000)}
function u(){return plan.unit||'lb'}
// "Fourteen weeks away", for a date you are working toward. Past dates say so rather
// than counting backwards, because a goal with a date behind it needs moving, not maths.
function weeksUntil(d){
  if(!d) return '';
  const days=Math.round((Date.parse(d)-Date.parse(todayStr()))/86400000);
  if(days<0) return 'That date has passed.';
  if(days===0) return 'That is today.';
  if(days<14) return days+' day'+(days===1?'':'s')+' away.';
  return Math.round(days/7)+' weeks away.';
}

/* ---------------- schedule engine ---------------- */
// The rule sequence (bridge, 6-week cycles, rule deloads/retests). `from` resumes it
// after the locked weeks: {c, w} continues cycle c at week w; phase 'rule' means
// cycle c just finished and its deload/retest check comes next.
function* ruleSeq(p,from){
  let c=1,w=1,ruleFirst=false;
  if(from){c=from.c;w=from.w||1;ruleFirst=from.phase==='rule'} else if(p.bridge) yield {kind:'bridge'};
  // Ageless Athlete's 3-1-3-1: a recovery week after every third training week, so a
  // six-week block takes eight. "Notice that it now takes eight weeks to complete what
  // was normally a six-week Operator/Zulu block. That's not a worry because we are in
  // no hurry on the journey to lifelong excellence."
  const r313=!!p.recovery313;
  for(;;c++,w=1){
    if(!ruleFirst) for(const n=cycleWeeks();w<=n;w++){
      yield {kind:'cycle',cycle:c,w};
      // No `after` on a recovery week: it sits inside the cycle, so replaying a frozen
      // one must not advance the resume point to the next cycle.
      if(r313&&w%3===0) yield {kind:'recovery',cycle:c,afterW:w};
    }
    ruleFirst=false;
    const t=+p.testEvery>0&&c%+p.testEvery===0, d=+p.deloadEvery>0&&c%+p.deloadEvery===0;
    if(t&&!p.skips['test@'+c]) yield {kind:'test',after:c,rule:'test@'+c};
    // The recovery weeks are the back-off, so a rule deload on top of them is the one
    // thing the book is arguing against.
    else if(d&&!r313&&!p.skips['deload@'+c]) yield {kind:'deload',after:c,rule:'deload@'+c};
  }
}
let wcache={v:-1,list:[]};
function weeks(minIdx){
  const need=Math.max(minIdx||0, idxOf(todayStr())+160, 60);
  if(wcache.v===planV&&wcache.list.length>need) return wcache.list;
  // Past weeks are locked in plan.frozen (see freezePast), so settings changes only
  // re-plan from the current week on. Locked weeks form a prefix from the start date.
  const out=[], fz=plan.frozen||{}; let g=null, m=plan.startMonday, cw=0, lastC=0, resume=null, bbLeft=0, bbVer='standard';
  for(let i=0;i<=need+10;i++){
    let wk;
    if(!g&&fz[m]){
      wk=Object.assign({},fz[m],{locked:true});
      if(wk.kind==='bb'&&wk.w<bbLen(wk.ver)){bbVer=wk.ver||'standard';bbLeft=bbLen(bbVer)-wk.w}
      if(!wk.inserted) resume=wk.kind==='bridge'?{c:1,w:1}:wk.kind==='cycle'?(wk.w<cycleWeeks()?{c:wk.cycle,w:wk.w+1}:{c:wk.cycle,phase:'rule'}):wk.after?{c:wk.after+1,w:1}:resume;
    } else {
      if(!g) g=ruleSeq(plan,resume);
      const ins=plan.inserts[m];
      if(bbLeft>0){ wk={kind:'bb',w:bbLen(bbVer)-bbLeft+1,ver:bbVer,inserted:true}; bbLeft--; }
      else if(ins==='bb'){ bbVer=((plan.bbVer||{})[m])||'standard'; wk={kind:'bb',w:1,ver:bbVer,inserted:true}; bbLeft=bbLen(bbVer)-1; }
      else if(ins) wk={kind:ins,inserted:true}; else wk=g.next().value;
    }
    wk=Object.assign({},wk,{monday:m,idx:i});
    if(wk.kind==='cycle'){if(wk.plyoIdx==null)wk.plyoIdx=cw;cw=wk.plyoIdx+1;lastC=wk.cycle}
    if(wk.kind==='bb'&&wk.rx==null){
      const i=wk.ver==='mass'?-1:(wk.ver==='strength')?wk.w-1:wk.w-6;   // which lifting week of the block, or none
      if(i>=0){const W=waveOf(); wk.rx=clone(W[Math.min(i,W.length-1)])}
    }
    if(wk.refCycle==null) wk.refCycle=wk.after||lastC||1;
    out.push(wk); m=addDays(m,7);
  }
  // for tests/inserts, find the cycle that follows
  for(let i=out.length-1,next=null;i>=0;i--){ if(out[i].kind==='cycle'&&out[i].w===1) next=out[i].cycle; out[i].nextCycle=next; }
  wcache={v:planV,list:out}; return out;
}
function idxOf(date){return Math.floor((D(mondayOf(date))-D(plan.startMonday))/(7*864e5))}
function weekOf(date){const i=idxOf(date);if(i<0)return null;return weeks(i+10)[i]}
function wkRx(wk){return wk.rx||(wk.kind==='cycle'?waveOf()[wk.w-1]:plan.deload)}
// TB2's Easy Week Principle: every third week the conditioning load comes down, and it is
// meant to land on the strength wave's 90-95% weeks so the heavy lifting gets the energy.
// In a six-week wave those are weeks 3 and 6, which is exactly `tier()==='heavy'`.
function easyCondWeek(date){const wk=date?weekOf(date):null;return !!(wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy')}
// Lock every week that has fully passed: its type, cycle/week, prescription and Lift 3
// picks. A cycle whose last week is locked also gets its maxes locked.
function freezePast(){
  const cur=idxOf(todayStr()); if(cur<0) return false;
  const list=weeks(cur+2), fz=plan.frozen||(plan.frozen={}), lm=plan.lockedMax||(plan.lockedMax={});
  let changed=false;
  // Up to and including the week you are in. A week already under way has told you what
  // it is, and changing the deload or retest spacing should not turn it into something
  // else on the Wednesday. Its *prescription* is deliberately not frozen while it is
  // current: Setup promises the wave and your maxes apply from this week on, and they do.
  for(let i=0;i<=cur&&i<list.length;i++){
    const wk=list[i], now=i===cur, f0=fz[wk.monday];
    if(f0&&!f0.soft) continue;                 // already history, and stays as it was
    if(f0&&now) continue;                      // soft and still current: leave it loose
    // Everything else gets written: a week not frozen at all, and — the case this used
    // to miss — a week that was held loosely while it was current and has now passed.
    // That one only ever had `soft` cleared, so it never gained the prescription stamp
    // a hard freeze adds, and went on following today's plan instead of what was done.
    const f={kind:wk.kind};
    for(const key of ['cycle','w','after','rule','inserted','plyoIdx','refCycle','ver']) if(wk[key]!=null) f[key]=wk[key];
    if(now) f.soft=true;                       // identity only; the numbers still follow
    else if(wk.kind==='cycle'||wk.kind==='deload'||(wk.kind==='bb'&&wk.rx)){f.rx=clone(wkRx(wk));f.tpl=stemplKey();f.cpr=cprotoKey();f.l3={};for(const sl of [0,2]) f.l3[sl]=l3Auto(addDays(wk.monday,sl))}
    fz[wk.monday]=f; changed=true; planV++;
  }
  const curMon=list[cur]&&list[cur].monday;
  // A cycle's maxes lock once its last week is done. Which week is last comes from the
  // wave that week ran, not from a hardcoded six: a template can have a shorter one.
  for(const [mon,f] of Object.entries(fz)) if(f.kind==='cycle'&&f.w===waveOf(f.tpl).length&&!lm[f.cycle]&&mon<curMon){
    const mx=maxFor(f.cycle), o={}; for(const k of LK) if(mx[k]) o[k]=mx[k].v; lm[f.cycle]=o; changed=true; planV++;
  }
  if(changed) queueWrite('plan/main',()=>plan);
  return changed;
}
let mcache={v:-1,m:{}};
// How many sets the + button will go to: the book's ten, or higher if the wave says so.
function SETCAP(r){return Math.max(10,r.sMax)}
// Add or drop one set for a lift on a single day. The lift card and the full-screen stepper
// both come through here, so the ceiling and the don't-strand-a-ticked-set guard live once.
function addSet(k,delta,date){
  const d=date||sel, wk=weekOf(d); if(!wk) return false;
  const r=rx(wk,k,d), L=lg(d), cur=Math.max(0,+(((L.lifts||{})[k]||{}).extra)||0);
  if(delta>0){ if(r.sMax>=SETCAP(r)) return false }
  else if(!cur||(((L.lifts||{})[k]||{}).sets||[])[r.sMax-1]) return false;
  setLog(d,'lifts.'+k+'.extra',Math.max(0,cur+delta));
  return true;
}
function maxFor(c){
  if(mcache.v!==planV) mcache={v:planV,m:{}};
  if(mcache.m[c]) return mcache.m[c];
  const o=(plan.cycleMaxes||{})[c]||{}, lk=(plan.lockedMax||{})[c]||{}, prev=c>1?maxFor(c-1):null, r={};
  for(const k of LK){
    if(o[k]!=null&&o[k]!=='') r[k]={v:+o[k],src:'set'};
    else if(lk[k]!=null) r[k]={v:+lk[k],src:'lock'};
    else if(c===1) r[k]=plan.maxes[k]!=null&&plan.maxes[k]!==''?{v:+plan.maxes[k],src:'base'}:null;
    else r[k]=prev[k]?{v:prev[k].v+(+plan.inc[k]||0),src:'proj'}:null;
  }
  return mcache.m[c]=r;
}
/* What a lift is prescribed on a given day.

   Operator, Fighter and Zulu run one prescription for the whole week, which is what the
   wave is. Tactical Barbell III does not: its tables are per day and sometimes per lift
   — Fighter HT's deadlift day diverges from week 2 on, and Specificity alternates
   max-strength days against hypertrophy days inside one week. So the template gets first
   refusal, and the wave is the answer when it declines.

   A frozen week pins the wave entry it ran (`wk.rx`) and the template it ran under
   (`wk.tpl`), and a template's own table is a pure function of the week number, so
   history stays reproducible without storing a prescription per day. */
function dayRx(wk,k,date){
  const T=STEMPL[wk.tpl]||stemplOf();
  // `day` is set only by composeSlot, so only a composed week can reach the table. A
  // deload, a retest or a Base Building week writes its own layout and keeps its own
  // numbers without needing to be named here.
  if(typeof T.rx==='function'){
    const dp=dayPlan(date);
    // `own` says the template set this deliberately, so the generic deadlift rule below
    // leaves it alone: on Fighter HT the deadlift day *is* five sets of eight.
    if(dp&&dp.day){ const v=T.rx(wk,dp.day,k); if(v) return Object.assign({},v,{own:true}) }
  }
  return wkRx(wk);
}
function rx(wk,k,date){
  let s,r,p,c;
  const d=date||sel;
  const v=dayRx(wk,k,d);s=+v.s;r=+v.r;p=+v.p;c=wk.kind==='cycle'?wk.cycle:wk.refCycle;
  // Operator I/A lets the lifter choose the volume: a wave entry can carry `sMax`, a
  // ceiling above the prescribed sets. `s` stays what the program asks for; the sets from
  // s+1 to sMax are yours to take or leave on the day. Deadlift is the standard template's
  // own version of the same idea -- one set required, up to three -- so it goes through
  // here too rather than being special-cased by every caller.
  let sx=v.sMax!=null&&+v.sMax>s?+v.sMax:s;
  if(k==='dead'&&!v.own){ s=1; sx=wk.kind==='cycle'?3:1 }
  // ...and a set added on the day widens it further, for this session only. Setup declares
  // the program's intent; this is the lifter deciding in the gym, which is the half of
  // Operator I/A that actually matters.
  sx+=Math.max(0,+(((lg(d).lifts||{})[k]||{}).extra)||0);
  const m=VARS[k]?varMax(k,c,d):maxFor(c)[k];
  return {s,sMax:sx,r,p,c,m,w:m?loadFor(k,m.v,p,d):null,t:wk.kind==='cycle'?tier(p):'light',vr:VARS[k]?varOf(k,d):null,
    amrap:!!v.amrap,note:v.note||null,
    // Back "Break" works up to a best set for the day rather than off a percentage,
    // and its down sets are a percentage of that set, not of a 1RM.
    top:!!v.top,down:v.down||null,downPct:v.downPct||null};
}
// The slot is what the program prescribes; the weekday is just when you do it.
/* ---------------- where a session actually happens ----------------

Until 3.48 a week was a permutation: `plan.order[monday]` held seven slots in seven
days, one each. That made a straight move impossible to express. Asking for Tuesday's
session on Thursday could only ever mean "and Thursday's on Tuesday", or "shuffle four
days so it fits" -- which is why every move came back as something the person had not
asked for, and why a day that was already full had to refuse.

A session is now an item with a date. It is identified by the week it belongs to and
its slot in that week's template, and `plan.at` records the ones that have been moved:

    plan.at["2026-10-19:1"] = "2026-10-22"     Tuesday's session, done on Thursday

Nothing else moves, ever. A day holds however many sessions point at it -- none, one,
four. Rest is the absence of a session rather than a slot of its own, so moving the
last session off a day leaves a rest day behind with no bookkeeping. A date anywhere is
allowed, including another week: losing Friday and picking it up on Monday is the
commonest thing that happens to a training week.

The cost is that nothing is bijective any more, so anything that used to assume one
session per day has to say which it means. `dayPlan` answers "the main one", which is
what almost every caller wanted; `dayPlans` answers "all of them". */
function atMap(){ const m=plan.at; return m&&typeof m==='object'?m:{} }
function sessId(monday,slot){ return monday+':'+slot }
function isDateStr(v){ return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v) }
/* `addDays(monday,slot)` is a session's *home*: where it would be if nothing had been
   moved, and the date everything about what the session IS is computed from. `dow(home)`
   is the slot, which is why `slotOf` can fall back to the weekday and still be right.
   `slotDate` is where it actually happens. Keep the two straight: a Lift 3 rotation read
   off the date it was moved to would change the session by moving it. */
/** The date a slot's session happens on: its own day unless it has been moved. */
function slotDate(monday,slot){ const v=atMap()[sessId(monday,slot)]; return isDateStr(v)?v:addDays(monday,slot) }
function sessMoved(monday,slot){ return slotDate(monday,slot)!==addDays(monday,slot) }
/** Every session that lands on this date, as {monday,slot,home}. */
function sessionsOn(date){
  const out=[], seen={};
  const add=(monday,slot)=>{ const id=sessId(monday,slot); if(seen[id]) return; seen[id]=1;
    out.push({monday,slot,home:addDays(monday,slot)}) };
  // Its own week's slots, minus any that have been moved away.
  const mon=mondayOf(date);
  if(idxOf(mon)>=0) for(let sl=0;sl<7;sl++) if(slotDate(mon,sl)===date) add(mon,sl);
  // Anything moved here from elsewhere, from any week.
  for(const [id,v] of Object.entries(atMap())){
    if(v!==date) continue;
    const i=id.lastIndexOf(':'); if(i<0) continue;
    const m=id.slice(0,i), sl=+id.slice(i+1);
    if(!isDateStr(m)||!(sl>=0&&sl<7)||idxOf(m)<0) continue;
    add(m,sl);
  }
  // Earliest home first, so a day that collected two reads in the order they were due.
  return out.sort((a,b)=>a.home<b.home?-1:a.home>b.home?1:a.slot-b.slot);
}
function moveSession(monday,slot,to){
  if(readOnly()||!isDateStr(to)||idxOf(monday)<0) return false;
  const id=sessId(monday,slot), home=addDays(monday,slot);
  mutatePlan(p=>{ const m=Object.assign({},atMap()); if(to===home) delete m[id]; else m[id]=to; p.at=m });
  return true;
}
function resetWeekPlacement(monday){
  mutatePlan(p=>{ const m=Object.assign({},atMap());
    for(let sl=0;sl<7;sl++) delete m[sessId(monday,sl)];
    p.at=m });
}
// Has anything in this week been moved, or anything moved into it?
function isReordered(monday){
  for(let sl=0;sl<7;sl++) if(sessMoved(monday,sl)) return true;
  for(const v of Object.values(atMap())) if(isDateStr(v)&&mondayOf(v)===monday) return true;
  return false;
}
// The slot a date's main session comes from, kept because a great deal of the app asks
// for it. Falls back to the day's own slot when the day is empty.
function slotOf(date){ const ss=sessionsOn(date); return ss.length?ss[0].slot:dow(date) }
// For adjacency: two strength days or two hard conditioning days must not touch.
function sessKind(dp){
  if(!dp) return 'other';
  if(dp.t==='lift'&&dp.half) return 'strength'+dp.half.toUpperCase();
  if(dp.t==='lift'||dp.t==='rm5'||dp.t==='test'||dp.t==='travel') return 'strength';
  if(dp.t==='hic') return dp.fmt==='liss'?'easy':'hic';
  // Base Building's week is two circuits with three days between them. Classed as
  // 'other' they were invisible to the adjacency rules and the Move tool would happily
  // put them back to back, which is the one arrangement Block I is built to avoid.
  if(dp.t==='se') return 'se';
  return 'other';
}
function kindName(k){return /^strength[AB]?$/.test(k)?'strength':k==='se'?'strength-endurance':'hard conditioning'}
// Kinds that must not land on consecutive days. One list, used by the arranger and by
// the warning it shows, because when those two disagree the arranger silently wins.
/* What must not land on consecutive days.

   Only strength, and only the same session twice. That is the book's own principle
   for moving things around, stated as a principle: "It's not set in stone. As long as
   you adhere to the principles - one rest day. No back to back same sessions.
   Completed within 7 days." (TB1). Zulu's A and B are different sessions, which is why
   they carry their own kinds and are allowed to touch.

   Conditioning used to be in here and should never have been. TB II could not be
   plainer: "Your HIC and E can be done on any day, not just days 2, 4, and 6. You can
   do two days in a row, or whatever. As long as you're hitting your weekly minimums."
   Spreading them out is still the better default, so `weekShape` and `bestOrder` go on
   preferring it -- but preferring is not refusing, and the app was refusing. */
const ADJACENT_BAN=['strength','strengthA','strengthB'];
function clashes(a,b){return !!a&&a===b&&ADJACENT_BAN.includes(a)}
// Worth avoiding when there is a choice, without being a reason to refuse an
// arrangement the books allow.
const ADJACENT_SOFT=['hic','se'];
function crowds(a,b){return !!a&&a===b&&ADJACENT_SOFT.includes(a)}
/* Whether a week's own layout puts two hard days of a kind together. Nothing refuses
   on this any more -- moving a session is the person's call -- so what is left is a
   check on the shape the templates and protocols generate, which is where it belongs:
   a protocol that lays out a clashing week by default is a bug in the protocol. */
function orderIssues(monday,ord){
  const K=[],N=[], prev=addDays(monday,-1), next=addDays(monday,7);
  K.push(idxOf(prev)>=0?sessKind(dayPlan(prev)):'other'); N.push(DAYN[6]+' before');
  for(let i=0;i<7;i++){K.push(sessKind(dayPlanSlot(addDays(monday,i),ord[i])));N.push(DAYN[i])}
  K.push(weekOf(next)?sessKind(dayPlan(next)):'other'); N.push('next '+DAYN[0]);
  const out=[];
  for(let i=1;i<K.length;i++) if(clashes(K[i],K[i-1])) out.push({a:N[i-1],b:N[i],kind:K[i]});
  return out;
}
/* The same walk, for the arrangements that are allowed but not ideal. Kept separate
   from `orderIssues` on purpose: one is a refusal and the other is a remark, and
   collapsing them is how the app ended up refusing what the book permits. */
function orderCrowding(monday,ord){
  const K=[],N=[], prev=addDays(monday,-1), next=addDays(monday,7);
  K.push(idxOf(prev)>=0?sessKind(dayPlan(prev)):'other'); N.push(DAYN[6]+' before');
  for(let i=0;i<7;i++){K.push(sessKind(dayPlanSlot(addDays(monday,i),ord[i])));N.push(DAYN[i])}
  K.push(weekOf(next)?sessKind(dayPlan(next)):'other'); N.push('next '+DAYN[0]);
  const out=[];
  for(let i=1;i<K.length;i++) if(crowds(K[i],K[i-1])) out.push({a:N[i-1],b:N[i],kind:K[i]});
  return out;
}
// Which weeks run plyos at all, and on which weekday. Attached in dayPlan rather than
// baked into a slot: a slot belongs to the arrangement of the week and gets shuffled by
// the Move tool, and plyos should not be shuffled with it. 0 = Monday.
function weekHasPlyo(wk){ return plan.plyoOn!==false&&!!wk&&['cycle','deload','travel'].includes(wk.kind) }
function plyoDow(monday){
  const o=(plan.plyoMove||{})[monday];
  const v=o!=null?+o:+plan.plyoDow;
  return (v>=0&&v<=6)?v:3;
}
function plyoMoved(monday){ return (plan.plyoMove||{})[monday]!=null }
/* One session a week or two.

   The plyo program this app follows says once a week, so two is the app's own addition
   and labelled as such wherever it appears. The case for it: the governing rule of the
   whole thing is that every rep is near-maximal, and fatigue builds inside a session
   long before it builds across a week. Half the contacts twice over is the same weekly
   work with fresher reps in it.

   The case against is tendon load, which is what the pull-back list is really about, and
   two landing days a week is two days of it. So the split halves the volume rather than
   doubling it — the week's contact target is unchanged and each session carries half. */
function plyoPerWeek(){ return +plan.plyoPerWeek===2?2:1 }
function plyoShare(){ return plyoPerWeek()===2?0.5:1 }
function plyoDow2(){
  const raw=plan.plyoDow2;
  if(raw==null||raw==='') return (plyoDowDefault()+3)%7;   // 72 hours on from the first
  const v=+raw; return (v>=0&&v<=6)?v:(plyoDowDefault()+3)%7;
}
// How far apart two days are on a seven-day loop, which is what decides whether the
// second session has had time to recover from the first.
function plyoGap(a,b){ const d=Math.abs(a-b); return Math.min(d,7-d) }
function plyoDowDefault(){ const v=+plan.plyoDow; return (v>=0&&v<=6)?v:3 }
// Every weekday this week has plyos on, first session first.
function plyoDows(monday){
  const a=[plyoDow(monday)];
  if(plyoPerWeek()===2&&plyoDow2()!==a[0]) a.push(plyoDow2());
  return a.sort((x,y)=>x-y);
}
/* Picking plyo days from one row of seven.

   Both chosen days stay lit, numbered in the order the week runs them. Tapping a day
   that is already chosen does nothing — you cannot have fewer sessions than you asked
   for — and tapping a new one replaces whichever you picked longer ago, so the pair
   slides along rather than needing a "which one am I setting" control. */
function plyoPick(days,per,d){
  const cur=days.filter(v=>v>=0&&v<=6);
  if(cur.includes(d)) return cur.slice();
  if(per!==2) return [d];
  return cur.length<2?[...cur,d]:[cur[1],d];
}
// Plyos are not part of a session, so they move on their own. Picking a day for one week
// overrides the usual day for that week only; picking the usual day again clears it.
// Weeks that have gone by are left alone, and so are days already past in this week.
function plyoDayOpen(monday,d){
  const t=realToday(), curMon=mondayOf(t);
  if(monday<curMon) return false;
  if(monday===curMon&&d<dow(t)) return false;
  return true;
}
function setPlyoDay(monday,d){
  d=+d; if(!(d>=0&&d<=6)) return false;
  if(!weekHasPlyo(weekOf(monday))) return false;
  if(!plyoDayOpen(monday,d)) return false;
  mutatePlan(p=>{
    const m=Object.assign({},p.plyoMove||{});
    if(d===(+p.plyoDow>=0&&+p.plyoDow<=6?+p.plyoDow:3)) delete m[monday]; else m[monday]=d;
    p.plyoMove=m;
  });
  return true;
}
/* Lifting, conditioning, or neither. The only ordering rule the books give for two
   sessions on one day is that the lifting comes first, so this is what decides it. */
function stackKindOf(dp){
  const k=sessKind(dp);
  if(/^strength/.test(k)) return 'lift';
  if(k==='hic'||k==='easy'||dp.t==='se') return 'cond';
  return 'rest';
}
/* Every session on a date, in the order they should be done: lifting first, which is
   the only ordering the book asks for when two share a day. Each carries where it came
   from, so a session sitting on a day that is not its own can say so and be put back.
   A date with nothing on it returns an empty list, and that is what a rest day is. */
function dayPlans(date){
  const out=[];
  for(const {monday,slot,home} of sessionsOn(date)){
    const wk=weekAt(monday); if(!wk) continue;
    const dp=dayPlanSlot(home,slot);
    if(!dp||dp.t==='off'||dp.t==='pre') continue;      // a rest slot is not a session
    // Namespaced: a travel day already has its own `slot` ('day3'), and quietly
    // overwriting it moved the mobility block off the hinge day.
    out.push(Object.assign({},dp,{sess:{monday,slot,home},moved:home!==date}));
  }
  const rank=d=>stackKindOf(d)==='lift'?0:1;
  return out.sort((a,b)=>rank(a)-rank(b));
}
function weekAt(monday){ const i=idxOf(monday); if(i<0) return null; return weeks(i+10)[i] }
function dayPlan(date){
  const wk=weekOf(date); if(!wk) return {t:'pre'};
  const all=dayPlans(date);
  let dp=all.length?all[0]:{t:'off',short:'Off'};
  if(all.length>1) dp=Object.assign({},dp,{more:all.slice(1),short:all.map(x=>x.short||'Session').join(' + ')});
  else if(all.length===1&&dp.moved) dp=Object.assign({},dp,{short:dp.short||'Session'});
  const pn=weekHasPlyo(wk)?plyoDows(mondayOf(date)).indexOf(dow(date)):-1;
  if(pn>=0){
    // A deload halves the contacts, as the week it sits in does to everything else.
    // The label carries them too, so the week strip, the calendar feed and the CSV all
    // say which day has plyos without anyone having to open it.
    const bare=['off','pre'].includes(dp.t);
    const two=plyoDows(mondayOf(date)).length>1, nm=two?'Plyo '+(pn+1):'Plyo';
    return Object.assign({},dp,{plyo:true,plyoN:pn+1,plyoCut:dp.plyoCut||wk.kind==='deload',
      short:bare?nm:nm+'+'+(dp.short||'Session')});
  }
  return dp;
}
/* ---------- the retest planner ----------
Which lifts to test on which of a week's test days. Ours, not the book's: TB1 tests the
whole cluster in one session. Split because tired singles measure fatigue rather than
strength, and the days were sitting empty.

  - at most two lifts a day while the days allow it; three only when they do not
  - squat and deadlift never on the same day
  - the pairing the bridge week uses: squat with bench, deadlift with Lift 3
  - spare days fall between test days rather than after them, so each test day comes
    off a rest -- which is why the usual four lifts test Thursday and Saturday

Returns one list per available day, empty where nothing is tested. */
function testSplit(slots){
  const n=3+l3On().length;
  const cap=Math.max(2,Math.ceil(n/slots)), need=Math.min(slots,Math.ceil(n/cap));
  const buckets=Array.from({length:need},()=>[]);
  // Each lift looks first where it pairs, then forward, then back: so Lift 3 joins the
  // deadlift and overflows onto a later day before it crowds squat and bench.
  const at=k=>buckets.findIndex(b=>b.includes(k));
  const put=(k,from)=>{
    const idx=[...Array(need).keys()], tryOrder=idx.slice(from).concat(idx.slice(0,from));
    (tryOrder.map(i=>buckets[i]).find(x=>x.length<cap)||buckets[need-1]).push(k);
  };
  // Squat and deadlift apart by construction: squat opens the first test day, and the
  // deadlift opens the next. There are always at least two -- the cluster is never
  // under four lifts -- and a test checks it for every Lift 3 combination.
  put('squat',0); put('bench',at('squat'));
  put('dead',at('squat')+1);
  for(const k of l3On()) put(k,at('dead'));
  const out=Array.from({length:slots},()=>[]);
  buckets.forEach((b,i)=>{ out[need===1?0:Math.round(i*(slots-1)/(need-1))]=b });
  return out;
}
function dayPlanSlot(date,d){
  const wk=weekOf(date); if(!wk) return {t:'pre'};
  const SBP=['squat','bench',l3For(date)], SBD=['squat','bench','dead'];
  if(wk.kind==='cycle') return composeSlot(date,wk,d);
  if(wk.kind==='deload') return [
    {t:'lift',deload:true,lifts:SBP,short:'Lift'},
    {t:'hic',fmt:'liss',short:'LISS'},
    {t:'lift',deload:true,lifts:SBP,short:'Lift'},
    {t:'hic',fmt:'liss',short:'LISS'},
    {t:'lift',deload:true,lifts:SBD,short:'Lift'},
    {t:'hic',fmt:'liss',short:'LISS',note:'Optional. Take it off if you feel flat.'},
    {t:'off',short:'Off'}][d];
  if(wk.kind==='test') return [
    {t:'hic',fmt:'liss',short:'Easy',note:'Easy day. 20–30 min of conversational cardio.'},
    {t:'off',short:'Mobility',note:'Easy day. Mobility only: the warm-up hip and t-spine work. No cardio — the two heavy test days are what this week is for.'},
    {t:'hic',fmt:'liss',short:'Easy',note:'Easy day. 20–30 min of conversational cardio.'},
    // Thursday to Saturday, split by testSplit: jumps on the first test day, the pull-up
    // test and the button that applies the results on the last.
    ...(()=>{const sp=testSplit(3);return sp.map((L,i)=>L.length?Object.assign({t:'test',lifts:L,short:'Test'},i===0?{jumps:true}:{},i===2?{pullups:true,apply:true}:{}):{t:'off',short:'Off'})})(),
    {t:'off',short:'Off'}][d];
  if(wk.kind==='bb'){
    const row=bbRow(wk)[d]||['rest'], k=row[0];
    if(k==='se') return {t:'se',circuits:row[1],reps:row[2],pct:row[3]||null,short:'SE '+row[1]+'×'+row[2]};
    if(k==='e') return {t:'hic',fmt:'liss',eMin:row[1],eMax:row[2]||row[1],short:'E '+row[1]+(row[2]?'–'+row[2]:'')+'m',
      note:wk.ver==='mass'?'Thirty minutes, and the book means it — no more, no less. Low intensity throughout: the talk test, or 120 to 150 bpm. No intervals, no sprints, no going fast. Anything continuous counts, so walk or ride if thirty minutes of running is a lot.':d===5?'The long one. You have a recovery day behind you and a rest day ahead, so push the duration — a long ruck, a longer run than you have done, or one of the fun-runs.':'Minimum 30 minutes, conversational. Run-walk-run is fine and still aerobic.'};
    if(k==='hic') return {t:'hic',fmt:(plan.bbHic||{})[monAdd(wk.monday,d)]||'map',bbHic:true,short:'HIC',
      note:'Weeks 6–8 use the aerobic-leaning HIC sessions only. Keep off the purely lactic ones: you cannot build the aerobic and lactic systems at once.'};
    if(k==='ms') return {t:'lift',lifts:d===0?['squat','bench',l3For(date)]:['squat','bench','dead'],bbLift:true,short:'Strength',
      note:'Two strength days a week this block, kept spartan. Two or three compounds, no assistance work.'};
    if(k==='rec') return {t:'off',recovery:true,short:'Recovery',
      note:'Movement drills, mobility, an easy swim or bike, a walk, yoga, a massage. Or nothing. If you are still raring to go, one easy E session or half an SE circuit is allowed.'};
    return {t:'off',short:'Rest',note:'Complete rest. No structured training. Walking, a casual swim or pick-up sport is fine.'};
  }
  /* Tactical Barbell III's Bridge Week: a week off between blocks, which the book also
     calls deloading. Light activity only -- walking, hiking, an easy swim, yoga,
     stretching, easy bodyweight circuits -- and no weights, HIC or E. Testing is
     optional and goes on day 4, day 5 or both; "if no 1RM testing is required then Test
     Days become Rest Days", so the app offers those days rather than imposing them. The
     book asks for one every two to three months whether you feel like it or not.

     Not to be confused with the app's own bridge week above, which is a calibration
     week at the very start and is ours, not the book's. */
  /* Ageless Athlete's recovery week, the "1" in 3-1-3-1. The book is specific about
     what it is: "I do stay entirely away from barbells and HIC during recovery weeks.
     That is the key to recharging the CNS, joints, hormones, etc." Not an off week
     though -- "no more than two workouts that week, plus any other activities you
     might have, and remember to keep the workouts easy", plus as much mobility as you
     like. Two easy sessions, spread out, and nothing else scheduled. */
  if(wk.kind==='recovery'){
    const easy=n0=>({t:'hic',fmt:'liss',recovery:true,short:'Easy',note:n0});
    const a='One of your two sessions this week, and it is meant to be easy. An LSS session, a grip circuit, core work, strength-endurance, general conditioning — something you do not normally get to. No barbells and no HIC: staying off those is the whole point of the week.';
    const b='The second and last session. Easy again. Anything you already do — a class, a roll, a game — counts on top of these two and does not need to come out.';
    const off=n0=>({t:'off',recovery:true,short:'Recovery',note:n0});
    const rest='Nothing scheduled. Mobility and stretching as much as you like, and that is the best use of this week beyond the two easy sessions.';
    return [easy(a),off(rest),off(rest),easy(b),off(rest),off(rest),
      {t:'off',recovery:true,short:'Off',note:'Complete rest. Next week the barbells come back.'}][d];
  }
  if(wk.kind==='bridge3'){
    const ease='Light activity only. Walking, hiking, an easy swim, yoga, stretching, an easy bodyweight circuit. No weights, no HIC, no E — this week is for recovering, which is when the work you have already done actually lands.';
    const light=()=>({t:'off',bridge3:true,short:'Light',note:ease});
    // Two optional test days, split the same way as a retest week.
    const sp=testSplit(2);
    return [
      light(), light(), light(),
      {t:'test',lifts:sp[0],bridge3:true,short:'Test',
        note:'Optional. Test here if the next block needs new numbers — otherwise this is another rest day. The book only asks you to test once before you start, and maybe again before your first Specificity block.'},
      {t:'test',lifts:sp[1],apply:true,bridge3:true,short:'Test',
        note:'Optional, the same as day 4. Testing both days is fine, and so is testing neither.'},
      light(),
      {t:'off',bridge3:true,short:'Rest',note:'Complete rest.'},
    ][d];
  }
  if(wk.kind==='bridge') return [
    {t:'off',short:'—',note:'Bridge week starts Tuesday.'},
    {t:'rm5',lifts:['squat','bench'],short:'5RM'},
    {t:'hic',fmt:'map',baseline:true,short:'HIC',note:'Baseline: 8 × 1 min. Record total calories.'},
    {t:'plyobase',short:'Jumps'},
    {t:'rm5',lifts:['dead',l3On()[0]],short:'5RM'},
    l3On().length>1?(()=>{const rest=l3On().slice(1);return {t:'rm5',lifts:rest,cardio:true,fmt:'liss',short:'5RM+Spin',note:rest.length>1?'Test these first — two lifts per day keeps the numbers honest — then ride easy for 30–40 min.':'Test the '+liftName(rest[0]).toLowerCase()+' first — it is on its own day so the number is honest — then ride easy for 30–40 min.'}})():{t:'hic',fmt:'liss',short:'Easy',note:'30–40 min easy cardio.'},
    {t:'convert',short:'Maxes'}][d];
  if(wk.kind==='travel') return [
    {t:'travel',slot:'day1',short:'Travel 1'},
    {t:'hic',fmt:'map',short:'HIC'},
    {t:'travel',slot:'day2',short:'Travel 2'},
    {t:'hic',fmt:'anaerobic',short:'HIC'},
    {t:'travel',slot:'day3',short:'Travel 3'},
    {t:'hic',fmt:'threshold',short:'HIC',note:'Swap to LISS or a walk if the week has been long.'},
    {t:'off',short:'Off'}][d];
  return {t:'off',short:'Off',note:'Off week. Walk, sleep, eat. The plan resumes next Monday.'};
}
// The block's row for a week, after the strength-first swap if that version is running.
function bbLen(ver){ return BB_LEN[ver||'standard']||8 }
function bbRow(wk){
  const ver=wk.ver||'standard', clamp=t=>t[Math.min(Math.max((wk.w||1)-1,0),t.length-1)];
  if(ver==='mass') return clamp(BB_MASS);
  const base=clamp(BB_WEEKS);
  if(ver!=='strength') return base;
  const r=BB_SF_SE[Math.min(Math.max((wk.w||6)-6,0),BB_SF_SE.length-1)];
  return base.map((x,i)=>x[0]==='se'?['ms']:x[0]==='ms'?['se',i===0?r[0]:2,r[1]]:x);
}
/* Ageless Athlete's alternative to a test week: "Consider testing within the block by
   doing either a heavy-ish single > 95% or a rep max on the last day of your strength
   block before a recovery week." True only on the last lifting day of a training week
   that a recovery week follows. */
function inBlockCheck(date){
  if(!plan.recovery313) return false;
  const wk=weekOf(date);
  if(!wk||wk.kind!=='cycle') return false;
  const next=weekOf(addDays(wk.monday,7));
  if(!next||next.kind!=='recovery') return false;
  let last=-1;
  for(let i=0;i<7;i++){ const p=dayPlanSlot(addDays(wk.monday,i),i); if(p.t==='lift'&&(p.lifts||[]).length) last=i }
  return last>=0&&addDays(wk.monday,last)===date;
}
function weekTitle(wk){
  if(!wk) return 'Before start';
  if(wk.kind==='cycle'){const v=wkRx(wk);return {t:'Cycle '+wk.cycle+' · Week '+wk.w,chip:v.s+'×'+v.r+' @ '+v.p+'%',cls:tier(+v.p)}}
  if(wk.kind==='deload'){const v=wkRx(wk);return {t:'Deload week',chip:v.s+'×'+v.r+' @ '+v.p+'%',cls:'light'}}
  if(wk.kind==='test') return {t:'Retest week',chip:'Heavy singles',cls:'heavy'};
  if(wk.kind==='bb'){
    const r=bbRow(wk), se=r.filter(x=>x[0]==='se').length, ms=r.filter(x=>x[0]==='ms').length;
    return {t:'Base Building · Week '+wk.w+' of '+bbLen(wk.ver),chip:ms?'Strength + HIC':'SE + endurance',cls:ms?'mid':'light'};
  }
  if(wk.kind==='bridge') return {t:'Bridge week',chip:'Calibration',cls:'blue'};
  if(wk.kind==='bridge3') return {t:'Bridge week · TB III',chip:'A week off',cls:'light'};
  if(wk.kind==='recovery') return {t:'Recovery week',chip:'No barbells, no HIC',cls:'light'};
  if(wk.kind==='travel') return {t:'Travel week',chip:'Minimal kit',cls:'mid'};
  return {t:'Off week',chip:'Rest',cls:''};
}
function plyoPhase(wk){ if(wk.kind==='cycle') return PLYO[Math.floor((wk.plyoIdx%9)/3)]; return PLYO[0]; }
function holidays(y){
  const nth=(m,wd,k)=>{const f=new Date(Date.UTC(y,m,1)).getUTCDay();return S(Date.UTC(y,m,1+((wd-f+7)%7)+7*(k-1)))};
  const last=(m,wd)=>{const l=new Date(Date.UTC(y,m+1,0));return S(Date.UTC(y,m,l.getUTCDate()-((l.getUTCDay()-wd+7)%7)))};
  const tg=nth(10,4,4);
  return {[y+'-01-01']:"New Year's Day",[last(4,1)]:'Memorial Day',[y+'-07-04']:'Independence Day',[nth(8,1,1)]:'Labor Day',[tg]:'Thanksgiving',[addDays(tg,1)]:'Day after Thanksgiving',[y+'-12-24']:'Christmas Eve',[y+'-12-25']:'Christmas'};
}
function holidayOn(date){return holidays(+date.slice(0,4))[date]||null}
function effFmt(date){const L=logs[date];const dp=dayPlan(date);return (L&&L.hic&&L.hic.format)||dp.fmt}
function defMod(){const m=(plan.cardio||{}).def;return MOD[m]?m:'echo'}
// Sessions logged before activities existed have calories but no activity: they were on the Echo bike.
function modOf(date){const H=(logs[date]||{}).hic;if(H&&MOD[H.mod])return H.mod;if(H&&H.cal!=null&&H.cal!=='')return 'echo';return defMod()}
function metricFor(mod,fmt){
  if(HIC[fmt]&&HIC[fmt].noMetric)return null;
  const M=MOD[mod], m=M&&M[fmt==='liss'?'liss':'hic'];
  if(!m)return null;
  let un=m[1];
  // Symmetric, so a distance can be declared in either system and still follow the
  // setting. Without the imperial half, anything written in meters was simply stuck
  // there and `fixedUnit` protected nothing.
  if(!M.fixedUnit){
    if(u()==='kg'){ if(un==='mi')un='km'; if(un==='yd')un='m' }
    else { if(un==='km')un='mi'; if(un==='m')un='yd' }
  }
  return [m[0],un];
}
function metricLabel(met){return met[0]==='cal'?'Total calories':met[0]==='watts'?'Average watts':met[0]==='floors'?'Floors':'Distance ('+met[1]+')'}
// Conditioning results. `all` spans every program (for "last/best" comparisons);
// otherwise only the program on screen.
// Distance plus what the climbing was worth, for sessions logged in miles or km.
function flatEquiv(x){
  if(!x||x.elev==null||x.elev===''||!(+x.v>0)) return null;
  if(x.u!=='mi'&&x.u!=='km') return null;
  const per=elevPerDist(); if(!(per>0)) return null;
  const v=+x.v+(+x.elev)/per;
  return Math.abs(v-+x.v)<0.05?null:Math.round(v*10)/10;
}
/** What to rank a session by: flat-equivalent where climbing applies, else the raw result. */
function hicValue(x){const fe=flatEquiv(x);return fe!=null?fe:(x?+x.v:null)}
function hicSessions(all){
  const out=[];
  for(const [d,L] of Object.entries(logs)){
    if(!all&&!inProgram(d)) continue;
    if(L.hic){ const f=effFmt(d);
      if(f){ const mod=modOf(d), met=metricFor(mod,f), v=met?L.hic[met[0]]:null;
        if((v!=null&&v!=='')||(f==='liss'&&L.hic.min)||((HIC[f]||{}).noMetric&&(L.hic.min||L.hic.rounds))||(mod==='other'&&L.hic.what)) out.push({d,f,mod,v:v!=null&&v!==''?+v:null,u:met?met[1]:'',min:L.hic.min,what:L.hic.what,load:L.hic.load,elev:L.hic.elev}); } }
    // Sessions you did on top of the program count as training. They are the same
    // shape, carry `extra` so adherence can leave them alone, and otherwise feed the
    // minutes, the records and the benchmark like any other session.
    for(const a of addonsOf(d)){
      if(a.kind!=='cond'||!HIC[a.fmt]||!MOD[a.mod]) continue;
      const met=metricFor(a.mod,a.fmt), v=met?a.val:null;
      if((v!=null&&v!=='')||a.min) out.push({d,f:a.fmt,mod:a.mod,v:v!=null&&v!==''?+v:null,u:met?met[1]:'',min:a.min,what:a.what,load:a.load,elev:a.elev,extra:true});
    }
  }
  return out.sort((a,b)=>a.d<b.d?-1:1);
}
/* ---------- sessions you added yourself ----------
A program is a plan, not a record of what happened. A ride on a rest day, a second
lifting session, a class somebody dragged you to: it was training and it belongs in the
log. Kept apart from the prescribed session rather than merged into it, because the two
answer different questions -- what was I told to do, and what did I do.

They count toward conditioning minutes, records, the climbing total and the benchmark.
They are deliberately invisible to adherence, the cycle review and your maxes: none of
those is asking what you did, they are asking how the program went. */
function addonsOf(date){ const a=(logs[date]||{}).addons; return Array.isArray(a)?a.filter(x=>x&&x.kind):[] }
function addonAdd(date,kind){
  if(readOnly()) return null;
  const list=addonsOf(date).slice();
  const a=kind==='lift'?{kind:'lift',what:'',sets:[]}
                       :{kind:'cond',mod:defMod(),fmt:'liss',what:'',min:'',val:''};
  list.push(a); setLog(date,'addons',list);
  return list.length-1;
}
function addonDel(date,i){
  const list=addonsOf(date).slice();
  if(i<0||i>=list.length) return false;
  list.splice(i,1); setLog(date,'addons',list); return true;
}
// Sets on an added lifting session are free-form: a weight and a rep count, as many as
// you did. No percentages, because there is no max behind an exercise the app invented.
function addonSets(a){ return Array.isArray(a&&a.sets)?a.sets:[] }
function addonSetAdd(date,i){
  const list=addonsOf(date).slice(), a=list[i]; if(!a||a.kind!=='lift') return false;
  list[i]=Object.assign({},a,{sets:addonSets(a).concat([{w:'',r:''}])});
  setLog(date,'addons',list); return true;
}
function addonSetDel(date,i,j){
  const list=addonsOf(date).slice(), a=list[i]; if(!a||a.kind!=='lift') return false;
  const sets=addonSets(a).slice(); if(j<0||j>=sets.length) return false;
  sets.splice(j,1); list[i]=Object.assign({},a,{sets}); setLog(date,'addons',list); return true;
}
function addonLabel(a){
  if(a.kind==='lift') return a.what||'Extra lifting';
  const m=MOD[a.mod], f=HIC[a.fmt];
  return (a.what||(m?m.name:'Cardio'))+(f?' · '+f.name:'');
}

/* ---------------- persistence ---------------- */
// One JSON document per path (plan/main, logs/YYYY-MM-DD), stored in D1 behind /api.
// The phone keeps its own copy (ob.cache) so the app opens offline, and an outbox of
// unsent documents (ob.outbox) so changes made offline survive closing the app.
// Writes are debounced per document; failed writes retry until they land.
const writers={};
let loaded=false, signedOut=false;
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
let outbox=LS.get('ob.outbox')||{};
function saveOutbox(){LS.set('ob.outbox',outbox)}
let cacheTimer=null;
function saveCache(){clearTimeout(cacheTimer);cacheTimer=setTimeout(()=>LS.set('ob.cache',{plan:stash?stash.plan:plan,logs,programs}),800)}
// Who's signed in. Everything on the server is theirs alone; the phone's copy is wiped
// if a different person signs in on the same device.
let me=LS.get('ob.user');
function docFor(path){return path==='plan/main'?(stash?stash.plan:plan):path.startsWith('programs/')?programs[path.slice(9)]:logs[path.slice(5)]}
function pending(path){const w=writers[path];return !!(w&&(w.dirty||w.busy||w.timer))||!!outbox[path]}
function anyPending(){return Object.keys(writers).some(pending)||Object.keys(outbox).length>0}
function waitingCount(){return Object.keys(outbox).length}
async function api(method,path,body){
  const r=await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'manual',
    headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  // An expired Access session answers with a redirect to the login page.
  if(r.type==='opaqueredirect'){const e=new Error('signed out');e.status=401;throw e}
  if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e}
  return r.status===204?null:r.json();
}
function errText(e){
  if(e&&(e.status===401||e.status===403)) return 'Signed out · tap to sign in';
  if(e&&e.status===413) return 'Entry too large to save';
  const w=waitingCount();
  if(e&&e.status) return 'Server error '+e.status+' · retrying';
  return 'Offline'+(w?' · '+w+' waiting':' · saved on phone');
}
function queueWrite(path,get){
  if(!loaded){setStatus('Still loading…',true);return}
  const w=writers[path]||(writers[path]={});
  w.get=get;w.dirty=true;clearTimeout(w.timer);
  outbox[path]=clone(get()); saveOutbox(); saveCache();
  setStatus(navigator.onLine===false?errText(null):'Saving…',navigator.onLine===false);
  w.timer=setTimeout(()=>{w.timer=null;flush(path)},500);
  // The calendar is generated from the plan, so a plan write is the only thing that can
  // change it. calPush debounces and compares before uploading, so this is usually free.
  if(path==='plan/main'&&typeof calPush==='function') calPush();
}
async function flush(path){
  const w=writers[path]||(writers[path]={get:()=>outbox[path]});
  if(w.busy){w.again=true;return} if(!w.dirty)return;
  w.dirty=false;w.busy=true;
  const body=clone(w.get()), sent=JSON.stringify(body);
  try{
    await api('PUT','/doc/'+path,body);
    if(outbox[path]&&JSON.stringify(outbox[path])===sent){delete outbox[path];saveOutbox()}
    signedOut=false; if(!anyPendingExcept(path)) setStatus('Saved');
  }
  catch(e){
    if(e&&(e.status===401||e.status===403)) signedOut=true;
    setStatus(errText(e),true);
    if(!(e&&e.status===413)){ w.dirty=true; clearTimeout(w.timer); w.timer=setTimeout(()=>{w.timer=null;flush(path)},signedOut?30000:5000) }
  }
  w.busy=false; if(w.dirty&&!w.timer||w.again){w.again=false;flush(path)}
}
function anyPendingExcept(path){return Object.keys(writers).some(p=>p!==path&&pending(p))||Object.keys(outbox).some(p=>p!==path)}
function setStatus(t,err){const el=document.getElementById('status');el.textContent=t;el.className=err?'err':'';el.classList.toggle('link',signedOut);if(typeof acctPaint==='function')acctPaint()}
function readOnly(){
  if(schemaAhead){ setStatus('App out of date · read-only',true); render(); return true }
  if(viewing){ setStatus('Archived program · read-only',true); render(); return true }
  return false;
}
// Bring stored data up to SCHEMA, then save whatever actually changed. Runs on every load
// and after every sync, and costs one integer comparison when there is nothing to do.
/* `write` is false for the migration that runs at boot, off the phone's cached copy,
   and that distinction matters more than it looks.

   A queued write makes a document *pending*, and applyState deliberately keeps a pending
   local document instead of the server's, so unsent edits are never silently lost. Boot
   used to migrate the cache and queue a plan write before the server had been heard from,
   which turned "this phone's copy is a few days behind" into "this phone's copy wins".

   A real account lost its maxes and most of its Setup this way, somewhere between the
   4 and 11 October backups — a window with three schema bumps in it. The logs were never
   touched, because only plan/main is written at boot, which is exactly the signature of
   this bug rather than of a bad migration. Found on 12 October while looking for
   something else, and first blamed on that day's bump; the 11 October backup showed the
   damage already done, so the date was wrong and the mechanism was not.

   So the boot pass migrates in memory only, to draw a correct screen. The write happens
   in applyState, against whichever copy actually won. Offline, the migrated shape still
   goes into the local cache and is written on the next sync. */
function migrate(write){
  const at=+(plan.schema||0);
  if(at===SCHEMA) return false;
  if(at>SCHEMA){ schemaAhead=true; return false }   // the backwards half: stop writing
  schemaAhead=false;
  const d={logs,programs}, before={};
  for(const [id,L] of Object.entries(logs)) before['logs/'+id]=JSON.stringify(L);
  for(const [id,P] of Object.entries(programs)) before['programs/'+id]=JSON.stringify(P);
  for(const m of MIGRATIONS) if(m.to>at&&m.to<=SCHEMA) m.run(d,plan);
  plan.schema=SCHEMA; planV++;
  if(write===false) return true;
  queueWrite('plan/main',()=>plan);
  for(const [id,L] of Object.entries(logs)) if(JSON.stringify(L)!==before['logs/'+id]) queueWrite('logs/'+id,()=>logs[id]);
  for(const [id,P] of Object.entries(programs)) if(JSON.stringify(P)!==before['programs/'+id]) queueWrite('programs/'+id,()=>programs[id]);
  return true;
}
function setLog(date,path,v){ if(readOnly()) return; if(!logs[date]) logs[date]={date}; setPath(logs[date],path,v); logsV++; queueWrite('logs/'+date,()=>logs[date]); }
function setPlan(path,v){ if(readOnly()) return; setPath(plan,path,v); planV++; queueWrite('plan/main',()=>plan); }
function mutatePlan(fn){ if(readOnly()) return; fn(plan); planV++; queueWrite('plan/main',()=>plan); render(); }

/* ---------------- when two devices disagree ----------------
Writes replace whole documents and the last one in wins. For one person that is almost
always right, because a device with nothing to say sends nothing: only documents this
phone actually changed are ever uploaded.

The exception is both devices editing the same day while offline. Below, a document with
unsent local changes is kept and the server's copy dropped — which is a defensible
choice, but it used to happen in silence. Now it is written down and shown in Setup, so
"my Tuesday looks wrong" has an answer instead of being a mystery.

Device-local, like the error log: it describes what this phone did, not what happened. */
const CONFLICT_KEEP=10;
function conflicts(){const v=LS.get('ob.conflicts');return Array.isArray(v)?v:[]}
function clearConflicts(){LS.set('ob.conflicts',[]);render()}
function noteConflict(path){
  try{
    const all=conflicts().filter(c=>c.path!==path);
    all.unshift({path,at:new Date().toISOString()});
    LS.set('ob.conflicts',all.slice(0,CONFLICT_KEEP));
  }catch(e){}
}

function applyState(st){
  let changed=false;
  for(const [id,d] of Object.entries(st.programs||{})){
    if(pending('programs/'+id)){ if(JSON.stringify(d)!==JSON.stringify(programs[id])) noteConflict('programs/'+id); continue }
    if(JSON.stringify(d)!==JSON.stringify(programs[id])){programs[id]=d;changed=true}
  }
  if(stash){ // viewing an archive: refresh the current plan behind it
    if(!pending('plan/main')&&st.plan) stash.plan=deepMerge(clone(DEF),st.plan);
  } else if(!pending('plan/main')){
    const next=st.plan?deepMerge(clone(DEF),st.plan):clone(DEF);
    if(JSON.stringify(next)!==JSON.stringify(plan)){plan=next;planV++;changed=true}
  }
  for(const [id,d] of Object.entries(st.logs||{})){
    if(pending('logs/'+id)){ if(JSON.stringify(d)!==JSON.stringify(logs[id])) noteConflict('logs/'+id); continue }
    if(JSON.stringify(d)!==JSON.stringify(logs[id])){logs[id]=d;changed=true;logsV++}
  }
  // entries removed on the server go away here too (unless this phone has unsent changes)
  if(st.logs) for(const id of Object.keys(logs)) if(!(id in st.logs)&&!pending('logs/'+id)){delete logs[id];changed=true;logsV++}
  saveCache();
  if(!stash&&!pending('plan/main')&&migrate()) changed=true;
  if(changed) render();
}
// Open instantly from the phone's copy, with any unsent changes laid on top.
function loadLocal(){
  const c=LS.get('ob.cache');
  amAdmin=LS.get('ob.admin')===true;
  { const c=LS.get('ob.catalog'); if(Array.isArray(c)) catalog=c }
  if(c){ if(c.plan) plan=deepMerge(clone(DEF),c.plan); logs=c.logs||{}; programs=c.programs||{}; }
  for(const [path,doc] of Object.entries(outbox)){
    if(path==='plan/main') plan=deepMerge(clone(DEF),doc);
    else if(path.startsWith('logs/')) logs[path.slice(5)]=doc;
    else if(path.startsWith('programs/')) programs[path.slice(9)]=doc;
    writers[path]={get:()=>docFor(path),dirty:true};
  }
  planV++;
  // In memory only: see migrate(). A stale cache must never win by being migrated.
  if(c||Object.keys(outbox).length){ loaded=true; migrate(false) }
  return !!c;
}
function flushAll(){for(const p of new Set([...Object.keys(writers),...Object.keys(outbox)])){const w=writers[p]||(writers[p]={get:()=>docFor(p)});if(outbox[p])w.dirty=true;if(w.dirty){clearTimeout(w.timer);w.timer=null;flush(p)}}}
// A different person signed in on this phone: drop the previous person's local copy
// and unsent changes so nothing of theirs is shown or uploaded to the new account.
function switchUser(user){
  for(const w of Object.values(writers)) clearTimeout(w.timer);
  for(const k of Object.keys(writers)) delete writers[k];
  outbox={}; saveOutbox(); LS.set('ob.cache',null); LS.set('ob.rest',null); LS.set('ob.iv',null); LS.set('ob.push',null); LS.set('ob.admin',null); amAdmin=false; LS.set('ob.catalog',null); catalog=[];
  plan=clone(DEF); logs={}; programs={}; stash=null; viewing=null; planV++;
  rest=null; iv=null; showRest(); ivShow();
  me=user; LS.set('ob.user',user);
}
async function connect(){
  if(!loaded) setStatus('Loading…');
  try{
    const st=await api('GET','/state'); signedOut=false;
    // Remembered so the tab does not vanish on a cold or offline open. It is a hint for
    // the page only: every admin route checks again, so a stale yes grants nothing.
    amAdmin=!!st.admin; LS.set('ob.admin',amAdmin);
    if(Array.isArray(st.catalog)){ catalog=st.catalog; LS.set('ob.catalog',catalog) }
    if(st.user&&me&&st.user!==me) switchUser(st.user);
    if(st.user&&!me){me=st.user;LS.set('ob.user',me)}
    loaded=true; applyState(st);
    if(!st.plan&&!Object.keys(st.logs||{}).length&&!plan.onboarded&&!wz){wz=wzNew(false);plan.startMonday=nextMonday();planV++;render()}
    if(!viewing&&freezePast()) render();
    flushAll(); if(!anyPending()) setStatus('Saved');
    healAlerts();
  }
  catch(e){
    if(e&&(e.status===401||e.status===403)) signedOut=true;
    setStatus(loaded?errText(e):(signedOut?'Signed out · tap to sign in':'Can’t reach server · reload'),true);
  }
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') connect() });
window.addEventListener('online',()=>{ flushAll(); connect() });
window.addEventListener('offline',()=>setStatus(errText(null),true));
document.getElementById('status').addEventListener('click',()=>{ if(signedOut) location.replace('/') });

/* ---------------- rendering helpers ---------------- */
function numIn(bind,val,ph,attrs){return `<input type="number" inputmode="decimal" step="any" id="in-${bind.replace(/\./g,'-')}" data-bind="${bind}" data-type="num" value="${val??''}" placeholder="${esc(ph??'')}" ${attrs||''}>`+oddNote(bind,val)}

/* ---------------- does that number look right? ----------------
Nothing stops a bodyweight of 2050 or a 4000 lb squat, and a single fat-fingered weigh-in
now carries a long way: the 7-day average, the protein target, the weighted pull-up load
and the burn estimate all read from it for a fortnight.

This is a note, not a block. Ranges are deliberately wide enough that a genuinely strong
or genuinely light person never sees one, and the value is kept exactly as typed either
way. The note stays until the number is changed, which is the point: a typo should keep
asking rather than be dismissed once and forgotten. */
function oddBand(bind){
  const kg=u()==='kg';
  const W=(lo,hi)=>kg?[Math.round(lo/2.205),Math.round(hi/2.205),'kg']:[lo,hi,'lb'];
  const L=(lo,hi)=>kg?[Math.round(lo*2.54),Math.round(hi*2.54),'cm']:[lo,hi,'in'];
  const b=String(bind||'');
  if(b.includes('.warmup.')) return null;            // ramp rows are too cramped for a note
  if(b==='bodyweight'||b==='checkin.bw') return W(60,400);
  if(b==='bar') return W(5,100);
  if(b==='checkin.kcal') return [500,8000,'kcal'];
  if(b==='checkin.sleepH') return [0,24,'h'];
  if(b==='sleepTarget') return [3,14,'h'];
  if(b==='proteinPerLb') return [0.2,2,'g'];
  if(b==='pullups') return [0,100,'reps'];
  if(b==='meas.neck') return L(8,25);
  if(b==='meas.waist') return L(20,70);
  if(b==='meas.hip') return L(25,80);
  if(/^maxes\./.test(b)||/^test\.[a-z]+\.w$/.test(b)||/^lifts\.[a-z0-9]+\.used$/.test(b)) return W(0,1200);
  return null;
}
function oddNote(bind,val){
  if(val==null||val==='') return '';
  const v=+val; if(!isFinite(v)) return '';
  const band=oddBand(bind); if(!band) return '';
  const [lo,hi,unit]=band;
  if(v>=lo&&v<=hi) return '';
  return `<span class="oddnote">${n(v)} ${esc(unit)} is outside the usual ${n(lo)}\u2013${n(hi)}. Kept as typed \u2014 change it if it was a slip.</span>`;
}
function lg(date){return logs[date]||{}}
function ramp(k,W,t,deload){
  if(isBW(k)) return W==null?[]:W>0&&!deload?[{w:0,r:5,lbl:'BW'},{w:rnd(W*.5,plan.round[k]),r:2,lbl:'50%'}]:[{w:0,r:3,lbl:'BW'}];
  if(!W) return [];
  const inc=plan.round[k], bar=+plan.bar; let st;
  if(k==='pull') st=deload?[[50,10]]:[[40,10],[70,5]];
  else if(deload) st=[[0,10],[50,5]];
  else if(k==='dead') st=t==='light'?[[50,5],[70,3]]:[[40,5],[65,3],[85,1]];
  else {st=[[0,10],[40,5],[55,3],[70,3]]; if(t!=='light') st.push([85,1]); if(t==='heavy') st.push([90,1]);}
  return st.map(([p,r])=>({w:p===0?bar:(k==='pull'?rnd(W*p/100,inc):Math.max(bar,rnd(W*p/100,inc))),r,lbl:p===0?'Bar':p+'%'}));
}
// Plates per side from the gym's inventory (Setup). Greedy is exact for standard sets;
// if a target can't be loaded, `rem` is what's left over per side.
const ALL_PLATES={lb:[55,45,35,25,10,5,2.5,1.25],kg:[25,20,15,10,5,2.5,1.25]};
function plateSet(){const v=((plan.plates||{})[u()]||[]).map(Number).filter(x=>ALL_PLATES[u()].includes(x));return (v.length?v:ALL_PLATES[u()]).sort((a,b)=>b-a)}
function sidePlates(W){
  const bar=+plan.bar; let side=(W-bar)/2; const out=[];
  if(!(W>0)||side<=0) return {list:out,rem:0,bar:side<0};
  for(const p of plateSet()) while(side>=p-1e-9){out.push(p);side-=p}
  return {list:out,rem:side>0.01?Math.round(side*100)/100:0};
}
function loadable(W){const sp=sidePlates(W);return sp.rem?Math.round((W-2*sp.rem)*100)/100:W}
function plates(W){
  const sp=sidePlates(W); if(!sp.list.length&&!sp.rem) return 'Empty bar';
  return 'Per side: '+(sp.list.join(' + ')||'none')+(sp.rem?` · can’t load ${n(sp.rem)} more with your plates (nearest: ${n(loadable(W))})`:'');
}
function platesShort(W){
  const sp=sidePlates(W); if(!(W>0)) return ''; if(!sp.list.length&&!sp.rem) return 'bar';
  return (sp.list.join(' + ')||'—')+' / side'+(sp.rem?' (+'+n(sp.rem)+' short)':'');
}
// A drawn half-barbell: collar, then plates from the heaviest inward, in bumper colors.
function plateCls(p){return u()==='kg'?{25:'pr',20:'pb',15:'py',10:'pg',5:'pw',2.5:'pr',1.25:'pc'}[p]:{55:'pr',45:'pb',35:'py',25:'pg',10:'pw',5:'pr',2.5:'pc',1.25:'pc'}[p]}
function plateDims(p){const big=u()==='kg'?10:25;const h=p>=big?60:p>=(u()==='kg'?5:10)?42:p>=(u()==='kg'?2.5:5)?32:26;const w=u()==='kg'?{25:13,20:12,15:10,10:8,5:6,2.5:5,1.25:4}[p]:{55:14,45:13,35:11,25:9,10:7,5:6,2.5:5,1.25:4}[p];return {w,h}}
function plateSvg(W,big){
  const sp=sidePlates(W); if(!(W>0)) return '';
  let x=52, g='';
  for(const p of sp.list){const d=plateDims(p);g+=`<rect class="plate ${plateCls(p)}" x="${x}" y="${(70-d.h)/2}" width="${d.w}" height="${d.h}" rx="2"><title>${n(p)} ${u()}</title></rect>`;x+=d.w+1.5}
  const lbl=sp.list.length?sp.list.map(n).join(' + '):'bar only';
  return `<svg class="loader${big?' big':''}" viewBox="0 0 ${Math.max(200,x+30)} 70" role="img" aria-label="Per side: ${esc(lbl)}"><rect class="bar-shaft" x="0" y="32" width="44" height="6" rx="1"/><rect class="bar-collar" x="44" y="26" width="7" height="18" rx="1.5"/><rect class="bar-sleeve" x="51" y="31" width="${Math.max(120,x-40)}" height="8" rx="1"/>${g}</svg>`;
}
function testRamp(k,W,isRm5){
  if(isBW(k)) return W==null?[]:W>0?[{w:0,r:5,lbl:'BW'},{w:rnd(W*.5,plan.round[k]),r:2,lbl:'50%'},{w:rnd(W*.75,plan.round[k]),r:1,lbl:'75%'}]:[{w:0,r:3,lbl:'BW'}];
  if(!W) return [];
  const inc=plan.round[k], bar=+plan.bar;
  const st=k==='pull'?(isRm5?[[40,10],[70,3]]:[[40,10],[65,3],[85,1]])
    :isRm5?(k==='dead'?[[40,5],[60,3],[80,1]]:[[0,10],[40,5],[60,3],[75,2],[90,1]])
    :(k==='dead'?[[40,5],[60,3],[75,1],[85,1],[92,1]]:[[0,10],[40,5],[60,3],[75,2],[85,1],[92,1]]);
  return st.map(([p,r])=>({w:p===0?bar:(k==='pull'?rnd(W*p/100,inc):Math.max(bar,rnd(W*p/100,inc))),r,lbl:p===0?'Bar':p+'%'}));
}
function hardSessions(){
  const t=todayStr(), from=addDays(t,-13); let c=0;
  for(const [d,L] of Object.entries(logs)){
    if(d<from||d>t||!L.lifts) continue;
    const g=Object.values(L.lifts).some(x=>ground(x));
    const miss=L.done&&Object.values(L.lifts).some(x=>x&&Array.isArray(x.sets)&&x.sets.length&&x.sets.slice(0,2).some(v=>!v));
    if((+L.rpe>=9)||g||miss) c++;
  }
  return c;
}

/* ---------------- when something breaks ----------------
render() writes one big innerHTML. Before this, a single thrown error anywhere in a view
left a blank page with no clue what happened — mid-session, in a gym, with a loaded bar.

Three parts: render() catches and paints something you can act on, the last few errors
are kept so the failure is reportable rather than "it just broke", and Setup shows them.

Errors are kept on the device only. A stack trace can carry a lift name or a date, and
there is no reason for that to reach the server. */

const CRASH_KEEP = 5;

function crashList(){ const v=LS.get('ob.errs'); return Array.isArray(v)?v:[] }
function crashClear(){ LS.set('ob.errs',[]); render() }

function crashLog(err,where){
  try{
    const e={
      at:new Date().toISOString(),
      where:where||'app',
      view:typeof view==='string'?view:'',
      msg:String((err&&err.message)||err||'Unknown error').slice(0,300),
      // A few frames is enough to find it; the whole trace is noise on a phone screen.
      stack:String((err&&err.stack)||'').split('\n').slice(1,5).map(s=>s.trim()).join('\n').slice(0,600),
      v:typeof APP_VERSION==='string'?APP_VERSION:'',
    };
    const all=[e,...crashList()].slice(0,CRASH_KEEP);
    LS.set('ob.errs',all);
  }catch(e2){}
  try{ if(typeof console!=='undefined'&&console.error) console.error('[operator-black]',where,err) }catch(e3){}
}

// What you see instead of a blank screen. Deliberately plain strings: whatever broke the
// view might break any helper, so this uses nothing but escaping.
function crashHtml(err){
  const msg=esc(String((err&&err.message)||err||'Unknown error').slice(0,300));
  return `<div class="banner alert"><div><b>Something went wrong drawing this screen.</b>
    Your training is saved — this is the display, not your data. Reload, and if it keeps
    happening send me the details below.<div class="mono small" style="margin-top:6px;word-break:break-word">${msg}</div></div>
    <div class="row"><button class="btn sm primary" data-act="reload">Reload</button><button class="btn sm" data-act="errcopy">Copy details</button></div></div>`;
}

// Everything a report needs, as text you can paste into a message.
function crashReport(){
  const list=crashList();
  if(!list.length) return 'No errors recorded.';
  const head=`Operator + Black ${typeof APP_VERSION==='string'?APP_VERSION:''} · ${typeof navigator!=='undefined'?navigator.userAgent:''}`;
  return head+'\n\n'+list.map(e=>`${e.at} · ${e.where} · view ${e.view||'?'} · v${e.v||'?'}\n${e.msg}\n${e.stack||''}`).join('\n\n---\n\n');
}

function crashCard(){
  const list=crashList();
  if(!list.length) return '';
  return `<div class="card"><div class="lift-h"><h2>Problems</h2><span class="chip alert">${list.length}</span></div>
  <p class="note" style="margin:0">Errors this app hit on this device. They are kept here only — never sent anywhere — and a stack trace can name a lift or a date, so read before you share. If one of these lines up with something going wrong, send it to me.</p>
  <div class="stack">${list.map(e=>`<div class="banner"><div class="small"><b>${esc(fmtD(e.at.slice(0,10),true))} ${esc(e.at.slice(11,16))}</b> · ${esc(e.where)}${e.view?' · '+esc(e.view):''}${e.v?' · v'+esc(e.v):''}<div class="mono" style="word-break:break-word;margin-top:4px">${esc(e.msg)}</div></div></div>`).join('')}</div>
  <div class="row"><button class="btn" data-act="errcopy">Copy all details</button><button class="btn ghost" data-act="errclear">Clear</button></div></div>`;
}

// Anything that escapes a handler, a timer or a promise lands here too, so a failure
// that never touches render() is still reportable rather than silent.
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('error',e=>{ crashLog(e.error||e.message,'window') });
  window.addEventListener('unhandledrejection',e=>{ crashLog(e.reason,'promise') });
}

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

/* ---------------- views ---------------- */
// A thrown error in any view used to leave a blank page. Now it leaves a banner you can
// read, copy and reload from. See 06a-crash.js.
function render(){
  try{ renderMain() }
  catch(err){
    crashLog(err,'render');
    try{ document.getElementById('main').innerHTML=crashHtml(err) }catch(e2){}
  }
}
function renderMain(){
  // Focus and the caret used to be saved here and put back after the innerHTML swap.
  // morph() does not disturb them, so there is nothing to save -- except where it
  // cannot morph at all, which is the test harness, and there nothing has focus.
  const a=document.activeElement, aid=a&&a.id, pos=a&&typeof a.selectionStart==='number'?a.selectionStart:null;
  // The Admin tab exists in the markup for everyone and is shown to nobody until the
  // server says otherwise. If a stored view points at it and this address is not an
  // administrator, fall back rather than render a screen that will only refuse.
  if(view==='admin'&&!amAdmin&&loaded) view='setup';
  const ab=document.querySelector&&document.querySelector('#nav button[data-view="admin"]');
  if(ab) ab.hidden=!amAdmin;
  /* Seven tabs do not fit a phone -- at 390px the row is about 480px wide -- so `nav`
     scrolls sideways. Which is fine until the tab you are on is the one off the end:
     Guide sits last, so opening it from the account menu used to leave the row still
     showing Today and no sign of where you were. Bring the current one into view. */
  document.querySelectorAll('#nav button').forEach(b=>{
    const on=b.dataset.view===view;
    b.setAttribute('aria-current',on?'page':'false');
    if(on&&!b.hidden&&b.scrollIntoView) try{ b.scrollIntoView({block:'nearest',inline:'nearest'}) }catch(e){}
  });
  const m=document.getElementById('main');
  m.classList.toggle('ro',!!viewing);
  if(wz&&!viewing){ if(!morph(m,vWelcome())&&aid){const el=document.getElementById(aid);if(el)el.focus({preventScroll:true})} return }
  const html=copyBox()+archiveBanner()+(['status','plan','history'].includes(view)?programPicker():'')+({today:vToday,status:vStatus,plan:vPlan,releases:vReleases,history:vHistory,setup:vSetup,coach:vCoach,guide:vGuide,admin:vAdmin}[view]||vToday)();
  // Only the fallback path needs focus putting back; morph never took it away.
  if(!morph(m,html)&&aid){const el=document.getElementById(aid); if(el){el.focus({preventScroll:true}); try{if(pos!=null&&el.setSelectionRange)el.setSelectionRange(pos,pos)}catch(e){}}}
  showToast();
}

function vToday(){
  const t=todayStr(), wk=weekOf(sel), dp=dayPlan(sel), mon=mondayOf(sel);
  let h=`<div class="dnav"><button class="btn sm ghost" data-act="go" data-date="${addDays(sel,-1)}" aria-label="Previous day">‹</button><h2>${fmtLong(sel)}</h2>${sel!==t?`<button class="btn sm" data-act="go" data-date="${t}">Today</button>`:''}<button class="btn sm ghost" data-act="go" data-date="${addDays(sel,1)}" aria-label="Next day">›</button></div>`;
  h+=`<div class="week">`;
  for(let i=0;i<7;i++){const d=addDays(mon,i), p=dayPlan(d);
    h+=`<button class="day${d===sel?' sel':''}${d===t?' today':''}" data-act="go" data-date="${d}"><span class="dn">${DAYN[i]}</span><span class="dd">${+d.slice(8)}</span><span class="dl">${esc(p.short||'')}</span><span class="dot${lg(d).done?' on':''}"></span></button>`}
  h+=`</div>`;
  if(!wk){ return h+checkinCard(sel)+`<div class="card"><h3>Not started</h3><p class="muted">The program starts the week of ${fmtLong(plan.startMonday)}. Change the start date in Setup.</p></div>` }
  const wt=weekTitle(wk);
  h+=`<div class="wkline"><b>${wt.t}</b><span class="chip ${wt.cls}">${wt.chip}</span>${dp.plyo||dp.t==='plyobase'?`<span class="small muted">Plyo: ${plyoPhase(wk).name} · ~${dp.plyoCut||(lg(sel).plyo||{}).cut?Math.round(plyoPhase(wk).target/2):plyoPhase(wk).target} contacts</span>`:''}${wk.inserted?'<span class="chip">Added</span>':''}${isReordered(mon)?'<span class="chip blue">Days moved</span>':''}${!viewing&&dp.t!=='pre'?`<button class="btn sm ghost" style="margin-left:auto" data-act="move">Move…</button>`:''}</div>`;
  if(moveOpen&&!viewing) h+=moveCard();
  h+=noteCard(sel);
  h+=aimsCard(sel);
  h+=debriefCard();
  h+=weekSummaryCard();
  h+=weeklyCard();
  h+=prCard(sel);
  h+=finishCard(sel,dp);
  h+=banners(wk,dp);
  if(sel===todayStr()){const rc=reviewCycleFor(sel);if(rc) h+=reviewCard(rc);const dc=deloadCheckCycle(sel);if(dc) h+=deloadCheckCard(dc)}
  h+=checkinCard(sel);
  // The pre-training ones have a window in front of the session, so they go above it;
  // the daily tick-list sits with the rest of the day's logging, below.
  if(!['off','pre','convert'].includes(dp.t)) h+=suppCard(sel,'pre');
  h+=suppCard(sel,'daily');
  h+=dayHtml(wk,sel);
  h+=addonCard(sel);
  return h;
}
/* ---------------- moving a session ----------------
One thing, done one way: pick the day, the session goes there, nothing else changes.

What this replaces is worth remembering. There were three mechanisms -- swap two days,
shift the week around a request, and stack one day onto another -- because the data
model was a permutation and a straight move could not be said in it. Every one of them
moved something the person had not asked about, and between them they refused more than
they allowed. The model holds dates now, so there is one verb and it never refuses. */
function moveTargets(date){
  // A fortnight either side. Far enough for "I'll pick it up next week", short enough
  // that the list is still a list.
  const out=[]; for(let i=-7;i<=14;i++){ const d=addDays(date,i); if(idxOf(d)>=0) out.push(d) }
  return out;
}
function moveWarn(date,ss){
  const out=[], at=dayPlans(date).filter(x=>!(x.sess.monday===ss.monday&&x.sess.slot===ss.slot));
  const me=dayPlanSlot(ss.home,ss.slot), mk=stackKindOf(me);
  if(at.some(x=>stackKindOf(x)===mk&&mk==='lift')) out.push('Two lifting sessions in one day is a lot of barbell work at once. Do the heavier one first and cut the accessories on the second.');
  else if(at.length&&mk==='lift') out.push('Lifting goes first, then the conditioning.');
  else if(at.length) out.push(`${DAYN[dow(date)]} already has a session. Both will be listed, in that order.`);
  const near=[addDays(date,-1),addDays(date,1)];
  if(mk==='lift'&&near.some(d=>dayPlans(d).some(x=>stackKindOf(x)==='lift'&&!(x.sess.monday===ss.monday&&x.sess.slot===ss.slot))))
    out.push('That puts lifting on back-to-back days. The book asks you not to, so keep one of them light.');
  return out;
}
/* The card for sessions that were not prescribed. It sits at the bottom of the day,
   under whatever the program asked for, because that is the order they happen in and
   because it must never be mistaken for the session. */
function addonCard(date){
  if(viewing) return '';
  const list=addonsOf(date);
  let h=`<div class="card"><div class="lift-h"><h3>Anything else today</h3>${list.length?`<span class="chip">${list.length}</span>`:''}</div>`;
  if(!list.length) h+=`<p class="note" style="margin:0">A ride that was not on the plan, a second lifting session, a class. It counts toward your conditioning minutes and your records, and it is left out of how the program itself is going.</p>`;
  list.forEach((a,i)=>{
    h+=`<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px">
      <div class="row between"><b>${esc(addonLabel(a))}</b><button class="btn sm ghost" data-act="addondel" data-i="${i}" aria-label="Remove this session">Remove</button></div>`;
    if(a.kind==='cond'){
      const M=MOD[a.mod]||MOD[defMod()], met=metricFor(a.mod,a.fmt);
      h+=`<div class="grid2">
        <label class="f">Activity<select id="in-addon-mod-${i}" data-bind="addons.${i}.mod">${Object.entries(MOD).map(([k,x])=>`<option value="${k}"${k===a.mod?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label class="f">Kind<select id="in-addon-fmt-${i}" data-bind="addons.${i}.fmt">${Object.entries(HIC).map(([k,x])=>`<option value="${k}"${k===a.fmt?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>
      <div class="grid2"><label class="f">Minutes${numIn('addons.'+i+'.min',a.min)}</label>
        ${met?`<label class="f">${esc(metricLabel(met))}${numIn('addons.'+i+'.val',a.val)}</label>`:`<label class="f">What it was<input type="text" id="in-addon-what-${i}" data-bind="addons.${i}.what" value="${esc(a.what||'')}" placeholder="e.g. five-a-side"></label>`}</div>
      ${M&&M.elev?`<label class="f">Elevation gain (${esc(elevUnit())})${numIn('addons.'+i+'.elev',a.elev)}</label>`:''}
      ${met&&a.mod==='other'?`<label class="f">What it was<input type="text" id="in-addon-what-${i}" data-bind="addons.${i}.what" value="${esc(a.what||'')}" placeholder="e.g. five-a-side"></label>`:''}`;
    } else {
      const sets=addonSets(a);
      h+=`<label class="f">Exercise<input type="text" id="in-addon-what-${i}" data-bind="addons.${i}.what" value="${esc(a.what||'')}" placeholder="e.g. Incline bench, or Upper body"></label>
      ${sets.map((st,j)=>`<div class="row" style="gap:6px;align-items:flex-end"><label class="f" style="flex:1">Weight${numIn('addons.'+i+'.sets.'+j+'.w',st.w)}</label><label class="f" style="flex:1">Reps${numIn('addons.'+i+'.sets.'+j+'.r',st.r)}</label><button class="btn sm ghost" data-act="addonsetdel" data-i="${i}" data-j="${j}" aria-label="Remove set ${j+1}">\u2715</button></div>`).join('')}
      <div><button class="btn sm" data-act="addonsetadd" data-i="${i}">Add a set</button></div>`;
    }
    h+=`<label class="f">Notes<input type="text" id="in-addon-note-${i}" data-bind="addons.${i}.note" value="${esc(a.note||'')}" placeholder="How it went"></label></div>`;
  });
  h+=`<div class="row" style="gap:6px;margin-top:12px"><button class="btn" data-act="addon" data-kind="cond">Add cardio</button><button class="btn" data-act="addon" data-kind="lift">Add a lifting session</button></div>`;
  if(list.length) h+=`<div class="note">These sit outside the program. They feed your conditioning minutes, your records and the climbing total; they do not change your maxes, the end-of-cycle review, or whether the program counts as followed.</div>`;
  return h+`</div>`;
}
let moveOpen=false;
function moveCard(){
  const here=dayPlans(sel), mon=mondayOf(sel);
  let h=`<div class="card"><div class="lift-h"><h3>Move a session</h3><button class="btn sm ghost" data-act="movex">Close</button></div>`;
  if(!here.length) h+=`<p class="note" style="margin:0">Nothing on ${DAYN[dow(sel)]} to move. Open the day a session is on and move it here.</p>`;
  here.forEach(dp=>{
    const ss=dp.sess, name=dp.short||'Session';
    h+=`<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px">
      <div class="row between"><b>${esc(name)}</b>${dp.moved?`<button class="btn sm ghost" data-act="moveback" data-mon="${esc(ss.monday)}" data-sl="${ss.slot}">Back to ${esc(DAYN[dow(ss.home)])} ${esc(fmtD(ss.home,true))}</button>`:''}</div>
      ${dp.moved?`<div class="small muted">Moved here from ${esc(fmtLong(ss.home))}.</div>`:''}
      <div class="row wrap" style="gap:6px">`;
    for(const d of moveTargets(sel)){
      if(d===sel) continue;
      const w=moveWarn(d,ss), near=Math.abs(Math.round((D(d)-D(sel))/864e5))<=7;
      if(!near&&!dayPlans(d).length&&mondayOf(d)===mon) continue;
      h+=`<button class="btn sm${w.length?'':' '}" data-act="moveto" data-mon="${esc(ss.monday)}" data-sl="${ss.slot}" data-to="${esc(d)}" title="${esc(w[0]||'')}">${esc(DAYN[dow(d)])} ${esc(fmtD(d,true))}${w.length?' <span aria-hidden="true">\u26a0</span>':''}</button>`;
    }
    h+=`</div></div>`;
  });
  h+=`<div class="note" style="margin-top:12px">Only the session you pick moves. Nothing else in the week changes, a day can hold more than one, and a day with none is a rest day. A \u26a0 means it is allowed but worth knowing about \u2014 hold the button to read it.</div>`;
  if(isReordered(mon)) h+=`<div><button class="btn sm ghost" data-act="ordreset">Put this week back as it was</button></div>`;
  h+=plyoMovePicker(mon);
  return h+`</div>`;
}
// Plyos ride along with whichever day you put them on, so they get their own picker
// rather than taking part in the session shuffle above.
function plyoMovePicker(mon){
  const wk=weekOf(mon); if(!weekHasPlyo(wk)) return '';
  const cur=plyoDow(mon);
  let h=`<div class="divider">Plyometrics</div><p class="note" style="margin:0">Plyos aren’t part of a session. Put them on any day — they run before the conditioning if they land on a conditioning day, and stand alone if they don’t.</p>
  <div class="row wrap" style="gap:6px">`;
  for(let d=0;d<7;d++){
    const open=plyoDayOpen(mon,d);
    h+=`<button class="btn sm${d===cur?' primary':''}" data-act="plyoday" data-d="${d}" ${open?'':'disabled'} aria-pressed="${d===cur}">${DAYN[d]}</button>`;
  }
  h+=`</div>`;
  if(plyoMoved(mon)) h+=`<div class="small muted">Moved off ${DAYN[(+plan.plyoDow>=0&&+plan.plyoDow<=6?+plan.plyoDow:3)]} for this week only.</div>`;
  return h;
}
// Shown once a day is marked done: what actually got logged, and anything still missing.
function finishCard(date,dp){
  const L=lg(date); if(!L.done||['off','pre','convert'].includes(dp.t)) return '';
  const bits=[], gaps=[];
  if(dp.t==='lift'||dp.t==='rm5'||dp.t==='test'){
    const wk=weekOf(date);
    for(const k of (dp.lifts||[])){
      const x=(L.lifts||{})[k]||{}, t=((L.test||{})[k])||{};
      if(dp.t==='lift'&&wk){const r=rx(wk,k),nS=r.s,dn=(x.sets||[]).filter(Boolean).length;
        bits.push(`${liftName(k,date)} ${dn}/${nS}${r.sMax>nS?'+':''}${ground(x)?' · ground':''}`); if(dn<nS) gaps.push(`${liftName(k)}: ${nS-dn} set${nS-dn>1?'s':''} unticked`);}
      else if(t.w!=null&&t.w!=='') bits.push(`${liftName(k,date)} ${isBW(k)?fmtLoad(k,+t.w):n(t.w)} × ${t.r||'?'}`);
    }
    const w=(L.warmup||[]).filter(Boolean).length; if(w) bits.push(`warm-up ${w} done`);
  }
  if(dp.t==='hic'||dp.cardio){
    const f=effFmt(date), mod=modOf(date), met=metricFor(mod,f), v=met?(L.hic||{})[met[0]]:null;
    if(v!=null&&v!=='') bits.push(`${MOD[mod].name} ${HIC[f].name} ${n(v)} ${met[1]}`); else gaps.push('conditioning result not logged');
  }
  if(dp.plyo||dp.t==='plyobase'){const c=(L.plyo||{}).contacts; if(c) bits.push(`${c} contacts`); if((L.plyo||{}).best||(L.plyo||{}).mark) bits.push(`broad jump ${r1((L.plyo||{}).best||(L.plyo||{}).mark)} in`)}
  if(dp.t==='travel'){
    const items=travelList(dp.slot), tv=(L.travel||{}), n0=items.filter((_,i)=>tv[i]).length;
    bits.push(`${n0} of ${items.length} movements`);
    if(n0<items.length) gaps.push(`${items.length-n0} movement${items.length-n0>1?'s':''} unticked`);
    const w=(L.warmup||[]).filter(Boolean).length; if(w) bits.push(`warm-up ${w} done`);
  }
  const m=(L.mobility||[]).filter(Boolean).length; if(m) bits.push(`mobility ${m} done`);
  if(!L.rpe) gaps.push('no session RPE');
  return `<div class="card done"><div class="lift-h"><h3>Session complete</h3><span class="chip light">✓ ${esc(dp.short||'Done')}${L.rpe?' · RPE '+L.rpe:''}</span></div>
  ${bits.length?`<div class="small">${esc(bits.join(' · '))}</div>`:''}
  ${gaps.length?`<div class="small muted">Still open: ${esc(gaps.join(', '))}.</div>`:'<div class="small muted">Everything logged. Nice work.</div>'}</div>`;
}
function banners(wk,dp){
  let h='';
  const needMax=dp.t==='lift'&&(dp.lifts||[]).some(k=>!maxFor(wk.kind==='cycle'?wk.cycle:wk.refCycle)[k]);
  if(needMax) h+=`<div class="banner warn"><div><b>Some maxes are missing.</b> Working weights need a 1RM for every lift. Finish the bridge week tests or enter maxes in Setup.</div><div><button class="btn sm" data-act="view" data-view="setup">Open Setup</button></div></div>`;
  if(inBlockCheck(sel)) h+=`<div class="banner info"><div><b>Last lifting day before a recovery week.</b> If you want to know where a lift stands, this is the day to find out — the book prefers it to a whole test week. Take one heavy-ish single above 95%, or a rep max, on one lift at the end of the session. Only if there is something you actually expect to learn.</div></div>`;
  if(wk.kind==='bridge'&&dp.t!=='convert') h+=`<div class="banner info"><div><b>Bridge week.</b> Testing and calibration, not training. Leave two reps in reserve on every test set. Sunday turns your 5RMs into maxes.</div></div>`;
  const hol=holidayOn(sel);
  if(hol&&(dp.t==='lift'||dp.t==='test')){const alt={0:'Sun or Tue',2:'Tue or Thu',3:'Wed or Fri',4:'Thu or Sat',5:'Fri or Sun'}[dow(sel)]||'an adjacent day';h+=`<div class="banner warn"><div><b>${hol}.</b> Shift this session to ${alt} if the gym is closed.</div></div>`}
  if(sel===todayStr()&&(wk.kind==='cycle')){
    const hs=hardSessions(), nm=addDays(mondayOf(sel),7), nw=weekOf(nm);
    if(hs>=2&&nw&&nw.kind==='cycle') h+=`<div class="banner alert"><div><b>${hs} hard lifting sessions in the last two weeks</b> (RPE 9+, a grinder, or missed sets). Operator is meant to stay sub-maximal. Lower the max on the lift that's grinding, or take a deload week starting ${fmtD(nm,true)}.</div><div class="row"><button class="btn sm" data-act="insert" data-kind="deload" data-monday="${nm}">Deload next week</button></div></div>`;
  }
  return h;
}
/* The mobility block and the RPE/notes footer belong to the day, not to each session
   on it, so a day holding two renders them once at the end. `solo` is false for all but
   the last, which is the only one that gets them. */
let sessSolo=true;
function sessTail(dp,active){ return sessSolo?mobCard(sel,dp)+footer(active):'' }
/* Every session on the day, in order, each rendered as it would be on its own. The
   divider says which is which, because two sessions in a day is a thing you are doing
   deliberately and the card needs to be readable at the point you are doing it. */
function dayHtml(wk,date){
  const all=dayPlans(date);
  if(all.length<2) return sessionHtml(wk,dayPlan(date));
  let h='';
  all.forEach((dp,i)=>{
    sessSolo=i===all.length-1;
    h+=`<div class="divider">${i?'Then, ':''}${esc(dp.short||'Session')}${dp.moved?` \u00b7 moved from ${esc(fmtD(dp.sess.home,true))}`:''}</div>`;
    h+=sessionHtml(wk,i?dp:Object.assign({},dp,{plyo:dayPlan(date).plyo,plyoN:dayPlan(date).plyoN,plyoCut:dayPlan(date).plyoCut}));
  });
  sessSolo=true;
  return h;
}
function sessionHtml(wk,dp){
  let h='';
  const note=dp.note?`<p class="muted small" style="margin:0">${esc(dp.note)}</p>`:'';
  // Plyos go first whatever else the day holds: they are a nervous-system stimulus and want
  // you fresh. Ten minutes between them and hard conditioning. On a day with nothing else
  // scheduled they are the session, so the rest-day copy below is skipped.
  if(dp.plyo){
    h+=plyoCard(wk,dp);
    if(['off','pre'].includes(dp.t)) return h+sessTail(dp,true);
    h+=`<div class="divider">${dp.t==='hic'?'Rest 10 min':'Then'}</div>`;
  }
  if(dp.t==='off'){ return h+`<div class="card"><h3>Rest</h3><p style="margin:0">${esc(dp.note||'Full rest. Walk, sleep, eat.')} Deep stretching belongs today if you want it — the block below is the long version.</p></div>`+sessTail(dp,false) }
  if(dp.t==='lift'){
    if(sel===todayStr()&&!viewing) h+=`<button class="btn primary" style="width:100%;padding:14px" data-act="lsstart">${lg(sel).done?'Reopen session mode':'Start session mode'}</button>`;
    h+=warmupCard(sel);
    for(const k of dp.lifts) h+=liftCard(wk,k,dp);
    h+=accCard(wk,dp);
    if(dp.ride||dp.cardio){
      const note=dp.condNote?`<p class="muted small" style="margin:0">${esc(dp.condNote)}</p>`:'';
      h+=`<div class="divider">Then, conditioning</div>`+(dp.ride==='se'?seCard(dp):hicCard(dp,note));
    }
    return h+sessTail(dp,true);
  }
  if(dp.t==='travel') return h+warmupCard(sel)+travelCard(dp)+sessTail(dp,true);
  if(dp.t==='hic') return h+hicCard(dp,note)+sessTail(dp,true);
  if(dp.t==='rm5'||dp.t==='test'){
    if(sel===todayStr()&&!viewing) h+=`<button class="btn primary" style="width:100%;padding:14px" data-act="lsstart">${lg(sel).done?'Reopen session mode':'Start session mode'}</button>`;
    if(dp.note) h+=`<div class="banner info"><div>${esc(dp.note)}</div></div>`;
    h+=warmupCard(sel);
    if(dp.jumps) h+=plyoWarmBlock(lg(sel).plyo||{},' card')+jumpCard('First, before any lifting.');
    for(const k of dp.lifts) h+=testCard(k,dp.t==='rm5'?5:1,dp.t==='rm5');
    if(dp.pullups) h+=`<div class="card"><h3>Max unassisted pull-ups</h3><p class="muted small" style="margin:0">The number the Lift 3 substitution was aimed at. One all-out set, full hang to chin over bar.</p><label class="f">Reps${numIn('pullups',lg(sel).pullups,'0','class="num-in"')}</label>${bestPullups()}</div>`;
    if(dp.apply) h+=applyCard(wk);
    if(dp.cardio) h+=`<div class="divider">Then, easy</div>`+hicCard(dp,'');
    return h+sessTail(dp,true);
  }
  if(dp.t==='se') return h+warmupCard(sel)+seCard(dp)+sessTail(dp,true);
  if(dp.t==='plyobase') return h+warmupCard(sel)+plyoWarmBlock(lg(sel).plyo||{},' card')+jumpCard('Baselines. Three good attempts each, keep the best.')+sessTail(dp,true);
  if(dp.t==='convert') return h+convertCard(wk)+sessTail(dp,false);
  return h;
}
function mobKind(dp){
  if(dp.t==='travel') return dp.slot==='day3'?'dead':'lift';
  if(dp.plyo||dp.t==='plyobase') return 'plyo';
  if(dp.t==='hic') return 'hic';
  if(dp.t==='off'||dp.t==='convert'||dp.t==='pre') return 'off';
  return (dp.lifts||[]).includes('dead')?'dead':'lift';
}
function mobList(kind){const a=(plan.mob||{})[kind];return Array.isArray(a)&&a.length?a.map(x=>Array.isArray(x)?x:[x,'']):MOB[kind].items}
// "45–60 sec per side" -> a 60 s hold, two sides. Reps and breaths get no timer.
function holdSecs(dose){
  const m=String(dose||'').match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(sec|min)/i);
  if(!m) return null;
  const v=+(m[2]||m[1]), s=m[3].toLowerCase()==='min'?v*60:v;
  return s>=10?{s,sides:/per side/i.test(dose)?2:1}:null;
}
function travelList(slot){const a=(plan.travel||{})[slot];return Array.isArray(a)&&a.length?a.map(x=>Array.isArray(x)?x:[x,'']):TRAVEL[slot].items}
function travelCard(dp){
  const L=lg(sel).travel||{}, items=travelList(dp.slot), done=items.filter((_,i)=>L[i]).length;
  return `<div class="card"><div class="lift-h"><span class="lift-name">${esc(TRAVEL[dp.slot].name)}</span><span class="rx">${done} of ${items.length}</span></div>
  <p class="note" style="margin:0">Rep targets rather than percentages \u2014 a week on hotel kit keeps the habit without touching your maxes. Leave two reps in reserve, as always.</p>
  <div class="stack">${items.map(([n,d],i)=>checkRow('travel.'+i,L[i],n,d)).join('')}</div>
  <div class="small muted">Edit these in Setup \u2192 Travel week.</div></div>`;
}
function checkRow(bind,on,name,dose){
  const h=holdSecs(dose), e=mlibEntry(name), id='c-'+bind.replace(/\./g,'-'), key='m-'+bind.replace(/\./g,'-');
  const open=!!e&&openPx.has(key);
  // No <details> here: ticking the box re-renders, and a native disclosure would be
  // rebuilt before its toggle event landed. The button drives openPx and the panel is
  // rendered from it, so the two cannot race.
  const info=e?`<button class="libinfo${open?' on':''}" data-act="mlib" data-k="${key}" aria-expanded="${open}" aria-label="How to do ${esc(name)}">i</button>`:'<span></span>';
  return `<div class="crow"><input type="checkbox" id="${id}" data-bind="${bind}" ${on?'checked':''}><label class="crow-n" for="${id}">${esc(name)}</label>${info}${dose?`<span class="mono small muted">${esc(dose)}</span>`:'<span></span>'}${h?`<button class="btn sm ghost hold" data-act="hold" data-n="${esc(name)}" data-s="${h.s}" data-sides="${h.sides}" aria-label="Time ${esc(name)}">\u23f1</button>`:'<span></span>'}</div>${open?libBody(e):''}`;
}


/* Which routine, and the list it comes to. `mine` is stored the way the mobility
   lists are: an array of [name, dose] pairs edited as one textarea.

   The core pair is prepended to everything except ours, which already contains it in
   its own positions -- see WARM_CORE. Ticks are an index into whatever this returns,
   so switching routine clears the day's ticks rather than leaving them pointing at
   movements they were never ticked against. */
function warmKey(){ const k=plan.warmRoutine; return WARM_ROUTINES[k]?k:'ours' }
function warmMine(){ const a=plan.warmCustom; return Array.isArray(a)?a.filter(x=>x&&(Array.isArray(x)?x[0]:x)).map(x=>Array.isArray(x)?{n:x[0],d:x[1]||''}:{n:x,d:''}):[] }
function warmRoutine(){ return WARM_ROUTINES[warmKey()] }
function warmItems(){
  const r=warmRoutine(), items=r.items()||[];
  return r.core===false?items:WARM_CORE.concat(items);
}
function warmupCard(date){
  const W=lg(date).warmup||[], ITEMS=warmItems(), R=warmRoutine();
  // A short version is the routine's to declare, not something inferred from the items:
  // the core pair is marked short, so inferring it would offer an empty one on Agile 8.
  const hasShort=!!R.short, short=hasShort&&!!lg(date).warmShort;
  const idx=ITEMS.map((x,i)=>i).filter(i=>!short||ITEMS[i].s);
  const done=idx.filter(i=>W[i]).length;
  let rows='', g=null;
  for(const i of idx){ const x=ITEMS[i]; if(x.g!==g){g=x.g;rows+=`<h4 class="sub-h">${esc(g)}</h4>`} rows+=checkRow('warmup.'+i,W[i],x.n,x.d); }
  return `<details class="plain card" data-px="gwu"${openPx.has('gwu')?' open':''}><summary><b>Warm-up</b> \u00b7 ${esc(R.name)} \u00b7 ${done} of ${idx.length} done${short?' \u00b7 '+esc(R.short||''):(R.mins?' \u00b7 '+esc(R.mins):'')}</summary>
  <div class="stack" style="margin-top:10px">
    ${hasShort?`<div class="restsel"><span>Version</span><div class="seg"><button class="segb${short?'':' on'}" data-act="wshort" data-v="0">Full \u00b7 ${esc(R.mins)}</button><button class="segb${short?' on':''}" data-act="wshort" data-v="1">Short \u00b7 ${esc(R.short)}</button></div></div>`:''}
    ${rows}
    <div class="note">Keep static holds easy before lifting. Long aggressive holds right before heavy squats blunt force output — the deep work belongs in the mobility block at the end.</div>
    <div class="row"><button class="btn" data-act="guide" data-k="warmup">Guide me through it</button>${done?`<button class="btn sm ghost" data-act="wclear">Clear</button>`:''}</div>
  </div></details>`;
}
function mobCard(date,dp){
  const kind=mobKind(dp), M=MOB[kind], items=mobList(kind), L=lg(date).mobility||[], done=items.filter((_,i)=>L[i]).length;
  return `<details class="plain card" data-px="mob"${openPx.has('mob')?' open':''}><summary><b>Mobility</b> · ${done} of ${items.length} done · ${esc(M.name)}</summary>
  <div class="stack" style="margin-top:10px"><div class="small muted">${esc(M.why)} Hold each one easy; this is the place for the longer holds.</div>
    ${items.map(([n,d],i)=>checkRow('mobility.'+i,L[i],n,d)).join('')}
    <div class="row"><button class="btn" data-act="guide" data-k="mobility">Guide me through it</button>${done?`<button class="btn sm ghost" data-act="mclear">Clear</button>`:''}</div>
  </div></details>`;
}
/* ---------- strength-endurance circuits ---------- */
function seCluster(date){const o=(lg(date).se||{}).cluster;return SE_CLUSTERS[o]?o:(((plan.se||{}).cluster)in SE_CLUSTERS?plan.se.cluster:'bw')}
function seList(key){
  if(key==='mine'){const a=(plan.se||{}).custom;return Array.isArray(a)?a.filter(Boolean):[]}
  return (SE_CLUSTERS[key]||SE_CLUSTERS.bw).ex;
}
// What you're actually doing today. Starts as the cluster, and stays that way until you
// change something — a bar that's taken, a bell you'd rather use — which is per day only.
function seDayList(date){const a=(lg(date).se||{}).ex;return Array.isArray(a)&&a.length?a:seList(seCluster(date))}
function seEdited(date){const a=(lg(date).se||{}).ex;return Array.isArray(a)&&a.length>0}
// Everything the app knows about, for the swap list.
function seVocab(){
  const out=[];
  for(const c of Object.values(SE_CLUSTERS)) for(const e of c.ex) if(!out.includes(e)) out.push(e);
  for(const e of ((plan.se||{}).custom||[])) if(e&&!out.includes(e)) out.push(e);
  return out;
}
function seRestSecs(){const v=+((plan.se||{}).rest);return SE_RESTS.includes(v)?v:60}
function seDone(date){const d=(lg(date).se||{}).done;return Array.isArray(d)?d:[]}
let seEdit=null;
function seSwap(i,name,ex){
  const pool=seVocab().filter(e=>!ex.includes(e));
  return `<div class="seswap"><div class="small muted">Swap this one for today. The cluster and your other days stay as they are.</div>
  <div class="seg">${pool.map(e=>`<button class="segb" data-act="seput" data-i="${i}" data-v="${esc(e)}">${esc(e)}</button>`).join('')||'<span class="small muted">Nothing else on the list.</span>'}</div>
  <div class="row" style="align-items:flex-end"><label class="f" style="flex:1">Or type one<input type="text" id="se-ex-${i}" data-seex="${i}" value="${esc(name)}"></label><button class="btn sm ghost" data-act="serm" data-i="${i}">Remove</button><button class="btn sm" data-act="seedit" data-i="${i}">Done</button></div></div>`;
}
function seCard(dp){
  const key=seCluster(sel), ex=seDayList(sel), done=seDone(sel), C=dp.circuits, R=dp.reps, edited=seEdited(sel);
  const ticks=ex.reduce((a,_,i)=>a+((done[i]||[]).filter(Boolean).length),0), total=ex.length*C;
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">Strength-endurance</span><span class="rx">${C} circuit${C>1?'s':''} × ${R} reps${dp.pct?' @ '+dp.pct+'%':''}</span></div>
  <div class="note">Light resistance, high repetition, short rests. Work down the cluster, rest ${seRestSecs()?seRestSecs()+' sec':'as little as you can'} between exercises, then 2 minutes before the next circuit. Can't get all ${R} at once? Rest-pause until they're done, then move on.</div>
  <div class="restsel"><span>Cluster</span><div class="seg">${Object.entries(SE_CLUSTERS).map(([k,c])=>`<button class="segb${k===key&&!edited?' on':''}" data-act="secl" data-v="${k}" aria-pressed="${k===key&&!edited}">${c.name}</button>`).join('')}</div>${edited?`<span class="chip blue">Changed for today</span><button class="btn sm ghost" data-act="sereset">Back to ${esc(SE_CLUSTERS[key].name)}</button>`:''}</div>`;
  if(!ex.length) return h+`<div class="banner warn"><div class="small">No exercises in your own cluster yet. Add five to eight in <b>Setup → Strength-endurance</b>, or pick one of the book's above.</div></div></div>`;
  h+=`<div class="setbl">${ex.map((name,i)=>`<div class="serow"><button class="sename" data-act="seedit" data-i="${i}" aria-expanded="${seEdit===i}">${esc(name)}<span class="swap">swap</span></button><div class="sets">${Array.from({length:C},(_,j)=>`<button class="setb sm${(done[i]||[])[j]?' on':''}" data-act="setick" data-i="${i}" data-j="${j}" aria-pressed="${!!(done[i]||[])[j]}">${R}<small>${j+1}</small></button>`).join('')}</div>${seEdit===i?seSwap(i,name,ex):''}</div>`).join('')}</div>
  <div><button class="btn sm ghost" data-act="seadd">+ Add an exercise</button></div>
  <div class="row between"><span class="small muted">${ticks} of ${total} sets</span><span class="small muted">${esc(SE_CLUSTERS[key].note)}</span></div>
  <div class="restsel"><span>Rest between exercises</span><div class="seg">${SE_RESTS.map(v=>`<button class="segb${seRestSecs()===v?' on':''}" data-act="serest" data-v="${v}">${v?v+'s':'none'}</button>`).join('')}</div></div>
  ${dp.pct?`<div class="note">Today is <b>${dp.pct}% of your one-rep max</b> on each lift — the block's own number, not a range to guess at. Reps first, not load: get in the ballpark and err lighter. Failing partway through a set is normal here, so take a breather and make up the difference.</div>`
    :key==='bar'||key==='db'||key==='kb'?`<div class="note">Use roughly 15–30% of your one-rep max. Don't test for it, and if it feels heavy take weight off.</div>`:''}
  </div>`;
  return h;
}
function warmupShort(){return `<div class="stack small"><div><b>1 · Raise temp</b> Bike, rower or easy jog, 4–5 min</div><div><b>2 · Breathe</b> 90/90 breathing ×5 breaths · cat/cow ×8–10</div><div><b>3 · T-spine</b> Thread the needle 6–8/side · open book 8/side · quadruped extension 8/side</div><div><b>4 · Hips</b> 90/90 switches ×10 · 90/90 lean 20–30 s/side · couch stretch 45–60 s/side · frog rocks ×10 · world's greatest ×5/side</div><div><b>5 · Activate</b> Leg swings 10 each way · band pull-aparts + dislocates ×15 · glute bridge or BW squat ×10</div><div class="muted">Short version (7 min): bike 4 min, 90/90 breathing, cat/cow, 90/90 switches, couch stretch, band pull-aparts. Keep static holds easy before heavy squats.</div></div>`}
function liftCard(wk,k,dp){
  const r=rx(wk,k), L=(lg(sel).lifts||{})[k]||{}, sets=L.sets||[];
  const isDead=k==='dead'&&wk.kind==='cycle';
  const nSets=r.sMax;
  const setLbl=r.sMax>r.s?r.s+'–'+r.sMax:String(r.s);
  const bar=isBarbell(k);
  const T=L.used!=null&&L.used!==''?+L.used:r.w, has=T!=null&&(isBW(k)||T>0);
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="rx">${r.top?'Best '+r.r+' of the day':`${setLbl} × ${r.r} @ ${r.p}%${plan.basis==='tm'?' TM':''}${r.amrap?' +':''}`}</span></div>`;
  // Tactical Barbell III finishes some weeks on an all-out set, and some of its days
  // carry a note of their own. Both come off the prescription, not off the day type.
  /* A Back "Break" day has no percentage to work from: you climb to the best set you
     have today, and the down sets are a share of that rather than of a 1RM. */
  if(r.top) h+=`<div class="banner info"><div class="small"><b>Work up to your best ${r.r} for today.</b> Warm up, then climb in sets of ${r.r} until you reach the heaviest one you can do with absolutely perfect form. It may take a few attempts to find it, and it is a best for <i>today</i>, not a record to chase.${r.down?` Then, <b>optional</b>: ${r.down===1?'one set':'one to '+({2:'two',3:'three'}[r.down]||r.down)+' sets'} of ${r.r} at ${r.downPct}% of what you just lifted. Only if you are feeling good — the down sets are not the hill to die on.`:''}</div></div>`;
  if(r.amrap) h+=`<div class="banner info"><div class="small"><b>Last set: as many reps as you can.</b> Keep the same weight and keep going past ${r.r}. Stop with something left — this is not a grinder.</div></div>`;
  if(r.note) h+=`<div class="small muted">${esc(r.note)}</div>`;
  if(VARS[k]&&!viewing){
    const V=varsOf(k), v=r.vr, cur=V[v];
    h+=`<label class="restsel"><span>This session</span><select class="varsel" data-act-var="${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===v?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;
    if(v!==varRef(k)) h+=`<div class="small muted">${esc(cur.note)}</div>`;
  }
  if(L3K.includes(k)&&l3On().length>1) h+=`<div class="restsel"><span>This session</span><div class="seg">${l3On().map(v=>`<button class="segb${v===k?' on':''}" data-act="l3swap" data-v="${v}" aria-pressed="${v===k}">${esc(liftName(v))}</button>`).join('')}</div></div>`;
  if(has){
    h+=`<div class="row between"><div class="big">${fmtLoad(k,T)}<small>${isBW(k)?(T>0?u()+' added':'bodyweight'):u()}</small></div><div class="stack small" style="text-align:right;gap:2px">${bar?`<span class="plates">${plates(T)}</span>`:''}${r.w&&T!==r.w?`<span class="chip mid" style="align-self:flex-end">Prescribed ${n(r.w)}</span>`:''}<span class="muted">${r.m?`Max ${isBW(k)?'+'+n(r.m.v):n(r.m.src==='ratio'?Math.round(r.m.v):r.m.v)} · Cycle ${r.c}${r.m.src==='proj'?' (projected)':''}`:''}</span></div></div>`;
    if(bar) h+=plateSvg(T);
    if(r.m&&r.m.src==='ratio') h+=`<div class="note"><b>Swapped for this session.</b> This cycle is built on the ${esc(varsOf(k)[r.m.bv].name.toLowerCase())}, so the weight is your ${n(r.m.from)} max at the ${Math.round(r.m.r*100)}% a ${esc(varsOf(k)[r.vr].name.toLowerCase())} usually carries against it. Change the lift for the whole cycle in Setup instead if this is not a one-off.</div>`;
    if(isBW(k)) h+=`<div class="note">${T>0?`Hang ${n(T)} ${u()} from a belt. `:'Today’s percentage is at or below your bodyweight: do bodyweight reps. '}Based on ${r1(bwFor(sel))} ${u()} bodyweight${(bwAvg(sel,7)||{}).n>1?' (7-day average)':''}.</div>`;
    if(k==='pull'&&plan.machineNote) h+=`<div class="small muted">Machine: ${esc(plan.machineNote)}</div>`;
  } else h+=`<div class="muted">${isBW(k)&&r.m&&!bwFor(sel)?'Enter your bodyweight (Setup or the daily check-in) to calculate the added weight.':`No max entered for ${esc(liftName(k))}. Add it in Setup.`}</div>`;
  h+=`<div class="sets">`;
  for(let i=0;i<nSets;i++) h+=`<button class="setb${sets[i]?' on':''}${popKey===k+':'+i?' pop':''}${i>=r.s?' opt':''}" data-act="set" data-lift="${k}" data-i="${i}" aria-pressed="${!!sets[i]}" aria-label="Set ${i+1}${setEff(L,i)?', '+setEff(L,i):''}">${r.r}<small>${setEff(L,i)?EFFORT.find(([v])=>v===setEff(L,i))[1]:'Set '+(i+1)}</small></button>`;
  if(!viewing&&nSets<SETCAP(r)) h+=`<button class="setb add" data-act="addset" data-lift="${k}" aria-label="Add a set to ${esc(liftName(k))}">+<small>Set</small></button>`;
  const ex=+L.extra||0;
  const rm=restMins(k), heavyNote=(k==='squat'||k==='dead')&&r.t==='heavy'&&rm<5;
  h+=`</div><div class="restsel"><span>Rest</span><div class="seg">${[2,3,4,5].map(m=>`<button class="segb${rm===m?' on':''}" data-act="restmin" data-lift="${k}" data-v="${m}" aria-pressed="${rm===m}">${m} min</button>`).join('')}</div>${heavyNote?'<span>Heavy week: the book calls 5\u201310 min normal at this load.</span>':''}</div>`;
  // How the most recent set moved, rated where it was just ticked. The whole-lift
  // checkbox it replaces only shows on a day that already used it, so it can be cleared.
  { let last=-1; for(let i=nSets-1;i>=0;i--) if(sets[i]){ last=i; break }
    if(last>=0&&!viewing) h+=`<div class="restsel"><span>Set ${last+1} moved</span><div class="seg">${EFFORT.map(([v,t])=>`<button class="segb${setEff(L,last)===v?' on':''}" data-act="eff" data-lift="${k}" data-i="${last}" data-v="${v}" aria-pressed="${setEff(L,last)===v}">${t}</button>`).join('')}</div></div>`; }
  h+=`<div class="row between">${L.grinder?`<label class="check"><input type="checkbox" id="g-${k}" data-bind="lifts.${k}.grinder" checked> Whole lift marked a grinder</label>`:'<span></span>'}<label class="f" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:8px">${isBW(k)?'Added weight':'Working weight'}${numIn('lifts.'+k+'.used',L.used,r.w!=null?n(isBW(k)?Math.max(0,r.w):r.w):'','class="num-in"')}</label></div>`;
  if(ground(L)&&r.m&&!dp.deload&&r.p<=85) h+=`<div class="banner warn"><div>A grinder at ${r.p}% means the max is too high. Lower it rather than pushing through.</div><div><button class="btn sm" data-act="lower" data-lift="${k}" data-c="${r.c}">Lower Cycle ${r.c} max 5% (${n(floorTo(r.m.v*.95,plan.round[k]))})</button></div></div>`;
  if(ex>0&&!sets[nSets-1]&&!viewing) h+=`<div><button class="btn sm ghost" data-act="rmset" data-lift="${k}">− Remove the last set</button></div>`;
  if(isDead) h+=`<div class="small muted">Deadlift stays 1–3 sets. Rest 5 min on heavy weeks.</div>`;
  else if(r.sMax>r.s) h+=`<div class="note">${r.s} sets is the prescription. The dashed ones are optional — take them when you have it in you, leave them when you don’t. The two-minute rest still applies to every set you take.</div>`;
  h+=warmupLog(k,ramp(k,has?T:null,r.t,dp.deload),has?`Calculated from today's working weight (${fmtLoad(k,T)} ${u()}). Change the working weight above and the warm-ups recalculate.`:'');
  return h+`</div>`;
}
const openWarm=new Set();
function wuList(k){const W=((lg(sel).lifts||{})[k]||{}).warmup;return Array.isArray(W)?W:W?Object.keys(W).reduce((a,i)=>(a[+i]=W[i],a),[]):[]}
function warmupLog(k,sug,basis){
  const W=wuList(k), rows=Math.max(sug.length,W.length), open=openWarm.has(k)||(!sug.length&&W.length>0);
  let done=0, chips='';
  for(let i=0;i<rows;i++){const x=W[i]||{}, s=sug[i]; if(x.done) done++;
    const w=x.w!=null&&x.w!==''?x.w:s&&s.w, r=x.r!=null&&x.r!==''?x.r:s&&s.r;
    if(w!=null) chips+=`<span class="chipw${x.done?' on':''}">${isBW(k)?fmtLoad(k,+w):n(w)}×${r??'?'}</span>`}
  let body='';
  for(let i=0;i<rows;i++){const x=W[i]||{}, s=sug[i];
    const ew=x.w!=null&&x.w!==''?+x.w:s&&s.w, pl=isBarbell(k)&&ew?platesShort(ew):'';
    body+=`<div class="wu-row"><span class="wu-lbl">${s?s.lbl:'+'+(i+1)}</span>${numIn(`lifts.${k}.warmup.${i}.w`,x.w,s?n(s.w):u(),`aria-label="Warm-up ${i+1} weight"`)}<span class="wu-x">×</span>${numIn(`lifts.${k}.warmup.${i}.r`,x.r,s?String(s.r):'reps',`aria-label="Warm-up ${i+1} reps"`)}<button class="wu-chk${x.done?' on':''}" data-act="wu" data-lift="${k}" data-i="${i}" aria-pressed="${!!x.done}" aria-label="Warm-up ${i+1} done">✓</button>${s?'<span></span>':`<button class="wu-rm" data-act="wurm" data-lift="${k}" data-i="${i}" aria-label="Remove warm-up ${i+1}">×</button>`}${pl?`<span class="wu-pl">${pl}</span>`:''}</div>`}
  return `<details class="wu" data-lift="${k}"${open?' open':''}><summary><span class="wu-t">Warm-up${rows?` ${done}/${rows}`:''}</span>${chips||'<span class="muted">none logged</span>'}</summary><div class="wu-body">${sug.length?`<div class="small muted">${basis?basis+' ':''}Tap ✓ to log a set as suggested, or type what you actually used.</div>`:'<div class="small muted">Enter a target weight above to get calculated warm-ups.</div>'}${viewing?'':`<div class="restsel"><span>Rest between warm-ups</span><div class="seg">${WARM_RESTS.map(v=>`<button class="segb${warmRestSecs(k)===v?' on':''}" data-act="warmrest" data-lift="${k}" data-v="${v}" aria-pressed="${warmRestSecs(k)===v}">${warmRestLabel(v)}</button>`).join('')}</div></div>`}${body}<div><button class="btn sm ghost" data-act="wuadd" data-lift="${k}">+ Add warm-up set</button></div></div></details>`;
}

/* ---------- daily check-in ---------- */
const CI_Q=[
  {grp:'Last night'},
  {f:'sleepH',q:'How many hours did you sleep?',num:true,opts:[[5,'5'],[6,'6'],[7,'7'],[8,'8'],[9,'9+']]},
  {f:'sleepQ',q:'How well did you sleep?',opts:[[1,'Awful'],[2,'Poor'],[3,'OK'],[4,'Good'],[5,'Great']]},
  {grp:'Right now'},
  {f:'energy',q:'Energy level?',opts:[[1,'Drained'],[2,'Low'],[3,'Normal'],[4,'Good'],[5,'Fired up']]},
  {f:'soreness',q:'How sore are you?',opts:[[1,'None'],[2,'A little'],[3,'Some'],[4,'Very'],[5,'Wrecked']]},
  {f:'stress',q:'Stress outside the gym?',opts:[[1,'Low'],[2,'Mild'],[3,'Moderate'],[4,'High'],[5,'Very high']]},
  {grp:'Yesterday’s eating'},
  {f:'protein',q:'Did you hit your protein target?',hint:'target',opts:[['yes','Yes'],['close','Close'],['no','No']]},
  {f:'fuel',q:'How much did you eat compared to your plan?',opts:[['under','Under'],['on','About right'],['over','Over']]},
  {f:'water',q:'Enough water?',opts:[['yes','Yes'],['no','Not really']]},
  {f:'alcohol',q:'Any alcohol?',opts:[['none','None'],['some','1–2 drinks'],['lots','3+']]},
  {f:'kcal',q:'Calories yesterday',kcal:true},
  // Grams, for the same day the calories are for. Optional, and the card above shows
  // what they should have been so the numbers are worth typing.
  {f:'macros',q:'Protein, carbs, fat',macros:true},
  {grp:'Optional'},
  {f:'bw',q:'Bodyweight this morning',bw:true}
];
const openCI=new Set();
const cvErr={};              // per-lift error from the add-a-variant form
function ci(date){return (lg(date).checkin)||{}}
// Calories are asked for the morning after, so what you ate on day d is logged on d+1.
function kcalOn(d){const v=ci(addDays(d,1)).kcal;return v==null||v===''?null:+v}
// Measured ("adaptive") TDEE: what you ate against what the scale trend did about it.
// 3500 kcal per lb, 7700 per kg. Needs a settled 7-day average at both ends of the
// window and calories on most of its days, or it says nothing.
function endAvg(from,to){
  let sw=0,sd=0,n=0;
  for(let d=from;d<=to;d=addDays(d,1)){const L=logs[d];if(!L||!inProgram(d))continue;const v=L.checkin&&L.checkin.bw;if(v==null||v==='')continue;sw+=+v;sd+=D(d);n++}
  return n?{avg:sw/n,at:sd/n,n}:null;
}
function tdeeMeasured(date,days){
  days=days||28;
  const from=addDays(date,-(days-1)), kc=[];
  for(let d=from;d<=date;d=addDays(d,1)){const v=kcalOn(d);if(v)kc.push(v)}
  // Both ends average their own 7 days, so the window needs no history before it. The
  // divisor is the real gap between the two groups' mean dates, not the window length.
  const a=endAvg(from,addDays(from,6)), b=endAvg(addDays(date,-6),date);
  if(!a||!b||a.n<2||b.n<2||kc.length<Math.ceil(days*.6)) return null;
  const gap=(b.at-a.at)/864e5; if(gap<7) return null;
  const mean=kc.reduce((x,y)=>x+y,0)/kc.length, dw=b.avg-a.avg, per=u()==='kg'?7700:3500;
  return {tdee:Math.round(mean-dw*per/gap),mean:Math.round(mean),dw,gap:Math.round(gap),days,n:kc.length,from,to:date};
}
// Mifflin-St Jeor, the usual predictive formula, for before there is enough data.
function bmr(date){
  const bw=bwFor(date), ht=+plan.height, sex=plan.sex, age=ageNow();
  if(!bw||!ht||!sex||!age) return null;
  const kg=u()==='kg'?bw:bw/2.2046, cm=u()==='kg'?ht:ht*2.54;
  return Math.round(10*kg+6.25*cm-5*age+(sex==='f'?-161:5));
}
function ageNow(){const b=+plan.birthYear;if(!b||b<1900)return null;return +todayStr().slice(0,4)-b}
const ACT=[[1.375,'Light · desk job, little else'],[1.55,'Moderate · this program, desk job'],[1.725,'High · this program plus an active job'],[1.9,'Very high · manual work or two-a-days']];
function actFactor(){const v=+plan.activity;return ACT.some(x=>x[0]===v)?v:1.55}
function tdeePredicted(date){const b=bmr(date);return b?Math.round(b*actFactor()):null}
// The running estimate. Your burn is not a constant: it drifts with bodyweight, with how
// much you move, and with a long deficit. So this is recomputed for every day from the
// window ending that day, longest window that has the data.
// Early on the window is short and the scale noise dominates, so the estimate is pulled
// toward the formula; the weight on your own data is the window's span over span + 10
// days, scaled by how many of its days have calories. By a full 28-day window it is ~70%
// yours, and `tdeeTrust` keeps climbing as history accumulates until the formula drops out.
function tdeeOn(date){
  const pred=tdeePredicted(date);
  const m=tdeeMeasured(date,28)||tdeeMeasured(date,21)||tdeeMeasured(date,14);
  if(!m) return pred?{tdee:pred,predicted:pred,measured:null,w:0}:null;
  if(!pred) return {tdee:m.tdee,predicted:null,measured:m,w:1};
  // Two things decide how much of your own number to use: how long you have been logging
  // both (six weeks of it and the formula drops out entirely) and how completely you
  // filled in the window. Today's intake is unknowable, so it is not counted against you.
  const w=Math.min(1,tdeeHistory(date)/42);
  return {tdee:Math.round(m.tdee*w+pred*(1-w)),predicted:pred,measured:m,w};
}
function tdeeHistory(date){
  let n=0; for(let i=1;i<=42;i++){const d=addDays(date,-i),L=logs[d];if(kcalOn(d)!=null&&L&&L.checkin&&L.checkin.bw!=null&&L.checkin.bw!=='')n++}
  return n;
}
// The estimate over time: one point per week, each from its own 28-day window.
function tdeeSeries(date,weeks){
  const out=[];
  for(let i=(weeks||12)-1;i>=0;i--){
    const d=addDays(date,-7*i); if(d<plan.startMonday) continue;
    const t=tdeeOn(d); if(t&&t.measured) out.push({d,v:t.tdee,w:t.w,mean:t.measured.mean});
  }
  return out;
}
// US Navy circumference method. Men use waist and neck, women add the hips. Measurements
// are in inches with lb, cm with kg. Typical error is 3–4 points, so it is a trend tool.
function measBefore(date){
  let best=null;
  for(const [d,L] of Object.entries(logs)) if(d<date&&inProgram(d)&&L.meas&&L.meas.waist&&L.meas.neck&&(!best||d>best.d)) best={d,m:L.meas};
  return best;
}
function measOn(date){
  let best=null;
  for(const [d,L] of Object.entries(logs)) if(d<=date&&inProgram(d)&&L.meas&&L.meas.waist&&L.meas.neck&&(!best||d>best.d)) best={d,m:L.meas};
  return best;
}
function navyBf(m,date){
  const ht=+plan.height, sex=plan.sex;
  if(!ht||!sex||!m||!m.waist||!m.neck) return null;
  const toIn=v=>u()==='kg'?+v/2.54:+v;
  const w=toIn(m.waist), nk=toIn(m.neck), hp=m.hip?toIn(m.hip):null, h=toIn(ht);
  let v;
  if(sex==='f'){ if(!hp) return null; v=163.205*Math.log10(w+hp-nk)-97.684*Math.log10(h)-78.387 }
  else { if(w<=nk) return null; v=86.010*Math.log10(w-nk)-70.041*Math.log10(h)+36.76 }
  return v>0&&v<70?Math.round(v*10)/10:null;
}
function bfSeries(date){
  return progLogs().filter(([d,L])=>d<=date&&L.meas&&L.meas.waist&&L.meas.neck)
    .map(([d,L])=>({d,m:L.meas,bf:navyBf(L.meas,d)})).filter(x=>x.bf!=null).sort((a,b)=>a.d<b.d?-1:1);
}
function latestBw(date){let best=null;for(const [d,L] of Object.entries(logs)) if(d<=date&&L.checkin&&L.checkin.bw&&(!best||d>best.d)) best={d,v:+L.checkin.bw};return best?best.v:(plan.bodyweight?+plan.bodyweight:null)}
// Daily weigh-ins are noisy; everything that reacts to bodyweight uses a 7-day average
// and falls back to the latest single reading until there are two in the window.
function bwAvg(date,days){
  days=days||7; const from=addDays(date,-(days-1)), xs=[];
  for(const [d,L] of Object.entries(logs)) if(d>=from&&d<=date&&L.checkin&&L.checkin.bw) xs.push(+L.checkin.bw);
  return xs.length?{avg:xs.reduce((a,b)=>a+b,0)/xs.length,n:xs.length}:null;
}
function bwFor(date){const a=bwAvg(date,7);return a?a.avg:latestBw(date)}
// Change per week from the 7-day average now against the one `back` days ago.
function bwRate(date,back){
  back=back||14; const now=bwAvg(date,7), then=bwAvg(addDays(date,-back),7);
  if(!now||!then||now.n<2||then.n<2) return null;
  return {perWeek:(now.avg-then.avg)/back*7, from:then.avg, to:now.avg, back};
}
function proteinTarget(date){const bw=bwFor(date);if(!bw)return null;const lb=u()==='kg'?bw*2.2046:bw;return Math.round(lb*(+plan.proteinPerLb||0.8)/5)*5}
function readiness(c){
  const part=[], add=(v,w)=>{if(v!=null&&!Number.isNaN(v))part.push([Math.max(0,Math.min(1,v)),w])};
  const tgt=+plan.sleepTarget||8;
  if(c.sleepH!=null&&c.sleepH!=='') add((+c.sleepH-4)/(tgt-4),.25);
  if(c.sleepQ) add((c.sleepQ-1)/4,.15);
  if(c.energy) add((c.energy-1)/4,.2);
  if(c.soreness) add(1-(c.soreness-1)/4,.15);
  if(c.stress) add(1-(c.stress-1)/4,.1);
  const nut=[]; if(c.protein) nut.push({yes:1,close:.6,no:.2}[c.protein]); if(c.fuel) nut.push({on:1,over:.8,under:.3}[c.fuel]); if(c.water) nut.push({yes:1,no:.5}[c.water]); if(c.alcohol) nut.push({none:1,some:.7,lots:.3}[c.alcohol]);
  if(nut.length) add(nut.reduce((a,b)=>a+b,0)/nut.length,.15);
  if(part.length<3) return null;
  const tw=part.reduce((a,x)=>a+x[1],0);
  return Math.round(100*part.reduce((a,x)=>a+x[0]*x[1],0)/tw);
}
function rLevel(sc){return sc==null?null:sc>=75?{k:'go',cls:'light',t:'Ready'}:sc>=55?{k:'care',cls:'mid',t:'Moderate'}:{k:'stop',cls:'heavy',t:'Low'}}
// Black rotates its conditioning; the app lets you pick anything and never noticed when
// you stopped rotating. Looks at the hard sessions only — LISS is meant to be samey.
// What a logged session turned out to be. A FOBBIT run long is an E, whatever it was
// scheduled as, so it does not belong in a count of hard sessions.
function hicWasHard(x){ return !!x&&x.f!=='liss'&&!((IV[x.f]||{}).lead&&fobIsE(x.min)) }
function hicRut(date,n0){
  const xs=hicSessions().filter(x=>x.d<=date&&hicWasHard(x)).slice(-(n0||6));
  if(xs.length<(n0||6)) return null;
  const f=xs[0].f, mod=xs[0].mod;
  const sameF=xs.every(x=>x.f===f), sameM=xs.every(x=>x.mod===mod);
  if(!sameF&&!sameM) return null;
  return {n:xs.length,f:sameF?f:null,mod:sameM?mod:null,since:xs[0].d};
}
// One session you repeat to compare against itself. Results only compare within an
// activity and a format, so a benchmark is the single line worth watching when the rest
// of your conditioning moves around.
function benchmark(){
  const b=plan.benchmark;
  if(b&&MOD[b.mod]&&HIC[b.fmt]&&!HIC[b.fmt].noMetric) return b;
  // not chosen yet: the hard pairing you have done most
  const tally={};
  for(const x of hicSessions()) if(x.f!=='liss'&&x.v!=null) tally[x.mod+'|'+x.f]=(tally[x.mod+'|'+x.f]||0)+1;
  const top=Object.keys(tally).sort((a0,b0)=>tally[b0]-tally[a0])[0];
  if(!top) return null;
  const [mod,fmt]=top.split('|');
  return {mod,fmt,auto:true};
}
function benchmarkState(date){
  const b=benchmark(); if(!b) return null;
  const xs=hicSessions().filter(x=>x.d<=date&&x.mod===b.mod&&x.f===b.fmt&&x.v!=null);
  const last=xs[xs.length-1]||null, first=xs[0]||null;
  const days=last?Math.round((D(date)-D(last.d))/864e5):null;
  const every=+plan.benchEvery||35;
  return {...b,xs,last,first,days,every,due:!last||days>=every,best:xs.reduce((a0,x)=>Math.max(a0,x.v),0)};
}
function suggestions(date){
  const c=ci(date), sc=readiness(c), lv=rLevel(sc), wk=weekOf(date), dp=dayPlan(date), out=[];
  if(!lv) return out;
  const add=(tone,title,text,act)=>out.push({tone,title,text,act});
  const heavy=wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy';
  const hicFmt=dp.t==='hic'?effFmt(date):null;
  // today's session
  if(dp.t==='lift'){
    if(dp.deload) add('go','Deload day','Keep it easy regardless of how you feel. The point is recovery.');
    else if(lv.k==='go'&&sc>=85&&!(c.soreness>=4)) add('go','Green light: room for extra volume',`Operator allows 3–5 sets. If bar speed stays crisp, add a 4th set on squat and bench${heavy?' (heavy week: stop at 4)':''}. Deadlift stays at 1–3.`);
    else if(lv.k==='go') add('go','Train as written','Recovery looks good. Run the session as prescribed.');
    else if(lv.k==='care') add('care','Train as written, no extras','Hold at 3 sets (deadlift 1–2) and keep accessories to two movements.');
    else add('stop','Do the minimum today','3 sets on each lift, 1 set of deadlift, skip accessories. If the 70% warm-up feels heavy, lower today’s working weight 5–10%. Type it into the working weight box and the warm-ups recalculate. A lighter session still beats a skipped one.');
  }
  if(hicFmt&&hicFmt!=='liss'){
    const low={map:'8 rounds instead of 10',anaerobic:'6 rounds instead of 8',threshold:'3 rounds instead of 4',long:'4 rounds instead of 5'}[hicFmt];
    const hm=modOf(date), last=lastHic(hicFmt,hm,date).last;
    if(lv.k==='go') add('go','Push the conditioning',last?`Last ${HIC[hicFmt].name} (${MOD[hm].name}): ${n(last.v)} ${last.u}. Try to beat it.`:`Go hard and record your result as a baseline.`);
    else if(lv.k==='care') add('care','Conditioning: low end of the range',`Do ${low}. Hold the same pace, just fewer rounds.`);
    else add('stop','Swap today’s HIC to LISS','30–45 min conversational. Change the format in the conditioning card so your history stays clean.');
  }
  if(dp.plyo&&(lv.k==='stop'||c.soreness>=4)) add('care','Plyos: halve the contacts','Cut, don’t skip. Tick “halve the contacts” and drop depth jumps today. Stop the moment a jump comes up short.');
  if(dp.t==='test'||dp.t==='rm5'){
    if(lv.k!=='go') add('care','Testing on a so-so day','If you can move the test a day, do it. If not, take the lower number. Starting light and adding later works. Starting heavy and stalling doesn’t.');
    else add('go','Good day to test','Ramp in singles, stop when the bar slows.');
  }
  if(dp.t==='off'&&lv.k==='stop') add('go','Good timing for a rest day','Prioritize sleep tonight. An easy walk helps more than lying still.');
  // recovery
  const tgt=+plan.sleepTarget||8;
  if(c.sleepH!=null&&c.sleepH!==''&&+c.sleepH<6) add('care','Short on sleep','Have caffeine early (nothing within 8 h of bed). A 20-minute nap before 3 pm helps. Don’t chase PRs today.');
  const recent=[];for(let i=0;i<7;i++){const d=addDays(date,-i),x=ci(d);if(x.sleepH!=null&&x.sleepH!=='')recent.push(+x.sleepH)}
  if(recent.length>=3){const avg=recent.reduce((a,b)=>a+b,0)/recent.length;if(avg<tgt-1) add('care',`Sleep averaging ${avg.toFixed(1)} h`,`That’s your biggest recovery lever. Set a fixed wake time, keep the room cool and dark, screens off 30 min before bed, and no HIC within 3 h of bedtime. Aim for ${tgt} h.`)}
  if(c.stress>=4) add('care','High stress counts as training load','Do the required sessions but drop anything optional: swap Saturday HIC to LISS and skip extra sets.');
  if(c.soreness>=4&&(dp.t==='lift'||dp.t==='test')) add('care','Very sore','Add 5 minutes to the cardio warm-up and extra hip work; soreness usually eases once warm. Sharp or joint pain is different: skip that lift.');
  // nutrition
  const pt=proteinTarget(date);
  if(c.protein==='no'||c.protein==='close') add('care','Protein',pt?`Aim for about ${pt} g today: 4 meals of ~${Math.round(pt/4/5)*5} g. Easy wins: Greek yogurt, eggs, chicken, lean beef, a whey shake.`:'Add your bodyweight (in Setup or below) to get a daily protein target.');
  const training=dp.t!=='off'&&dp.t!=='convert';
  if(c.fuel==='under'&&training) add('care','Fuel the session',`Under-eating shows up first in conditioning numbers. Eat carbs 2–3 h before training (rice, oats, potatoes, fruit)${plan.goal==='lose'?'. You can stay in a deficit, just put most of your carbs around training':''}.`);
  if(c.water==='no') add('care','Hydrate','Start with 16–24 oz of water now, and add 16–24 oz for each hour of hard conditioning. A pinch of salt helps on HIC days.');
  if(hicFmt&&hicFmt!=='liss'){
    const rut=hicRut(date,6);
    if(rut) add('care','Rotate your conditioning',`Your last ${rut.n} hard sessions were all ${rut.f?HIC[rut.f].name:''}${rut.f&&rut.mod?' on the ':''}${rut.mod?MOD[rut.mod].name.toLowerCase():''}. Black rotates formats and tools on purpose \u2014 pick a different one today and the adaptation stays broad.`);
    const bm=benchmarkState(date);
    if(bm&&bm.due&&bm.last) add('go','Benchmark due',`It has been ${bm.days} days since your ${MOD[bm.mod].name} ${HIC[bm.fmt].name} benchmark (best ${n(bm.best)}). Run that one today and you get a number that compares straight back.`);
  }
  if(c.alcohol==='lots') add('care','After a big night','Expect lower HIC numbers and don’t chase a PR. Extra water and a solid breakfast.');
  // trends
  let lowDays=0;for(let i=0;i<7;i++){const x=readiness(ci(addDays(date,-i)));if(x!=null&&x<55)lowDays++}
  const nm=addDays(mondayOf(date),7), nw=weekOf(nm);
  if(lowDays>=3&&nw&&nw.kind==='cycle') add('stop',`${lowDays} low-readiness days this week`,`Recovery isn’t keeping up. Consider a deload week starting ${fmtD(nm,true)}.`,{act:'insert',kind:'deload',monday:nm,label:'Deload next week'});
  {const r=bwRate(date,14);
    if(r){const perWk=r.perWeek, pct=perWk/r.from*100;
      if(plan.goal==='lose'&&pct<-1) add('care',`Losing ${Math.abs(perWk).toFixed(1)} ${u()}/week`,'That is from your 7-day average, and faster than about 1% of bodyweight per week tends to cost strength and conditioning. Add 200–300 kcal a day, mostly carbs around training.');
      else if(plan.goal==='lose'&&pct>-0.2) add('care','Bodyweight is flat','Two weeks of 7-day averages with no real change: trim about 200 kcal a day, or add one LISS session.');
      else if(plan.goal==='gain'&&pct<0.1) add('care','Not gaining','Add 200–300 kcal a day. Easiest from an extra meal or a bigger post-training meal.');
    }}
  return out;
}
function checkinCard(date){
  if(date>todayStr()) return '';
  const c=ci(date), sc=readiness(c), lv=rLevel(sc), open=openCI.has(date)||sc==null, pt=proteinTarget(date);
  const qs=CI_Q.map(q=>{
    if(q.grp) return `</div><div class="ci-grp"><h4>${q.grp}</h4>`;
    if(q.bw) return `<label class="q"><span>${q.q} <small>(${u()})</small></span>${numIn('checkin.bw',c.bw,latestBw(date)?n(latestBw(date)):'','class="num-in"')}</label>`;
    if(q.kcal) return `<label class="q"><span>${q.q} <small>(kcal, optional)</small></span>${numIn('checkin.kcal',c.kcal,'','class="num-in"')}</label>`;
    if(q.macros){
      const t=macroTarget(date);
      return `<div class="q"><span>${q.q} <small>(g, optional)</small></span><div class="row" style="gap:6px">
      ${[['proG','P',t&&t.p],['carbG','C',t&&t.c],['fatG','F',t&&t.f]].map(([f,lbl,tg])=>
        `<label class="macro-in"><span class="small muted">${lbl}</span>${numIn('checkin.'+f,c[f],tg?String(tg):'','class="num-in"')}</label>`).join('')}
      </div></div>`;
    }
    const hint=q.hint==='target'&&pt?` <small>(~${pt} g)</small>`:'';
    return `<div class="q"><span>${q.q}${hint}</span><div class="seg">${q.opts.map(([v,l])=>`<button class="segb${c[q.f]==v&&c[q.f]!==''&&c[q.f]!=null?' on':''}" data-act="ci" data-f="${q.f}" data-v="${v}" aria-pressed="${c[q.f]==v}">${l}</button>`).join('')}${q.num?numIn('checkin.sleepH',c.sleepH,'exact','class="num-in" style="max-width:84px" aria-label="Exact hours slept"'):''}</div></div>`;
  }).join('');
  const sug=suggestions(date);
  let h=`<div class="card"><div class="lift-h"><h3>Daily check-in</h3>${lv?`<span class="chip ${lv.cls}">${lv.t}</span>`:''}</div>`;
  if(lv) h+=`<div class="ready"><div class="big">${sc}</div><div class="small muted">Readiness out of 100, from sleep, energy, soreness, stress and yesterday’s eating.</div></div>`;
  else h+=`<p class="note" style="margin:0">Answer at least three questions (30 seconds) and the app adjusts today’s suggestions to how you’re recovering.</p>`;
  if(sug.length) h+=`<ul class="sug">${sug.map(x=>`<li class="${x.tone}"><div><b>${esc(x.title)}</b>${esc(x.text)}${x.act?`<div style="margin-top:6px"><button class="btn sm" data-act="${x.act.act}" data-kind="${x.act.kind}" data-monday="${x.act.monday}">${x.act.label}</button></div>`:''}</div></li>`).join('')}</ul>`;
  h+=`<details class="plain" id="ci-${date}"${open?' open':''}><summary>${lv?'Edit answers':'Questions'}</summary><div class="stack" style="gap:16px;margin-top:12px">${qs.replace(/^<\/div>/,'')}</div></div></details>`;
  if(lv) h+=`<p class="small muted" style="margin:0">General training guidance, not medical advice.</p>`;
  return h+`</div>`;
}
function accList(day){const a=(plan.acc||{})[day];return Array.isArray(a)&&a.length?a:ACC[day]}
function accCard(wk,dp){
  /* Unlike the heavy-week rule this one is not contradicted by anything: both books
     that use the word mean a harder stop than we do. TB3's deload is the bridge week,
     "simply taking a week off in between Blocks", and Ageless Athlete takes "a
     complete deload from lifting (and a deep reduction of conditioning)". Dropping the
     supplementary work while keeping three light sessions is the gentler version of
     the same idea, not a departure from it. The deload week itself is ours though --
     TB1 has no strength deload at all -- so the card says so rather than stating it
     flat, the way the heavy-week rule used to. */
  if(dp.deload) return `<div class="card"><h3>Accessories</h3><p class="muted" style="margin:0">None this week. A deload is for recovering, so the supplementary work comes off with the rest of the volume.</p><p class="small muted" style="margin:0"><b>Ours</b>, and so is the deload week \u2014 TB1 prescribes no strength deload, TB3\u2019s is a bridge week off altogether, and <i>Ageless Athlete</i> takes a complete break from lifting. Three light sessions is our lighter reading of all three.</p></div>`;
  const v=wkRx(wk), arx=accRxFor(wk,dp.day);
  /* No book says to skip accessories on a heavy week. That rule was ours and it read
     like the book's. What TB1 gives is a test, and it is about recovery rather than the
     calendar: "If your accessory work is interfering with your recovery to the point
     it's affecting your main lifts, then you're not doing it right. Cut back or
     eliminate it. Leave the main lifts unaffected." Its only weeks-3-and-6 concession
     is to the main lift -- drop a set of the prescribed work if the volume is too much
     -- and the reason it gives is a gruelling conditioning session, not accessories.
     TB1 from the other side: "But if you want to throw in supplementary push-ups,
     pull-ups, ab work etc. go for it."

     So the week no longer decides. The note says what the book says, the judgment is
     yours, and the skip is one tap when you make it. A program that prescribes its
     supplementary work still means it, heavy week or not. */
  const day=dp.acc; if(!day) return '';
  const slots=accSlots(day), done=accDoneCount(sel,day);
  const heavy=!arx&&wk.kind==='cycle'&&tier(+v.p)==='heavy';
  const skipped=accSkipped(sel);
  const title=arx?'Supplementary':'Accessories';
  let h=`<div class="card"><div class="lift-h"><h3>${title}</h3>${arx?`<span class="rx">${arx.s}${arx.sMax?'\u2013'+arx.sMax:''} \u00d7 ${arx.r} @ ${arx.p}%</span>`:''}<span class="small muted">${done} of ${slots.length} done</span></div>
  <p class="muted small" style="margin:0">${arx?`Every one of these, ${arx.sMax?`${arx.s} or ${arx.sMax}`:arx.s} sets of ${arx.r}. The percentage is of your own best for that movement \u2014 if you have never tested it, take ${arx.r} reps you could have done a couple more of.`:'Two or three sets each, a couple of reps short of failure. Nothing that leaves you sore for tomorrow\u2019s HIC.'}</p>`;
  if(heavy) h+=`<div class="banner info"><div class="small"><b>Heavy week.</b> The books do not say to drop these. TB1\u2019s test is whether the work is costing you the main lifts: \u201cif your accessory work is interfering with your recovery to the point it\u2019s affecting your main lifts, then you\u2019re not doing it right. Cut back or eliminate it.\u201d <b>Ours:</b> a heavy week is where that bites first, so cut the accessories back before you cut the lifts.</div></div>`;
  if(skipped) return h+`<div class="row between" style="margin-top:4px"><span class="small muted">Skipped today.</span><button class="btn sm ghost" data-act="accskip">Bring them back</button></div></div>`;
  if(!slots.length) h+=`<div class="muted small">No accessory slots on this day. Add some in Setup \u2192 Accessories.</div>`;
  for(const g of accRunGroups(day)){
    if(g.length>1) h+=`<div class="acc-super"><div class="small" style="font-weight:650">Superset \u00b7 ${esc(g.map(sl=>(ASLOT[sl]||{}).name||sl).join(' + '))}</div>
      <div class="small muted">A set of each, back to back, then rest. ${arx?'':'Two or three rounds.'}</div>
      ${g.map(sl=>accSlotRow(sel,sl)).join('')}</div>`;
    else h+=accSlotRow(sel,g[0]);
  }
  if(!viewing&&slots.length) h+=`<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="accskip">Skip these today</button></div>`;
  return h+`</div>`;
}

// One slot: what it is for, what is filling it today, and what you did.
function accSlotRow(date,slot){
  const id=accOn(date,slot), e=accEx(id), sets=accSets(date,slot), swapped=accSwapped(date,slot);
  const list=accFor(slot,id), all=accAll();
  const isDone=accDone(date,slot), noSets=!sets.length;
  let h=`<div class="acc-slot">
  <div class="acc-head"><span class="acc-role">${esc((ASLOT[slot]||{}).name||slot)}</span>${swapped?'<span class="chip blue">today only</span>':''}${isDone?'<span class="chip light">done</span>':''}</div>`;
  if(viewing){
    h+=`<div><b>${esc(e?e.name:'\u2014')}</b></div>`;
  } else {
    h+=`<select data-act-acc="${esc(slot)}" aria-label="${esc((ASLOT[slot]||{}).name||slot)}">${list.map(k=>`<option value="${esc(k)}"${k===id?' selected':''}>${esc(all[k].name)}${all[k].gear?' \u00b7 '+esc(all[k].gear):''}</option>`).join('')}</select>`;
  }
  if(slot==='pullup') h+=`<div class="small muted">${esc(pullupState(date).st.work)}</div>`;
  // A movement that carries its own prescription says it here, where the sets are logged.
  if(e&&e.rx) h+=`<div class="small"><b>${esc(e.rx)}</b>${e.src?`<div class="small muted">${esc(e.src)}</div>`:''}</div>`;
  // A band exercise with bands on file: pick the color, get the number in the weight
  // field. Still editable afterwards — the band is a shortcut, not a lock.
  if(!viewing&&isBandEx(id)&&bands().length) h+=`<label class="f small">Band<select data-act-band="${esc(slot)}"><option value="">Pick a band\u2026</option>${bands().map(x=>`<option value="${esc(String(x.w))}">${esc(x.n)} \u00b7 ${n(x.w)} ${esc(u())}</option>`).join('')}</select></label>`;
  h+=accLastLine(date,slot,id);
  for(let i=0;i<sets.length;i++){
    const x=sets[i]||{};
    h+=`<div class="wu-row"><span class="wu-lbl">${i+1}</span>${numIn(`acc.sets.${slot}.${i}.w`,x.w,isBWAcc(id)?'bw':u(),`aria-label="Set ${i+1} weight"`)}<span class="wu-x">\u00d7</span>${numIn(`acc.sets.${slot}.${i}.r`,x.r,'reps',`aria-label="Set ${i+1} reps"`)}<span></span>${viewing?'<span></span>':`<button class="wu-rm" data-act="accrm" data-slot="${esc(slot)}" data-i="${i}" aria-label="Remove set ${i+1}">\u00d7</button>`}</div>`;
  }
  if(!viewing) h+=`<div class="row" style="gap:8px"><button class="btn sm ghost" data-act="accadd" data-slot="${esc(slot)}">+ Add set</button>${noSets?`<button class="btn sm${isDone?' primary':' ghost'}" data-act="accdone" data-slot="${esc(slot)}">${isDone?'\u2713 Done':'Mark done'}</button>`:''}</div>`;
  return h+`</div>`;
}
// Pull-ups and dips are loaded by bodyweight unless you hang a belt on.
function isBWAcc(id){ return ['abtriad','chinup','dip','pu_prog','pu_band','pu_neg','invrow','plank','sideplank','copen','deadbug','deadhang','nordic','ghr','abwheel','hangknee','hangleg','backext','pullapart','pike'].includes(id) }

function lastHic(fmt,mod,before){
  let best=null,last=null;
  for(const x of hicSessions(true)){ if(x.d>=before||x.f!==fmt||x.mod!==mod||x.v==null) continue;
    if(!last||x.d>last.d) last=x; if(!best||hicValue(x)>hicValue(best)) best=x; }
  return {best,last};
}
/* Mod #1 prescribes a percentage of a 1RM rather than a rep count. If there is a max on
   file, turn it into the weight on the bar; without one we still show the percentage,
   because the session works either way and you can do the arithmetic. */
function fobLoadLine(bouts){
  const out=[];
  for(const b of (bouts||[])){
    if(!b.pct||!b.lift) continue;
    const mx=(plan.maxes||{})[b.lift], pc=Array.isArray(b.pct)?b.pct:[b.pct,b.pct], nm=esc(liftName(b.lift));
    if(mx==null||mx===''){ out.push(`${nm} at ${pc[0]}–${pc[1]}% of your 1RM. Put a 1RM in Setup and this becomes a weight.`); continue }
    const w=pc.map(p=>rnd(+mx*p/100,(plan.round||{})[b.lift]));
    out.push(`${nm} at ${pc[0]}–${pc[1]}% of ${n(+mx)}: <b>${n(w[0])}${w[1]!==w[0]?' to '+n(w[1]):''} ${u()}</b>.`);
  }
  return out.length?`<div class="small muted">${out.join(' ')}</div>`:'';
}
function hicCard(dp,note){
  const L=lg(sel).hic||{}, f=L.format||dp.fmt, H=HIC[f], mod=modOf(sel), M=MOD[mod], met=metricFor(mod,f);
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">${esc(mod==='other'&&L.what?L.what:M.name)} · ${H.name}</span><span class="chip">${H.sys}</span></div>`;
  const lead0=(IV[f]||{}).lead?ivOpts(sel,f):null;
  h+=`<div style="font-size:18px;font-weight:700">${lead0?`${lead0.rounds} bouts \u00b7 ${esc(secsLabel(lead0.every))} of base between`:H.sess}</div>${note}`;
  h+=`<div class="restsel"><span>Activity</span><div class="seg">${Object.entries(MOD).map(([k,x])=>`<button class="segb${k===mod?' on':''}" data-act="mod" data-v="${k}" aria-pressed="${k===mod}">${x.name}</button>`).join('')}</div></div>`;
  if((IV[f]||{}).lead){
    // What a FOBBIT is, and nothing about which one. Every number that varies between
    // them is read from the selection, so this cannot go stale when you change it.
    const fo=ivOpts(sel,f), held=(fo.bouts||[]).some(b=>b.hold);
    h+=`<div class="note">Hold an easy aerobic base, step off it every ${esc(fobEveryLabel(fo.fob))} for a bout of work, then get back on it.${(fo.bouts||[]).length>1?' The movements rotate in order.':''} ${(IV[f]||{}).fob?'Pick which FOBBIT below. ':''}Row, skip, cycle or take the stairs if you would rather not run.</div>`;
    if(held) h+=`<div class="small muted"><b>A bout of reps is not on the clock.</b> ${fo.count==='total'?'The timer holds at each one until you tap Done, so the wall clock reads longer than the session.':'Only the base counts toward the session, so the timer holds at each set until you tap Done, and the wall clock will read a good deal longer than the session length.'}</div>`;
  }
  else if(f!=='liss') h+=`<div class="small muted">Warm-up: ${M.wu||'5 min easy, then 3 × 15 s at HIC pace with 45 s easy between.'}</div>`;
  if(M.tip&&(f!=='liss'||mod==='ruck')) h+=`<div class="small muted">${M.tip}</div>`;
  if(dp.plyo&&mod==='run'&&f!=='liss') h+=`<div class="banner warn"><div class="small">Plyos already loaded your legs today. Keep sprint volume at the low end of the range, or ride instead.</div></div>`;
  h+=`<div class="grid2"><label class="f">Format<select id="hic-fmt" data-bind="hic.format">${Object.entries(HIC).map(([k,x])=>`<option value="${k}"${k===f?' selected':''}>${x.name}</option>`).join('')}</select></label>`;
  if(mod==='other'&&!(HIC[f]||{}).noMetric) h+=`<label class="f">Activity<input type="text" id="hic-what" data-bind="hic.what" value="${esc(L.what||'')}" placeholder="e.g. hill sprints, assault runner"></label>`;
  if((IV[f]||{}).fob){
    const fb=fobOf(sel), F=FOBBIT[fb];
    h+=`<label class="f">Which one<select data-act-fob="1" aria-label="Which FOBBIT">${Object.entries(FOBBIT).map(([k,x])=>`<option value="${esc(k)}"${k===fb?' selected':''}>${esc(x.name)}${x.gear?' \u00b7 '+esc(x.gear):''}</option>`).join('')}</select></label>`;
    // What the timer will actually do, so a halved day reads as halved here too.
    const o=ivOpts(sel,f);
    if(fobDef(fb)){
      h+=`<div class="small"><b>${esc(boutsLine(o.bouts))}</b>, between ${esc(fobEveryLabel(fb))} of base.${o.ease?' Reps are halved today.':''}</div>`;
      h+=fobLoadLine(o.bouts);
    }
    if(F&&F.bpm) h+=`<div class="small muted">Base pace: ${F.bpm[0]}\u2013${F.bpm[1]} bpm, or the talk test.</div>`;
    if(F&&F.note) h+=`<div class="small muted">${esc(F.note)}</div>`;
    if(fobDef(fb)) h+=`<div class="small muted">${F.src==='ours'?'The shape is the book\u2019s; these movements are the app\u2019s own.':'From '+esc(fobSrcLabel(fb))+'.'}</div>`;
    if(!fobDef(fb)) h+=`<label class="f">Movements<input type="text" id="hic-what" data-bind="hic.what" value="${esc(L.what||'')}" placeholder="e.g. sandbag clean / push-up"></label>`;
    h+=`<label class="f">Bouts done${numIn('hic.rounds',L.rounds,String(o.rounds))}</label>`;
  }
  else if((HIC[f]||{}).noMetric){
    const o=ivOpts(sel,f);
    h+=`<label class="f">Bouts done${numIn('hic.rounds',L.rounds,String(o.rounds))}</label>`;
  }
  {
    const plan0=ivPartsLabel(f,ivOpts(sel,f)).total;
    h+=`<label class="f">Minutes${numIn('hic.min',L.min,String(plan0))}</label>`;
  }
  if(met) h+=`<label class="f">${metricLabel(met)}${f==='liss'?' <span style="font-weight:500">(optional)</span>':''}${numIn('hic.'+met[0],L[met[0]],'')}</label>`;
  if(M.load) h+=`<label class="f">Ruck load (${u()})${numIn('hic.load',L.load,'')}</label>`;
  if(M.elev) h+=`<label class="f">Elevation gain (${elevUnit()})${numIn('hic.elev',L.elev,'')}</label>`;
  h+=`</div>`;
  {
    const plan0=ivPartsLabel(f,ivOpts(sel,f)).total;
    if(L.min==null||L.min==='') {
      const pl=ivPartsLabel(f,ivOpts(sel,f));
      h+=`<div class="row" style="align-items:baseline"><span class="small muted">No minutes logged.</span><button class="btn sm" data-act="minplan" data-v="${plan0}">Use ${plan0} min</button>${(IV[f]||{}).lead&&(L.rounds==null||L.rounds==='')?`<button class="btn sm" data-act="boutplan" data-v="${ivOpts(sel,f).rounds}">Use ${ivOpts(sel,f).rounds} bouts</button>`:''}</div><div class="note">That is ${esc(pl.text)}${pl.rounds?((IV[f]||{}).lead?(()=>{const fo=ivOpts(sel,f),hd=(fo.bouts||[]).some(b=>b.hold);
        return `, counted as ${pl.rounds} \u00d7 ${esc(secsLabel(fo.every))} of base${hd?`; the ${pl.rounds} bouts of reps sit on top, so the clock will say more`:` and ${pl.rounds} timed bouts, which are counted in`}`})():`, from ${pl.rounds} rounds (there is no easy period after the last one, so ${pl.rounds} \u00d7 hard + ${pl.rounds-1} \u00d7 easy)`):''}. Change the field if you did more or less.</div>`;
    }
  }
  {
    const o=ivOpts(sel,f), r=IV[f], segs=ivSegments(f,o), running=iv&&iv.date===sel&&!iv.done;
    h+=`<div class="ivset"><div class="lift-h"><span class="lift-name">Interval timer</span><span class="small muted mono">${ivPartsLabel(f,o).total} min${(IV[f]||{}).lead&&o.count!=='total'?' of base':' total'}</span></div>`;
    if(r&&r.lead) h+=`<div class="restsel"><span>Session</span><div class="seg">${(o.minOpts||[]).map(v=>`<button class="segb${o.mins===v?' on':''}" data-act="ivopt" data-k="mins" data-v="${v}" aria-pressed="${o.mins===v}">${v} min</button>`).join('')}</div></div>`
      +`<div class="small muted">${o.rounds} \u00d7 ${esc(secsLabel(o.every))} of base${o.count==='total'?', with the bouts counted in':''}. ${o.isE?'<b>Over 30 minutes, so this counts as an E session rather than a HIC</b> \u2014 that is the book\u2019s line, not ours.':'Under 30 minutes, so it counts as a HIC.'}</div>`;
    else if(r&&r.rounds[0]!==r.rounds[1]) h+=`<div class="restsel"><span>Rounds</span><div class="seg">${Array.from({length:r.rounds[1]-r.rounds[0]+1},(_,i)=>r.rounds[0]+i).map(v=>`<button class="segb${o.rounds===v?' on':''}" data-act="ivopt" data-k="rounds" data-v="${v}">${v}</button>`).join('')}</div></div>`;
    if(ivOpts(sel,f).ease&&easyCondWeek(sel)) h+=`<div class="note"><b>Easy conditioning week.</b> Your lifts are at ${wkRx(weekOf(sel)).p}% this week. TB2 asks for the rounds cut in half here \u2014 \u201cdon\u2019t strain, just grease the groove with little effort\u201d \u2014 and says the easy week is meant to land on the heavy lifting weeks. This is deliberate, not a missed week.</div>`;
  if(f==='liss') h+=`<div class="restsel"><span>Minutes</span><div class="seg">${[30,35,40,45].map(v=>`<button class="segb${o.lissMin===v?' on':''}" data-act="ivopt" data-k="lissMin" data-v="${v}">${v}</button>`).join('')}</div></div>`;
    h+=`<div class="row" style="gap:14px">${f!=='liss'?`<label class="check"><input type="checkbox" id="iv-warm" data-act-change="ivwarm" ${o.warm?'checked':''}> Warm-up (5 min + 3 pickups ≈ 8 min)</label>`:''}<label class="check"><input type="checkbox" id="iv-cool" data-act-change="ivcool" ${o.cool?'checked':''}> 5 min cool-down</label><label class="check"><input type="checkbox" id="iv-voice" data-pbind="voice" ${plan.voice?'checked':''}> Spoken cues</label><label class="check"><input type="checkbox" id="iv-quiet" data-pbind="quietTimer" ${plan.quietTimer?'checked':''}> Silent (keep my music)</label></div>`;
    if(plan.quietTimer) h+=`<div class="note">Silent: the timer vibrates and counts down on screen, and never opens an audio channel, so whatever you are listening to keeps playing. Turn rest alerts on in Setup if you want a notification at each change.</div>`;
    h+=`<div><button class="btn primary" data-act="ivstart" data-f="${f}" ${running||sel!==todayStr()?'disabled':''}>${running?'Timer running':'Start intervals'}</button>${sel!==todayStr()?' <span class="small muted">Available on the day.</span>':''}</div></div>`;
  }
  if(f!=='liss'&&met){const hist=lastHic(f,mod,sel);
    h+= hist.last?`<div class="small muted">Last ${M.name} ${H.name}: <span class="mono">${n(hist.last.v)}</span> ${met[1]}${flatEquiv(hist.last)!=null?` (<span class="mono">${n(flatEquiv(hist.last))}</span> ${met[1]} flat)`:''} on ${fmtD(hist.last.d,true)} · Best <span class="mono">${n(hicValue(hist.best))}</span>${flatEquiv(hist.best)!=null?' flat':''}</div>`:`<div class="small muted">First logged ${M.name} ${H.name} session. Results only compare against the same activity and format.</div>`}
  return h+`</div>`;
}
const openPx=new Set();
let popKey=null;
function plyoSets(ex,cut){return Math.max(1,Math.round(ex.s*plyoShare()/(cut?2:1)))}
function plyoContactsDone(ph,L,cut){let c=0;ph.ex.forEach((e,i)=>{const t=((L.sets||[])[i]||[]).filter(Boolean).length;c+=t*e.c/e.s});return Math.round(c)}
function plyoPullback(date){
  const c=ci(date), out=[];
  if(c.soreness>=4) out.push('you logged high soreness today');
  let short=0;for(let i=0;i<3;i++){const x=ci(addDays(date,-i));if(x.sleepH!=null&&x.sleepH!==''&&+x.sleepH<6.5)short++}
  if(short>=2) out.push('sleep has been short for several nights');
  const wed=lg(addDays(date,-1)); if(+wed.rpe>=9||Object.values(wed.lifts||{}).some(x=>ground(x))) out.push('yesterday’s lifting was hard');
  return out;
}
// The jump-prep drills. Shared by the Thursday plyo session and the jump-test days,
// where three maximal attempts off a cold ankle is exactly how a calf goes.
function plyoWarmBlock(L,cls){
  const done=(L.warm||[]).filter(Boolean).length;
  return `<details class="plain${cls||''}" data-px="wu"${openPx.has('wu')?' open':''}><summary>Jump warm-up · ${done} of ${PLYO_WARMUP.length} done · about 8 min, not counted</summary><div class="stack" style="margin-top:8px">${PLYO_WARMUP.map(([id,l,d,why],i)=>`<div class="pwu"><button class="wu-chk${(L.warm||[])[i]?' on':''}" data-act="pwu" data-i="${i}" aria-pressed="${!!(L.warm||[])[i]}" aria-label="${esc(l)} done">✓</button><details class="px" data-px="wu-${id}"${openPx.has('wu-'+id)?' open':''}><summary><span>${l}</span><span class="mono small">${d}</span></summary><div class="small muted" style="margin:4px 0 6px">${why}</div>${plyoEntry(id)}</details></div>`).join('')}</div></details>`
}
// The upper-body block: throws, not ground contacts, and the first thing to drop.
// Each phase is a set of slots (a movement pattern); which movement fills a slot is the
// person's choice and is remembered per phase, so the block fits whatever kit is around.
function plyoUpperPhase(wk){return wk.kind==='cycle'?PLYO_UPPER[Math.floor((wk.plyoIdx%9)/3)]:PLYO_UPPER[0]}
function upKey(ph,k){return PLYO_UPPER.indexOf(ph)+'-'+k}
function plyoUpperEx(ph){
  return ph.slots.map((sl,k)=>{
    const want=(plan.plyoUp||{})[upKey(ph,k)]||sl.def;
    const o=sl.opts.find(x=>x.id===want)||sl.opts[0];
    return {...o,s:sl.s,slot:sl.name,opts:sl.opts,k};
  });
}
function plyoUpperCard(wk,cut,pullback){
  const on=!!plan.plyoUpper, ph=plyoUpperPhase(wk), L=(lg(sel).plyo||{}).up||{};
  let h=`<div class="ivset"><div class="lift-h"><span class="lift-name">Upper body${on?' · '+esc(ph.name):''}</span><label class="check"><input type="checkbox" id="p-upper" data-act="plyoupper" ${on?'checked':''}> Include</label></div>`;
  if(!on) return h+`<div class="note">Optional upper-body power: throws, explosive pulls and speed presses. Operator's bench is deliberately sub-maximal and the bike does nothing for the upper body, so this fills a real gap. Pick a movement per slot from whatever you have — med ball, bodyweight, barbell or a band. Five minutes, full rest, every rep maximal.</div></div>`;
  h+=`<div class="stack" style="gap:10px">`;
  plyoUpperEx(ph).forEach((e,i)=>{
    const n0=cut?Math.ceil(e.s/2):e.s, sets=(L[i])||[];
    h+=`<div class="pex"><label class="f up-pick"><span class="small muted">${esc(e.slot)}</span><select id="plyoup-${upKey(ph,i)}" data-pbind="plyoUp.${upKey(ph,i)}">${e.opts.map(o=>`<option value="${o.id}"${o.id===e.id?' selected':''}>${esc(o.label)} · ${esc(o.gear)}</option>`).join('')}</select></label>
    <details class="px" data-px="up${i}"${openPx.has('up'+i)?' open':''}><summary><span>${esc(e.label)}</span><span class="mono small">${n0} × ${esc(e.r)} · ${e.rest} s</span></summary>${plyoEntry(e.id)}</details>
    <div class="sets">${Array.from({length:n0},(_,j)=>`<button class="setb sm${sets[j]?' on':''}" data-act="upset" data-i="${i}" data-j="${j}" aria-pressed="${!!sets[j]}">${esc(String(e.r).split(' ')[0])}<small>Set ${j+1}</small></button>`).join('')}</div></div>`;
  });
  h+=`</div><div class="note">Throws and explosive reps, not ground contacts, so they do not count toward the contact target. Bench is on all three lifting days and Friday is the day after: if it ever feels flat, this is the first block to cut.</div>`;
  if(pullback||cut) h+=`<div class="banner warn"><div class="small">You are already pulling back today. Drop this block or do one movement.</div></div>`;
  return h+`</div>`;
}
function plyoCard(wk,dp){
  const ph=plyoPhase(wk), L=lg(sel).plyo||{}, cut=!!(dp.plyoCut||L.cut);
  const done=plyoContactsDone(ph,L,cut), target=Math.round(ph.target*plyoShare()/(cut?2:1));
  // Plyos move independently of the week's sessions, so what comes after them varies.
  const after=dp.t==='hic'?' before the conditioning':dp.t==='lift'||dp.t==='rm5'||dp.t==='test'?' before you lift':'';
  let h=`<div class="card"><div class="lift-h"><span class="lift-name">Plyos · ${ph.name}</span><span class="rx">~${target} contacts</span></div><div class="small muted">${esc(ph.desc)} 15–20 min of actual work${after}.</div>`;
  const pb=plyoPullback(sel);
  if(pb.length&&!cut) h+=`<div class="banner warn"><div class="small"><b>Pull-back check:</b> ${esc(pb.join('; '))}. The program says cut the session in half (or warm-up only). Cut, don’t skip.</div></div>`;
  h+=plyoWarmBlock(L);
  h+=`<div class="stack" style="gap:12px">`;
  ph.ex.forEach((e,i)=>{
    const n0=plyoSets(e,cut), sets=((L.sets||[])[i])||[];
    h+=`<div class="pex"><details class="px" data-px="ex${i}"${openPx.has('ex'+i)?' open':''}><summary><span>${esc(e.label)}${e.low?' <span class="chip">low intensity</span>':''}</span><span class="mono small">${n0} × ${e.r} · ${e.rest>=120?e.rest/60+' min':e.rest+' s'}</span></summary>${plyoEntry(e.id)}</details>
    <div class="sets">${Array.from({length:n0},(_,j)=>`<button class="setb sm${sets[j]?' on':''}" data-act="pset" data-i="${i}" data-j="${j}" aria-pressed="${!!sets[j]}">${esc(e.r.split(' ')[0])}<small>Set ${j+1}</small></button>`).join('')}</div></div>`;
  });
  h+=`</div>`;
  h+=`<div class="grid3"><label class="f">First broad jump (in)${numIn('plyo.mark',L.mark,'')}</label><label class="f">Best broad jump (in)${numIn('plyo.best',L.best,'')}</label><label class="f">Contacts done${numIn('plyo.contacts',L.contacts,String(done))}</label></div>`;
  if(L.mark) h+=`<div class="small">Stop the session if a jump drops below <b class="mono">${n(Math.round(L.mark*.95*10)/10)} in</b> (5% off your first jump).</div>`;
  if(!dp.plyoCut) h+=`<label class="check"><input type="checkbox" id="p-cut" data-bind="plyo.cut" ${L.cut?'checked':''}> Hard lifting week: halve the contacts</label>`;
  h+=plyoUpperCard(wk,cut,pb.length>0);
  h+=`<details class="plain"><summary>The three rules, and when to pull back</summary><div class="stack small" style="margin-top:8px"><div><b>1. Watch your distance, not your set count.</b> If any jump drops more than about 5% off your first broad jump, the session is over, even with sets remaining.</div><div><b>2. Every rep is maximal or near it.</b> Rest fully between sets. If you are breathing hard, you are doing conditioning, not plyometrics.</div><div><b>3. Cut, don’t skip.</b> After an unusually hard lifting week, halve the contacts rather than dropping the session.</div><div><b>Cut the session in half, or do the warm-up only, if:</b><ul class="tight" style="margin-top:4px">${PLYO_PULLBACK.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div></details>`;
  return h+`</div>`;
}
function jumpCard(sub){
  const J=lg(sel).jumps||{};
  const f=(id,lbl,key,unit)=>`<div class="pex"><details class="px" data-px="jt-${id}"${openPx.has('jt-'+id)?' open':''}><summary><span>${lbl}</span><span class="mono small">3 attempts · best counts</span></summary>${plyoEntry(id)}</details><label class="f">Best (${unit})${numIn('jumps.'+key,J[key],'')}</label></div>`;
  return `<div class="card"><h3>Jump tests</h3><p class="muted small" style="margin:0">${sub} Maximal efforts: do the jump warm-up above first, rest a full minute between attempts so each one is fresh, and measure the same way every time.</p>
  <div class="stack" style="gap:10px;margin-top:10px">${f('broad','Broad jump','broad','in')}${f('vertj','Vertical','vertical','in')}${f('triple','Standing triple jump','triple','in')}</div></div>`;
}
function testCard(k,defReps,isRm5){
  const T=(lg(sel).test||{})[k]||{}, reps=T.r||defReps, e=estMax(k,T.w,reps,sel), cur=currentMax(k)??((plan.prevMaxes||{})[k]??null);
  const bw=latestBw(sel);
  const est=cur==null?null:isBW(k)?(bw?floorTo((bw+cur)*(isRm5?.87:1)-bw,plan.round[k]):null):(isRm5?floorTo(cur*.87,plan.round[k]):cur);
  const tgt=T.target!=null&&T.target!==''?+T.target:(T.w!=null&&T.w!==''?+T.w:est);
  return `<div class="card"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="rx">${isRm5?'5RM · 2 in reserve':'Heavy single'}${isBW(k)?' · added weight':''}</span></div>
  <div class="grid4"><label class="f">Target${numIn('test.'+k+'.target',T.target,est?n(est):'')}</label><label class="f">Result weight${numIn('test.'+k+'.w',T.w,'')}</label><label class="f">Reps${numIn('test.'+k+'.r',T.r,String(defReps))}</label><label class="f">Est. 1RM<div class="big" style="font-size:34px">${e?n(floorTo(e,plan.round[k])):'—'}</div></label></div>
  ${warmupLog(k,testRamp(k,tgt,isRm5),tgt!=null?`Calculated from a target of ${isBW(k)?fmtLoad(k,tgt):n(tgt)} ${u()}${T.target?'':T.w?' (your result)':' (from your current max)'}.`:'')}
  <div class="small muted">${isRm5?'If the bar slows, you have found your number. Bad day: take the lower number.':'Work up in singles. Stop when the bar slows.'}${cur!=null?(currentMax(k)==null?' Last program’s max: ':' Current max: ')+'<span class="mono">'+(isBW(k)?'+':'')+n(cur)+'</span>.':''}${k==='pull'?' Note the machine and pin setting.':''}${isBW(k)?' Enter the weight you added (0 for bodyweight). Uses your latest bodyweight.':''}</div></div>`;
}
function currentMax(k){const wk=weekOf(sel);if(!wk)return null;const c=wk.kind==='cycle'?wk.cycle:wk.refCycle;const m=maxFor(c)[k];return m?m.v:null}
function bestPullups(){let b=null;for(const [d,L] of Object.entries(logs)) if(d<sel&&L.pullups&&(!b||+L.pullups>b.v)) b={d,v:+L.pullups};return b?`<div class="small muted">Previous best: <span class="mono">${b.v}</span> on ${fmtD(b.d,true)}</div>`:''}
function weekResults(wk,field){
  const out={};for(let i=0;i<7;i++){const d=addDays(wk.monday,i),T=(lg(d)[field])||{};for(const k of LK){const t=T[k];if(t&&t.w!=null&&t.w!==''){const def=dayPlan(d).t==='rm5'?5:1;const e=estMax(k,t.w,t.r||def,d);if(e)out[k]=floorTo(e,plan.round[k])}}}
  return out;
}
function applyCard(wk){
  const res=weekResults(wk,'test'), nc=wk.nextCycle, cur=nc?(plan.cycleMaxes[nc]||{}):{};
  const rows=activeLifts().map(k=>{const proj=nc?maxFor(nc)[k]:null;return `<tr><td>${esc(liftName(k))}</td><td class="n">${res[k]!=null?n(res[k]):'—'}</td><td class="n">${proj?n(proj.v):'—'}</td></tr>`}).join('');
  const applied=nc&&LK.every(k=>res[k]==null||+cur[k]===res[k]);
  return `<div class="card"><h3>Feed results forward</h3><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Tested</th><th class="n">Cycle ${nc||'—'} now</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note" style="margin:0">If a lift didn't move, that's information, not failure. Leave it blank to keep the projected number.</p>
  <div><button class="btn primary" data-act="applytest" data-monday="${wk.monday}" ${!nc||!Object.keys(res).length||applied?'disabled':''}>${applied&&Object.keys(res).length?'Applied to Cycle '+nc:'Use for Cycle '+(nc||'—')}</button></div></div>`;
}
function convertCard(wk){
  const res=weekResults(wk,'test');
  const rows=activeLifts().map(k=>`<tr><td>${esc(liftName(k))}</td><td class="n">${res[k]!=null?n(res[k]):'—'}</td><td class="n">${plan.maxes[k]!=null&&plan.maxes[k]!==''?n(plan.maxes[k]):'—'}</td></tr>`).join('');
  const done=LK.every(k=>res[k]==null||+plan.maxes[k]===res[k]);
  return `<div class="card"><h3>Convert 5RMs to maxes</h3><p class="small muted" style="margin:0">Each 5RM ÷ 0.87, rounded down. Missing a lift? Enter it in Setup.</p><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Est. 1RM</th><th class="n">Saved max</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div><button class="btn primary" data-act="savemaxes" data-monday="${wk.monday}" ${!Object.keys(res).length||done?'disabled':''}>${done&&Object.keys(res).length?'Saved as your maxes':'Save as my maxes'}</button></div></div>`;
}
function painAt(L){const a=L.painAt;return Array.isArray(a)?a:a?[a]:[]}
function footer(active){
  if(!active) return '';
  const L=lg(sel), dp=dayPlan(sel), lifting=dp.t==='lift'||dp.t==='rm5'||dp.t==='test';
  const after=lifting?`<div class="stack" style="gap:10px;border-top:1px solid var(--line);padding-top:12px">
    <div class="restsel"><span>How did it move?</span><div class="seg">${FEELS.map(([v,l])=>`<button class="segb${L.feel===v?' on':''}" data-act="sfeel" data-v="${v}" aria-pressed="${L.feel===v}">${l}</button>`).join('')}</div></div>
    <div class="restsel"><span>Anything hurt?</span><div class="seg">${PAINS.map(([v,l])=>`<button class="segb${L.pain===v?' on':''}" data-act="spain" data-v="${v}" aria-pressed="${L.pain===v}">${l}</button>`).join('')}</div></div>
    ${L.pain&&L.pain!=='none'?`<div class="restsel"><span>Where</span><div class="seg">${Object.entries(PAIN_AT).map(([k,x])=>`<button class="segb${painAt(L).includes(k)?' on':''}" data-act="spainat" data-v="${k}" aria-pressed="${painAt(L).includes(k)}">${x.name}</button>`).join('')}</div></div>
    <div class="small muted">${L.pain==='sharp'?'Sharp pain counts against that lift at the end of the cycle. Stop the movement causing it rather than working around it.':'Logged as a flag. It won’t move your numbers, but it shows up in the cycle review if it keeps happening.'}</div>`:''}
  </div>`:'';
  return `<div class="card"><div class="grid2"><label class="f">Session RPE<select id="rpe" data-bind="rpe" data-type="num"><option value="">—</option>${[5,6,7,8,9,10].map(v=>`<option value="${v}"${+L.rpe===v?' selected':''}>${v}</option>`).join('')}</select></label><div style="display:flex;align-items:flex-end"><button class="btn ${L.done?'':'primary'}" style="width:100%" data-act="done">${L.done?'✓ Done · undo':'Mark session done'}</button></div></div><label class="f">Notes<textarea id="notes" data-bind="notes" placeholder="Machine settings, how it moved, anything to remember">${esc(L.notes||'')}</textarea></label>${after}</div>`;
}

/* ---------------- what matters today ----------------
Pick up to three things to pay attention to before a session, and get an honest account
of them afterwards. Not a restatement of the prescription — the numbers are already on
the cards. This is about how you mean to train, which is the part that drifts.

Some aims the app can check from what you logged. Some only you can judge, so those ask
you once at the end rather than being guessed at. The difference is visible on screen:
a scored line says what it counted, a self-rated line asks.

And the note you write afterwards is shown before the next comparable session, which is
the whole reason to write one. `logs[d].notes` already existed and went straight into a
table nobody reads. */

const AIM_MAX = 3;

// check(date) -> {ok, detail} for an aim the app can score, or null for one only you can.
const AIMS_LIFT = [
  { id: 'sets', label: 'Complete every set as programd', check(d) {
      const dp = dayPlan(d), wk = weekOf(d);
      if (!wk || !(dp.lifts || []).length) return null;
      let want = 0, got = 0;
      for (const k of dp.lifts) {
        const r = rx(wk, k, d), done = ((lg(d).lifts || {})[k] || {}).sets || [];
        want += r.s; got += Math.min(r.s, done.filter(Boolean).length);
      }
      return { ok: got >= want, detail: `${got} of ${want}.` };
    } },
  { id: 'warmup', label: 'Do the full warm-up, not the short one', check(d) {
      const L = lg(d), flags = Array.isArray(L.warmup) ? L.warmup : [];
      const ITEMS = warmItems(), hasShort = !!warmRoutine().short;
      const idx = ITEMS.map((x, i) => i).filter(i => !(hasShort && L.warmShort) || ITEMS[i].s);
      const got = idx.filter(i => flags[i]).length;
      if (hasShort && L.warmShort) return { ok: false, detail: `The short version, ${got} of ${idx.length}.` };
      return { ok: got >= idx.length, detail: `${got} of ${idx.length}.` };
    } },
  { id: 'technique', label: 'Keep technique tight — no ugly reps' },
  { id: 'rest', label: 'Take the full rest between sets' },
  { id: 'short', label: 'Stop short of failure', check(d) {
      const lifts = Object.entries((lg(d).lifts) || {}).filter(([, v]) => ground(v));
      if (!lifts.length) return { ok: true, detail: 'Nothing logged as a grinder.' };
      return { ok: false, detail: lifts.map(([k]) => liftName(k, d)).join(', ') + ' ground.' };
    } },
  { id: 'acc', label: 'Get the accessories done, not skipped', check(d) {
      const dp = dayPlan(d); if (!dp.acc) return null;
      const slots = accSlots(dp.acc), got = accDoneCount(d, dp.acc);
      return { ok: got >= slots.length, detail: `${got} of ${slots.length}.` };
    } },
  { id: 'mob', label: 'Finish with the mobility block', check(d) {
      const items = mobList(mobKind(dayPlan(d))), flags = lg(d).mobility || [];
      const got = items.filter((_, i) => flags[i]).length;
      return { ok: got >= items.length, detail: `${got} of ${items.length}.` };
    } },
  { id: 'unhurried', label: 'Keep it unhurried' },
];

// Conditioning asks different questions. The lifting ones are about execution; these
// are about where the effort went, which is the thing that actually goes wrong on a
// bike. `when` keeps a question off a day it cannot mean anything on -- there are no
// rounds, and no easy periods, in a steady session.
const AIMS_COND = [
  { id: 'crounds', label: 'Hit every round as prescribed',
    when: d => ivRounds(d) > 0,
    check(d) {
      const want = ivRounds(d), got = +((lg(d).hic || {}).rounds);
      if (!want) return null;
      if (!isFinite(got) || !got) return { ok: false, detail: 'No rounds logged.' };
      return { ok: got >= want, detail: `${got} of ${want}.` };
    } },
  { id: 'cwarm', label: 'Warm up properly before the hard efforts',
    when: d => effFmt(d) !== 'liss',
    check(d) {
      const on = (((lg(d).hic || {}).iv) || {}).warm;
      return { ok: !!on, detail: on ? 'Logged.' : 'Not logged \u2014 the session started cold, or it went unticked.' };
    } },
  { id: 'cpace', label: 'Hold the pace \u2014 no fading on the last rounds', when: d => ivRounds(d) > 0 },
  { id: 'ceasy', label: 'Keep the easy periods genuinely easy', when: d => ivRounds(d) > 0 },
  { id: 'cspare', label: 'Finish able to do one more, not emptied' },
  { id: 'ccool', label: 'Cool down instead of stopping dead', check(d) {
      const on = (((lg(d).hic || {}).iv) || {}).cool;
      return { ok: !!on, detail: on ? 'Logged.' : 'Not logged.' };
    } },
  { id: 'clog', label: 'Log the number so it can be compared', check(d) {
      const H = lg(d).hic || {}, met = metricFor(modOf(d), effFmt(d));
      if (met) { const v = H[met[0]]; return { ok: v != null && v !== '', detail: v != null && v !== '' ? `${n(v)} ${met[1]}.` : 'Nothing logged to compare against.' } }
      const m = H.min; return { ok: m != null && m !== '', detail: m ? `${n(m)} min.` : 'No minutes logged.' };
    } },
];
// How many hard rounds the day's format asks for, or 0 for a steady session.
function ivRounds(d) {
  try { const f = effFmt(d); if (!f || f === 'liss') return 0; return +(ivOpts(d, f) || {}).rounds || 0 } catch (e) { return 0 }
}

// Which set of questions a day gets, already filtered to the ones that can apply.
function aimSet(date) {
  const t = (dayPlan(date) || {}).t;
  const base = t === 'lift' ? AIMS_LIFT : t === 'hic' ? AIMS_COND : [];
  return base.filter(a => !a.when || a.when(date));
}
function aimById(date, id) { return aimSet(date).find(a => a.id === id) || null }
function aimsOn(date) { const a = lg(date).aims; return Array.isArray(a) ? a.filter(id => aimById(date, id)) : [] }
function aimRating(date, id) { return ((lg(date).aimsRated) || {})[id] || null }
const RATE = { yes: 'Held up', part: 'Slipped late on', no: 'No' };

// Toggling an aim, with the cap enforced here rather than only in the markup: the click
// handler cannot be reached from a test, so the rule has to live somewhere that can.
function pickAim(date, id) {
  if (!aimById(date, id)) return false;
  const cur = aimsOn(date);
  if (cur.includes(id)) { setLog(date, 'aims', cur.filter(x => x !== id)); return true }
  if (cur.length >= AIM_MAX) return false;
  setLog(date, 'aims', [...cur, id]);
  return true;
}
function rateAim(date, id, v) {
  if (!aimById(date, id) || !RATE[v]) return;
  setLog(date, 'aimsRated.' + id, aimRating(date, id) === v ? null : v);
}

// A day you can set an aim on: one that asks something of you.
// Any day that asks something of you. The note you leave is worth reading back whatever
// the session was, so it is gated on this rather than on the aims.
function trainingDay(date) { const t = (dayPlan(date) || {}).t; return !['off', 'pre', 'convert'].includes(t) }
// Lifting days get the lifting questions, conditioning days the conditioning ones, and
// anything else — a test day, a Base Building circuit — gets none. A test day is not
// the place to be setting intentions about technique.
function aimsDay(date) { return aimSet(date).length > 0 }

/* ---------------- the note you left last time ---------------- */

// The most recent note from a comparable session, falling back to the most recent of
// any kind. Comparable means the same sort of day: your last squat note is the one
// worth reading before squatting, not Tuesday's bike session.
function lastNote(date) {
  const kind = d => { const t = (dayPlan(d) || {}).t; return t === 'lift' || t === 'rm5' || t === 'test' ? 'lift' : t };
  const want = kind(date);
  const days = Object.keys(logs).filter(d => d < date && (logs[d].notes || '').trim()).sort().reverse();
  const same = days.find(d => kind(d) === want);
  const d = same || days[0];
  if (!d) return null;
  return { date: d, text: String(logs[d].notes).trim(), short: (dayPlan(d) || {}).short || '', same: !!same };
}
function noteCard(date) {
  if (viewing || !trainingDay(date) || lg(date).noteSeen || lg(date).done) return '';
  const n = lastNote(date); if (!n) return '';
  return `<div class="card"><div class="lift-h"><h3>From your last ${esc(n.same && n.short ? n.short : 'session')}</h3><span class="small muted">${esc(fmtD(n.date, true))}</span></div>
  <p style="margin:0;white-space:pre-wrap">${esc(n.text)}</p>
  <div class="row"><button class="btn sm ghost" data-act="noteseen">Got it</button></div></div>`;
}

/* ---------------- before ---------------- */

function aimsCard(date) {
  if (viewing || !aimsDay(date)) return '';
  if (lg(date).done) return aimsReport(date);
  const picked = aimsOn(date);
  return `<div class="card"><div class="lift-h"><h3>What matters today</h3><span class="small muted">${picked.length ? picked.length + ' of ' + AIM_MAX : 'pick up to ' + AIM_MAX}</span></div>
  <p class="note" style="margin:0">Not the numbers — those are on the cards below. This is how you mean to train today, and you get an honest account of it afterwards.</p>
  <div class="stack" style="gap:4px">${aimSet(date).map(a => {
    const on = picked.includes(a.id), full = picked.length >= AIM_MAX && !on;
    return `<button class="aim${on ? ' on' : ''}" data-act="aim" data-id="${a.id}"${full ? ' disabled' : ''} aria-pressed="${on}">${on ? '✓' : ''} ${esc(a.label)}</button>`;
  }).join('')}</div>
  ${picked.length >= AIM_MAX ? '<div class="small muted">Three is the limit. Any more and none of them is a focus.</div>' : ''}</div>`;
}

/* ---------------- after ---------------- */

// Has this aim been slipping? Only across sessions, never from one.
function aimPattern(date, id) {
  const prior = Object.keys(logs).filter(d => d < date && aimsOn(d).includes(id) && aimRating(d, id))
    .sort().reverse().slice(0, 3);
  const bad = prior.filter(d => aimRating(d, id) !== 'yes').length;
  if (prior.length < 2 || bad < 2) return '';
  const a = aimById(date, id); if (!a) return '';
  const why = id === 'technique' ? 'That usually means the weight, not the focus.'
    : id === 'short' ? 'A max set too high will do that. Lowering it is the fix.'
    : id === 'cpace' ? 'Going out too hard on the first rounds is the usual cause, not a lack of fitness.'
    : id === 'cspare' ? 'These are meant to be repeatable. Emptying yourself on one is borrowing from the next.'
    : id === 'ceasy' ? 'If the easy parts are not easy, the hard parts cannot be hard. Slow them right down.'
    : 'Worth changing something rather than trying harder at it.';
  return `You have picked “${esc(a.label)}” ${prior.length + 1} sessions running and it has not held up. ${why}`;
}

function aimsReport(date) {
  const picked = aimsOn(date);
  let h = `<div class="card"><div class="lift-h"><h3>How it went</h3></div>`;
  if (!picked.length) h += `<p class="small muted" style="margin:0">You did not set anything for this one.</p>`;
  for (const id of picked) {
    const a = aimById(date, id); if (!a) continue;
    const res = a.check ? a.check(date) : null;
    if (res) {
      h += `<div class="aim-row"><div><b>${res.ok ? '✓' : '✗'} ${esc(a.label)}</b><div class="small muted">${esc(res.detail)}</div></div></div>`;
    } else {
      const r = aimRating(date, id);
      h += `<div class="aim-row"><div><b>${r === 'yes' ? '✓' : r ? '✗' : ''} ${esc(a.label)}</b>
      <div class="seg" style="margin-top:4px">${Object.entries(RATE).map(([k, l]) => `<button class="segb${r === k ? ' on' : ''}" data-act="aimrate" data-id="${id}" data-v="${k}" aria-pressed="${r === k}">${l}</button>`).join('')}</div></div></div>`;
    }
    const p = aimPattern(date, id);
    if (p) h += `<div class="banner info"><div class="small">${p}</div></div>`;
  }
  const L = lg(date);
  h += `<label class="f" style="margin-top:4px">Anything to remember?<textarea id="aim-notes" data-bind="notes" rows="3" placeholder="How it moved, what to change, what to watch">${esc(L.notes || '')}</textarea></label>
  <div class="note">This is shown to you before your next ${esc((dayPlan(date) || {}).short || 'session')}, which is the point of writing it.</div></div>`;
  return h;
}

/* ---------- end-of-cycle review ---------- */
// Operator has no autoregulation. At the end of each cycle this reads what you logged
// (grinders, missed sets, effort on heavy weeks, readiness) and suggests next cycle's
// max per lift. Nothing changes until you apply it.
let reviewSel={};
/* ---------- how each working set moved ----------
Per set, so the review can see what a heavy week actually did rather than inferring it
from one number for the whole session. None of the books uses RPE or reps-in-reserve,
so this does not either; it uses their words. TB1's Golden Rule is to complete every
rep and avoid failure, and to finish feeling fresh -- "If you feel relatively fresh
after your strength session, you are doing it RIGHT." Ageless Athlete: "If you have to
grind your way through your sets on day one, there is a good chance that things will be
worse on Day 2." The three-point scale is ours. Ground is the books' word.

  fast    moved quickly, plenty left -- the fresh session TB1 describes
  solid   an honest working set, nothing to report
  ground  it slowed and had to be fought up: a grinder, AA's warning sign

`eff` sits beside `sets` on the lift, one entry per set index. */
const EFFORT=[['fast','Fast'],['solid','Solid'],['ground','Ground']];
function setEff(x,i){ const e=x&&Array.isArray(x.eff)?x.eff[i]:null; return EFFORT.some(([k])=>k===e)?e:null }
// Did this lift grind? The old whole-lift checkbox, or any set rated ground. One answer,
// read everywhere the checkbox used to be read, so old logs keep counting.
function ground(x){ return !!(x&&(x.grinder||(Array.isArray(x.eff)&&x.eff.includes('ground')))) }
// Tapping the rating a set already has clears it, so a slip of the thumb is undone in place.
function setEffort(date,k,i,v){
  if(!EFFORT.some(([e])=>e===v)) return false;
  const x=(lg(date).lifts||{})[k]||{}, arr=Array.isArray(x.eff)?[...x.eff]:[];
  arr[i]=arr[i]===v?null:v;
  for(let j=0;j<arr.length;j++) if(arr[j]===undefined) arr[j]=null;
  setLog(date,'lifts.'+k+'.eff',arr);
  return true;
}
// "fast, solid, ground" for whatever was rated, in set order.
function groundSets(x){ const n=Array.isArray(x&&x.eff)?x.eff.filter(e=>e==='ground').length:0; return Math.max(n,x&&x.grinder?1:0) }
function effSummary(x){ return (Array.isArray(x&&x.eff)?x.eff:[]).filter(Boolean).join(', ') }
function reviewCycleFor(date){
  const wk=weekOf(date); if(!wk) return null;
  let c=null;
  if(wk.kind==='cycle'&&wk.w===6&&dow(date)>=4) c=wk.cycle;
  else if(wk.kind==='cycle'&&wk.w<=2&&wk.cycle>1) c=wk.cycle-1;
  else if(wk.kind!=='cycle'&&wk.kind!=='bridge'&&wk.refCycle) c=wk.refCycle;
  if(!c||(plan.reviews||{})[c]) return null;
  return c;
}
function cycleStats(c){
  const list=weeks(), stats={}, rd=[];
  for(const wk of list){
    if(wk.kind!=='cycle'||wk.cycle!==c) continue;
    const heavy=tier(+wkRx(wk).p)==='heavy', p=+wkRx(wk).p;
    for(let i=0;i<7;i++){
      const d=addDays(wk.monday,i), L=logs[d]; if(!L) continue;
      const r=readiness(L.checkin||{}); if(r!=null) rd.push(r);
      const dp=dayPlan(d); if(dp.t!=='lift') continue;
      for(const k of dp.lifts){
        const x=(L.lifts||{})[k]; if(!x) continue;
        const sets=Array.isArray(x.sets)?x.sets:[], ticked=sets.filter(Boolean).length;
        if(!ticked&&!ground(x)) continue;
        const need=k==='dead'?1:+wkRx(wk).s;
        const S=stats[k]||(stats[k]={n:0,grind:0,heavyGrind:0,lightGrind:0,missed:0,rpe:[],sharp:0,niggle:0,where:{},heavyRated:0,heavyFast:0,groundSets:0});
        S.n++; if(ground(x)){S.grind++; if(heavy)S.heavyGrind++; if(p<=85)S.lightGrind++}
        // What each working set did, where it was rated.
        for(let j=0;j<sets.length;j++){ const e=setEff(x,j); if(!e) continue;
          if(e==='ground') S.groundSets++;
          if(heavy){ S.heavyRated++; if(e==='fast') S.heavyFast++ } }
        // a complaint counts against the lifts its location plausibly belongs to
        if(L.pain==='sharp'||L.pain==='niggle'){
          const where=painAt(L), mine=where.length?where.filter(w=>((PAIN_AT[w]||{}).lifts||[]).includes(k)):[];
          if(!where.length||mine.length){ S[L.pain==='sharp'?'sharp':'niggle']++; for(const w of mine) S.where[w]=(S.where[w]||0)+1 }
        }
        if(L.done&&ticked<need) S.missed++;
        if(heavy&&L.rpe) S.rpe.push(+L.rpe);
      }
    }
  }
  return {stats, readiness:rd.length?rd.reduce((a,b)=>a+b,0)/rd.length:null};
}
function reviewOptions(k,cur){
  const inc=+plan.inc[k]||0, rd=+plan.round[k]||5;
  return {reduce:floorTo(cur*.95,rd), hold:cur, standard:cur+inc, bigger:cur+inc+rd};
}
function painWords(S){
  const w=Object.entries(S.where||{}).sort((a,b)=>b[1]-a[1]).map(([k])=>(PAIN_AT[k]||{}).name||k);
  return w.length?' ('+w.join(', ').toLowerCase()+')':'';
}
function recommend(S,rdAvg){
  if(!S) return ['standard','Not enough logged sessions to judge, so the standard increase.'];
  const rpe=S.rpe.length?S.rpe.reduce((a,b)=>a+b,0)/S.rpe.length:null;
  const pain=[]; if(S.sharp) pain.push(`${S.sharp} with sharp pain${painWords(S)}`); if(S.niggle) pain.push(`${S.niggle} with a niggle`);
  const rated=S.heavyRated||0, fast=S.heavyFast||0;
  const bits=[`${S.n} sessions`,`${S.grind} grinder${S.grind===1?'':'s'}`,`${S.missed} missed`]
    .concat(rated?[`${fast} of ${rated} heavy sets fast`]:rpe!=null?[`heavy-week RPE ${rpe.toFixed(1)}`]:[]).concat(pain).join(' · ');
  // pain outranks everything else, including too few sessions to judge on
  if(S.sharp>=2) return ['reduce',bits+'. Sharp pain more than once on this lift: take the weight down and find out why before adding any.'];
  if(S.sharp>=1) return ['hold',bits+'. Sharp pain on this lift: hold the max rather than adding to it.'];
  if(S.n<3) return ['standard',(S.niggle?bits+'. ':'')+'Not enough logged sessions to judge, so the standard increase.'];
  if(S.missed>=3||S.lightGrind>=2) return ['reduce',bits+'. Grinding at moderate weights means the max is too high.'];
  if(S.missed>=1||S.heavyGrind>=1||S.grind>=2) return ['hold',bits+'. Repeat this max and own it.'];
  // The bigger increase. Per-set ratings are the better evidence, so they decide when
  // there are enough of them; the session's RPE is the fallback when there are not.
  // Ours, not the book's: four rated heavy sets is the least worth judging on, and
  // three in four fast is a heavy week that did not look heavy.
  if(rated>=4){
    if(fast/rated>=.75&&(rdAvg==null||rdAvg>=55)) return ['bigger',bits+'. The heavy sets moved fast \u2014 the max has room in it.'];
    return ['standard',bits+'. On track.'];
  }
  if(rpe!=null&&rpe<=7&&(rdAvg==null||rdAvg>=55)) return ['bigger',bits+'. Heavy weeks moved easily.'];
  return ['standard',bits+'. On track.'];
}
function reviewCard(c){
  const {stats,readiness:rdAvg}=cycleStats(c), mx=maxFor(c), nxt=(plan.cycleMaxes||{})[c+1]||{};
  const lifts=activeLifts().filter(k=>mx[k]);
  if(!Object.keys(stats).length) return '';
  const lbl={reduce:'Lower 5%',hold:'Hold',standard:'Standard',bigger:'Bigger jump'};
  let h=`<div class="card"><div class="lift-h"><h3>Cycle ${c} review</h3><span class="chip blue">Next: Cycle ${c+1}</span></div><p class="note" style="margin:0">Suggested from your grinders, missed sets and effort on heavy weeks${rdAvg!=null?` (average readiness ${Math.round(rdAvg)})`:''}. Pick next cycle’s max for each lift, then apply.</p>`;
  for(const k of lifts){
    const cur=mx[k].v, opts=reviewOptions(k,cur), [rec,why]=recommend(stats[k],rdAvg), preset=nxt[k]!=null&&nxt[k]!=='';
    const choice=reviewSel[k]||(preset?'keep':rec);
    const fmt=v=>isBW(k)?'+'+n(v):n(v);
    h+=`<div class="stack" style="gap:6px;border-top:1px solid var(--line);padding-top:10px"><div class="lift-h"><span class="lift-name">${esc(liftName(k))}</span><span class="small muted mono">now ${fmt(cur)}</span></div><div class="small muted">${esc(why)}</div><div class="seg">${preset?`<button class="segb${choice==='keep'?' on':''}" data-act="rvsel" data-lift="${k}" data-v="keep">Keep ${fmt(+nxt[k])} (set)</button>`:''}${Object.entries(opts).map(([o,v])=>`<button class="segb${choice===o?' on':''}" data-act="rvsel" data-lift="${k}" data-v="${o}">${lbl[o]} ${fmt(v)}${o===rec?' ★':''}</button>`).join('')}</div></div>`;
  }
  h+=`<div class="row"><button class="btn primary" data-act="rvapply" data-c="${c}">Apply to Cycle ${c+1}</button><button class="btn ghost" data-act="rvdismiss" data-c="${c}">Dismiss</button><span class="small muted">★ = suggested</span></div>`;
  // The review decides one number per lift; the report has the rest of the cycle.
  if(cycleDone(c)) h+=`<div><button class="linkb" data-act="view" data-view="history">Read the full cycle report</button></div>`;
  h+=`</div>`;
  return h;
}

/* ---------- deload check-in (every 2 cycles) ---------- */
// In weeks 5-6 of cycles 2, 4, 6… ask whether the scheduled-deload setting still fits,
// with a recap of the last two cycles. Answers are kept in plan.deloadChecks.
const DELOAD_OPTS=[[0,'As needed'],[1,'After every cycle'],[2,'After every 2 cycles']];
function deloadLabel(v){const o=DELOAD_OPTS.find(x=>x[0]===v);return o?o[1]:'Every '+v+' cycles'}
function deloadCheckCycle(date){
  if(plan.askDeload===false) return null;
  const wk=weekOf(date); if(!wk||wk.kind!=='cycle'||wk.cycle%2||wk.w<5) return null;
  if((plan.deloadChecks||{})[wk.cycle]) return null;
  return wk.cycle;
}
function deloadCheckCard(c){
  const a=cycleStats(c-1), b=cycleStats(c), cur=+plan.deloadEvery||0;
  let grind=0, missed=0, sessions=0;
  for(const st of [a.stats,b.stats]) for(const S of Object.values(st)){grind+=S.grind;missed+=S.missed;sessions+=S.n}
  const rd=[a.readiness,b.readiness].filter(x=>x!=null), rdAvg=rd.length?Math.round(rd.reduce((x,y)=>x+y,0)/rd.length):null;
  const recap=sessions?`${sessions} lift entries · ${grind} grinder${grind===1?'':'s'} · ${missed} missed session${missed===1?'':'s'}${rdAvg!=null?' · average readiness '+rdAvg:''}`:'Not much logged in these two cycles yet.';
  const hint=rdAvg!=null&&rdAvg<60||grind+missed>=4?'Recovery looks strained. A deload after every cycle may fit better.':rdAvg!=null&&rdAvg>=75&&grind+missed<=1?'Recovery looks solid. As needed or every 2 cycles both fit.':'';
  return `<div class="card"><div class="lift-h"><h3>Deload check-in</h3><span class="chip blue">Cycles ${c-1}–${c}</span></div>
  <p class="small" style="margin:0">You’re set to <b>${deloadLabel(cur)}</b>. ${esc(nextScheduled('deload'))} Keep it, or change it for the next two cycles.</p>
  <div class="small muted">${esc(recap)}${hint?'. '+esc(hint):''}</div>
  <div class="seg"><button class="segb on" data-act="dlcheck" data-v="keep">Keep: ${deloadLabel(cur)}</button>${DELOAD_OPTS.filter(([v])=>v!==cur).map(([v,l])=>`<button class="segb" data-act="dlcheck" data-v="${v}">${l}</button>`).join('')}</div>
  <div class="small muted">Asks again after Cycle ${c+2}. Turn this off in Setup.</div></div>`;
}

/* ---------- rest timer ---------- */
// State lives in localStorage with an absolute end time, so it survives the phone
// locking, the app being backgrounded, or a reload.
let rest=LS.get('ob.rest'), restTick=null, audioCtx=null, wakeLock=null;
// 'held', 'refused', 'unsupported' or 'off'. Refused is the one that matters: iOS can
// decline the screen lock -- Low Power Mode does -- and then the screen sleeps, the page
// stops, and a beep can only sound when you next wake the phone.
let wakeState='off';
function restMins(k){const m=+((plan.rest||{})[k]);return m>=2&&m<=5?m:3}
// Seconds between ramp sets. Long enough that the last ramp single doesn't eat into the
// first working set — a minute was the old floor and it was not enough once the bar is
// heavy. 90 s is the default, and the running timer takes +30 s as many times as you like.
const WARM_RESTS=[60,90,120,150];
function warmRestSecs(k){const v=+((plan.warmRest||{})[k]);return v>=60&&v<=600?v:90}
function warmRestLabel(v){return v<120?v+'s':(v/60)+' min'}
// Spoken cues (Setup / timer card). iOS only speaks after a first utterance inside a
// tap, so unlockAudio primes it with a silent one.
let voicePrimed=false;
function say(text){
  if(quiet()||!plan.voice||!('speechSynthesis' in window)) return;
  // Never over a tone: speech starting mid-note can cut it off on iOS. Wait it out.
  const wait=sfxUntil-Date.now();
  if(wait>0){ setTimeout(()=>say(text),wait); return }
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=1.05; u.pitch=1; speechSynthesis.speak(u) }catch(e){}
}
/* ---------- sharing the phone's speaker ----------
iOS gives a web page one audio session, and the only lever is its category. The spec
splits them in two: `playback`, `play-and-record` and `transient-solo` are *exclusive* —
they take the speaker and stop whatever was playing — while `transient` and `ambient`
*mix* with other audio but are silenced by the ring/silent switch.

A native app gets both at once by asking for the playback category with a mixWithOthers
option. The web API has no equivalent, so this is a real choice and not a missing
feature on our side:

  duck      transient. Your music keeps playing and the beep goes over it. Audible
            whenever the ring switch is on. The default, because a gym timer that
            silences your music every two minutes is worse than one you can't hear
            with the switch off.
  takeover  playback. Heard even on silent, at the price of pausing your music for
            about a second. This is the only mode where the WAV clip is used too:
            a media element is for beating the switch, which is the takeover case.
  silent    no sound at all. Vibration still fires where the platform has it.

1.79 set `playback` for everyone, which is how the music started stopping. */
function soundMode(){
  const m=plan.soundMode;
  if(m==='duck'||m==='takeover'||m==='silent') return m;
  return plan.quietTimer?'silent':'duck';          // pre-1.84 plans
}
function quiet(){return soundMode()==='silent'}
// Changing it takes effect on the next beep, so the channel is re-asked for now rather
// than at the end of a rest when it is too late to find out it was refused.
function setSoundMode(v){
  if(!['duck','takeover','silent'].includes(v)) return false;
  mutatePlan(p=>{p.soundMode=v; delete p.quietTimer});
  if(v!=='silent') unlockAudio();
  return true;
}
// WebKit adds an 'interrupted' state of its own when another app takes the audio, so
// "not running" is the question rather than "suspended" — checking only for suspended
// left the context asleep whenever music had started since the last beep.
function audioAwake(){
  if(!audioCtx) return false;
  if(audioCtx.state==='running') return true;
  try{ audioCtx.resume(); return true }catch(e){ return false }
}
function unlockAudio(){
  if(quiet()) return;
  try{ if(plan.voice&&!voicePrimed&&'speechSynthesis' in window){ const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); voicePrimed=true } }catch(e){}
  try{
    if(navigator.audioSession) navigator.audioSession.type=soundMode()==='takeover'?'playback':'transient';
    if(!audioCtx){ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); ctxWatch(audioCtx); tlog('audio','channel opened') }
    if(audioCtx.state!=='running') audioCtx.resume();
    const b=audioCtx.createBuffer(1,1,22050), s=audioCtx.createBufferSource(); s.buffer=b; s.connect(audioCtx.destination); s.start(0);
  }catch(e){}
}
/* ---------- making a noise that actually arrives ----------
Third report of "the rest beep doesn't work", so this stopped being a one-line fix and
got taken apart. Three separate things can swallow it, and the beep now goes around all
three rather than assuming which one it was:

1. On iPhone the ringer switch silences Web Audio, because a bare AudioContext plays in
   the ambient category. An HTML media element does not get silenced that way, so the
   beep goes out as a media element too. That is the one a gym timer cares about: the
   phone is on silent and nothing is wrong with the app.
2. `resume()` is async. The old code called it and read `currentTime` on the next line,
   off a context that was still suspended, then scheduled three oscillators against that
   stale clock. Now the tones are scheduled after the resume settles.
3. iPhone Safari has no Vibration API at all, so the buzz half can never work there. It
   fires unconditionally anyway, for Android and for Silent mode.

`beepDiag()` reports which of these is in play on the device in hand, because guessing
at this from a laptop is what produced the first two fixes. */
let beepEl=null, beepSrc=null, lastBeep=null;
// A three-note WAV built in memory: no asset to fetch, no decode, and nothing to go
// stale in a cache. 8 kHz 8-bit mono is plenty for a beep and keeps it a few KB.
function beepWav(){
  if(beepSrc) return beepSrc;
  try{
    const sr=8000, segs=[[880,.22],[0,.06],[880,.22],[0,.06],[1320,.26]];
    const n=segs.reduce((a,x)=>a+Math.round(x[1]*sr),0);
    const b=new Uint8Array(44+n), dv=new DataView(b.buffer);
    const str=(o,t)=>{for(let i=0;i<t.length;i++)b[o+i]=t.charCodeAt(i)};
    str(0,'RIFF'); dv.setUint32(4,36+n,true); str(8,'WAVEfmt ');
    dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
    dv.setUint32(24,sr,true); dv.setUint32(28,sr,true); dv.setUint16(32,1,true); dv.setUint16(34,8,true);
    str(36,'data'); dv.setUint32(40,n,true);
    let p=44;
    for(const seg of segs){ const hz=seg[0], len=Math.round(seg[1]*sr);
      for(let i=0;i<len;i++){
        // a short fade each end, or the square edges click
        const env=Math.min(1,Math.min(i,len-i)/(sr*.012));
        b[p++]=hz?128+Math.round(124*env*Math.sin(2*Math.PI*hz*i/sr)):128;
      } }
    let t=''; for(let i=0;i<b.length;i++) t+=String.fromCharCode(b[i]);
    beepSrc='data:audio/wav;base64,'+btoa(t);
  }catch(e){ beepSrc=null }
  return beepSrc;
}
function beepMedia(){
  try{
    if(!beepEl){
      const src=beepWav(); if(!src) return 'no-wav';
      beepEl=document.createElement('audio');
      beepEl.src=src; beepEl.preload='auto';
    }
    beepEl.currentTime=0;
    const p=beepEl.play();
    if(p&&p.then){ p.then(()=>{lastBeep='media'},e=>{lastBeep='media-blocked:'+((e&&e.name)||'?')}) ; return 'pending' }
    return 'played';
  }catch(e){ return 'threw:'+((e&&e.name)||'?') }
}
/* ---------- one way to make a sound ----------
Every timer sound goes through `sfx`: the end of a rest, its warning, every interval
change and its 3-2-1, the guided holds, the generic timer. Until 3.25 there were two
paths. `beep()` had been fixed four times; `tone()`, which the interval timer and the
guided walkthrough used, had none of those fixes -- it never woke an 'interrupted'
context, and it scheduled against the clock of one that was still waking. The Test
button only ever exercised the first, so "confirmed working" was true and said nothing
about the second. One function now, so a fix lands everywhere at once, and a test fails
if a second place ever starts making tones.

Loudness, measured rather than guessed (3.25). Each note used to rise in 20 ms and then
decay exponentially by 74 dB over its length, which is about 12 ms at full volume: a
blip. Held at full volume and released in 40 ms, the same note at the same pitch
carries sixteen times the energy, and below ~200 ms the ear hears energy -- that alone
is +12 dB. The peak goes from 0.5 to 1.0, another +6. And the tones below 1 kHz get
their 2nd and 3rd harmonics, because a phone speaker loses about 12 dB per octave below
its ~1 kHz resonance: a 587 Hz sine was mostly lost in the speaker, while its
harmonics land where the speaker works and the ear still hears the low note. Modelled
against a speaker-plus-ear curve: +15 to +27 dB per sound, every pitch unchanged. */
const SFX={
  done:  [{f:880,d:.20},{f:880,d:.20,at:.28},{f:1320,d:.26,at:.56}],      // rest or timer over
  warn:  [{f:587,d:.20,h:[1,.5,.3]}],                                      // heads-up: one low note
  go:    [{f:1320,d:.45}],                                                 // interval: work starts
  easy:  [{f:660,d:.45,h:[1,.8,.6]}],                                      // interval: easy starts
  tick:  [{f:880,d:.12,peak:.8}],                                          // interval: 3, 2, 1
  ivdone:[{f:880,d:.20},{f:880,d:.20,at:.28},{f:1320,d:.50,at:.56}],      // intervals finished
  hold:  [{f:1320,d:.30}],                                                 // guided: hold done
  side:  [{f:660,d:.30,h:[1,.8,.6]}],                                      // guided: switch sides
  gdone: [{f:880,d:.18},{f:1320,d:.35,at:.22}],                            // guided: block done
};
// How long a sound lasts, so speech can wait for it rather than talk over it.
function sfxLen(name){ return Math.max(0,...(SFX[name]||[]).map(n=>(n.at||0)+n.d)) }
let sfxWaves=new WeakMap(), sfxUntil=0;
// A periodic wave per harmonic recipe, per context. createPeriodicWave normalises to a
// peak of 1 by default, so adding harmonics can never push a note past full scale.
function sfxWave(ctx,h){
  let m=sfxWaves.get(ctx); if(!m){ m={}; sfxWaves.set(ctx,m) }
  const k=h.join(',');
  if(!m[k]){ const re=new Float32Array(h.length+1), im=new Float32Array(h.length+1); h.forEach((a,i)=>{im[i+1]=a}); m[k]=ctx.createPeriodicWave(re,im) }
  return m[k];
}
// One held note: up in 8 ms, held, down in 40. The only createOscillator in the app.
function sfxNote(ctx,t,n){
  const o=ctx.createOscillator(), g=ctx.createGain(), peak=n.peak==null?1:n.peak;
  if(n.h&&n.h.length>1&&ctx.createPeriodicWave) o.setPeriodicWave(sfxWave(ctx,n.h)); else o.type='sine';
  o.frequency.value=n.f;
  const att=.008, rel=Math.min(.04,n.d/3);
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(peak,t+att);
  g.gain.setValueAtTime(peak,t+n.d-rel);
  g.gain.linearRampToValueAtTime(0,t+n.d);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+n.d+.02);
}
function sfx(name){
  const notes=SFX[name]; if(!notes) return 'unknown';
  if(quiet()){ tlog('sound',name+' \u00b7 silent'); return 'silent' }
  if(!audioCtx) unlockAudio();
  if(!audioCtx){ tlog('sound',name+' \u00b7 no-context'); return 'no-context' }
  // Speech that starts while a tone is sounding can cut it off on iOS, so say() holds
  // off until this has passed. Set before the play, because a wake may delay it.
  sfxUntil=Date.now()+sfxLen(name)*1000+120;
  const play=()=>{ try{ const t0=audioCtx.currentTime+.005; for(const n of notes) sfxNote(audioCtx,t0+(n.at||0),n) }catch(e){} };
  const was=audioCtx.state;
  if(was==='running'){ play(); tlog('sound',name+' \u00b7 played'); return 'running' }
  // The line goes in now, pending, and the outcome amends it. Before, a wake that never
  // answered wrote nothing at all, so a beep lost that way and a beep never asked for
  // looked identical in the log -- which is the one distinction a report needs.
  const id=tlog('sound',name+' \u00b7 waking',was,true);
  let settled=false;
  // Not running -- 'suspended' after a lock, 'interrupted' after speech, a call or
  // another app. Wake it and play once it is awake. Reading the clock first was the old
  // bug: a parked context's clock is stale, and notes scheduled on it never sound. If
  // the wake does not take, there is no tap to retry with, so the log says so rather
  // than the beep going missing in silence.
  try{
    const p=audioCtx.resume();
    if(p&&p.then){
      p.then(()=>{
        settled=true;
        if(audioCtx.state==='running'){ sfxUntil=Date.now()+sfxLen(name)*1000+120; play(); tlogAmend(id,name+' \u00b7 played after waking',was) }
        else tlogAmend(id,name+' \u00b7 wake did not take',was+' → '+audioCtx.state);
      },e=>{ settled=true; tlogAmend(id,name+' \u00b7 wake refused',was+' '+((e&&e.name)||'')) });
      // WebKit leaves resume() pending for as long as an interruption lasts, so a promise
      // that has not settled in two seconds is a sound going missing, not one running late.
      setTimeout(()=>{ if(!settled) tlogAmend(id,name+' \u00b7 wake never answered',was+', still waiting after 2 s') },2000);
      return 'resuming';
    }
    play(); tlogAmend(id,name+' \u00b7 played',was); return 'resumed';
  }catch(e){ tlogAmend(id,name+' \u00b7 wake threw',was); return 'resume-threw' }
}
/* Keeping the channel awake between sounds.

   While the page is on screen, a context that leaves 'running' is woken straight away
   -- three tries in ten seconds, then it waits for a tap -- so the next beep finds it
   ready rather than finding out at the end of a rest. And every tap anywhere wakes it,
   because a tap is the one moment iOS is sure to honour a wake: in a session, that is
   every Done. */
let ctxWakes=[];
function ctxWatch(ctx){
  ctx.onstatechange=()=>{
    tlog('audio',ctx.state);
    if(ctx.state==='running'||ctx.state==='closed'||quiet()) return;
    if(typeof document!=='undefined'&&document.visibilityState&&document.visibilityState!=='visible') return;
    const now=Date.now(); ctxWakes=ctxWakes.filter(t=>now-t<10000);
    if(ctxWakes.length>=3){ tlog('audio','waiting for a tap'); return }
    ctxWakes.push(now);
    try{ const p=ctx.resume(); if(p&&p.catch) p.catch(e=>tlog('audio','wake refused',(e&&e.name)||'')) }catch(e){}
  };
}
function gestureWake(){
  if(quiet()) return;
  if(audioCtx&&audioCtx.state==='running') return;
  unlockAudio(); tlog('audio','woken by a tap');
}
if(typeof document!=='undefined'&&document.addEventListener)
  ['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev,gestureWake,{capture:true,passive:true}));

/* ---------- the timer log ----------
The last eighty things the timers did, kept on the device: each sound and what the audio
channel was doing when it was asked for, how late each rest's end was noticed, the screen
lock, the page going to the background and back. "Inconsistent" has now been reported
five times and fixed four; the next report should come with what happened, not a
description of it. Copy it from Setup, Sound. */
/* The cap was 80, which one HIC session overruns before it is finished: every segment
   writes its 3-2-1 and its change cue, so a four-round MAP with a warm-up fills the log
   on its own and the earliest line still held is already past the warm-up. Beeps that
   stop in round two were being pushed out by the ticks of the rounds after them, and the
   log then read as working because the part where it broke had scrolled off. Hence both
   changes: a cap that holds a long session, and repeats folded into one line with a
   count, since three identical ticks a segment are what filled it. Folded, a ten-round
   session writes about 50 lines, so 200 holds a whole one with room for the audio and
   page events around it -- and the file is written on every line, so a bigger cap is
   paid for once a second in a session rather than saved up for later. */
const TLOG_MAX=200;
let tlogId=0;
function tlogSame(a,b){ return a&&a.ev===b.ev&&a.what===b.what&&a.d===b.d&&a.ctx===b.ctx&&a.vis===b.vis&&a.wl===b.wl }
/** Append a line. `pend` marks it as awaiting an outcome; returns an id for `tlogAmend`. */
function tlog(ev,what,detail,pend){
  try{
    const a=LS.get('ob.tlog')||[];
    const e={id:++tlogId,t:Date.now(),ev,what:String(what),d:detail==null?'':String(detail),ctx:audioCtx?audioCtx.state:'none',
      vis:typeof document!=='undefined'?(document.visibilityState||''):'',wl:wakeState};
    if(pend) e.p=1;
    const last=a[a.length-1];
    // Never fold into a line still waiting for its outcome: it has an id to amend.
    if(!pend&&last&&!last.p&&tlogSame(last,e)){ last.n=(last.n||1)+1; last.t=e.t }
    else a.push(e);
    while(a.length>TLOG_MAX) a.shift();
    // The log must never be the reason something else cannot be written. 3.37 took the
    // cap from 80 to 200, and localStorage fails by returning false rather than by
    // throwing, so a full store would have eaten the rest timer's own state in silence.
    if(!LS.set('ob.tlog',a)){
      try{ LS.set('ob.tlog',a.slice(-20)) }catch(e2){ try{ localStorage.removeItem('ob.tlog') }catch(e3){} }
    }
    return e.id;
  }catch(e){ return 0 }
}
/* Whether this phone can still write anything at all. A full store is invisible --
   `setItem` throws, `LS.set` turns that into `false`, and every caller ignores it --
   and it would stop alerts dead by losing the subscription. */
function storageNote(){
  try{
    let n=0; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); n+=(k||'').length+((localStorage.getItem(k)||'').length) }
    const probe='ob.probe', ok=LS.set(probe,'x'); try{ localStorage.removeItem(probe) }catch(e){}
    return Math.round(n/1024)+' KB stored, writes '+(ok?'working':'FAILING');
  }catch(e){ return 'unreadable ('+((e&&e.name)||'?')+')' }
}
/** Replace a pending line's outcome, leaving it where it happened in the sequence. */
function tlogAmend(id,what,detail){
  if(!id) return;
  try{
    const a=LS.get('ob.tlog')||[];
    for(let i=a.length-1;i>=0;i--) if(a[i].id===id){
      a[i].what=String(what); if(detail!=null) a[i].d=String(detail);
      a[i].ctx=audioCtx?audioCtx.state:'none'; delete a[i].p;
      LS.set('ob.tlog',a); return;
    }
  }catch(e){}
}
function tlogText(){
  const a=LS.get('ob.tlog')||[];
  if(!a.length) return 'Nothing logged yet. Run a rest or an interval session and this fills in.';
  const hh=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())};
  return a.map(e=>`${hh(e.t)}  ${e.ev} · ${e.what}${e.n>1?' ×'+e.n:''}${e.d?' ('+e.d+')':''}  [audio ${e.ctx}, page ${e.vis||'?'}, screen ${e.wl}]`).join('\n');
}
function tlogReport(){
  return 'Operator + Black '+(typeof APP_VERSION==='string'?APP_VERSION:'')+' · timer log\n'+
    (typeof navigator!=='undefined'?String(navigator.userAgent).slice(0,160):'')+'\n\n'+tlogText();
}

function beepTones(){ return sfx('done') }
// How long before the end to give a warning, in seconds. 0 is off.
const REST_WARNS=[0,5,10,15,30];
function restWarnSecs(){ const v=+plan.restWarn; return REST_WARNS.includes(v)?v:10 }
/* Is this the tick that warns? Its own function because the tick runs four times a
   second and the two guards are the whole behaviour: once only, and never on a rest
   so short the warning would land on top of its own start. */
function restWarnDue(r,left){
  const warn=restWarnSecs();
  return !!(warn&&r&&left===warn&&r.dur>=warn*2&&!r.warned);
}
/* The heads-up, deliberately not the same sound as the end of the rest.

   One short low tone against the finish's three rising ones, and a single short buzz
   against its long-short-long. If the warning and the finish sounded alike you would
   have to look at the phone to tell which had happened, which is the thing a beep is
   there to save you. No media clip either: that exists to beat the ring switch at the
   cost of pausing music, and paying that twice per rest is not worth a warning. */
function beepWarn(){
  let vib=false;
  try{ vib=!!(navigator.vibrate&&navigator.vibrate(120)) }catch(e){}
  if(quiet()) return {vib,tones:'silent'};
  return {vib,tones:warnTone()};
}
function warnTone(){ return sfx('warn') }
function beep(){
  // Buzz first and unconditionally. Silent mode exists so iOS does not take the audio
  // session off your music; vibration never touches audio, so suppressing it as well
  // left Silent with no way at all to tell you a rest had ended. (Moot on iPhone, which
  // has no Vibration API, but right on Android and right in principle.)
  let vib=false;
  try{ vib=!!(navigator.vibrate&&navigator.vibrate([200,100,200])) }catch(e){}
  if(quiet()){ lastBeep='silent'; return {vib,media:'silent',tones:'silent'} }
  // The clip exists to beat the ring switch, and beating it means taking the speaker.
  // In duck mode that would stop the music, which is the thing duck mode is for.
  const media=soundMode()==='takeover'?beepMedia():'skipped-duck', tones=beepTones();
  lastBeep=lastBeep==='media'?lastBeep:(media+'/'+tones);
  return {vib,media,tones};
}
// What the Sound card shows after a test, so a report comes with facts attached.
let beepSeen=null;
// What the device can do, read without touching anything. Separate from beepDiag
// because that one makes a noise, and an inspector with a side effect is a trap.
function audioState(){
  return {
    mode:soundMode(),
    silent:quiet(),
    canVibrate:typeof navigator!=='undefined'&&!!navigator.vibrate,
    ctx:audioCtx?audioCtx.state:'none',
    session:(typeof navigator!=='undefined'&&navigator.audioSession)?String(navigator.audioSession.type):'unsupported',
    ua:typeof navigator!=='undefined'?String(navigator.userAgent).slice(0,160):'',
  };
}
// What to tell me when it still doesn't work: facts off the device, not a diagnosis.
// This beeps, on purpose — the point is to hear it and report what happened.
function beepDiag(){
  const r=beep();
  return Object.assign(audioState(),{vibrated:r.vib,media:r.media,tones:r.tones});
}
// Plain English for each thing that can swallow a beep, so the card says what to try
// rather than printing a status code at someone standing in a gym.
function beepAdvice(d){
  const out=[];
  if(d.silent) out.push('Sound is set to off below, on purpose. The buzz and the notification still fire.');
  if(d.mode==='duck'&&/iPhone|iPad/i.test(d.ua)) out.push('Sound is set to share the speaker with your music, which is what you want \u2014 but iOS silences shared audio when the ring switch on the side of the phone is off. Check that switch first. If you need to be heard with it off, the price is your music pausing: choose \u201calways be audible\u201d below.');
  if(/iPhone|iPad/i.test(d.ua)){
    if(!d.canVibrate) out.push('This is an iPhone or iPad, and Safari gives a web app no way to vibrate at all. There will never be a buzz here \u2014 sound, screen and notifications are what you get.');
    out.push('If you heard nothing: check the ring switch on the side of the phone, and that the volume is up.');
  } else if(!d.canVibrate) out.push('This browser has no Vibration API, so there will be no buzz.');
  if(d.ctx==='none') out.push('No audio channel was opened. That usually means nothing has been tapped yet on this page \u2014 tap the button again.');
  if(d.ctx==='suspended') out.push('The audio channel is suspended, which is what happens after the phone locks. Tap the button again with the app on screen.');
  if(String(d.media).indexOf('blocked')===0||String(d.media).indexOf('media-blocked')===0) out.push('The media clip was blocked by the browser. Tap the button again \u2014 the first play has to come from a tap.');
  if(!out.length) out.push('Everything the app can check came back fine. If you still heard nothing, it is the device volume or a Focus mode rather than the app.');
  return out;
}
function beepTest(){ beepSeen=beepDiag(); render(); }
// Paste-able, same shape as the crash report, so a "still broken" comes with the facts.
function beepReport(){
  const d=beepSeen; if(!d) return 'No beep test run yet.';
  const head='Operator + Black '+(typeof APP_VERSION==='string'?APP_VERSION:'')+' \u00b7 beep test';
  const rows=[['mode',d.mode],['silent',d.silent],['can vibrate',d.canVibrate],['vibrated',d.vibrated],
    ['media clip',d.media],['web audio',d.tones],['audio channel',d.ctx],['audio session',d.session]];
  return head+'\n'+rows.map(r=>r[0]+': '+r[1]).join('\n')+'\n'+d.ua+'\n\n'+beepAdvice(d).join('\n');
}
/* iOS drops the lock whenever the page is hidden, and a dropped lock still reads as an
   object, so re-check `released` rather than trusting we still hold it.

   It also lets go mid-session for reasons of its own, and until 3.38 nothing took it
   back: the request happened when a session started, the release handler only wrote the
   state down, and the next attempt was whenever the page was next hidden and shown. One
   release and the screen slept for the rest of the session -- which freezes the page, so
   every beep due while it slept never happened, and the one you hear on unlocking is the
   timer catching up. That is the reported "first couple of rounds beep and then it
   stops", from the other end.

   So: take it back when it goes, and let the running timers ask on every tick. Asking is
   free while it is held (the `released` check returns), and `SCREEN_RETRY` keeps a
   refusal -- Low Power Mode refuses -- from turning a 5 Hz tick into 5 requests a
   second. */
const SCREEN_RETRY=4000;
let screenAsked=0, screenBusy=false;
async function holdScreen(on){
  if(on){
    if(wakeLock&&!wakeLock.released) return;
    const now=Date.now();
    if(screenBusy||now-screenAsked<SCREEN_RETRY) return;
    screenAsked=now; screenBusy=true;
  }
  try{
    if(on){
      if(!navigator.wakeLock){ if(wakeState!=='unsupported'){ wakeState='unsupported'; tlog('screen','no screen lock on this device') } return }
      wakeLock=await navigator.wakeLock.request('screen');
      wakeState='held'; tlog('screen','held');
      wakeLock.addEventListener('release',()=>{
        wakeLock=null;
        if(wakeState==='held'){ wakeState='off'; tlog('screen','released') }
        showWake();
        // Hidden means the phone is already locked or the app is away, and iOS refuses a
        // request from a hidden page anyway. The visibilitychange handler does that one.
        if(wantScreen()&&typeof document!=='undefined'&&document.visibilityState==='visible'){
          screenAsked=0; tlog('screen','taking it back'); syncScreen();
        }
      });
    } else if(wakeLock){ const w=wakeLock; wakeLock=null; wakeState='off'; await w.release() }
  }catch(e){ wakeLock=null; wakeState='refused'; tlog('screen','refused',(e&&e.name)||'') }
  finally{ screenBusy=false }
  showWake();
}
/* Said where you are looking, rather than discovered at the end of a rest. This only
   went on the rest bar, so an interval session -- the one you set down and walk away
   from, and the one Low Power Mode is most likely to be on for -- said nothing at all
   while the screen was about to sleep under it. */
function showWake(){
  if(typeof document==='undefined') return;
  const warn=wakeState==='refused'&&wantScreen();
  const set=(id,on)=>{ const el=document.getElementById(id); if(el) el.hidden=!on };
  set('rest-wake',warn&&!!rest);
  set('iv-wake',warn&&!!iv&&!iv.done);
}
// The screen stays on for as long as anything is actually going on, not just while a
// rest happens to be counting: a session is open, or any timer is running.
function wantScreen(){
  if(ls||guide) return true;                      // session mode, or the guided runner
  if(rest&&!rest.done) return true;
  if(iv&&!iv.done) return true;
  if(gt&&!gt.paused&&!gt.done) return true;
  return false;
}
function syncScreen(){ holdScreen(wantScreen()) }
// Coming back to the app: take the lock again if we still need it, and wake the audio
// context, which iOS suspends while the page is hidden and a silent beep never recovers.
document.addEventListener('visibilitychange',()=>{
  tlog('page',document.visibilityState);
  if(document.visibilityState!=='visible') return;
  syncScreen();
  try{ audioAwake() }catch(e){}
});

/* ---------- a timer for anything ---------- */
// Deliberately not tied to a session: open it from the header on any tab, any day, with
// nothing started. Countdown or stopwatch. Like the other timers it runs off absolute
// times, so locking the phone or reloading the app doesn't make it drift, and it sits
// above the rest bar rather than replacing it, so a rest keeps counting underneath.
const GT_PRESETS = [30, 60, 120, 180, 300, 600];
const GT_STALE_MS = 12 * 3600 * 1000;
let gt = LS.get('ob.gt'), gtTick = null, gtPushT = null;

function gtSave(){ LS.set('ob.gt', gt) }
function gtFmt(s){
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return (h ? h + ':' + pad(m) : String(m)) + ':' + pad(s % 60);
}
/** Seconds left on a countdown, or elapsed on a stopwatch. */
function gtSecs(){
  if(!gt) return 0;
  const now = gt.paused || Date.now();
  return gt.mode === 'up' ? Math.max(0, Math.floor((now - gt.start - gt.pausedMs) / 1000))
                          : Math.max(0, Math.ceil((gt.end - now) / 1000));
}
function gtStart(mode, secs){
  unlockAudio();
  const now = Date.now();
  gt = mode === 'up' ? { mode:'up', start:now, pausedMs:0, paused:null }
                     : { mode:'down', dur:secs, end:now + secs * 1000, pausedMs:0, paused:null, done:false };
  gtSave(); syncScreen(); gtShow(); gtPush();
}
function gtPause(){
  if(!gt) return;
  if(gt.paused){ const d = Date.now() - gt.paused; gt.pausedMs += d; if(gt.mode === 'down') gt.end += d; gt.paused = null }
  else gt.paused = Date.now();
  gtSave(); syncScreen(); gtRender(); gtPanelDraw(); gtPush();
}
function gtAdd(s){
  if(!gt || gt.mode !== 'down') return;
  const base = gt.paused || Date.now();
  gt.end = Math.max(base + 1000, gt.end + s * 1000);
  gt.dur = Math.max(gt.dur, Math.round((gt.end - base) / 1000));
  if(gt.end > base) gt.done = false;
  gtSave(); gtRender(); gtPanelDraw(); gtPush();
}
function gtStop(){
  gt = null; gtSave();
  clearInterval(gtTick); gtTick = null;
  syncScreen();
  gtShow(); gtPanelDraw(); gtPush();
}
function gtShow(){
  const el = document.getElementById('gt'); if(!el) return;
  const btn = document.getElementById('tmr-b');
  if(!gt){ el.hidden = true; document.body.classList.remove('gt-on'); if(btn) btn.classList.remove('on'); clearInterval(gtTick); gtTick = null; return }
  el.hidden = false; document.body.classList.add('gt-on');
  const b = document.getElementById('tmr-b'); if(b) b.classList.add('on');
  if(!gtTick) gtTick = setInterval(gtRender, 250);
  gtRender();
}
function gtRender(){
  if(!gt) return;
  const el = document.getElementById('gt'); if(!el) return;
  const s = gtSecs(), down = gt.mode === 'down', over = down && s === 0;
  document.getElementById('gt-t').textContent = gtFmt(s);
  document.getElementById('gt-l').textContent = gt.paused ? 'Paused' : over ? 'Time’s up' : down ? 'Timer' : 'Stopwatch';
  document.getElementById('gt-p').textContent = gt.paused ? 'Resume' : 'Pause';
  el.classList.toggle('done', over);
  if(over && !gt.done){
    gt.done = true; gtSave(); beep(); syncScreen();
    setTimeout(() => say('Timer done'), 700);
  }
  if(over && Date.now() - gt.end > 5 * 60000) gtStop();   // nobody dismissed it
}
// Only touch the alert queue when nothing in a session owns it.
function gtPush(){
  if(!alertsOn()) return;
  if((rest && !rest.done) || (iv && !iv.done)) return;
  clearTimeout(gtPushT);
  gtPushT = setTimeout(() => {
    if(gt && gt.mode === 'down' && !gt.paused && !gt.done) pushCall('/push/schedule', { at: gt.end, title: 'Timer done', body: 'The timer you set has finished.' }, 'timer alert');
    else pushCall('/push/cancel', null, 'cancel');
  }, 300);
}

/* the header panel */
function gtPanel(){
  if(gt){
    const down = gt.mode === 'down';
    return `<div class="gt-m-h">${down ? 'Countdown' : 'Stopwatch'}${gt.paused ? ' · paused' : ''}</div>
    <div class="row"><button class="btn" data-act="gtpause">${gt.paused ? 'Resume' : 'Pause'}</button>${down ? `<button class="btn" data-act="gtadd" data-v="-30">−30s</button><button class="btn" data-act="gtadd" data-v="30">+30s</button>` : ''}</div>
    <div class="row"><button class="btn ghost" data-act="gtstop">Stop and clear</button></div>`;
  }
  return `<div class="gt-m-h">Time anything</div>
  <div class="seg">${GT_PRESETS.map(v => `<button class="segb" data-act="gtdown" data-v="${v}">${gtFmt(v)}</button>`).join('')}</div>
  <div class="row" style="align-items:flex-end"><label class="f" style="flex:1">Minutes<input type="number" inputmode="decimal" step="any" min="0" id="gt-c" placeholder="e.g. 4.5"></label><button class="btn" data-act="gtcustom">Start</button></div>
  <div class="row"><button class="btn" data-act="gtup">Start a stopwatch</button></div>
  <div class="small muted">Runs on its own, so a rest or an interval keeps counting underneath.</div>`;
}
function gtPanelDraw(){
  const m = document.getElementById('tmr-m');
  if(m && !m.hidden) m.innerHTML = gtPanel();
}

/* wiring: the header button, the panel, and the bar's own buttons */
function gtAct(a, b){
  if(a === 'gtdown'){ gtStart('down', +b.dataset.v); gtPanelDraw(); return true }
  if(a === 'gtup'){ gtStart('up'); gtPanelDraw(); return true }
  if(a === 'gtcustom'){
    const el = document.getElementById('gt-c'), m = parseFloat(el && el.value);
    if(!(m > 0)){ if(el) el.focus(); return true }
    gtStart('down', Math.max(1, Math.round(m * 60))); gtPanelDraw(); return true;
  }
  if(a === 'gtpause'){ gtPause(); return true }
  if(a === 'gtadd'){ gtAdd(+b.dataset.v); return true }
  if(a === 'gtstop'){ gtStop(); return true }
  return false;
}
(function(){
  const btn = document.getElementById('tmr-b'), menu = document.getElementById('tmr-m');
  if(!btn || !menu) return;
  const open = (on) => { menu.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false'); if(on) menu.innerHTML = gtPanel() };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(menu.hidden) });
  for(const el of [menu, document.getElementById('gt')]){
    if(el) el.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if(b) gtAct(b.dataset.act, b) });
  }
  document.addEventListener('click', (e) => { if(!menu.hidden && !e.target.closest('#tmr-m,#tmr-b')) open(false) });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && !menu.hidden){ open(false); btn.focus() } });
})();

/* ---------- welcome setup ---------- */
// Guided first run for a new person (no saved plan, no logs), or re-run from Setup.
let wz=null;
function st0Saved(){return !!plan.onboarded}
function nextMonday(){const t=realToday();return dow(t)===0?t:addDays(mondayOf(t),7)}
function wzNew(rerun){
  return {rerun:!!rerun,step:0,unit:plan.unit||'lb',bw:plan.bodyweight||'',l3:Object.assign({pull:true,ohp:false,wpu:false},rerun?(plan.l3||{}).on:{}),
    start:rerun?plan.startMonday:nextMonday(),mode:rerun&&!plan.bridge?'maxes':'bridge',rm:'1rm',maxes:rerun?clone(plan.maxes):{},cardio:defMod(),deload:rerun?(+plan.deloadEvery||0):0,test:rerun?(+plan.testEvery||0):3,
    stempl:rerun?stemplKey():'operator',cproto:rerun?cprotoKey():'black',bb:false,
    plyo:rerun?plan.plyoOn!==false:true,plyoDow:rerun?plyoDowDefault():3,
    plyoPer:rerun?plyoPerWeek():1,plyoDow2:rerun?plyoDow2():6};
}
const WZ_STEPS=['You','Program','Lift 3','Start','Conditioning','Plyos','Deloads','Ready'];
function vWelcome(){
  const w=wz, steps=WZ_STEPS.map((t,i)=>`<span class="chip${i===w.step?' blue':i<w.step?' light':''}">${i+1}. ${t}</span>`).join('');
  let h=`<div class="card"><div class="lift-h"><h2>${w.rerun?'Welcome setup':'Welcome to Operator + Black'}</h2>${w.rerun?'':'<button class="btn sm ghost" data-act="wzskip">Skip</button>'}</div><div class="row" style="gap:6px">${steps}</div>`;
  const on=L3K.filter(k=>w.l3[k]);
  if(w.step===0){
    h+=`<p style="margin:0">A training log for Tactical Barbell’s <b>Operator</b> (squat, bench and a third lift, three days a week, never near failure) and the <b>Black</b> conditioning protocol (three hard cardio sessions a week), plus plyometrics on Thursdays. It works out your weights, rest and intervals.</p>
    <div class="grid2"><label class="f">Units<div class="seg">${['lb','kg'].map(x=>`<button class="segb${w.unit===x?' on':''}" data-act="wzset" data-k="unit" data-v="${x}">${x}</button>`).join('')}</div></label><label class="f">Bodyweight (${w.unit}, optional)<input type="number" inputmode="decimal" step="any" id="wz-bw" data-wz="bw" value="${w.bw??''}"></label></div>
    <div class="small muted">Bodyweight is used for protein targets and weighted pull-ups.</div>`;
  } else if(w.step===1){
    h+=`<p style="margin:0">Two choices, and the week is built from them. Everything here is from the books \u2014 the app only arranges it.</p>
    <label class="f">Strength template<div class="stack">${Object.entries(STEMPL).map(([k,T])=>`<button class="btn${w.stempl===k?' primary':''}" style="justify-content:flex-start;text-align:left;height:auto;padding:10px 12px" data-act="wzset" data-k="stempl" data-v="${k}"><span><b>${w.stempl===k?'\u2713 ':''}${esc(T.name)}</b> <span class="small">\u00b7 ${tplDays(T,{w:1}).length} days \u00b7 ${esc(T.book)}</span><br><span class="small">${esc(T.blurb)}</span></span></button>`).join('')}</div></label>
    <label class="f">Conditioning protocol<div class="stack">${Object.entries(CPROTO).map(([k,P])=>`<button class="btn${w.cproto===k?' primary':''}" style="justify-content:flex-start;text-align:left;height:auto;padding:10px 12px" data-act="wzset" data-k="cproto" data-v="${k}"><span><b>${w.cproto===k?'\u2713 ':''}${esc(P.name)}</b> <span class="small">\u00b7 ${esc(P.book)}</span><br><span class="small">${esc(P.blurb)}</span></span></button>`).join('')}</div></label>
    <label class="check"><input type="checkbox" id="wz-bb" data-act-change="wzbb" ${w.bb?'checked':''}> Start with <b>Base Building</b> first</label>
    <div class="note">Tactical Barbell II\u2019s Block I: eight weeks of aerobic base and strength-endurance before you go near a heavy barbell cycle. The book\u2019s advice is to do it first if you have not built that base, and once or twice a year after.</div>
    ${wzWarnings(w)}`;
  } else if(w.step===2){
    h+=`<p style="margin:0">Monday and Wednesday include a third lift. Pick the ones you’ll use; with more than one, you can swap on any day.</p>
    <div class="stack">${L3K.map(k=>`<button class="btn${w.l3[k]?' primary':''}" style="justify-content:flex-start" data-act="wzl3" data-v="${k}">${w.l3[k]?'✓ ':''}${esc(liftName(k))}${k==='wpu'?' <span class="small">(once you can do a strict pull-up)</span>':''}</button>`).join('')}</div>`;
  } else if(w.step===3){
    const lifts=['squat','bench',...on,'dead'];
    h+=`<label class="f" style="max-width:260px">Start the week of<input type="date" id="wz-start" data-wz="start" value="${w.start}"></label>
    <div class="stack">
      <button class="btn${w.mode==='bridge'?' primary':''}" style="justify-content:flex-start;text-align:left" data-act="wzset" data-k="mode" data-v="bridge">${w.mode==='bridge'?'✓ ':''}Start with a bridge week: test your 5-rep maxes over one easy week (recommended)</button>
      <button class="btn${w.mode==='maxes'?' primary':''}" style="justify-content:flex-start;text-align:left" data-act="wzset" data-k="mode" data-v="maxes">${w.mode==='maxes'?'✓ ':''}I know my maxes: start Cycle 1 straight away</button>
    </div>`;
    if(w.mode==='maxes') h+=`<div class="seg">${[['1rm','1-rep maxes'],['5rm','5-rep maxes']].map(([v,l])=>`<button class="segb${w.rm===v?' on':''}" data-act="wzset" data-k="rm" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="grid4">${lifts.map(k=>`<label class="f">${esc(liftName(k))}${isBW(k)?' (added)':''}<input type="number" inputmode="decimal" step="any" id="wz-m-${k}" data-wz="maxes.${k}" value="${w.maxes[k]??''}"></label>`).join('')}</div>
      ${w.rm==='5rm'?'<div class="small muted">5-rep maxes are converted to 1-rep maxes (÷ 0.87).</div>':''}`;
    else h+=`<div class="note">The bridge week tests two lifts per test day, then converts your 5-rep maxes into Cycle 1’s numbers on Sunday.</div>`;
    if(w.rerun) h+=`<div class="banner warn"><div class="small">Changing the start week or bridge choice re-plans your whole calendar, locked weeks included.</div></div>`;
  } else if(w.step===4){
    h+=`<label class="f">Main conditioning tool<div class="seg">${Object.entries(MOD).filter(([k])=>k!=='other').map(([k,x])=>`<button class="segb${w.cardio===k?' on':''}" data-act="wzset" data-k="cardio" data-v="${k}">${x.name}</button>`).join('')}</div></label>
    <div class="note">Three hard sessions a week, all on this by default. You can switch activity on any single day — sprints, rower, ruck, hike, swim and more — and the app compares results only against the same activity.</div>`;

  } else if(w.step===5){
    h+=`<p style="margin:0">Jumps and bounds, 15 to 20 minutes of real work, in three-week phases. A nervous-system stimulus rather than a workout — quality of each rep matters far more than how many.</p>
    <label class="check"><input type="checkbox" id="wz-plyo" data-act-change="wzplyo" ${w.plyo?'checked':''}> Schedule plyometrics</label>
    <div class="small muted">Leave it off if you would rather not; you can turn it on later in Setup.</div>
    ${w.plyo?`<label class="f">Sessions a week<div class="seg">${[[1,'One'],[2,'Two, shorter']].map(([v,l])=>`<button class="segb${w.plyoPer===v?' on':''}" data-act="wzset" data-k="plyoPer" data-v="${v}">${l}</button>`).join('')}</div></label>
      <div class="small muted">${w.plyoPer===2?'The week\u2019s contacts split across the two rather than doubling, so it is the same work with fresher reps in it. Two a week is the usual recommendation, with 48 to 72 hours between.':'One session with the whole phase target in it.'}</div>
      <label class="f">${w.plyoPer===2?'Which two days':'Which day'}${plyoDayRow(w.plyoPer===2?[w.plyoDow,w.plyoDow2]:[w.plyoDow],w.plyoPer,'wzplyoday')}</label>
      ${w.plyoPer===2?'<div class="note">Both are lit, numbered in the order the week runs them. Tapping a third replaces whichever you picked longer ago.</div>':''}
      <div class="note">They go first on whatever day you pick, and you can move one a week at a time from the Move… button on any day.</div>
      ${wzPlyoWarn(w)}`:''}`;
  } else if(w.step===6){
    h+=`<p style="margin:0">How the block itself runs. Both of these apply to the whole program, not just one part of it.</p>
    <label class="f">Scheduled deload week<div class="seg">${DELOAD_OPTS.map(([v,l])=>`<button class="segb${w.deload===v?' on':''}" data-act="wzset" data-k="deload" data-v="${v}">${l}</button>`).join('')}</div></label>
    <div class="note">A deload week drops to ${plan.deload.s}×${plan.deload.r} @ ${plan.deload.p}%, swaps conditioning to easy steady work, halves plyos and skips accessories. <b>As needed</b> schedules none: the app still offers one when your check-ins show low readiness or repeated hard sessions, and you can add one from the Plan tab any time. Tactical Barbell doesn’t mandate a fixed deload, so this is your call.</div>
    <label class="f">Retest week<div class="seg">${[[0,'Never'],[2,'Every 2 cycles'],[3,'Every 3 cycles'],[4,'Every 4 cycles']].map(([v,l])=>`<button class="segb${w.test===v?' on':''}" data-act="wzset" data-k="test" data-v="${v}">${l}</button>`).join('')}</div></label>
    <div class="note">A retest week takes three easy days, then heavy singles across two days, and feeds the results into the next cycle. Every 3 cycles matches the 18-week block.</div>
    <div class="small muted">The app checks in every second cycle to ask whether the deload setting still fits.</div>`;
  } else {
    const lifts=['squat','bench',...on,'dead'];
    h+=`<dl class="kv"><dt>Units</dt><dd>${w.unit}${w.bw?' · bodyweight '+esc(w.bw):''}</dd><dt>Lift 3</dt><dd>${on.map(k=>liftName(k)).map(esc).join(', ')}</dd><dt>Starts</dt><dd>${fmtLong(mondayOf(w.start))} · ${w.mode==='bridge'?'bridge week':'Cycle 1'}</dd>${w.mode==='maxes'?`<dt>Maxes</dt><dd>${lifts.map(k=>esc(liftName(k))+' '+(w.maxes[k]!=null&&w.maxes[k]!==''?(w.rm==='5rm'?n(floorTo(+w.maxes[k]/.87,5)):n(+w.maxes[k])):'—')).join(' · ')}</dd>`:''}<dt>Program</dt><dd>${esc(STEMPL[w.stempl].name)} + ${esc(CPROTO[w.cproto].name)}${w.bb?' \u00b7 after Base Building':''}</dd><dt>Conditioning</dt><dd>${MOD[w.cardio].name}</dd><dt>Plyos</dt><dd>${w.plyo?(w.plyoPer===2?esc(DAYN[w.plyoDow])+' and '+esc(DAYN[w.plyoDow2]):esc(DAYN[w.plyoDow])):'none'}</dd><dt>Deloads</dt><dd>${deloadLabel(w.deload).toLowerCase()}${w.test?' · retest every '+w.test+' cycles':' · no retest weeks'}</dd></dl>
    ${wzWarnings(w)}
    <div class="note">Everything can be changed later in Setup. Tip: turn on <b>Rest alerts</b> in Setup to get notified when a rest ends.</div>`;
  }
  h+=`<div class="row">${w.step>0?'<button class="btn" data-act="wzback">‹ Back</button>':''}${w.step<7?'<button class="btn primary" data-act="wznext">Next ›</button>':`<button class="btn primary" data-act="wzdone">${w.rerun?'Save':'Start my program'}</button>`}${w.rerun?'<button class="btn ghost" data-act="wzcancel">Cancel</button>':''}</div></div>`;
  return h;
}
// What the books say about the pairing you have picked. Shown while choosing and again
// on the summary, because the summary is the last chance to notice.
/* Setting one wizard field from a tapped button.

   A dataset value is always a string, and several of these fields are compared against
   numbers to decide what looks selected. Which keys were numeric used to be a hardcoded
   pair, so every numeric field added afterwards was stored as a string and never looked
   chosen — which is what happened to the plyo day. The field's own starting type is the
   answer, and it cannot be forgotten. */
function wzSet(k,v){
  if(!wz) return false;
  wz[k]=typeof wz[k]==='number'?+v:v;
  return true;
}
function wzPlyoWarn(w){
  const ws=plyoWarnings(w.stempl,w.cproto,w.plyoDow,w.cardio,w.plyoPer===2?w.plyoDow2:null);
  if(!ws.length) return '';
  return `<div class="banner warn"><div class="small">${ws.map(x=>`<div style="margin-top:4px">${esc(x.text)}</div>`).join('')}</div></div>`;
}
function wzWarnings(w){
  const ws=programWarnings(w.stempl,w.cproto,w.bb);
  if(!ws.length) return '';
  return `<div class="banner info"><div class="small"><b>Worth knowing:</b>${ws.map(x=>`<div style="margin-top:4px">${esc(x.text)}</div>`).join('')}</div></div>`;
}
function wzFinish(){
  const w=wz, on=L3K.filter(k=>w.l3[k]); if(!on.length) on.push('pull');
  mutatePlan(p=>{
    const start=mondayOf(w.start), restart=start!==p.startMonday||(w.mode==='bridge')!==!!p.bridge;
    p.unit=w.unit; p.bar=w.unit==='kg'?20:45; if(w.bw!==''&&w.bw!=null) p.bodyweight=+w.bw;
    p.l3=Object.assign({},p.l3||{},{on:Object.fromEntries(L3K.map(k=>[k,on.includes(k)])),primary:on[0]});
    p.cardio=Object.assign({},p.cardio||{},{def:w.cardio}); p.deloadEvery=w.deload; p.testEvery=w.test;
    p.startMonday=start; p.bridge=w.mode==='bridge';
    p.stempl=w.stempl; p.cproto=w.cproto;
    p.plyoOn=!!w.plyo;
    if(w.plyo){ p.plyoDow=+w.plyoDow; p.plyoPerWeek=+w.plyoPer===2?2:1; p.plyoDow2=+w.plyoDow2 }
    // Base Building goes after the bridge week when there is one: the bridge is what
    // gives Base Building's two strength days their numbers.
    if(w.bb){ const at=w.mode==='bridge'?addDays(start,7):start;
      p.inserts=Object.assign({},p.inserts,{[at]:'bb'}); }
    if(restart){p.frozen={};p.lockedMax={}}
    if(w.mode==='maxes'){const m={};for(const k of LK){const v=w.maxes[k];if(v!=null&&v!=='')m[k]=w.rm==='5rm'?floorTo(+v/.87,+(p.round||{})[k]||5):+v}p.maxes=Object.assign({},clone(DEF.maxes),p.maxes||{},m)}
    p.onboarded=true;
  });
  wz=null; sel=realToday(); view='today'; render(); window.scrollTo(0,0);
}

/* ---------- guided warm-up / mobility ---------- */
// A hands-free run through a checklist: timed items count down and advance themselves,
// per-side items run both sides, rep items wait for a tap. Timed from absolute end times
// so locking the phone or reloading doesn't lose the place.
let guide=LS.get('ob.guide'), gdTick=null;
function gdItems(kind,date){
  if(kind==='warmup'){
    // warmItems(), not WARMUP: the routine is a choice now, and the walkthrough has to
    // walk the one that is selected or it contradicts the card it was opened from.
    const I=warmItems(), short=!!warmRoutine().short&&!!lg(date).warmShort;
    return I.map((x,i)=>({i,name:x.n,dose:x.d,grp:x.g})).filter(x=>!short||I[x.i].s);
  }
  return mobList(mobKind(dayPlan(date))).map(([nm,d],i)=>({i,name:nm,dose:d,grp:MOB[mobKind(dayPlan(date))].name}));
}
function gdField(){return guide.kind==='warmup'?'warmup':'mobility'}
// Named rather than inline in the click handler, because a handler is unreachable from
// the test harness and this one carries the only state the panel has.
function gdHow(){ if(!guide) return false; guide.how=!guide.how; LS.set('ob.guide',guide); return guide.how }
function gdTickOff(idx){
  const f=gdField(), A=[...(lg(guide.date)[f]||[])];
  A[idx]=true; for(let j=0;j<A.length;j++) if(A[j]==null) A[j]=false;
  setLog(guide.date,f,A);
}
function gdBegin(){
  const items=gdItems(guide.kind,guide.date), it=items[guide.pos];
  if(!it){gdFinish();return}
  const h=holdSecs(it.dose);
  guide.sides=h?h.sides:0; guide.dur=h?h.s:0; guide.side=1;
  guide.end=h?Date.now()+h.s*1000:null; guide.paused=null; guide.wait=null;
  LS.set('ob.guide',guide);
  say(it.name+(h?'. '+durText(h.s)+(h.sides>1?' each side':''):(it.dose?'. '+it.dose:'')));
}
function gdStart(kind){
  if(!gdItems(kind,sel).length) return;
  unlockAudio(); stopRest();
  guide={kind,date:sel,pos:0};
  gdBegin(); syncScreen(); gdShow();
}
function gdGo(pos){
  const items=gdItems(guide.kind,guide.date);
  if(pos<0) return;
  if(pos>=items.length){gdFinish();return}
  guide.pos=pos; gdBegin(); gdRender();
}
function gdFinish(){
  say(guide.kind==='warmup'?'Warm-up done.':'Mobility done.');
  sfx('gdone'); vib([160,90,220]);
  gdClose();
}
function gdClose(){ guide=null; LS.set('ob.guide',null); syncScreen(); gdShow(); render(); }
function gdShow(){
  const el=document.getElementById('gd');
  if(!guide||viewing){el.hidden=true;clearInterval(gdTick);gdTick=null;document.body.style.overflow='';return}
  el.hidden=false; document.body.style.overflow='hidden';
  if(!gdTick) gdTick=setInterval(gdRender,200);
  gdRender();
}
function gdRender(){
  const box=document.getElementById('gd-in'); if(!guide||!box) return;
  const items=gdItems(guide.kind,guide.date), it=items[guide.pos];
  if(!it){gdFinish();return}
  const timed=guide.dur>0, paused=!!guide.paused, auto=plan.guideAuto!==false;
  let left=0;
  if(timed){
    left=Math.max(0,Math.ceil((guide.end-(paused?guide.paused:Date.now()))/1000));
    if(!paused&&!guide.wait&&Date.now()>=guide.end){
      const more=guide.sides>guide.side;
      if(more){ sfx('side'); vib([140,70,140]); say('Switch sides') }
      else { sfx('hold'); vib([200]); gdTickOff(it.i) }
      if(auto){
        if(more){ guide.side++; guide.end=Date.now()+guide.dur*1000; left=guide.dur; }
        else { LS.set('ob.guide',guide); return gdGo(guide.pos+1) }
      } else { guide.wait=more?'side':'next'; if(!more) say('Done'); }
      LS.set('ob.guide',guide);
    }
    if(guide.wait) left=0;
  }
  const el=document.getElementById('gd');
  el.className=guide.wait?'rest':timed?(paused?'':'hold'):'';
  const next=items[guide.pos+1];
  box.innerHTML=`<div class="gd-top"><span>${guide.kind==='warmup'?'Warm-up':'Mobility'} · ${guide.pos+1} of ${items.length}</span><button class="btn sm ghost" data-gd="close">Close</button></div>
  <div class="gd-bar"><i style="width:${Math.round(100*guide.pos/items.length)}%"></i></div>
  ${it.grp?`<div class="gd-grp">${esc(it.grp)}</div>`:''}
  <div class="gd-name">${esc(it.name)}</div>
  ${timed?`<div class="gd-time">${Math.floor(left/60)}:${pad(left%60)}</div>${guide.sides>1?`<div class="gd-side">Side ${guide.side} of ${guide.sides}</div>`:''}`:`<div class="gd-dose">${esc(it.dose||'')}</div>`}
  ${guide.wait?`<button class="btn primary" style="padding:16px;font-size:18px;width:min(100%,460px);margin:0 auto" data-gd="go">${guide.wait==='side'?'Start side '+(guide.side+1)+' ›':(next?'Next: '+esc(next.name)+' ›':'Finish ›')}</button>`:timed?'':`<button class="btn primary" style="padding:16px;font-size:18px;width:min(100%,460px);margin:0 auto" data-gd="done">Done</button>`}
  ${(()=>{
    // The movement library, on the screen you are actually looking at while doing it.
    // Off by default so it does not push the timer out of view, and the choice sticks
    // from one movement to the next -- someone learning a routine wants it all the way
    // through, someone who knows it never wants it.
    const e=mlibEntry(it.name); if(!e) return '';
    return `<button class="btn sm ghost" style="margin:0 auto" data-gd="how" aria-expanded="${guide.how?'true':'false'}">${guide.how?'Hide how':'How to do it'}</button>${guide.how?`<div class="gd-how">${libBody(e)}</div>`:''}`;
  })()}
  ${guide.wait?'':`<div class="gd-next">${next?'Next: '+esc(next.name):'Last one'}</div>`}
  <div class="gd-btns"><button class="btn" data-gd="back" ${guide.pos===0?'disabled':''}>‹ Back</button>${timed&&!guide.wait?`<button class="btn" data-gd="pause">${paused?'Resume':'Pause'}</button>`:''}<button class="btn" data-gd="skip">Skip ›</button></div>
  <button class="btn sm ghost" style="margin:0 auto" data-gd="auto">Auto-advance: ${auto?'on':'off'}</button>`;
}
document.getElementById('gd').addEventListener('click',e=>{
  const b=e.target.closest('[data-gd]'); if(!b||!guide) return; const a=b.dataset.gd; unlockAudio();
  if(a==='close') return gdClose();
  if(a==='how'){ gdHow(); return gdRender() }
  if(a==='back') return gdGo(guide.pos-1);
  if(a==='skip') return gdGo(guide.pos+1);
  if(a==='done'){ gdTickOff(gdItems(guide.kind,guide.date)[guide.pos].i); return gdGo(guide.pos+1) }
  if(a==='go'){
    if(guide.wait==='side'){ guide.side++; guide.end=Date.now()+guide.dur*1000; guide.wait=null; LS.set('ob.guide',guide); return gdRender() }
    guide.wait=null; return gdGo(guide.pos+1);
  }
  if(a==='auto'){ mutatePlan(p=>{p.guideAuto=p.guideAuto===false}); return gdRender() }
  if(a==='pause'){
    if(guide.paused){ guide.end+=Date.now()-guide.paused; guide.paused=null }
    else guide.paused=Date.now();
    LS.set('ob.guide',guide); gdRender();
  }
});

/* ---------- lifting session mode ---------- */
// One set at a time on lifting days. Steps are rebuilt from the plan and the day's log
// on every render, so edits (working weight, warm-ups) flow straight through.
let ls=LS.get('ob.ls'), lsTick=null;
// Test-day target, same rules as the test card: typed target, else the result, else
// the current max (87% of it for a 5RM; last program's max during a bridge week).
function testTargetOn(date,k,isRm5){
  const T=((lg(date).test||{})[k])||{}, wk=weekOf(date);
  const c=wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):1, m=maxFor(c)[k];
  const cur=m?m.v:((plan.prevMaxes||{})[k]??null), bw=bwFor(date);
  const est=cur==null?null:isBW(k)?(bw?floorTo((bw+cur)*(isRm5?.87:1)-bw,plan.round[k]):null):(isRm5?floorTo(cur*.87,plan.round[k]):cur);
  const tgt=T.target!=null&&T.target!==''?+T.target:(T.w!=null&&T.w!==''?+T.w:est);
  return {T,tgt,est};
}
// A warm-up weight you set yourself beats the calculated ramp, so the plates, the
// "Next:" line and the step itself all agree with what is actually on the bar.
function warmW(date,k,j,calc){
  const x=wuListFor(date,k)[j];
  return x&&x.w!=null&&x.w!==''?+x.w:calc;
}
// The bar does not come in every weight the percentages ask for. Nudging a ramp set
// writes it to that row, which is the same place typing it on the day's card writes to.
function adjustWarm(date,k,j,delta,calc){
  const cur=warmW(date,k,j,calc);
  if(cur==null) return null;
  const inc=+plan.round[k]||5, floor=isBW(k)?-500:+plan.bar||0;
  const next=Math.max(floor,cur+(delta>0?inc:-inc));
  setLog(date,'lifts.'+k+'.warmup.'+j+'.w',next);
  return next;
}
function lsSteps(date){
  const wk=weekOf(date), dp=dayPlan(date); if(!wk) return [];
  if(dp.t==='rm5'||dp.t==='test'){
    const isRm5=dp.t==='rm5', steps=[];
    for(const k of dp.lifts){
      const {tgt}=testTargetOn(date,k,isRm5);
      if(ls&&ls.warm!==false&&tgt!=null) testRamp(k,tgt,isRm5).forEach((x,j,a)=>steps.push({k,type:'warm',j,n:a.length,w:warmW(date,k,j,x.w),r:x.r,lbl:x.lbl}));
      steps.push({k,type:'test',isRm5,w:tgt,r:isRm5?5:1});
    }
    if(dp.pullups) steps.push({type:'pullups'});
    steps.unshift({type:'gwarm'}); steps.push({type:'mob'});
    steps.push({type:'finish',test:true});
    return steps;
  }
  if(dp.t!=='lift') return [];
  const steps=[];
  for(const k of dp.lifts){
    const r=rx(wk,k), L=(lg(date).lifts||{})[k]||{}, T=L.used!=null&&L.used!==''?+L.used:r.w;
    if(T==null) continue;
    if(ls&&ls.warm!==false){ ramp(k,T,r.t,dp.deload).forEach((x,j,a)=>steps.push({k,type:'warm',j,n:a.length,w:warmW(date,k,j,x.w),r:x.r,lbl:x.lbl})) }
    const nS=r.sMax;
    for(let j=0;j<nS;j++) steps.push({k,type:'work',j,n:nS,w:T,r:r.r,opt:j>=r.s,pct:r.p});
  }
  /* Session mode used to drop the accessories on a heavy week, which is the rule the
     card used to state and no book actually gives. It also dropped them for a template
     that programs its own supplementary work, which the card was careful not to do, so
     Grey Man's prescribed sets vanished from the walkthrough on weeks 3 and 6.

     What it respects instead is the skip on the day: if you decided this morning that
     they were costing you the main lifts, the walkthrough should not march you through
     them anyway. */
  if(!dp.deload&&!accSkipped(date)&&dp.acc) for(const g of accRunGroups(dp.acc)) steps.push({type:'acc',slot:g[0],pair:g[1]||null});
  steps.unshift({type:'gwarm'}); steps.push({type:'mob'});
  steps.push({type:'finish'});
  return steps;
}
function lsStepDone(st){
  const L=(lg(ls.date).lifts||{})[st.k]||{};
  if(st.type==='warm') return !!((wuListFor(ls.date,st.k)[st.j]||{}).done);
  if(st.type==='work') return !!((L.sets||[])[st.j]);
  if(st.type==='acc') return [st.slot,st.pair].filter(Boolean).every(sl=>accDone(ls.date,sl));
  if(st.type==='test'){const t=((lg(ls.date).test||{})[st.k])||{};return t.w!=null&&t.w!==''}
  if(st.type==='pullups') return lg(ls.date).pullups!=null&&lg(ls.date).pullups!=='';
  return false;
}
function wuListFor(date,k){const W=((lg(date).lifts||{})[k]||{}).warmup;return Array.isArray(W)?W:W?Object.keys(W).reduce((a,i)=>(a[+i]=W[i],a),[]):[]}
function lsFirstOpen(){const st=lsSteps(ls.date);
  if(!st.some(x=>['warm','work','test','pullups','acc'].includes(x.type)&&lsStepDone(x))) return 0;
  const i=st.findIndex(x=>['warm','work','test','pullups','acc'].includes(x.type)&&!x.opt&&!lsStepDone(x));return i<0?st.length-1:i}
function lsStart(){ ls={date:sel,i:0,warm:true}; ls.i=lsFirstOpen(); LS.set('ob.ls',ls); unlockAudio(); syncScreen(); lsShow(); }
function lsClose(){ ls=null; LS.set('ob.ls',null); syncScreen(); lsShow(); render(); }
function lsShow(){
  const el=document.getElementById('ls');
  if(!ls||viewing){el.hidden=true;clearInterval(lsTick);lsTick=null;document.body.style.overflow='';return}
  el.hidden=false; document.body.style.overflow='hidden';
  if(!lsTick) lsTick=setInterval(lsRestTick,250);
  lsRender();
}
function lsRestHtml(){
  if(!rest) return '';
  const left=Math.max(0,Math.ceil((rest.end-Date.now())/1000));
  return `<div class="ls-rest${left===0?' done':''}" id="ls-rest"><div><div class="small" style="font-weight:700">${esc(rest.lbl)}</div><b id="ls-rest-t">${Math.floor(left/60)}:${pad(left%60)}</b></div><div class="ls-row" style="flex:0 0 auto"><button class="btn sm" data-ls="r-30">−30s</button><button class="btn sm" data-ls="r+30">+30s</button><button class="btn sm" data-ls="rskip">${left===0?'Clear':'Skip'}</button></div></div>`;
}
function lsRestTick(){
  if(!ls) return; const box=document.getElementById('ls-rest');
  if(!rest){ if(box) lsRender(); return } if(!box){ lsRender(); return }
  const left=Math.max(0,Math.ceil((rest.end-Date.now())/1000));
  document.getElementById('ls-rest-t').textContent=Math.floor(left/60)+':'+pad(left%60);
  box.classList.toggle('done',left===0);
}
// how it moved and whether anything hurt, asked on the finish screen too
function lsAfter(L){
  return `<label class="f">How did it move?<div class="seg">${FEELS.map(([v,l])=>`<button class="segb${L.feel===v?' on':''}" data-ls="sfeel" data-v="${v}">${l}</button>`).join('')}</div></label>
  <label class="f">Anything hurt?<div class="seg">${PAINS.map(([v,l])=>`<button class="segb${L.pain===v?' on':''}" data-ls="spain" data-v="${v}">${l}</button>`).join('')}</div></label>
  ${L.pain&&L.pain!=='none'?`<label class="f">Where<div class="seg">${Object.entries(PAIN_AT).map(([k,x])=>`<button class="segb${painAt(L).includes(k)?' on':''}" data-ls="spainat" data-v="${k}">${x.name}</button>`).join('')}</div></label>`:''}`;
}
function lsRender(){
  const box=document.getElementById('ls-in'); if(!ls||!box) return;
  const steps=lsSteps(ls.date); if(!steps.length){lsClose();return}
  ls.i=Math.min(Math.max(0,ls.i),steps.length-1);
  const st=steps[ls.i], wk=weekOf(ls.date), dp=dayPlan(ls.date), done=steps.filter(x=>['warm','work','test','pullups','acc'].includes(x.type)&&lsStepDone(x)).length, total=steps.filter(x=>['warm','work','test','pullups','acc'].includes(x.type)).length;
  let h=`<div class="ls-top"><span>${esc(dp.short||'')} · ${esc(weekTitle(wk).t)}</span><button class="btn sm ghost" data-ls="close">Close</button></div><div class="ls-prog"><i style="width:${total?100*done/total:0}%"></i></div>`;
  h+=lsRestHtml();
  if(st.type==='warm'||st.type==='work'){
    const k=st.k, L=(lg(ls.date).lifts||{})[k]||{}, isDone=lsStepDone(st), bar=isBarbell(k);
    const next=steps[ls.i+1];
    h+=`<div class="ls-card"><div class="ls-lift">${esc(liftName(k))}</div>
      <div class="ls-kind${st.type==='work'?' work':''}">${st.type==='warm'?`Warm-up ${st.j+1} of ${st.n} · ${esc(st.lbl)}`:`Working set ${st.j+1} of ${st.n}${st.opt?' · optional':''} · ${st.pct}%`}${isDone?' · ✓ done':''}</div>
      <div><span class="ls-w">${isBW(k)?fmtLoad(k,st.w):n(st.w)}<small>${isBW(k)?(st.w>0?u()+' added':'bodyweight'):u()}</small></span> <span class="ls-reps">× ${st.r}</span></div>
      ${bar?plateSvg(st.w,true)+`<div class="plates">${esc(plates(st.w))}</div>`:''}
      ${st.type==='warm'?`<div class="ls-row"><button class="btn sm" data-ls="ww-">−${n(plan.round[k]||5)}</button><button class="btn sm" data-ls="ww+">+${n(plan.round[k]||5)}</button></div>`:''}
    ${st.type==='work'?`<div class="ls-row"><button class="btn sm" data-ls="w-">−${n(plan.round[k]||5)}</button><button class="btn sm" data-ls="w+">+${n(plan.round[k]||5)}</button></div>
      <div class="ls-eff"><div class="small muted">How did it move? Rating it logs the set.</div><div class="seg wide">${EFFORT.map(([v,t])=>`<button class="segb${setEff(L,st.j)===v?' on':''}" data-ls="eff" data-v="${v}" aria-pressed="${setEff(L,st.j)===v}">${t}</button>`).join('')}</div></div>
      ${st.j===st.n-1&&st.n<SETCAP(rx(wk,k,ls.date))?`<div class="ls-row"><button class="btn sm ghost" data-ls="addset">+ One more set</button></div>`:''}`:''}
    </div>`;
    h+=`<button class="btn primary ls-done" data-ls="done">${isDone?'Done ✓ · next':'Done'}</button>`;
    if(next&&(next.type==='warm'||next.type==='work')) h+=`<div class="small muted" style="text-align:center">Next: ${esc(liftName(next.k))} · ${next.type==='warm'?'warm-up':'set '+(next.j+1)} · ${isBW(next.k)?fmtLoad(next.k,next.w):n(next.w)} × ${next.r}</div>`;
  } else if(st.type==='test'){
    const k=st.k, t=((lg(ls.date).test||{})[k])||{}, bar=isBarbell(k), reps=t.r||st.r, e=estMax(k,t.w,reps,ls.date), next=steps[ls.i+1];
    h+=`<div class="ls-card"><div class="ls-lift">${esc(liftName(k))}</div>
      <div class="ls-kind work">${st.isRm5?'5-rep max · leave 2 reps in reserve':'Heavy single · stop when the bar slows'}${lsStepDone(st)?' · ✓ saved':''}</div>
      ${st.w!=null?`<div><span class="ls-w">${isBW(k)?fmtLoad(k,st.w):n(st.w)}<small>${isBW(k)?(st.w>0?u()+' added':'bodyweight'):u()} target</small></span></div>
      ${bar?plateSvg(st.w,true)+`<div class="plates">${esc(plates(st.w))}</div>`:''}
      <div class="ls-row"><button class="btn sm" data-ls="t-">Target −${n(plan.round[k]||5)}</button><button class="btn sm" data-ls="t+">Target +${n(plan.round[k]||5)}</button></div>`:`<label class="f">Your target ${st.isRm5?'for 5 reps':'single'} (${u()})<input type="number" inputmode="decimal" step="any" id="ls-tt" data-lsin="target" data-k="${k}" placeholder="e.g. what you think you can do with 2 reps left"></label><div class="note">No max to aim from yet. Enter a target and the warm-up ramp is calculated from it, or just work up and log what you get.</div>`}
      <div class="grid3"><label class="f">Weight lifted<input type="number" inputmode="decimal" step="any" id="ls-tw" data-lsin="w" data-k="${k}" value="${t.w??''}" placeholder="${st.w!=null?n(st.w):''}"></label><label class="f">Reps<input type="number" inputmode="numeric" step="1" id="ls-tr" data-lsin="r" data-k="${k}" value="${t.r??''}" placeholder="${st.r}"></label><label class="f">Est. 1RM<div class="big" style="font-size:34px">${e!=null?(isBW(k)?'+':'')+n(floorTo(e,plan.round[k])):'—'}</div></label></div>
      ${isBW(k)?'<div class="small muted">Enter the weight you added (0 for bodyweight).</div>':''}
    </div><button class="btn primary ls-done" data-ls="tsave">${lsStepDone(st)?'Saved ✓ · next':'Save result'}</button>`;
    if(next&&next.type==='warm') h+=`<div class="small muted" style="text-align:center">Next: ${esc(liftName(next.k))} warm-ups</div>`;
  } else if(st.type==='pullups'){
    h+=`<div class="ls-card"><div class="ls-lift">Max pull-ups</div><div class="small muted">One all-out set, full hang to chin over bar.</div><label class="f">Reps<input type="number" inputmode="numeric" step="1" id="ls-pu" data-lsin="pullups" value="${lg(ls.date).pullups??''}"></label></div><button class="btn primary ls-done" data-ls="next">Next</button>`;
  } else if(st.type==='gwarm'||st.type==='mob'){
    const isW=st.type==='gwarm', W=warmItems();
    const short=!!warmRoutine().short&&!!lg(ls.date).warmShort;
    const items=isW?W.map((x,i)=>[i,x.n,x.d,x.g]).filter(([i])=>!short||W[i].s):mobList(mobKind(dp)).map(([n,d],i)=>[i,n,d,'']);
    const flags=(isW?lg(ls.date).warmup:lg(ls.date).mobility)||[], done=items.filter(([i])=>flags[i]).length;
    h+=`<div class="ls-card"><div class="ls-lift">${isW?'Warm-up':'Mobility'}</div>
      <div class="ls-kind">${done} of ${items.length} done · ${isW?esc(short?(warmRoutine().short||''):(warmRoutine().mins||'')):esc(MOB[mobKind(dp)].name)}</div>
      ${isW?`<div class="seg"><button class="segb${short?'':' on'}" data-ls="wfull">Full</button><button class="segb${short?' on':''}" data-ls="wshort">Short</button></div>`:`<div class="small muted">${esc(MOB[mobKind(dp)].why)}</div>`}
      <div class="stack">${items.map(([i,n,d])=>{const hs=holdSecs(d);
        return `<div class="ls-wrow"><button class="btn${flags[i]?' primary':''}" style="justify-content:flex-start;text-align:left;flex:1" data-ls="${isW?'gw':'mb'}" data-i="${i}">${flags[i]?'✓ ':''}${esc(n)}${d?` <span class="small">· ${esc(d)}</span>`:''}</button>${hs?`<button class="btn sm hold" data-ls="hold" data-i="${i}" aria-label="Time ${esc(n)}">⏱</button>`:''}</div>`}).join('')}</div></div>
      <div class="ls-row"><button class="btn" data-ls="guide">Guide me ›</button><button class="btn primary" style="flex:2" data-ls="next">${done>=items.length?'Done ✓ · next':isW?'Skip to lifting ›':'Next'}</button></div>`;
  } else if(st.type==='acc'){
    const pair=[st.slot,st.pair].filter(Boolean), rest=+plan.accRest||90;
    const allDone=pair.every(sl=>accDone(ls.date,sl));
    h+=`<div class="ls-card"><div class="ls-lift">${esc(pair.map(sl=>(ASLOT[sl]||{}).name||sl).join(' + '))}</div>
      <div class="ls-kind">${pair.length>1?'Superset':'Accessory'}${pair.some(sl=>accSwapped(ls.date,sl))?' \u00b7 swapped for today':''}${allDone?' \u00b7 \u2713 done':''}</div>
      ${pair.length>1?'<div class="small muted">A set of each, back to back, then rest.</div>':''}
      ${pair.map(sl=>lsAccBlock(sl,pair.length>1)).join('')}
      <div class="ls-row"><button class="btn sm" data-ls="accrest" data-slot="${esc(st.slot)}">Rest ${rest}s</button></div>
    </div>
    <button class="btn primary ls-done" data-ls="done">${allDone?'Done \u2713 \u00b7 next':'Done'}</button>`;
  } else if(st.test){
    const L=lg(ls.date), isRm5=dp.t==='rm5';
    const rows=dp.lifts.map(k=>{const t=((L.test||{})[k])||{},e=estMax(k,t.w,t.r||(isRm5?5:1),ls.date);return `<tr><td>${esc(liftName(k))}</td><td class="n">${t.w!=null&&t.w!==''?(isBW(k)?fmtLoad(k,+t.w):n(t.w))+' × '+(t.r||(isRm5?5:1)):'—'}</td><td class="n">${e!=null?'≈ '+(isBW(k)?'+':'')+n(floorTo(e,plan.round[k])):''}</td></tr>`}).join('')+(dp.pullups?`<tr><td>Pull-ups</td><td class="n">${L.pullups??'—'}</td><td></td></tr>`:'');
    h+=`<div class="ls-card"><div class="ls-lift">Test results</div><div class="tbl-wrap"><table><thead><tr><th>Lift</th><th class="n">Result</th><th class="n">Est. 1RM</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="small muted">${isRm5?'Sunday turns these into your maxes (Today → Sunday → Save as my maxes).':'Use “Feed results forward” on Saturday’s card to set next cycle’s maxes.'}</div>
      <label class="f">Session RPE<div class="seg">${[6,7,8,9,10].map(v=>`<button class="segb${+L.rpe===v?' on':''}" data-ls="rpe" data-v="${v}">${v}</button>`).join('')}</div></label>${lsAfter(L)}</div>
      <button class="btn primary ls-done" data-ls="finish">${L.done?'Finished ✓ · close':'Finish session'}</button>`;
  } else {
    const L=lg(ls.date);
    const rows=dp.lifts.map(k=>{const x=(L.lifts||{})[k]||{},r=rx(wk,k),nS=r.s,dn=(x.sets||[]).filter(Boolean).length;return `<tr><td>${esc(liftName(k))}</td><td class="n">${dn}/${nS}${r.sMax>nS?'+':''}</td><td>${ground(x)?'<span class="chip mid">ground</span>':''}${effSummary(x)?` <span class="small muted">${esc(effSummary(x))}</span>`:''}</td></tr>`}).join('');
    h+=`<div class="ls-card"><div class="ls-lift">Session summary</div><div class="tbl-wrap"><table><tbody>${rows}</tbody></table></div>
      <label class="f">Session RPE<div class="seg">${[6,7,8,9,10].map(v=>`<button class="segb${+L.rpe===v?' on':''}" data-ls="rpe" data-v="${v}">${v}</button>`).join('')}</div></label>${lsAfter(L)}</div>
      <button class="btn primary ls-done" data-ls="finish">${L.done?'Finished ✓ · close':'Finish session'}</button>`;
  }
  h+=`<div class="ls-row"><button class="btn" data-ls="back" ${ls.i===0?'disabled':''}>‹ Back</button><button class="btn" data-ls="skip" ${ls.i>=steps.length-1?'disabled':''}>Skip ›</button></div>`;
  if(ls.i===0) h+=`<label class="check small" style="justify-content:center"><input type="checkbox" id="ls-warm" ${ls.warm!==false?'checked':''}> Include warm-up sets</label>`;
  box.innerHTML=h;
}
// The dose on a warm-up or mobility item is the timer. Resolving it from the item's
// index keeps one source of truth, so the clock on the checklist and the guided run
// cannot drift apart.
function lsHold(kind,i){
  const it=gdItems(kind,ls.date).find(x=>x.i===i); if(!it) return false;
  const h=holdSecs(it.dose); if(!h) return false;
  startHold(it.name,h.s,h.sides,1);
  return true;
}
// One accessory job inside a step. A superset step draws two of these; the rest button
// belongs to the step, not to each job, because you rest once at the end of the pair.
function lsAccBlock(sl,inPair){
  const id=accOn(ls.date,sl), sets=accSets(ls.date,sl), list=accFor(sl,id), all=accAll();
  return `<div class="ls-accblk">${inPair?`<div class="acc-role">${esc((ASLOT[sl]||{}).name||sl)}</div>`:''}
    <select id="ls-accex-${esc(sl)}" data-lsaccex="${esc(sl)}" aria-label="What is doing ${esc((ASLOT[sl]||{}).name||sl)} today">${list.map(k=>`<option value="${esc(k)}"${k===id?' selected':''}>${esc(all[k].name)}${all[k].gear?' \u00b7 '+esc(all[k].gear):''}</option>`).join('')}</select>
    ${sl==='pullup'?`<div class="small muted">${esc(pullupState(ls.date).st.work)}</div>`:''}
    <div class="stack" style="gap:6px">${sets.map((x,i)=>`<div class="wu-row"><span class="wu-lbl">${i+1}</span>
      <input type="number" inputmode="decimal" step="any" id="ls-accw-${esc(sl)}-${i}" data-lsacc="${esc(sl)}|${i}|w" value="${x&&x.w!=null?esc(String(x.w)):''}" placeholder="${isBWAcc(id)?'bw':esc(u())}" aria-label="Set ${i+1} weight">
      <span class="wu-x">\u00d7</span>
      <input type="number" inputmode="numeric" step="1" id="ls-accr-${esc(sl)}-${i}" data-lsacc="${esc(sl)}|${i}|r" value="${x&&x.r!=null?esc(String(x.r)):''}" placeholder="reps" aria-label="Set ${i+1} reps">
      <span></span><button class="wu-rm" data-ls="accrm" data-slot="${esc(sl)}" data-i="${i}" aria-label="Remove set ${i+1}">\u00d7</button></div>`).join('')}</div>
    <div class="ls-row"><button class="btn sm" data-ls="accadd" data-slot="${esc(sl)}">+ Add set</button></div></div>`;
}
function lsMarkWarm(st){
  const W=wuListFor(ls.date,st.k).map(x=>x?Object.assign({},x):{});
  const x=W[st.j]||(W[st.j]={}); x.done=true; if(x.w==null||x.w==='')x.w=st.w; if(x.r==null||x.r==='')x.r=st.r;
  for(let j=0;j<W.length;j++) if(!W[j]) W[j]={};
  setLog(ls.date,'lifts.'+st.k+'.warmup',W);
}
// The whole of session mode's behavior sits behind one click handler, which means none
// of it is reachable from a test. Naming it makes every button's effect testable; the
// listener's only job is to find which button was tapped.
function lsAct(a,b){
  if(!ls) return;
  const steps=lsSteps(ls.date), st=steps[ls.i]; unlockAudio();
  const go=i=>{ls.i=i;LS.set('ob.ls',ls);lsRender();document.getElementById('ls').scrollTo(0,0)};
  if(a==='close') return lsClose();
  if(a==='back') return go(ls.i-1);
  if(a==='skip'||a==='next') return go(ls.i+1);
  if(a==='r-30'||a==='r+30'){ if(rest){rest.end=Math.max(Date.now()+1000,rest.end+(a==='r+30'?30000:-30000));rest.done=false;rest.dur=Math.max(rest.dur,Math.round((rest.end-Date.now())/1000));LS.set('ob.rest',rest);syncPush()} return lsRender() }
  if(a==='rskip'){ stopRest(); return lsRender() }
  if(a==='addset'){ addSet(st.k,1,ls.date); return lsRender() }
  // A rating is a Done with something to say: it records how the set moved and then
  // takes the same path, so rating costs no extra tap. Re-rating a set already done
  // just changes the rating.
  if(a==='eff'&&st&&st.type==='work'){
    const was=lsStepDone(st);
    setEffort(ls.date,st.k,st.j,b.dataset.v);
    if(was) return lsRender();
    a='done';
  }
  if(a==='ww-'||a==='ww+'){ adjustWarm(ls.date,st.k,st.j,a==='ww+'?1:-1,st.w); return lsRender() }
  if(a==='w-'||a==='w+'){ const inc=+plan.round[st.k]||5; setLog(ls.date,'lifts.'+st.k+'.used',Math.max(isBW(st.k)?-500:+plan.bar||0,st.w+(a==='w+'?inc:-inc))); return lsRender() }
  if(a==='acc'){ const sl=b.dataset.slot; setLog(ls.date,'acc.done.'+sl,accDone(ls.date,sl)?null:true); return lsRender() }
  if(a==='accadd'||a==='accrm'){
    const sl=b.dataset.slot, cur=accSets(ls.date,sl).slice();
    if(a==='accadd') cur.push({}); else cur.splice(+b.dataset.i,1);
    setLog(ls.date,'acc.sets.'+sl,cur);
    if(cur.length) setLog(ls.date,'acc.done.'+sl,null);
    return lsRender();
  }
  if(a==='accrest'){
    const sl=b.dataset.slot, next=lsSteps(ls.date)[ls.i+1];
    startRest(null,next&&next.type==='acc'?(ASLOT[next.slot]||{}).name:accName(accOn(ls.date,sl)),+plan.accRest||90,'Rest \u00b7 '+((ASLOT[sl]||{}).name||sl));
    return lsRender();
  }
  if(a==='guide'){gdStart(st.type==='gwarm'?'warmup':'mobility');return}
  if(a==='hold'){lsHold(st.type==='gwarm'?'warmup':'mobility',+b.dataset.i);return lsRender()}
  if(a==='gw'||a==='mb'){ const f=a==='gw'?'warmup':'mobility', A=[...(lg(ls.date)[f]||[])], i=+b.dataset.i; A[i]=!A[i]; for(let j=0;j<A.length;j++) if(A[j]==null) A[j]=false; setLog(ls.date,f,A); return lsRender() }
  if(a==='wfull'||a==='wshort'){ setLog(ls.date,'warmShort',a==='wshort'); return lsRender() }
  if(a==='rpe'){ setLog(ls.date,'rpe',+b.dataset.v); return lsRender() }
  if(a==='sfeel'){ const v=b.dataset.v; setLog(ls.date,'feel',lg(ls.date).feel===v?null:v); return lsRender() }
  if(a==='spain'){ const v=b.dataset.v, same=lg(ls.date).pain===v; setLog(ls.date,'pain',same?null:v); if(!same&&v==='none') setLog(ls.date,'painAt',[]); return lsRender() }
  if(a==='spainat'){ const k=b.dataset.v, cur=painAt(lg(ls.date)); setLog(ls.date,'painAt',cur.includes(k)?cur.filter(y=>y!==k):[...cur,k]); return lsRender() }
  if(a==='finish'){ if(!lg(ls.date).done) setLog(ls.date,'done',true); stopRest(); say('Session done. Nice work.'); return lsClose() }
  if(a==='t-'||a==='t+'){ const inc=+plan.round[st.k]||5, base=st.w!=null?st.w:0; setLog(ls.date,'test.'+st.k+'.target',Math.max(isBW(st.k)?-500:+plan.bar||0,base+(a==='t+'?inc:-inc))); return lsRender() }
  if(a==='tsave'){
    if(lsStepDone(st)) return go(ls.i+1);
    const t=((lg(ls.date).test||{})[st.k])||{};
    if((t.w==null||t.w==='')&&st.w!=null) setLog(ls.date,'test.'+st.k+'.w',st.w);
    if(t.r==null||t.r==='') setLog(ls.date,'test.'+st.k+'.r',st.r);
    if(!lsStepDone(st)){ const inp=document.getElementById('ls-tw'); if(inp) inp.focus(); return }
    const next=lsSteps(ls.date)[ls.i+1];
    if(next&&(next.type==='warm'||next.type==='test')) startRest(st.k,liftName(next.k)+' · '+(next.type==='warm'?'warm-up 1':'test'),Math.max(restMins(st.k),3)*60,'Rest · after '+liftName(st.k)+' test');
    return go(ls.i+1);
  }
  if(a==='done'){
    if(lsStepDone(st)) return go(ls.i+1);
    if(st.type==='warm'){ lsMarkWarm(st); }
    // An accessory step has no lift and no set index. Without this it fell through to
    // the branch below and wrote lifts.undefined.sets into the day.
    else if(st.type==='acc'){ for(const sl of [st.slot,st.pair].filter(Boolean)) setLog(ls.date,'acc.done.'+sl,true); }
    else { const L=(lg(ls.date).lifts||{})[st.k]||{}, arr=[...(L.sets||[])]; arr[st.j]=true; for(let j=0;j<arr.length;j++) if(arr[j]==null) arr[j]=false; setLog(ls.date,'lifts.'+st.k+'.sets',arr); }
    const next=lsSteps(ls.date)[ls.i+1];
    if(next&&(next.type==='warm'||next.type==='work'||next.type==='test')){
      const label=liftName(next.k)+' · '+(next.type==='warm'?'warm-up '+(next.j+1):next.type==='test'?(next.isRm5?'5-rep max':'heavy single'):'set '+(next.j+1));
      // the lift's warm-up rest between ramp sets, its full rest before the first working set
      const intoWork=st.type==='warm'&&next.type!=='warm';
      if(st.type==='warm'){
        startRest(st.k,label,intoWork?restMins(st.k)*60:warmRestSecs(st.k),(intoWork?'Rest before working sets · ':'Warm-up rest · ')+liftName(st.k));
        if(!intoWork&&rest){rest.ramp=1;LS.set('ob.rest',rest)}
      }
      else startRest(st.k,label);
    } else if(st.type==='work') stopRest();
    return go(ls.i+1);
  }
}
document.getElementById('ls').addEventListener('click',e=>{
  const b=e.target.closest('[data-ls]'); if(!b||!ls) return;
  lsAct(b.dataset.ls,b);
});
document.getElementById('ls').addEventListener('input',e=>{
  const t=e.target; if(!ls||!t.dataset||!t.dataset.lsacc) return;
  const [sl,i,f]=t.dataset.lsacc.split('|'), cur=accSets(ls.date,sl).slice();
  while(cur.length<=+i) cur.push({});
  cur[+i]=Object.assign({},cur[+i],{[f]:t.value===''?null:+t.value});
  setLog(ls.date,'acc.sets.'+sl,cur);
});
document.getElementById('ls').addEventListener('change',e=>{
  const t=e.target; if(!ls||!t.dataset) return;
  if(t.dataset.lsaccex){ const sl=t.dataset.lsaccex;
    setLog(ls.date,'acc.ex.'+sl, t.value===accPickFor(accDayOf(ls.date),sl,accCycleOf(ls.date))?null:t.value);
    return lsRender();
  }
  if(t.dataset.lsacc) return lsRender();   // on blur only: the caret survives
});
document.getElementById('ls').addEventListener('change',e=>{ const t=e.target; if(t.dataset.lsin&&ls){ const v=t.value===''?null:+t.value; if(t.dataset.lsin==='pullups') setLog(ls.date,'pullups',v); else setLog(ls.date,'test.'+t.dataset.k+'.'+t.dataset.lsin,v); lsRender(); return }
  if(e.target.id==='ls-warm'&&ls){ ls.warm=e.target.checked; ls.i=0; LS.set('ob.ls',ls); lsRender(); } });

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
    mv:[['Sprint 50 to 100 m',{s:15}]]}};
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
    else for(let i=1;i<=o.rounds;i++){seg.push({k:'work',l:'Hard',sub:'Round '+i+' of '+o.rounds,s:wk,round:i});if(i<o.rounds)seg.push({k:'easy',l:'Easy',sub:'Round '+i+' of '+o.rounds+' done',s:r.rest,round:i})}}
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
  const held=segs.reduce((a0,x)=>a0+(x.hold?x.s:0),0);   // rep bursts are not on the clock
  return {warm,work:ivTotal(segs)-warm-cool-held,cool,rounds:segs.filter(x=>x.round&&x.k==='work').length};
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
function ivBaseLeft(p,t){let acc=0;for(let i=p.i;i<iv.segs.length;i++){const g=iv.segs[i];if(g.hold)continue;acc+=i===p.i?p.left:g.s}return Math.max(0,Math.round(acc))}
function ivPos(el){let acc=0;for(let i=0;i<iv.segs.length;i++){if(el<acc+iv.segs[i].s)return {i,left:acc+iv.segs[i].s-el,into:el-acc};acc+=iv.segs[i].s}return {i:iv.segs.length,left:0,into:0}}
// tone() lived here: the second audio path, with none of beep()'s fixes. See sfx().
function vib(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
function ivStart(fmt){
  const o=ivOpts(sel,fmt), segs=ivSegments(fmt,o);
  unlockAudio(); stopRest(); clearTimeout(pushTimer); // a pending rest-alert cancel must not wipe the interval queue
  iv={date:sel,fmt,mod:modOf(sel),segs,start:Date.now()+1500,paused:null,pausedMs:0,mini:false,rounds:o.rounds||0,done:false};
  if(IV[fmt]) plan.ivRounds=Object.assign({},plan.ivRounds||{},{[fmt]:o.rounds}),planV++,queueWrite('plan/main',()=>plan);
  ivLast={idx:-1,left:-1}; LS.set('ob.iv',iv); syncScreen(); ivShow(); ivPush();
}
function ivPush(){
  if(!alertsOn()||!iv) return;
  if(iv.paused||iv.done){pushCall('/push/cancel',null,'cancel');return}
  const now=Date.now(), el=ivElapsed(), list=[]; let acc=0;
  iv.segs.forEach((x,i)=>{acc+=x.s; const at=iv.start+iv.pausedMs+acc*1000; if(at<=now+1000) return;
    const nx=iv.segs[i+1];
    // Worded to be read aloud (Siri Announce Notifications): no symbols or clock times.
    if(nx) list.push({at,title:nx.l==='Pickup'?'Pickup':nx.k==='work'?'Go hard':nx.l,body:nx.l==='Pickup'?durText(nx.s)+'.':nx.k==='work'?(nx.sub?nx.sub+', ':'')+durText(nx.s)+'.':durText(nx.s)+(nx.sub&&nx.l==='Easy'&&/done$/.test(nx.sub)?'. '+nx.sub+'.':'.')});
    else list.push({at,title:'Intervals done',body:'Log your result in the app.'});
  });
  if(list.length) pushCall('/push/schedule',{alerts:list.slice(0,80)},'interval alerts');
}
function ivShow(){
  const el=document.getElementById('iv');
  showCover();
  if(!iv){el.hidden=true;document.body.classList.remove('iv-mini');clearInterval(ivTick);ivTick=null;return}
  el.hidden=false; el.classList.toggle('mini',!!iv.mini); document.body.classList.toggle('iv-mini',!!iv.mini);
  document.getElementById('iv-size').textContent=iv.mini?'Expand':'Minimize';
  document.getElementById('iv-title').textContent=MOD[iv.mod].name+' · '+HIC[iv.fmt].name;
  if(!ivTick) ivTick=setInterval(ivRender,200);
  showWake();
  ivRender();
}
function ivRender(){
  if(!iv) return;
  const el=document.getElementById('iv'), total=ivTotal(iv.segs), t=ivElapsed();
  if(t<0){ // 1.5 s lead-in
    el.className=(iv.mini?'mini ':'')+'easy';
    document.getElementById('iv-phase').textContent='Get ready';document.getElementById('iv-time').textContent=Math.ceil(-t);
    document.getElementById('iv-sub').textContent='';document.getElementById('iv-next').textContent='First: '+iv.segs[0].l+' '+mmss(iv.segs[0].s);return;
  }
  const p=ivPos(t);
  if(p.i>=iv.segs.length){ ivFinish(); return; }
  const seg=iv.segs[p.i], nx=iv.segs[p.i+1], left=Math.ceil(p.left);
  el.className=(iv.mini?'mini ':'')+(iv.paused?'paused':seg.k);
  document.getElementById('iv-phase').textContent=iv.paused?'Paused':seg.l;
  if(seg.hold&&!iv.paused&&!iv.done){ iv.paused=Date.now(); LS.set('ob.iv',iv); }
  document.getElementById('iv-time').textContent=seg.hold?seg.reps:mmss(left);
  document.getElementById('iv-sub').textContent=(seg.sub||'')+(iv.paused?'':'');
  document.getElementById('iv-next').textContent=(nx?'Next: '+nx.l+(nx.hold?' '+nx.reps:' '+mmss(nx.s))+' · ':'Last one · ')+mmss(ivBaseLeft(p,t))+' of base left';
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
  if(seg.k==='work') return (seg.sub?seg.sub+'. ':'')+'Go hard. '+dur+'.';
  if(seg.l==='Warm-up') return 'Warm up. Easy for '+dur+'.';
  if(seg.l==='Cool-down') return 'Cool down. '+dur+' easy.';
  if(seg.l==='Steady') return 'Steady pace for '+dur+'.';
  return 'Easy. '+dur+'.';
}
function ivFinish(){
  if(!iv.done){setTimeout(()=>say('Intervals done. Nice work. Log your result.'),900);iv.done=true;LS.set('ob.iv',iv);syncScreen();sfx('ivdone');vib([200,100,200,100,400]);
    const works=iv.segs.filter(x=>x.round).length; if(IV[iv.fmt]) setLog(iv.date,'hic.rounds',iv.rounds);
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
    box.innerHTML=(met?`<label class="f" style="text-align:left">${metricLabel(met)}<input type="number" inputmode="decimal" step="any" id="iv-result" value="${cur??''}" placeholder="Enter your result"></label>`:'')+`<button class="btn primary" data-iv="save">${met?'Save and close':'Close'}</button>`;
  }
}
function ivClose(){iv=null;LS.set('ob.iv',null);syncScreen();ivShow();render()}
document.getElementById('iv').addEventListener('click',e=>{
  if(e.target.id==='iv-size'){iv.mini=!iv.mini;LS.set('ob.iv',iv);ivShow();return}
  const b=e.target.closest('[data-iv]'); if(!b||!iv) return; const a=b.dataset.iv;
  if(a==='cover'){ coverTap(); return }
  unlockAudio();
  if(a==='pause'){ const held=(()=>{const t=ivElapsed();return t>=0&&(iv.segs[ivPos(t).i]||{}).hold})();
    if(iv.paused){iv.pausedMs+=Date.now()-iv.paused;iv.paused=null;syncScreen();
      if(held){const p=ivPos(ivElapsed()); iv.start-=p.left*1000; ivLast.idx=-1}
    } else iv.paused=Date.now(); LS.set('ob.iv',iv); ivRender(); ivPush(); }
  else if(a==='skip'){ const t=ivElapsed(); if(t<0){iv.start=Date.now()-iv.pausedMs}else{const p=ivPos(t); iv.start-=p.left*1000;} ivLast.idx=-1; LS.set('ob.iv',iv); ivRender(); ivPush(); }
  else if(a==='stop'){ if(Date.now()-ivStopArm<3000){ if(alertsOn()) pushCall('/push/cancel',null,'cancel'); ivClose(); } else { ivStopArm=Date.now(); const s=document.getElementById('iv-stop'); s.textContent='Tap again to end'; setTimeout(()=>{s.textContent='End'},3000); } }
  else if(a==='save'){ const inp=document.getElementById('iv-result'), met=metricFor(iv.mod,iv.fmt); if(inp&&met&&inp.value!==''){ if(!(lg(iv.date).hic||{}).mod) setLog(iv.date,'hic.mod',iv.mod); setLog(iv.date,'hic.'+met[0],+inp.value); } ivClose(); }
});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') syncScreen() });

/* ---------- what's new (RELEASES comes from releases.js) ---------- */
const APP_VERSION=RELEASES[0].v;
// deploys are tagged v<version>-<commit>, so the server can name the latest version too
function tagVersion(t){const m=/^v(\d+\.\d+)/.exec(String(t||''));return m?m[1]:null}
function vReleases(){
  return `<div class="card"><div class="lift-h"><h2>What\u2019s new</h2><button class="btn sm ghost" data-act="view" data-view="setup">Back to Setup</button></div>
  <p class="note" style="margin:0">What each release added. The app updates itself: when a new one is deployed you get a banner at the top, and reloading is all it takes.</p></div>
  ${RELEASES.map(r=>`<div class="card"><div class="lift-h"><h3>${esc(r.title)}</h3><span class="chip${r.v===APP_VERSION?' blue':''}">${r.v===APP_VERSION?'Current \u00b7 ':''}${esc(r.v)}</span></div>
  <div class="small muted">${fmtLong(r.date)}</div>
  <ul class="tight small">${r.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}`;
}

/* ---------- undo ---------- */
// One step back for the things that are easy to tap by mistake. Snapshots are taken
// before the change and expire after a few seconds.
let undoItem=null, undoTimer=null;
function snapLog(date){
  const before=logs[date]?clone(logs[date]):null;
  return ()=>{ logs[date]=before?before:{date}; planV++; queueWrite('logs/'+date,()=>logs[date]); render(); };
}
function snapPlan(){
  const before=clone(plan);
  return ()=>{ plan=before; planV++; queueWrite('plan/main',()=>plan); render(); };
}
// The dates a plan change is liable to move. Taken before and after, the difference is
// what the person actually cares about: "my retest moved a week".
function milestones(){
  const t=realToday(), list=weeks(), out={};
  for(const kind of ['deload','test']){const w=list.find(x=>x.kind===kind&&addDays(x.monday,6)>=t); out[kind]=w?w.monday:null}
  const c=list.find(x=>x.kind==='cycle'&&x.w===1&&x.monday>t); out.cycle=c?c.monday:null;
  out.n=list.find(x=>x.monday<=t&&addDays(x.monday,6)>=t);
  out.now=out.n?(out.n.kind==='cycle'?'Cycle '+out.n.cycle+' week '+out.n.w:weekTitle(out.n).t):null;
  return out;
}
function milestoneDiff(a0,b0){
  const bits=[], name={deload:'deload',test:'retest',cycle:'next cycle'};
  for(const k of ['deload','test','cycle']){
    if(a0[k]===b0[k]) continue;
    if(!b0[k]) bits.push('no '+name[k]+' scheduled now');
    else if(!a0[k]) bits.push(name[k]+' now '+fmtD(b0[k],true));
    else bits.push(name[k]+' '+fmtD(a0[k])+' \u2192 '+fmtD(b0[k]));
  }
  if(a0.now!==b0.now&&b0.now) bits.push('this week is now '+b0.now);
  return bits.join(' \u00b7 ');
}
// Apply a plan change and say what it moved, with the usual undo.
function replan(label,fn){
  const before=milestones(), snap=snapPlan();
  mutatePlan(fn);
  const moved=milestoneDiff(before,milestones());
  offerUndo(label+(moved?' \u00b7 '+moved:''),snap);
}
function offerUndo(label,restore){
  undoItem={label,restore};
  clearTimeout(undoTimer); undoTimer=setTimeout(()=>{undoItem=null;showToast()},7000);
  showToast();
}
function showToast(){
  const el=document.getElementById('toast');
  if(!undoItem){el.hidden=true;return}
  document.getElementById('toast-msg').textContent=undoItem.label;
  el.hidden=false;
}
function doUndo(){
  if(!undoItem) return;
  const r=undoItem.restore; undoItem=null; clearTimeout(undoTimer);
  r(); showToast();
}
document.getElementById('toast-undo').addEventListener('click',doUndo);

/* ---------- appearance ---------- */
// Theme and gym mode are per device, so they live in localStorage rather than the plan.
function themePref(){const t=LS.get('ob.theme');return t==='light'||t==='dark'?t:'auto'}
function gymOn(){return !!LS.get('ob.gym')}
function applyTheme(){
  const t=themePref(), r=document.documentElement;
  if(t==='auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme',t);
  r.setAttribute('data-gym',gymOn()?'1':'0');
  let dark=t==='dark';
  if(t==='auto'){ try{dark=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches}catch(e){dark=false} }
  // one meta we control, so an explicit choice also moves the phone's status bar
  document.querySelectorAll('meta[name="theme-color"][media]').forEach(m=>m.remove());
  let m=document.querySelector('meta[name="theme-color"]');
  if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}
  m.content=dark?'#0f1311':'#e8ebe6';
}
try{ if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(themePref()==='auto')applyTheme()}) }catch(e){}

/* ---------- app updates ---------- */
// The server stamps each page with its fingerprint. On open, on return from the
// background and every 30 min, compare it with what's deployed now; if they differ,
// offer a reload. Reloading is safe: data, unsent changes and the timer live on the phone.
const APP_VER=(document.querySelector('meta[name="app-version"]')||{}).content||null;
const upd={latest:null,at:null,tag:null,checked:null,err:null,busy:false,lastCheck:0};
async function checkUpdate(manual){
  if(!manual&&Date.now()-upd.lastCheck<10000) return;
  upd.lastCheck=Date.now(); upd.busy=!!manual; if(manual&&view==='setup') render();
  try{ const v=await api('GET','/version'); Object.assign(upd,{latest:v.page,at:v.deployedAt,tag:v.tag,checked:Date.now(),err:null}) }
  catch(e){ upd.err=navigator.onLine===false?'Offline. Check again when you have signal.':'Couldn’t check for updates.' }
  upd.busy=false; showUpdate(); if(view==='setup') render();
}
function updateAvailable(){return !!(APP_VER&&upd.latest&&upd.latest!==APP_VER&&APP_VER!=='dev')}
function showUpdate(){
  const el=document.getElementById('upd'); el.hidden=!updateAvailable(); if(el.hidden) return;
  const t=upd.at?new Date(upd.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):null;
  el.querySelector('span').textContent='A new version of the app is ready'+(t?' (deployed '+t+').':'.');
}
function applyUpdate(){
  const go=()=>location.reload();
  try{ navigator.serviceWorker&&navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{}).finally(go) }catch(e){ go() }
}
document.getElementById('upd-go').addEventListener('click',applyUpdate);
document.getElementById('upd-what').addEventListener('click',()=>{view='releases';render();window.scrollTo(0,0)});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkUpdate(false) });
setInterval(()=>checkUpdate(false),30*60*1000);

// The account menu. Sign-out is a Cloudflare Access URL, not an API call: it drops the
// Access session cookie, so the next request lands on the login screen. Nothing local is
// cleared — a different person signing in on this phone is handled by switchUser().
const acctB=document.getElementById('acct'), acctM=document.getElementById('acct-m');
function initials(email){
  const at=String(email||'').split('@')[0];
  const parts=at.split(/[._\-+]/).filter(Boolean);
  const s=(parts.length>1?parts[0][0]+parts[1][0]:at.slice(0,2));
  return s?s.toUpperCase():'•';
}
function acctPaint(){
  document.getElementById('acct-i').textContent=me?initials(me):'•';
  document.getElementById('acct-e').textContent=me||'Not signed in';
  const out=document.getElementById('acct-out');
  out.textContent=signedOut?'Sign in':'Sign out';
  out.setAttribute('href',signedOut?'/':'/cdn-cgi/access/logout');
  // Below 520px the status line is hidden, so the dot is the only sync indicator.
  const st=document.getElementById('status'), t=st.textContent||'', err=st.className==='err';
  document.getElementById('acct-dot').className='acct-dot '+(err?'err':t==='Saved'?'ok':'wait');
  const line=document.getElementById('acct-st');
  line.textContent=t; line.className='acct-st'+(err?' err':'');
}
function acctOpen(on){
  acctM.hidden=!on;
  acctB.setAttribute('aria-expanded',on?'true':'false');
  if(on) acctPaint();
}
acctB.addEventListener('click',e=>{ e.stopPropagation(); acctOpen(acctM.hidden) });
// The menu sits in the header, outside #main, so its items cannot use the data-act
// delegation: they carry data-view and are routed here.
acctM.addEventListener('click',e=>{
  const it=e.target.closest('[role="menuitem"]'); if(!it) return;
  acctOpen(false);
  if(it.dataset.view) goView(it.dataset.view);
});
document.addEventListener('click',e=>{ if(!acctM.hidden&&!e.target.closest('#acct-m,#acct')) acctOpen(false) });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!acctM.hidden){acctOpen(false);acctB.focus()} });
acctPaint();

/* ---------- rest alerts (push) ---------- */
// When alerts are on for this device, every rest schedules a push for its end time on
// the server, so the phone is notified even when locked or in another app.
const alerts={msg:null,busy:false};
function alertsSupport(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios&&!navigator.standalone?'install':'unsupported';
  }
  if(Notification.permission==='denied') return 'denied';
  return 'ok';
}
function alertsOn(){return !!LS.get('ob.push')&&window.Notification&&Notification.permission==='granted'}
/* ---------- what is still running when the page is not ----------
A locked phone freezes the page: no script, no Web Audio, no beep. The timer itself is
fine -- it is an absolute end time, so it is on the right second whenever you come back
-- but the sound cannot come from here. The only thing that makes a noise while the
screen is off is the alert the server already holds for every rest and every interval
change. Which makes "alerts off" a different thing during a session than it is in a
settings card: it means this session goes silent the moment the screen does. It only
ever said so in Setup, three taps away from the timer, so the timers say it now. */
function coverText(){
  if(alertsOn()) return null;
  switch(alertsSupport()){
    case 'ok': return 'Alerts off \u00b7 tap for sound when locked';
    case 'denied': return 'Alerts blocked \u00b7 silent once the screen is off';
    case 'install': return 'Add to Home Screen for sound when locked';
    default: return 'No alerts here \u00b7 silent once the screen is off';
  }
}
function showCover(){
  if(typeof document==='undefined') return;
  const t=coverText();
  const set=(id,on)=>{ const el=document.getElementById(id); if(!el) return; if(on) el.textContent=t; el.hidden=!on };
  set('rest-push',!!t&&!!rest&&!rest.done);
  set('iv-push',!!t&&!!iv&&!iv.done);
}
// Tapping it: turn them on where that is all it takes, or go to the card that explains
// why it is not.
function coverTap(){
  if(alertsSupport()==='ok'){ enableAlerts(); return }
  view='setup'; render();
}
function b64uBytes(str){const b=str.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(str.length/4)*4,'=');return Uint8Array.from(atob(b),c=>c.charCodeAt(0))}
// If this device thinks alerts are on but the server has no subscription for this
// person (e.g. after the move to per-user alert stores), quietly register it again.
/* Re-register this device if the server has lost it -- and, the case that used to
   loop forever in silence, make a *new* subscription when the push service has
   declared the old one dead. A 404 or 410 means that endpoint will never work again,
   so handing the same one back to the server just earns another 410 on the next rest.
   The phone kept saying On throughout. */
async function healAlerts(){
  if(!alertsOn()) return;
  try{
    const st=await api('GET','/push/status');
    const mine=LS.get('ob.push');
    const isDead=Array.isArray(st.dead)&&mine&&st.dead.includes(mine);
    if(st.devices&&!isDead) return;
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(sub&&(isDead||sub.endpoint===mine&&isDead)){
      try{ await sub.unsubscribe() }catch(e){}
      sub=null;
    }
    if(!sub){
      const {key}=await api('GET','/push/key');
      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)});
      pushNote('re-subscribed',true,'the old endpoint was rejected');
    }
    await api('POST','/push/subscribe',{subscription:sub.toJSON()});
    LS.set('ob.push',sub.endpoint);
  }catch(e){ pushNote('heal',false,e&&e.status?'HTTP '+e.status:(e&&e.message)||'failed') }
}
async function enableAlerts(){
  alerts.busy=true; alerts.msg=null; render();
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){alerts.msg=perm==='denied'?'Notifications are blocked. Turn them on in iOS Settings → Notifications → Operator.':'Notifications weren’t allowed. Tap Turn on again to retry.';return}
    const reg=await navigator.serviceWorker.ready, {key}=await api('GET','/push/key');
    let sub=await reg.pushManager.getSubscription();
    try{ if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)}) }
    catch(e){ if(sub) await sub.unsubscribe(); sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)}) }
    await api('POST','/push/subscribe',{subscription:sub.toJSON()});
    LS.set('ob.push',sub.endpoint); alerts.msg='Rest alerts are on for this device.'; showCover(); syncPush(); ivPush();
  }catch(e){ alerts.msg=e&&e.status?'The server refused the subscription ('+e.status+'). Try again.':'Couldn’t turn on alerts. Check your connection and try again.' }
  finally{ alerts.busy=false; render() }
}
async function disableAlerts(){
  alerts.busy=true; render();
  try{ const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription(); if(sub){ await api('POST','/push/unsubscribe',{endpoint:sub.endpoint}).catch(()=>{}); await sub.unsubscribe() } }catch(e){}
  LS.set('ob.push',null); alerts.msg='Rest alerts are off for this device.'; alerts.busy=false; showCover(); render();
}
/* What the server thinks, as against what this phone thinks. The two disagreeing is
   the whole of "alerts are on and nothing arrives": a device that unsubscribed itself,
   a queue that is empty because every schedule was refused, an alarm set for a time
   that has already gone by. `/push/status` has always returned it; nothing showed it. */
let pushStat=null;
// Deliberately not `async function`: the test harness exposes top-level declarations by
// scanning for `function name(`, so an async one is invisible to every test.
function checkAlerts(){
  pushStat={busy:true}; render();
  return api('GET','/push/status').then(
    r=>{ pushStat=Object.assign({at:Date.now()},r); render() },
    e=>{ pushStat={at:Date.now(),err:e&&e.status?'HTTP '+e.status:(e&&e.message)||'no answer'}; render() });
}
function pushStatusText(){
  const L=pushLast, S=pushStat, out=[];
  out.push('This phone: alerts '+(alertsOn()?'on':'off')+' \u00b7 '+alertsSupport()+' \u00b7 clock '+new Date().toISOString());
  out.push('Storage: '+storageNote());
  if(L) out.push('Last asked: '+L.what+' at '+hhmm(L.t)+' \u2014 '+(L.ok?'accepted':'REFUSED')+(L.d?' ('+L.d+')':''));
  else out.push('Last asked: nothing yet on this phone');
  if(S&&!S.busy) out.push(S.err?'Server: could not ask ('+S.err+')'
    :'Server: '+S.devices+' device'+(S.devices===1?'':'s')+' registered \u00b7 '+S.queued+' alert'+(S.queued===1?'':'s')+' queued \u00b7 '+(S.pendingAt?'next at '+hhmm(S.pendingAt):'no alarm set'));
  if(S&&S.lastSend) out.push('Last send: '+hhmm(S.lastSend.at)+' \u201c'+(S.lastSend.title||'')+'\u201d \u2014 '+
    ((S.lastSend.results||[]).map(r=>r.host+' '+r.status).join(', ')||'no devices to send to'));
  if(S&&Array.isArray(S.dead)&&S.dead.length) out.push('Rejected endpoints on file: '+S.dead.length);
  return out.join('\n');
}
function pushAdvice(){
  const L=pushLast, S=pushStat, out=[];
  if(!alertsOn()) out.push('Alerts are off on this phone. Turn them on above.');
  if(L&&!L.ok&&/400/.test(L.d)) out.push('The server refused the time. It only accepts alerts between now and two hours ahead, so this is almost always a phone clock that has drifted \u2014 check Settings \u2192 General \u2192 Date & Time \u2192 Set Automatically.');
  if(L&&!L.ok&&/401|403/.test(L.d)) out.push('You were signed out when the alert was scheduled. Open the app, sign in, and start the rest again.');
  if(L&&!L.ok&&/no answer|Failed|network/i.test(L.d)) out.push('The request never reached the server. If you train somewhere with no signal, the alert cannot be scheduled \u2014 the in-app beep is what you get.');
  if(S&&!S.busy&&!S.err&&S.devices===0) out.push('The server has no device registered for you, so there is nothing to push to. Turn alerts off and on again above.');
  if(S&&S.lastSend&&(S.lastSend.results||[]).some(r=>r.status===410||r.status===404))
    out.push('The push service rejected this phone\u2019s subscription as gone (410). That kills alerts dead while the app still says they are on. Reopening the app should now make a fresh one by itself; if it does not, turn alerts off and on again.');
  if(S&&S.lastSend&&(S.lastSend.results||[]).some(r=>String(r.status).startsWith('error')))
    out.push('The server could not reach the push service at all for the last alert. That is usually temporary.');
  if(S&&S.lastSend&&(S.lastSend.results||[]).some(r=>r.status===201||r.status===200))
    out.push('The last alert was accepted by Apple. If it did not appear, it is iOS deciding not to show it: Settings \u2192 Notifications \u2192 Operator, and check Focus modes.');
  if(S&&!S.busy&&!S.err&&S.devices>0&&S.queued===0&&rest&&!rest.done) out.push('A rest is running but the server has nothing queued for it. That is the bug \u2014 copy this and send it.');
  if(/FAILING/.test(storageNote())) out.push('This phone can no longer write to its own storage, which is enough on its own to stop alerts: the subscription lives there. Setup \u2192 About this app \u2192 clear the cache, or reinstall the home-screen app.');
  if(!out.length) out.push('Nothing here looks wrong. If an alert still did not arrive, it is iOS deciding not to show it: check Settings \u2192 Notifications \u2192 Operator, and that a Focus mode is not filtering it.');
  return out;
}
function pushReport(){
  return 'Operator + Black '+(typeof APP_VERSION==='string'?APP_VERSION:'')+' \u00b7 alerts\n'+
    (typeof navigator!=='undefined'?String(navigator.userAgent).slice(0,160):'')+'\n\n'+pushStatusText()+'\n\n'+pushAdvice().join('\n');
}
async function testAlert(){
  try{ await api('POST','/push/schedule',{at:Date.now()+8000,title:'Test alert',body:'Rest alerts work. This is what the end of a rest looks like.'}); alerts.msg='Test alert coming in 8 seconds. Lock your phone now to see it on the lock screen.' }
  catch(e){ alerts.msg='Couldn’t send the test. Check your connection.' }
  render();
}
/* ---------- what the server was last asked for, and what it said ----------
Every one of these calls ended in `.catch(()=>{})`. The intent was right -- a rest must
not fail because the network did -- but it meant a push that was never scheduled looked
exactly like one that was, and "the alerts don't work" had nothing behind it. The
outcome is recorded now and shown on the Rest alerts card.

The failure that bites in silence: the server refuses an alert whose time is already
past or more than two hours out, so a phone clock a few minutes slow earns a 400 on
every rest it ever schedules and never makes a sound. */
let pushLast=LS.get('ob.pushlast')||null;
function pushNote(what,ok,detail){
  pushLast={t:Date.now(),what,ok:!!ok,d:detail==null?'':String(detail)};
  LS.set('ob.pushlast',pushLast);
  tlog('push',what+' · '+(ok?'accepted':'refused'),detail);
}
function hhmm(t){ const d=new Date(+t); return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()) }
/** Schedule or cancel, recording the answer. Never throws: a rest survives a flat network. */
function pushCall(path,body,what){
  return api('POST',path,body).then(
    r=>{ pushNote(what,true,r&&r.next?'fires '+hhmm(r.next):(r&&r.scheduled!=null?r.scheduled+' queued':'')); return r },
    e=>{ pushNote(what,false,e&&e.status?'HTTP '+e.status:(e&&e.message)||'no answer'); return null });
}
let pushTimer=null;
function syncPush(){
  if(!alertsOn()) return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(()=>{
    if(rest&&!rest.done){
      const body=rest.next?'Next: '+rest.next.replace(/ · /g,', ')+'.':rest.lbl.replace(/^Rest · /,'')+' rest is over.';
      pushCall('/push/schedule',{at:rest.end,title:rest.lbl.startsWith('Rest before')?'Time for HIC':'Rest done',body},'rest alert');
    } else pushCall('/push/cancel',null,'cancel');
  },300);
}
function startHold(name,secs,sides,side){
  unlockAudio();
  rest={k:null,lbl:name,next:sides>1?(side<sides?'Switch sides':'Hold done'):'',end:Date.now()+secs*1000,dur:secs,done:false,hold:1,baseLbl:name,sides,side};
  LS.set('ob.rest',rest); syncScreen(); showRest(); syncPush();
}
function startRest(k,next,secs,lbl){
  secs=secs||restMins(k)*60;
  rest={k,lbl:lbl||'Rest · '+liftName(k),next,end:Date.now()+secs*1000,dur:secs,done:false};
  tlog('rest','started',secs+' s');
  LS.set('ob.rest',rest); syncScreen(); showRest(); syncPush();
}
function stopRest(){const was=rest&&!rest.done;rest=null;LS.set('ob.rest',null);clearInterval(restTick);restTick=null;syncScreen();showRest();if(was)syncPush()}
function showRest(){
  const el=document.getElementById('rest');
  showCover();
  if(!rest){el.hidden=true;document.body.classList.remove('timing');return}
  el.hidden=false;document.body.classList.add('timing');
  document.getElementById('rest-lbl').textContent=rest.lbl+(rest.sides>1?' · side '+rest.side+' of '+rest.sides:'');
  // A timer that cannot make a sound should say so, or it reads as broken.
  const q=document.getElementById('rest-quiet'); if(q) q.hidden=!quiet();
  showWake();
  if(!restTick) restTick=setInterval(tickRest,250);
  tickRest();
}
// Turning the sound back on from the timer itself, where you noticed it was off.
// A named function because the click handler cannot be reached from a test.
function unquiet(){
  // Back to sharing the speaker rather than seizing it: the tap means "let me hear it",
  // not "stop my music".
  setPlan('soundMode','duck');
  unlockAudio();
  showRest(); render();
}
function tickRest(){
  if(!rest) return;
  const el=document.getElementById('rest'), leftMs=rest.end-Date.now(), left=Math.max(0,Math.ceil(leftMs/1000));
  document.getElementById('rest-time').textContent=Math.floor(left/60)+':'+pad(left%60);
  document.getElementById('rest-fill').style.width=Math.min(100,Math.max(0,100*(1-leftMs/(rest.dur*1000))))+'%';
  document.getElementById('rest-next').textContent=left>0?(rest.next?'Next: '+rest.next:''):(rest.next?'Go: '+rest.next:'Rest done');
  document.getElementById('rest-stop').textContent=left>0?'Skip':'Done';
  el.classList.toggle('done',left===0);
  // The warning: a tone, and deliberately nothing spoken. Speech can interrupt the audio
  // channel on iOS, and a spoken "ten seconds" was the one sound between the tap that
  // started the rest and the beep that ends it -- so the end beep landed on a channel
  // speech had just parked, with no tap to wake it. Only on a rest at least twice the
  // warning, or a short one would announce itself the moment it began.
  if(restWarnDue(rest,left)){
    rest.warned=true; LS.set('ob.rest',rest); beepWarn(); tlog('rest','warning',left+' s left');
  }
  if(left===0&&!rest.done){
    // How late the tick noticed. Under a second is the timer working; a big number is
    // the screen having been asleep, which no in-app sound can beat.
    tlog('rest','over',Math.max(0,Math.round(-leftMs/100)/10)+' s late');
    rest.done=true;LS.set('ob.rest',rest);beep();syncScreen();
    if(rest.hold&&rest.sides>rest.side){ const r=rest; say('Switch sides'); setTimeout(()=>{ if(rest===r) startHold(r.baseLbl,r.dur,r.sides,r.side+1) },1200); }
    else setTimeout(()=>say(rest&&rest.hold?(rest.baseLbl+' done'):rest&&rest.next?'Rest over. '+rest.next.replace(' · ',', '):'Rest over.'),700);
  }
  // The same re-check the interval timer does: iOS lets the screen lock go mid-rest and
  // nothing used to take it back until the page was hidden and shown again.
  if(left>0) syncScreen();
  // clear a finished timer after two minutes if nobody dismisses it
  if(left===0&&leftMs<-120000) stopRest();
}
document.getElementById('rest').addEventListener('click',e=>{
  const b=e.target.closest('[data-rest]'); if(!b||!rest) return; const v=b.dataset.rest;
  if(v==='cover'){ coverTap(); return }
  if(v==='stop') return stopRest();
  if(v==='unquiet'){ unquiet(); return }
  unlockAudio();
  rest.end=Math.max(Date.now()+1000,rest.end+(+v)*1000); if(rest.end>Date.now()) rest.done=false;
  rest.dur=Math.max(rest.dur,Math.round((rest.end-Date.now())/1000));
  LS.set('ob.rest',rest); syncScreen(); tickRest(); syncPush();
});
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&rest){ syncScreen(); tickRest() } });
function nextAfterSet(k,sets){
  const wk=weekOf(sel), dp=dayPlan(sel); if(!wk||dp.t!=='lift') return null;
  const r=rx(wk,k), nSets=r.sMax;
  for(let i=0;i<nSets;i++) if(!sets[i]) return liftName(k)+' · set '+(i+1)+(i>=r.s?' (optional)':'');
  const li=dp.lifts.indexOf(k);
  for(let j=li+1;j<dp.lifts.length;j++){const s2=((lg(sel).lifts||{})[dp.lifts[j]]||{}).sets||[];if(!s2[0])return liftName(dp.lifts[j])+' · set 1'}
  return undefined; // nothing left: no rest needed
}

/* ---------- personal records ---------- */
// Lifetime bests across every program, computed from the log. Each record keeps the
// date it was set and the value it beat, so a new one can be called out on the day.
// Every record, across every log. It walks the whole history several times over, and
// one Today render used to ask for it eight times: weekRecap checks each of the week's
// seven days for a personal best, then prCard asks again. With a year of training that
// was 16 of the 19 ms it took to build the view, for a card of about a kilobyte.
// Cached against planV + logsV, the same way weeks() and maxFor() already are.
let prCache={v:null,list:null};
function prList(){
  const ver=planV+':'+logsV;
  if(prCache.v===ver) return prCache.list;
  const out=[], add=(key,label,unit,entries,fmt)=>{
    const xs=entries.filter(e=>e.v!=null&&!Number.isNaN(e.v)&&e.v>0).sort((a,b)=>a.d<b.d?-1:1);
    if(!xs.length) return;
    let best=null, prev=null;
    for(const e of xs){ if(!best||e.v>best.v){prev=best;best=e} }
    out.push({key,label,unit,value:best.v,date:best.d,prev:prev?prev.v:null,n:xs.length,fmt:fmt||(v=>n(v))});
  };
  // tested maxes, per lift
  for(const k of activeLifts()){
    const xs=[];
    for(const [d,L] of Object.entries(logs)){
      const t=(L.test||{})[k]; if(!t||t.w==null||t.w==='') continue;
      const e=estMax(k,t.w,t.r||(dayPlan(d).t==='rm5'?5:1),d);
      if(e!=null) xs.push({d,v:floorTo(e,plan.round[k])});
    }
    add('lift:'+k,esc(liftName(k))+' 1RM',u(),xs,v=>(isBW(k)?'+':'')+n(v));
  }
  add('pullups','Max pull-ups','reps',Object.entries(logs).map(([d,L])=>({d,v:+L.pullups})));
  for(const [f,lbl] of [['broad','Broad jump'],['vertical','Vertical jump'],['triple','Standing triple jump']]){
    add('jump:'+f,lbl,'in',Object.entries(logs).map(([d,L])=>({d,v:+((L.jumps||{})[f]||(f==='broad'?((L.plyo||{}).best||(L.plyo||{}).mark):0))})));
  }
  // conditioning: best per activity and format, hard sessions only
  const g={};
  for(const x of hicSessions(true)){ if(x.f==='liss'||x.v==null) continue; (g[x.mod+'|'+x.f]=g[x.mod+'|'+x.f]||[]).push({d:x.d,v:x.v,u:x.u}) }
  for(const key of Object.keys(g)){
    const [m,f]=key.split('|');
    add('hic:'+key,MOD[m].name+' · '+HIC[f].name,g[key][0].u,g[key]);
  }
  prCache={v:ver,list:out};
  return out;
}
// Records set on this date (the day something became a best, with a previous value to beat).
function prsOn(date){return prList().filter(r=>r.date===date&&r.prev!=null)}
function prCard(date){
  const hits=prsOn(date); if(!hits.length) return '';
  return `<div class="card pr"><div class="lift-h"><h3>New personal best${hits.length>1?'s':''}</h3><span class="chip light">PR</span></div>
  ${hits.map(r=>`<div class="pr-row"><span>${r.label}</span><span class="pr-v">${r.fmt(r.value)}<small> ${esc(r.unit)}</small></span><span class="small muted">was ${r.fmt(r.prev)}</span></div>`).join('')}</div>`;
}
// Where you are on the pull-up road, from the best set you have logged. Max-rep sets are
// logged on test days (`pullups`); weighted work shows up as the `wpu` max.
function pullupState(date){
  let best=null, xs=[];
  for(const [d,L] of Object.entries(logs)){
    if(d>date||!inProgram(d)||!L.pullups) continue;
    xs.push({d,v:+L.pullups});
    if(!best||+L.pullups>best.v||(+L.pullups===best.v&&d>best.d)) best={d,v:+L.pullups};
  }
  xs.sort((a0,b0)=>a0.d<b0.d?-1:1);
  const wpu=(plan.maxes||{}).wpu, bw=bwFor(date);
  const reps=best?best.v:0, i=pullupStage(reps), st=PULLUP[i], nextSt=PULLUP[i+1]||null;
  const togo=nextSt?Math.max(0,nextSt.at-reps):0;
  return {best,xs,stage:i,st,next:nextSt,togo,reps,wpu:wpu!=null&&wpu!==''?+wpu:null,bw,
    pct:bw&&wpu?Math.round(+wpu/bw*100):null};
}
function pullupCard(date){
  const p=pullupState(date);
  if(!p.best&&!p.wpu) return `<div class="card"><h3>Pull-ups</h3><p class="note" style="margin:0">Log one all-out set on a test day \u2014 full hang to chin over bar \u2014 and this maps out the road from there to a weighted pull-up.</p></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Pull-ups</h3><span class="chip ${p.stage>=3?'light':''}">${esc(p.st.name)}</span></div>`;
  // The best set measured against the next rung: the B shape exactly, reps over target.
  h+=`<div class="mbs">`;
  h+=!p.best?bRow({label:'Best set',value:'—',sub:'Not tested yet'})
    :p.next?bRow({label:'Best set',value:p.best.v,of:p.next.at,unit:'reps',pct:100*p.best.v/p.next.at,
        tone:p.togo?'muted':'ok',word:p.togo?`${p.togo} more to ${p.next.name.toLowerCase()}`:'Rung reached — move up',
        sub:fmtD(p.best.d,true),aria:`${p.best.v} of the ${p.next.at} reps the next rung needs`})
      :bRow({label:'Best set',value:p.best.v,unit:'reps',tone:'ok',word:'Top of the ladder',sub:fmtD(p.best.d,true)});
  if(p.wpu!=null) h+=bRow({label:'Added weight',value:'+'+n(p.wpu),unit:u(),sub:p.pct?`${p.pct}% of bodyweight`:''});
  h+=`</div>`;
  h+=`<div class="small"><b>Now:</b> ${esc(p.st.work)}</div><div class="note">${esc(p.st.why)}</div>`;
  if(p.next) h+=`<div class="small muted"><b>Next:</b> ${esc(p.next.next===undefined?'':p.st.next)}</div>`;
  if(p.xs.length>=2) h+=lineChart(p.xs.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${x.v} reps`})),{label:'Max pull-ups',min:0,minStep:1,tick:fmtWhole});
  h+=`<details class="plain"><summary>The whole road</summary><div class="stack small" style="margin-top:8px">${PULLUP.map((s0,i)=>`<div class="${i===p.stage?'':'muted'}"><b>${i===p.stage?'\u2192 ':''}${esc(s0.name)}</b>${s0.at?` <span class="mono">${s0.at}+ reps</span>`:' <span class="mono">0 reps</span>'}<div>${esc(s0.work)}</div></div>`).join('')}</div></details>`;
  return h+`</div>`;
}
function prBoard(){
  const rs=prList();
  if(!rs.length) return `<div class="card"><h3>Personal records</h3><div class="empty">Nothing tested yet. Bests from test days, jumps, pull-ups and conditioning land here.</div></div>`;
  return `<div class="card"><div class="lift-h"><h3>Personal records</h3><span class="small muted">All programs</span></div>
  <div class="tbl-wrap"><table><thead><tr><th>Record</th><th class="n">Best</th><th class="n">Set</th><th class="n">Gain</th></tr></thead><tbody>
  ${rs.map(r=>`<tr><td>${r.label}</td><td class="n"><b>${r.fmt(r.value)}</b> <span class="muted">${esc(r.unit)}</span></td><td class="n small">${fmtD(r.date,true)}</td><td class="n small">${r.prev!=null?`<span class="chip light">+${n(Math.round((r.value-r.prev)*10)/10)}</span>`:'<span class="muted">first</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}

/* ---------- week summary ---------- */
// At the start of a new week: how last week went, then what this one holds. Shown until
// dismissed (plan.weekSeen keeps the last Monday that was cleared).
function weekRecap(mon){
  let done=0, tot=0; const prs=[], rd=[];
  for(let i=0;i<7;i++){
    const d=addDays(mon,i), p=dayPlan(d);
    if(!['off','pre','convert'].includes(p.t)){tot++; if(lg(d).done) done++}
    const r=readiness(ci(d)); if(r!=null) rd.push(r);
    prs.push(...prsOn(d));
  }
  const end=addDays(mon,6);
  const hics=hicSessions(true).filter(x=>x.d>=mon&&x.d<=end&&x.v!=null);
  const avg=rd.length?Math.round(rd.reduce((a,b)=>a+b,0)/rd.length):null;
  return {done,tot,prs,avg,hics,mon,end};
}
// The weekly check-in: measurements, once a week, at the start of the training week.
// They are a weekly number, so asking for them in the daily check-in made them easy to
// skip and easy to over-log. This stays up all week until it has been filled in.
function weeklyCard(){
  if(viewing||sel!==todayStr()) return '';
  const t=todayStr(), mon=mondayOf(t);
  if(!weekOf(mon)) return '';
  const unit=u()==='kg'?'cm':'in';
  // anything logged this week counts as done, whichever day it went in on
  let today=(lg(t).meas)||{}, thisWeek=null;
  for(let i=0;i<7;i++){const d=addDays(mon,i),L=lg(d);if(L.meas&&L.meas.waist&&L.meas.neck){thisWeek={d,m:L.meas};break}}
  const prev=measBefore(mon), bfNow=thisWeek?navyBf(thisWeek.m,thisWeek.d):null, bfPrev=prev?navyBf(prev.m,prev.d):null;
  const f=(k,l)=>`<label class="f">${l} <small>(${unit})</small>${numIn('meas.'+k,today[k],prev&&prev.m[k]!=null?String(prev.m[k]):'')}</label>`;
  const since=prev?Math.round((D(mon)-D(prev.d))/864e5):null;
  const body=()=>`<p class="note" style="margin:0">Measurements once a week, same time of day, relaxed: waist at the navel, neck below the larynx, hips at the widest point.</p>
  <div class="grid3">${f('neck','Neck')}${f('waist','Waist')}${f('hip','Hips')}</div>`
    +(navyBf(today,t)!=null?`<div class="small">That puts you at <b class="mono">${r1(navyBf(today,t))}%</b> body fat${bfPrev!=null?`, ${navyBf(today,t)<bfPrev?'down':navyBf(today,t)>bfPrev?'up':'level'} ${navyBf(today,t)===bfPrev?'':r1(Math.abs(navyBf(today,t)-bfPrev))+' points '}since ${fmtD(prev.d)}`:''}.</div>`
      :!plan.height||!plan.sex?`<div class="note">Add your height and sex in Setup \u2192 About you and these turn into a body-fat estimate. They are worth tracking either way.</div>`
      :today.waist||today.neck?`<div class="small muted">Neck and waist both needed for the estimate${plan.sex==='f'?', plus hips':''}.</div>`:'');

  // Done for the week: a header you can fold away. It opens by default on the day you
  // filled it in (openPx is seeded below while the form is still showing) and stays shut
  // once you close it, including on later days.
  if(thisWeek){
    const dw=bfNow!=null&&bfPrev!=null?bfNow-bfPrev:null, sameDay=thisWeek.d===t;
    return `<details class="plain card" data-px="wkmeas"${openPx.has('wkmeas')?' open':''}><summary><b>Weekly check-in</b> \u00b7 done ${fmtD(thisWeek.d,true)}${bfNow!=null?` \u00b7 ${r1(bfNow)}% body fat`:''}</summary>
    <div class="stack" style="gap:10px;margin-top:10px"><div class="small muted">Waist ${r1(thisWeek.m.waist)} ${unit}, neck ${r1(thisWeek.m.neck)}${thisWeek.m.hip?`, hips ${r1(thisWeek.m.hip)}`:''}.${dw!=null?` ${dw<0?'Down':dw>0?'Up':'Level'} ${dw?r1(Math.abs(dw))+' points':''} since ${fmtD(prev.d)}.`:''} Charts are on Status.</div>
    ${sameDay?body():`<div class="small muted">Logged ${fmtD(thisWeek.d,true)}. Measuring again today records a second set \u2014 the charts take them all.</div>${body()}`}</div></details>`;
  }
  openPx.add('wkmeas');          // so it is open at the moment it gets filled in
  return `<div class="card"><div class="lift-h"><h3>Weekly check-in</h3><span class="small muted">${prev?`last ${fmtD(prev.d,true)}${since?` \u00b7 ${since} days ago`:''}`:'first one'}</span></div>${body()}</div>`;
}
function weekSummaryCard(){
  if(viewing||sel!==todayStr()) return '';
  const mon=mondayOf(todayStr()), last=addDays(mon,-7);
  if((plan.weekSeen||'')===mon) return '';
  if(idxOf(last)<0) return '';                       // no previous week in this program
  const r=weekRecap(last);
  if(!r.tot&&!r.prs.length) return '';
  const wk=weekOf(mon), wt=wk?weekTitle(wk):null;
  const ahead=[];
  // "Accessories are off" was the same invented rule the card used to state. What the
  // week ahead can honestly say is what the book says: judge them by the main lifts.
  if(wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy') ahead.push('A heavy week: singles or doubles near the top. Accessories still run \u2014 cut them back if they start costing you the main lifts.');
  if(wk&&wk.kind==='deload') ahead.push('A deload: easy lifting, steady conditioning, half the plyo contacts.');
  if(wk&&wk.kind==='test') ahead.push('Retest week: three easy days, then heavy singles.');
  if(wk&&wk.kind==='cycle') ahead.push('Plyos: '+plyoPhase(wk).name+'.');
  const nd=nextScheduled('deload'), nt=nextScheduled('test');
  let h=`<div class="card"><div class="lift-h"><h3>Your week</h3><button class="btn sm ghost" data-act="weekseen">Dismiss</button></div>
  <div class="small muted">Last week · ${fmtD(r.mon)}–${fmtD(r.end)}</div>
  <div class="mbs">${bRow({label:'Sessions',value:r.done,of:r.tot,pct:r.tot?100*r.done/r.tot:0,
    tone:!r.tot?'muted':r.done>=r.tot?'ok':(r.tot-r.done)<=MISS_GRACE?'warn':'off',
    word:!r.tot?'':r.done>=r.tot?'Every one':`${r.tot-r.done} missed`,aria:`${r.done} of ${r.tot} sessions last week`})}
  ${r.avg!=null?bRow({label:'Readiness',value:r.avg,of:100,pct:r.avg,tone:readyTone(r.avg).tone,word:readyTone(r.avg).word,aria:`Readiness ${r.avg} of 100`})
    :bRow({label:'Readiness',value:'—',sub:'No check-ins'})}
  ${bRow({label:'Bests set',value:r.prs.length,sub:r.prs.length?esc(r.prs.map(x=>x.label).join(', ')):'None last week'})}</div>`;
  if(r.hics.length) h+=`<div class="small muted">Conditioning: ${r.hics.map(x=>`${MOD[x.mod].name} ${HIC[x.f].name} ${n(x.v)} ${esc(x.u)}`).join(' · ')}</div>`;
  h+=`<div style="border-top:1px solid var(--line);padding-top:10px"><b>This week</b>${wt?` · ${esc(wt.t)} <span class="chip ${wt.cls}">${esc(wt.chip)}</span>`:''}</div>`;
  if(ahead.length) h+=`<ul class="tight small">${ahead.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  h+=`<div class="small muted">${esc(nd)} ${esc(nt)}</div></div>`;
  return h;
}

/* ---------- status dashboard ---------- */
function lineChart(pts,o){
  o=o||{};
  const W=300,H=118,L=36,R=40,T=10,B=22, iw=W-L-R, ih=H-T-B;
  const ys=pts.map(p=>p.y).concat(pts.filter(p=>p.y2!=null).map(p=>p.y2));
  let lo=o.min!=null?o.min:Math.min(...ys), hi=o.max!=null?o.max:Math.max(...ys);
  if(hi===lo){hi+=Math.max(1,Math.abs(hi)*.05);lo-=Math.max(1,Math.abs(lo)*.05)}
  if(o.min==null||o.max==null){const pad=(hi-lo)*.15;if(o.min==null)lo-=pad;if(o.max==null)hi+=pad}
  const step=Math.max(nice((hi-lo)/3),o.minStep||0); lo=Math.floor(lo/step)*step; hi=Math.ceil(hi/step)*step;
  const x=i=>L+(pts.length===1?iw/2:i*iw/(pts.length-1)), y=v=>T+ih-(v-lo)/(hi-lo)*ih;
  let g='';
  const tk=o.tick||fmtTick;
  for(let v=lo;v<=hi+1e-9;v+=step){const yy=y(v).toFixed(1);g+=`<line class="ch-grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text class="ch-ax" x="${L-6}" y="${(+yy+3.5).toFixed(1)}" text-anchor="end">${tk(v)}</text>`}
  const solid=pts.filter(p=>!p.hollow);
  const lastSolid=pts.length-1-[...pts].reverse().findIndex(p=>!p.hollow);
  const seg=(a,b)=>pts.slice(a,b+1).map((p,j)=>(j?'L':'M')+x(a+j).toFixed(1)+' '+y(p.y).toFixed(1)).join(' ');
  const path=seg(0,lastSolid), proj=lastSolid<pts.length-1?`<path class="ch-line" stroke-dasharray="4 4" d="${seg(lastSolid,pts.length-1)}"/>`:'';
  const area=solid.length>1?`<path class="ch-area" d="M${x(0).toFixed(1)} ${(T+ih)} ${pts.slice(0,lastSolid+1).map((p,i)=>'L'+x(i).toFixed(1)+' '+y(p.y).toFixed(1)).join(' ')} L${x(lastSolid).toFixed(1)} ${T+ih} Z"/>`:'';
  const xl=`<text class="ch-ax" x="${x(0)}" y="${H-5}" text-anchor="${pts.length===1?'middle':'start'}">${esc(pts[0].xl)}</text>`+(pts.length>1?`<text class="ch-ax" x="${x(pts.length-1)}" y="${H-5}" text-anchor="end">${esc(pts[pts.length-1].xl)}</text>`:'');
  const dense=pts.length>16;
  const dots=pts.map((p,i)=>dense&&i!==pts.length-1?'':`<circle class="ch-pt${p.hollow?' hollow':''}" cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="4"/>`).join('');
  const hits=pts.map((p,i)=>`<circle class="ch-hit" tabindex="0" cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="12" data-tip="${esc(p.tip)}"><title>${esc(p.tip)}</title></circle>`).join('');
  // the raw series, when there is one: faint dots behind the line they average into
  const has2=pts.some(p=>p.y2!=null);
  const raw2=has2?`<path class="ch-line2" d="${pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.y2!=null?p.y2:p.y).toFixed(1)).join(' ')}"/>`+pts.map((p,i)=>p.y2==null?'':`<circle class="ch-pt2" cx="${x(i).toFixed(1)}" cy="${y(p.y2).toFixed(1)}" r="${dense2(pts)}"/>`).join(''):'';
  const e=pts[pts.length-1], end=`<text class="ch-end" x="${(x(pts.length-1)+8).toFixed(1)}" y="${(y(e.y)+4).toFixed(1)}">${esc(o.endLabel?o.endLabel(e):tk(e.y))}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'')}">${g}${area}${raw2}<path class="ch-line" d="${path}"/>${proj}${dots}${xl}${end}${hits}</svg>`;
}
function dense2(pts){return pts.length>40?1.4:pts.length>20?1.8:2.4}
function r1(v){return String(Math.round(v*10)/10)}
function nice(r){const e=Math.pow(10,Math.floor(Math.log10(r||1))),f=r/e;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e}
function fmtTick(v){return Math.abs(v)>=1000?(Math.round(v/100)/10)+'k':String(Math.round(v*10)/10)}
function fmtWhole(v){return String(Math.round(v))}
function sessState(d,t){const p=dayPlan(d);if(['off','pre','convert'].includes(p.t))return 'rest';if(lg(d).done)return 'done';if(d<t)return 'missed';if(d===t)return 'today';return 'upcoming'}
// Minutes per conditioning session. Only LISS asks you for minutes, so for everything
// else this is the session the timer would run: warm-up, rounds, rest and cool-down.
function hicMinutes(x){
  if(x.min!=null&&x.min!=='') return {m:+x.min,logged:true};
  const o=ivOpts(x.d,x.f); return {m:Math.round(ivTotal(ivSegments(x.f,o))/60),logged:false};
}
// Conditioning minutes per week, oldest first, for the last n weeks up to this one.
function condWeeks(n0){
  const t=todayStr(), mon=mondayOf(t), start=mondayOf(plan.startMonday), by={};
  for(const x of hicSessions()){
    const m=mondayOf(x.d); if(!by[m]) by[m]={min:0,n:0,est:0};
    const r=hicMinutes(x); by[m].min+=r.m; by[m].n++; if(!r.logged) by[m].est++;
  }
  const out=[];
  for(let i=n0-1;i>=0;i--){ const m=addDays(mon,-7*i); if(m<start) continue; out.push(Object.assign({mon:m,min:0,n:0,est:0},by[m])) }
  return out;
}
// What a logged work set implies about the max. In Operator the weight is computed FROM
// the max, so a set done exactly as prescribed only restates it: this says something new
// when you logged a different weight, or when a heavy set ground.
function heavySet(k){
  let best=null;
  for(const [d,L] of progLogs()){
    const x=(L.lifts||{})[k]; if(!x||!Array.isArray(x.sets)||!x.sets.some(Boolean)) continue;
    const wk=weekOf(d); if(!wk||wk.kind!=='cycle') continue;
    const v=rx(wk,k); if(!v.m||v.p<85) continue;
    const used=x.used!=null&&x.used!==''?+x.used:loadFor(k,v.m.v,v.p,d);
    const e=estMax(k,used,v.r,d); if(e==null) continue;
    if(!best||e>best.e) best={e,w:used,r:v.r,p:v.p,d,max:v.m.v,grinder:ground(x),off:x.used!=null&&x.used!==''};
  }
  return best;
}
// Twelve weeks of sessions as a grid: one row per week, one cell per day. The same
// states the week dots use, so a missed day looks the same in both places.
function heatmap(t,n0){
  const mon=mondayOf(t), start=mondayOf(plan.startMonday), rows=[];
  for(let i=n0-1;i>=0;i--){ const m=addDays(mon,-7*i); if(m>=start) rows.push(m) }
  if(!rows.length) return '';
  let h=`<div class="heat-h"><span class="small muted">Last ${rows.length} week${rows.length>1?'s':''}</span><span class="heat-key">${[['done','done'],['missed','missed'],['rest','rest day']].map(([c,l])=>`<span><i class="${c}"></i>${l}</span>`).join('')}</span></div><div class="heat" role="img" aria-label="Sessions over the last ${rows.length} weeks">`;
  h+=`<span></span>${DAYN.map(d=>`<span class="heat-d">${d[0]}</span>`).join('')}`;
  for(const m of rows){
    const wk=weekOf(m), lbl=wk?(wk.kind==='cycle'?'C'+wk.cycle+'W'+wk.w:wk.kind==='bridge'?'Br':wk.kind==='deload'?'DL':wk.kind==='test'?'RT':wk.kind==='travel'?'Tr':'Off'):'';
    h+=`<span class="heat-w">${esc(lbl)}</span>`;
    for(let i=0;i<7;i++){
      const d=addDays(m,i), st=d<start?'pre':sessState(d,t), p=dayPlan(d);
      h+=`<i class="${st}" title="${esc(fmtD(d,true)+' · '+(p.short||'')+' · '+(st==='pre'?'before the start':st))}"></i>`;
    }
  }
  return h+`</div>`;
}
// Bodyweight: every weigh-in, and the 7-day average they feed. The average is the line
// you act on — a single reading moves with water, food and the time of day — so it is the
// solid one and the weigh-ins sit behind it.
const BWR={30:'30 days',90:'90 days',all:'All'};
function bwRange(){const v=LS.get('ob.bwRange');return BWR[v]?v:90}
function bwSeries(t){
  const r=bwRange(), from=r==='all'?plan.startMonday:addDays(t,-(+r-1));
  const xs=progLogs().filter(([d,L])=>d>=from&&d<=t&&L.checkin&&L.checkin.bw!=null&&L.checkin.bw!=='')
    .map(([d,L])=>({d,raw:+L.checkin.bw})).sort((a,b)=>a.d<b.d?-1:1);
  return xs.map(x=>{const a=bwAvg(x.d,7);return {d:x.d,v:a?a.avg:x.raw,raw:x.raw,n:a?a.n:1}});
}
function bwCard(t){
  const xs=bwSeries(t), r=bwRange(), rate=bwRate(t,14);
  const seg=`<div class="restsel"><span>Range</span><div class="seg">${Object.entries(BWR).map(([k,l])=>`<button class="segb${k===r?' on':''}" data-act="bwrange" data-v="${k}" aria-pressed="${k===r}">${l}</button>`).join('')}</div></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Bodyweight</h3><span class="small muted">Every weigh-in, and the 7-day average</span></div>${seg}`;
  if(xs.length<2) return h+`<div class="none">${xs.length?'One weigh-in in this range. The average needs a few days.':'Log your weight in the daily check-in and it charts here.'}</div></div>`;
  const first=xs[0], last=xs[xs.length-1];
  const k0=Math.min(7,Math.floor(xs.length/2)), mean=a0=>a0.reduce((x,y)=>x+y.raw,0)/a0.length;
  const ch=k0>=2?mean(xs.slice(-k0))-mean(xs.slice(0,k0)):last.raw-first.raw;
  const days=Math.round((D(last.d)-D(first.d))/864e5)+1, logged=xs.length;
  // A weekly change inside a fifth of a pound (a tenth of a kilo) counts as holding.
  const wk=rate?trendTone(rate.perWeek,u()==='kg'?0.1:0.2):{tone:'muted',word:''};
  h+=`<div class="mbs">`;
  h+=bRow({label:'7-day average',value:r1(last.v),unit:u(),sub:`Latest weigh-in ${r1(last.raw)}`});
  h+=rate?bRow({label:'Per week',value:(rate.perWeek>0?'+':'')+r1(rate.perWeek),unit:u(),tone:wk.tone,word:wk.word,sub:`Over the last ${rate.back} days`})
    :bRow({label:'Per week',value:'\u2014',sub:'Needs two weeks of weigh-ins'});
  h+=bRow({label:'Over this range',value:(ch>0?'+':'')+r1(ch),unit:u(),sub:`${fmtD(first.d)} to ${fmtD(last.d)}${k0>=2?` \u00b7 first ${k0} vs last ${k0}`:''}`});
  h+=`</div>`;
  h+=lineChart(xs.map(x=>({y:x.v,y2:x.raw,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: weighed ${r1(x.raw)}, ${r1(x.v)} average${x.n>1?' of '+x.n:''}`})),{label:'Bodyweight, daily and 7-day average',minStep:1});
  h+=`<div class="note">Weighed on ${logged} of the last ${days} day${days===1?'':'s'}. The faint line is each weigh-in; the solid one is the 7-day average, which is what the protein target, the weighted pull-up loads and the trend advice use.</div>`;
  return h+`</div>`;
}
// What you burn and what you are made of. The measured number comes from your own
// intake and scale trend; the formula is only there until that exists.
/* What a macro was, on the day it was eaten. Grams are logged the morning after, in
   the same check-in as the calories, so they belong to the day before -- the same
   offset `kcalOn` applies and for the same reason. */
function macroOn(d,f){ const v=ci(addDays(d,1))[f]; return v==null||v===''?null:+v }
function macroMean(t,days){
  const got={p:[],c:[],f:[]}, key={p:'proG',c:'carbG',f:'fatG'};
  for(let i=days-1;i>=0;i--){ const d=addDays(t,-i);
    for(const k of ['p','c','f']){ const v=macroOn(d,key[k]); if(v!=null) got[k].push(v) } }
  const mean=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;
  return {p:mean(got.p),c:mean(got.c),f:mean(got.f),days:Math.max(got.p.length,got.c.length,got.f.length)};
}
/* The windows worth averaging over, and how many days back each one reaches.

   `logged` is the days in the window that actually have grams, which is the number
   that makes an average honest: four days entered out of a fourteen-day window is a
   different claim from fourteen out of fourteen, and the card has to say which. */
let macroWin='week';
const MACRO_WINS=[['week','This week'],['14','14 days'],['cycle','This block']];
function setMacroWin(v){ if(!MACRO_WINS.some(([k])=>k===v)) return false; macroWin=v; return true }
function macroWinDays(t){
  if(macroWin==='14') return 14;
  if(macroWin==='cycle'){
    const wk=weekOf(t);
    if(wk&&wk.kind==='cycle'){
      // Back to the first week of this cycle, however many weeks in we are.
      const back=(wk.w-1)*7+dow(t)+1;
      return Math.max(1,Math.min(back,70));
    }
    return 7+dow(t)+1;
  }
  return dow(t)+1;                      // Monday to today
}
function macroWinLabel(t){
  const d=macroWinDays(t);
  if(macroWin==='week') return d===1?'today':`the ${d} days since Monday`;
  if(macroWin==='14') return 'the last 14 days';
  return `the ${d} days of this block so far`;
}
/* The book's answer to a scale that will not move: "If you're not putting on weight
   after a month or two, add another 500 calories per day using the same ratio."
   Only offered on real evidence -- a fortnight of weigh-ins going the wrong way --
   because a week of noise is not a stall. */
function macroAdvice(t){
  // Only the two goals that have a direction. Holding steady is the goal being met,
  // so there is nothing to say -- which the two tests below fall through to.
  const g=macroGoal();
  const r=bwRate(t,14); if(!r) return null;
  const per=u()==='kg'?r.perWeek*2.2046:r.perWeek;
  if(g==='gain'&&per<0.25) return {dir:1,per,
    text:'The scale has not moved in a fortnight. The book’s answer is another 500 calories a day in the same ratio — then give it a month before judging it again.'};
  if(g==='lose'&&per>-0.25) return {dir:-1,per,
    text:'Weight is holding rather than coming down. Five hundred calories a day off the target is the usual next step — ours, not the book’s, which only covers building.'};
  return null;
}
/* Whether the "where these numbers come from" note is showing.

   In JS, not a <details>: open state kept in the DOM does not survive a render, which
   is the rule the mobility panels already encode. morph() preserves a node, but it
   also syncs attributes, so an `open` the render does not know about would be stripped
   off anyway. */
let macroWhy=false;
function setMacroWhy(v){ macroWhy=!!v; return macroWhy }
/* Treatment B (3.32): eaten is the headline, the target its caption, because eaten is
   the number that changes from day to day. A bar per macro, so short or on target reads
   before anything is read. And the verdict stays in words beside the bar -- color alone
   cannot be the only way a thing is said (WCAG 1.4.1), and "40 short" is still the
   answer to the question the card is asked. */
function macroTone(target,avg){
  if(avg==null) return {tone:'muted',word:'none logged'};
  const gap=avg-target, near=Math.abs(gap)<=Math.max(5,target*0.05);
  if(near) return {tone:'ok',word:'On target'};
  return gap<0?{tone:'off',word:`${Math.abs(gap)} short`}:{tone:'over',word:`${gap} over`};
}
/* Treatment B, for any number, so every card says it the same way (3.33).

   The value that changes is the big number. What it is measured against is its caption.
   A bar when there is a target to fill toward -- and only then: a bar without a target
   would be inventing one. The verdict in words as well as color, never color alone
   (WCAG 1.4.1). A quiet line underneath for where the number came from.

   tone: ok green, off red, over / warn yellow, muted grey. */
function bRow({label,value,unit='',of=null,pct=null,tone='muted',word='',sub='',aria=''}){
  const cap=(of!=null?' / '+of:'')+(unit?' '+unit:'');
  return `<div class="mb">
    <div class="mb-h"><span class="mb-l">${esc(label)}</span><span><span class="mb-n">${value}</span>${cap?`<span class="mb-t">${esc(cap)}</span>`:''}</span></div>
    ${pct!=null?`<div class="mb-bar" role="img" aria-label="${esc(aria||label)}"><i class="${tone}" style="width:${Math.max(0,Math.min(100,Math.round(pct)))}%"></i></div>`:''}
    ${word?`<div class="mb-v ${tone}">${esc(word)}</div>`:''}${sub?`<div class="small muted">${sub}</div>`:''}
  </div>`;
}
// A readiness score in the same three tones as everything else.
function readyTone(sc){ const lv=rLevel(sc); return lv?{tone:lv.k==='go'?'ok':lv.k==='care'?'warn':'off',word:lv.t}:{tone:'muted',word:'No check-ins'} }
/* Which way a trend should go, by the goal set in Setup -- losing fat wants it down,
   building wants it up, maintaining wants it flat. Ours: the books set no weekly rate,
   and `flat` is the band inside which a reading counts as holding. */
function trendTone(delta,flat){
  const want=plan.goal==='lose'?-1:plan.goal==='gain'?1:0;
  if(delta==null) return {tone:'muted',word:''};
  const dir=Math.abs(delta)<=flat?0:Math.sign(delta);
  const verb={'-1':'Losing','0':'Holding','1':'Gaining'}[dir];
  if(dir===want) return {tone:'ok',word:verb+', as planned'};
  if(want===0) return {tone:'warn',word:verb};
  if(dir===0) return {tone:'warn',word:`Holding — the goal is to ${want>0?'build':'lose fat'}`};
  return {tone:'off',word:`${verb} while ${want>0?'building':'cutting'}`};
}
// Body fat wants to come down while cutting and hold otherwise. Half a point either way
// counts as holding: the tape method is only good to a few points. One rule, read by
// the Energy card and the cycle report alike.
function bfTone(db){
  if(db==null) return {tone:'muted',word:''};
  if(plan.goal==='lose') return trendTone(db,0.5);
  return Math.abs(db)<=0.5?{tone:'ok',word:'Holding'}:db<0?{tone:'ok',word:'Coming down'}:{tone:'warn',word:'Creeping up'};
}
function macroRow(lbl,target,avg){
  const {tone,word}=macroTone(target,avg);
  return bRow({label:lbl,value:avg==null?'—':avg,of:target,unit:'g',
    pct:avg==null||!target?0:100*avg/target,tone,word,
    aria:`${lbl}: ${avg==null?'none logged':avg+' of '+target+' grams'}`});
}
function macroCard(t){
  const tgt=macroTarget(t), got=macroMean(t,macroWinDays(t));
  const lb=bwLb(t);
  let h=`<div class="card"><div class="lift-h"><h3>Macros</h3>${tgt?`<span class="chip ${tgt.src==='tb3'?'light':''}">${tgt.src==='tb3'?'TB III':'Ours'}</span>`:''}</div>`;
  if(!lb) return h+`<p class="small muted" style="margin:0">Log your bodyweight in the daily check-in and a target appears here.</p></div>`;
  if(!tgt) return h+`<p class="note" style="margin:0">A target for ${esc(macroGoal()==='lose'?'losing':'holding')} needs your daily burn first, which needs your height and age in Setup, or a few weeks of calories and weigh-ins.</p></div>`;

  h+=`<div class="seg wide">${MACRO_WINS.map(([v,l])=>`<button class="segb${macroWin===v?' on':''}" data-act="macrowin" data-v="${v}" aria-pressed="${macroWin===v}">${esc(l)}</button>`).join('')}</div>`;
  h+=`<div class="mbs">`;
  for(const [k,lbl] of [['p','Protein'],['c','Carbs'],['f','Fat']]) h+=macroRow(lbl,tgt[k],got[k]);
  h+=`</div>`;
  h+=`<div class="mtot"><span class="small muted">Calories a day</span><span class="mono">${n(tgt.kcal)}${tgt.bump?` <span class="small muted">incl. ${tgt.bump>0?'+':''}${tgt.bump*MACRO_STEP}</span>`:''}</span></div>`;
  // Out from behind the disclosure: which days the big numbers are averages of is what
  // makes them readable, and it was the thing asked about in the first place.
  h+=`<div class="note">${got.days
    ?`Averages of days already eaten — ${got.days} of ${esc(macroWinLabel(t))}.${got.days<macroWinDays(t)/2?' Too few to read much into.':''} Today’s grams go in tomorrow’s check-in.`
    :`Nothing logged over ${esc(macroWinLabel(t))}. The three boxes are in the daily check-in, under yesterday\u2019s eating \u2014 they are for the day before, so today\u2019s go in tomorrow.`}</div>`;
  h+=`<div><button class="linkb" data-act="macrowhy" aria-expanded="${macroWhy}">Where these numbers come from</button>`;
  if(macroWhy) h+=`<div class="note" style="margin-top:6px">${tgt.src==='tb3'
    ?`The book’s formula for building: bodyweight × 1.3 for protein, × 2 for carbs, half for fat.`
    :`Protein and a fat floor off your bodyweight, carbohydrate taking the rest of the target. The books do not cover ${macroGoal()==='lose'?'losing':'holding'}, so these are ours.`}</div>`;
  return h+`</div></div>`;
}
/* The advice is its own card, with the action as a full-width button: something to do
   reads differently from something to know, and inside the numbers card it was one
   more grey box. */
function macroAdviceCard(t){
  const tgt=macroTarget(t); if(!tgt||!bwLb(t)) return '';
  const adv=macroAdvice(t);
  if(adv) return `<div class="card"><div class="note" style="color:var(--ink)">${esc(adv.text)}</div>
    <button class="btn primary wide" data-act="macrobump" data-v="${adv.dir}">${adv.dir>0?'Add':'Take off'} 500 a day</button></div>`;
  if(tgt.bump) return `<div class="card"><div class="row between"><span class="note">Your target is adjusted by ${tgt.bump>0?'+':''}${tgt.bump*MACRO_STEP} a day.</span><button class="btn sm ghost" data-act="macrobump" data-v="0">Back to the formula</button></div></div>`;
  return '';
}
function energyCard(t){
  const est=tdeeOn(t), pred=est&&est.predicted, meas=est&&est.measured, ts=tdeeSeries(t,12);
  const bf=bfSeries(t), last=bf[bf.length-1];
  const kc=[]; for(let i=27;i>=0;i--){const v=kcalOn(addDays(t,-i));if(v)kc.push(v)}
  if(!meas&&!pred&&!bf.length) return `<div class="card"><h3>Energy and composition</h3><p class="note" style="margin:0">Log calories in the daily check-in, add your height, sex and birth year in Setup, and take neck and waist measurements weekly. Then this card estimates what you burn and what you are made of.</p></div>`;
  let h=`<div class="card"><div class="lift-h"><h3>Energy and composition</h3><span class="small muted">Estimates, not measurements</span></div>`;
  const ate=kc.length?Math.round(kc.reduce((a,b)=>a+b,0)/kc.length):null, kt=(macroTarget(t)||{}).kcal||null;
  const at=kt&&ate!=null?macroTone(kt,ate):null;
  h+=`<div class="mbs">`;
  h+=ate==null?bRow({label:'Eaten per day',value:'\u2014',sub:'Log calories in the check-in'})
    :bRow({label:'Eaten per day',value:n(ate),of:kt?n(kt):null,unit:kt?'target':'',pct:kt?100*ate/kt:null,
      tone:at?at.tone:'muted',word:at?at.word:'',sub:`${kc.length} of the last 28 days logged${kt?' \u00b7 the target is the Macros card\u2019s':''}`,
      aria:kt?`Eaten ${n(ate)} of a ${n(kt)} target`:''});
  h+=bRow({label:'Burn per day',value:est?n(est.tdee):'\u2014',
    sub:est?(meas?`${Math.round(est.w*100)}% your own data${pred?`, rest the formula (${n(pred)})`:''}`:`The formula only \u00b7 Mifflin-St Jeor \u00d7 ${actFactor()}`):'Needs height, sex and birth year'});
  if(last){
    // Body fat wants to come down while cutting and hold otherwise. Half a point either
    // way counts as holding: the tape method is only good to a few points.
    const dbf=bf.length>1?last.bf-bf[0].bf:null, bt=bfTone(dbf);
    h+=bRow({label:'Body fat',value:r1(last.bf),unit:'%',tone:bt.tone,word:bt.word&&dbf!=null?`${bt.word} \u00b7 ${dbf>0?'+':''}${r1(dbf)} since ${fmtD(bf[0].d)}`:'',sub:fmtD(last.d,true)});
  } else h+=bRow({label:'Body fat',value:'\u2014',sub:'Needs neck and waist'});
  h+=`</div>`;
  if(meas){
    const rt=meas.dw/meas.gap*7, own=meas.tdee-meas.mean;
    h+=`<div class="small">Over the last ${meas.days} days you ate <b class="mono">${n(meas.mean)}</b> a day and your weight trend ${Math.abs(rt)<.05?'held flat':`moved ${rt>0?'+':'−'}${r1(Math.abs(rt))} ${u()} a week`}. On its own that puts your burn at <b class="mono">${n(meas.tdee)}</b>, a ${own>0?'deficit':'surplus'} of <b class="mono">${n(Math.abs(own))}</b> a day.${est.w<.95&&pred?` The number above still leans ${Math.round((1-est.w)*100)}% on the formula while your history builds — ${Math.ceil((42-tdeeHistory(t))/7)} more week${Math.ceil((42-tdeeHistory(t))/7)===1?'':'s'} of logging both and it is all yours.`:''}</div>`;
    const goal=plan.goal, tgt=goal==='lose'?est.tdee-Math.round(est.tdee*.18/10)*10:goal==='gain'?est.tdee+250:est.tdee;
    if(goal&&goal!=='maintain') h+=`<div class="small muted">Your goal is set to ${goal==='lose'?'lose fat':'build'}. About <b class="mono">${n(tgt)}</b> a day would ${goal==='lose'?'take off roughly 1% of bodyweight a month without wrecking the lifting':'add weight slowly enough to stay mostly lean'}. Protein target is on the Today card.</div>`;
  } else if(pred){
    h+=`<div class="note">That is the formula's guess from your height, weight, age and activity. Log calories for ${28} days alongside your weigh-ins and this switches to your own numbers, which are the only ones that count.</div>`;
  }
  if(ts.length>=2){
    const a0=ts[0], b0=ts[ts.length-1], dr=b0.v-a0.v;
    h+=`<div class="sm" style="margin-top:12px"><div class="sm-h"><b>Burn over time</b><span class="v">${n(b0.v)}<small>${dr>0?'+':''}${n(dr)} since ${fmtD(a0.d)}</small></span></div>`;
    h+=lineChart(ts.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: about ${n(x.v)} a day, ${Math.round(x.w*100)}% from your own data`})),{label:'Estimated daily burn',minStep:25,tick:fmtWhole});
    h+=`<div class="note">Each point is the 28 days ending that week, so it follows you rather than holding a number set on day one.${Math.abs(dr)>=100?(dr<0?` It has come down about ${n(-dr)} since ${fmtD(a0.d)} — normal in a long deficit, and a reason to take a maintenance break rather than cut harder.`:` It has risen about ${n(dr)} since ${fmtD(a0.d)}.`):''}</div></div>`;
  }
  if(bf.length>=2){
    const w=bf.map(x=>({d:x.d,v:+x.m.waist}));
    h+=`<div class="sm-grid" style="margin-top:12px">`;
    h+=`<div class="sm"><div class="sm-h"><b>Body fat</b><span class="v">${r1(last.bf)}<small>%</small></span></div>${lineChart(bf.map(x=>({y:x.bf,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.bf)}%`})),{label:'Body fat estimate',minStep:.5})}</div>`;
    h+=`<div class="sm"><div class="sm-h"><b>Waist</b><span class="v">${r1(w[w.length-1].v)}<small>${u()==='kg'?'cm':'in'}</small></span></div>${lineChart(w.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.v)} ${u()==='kg'?'cm':'in'}`})),{label:'Waist',minStep:.5})}</div>`;
    h+=`</div>`;
  }
  h+=`<div class="note">The body-fat estimate is the US Navy tape method: typically within 3–4 points, and more useful as a direction than a number. Measure at the same time of day, relaxed.</div>`;
  return h+`</div>`;
}
/* The three lines at the top of Status: a verdict apiece, not a number apiece. Each
   one follows the book rather than dashboard convention, and where it does not, the
   comment says so.

   TB2 on consistency: "Don't miss a single conditioning session, and don't miss a
   single strength session... Many overestimate how consistent they are, and tend to
   miss more sessions then they think." So Keeping up counts them against a standard
   of none, and says what the standard is.

   TB2 on judging progress: "Compare yourself with yourself no earlier than every six
   months. Make no judgments until six months are up... Anything less is a waste of
   time. No changes of importance will happen in the short term." A four-week progress
   verdict is exactly the line a fitness app draws here and exactly the one the book
   forbids, so the second line is a clock and an inventory of what has actually been
   measured instead.

   TB2 again: "Think long term. Consistency is king. Progress takes time." */
const VERDICT_WIN=28;                 // four weeks, the window the rest of Status uses
const ASSESS_DAYS=182;                // six months, the book's own interval
// Ours, not the book's. The book's standard is none missed; a red line for one missed
// session in four weeks would be noise inside a week, so two is the grace.
const MISS_GRACE=2;
// Ours. Readiness is a 0-100 scale, so ten points is a visible move rather than drift.
const READY_DROP=10;
// A program three days old has two sessions behind it, and calling one of them missed
// before the app was even installed is not a verdict, it is a nag.
const MISS_FLOOR=4;
function keepingUp(t){
  let n0=0,d0=0;
  for(let i=VERDICT_WIN;i>=1;i--){const d=addDays(t,-i);if(d<plan.startMonday)continue;const st=sessState(d,t);if(st==='rest')continue;n0++;if(st==='done')d0++}
  if(n0<MISS_FLOOR) return {cls:'muted',v:'Nothing to count yet',w:`${n0?`${d0} of ${n0} so far. `:''}Four sessions have to be behind you before this says anything worth hearing.`};
  const miss=n0-d0;
  if(!miss) return {cls:'ok',v:'Nothing missed',w:`All ${n0} sessions in the last four weeks. That is the standard the book sets — not a single strength or conditioning session — and you are holding it.`};
  return {cls:miss<=MISS_GRACE?'warn':'off',v:`${miss} missed`,w:`${d0} of ${n0} sessions in the last four weeks. The book asks for none missed, and warns that most people think they miss fewer than they do.`};
}
// Only a max somebody entered counts as measured. A projected max is the increment
// doing arithmetic, and a locked one is that arithmetic frozen; neither is evidence.
function measuredLifts(curC){
  const out=[];
  for(const k of activeLifts()){
    const base=maxFor(1)[k]; if(!base) continue;
    // The latest cycle anybody typed a number into. Cycle 1 is the starting point
    // rather than a retest, so it is where the comparison runs to, not from.
    let hit=null;
    for(let c=curC;c>=2;c--){ const m=maxFor(c)[k]; if(m&&m.src==='set'){ hit={c,v:m.v}; break } }
    if(hit) out.push({k,c:hit.c,d:hit.v-base.v});
  }
  return out;
}
function assessClock(t){
  const since=Math.round((D(t)-D(plan.startMonday))/864e5);
  const period=Math.max(0,Math.floor(since/ASSESS_DAYS));
  const at=addDays(plan.startMonday,(period+1)*ASSESS_DAYS);
  // For the four weeks after each six-month mark, the answer is "now".
  return {since,period,at,due:period>=1&&since-period*ASSESS_DAYS<VERDICT_WIN,left:Math.round((D(at)-D(t))/864e5)};
}
function progressLine(t){
  const wk=weekOf(t), curC=wk?(wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle)):1;
  const got=measuredLifts(curC), up=got.filter(x=>x.d>0), c=assessClock(t);
  const said=got.length
    ? `${got.length} lift${got.length===1?'':'s'} retested since you started${up.length?`, ${up.length} of ${got.length===up.length?'them':got.length} up on where ${up.length===1?'it':'they'} began`:', none of them up yet'}.`
    : 'Nothing has been retested yet, so none of the maxes on this page are measured — they are the increment doing arithmetic.';
  const wks=Math.floor(c.since/7);
  if(c.due) return {cls:'ok',v:`${c.period*6} months in — compare`,w:`${said} The book's interval is up: look at where you were on ${fmtD(addDays(plan.startMonday,(c.period-1)*ASSESS_DAYS))} against where you are now, and re-assess. The comparison is just below.`};
  if(c.since<7) return {cls:'muted',v:'Just started',w:`${said} The book asks for no judgment until six months are up, which is ${fmtD(c.at,true)}.`};
  if(c.period) return {cls:'muted',v:`${wks} weeks in`,w:`${said} You passed the ${c.period*6}-month mark on ${fmtD(addDays(plan.startMonday,c.period*ASSESS_DAYS))}. The next comparison the book asks for is ${fmtD(c.at,true)}, ${c.left} day${c.left===1?'':'s'} away.`};
  return {cls:'muted',v:`${wks} week${wks===1?'':'s'} in`,w:`${said} The book asks you to make no judgment until six months are up — ${fmtD(c.at,true)}, ${c.left} day${c.left===1?'':'s'} away. Keep plodding.`};
}
function watchLine(t){
  const from=addDays(t,-(VERDICT_WIN-1)), out=[];
  const flags=progLogs().filter(([d,L])=>d>=from&&d<=t&&(L.pain==='sharp'||L.pain==='niggle'));
  const sharp=flags.filter(([,L])=>L.pain==='sharp').length;
  if(flags.length){
    const where={}; for(const [,L] of flags) for(const w of painAt(L)) where[w]=(where[w]||0)+1;
    const spots=Object.entries(where).sort((a,b)=>b[1]-a[1]).map(([k,c])=>((PAIN_AT[k]||{}).name||k)+' ×'+c).join(' · ');
    out.push({r:sharp?3:2,v:sharp?'Sharp pain logged':'Something hurting',
      w:`${flags.length} session${flags.length===1?'':'s'} with something hurting in the last four weeks${sharp?`, ${sharp} of them sharp`:''}${spots?` — ${spots}`:''}. ${sharp?'Sharp pain holds that lift back at the end of the cycle.':'Noted, not acted on — worth watching if it keeps appearing.'}`});
  }
  const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
  const now=[],was=[];
  for(let i=0;i<7;i++){const r=readiness(ci(addDays(t,-i)));if(r!=null)now.push(r)}
  for(let i=7;i<14;i++){const r=readiness(ci(addDays(t,-i)));if(r!=null)was.push(r)}
  if(now.length>=3&&was.length>=3){
    const drop=Math.round(mean(was)-mean(now));
    if(drop>=READY_DROP) out.push({r:2,v:'Readiness falling',
      w:`Down ${drop} points on the week before. The book's answer to that is the rest day, not a harder session: rest periodically, and do not ignore it.`});
  }
  let gr=0; for(let i=VERDICT_WIN;i>=0;i--){const L=lg(addDays(t,-i));for(const x of Object.values(L.lifts||{})) gr+=groundSets(x)}
  if(gr>=3) out.push({r:1,v:'Sets are grinding',
    w:`${gr} grinder sets in four weeks. That is what the end-of-cycle review reads when it decides whether a max goes up, and it usually means the max is already where it should be.`});
  if(!out.length) return {cls:'ok',v:'Nothing flagged',w:'No pain logged in four weeks, readiness holding, nothing grinding.'};
  out.sort((a,b)=>b.r-a.r);
  return {cls:out[0].r>=3?'off':'warn',v:out[0].v,w:out.map(x=>x.w).join(' ')};
}
function verdictBlock(t){
  const rows=[['Keeping up',keepingUp(t)],['Progress',progressLine(t)],['Watch',watchLine(t)]];
  return `<div class="card"><div class="vb">${rows.map(([l,x])=>
    `<div class="vb-r"><div class="vb-h"><span class="vb-l">${l}</span><span class="vb-v ${x.cls}">${x.v}</span></div><div class="vb-w">${x.w}</div></div>`).join('')}</div></div>`;
}
// Status answers "how am I doing", History answers "what happened". Every trend line
// that was here as well as there has gone to History: maxes by cycle, readiness,
// results per activity, jumps. What stays is the current number and its direction.
function strengthRows(curC){
  let h=`<div class="mbs">`;
  for(const k of activeLifts()){
    const cur=maxFor(curC)[k], base=maxFor(1)[k], hv=heavySet(k);
    const d=cur&&base?cur.v-base.v:null;
    const tone=d==null||!base||cur.v===base.v?'muted':d>0?'ok':'off';
    const word=d==null?'No max yet':!base||cur.v===base.v?'Level since C1':`${d>0?'+':'\u2212'}${n(Math.abs(d))} since C1`;
    h+=bRow({label:liftName(k),value:cur?n(cur.v):'\u2014',unit:cur?u():'',tone,word,
      sub:hv?`Best set ${esc(fmtLoad(k,hv.w))} \u00d7 ${hv.r} at ${hv.p}%${hv.grinder?', ground':''}`:''});
  }
  return h+`</div>`;
}
function vStatus(){
  const t=todayStr(), wk=weekOf(t);
  if(!wk) return `<div class="card"><h2>Status</h2><p class="muted" style="margin:0">The program starts the week of ${fmtLong(plan.startMonday)}.</p></div>`;
  const list=weeks(), ci0=wk.idx;
  let h='';
  // The answer leads; the orientation and the evidence follow it.
  h+=verdictBlock(t);
  // The comparison the Progress line points at, while it is the thing to read.
  if(assessClock(t).due) h+=sixMonthCard(t);
  // --- where you are
  const wt=weekTitle(wk);
  h+=`<div class="card"><div class="lift-h"><h2>${wt.t}</h2><span class="chip ${wt.cls}">${wt.chip}</span></div>`;
  if(wk.kind==='cycle'){
    const first=ci0-(wk.w-1);
    h+=`<div class="cyc" aria-label="Cycle ${wk.cycle} progress">${waveOf().map((v,i)=>{const cls=tier(+v.p);return `<div class="chip ${cls}${i<wk.w-1?' past':''}${i===wk.w-1?' now':''}" style="border-radius:6px">W${i+1}<small>${v.s}×${v.r} ${v.p}%</small></div>`}).join('')}</div>`;
    h+=`<div class="small muted">Cycle ${wk.cycle} ends ${fmtD(addDays(list[first+5].monday,4),true)}.</div>`;
  }
  const nextOf=kind=>{for(let i=ci0+1;i<list.length;i++){if(kind==='cycle'?(list[i].kind==='cycle'&&list[i].w===1):list[i].kind===kind)return list[i]}return null};
  const days=w=>w?Math.round((D(w.monday)-D(t))/864e5):null;
  const nd=nextOf('deload'), nt=nextOf('test'), nc=nextOf('cycle');
  const mile=(l,w,sub)=>`<div class="mile"><span class="l">${l}</span>${w?`<span class="big">${days(w)}<small style="font-size:14px;color:var(--muted);margin-left:4px">days</small></span><span class="small muted">${sub(w)}</span>`:'<span class="small muted">Not scheduled</span>'}</div>`;
  h+=`<div class="miles">${mile('Next cycle',nc,w=>'Cycle '+w.cycle+' · '+fmtD(w.monday,true))}${mile('Next deload',nd,w=>fmtD(w.monday,true))}${mile('Next retest',nt,w=>fmtD(w.monday,true))}</div>`;
  const trained=list.slice(0,ci0).filter(w=>w.kind==='cycle').length;
  h+=`<div class="small muted">${trained} training week${trained===1?'':'s'} completed since ${fmtD(plan.startMonday)}.</div></div>`;
  // --- this week + adherence
  const mon=mondayOf(t);
  let wd='';for(let i=0;i<7;i++){const d=addDays(mon,i),st=sessState(d,t),p=dayPlan(d);wd+=`<div><i class="${st}" aria-label="${DAYN[i]}: ${st}">${st==='done'?'✓':st==='missed'?'✕':st==='rest'?'–':'•'}</i>${DAYN[i]}<span style="font-size:11px">${esc(p.short||'')}</span></div>`}
  let tw=0,td=0;for(let i=0;i<7;i++){const d=addDays(mon,i),st=sessState(d,t);if(st!=='rest'){tw++;if(st==='done')td++}}
  // Readiness is a 7-day average here and a 28-day line in History. It used to be both,
  // two cards apart, which is one metric answering the same question twice.
  // Sessions against the week's count, readiness against its 100. The four-week rate
  // that used to sit here is the Keeping up verdict at the top, said once.
  let missedWk=0; for(let i=0;i<7;i++){ const d=addDays(mon,i); if(d<t&&sessState(d,t)==='missed') missedWk++ }
  const xs7=[]; for(let i=0;i<7;i++){const r=readiness(ci(addDays(t,-i)));if(r!=null)xs7.push(r)}
  const av7=xs7.length?Math.round(xs7.reduce((a,b)=>a+b,0)/xs7.length):null, rt=readyTone(av7);
  h+=`<div class="card"><div class="lift-h"><h3>This week</h3></div><div class="wkdots">${wd}</div><div class="mbs">`;
  h+=bRow({label:'Sessions',value:td,of:tw,pct:tw?100*td/tw:0,
    tone:td>=tw?'ok':missedWk?(missedWk<=MISS_GRACE?'warn':'off'):'muted',
    word:td>=tw?'All done':missedWk?`${missedWk} missed`:`${tw-td} to go`,aria:`${td} of ${tw} sessions this week`});
  h+=av7==null?bRow({label:'Readiness · 7 days',value:'—',sub:'No check-ins yet'})
    :bRow({label:'Readiness · 7 days',value:av7,of:100,pct:av7,tone:rt.tone,word:rt.word,
      sub:`${xs7.length} check-in${xs7.length>1?'s':''}`,aria:`Readiness ${av7} of 100`});
  h+=`</div>${heatmap(t,12)}</div>`;
  // --- what you look at daily, before what you look at monthly
  h+=macroCard(t);
  h+=macroAdviceCard(t);
  h+=bwCard(t);
  h+=energyCard(t);
  // --- strength
  const curC=wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle);
  h+=`<div class="card"><div class="lift-h"><h3>Strength</h3><span class="small muted">Current max and where it has gone</span></div>${strengthRows(curC)}<div class="small muted">Max by cycle, with every projection, is charted in History.</div></div>`;
  // --- conditioning
  {
    const all=hicSessions();
    const since=addDays(t,-27), mix={}; for(const x of all) if(x.d>=since) mix[x.mod]=(mix[x.mod]||0)+1;
    h+=`<div class="card"><div class="lift-h"><h3>Conditioning</h3><span class="small muted">Volume per week, and the session you repeat</span></div>`;
    h+=Object.keys(mix).length?`<div class="row" style="gap:6px"><span class="small muted">Last 4 weeks:</span>${Object.entries(mix).sort((a,b)=>b[1]-a[1]).map(([m,c])=>`<span class="chip">${MOD[m].name} · ${c}</span>`).join('')}</div>`:'';
    {
      // climbing: what the hills actually added up to
      const wkStart=mondayOf(t);
      const gain=(from)=>all.reduce((a,x)=>a+(x.d>=from&&x.elev?+x.elev:0),0);
      const thisWeek=gain(wkStart), fourWeeks=gain(since), prevFour=all.reduce((a,x)=>a+(x.d>=addDays(since,-28)&&x.d<since&&x.elev?+x.elev:0),0);
      if(fourWeeks||thisWeek){
        h+=`<div class="mbs">`;
        h+=bRow({label:'Climbing this week',value:n(thisWeek),unit:elevUnit(),sub:`${n(Math.round(thisWeek/elevPerDist()*10)/10)} ${u()==='kg'?'km':'mi'} of flat walking`});
        h+=bRow({label:'Climbing \u00b7 4 weeks',value:n(fourWeeks),unit:elevUnit(),
          tone:prevFour?(fourWeeks>=prevFour?'ok':'muted'):'muted',
          word:prevFour?(fourWeeks>=prevFour?'Up from ':'Down from ')+n(prevFour)+' the 4 before':'First four weeks logged'});
        h+=`</div>`;
      }
    }
    {
      const cw=condWeeks(12), tot=cw.reduce((a,x)=>a+x.min,0), thisWk=mondayOf(t);
      // this week is still running, so it is drawn hollow and left out of the average
      const full=cw.filter(x=>x.mon!==thisWk), last4=full.slice(-4);
      const av=last4.length?Math.round(last4.reduce((a,x)=>a+x.min,0)/last4.length):0;
      const anyEst=cw.some(x=>x.est>0);
      const now=cw.find(x=>x.mon===thisWk);
      h+=`<div class="sm"><div class="sm-h"><b>Minutes per week</b>${last4.length?`<span class="v">${av}<small>min / week, last ${last4.length}</small></span>`:now&&now.n?`<span class="v">${now.min}<small>min this week so far</small></span>`:''}</div>`;
      h+=cw.length>=2&&tot?lineChart(cw.map(x=>({y:x.min,xl:fmtD(x.mon),hollow:x.mon===thisWk,tip:`Week of ${fmtD(x.mon,true)}: ${x.min} min across ${x.n} session${x.n===1?'':'s'}${x.mon===thisWk?' so far':''}`})),{min:0,minStep:10,label:'Conditioning minutes per week'}):`<div class="none">${tot?`${now&&now.n===1?'One session':`${now?now.n:0} sessions`} this week. The trend starts once a second week has sessions in it.`:'Log a conditioning session and this fills in.'}</div>`;
      const drew=cw.length>=2&&tot;
      if(tot&&(drew||anyEst)) h+=`<div class="note">${drew?'This week is dashed: it is still running.':''}${anyEst?`${drew?' ':''}Sessions where you did not log minutes count the planned length of that format, warm-up and cool-down included — log the real number on the day’s card and it uses that instead.`:''}</div>`;
      h+=`</div>`;
    }
    {
      const bm=benchmarkState(t);
      if(bm&&bm.xs.length){
        const dir=bm.xs.length>1?bm.last.v-bm.first.v:null;
        h+=`<div class="sm"><div class="sm-h"><b>Benchmark · ${MOD[bm.mod].name} ${HIC[bm.fmt].name}</b><span class="v">${n(bm.best)}<small>${esc(bm.last.u)} best</small></span></div>`;
        h+=bm.xs.length>=2?lineChart(bm.xs.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${n(x.v)} ${x.u}`})),{label:'Benchmark session',minStep:1}):'<div class="none">One so far. Repeat it and this becomes the line worth watching.</div>';
        h+=`<div class="note">${bm.auto?'Picked automatically as the hard session you repeat most. ':''}${bm.due?`<b>Due:</b> ${bm.days==null?'never run':bm.days+' days since the last one'}. Run the same activity and format to compare like with like.`:`Last run ${fmtD(bm.last.d,true)}, ${bm.days} days ago. Due again around day ${bm.every}.`}${dir!=null?` ${dir>0?'Up':dir<0?'Down':'Level'} ${dir?n(Math.abs(dir))+' '+bm.last.u:''} since ${fmtD(bm.first.d)}.`:''}</div></div>`;
      }
    }
    h+=`<div class="small muted">Every activity you have logged, charted and tabled, is in History.</div>`;
    h+=`</div>`;
  }
  h+=pullupCard(t);
  h+=prBoard();
  h+=`<div class="row between" style="padding:0 2px"><span class="small muted">Readiness, jumps, maxes by cycle and every session you have logged.</span><button class="btn sm" data-act="view" data-view="history">Open History</button></div>`;
  return h;
}

/* ---------- a stretch of training, summed up ----------
The end-of-cycle report and the six-month comparison both ask one question of a range
of days -- what happened, and which way did it move -- so one function answers it for
both. Everything here is read from the log; nothing is projected or estimated except
where the card says so. */
function periodSummary(from,to){
  const t=todayStr(), end=to<t?to:t;
  let sched=0,done=0;
  for(let d=from;d<=end;d=addDays(d,1)){
    if(d<plan.startMonday) continue;
    const st=sessState(d,t); if(st==='rest'||st==='upcoming'||st==='today') continue;
    sched++; if(st==='done') done++;
  }
  const days=Math.round((D(end)-D(from))/864e5)+1;
  const rd=[]; for(let d=from;d<=end;d=addDays(d,1)){ const r=readiness(ci(d)); if(r!=null) rd.push(r) }
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  // Bodyweight at each end is the 7-day average, not one weigh-in: a single morning
  // moves with water and salt, and a comparison should not hang on one.
  const bwA=bwAvg(addDays(from,6),7), bwB=bwAvg(end,7);
  const bf=bfSeries(end).filter(x=>x.d>=from);
  const kc=[], pr=[]; for(let d=from;d<=end;d=addDays(d,1)){ const k=kcalOn(d); if(k) kc.push(k); const p=macroOn(d,'proG'); if(p!=null) pr.push(p) }
  const hs=hicSessions().filter(x=>x.d>=from&&x.d<=end);
  const bm=benchmarkState(end), bms=bm?bm.xs.filter(x=>x.d>=from):[];
  // How the working sets moved, where they were rated, and on heavy weeks especially.
  const eff={rated:0,fast:0,solid:0,ground:0,heavyRated:0,heavyFast:0};
  for(const [d,L] of progLogs()){
    if(d<from||d>end||!L.lifts) continue;
    const wk=weekOf(d), heavy=wk&&wk.kind==='cycle'&&tier(+wkRx(wk).p)==='heavy';
    for(const x of Object.values(L.lifts)) for(const e of (x&&Array.isArray(x.eff)?x.eff:[])){
      if(!e) continue; eff.rated++; eff[e]++; if(heavy){ eff.heavyRated++; if(e==='fast') eff.heavyFast++ } }
  }
  return {from,to:end,days,sched,done,
    readiness:mean(rd)==null?null:Math.round(mean(rd)),readinessN:rd.length,
    bwFrom:bwA&&bwA.n>=2?bwA.avg:null, bwTo:bwB&&bwB.n>=2?bwB.avg:null,
    bfFrom:bf.length?bf[0]:null, bfTo:bf.length>1?bf[bf.length-1]:null,
    kcal:mean(kc)==null?null:Math.round(mean(kc)),kcalN:kc.length,
    protein:mean(pr)==null?null:Math.round(mean(pr)),proteinN:pr.length,
    cond:{n:hs.length,min:hs.reduce((a,x)=>a+hicMinutes(x).m,0)},
    bench:bm&&bms.length?{name:`${MOD[bm.mod].name} ${HIC[bm.fmt].name}`,first:bms[0],last:bms[bms.length-1],u:bms[bms.length-1].u}:null,
    eff};
}
// A cycle's first Monday to its last Sunday, from the plan as it actually ran.
function cycleRange(c){
  const ws=weeks().filter(w=>w.kind==='cycle'&&w.cycle===c); if(!ws.length) return null;
  return {from:ws[0].monday,to:addDays(ws[ws.length-1].monday,6)};
}
function cycleDone(c){ const r=cycleRange(c); return !!r&&r.to<todayStr() }
// Sessions against what was scheduled, judged by the same standard as Keeping up: the
// book asks for none missed, and two is the grace.
function sessRow(S,label){
  const miss=S.sched-S.done;
  return bRow({label:label||'Sessions',value:S.done,of:S.sched,pct:S.sched?100*S.done/S.sched:0,
    tone:!S.sched?'muted':!miss?'ok':miss<=MISS_GRACE?'warn':'off',
    word:!S.sched?'Nothing scheduled':!miss?'None missed':`${miss} missed`,aria:`${S.done} of ${S.sched} sessions`});
}
function effWord(e){
  if(!e.rated) return '';
  const bits=[`${e.fast} fast`,`${e.solid} solid`,`${e.ground} ground`].filter(b=>!/^0 /.test(b));
  return bits.join(' · ')+(e.heavyRated?` · ${e.heavyFast} of ${e.heavyRated} heavy sets fast`:'');
}

/* ---------- the end-of-cycle report ----------
The review asks one question -- what should the next max be. This is the rest of the
story in one place: what each max did, how the heavy sets moved, the body, the fuel,
the conditioning. Read-only, and it says what it does not know rather than guessing. */
function cycleReport(c){
  const r=cycleRange(c); if(!r) return '';
  const S=periodSummary(r.from,r.to), cur=maxFor(c), nxt=maxFor(c+1), set=(plan.cycleMaxes||{})[c+1]||{};
  let h=`<div class="mbs">`;
  h+=sessRow(S);
  h+=`</div><h4 class="sub-h">Strength</h4><div class="mbs">`;
  for(const k of activeLifts()){
    const a=cur[k], b=nxt[k]; if(!a) continue;
    const d=b?b.v-a.v:null, chosen=set[k]!=null&&set[k]!=='';
    h+=bRow({label:liftName(k),value:b?n(b.v):'—',unit:b?u():'',
      tone:d==null?'muted':d>0?'ok':d<0?'off':'muted',
      word:d==null?'':`${d>0?'+':d<0?'−':''}${d?n(Math.abs(d)):'Held'}${d?' for next cycle':''}`,
      sub:`This cycle ${n(a.v)} · ${chosen?'next max chosen in the review':'next max projected — not yet reviewed'}`});
  }
  h+=`</div>`;
  if(S.eff.rated) h+=`<div class="small muted">How the working sets moved: ${esc(effWord(S.eff))}.</div>`;
  h+=`<h4 class="sub-h">Body and fuel</h4><div class="mbs">`;
  if(S.bwFrom!=null&&S.bwTo!=null){ const dw=S.bwTo-S.bwFrom, tt=trendTone(dw/(S.days/7),u()==='kg'?0.1:0.2);
    h+=bRow({label:'Bodyweight',value:r1(S.bwTo),unit:u(),tone:tt.tone,word:`${dw>0?'+':''}${r1(dw)} over the cycle · ${tt.word.toLowerCase()}`,sub:`Started at ${r1(S.bwFrom)}, 7-day averages`}) }
  else h+=bRow({label:'Bodyweight',value:'—',sub:'Not enough weigh-ins at both ends'});
  if(S.bfFrom&&S.bfTo){ const db=S.bfTo.bf-S.bfFrom.bf, bt=bfTone(db);
    h+=bRow({label:'Body fat',value:r1(S.bfTo.bf),unit:'%',tone:bt.tone,word:`${bt.word} \u00b7 ${db>0?'+':''}${r1(db)} since ${fmtD(S.bfFrom.d)}`}) }
  const tg=macroTarget(r.to);
  if(S.protein!=null&&tg){ const mt=macroTone(tg.p,S.protein);
    h+=bRow({label:'Protein a day',value:S.protein,of:tg.p,unit:'g',pct:100*S.protein/tg.p,tone:mt.tone,word:mt.word,sub:`${S.proteinN} of ${S.days} days logged`,aria:`Protein ${S.protein} of ${tg.p} grams`}) }
  if(S.kcal!=null) h+=bRow({label:'Calories a day',value:n(S.kcal),of:tg?n(tg.kcal):null,unit:tg?'target':'',pct:tg?100*S.kcal/tg.kcal:null,
    tone:tg?macroTone(tg.kcal,S.kcal).tone:'muted',word:tg?macroTone(tg.kcal,S.kcal).word:'',sub:`${S.kcalN} of ${S.days} days logged`});
  if(S.readiness!=null){ const rt=readyTone(S.readiness); h+=bRow({label:'Readiness',value:S.readiness,of:100,pct:S.readiness,tone:rt.tone,word:rt.word,sub:`Average of ${S.readinessN} check-ins`}) }
  h+=`</div><h4 class="sub-h">Conditioning</h4><div class="mbs">`;
  h+=bRow({label:'Sessions',value:S.cond.n,sub:S.cond.n?`${Math.round(S.cond.min/(S.days/7))} minutes a week on average`:'None logged'});
  if(S.bench){ const db=S.bench.last.v-S.bench.first.v;
    h+=bRow({label:S.bench.name,value:n(S.bench.last.v),unit:S.bench.u,tone:S.bench.first===S.bench.last?'muted':db>0?'ok':db<0?'off':'muted',
      word:S.bench.first===S.bench.last?'Run once this cycle':`${db>0?'+':''}${n(db)} since ${fmtD(S.bench.first.d)}`,sub:'Your benchmark session'}) }
  return h+`</div>`;
}
// History lists every finished cycle's report, newest open, the rest folded. Open state
// lives in openPx like every other disclosure, because a <details> left to the DOM
// closes on the next render. The newest is opened once, the first time it is shown;
// after that it stays however you leave it.
let repSeeded=new Set();
function reportsCard(){
  const list=weeks(), cs=[...new Set(list.filter(w=>w.kind==='cycle').map(w=>w.cycle))].filter(cycleDone).sort((a,b)=>b-a);
  let h=`<div class="card"><h2>Cycle reports</h2>`;
  if(!cs.length){ const c1=cycleRange(1);
    return h+`<p class="note" style="margin:0">Each cycle gets a report when it ends: what every max did, how the heavy sets moved, bodyweight, fuel and conditioning, in one place.${c1?` The first one appears after ${fmtD(c1.to,true)}.`:''}</p></div>` }
  if(!repSeeded.has(cs[0])){ repSeeded.add(cs[0]); openPx.add('rep-'+cs[0]) }
  cs.forEach(c=>{ const r=cycleRange(c);
    h+=`<details class="plain" data-px="rep-${c}"${openPx.has('rep-'+c)?' open':''}><summary>Cycle ${c} · ${fmtD(r.from)}–${fmtD(r.to)}</summary><div style="margin-top:10px">${cycleReport(c)}</div></details>`; });
  return h+`</div>`;
}

/* ---------- six months: then and now ----------
TB2: "Compare yourself with yourself no earlier than every six months. Make no
judgments until six months are up, and then see how far you've come and re-assess."
The Progress line counts down to that date and then says compare; this is the
comparison. "Then" is your first four weeks, "now" your last four -- from the start
rather than from six months ago, because the book's question is how far you have come.
Four weeks a side, so one bad week at either end cannot decide it. */
function sixMonthCard(t){
  const c=assessClock(t); if(!c.period) return '';
  const start=plan.startMonday, then=periodSummary(start,addDays(start,27)), now=periodSummary(addDays(t,-27),t);
  const wkRate=(S)=>S.days?S.cond.min/(S.days/7):0;
  let h=`<div class="card"><div class="lift-h"><h3>Six months: then and now</h3><span class="chip light">TB2</span></div>
  <p class="note" style="margin:0">The book’s interval: “compare yourself with yourself no earlier than every six months … then see how far you’ve come and re-assess.” Your first four weeks, from ${fmtD(start)}, against your last four.</p>`;
  h+=`<h4 class="sub-h">Strength</h4><div class="mbs">`;
  const wk=weekOf(t), curC=wk?(wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle)):1, got=measuredLifts(curC);
  for(const k of activeLifts()){
    const base=maxFor(1)[k]; if(!base) continue;
    const m=got.find(x=>x.k===k), nowV=m?base.v+m.d:null;
    h+=bRow({label:liftName(k),value:nowV!=null?n(nowV):'—',unit:nowV!=null?u():'',
      tone:m?(m.d>0?'ok':m.d<0?'off':'muted'):'muted',
      word:m?(m.d?`${m.d>0?'+':'−'}${n(Math.abs(m.d))} since you started`:'Level since you started'):'Not retested yet — nothing measured to compare',
      sub:`Then ${n(base.v)}${m?` · now from your cycle ${m.c} retest`:''}`});
  }
  h+=`</div><h4 class="sub-h">Body</h4><div class="mbs">`;
  if(then.bwFrom!=null&&now.bwTo!=null){ const dw=now.bwTo-then.bwFrom, weeks=Math.max(1,(D(t)-D(start))/864e5/7), tt=trendTone(dw/weeks,u()==='kg'?0.1:0.2);
    h+=bRow({label:'Bodyweight',value:r1(now.bwTo),unit:u(),tone:tt.tone,word:`${dw>0?'+':''}${r1(dw)} since you started · ${tt.word.toLowerCase()}`,sub:`Then ${r1(then.bwFrom)}, 7-day averages`}) }
  else h+=bRow({label:'Bodyweight',value:'—',sub:'Not enough weigh-ins at one end or the other'});
  const bfAll=bfSeries(t);
  if(bfAll.length>1){ const a0=bfAll[0], b0=bfAll[bfAll.length-1], db=b0.bf-a0.bf, bt=bfTone(db);
    h+=bRow({label:'Body fat',value:r1(b0.bf),unit:'%',tone:bt.tone,word:`${bt.word} · ${db>0?'+':''}${r1(db)} since ${fmtD(a0.d)}`,sub:`Then ${r1(a0.bf)}%`}) }
  h+=`</div><h4 class="sub-h">Engine</h4><div class="mbs">`;
  const bm=benchmarkState(t);
  if(bm&&bm.xs.length>1){ const f=bm.xs[0], l=bm.xs[bm.xs.length-1], d=l.v-f.v;
    h+=bRow({label:`${MOD[bm.mod].name} ${HIC[bm.fmt].name}`,value:n(l.v),unit:l.u,tone:d>0?'ok':d<0?'off':'muted',
      word:`${d>0?'+':''}${n(d)} since ${fmtD(f.d)}`,sub:`Then ${n(f.v)} · your benchmark session`}) }
  const mT=Math.round(wkRate(then)), mN=Math.round(wkRate(now));
  // Nothing logged at either end is nothing to compare, not "about the same".
  if(mT||mN) h+=bRow({label:'Conditioning a week',value:mN,unit:'min',tone:mN>mT?'ok':'muted',word:mN===mT?'About the same':`${mN>mT?'Up':'Down'} from ${mT}`,sub:`Then ${mT} min a week`});
  if(then.readiness!=null&&now.readiness!=null){ const d=now.readiness-then.readiness, rt=readyTone(now.readiness);
    h+=bRow({label:'Readiness',value:now.readiness,of:100,pct:now.readiness,tone:rt.tone,word:`${rt.word} · ${d>0?'+':''}${d} since you started`,sub:`Then ${then.readiness}`,aria:`Readiness ${now.readiness} of 100`}) }
  h+=`</div><h4 class="sub-h">Consistency</h4><div class="mbs">`;
  h+=sessRow(then,'Your first four weeks')+sessRow(now,'Your last four weeks');
  return h+`</div></div>`;
}

/* ---------- CSV export ---------- */
// Built on the phone because that's where the plan logic lives, so rows carry the
// computed week, session and prescription, not just raw entries. Covers every program:
// each date is evaluated against the plan of the program it belongs to.
function csvCell(v){if(v==null)return '';const s=String(v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function csvText(rows){return '﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n'}
function programFor(d,cur){
  cur=cur||(stash?stash.plan:plan);
  if(d>=cur.startMonday) return {name:progName(cur),plan:cur,end:null};
  const p=Object.values(programs).find(x=>d>=x.startMonday&&d<=x.end);
  return p?{name:p.name,plan:p.plan,end:p.end}:null;
}
// Evaluate fn(date) under the plan of the program each date belongs to, then restore.
function eachDateInPrograms(fn){
  const savedPlan=plan, savedViewing=viewing, savedSel=sel, dates=Object.keys(logs).sort();
  const current=stash?stash.plan:plan; // captured before the loop swaps `plan`
  try{
    for(const d of dates){
      const pr=programFor(d,current);
      plan=pr?deepMerge(clone(DEF),pr.plan):savedPlan; viewing=pr&&pr.end?{end:pr.end}:null; planV++; sel=d;
      fn(d,pr?pr.name:'');
    }
  } finally { plan=savedPlan; viewing=savedViewing; sel=savedSel; planV++; }
}
function sessionsCsv(){
  const U=u(), rows=[['date','program','week','session','done','session_rpe','readiness','sleep_h','sleep_quality','energy','soreness','stress','protein','fuel','water','alcohol','calories','bodyweight_'+U,'neck','waist','hip','bodyfat_pct','hic_format','activity','result','result_unit','minutes','rounds','ruck_load_'+U,'elevation_gain_'+elevUnit(),'warmup_done','mobility_done','plyo_phase','plyo_contacts','broad_first_in','broad_best_in','test_broad_in','test_vertical_in','test_triple_in','pullups','notes']];
  eachDateInPrograms((d,prog)=>{
    const L=logs[d], wk=weekOf(d), dp=dayPlan(d), c=L.checkin||{}, H=L.hic||{}, P=L.plyo||{}, J=L.jumps||{};
    const hasHic=dp.t==='hic'||L.hic, f=hasHic?effFmt(d):null, mod=hasHic?modOf(d):null, met=f&&mod?metricFor(mod,f):null;
    rows.push([d,prog,wk?weekTitle(wk).t:'',dp.short||'',L.done?'yes':'',L.rpe??'',readiness(c)??'',c.sleepH??'',c.sleepQ??'',c.energy??'',c.soreness??'',c.stress??'',c.protein??'',c.fuel??'',c.water??'',c.alcohol??'',c.kcal??'',c.bw??'',(L.meas||{}).neck??'',(L.meas||{}).waist??'',(L.meas||{}).hip??'',(L.meas&&navyBf(L.meas,d))??'',
      f?HIC[f].name:'',mod?(mod==='other'&&H.what?H.what:MOD[mod].name):'',met?(H[met[0]]??''):'',met&&H[met[0]]!=null?met[1]:'',H.min??'',H.rounds??'',H.load??'',H.elev??'',
      (L.warmup||[]).filter(Boolean).length||'',(L.mobility||[]).filter(Boolean).length||'',
      dp.plyo&&wk?plyoPhase(wk).name:'',P.contacts??'',P.mark??'',P.best??'',J.broad??'',J.vertical??'',J.triple??'',L.pullups??'',L.notes??'']);
  });
  return csvText(rows);
}
function liftsCsv(){
  const U=u(), rows=[['date','program','week','session','lift','variant','kind','sets_prescribed','reps','pct','prescribed_'+U,'working_'+U,'sets_done','grinder','set_effort','test_weight_'+U,'test_reps','est_1rm_'+U,'warmups']];
  eachDateInPrograms((d,prog)=>{
    const L=logs[d], wk=weekOf(d), dp=dayPlan(d), week=wk?weekTitle(wk).t:'';
    if(dp.t==='lift'&&wk) for(const k of dp.lifts){
      const x=(L.lifts||{})[k]; if(!x) continue;
      const r=rx(wk,k,d), sets=Array.isArray(x.sets)?x.sets:[], wu=(Array.isArray(x.warmup)?x.warmup:[]).filter(w=>w&&w.w!=null&&w.w!=='');
      const used=x.used!=null&&x.used!==''?+x.used:r.w;
      rows.push([d,prog,week,dp.short,liftName(k,d),VARS[k]?varOf(k,d):'','working',r.sMax>r.s?r.s+'-'+r.sMax:r.s,r.r,r.p,r.w??'',used??'',sets.filter(Boolean).length,ground(x)?'yes':'',(Array.isArray(x.eff)?x.eff:[]).map(e=>e||'-').join(' '),'','','',wu.map(w=>(isBW(k)?fmtLoad(k,+w.w):n(w.w))+'x'+(w.r??'')).join('; ')]);
    }
    for(const [k,t] of Object.entries(L.test||{})){
      if(!t||t.w==null||t.w==='') continue;
      const reps=t.r||(dp.t==='rm5'?5:1), e=estMax(k,t.w,reps,d);
      rows.push([d,prog,week,dp.short||'',liftName(k,d),VARS[k]?varRef(k):'',dp.t==='rm5'?'5RM test':'test','',reps,'','','','','','',t.w,reps,e!=null?Math.round(e*10)/10:'','']);
    }
  });
  return csvText(rows);
}
async function exportCsv(which){
  const text=which==='lifts'?liftsCsv():sessionsCsv(), name=`operator-black-${which}-${realToday()}.csv`;
  const blob=new Blob([text],{type:'text/csv'});
  try{
    const file=new File([blob],name,{type:'text/csv'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:name}); return }
  }catch(e){ if(e&&e.name==='AbortError') return }
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),10000);
}

/* ---------- programs: archive and start over ---------- */
// Logs are stored by date and programs never overlap, so a program is just a start
// date plus its plan. Archiving copies the current plan (frozen weeks, maxes, reviews
// included) into programs/<id> with an end date; nothing about the logs changes.
const PREF_KEYS=['unit','bar','bodyweight','lift3Name','machineNote','l3','acc','basis','tmPct','round','waves','inc','deloadEvery','testEvery','deload','goal','sleepTarget','proteinPerLb','rest','cardio','ivRounds','cal','accSlots','accPick','accCustom','supps','suppCustom','warmRoutine','warmCustom','stempl','cproto'];
let newProg=null;
// "Next deload: Mon 12/28 (after Cycle 2)" from the live calendar
function nextScheduled(kind){
  const t=realToday(), list=weeks();
  const w=list.find(x=>x.kind===kind&&addDays(x.monday,6)>=t);
  const label=kind==='deload'?'deload':'retest';
  if(!w) return 'No '+label+' weeks scheduled.';
  return 'Next '+label+': '+fmtD(w.monday,true)+(w.after?' (after Cycle '+w.after+')':'')+(w.inserted?' (added from Plan)':'')+'.';
}
function progName(p){p=p||plan;return p.programName||('Block '+(p.programSeq||1))}
function archiveList(){return Object.values(programs).sort((a,b)=>a.startMonday<b.startMonday?1:-1)}
function enterArchive(id){
  const p=programs[id]; if(!p) return;
  if(!stash) stash={plan,sel};
  plan=deepMerge(clone(DEF),p.plan); viewing=p; planV++;
  if(sel>p.end||sel<p.startMonday) sel=p.end;
  openWarm.clear(); openPx.clear(); render(); window.scrollTo(0,0);
}
function exitArchive(){
  if(!stash){render();return}
  plan=stash.plan; sel=realToday(); stash=null; viewing=null; planV++;
  render(); window.scrollTo(0,0);
}
// Days this device kept its own version of while the server had a different one.
function syncCard(){
  const list=conflicts(); if(!list.length) return '';
  const label=p=>p.startsWith('logs/')?fmtLong(p.slice(5)):p.startsWith('programs/')?'an archived program':p;
  return `<div class="card"><div class="lift-h"><h2>Changes that crossed</h2><span class="chip">${list.length}</span></div>
  <p class="note" style="margin:0">These days were changed on another device while this one still had changes of its own waiting to send. <b>This device\u2019s version was kept</b> and the other was dropped. That is usually what you want, but it is worth a look if something reads wrong.</p>
  <div class="stack">${list.map(c=>`<div class="banner"><div class="small"><b>${esc(label(c.path))}</b><div class="muted">noticed ${esc(fmtD(c.at.slice(0,10),true))} ${esc(c.at.slice(11,16))}</div></div></div>`).join('')}</div>
  <div class="row"><button class="btn ghost" data-act="syncclear">Dismiss</button></div>
  <div class="note">Only ever caused by using the app on two devices at once while one of them is offline. Noted on this device only.</div></div>`;
}

// Accessories in Setup: which jobs each day covers, what is doing each job this block
// and next, and your own additions. The picks are per cycle on purpose \u2014 they are
// program choices, like the cluster lifts, not something to re-decide every session.
let accNew={name:'',slot:'hpull',gear:''}, accLater=false;
let bandNew={n:'',w:''};
// Your bands, with the number you want each logged as. See 01b-accessories.js for why
// this is a list you keep rather than a color chart the app pretends to know.
function bandsCard(){
  const list=bands();
  let h=`<div class="card"><div class="lift-h"><h2>Bands</h2><span class="chip ${list.length?'light':''}">${list.length||'none'}</span></div>
  <p class="note" style="margin:0">A band has a color, not a number, and the color means different things by brand \u2014 Rogue\u2019s own range lists Red twice, at 18 and 115 lb. So these are yours: give each band the weight you want it logged as, and it shows up on any band exercise.</p>`;
  if(list.length) h+=`<div class="stack" style="gap:6px">${list.map(b=>`<div class="row between" style="gap:8px"><span class="acc-role">${esc(b.n)}</span><span class="mono small">${n(b.w)} ${esc(u())}</span><button class="btn sm ghost" data-act="bandrm" data-n="${esc(b.n)}">Remove</button></div>`).join('')}</div>`;
  h+=`<div class="grid3"><label class="f">Color or name<input type="text" id="band-n" data-bandnew="n" value="${esc(bandNew.n)}" placeholder="e.g. Red, or #1 Red"></label>
  <label class="f">Counts as (${esc(u())})<input type="number" inputmode="decimal" step="any" id="band-w" data-bandnew="w" value="${esc(String(bandNew.w))}"></label>
  <label class="f">&nbsp;<button class="btn" data-act="bandadd">Add band</button></label></div>`;
  h+=`<details class="plain"><summary>Start from a maker\u2019s chart</summary><div class="stack" style="margin-top:8px">
  <div class="note">Published figures${u()==='kg'?', converted to kg':''}, added to your list so you can edit them. They are peak resistance at full stretch, so the pull at the bottom of a rep is a good deal less than the number.</div>
  ${Object.entries(BAND_PRESETS).map(([k,set])=>`<div style="border-top:1px solid var(--line);padding-top:8px">
    <div class="row between" style="gap:8px"><span class="acc-role">${esc(set.name)}</span><button class="btn sm" data-act="bandseed" data-v="${k}">Add these</button></div>
    <div class="small muted">${esc(set.note)}</div>
    <div class="mono small" style="word-break:break-word">${set.bands.map(b=>esc(b.n.replace(/^\S+\s/,''))+' '+esc(bandPresetLabel(b))).join(' \u00b7 ')} lb</div></div>`).join('')}
  </div></details>`;
  return h+`</div>`;
}
function accSetupCard(){
  const cyc=accCycleOf(todayStr()), all=accAll();
  // One row per accessory list, not per day: Zulu and Grey Man both run the same list
  // on more than one day, and showing it twice invites you to edit two copies of it.
  const days=[]; const seenAcc=new Set();
  for(const d of tplDays(stemplOf(),weekOf(todayStr()))){
    if(!d.acc||seenAcc.has(d.acc)) continue;
    seenAcc.add(d.acc); days.push([d.acc,d.label||d.short]);
  }
  const later=accLater||cyc==null;              // with no cycle running there is only "later"
  let h=`<div class="card"><h2>Accessories</h2>
  <p class="note" style="margin:0">Each lifting day covers a few jobs and you choose what does each one. The same job can appear on more than one day with a different movement on each. Skipped automatically on heavy weeks and deloads. To change one movement for a single session, use the picker on that day\u2019s card instead.</p>`;
  if(cyc!=null) h+=`<div class="restsel"><span>Editing</span><div class="seg"><button class="segb${later?'':' on'}" data-act="acclater" data-v="0" aria-pressed="${!later}">Cycle ${cyc} (now)</button><button class="segb${later?' on':''}" data-act="acclater" data-v="1" aria-pressed="${later}">Later cycles</button></div></div>
  <div class="small muted">${later?'What a new cycle starts on. Your current block is untouched.':'This block only. Later cycles keep their own choices.'}</div>
  <div class="note"><b>In a session, core work runs last and carries after it</b>, whatever order they are listed in here \u2014 a tired trunk is a worse brace for what follows, and a fried grip is worse still. A superset moves as a pair.</div>`;

  for(const [d,label] of days){
    const sl=accSlots(d), spare=Object.keys(ASLOT).filter(k=>!sl.includes(k));
    h+=`<div style="border-top:1px solid var(--line);padding-top:10px"><div class="small" style="font-weight:650">${label}</div>`;
    if(!sl.length) h+=`<div class="small muted" style="margin-top:4px">Nothing on this day.</div>`;
    for(const k of sl){
      const pick=accPickFor(d,k,later?null:cyc), list=accFor(k,pick);
      h+=`<div style="margin-top:8px"><div class="row between" style="gap:8px"><span class="acc-role">${esc(ASLOT[k].name)}</span><button class="btn sm ghost" data-act="accslotrm" data-day="${d}" data-slot="${k}">Remove</button></div>
      <select data-act-accpick="${d}:${k}" aria-label="${esc(ASLOT[k].name)} on ${esc(label)}">${list.map(x=>`<option value="${x}"${x===pick?' selected':''}>${esc(all[x].name)}${all[x].gear?' \u00b7 '+esc(all[x].gear):''}</option>`).join('')}</select>
      ${accIsSuper(d,k)||accCanSuper(d,k)?`<label class="check small"><input type="checkbox" data-act-super="${d}:${k}" ${accIsSuper(d,k)?'checked':''}> Superset with the next one</label>`:''}</div>`;
    }
    if(spare.length) h+=`<label class="f" style="margin-top:8px">Add a job<select data-act-accadd="${d}"><option value="">Choose\u2026</option>${spare.map(k=>`<option value="${k}">${esc(ASLOT[k].name)}</option>`).join('')}</select></label>`;
    h+=`</div>`;
  }

  const mine=accCustom();
  h+=`<div style="border-top:1px solid var(--line);padding-top:12px"><div class="small" style="font-weight:650">The list</div>
  <p class="small muted" style="margin:2px 0 0">${amAdmin
    ? 'The movements on offer are the shared list, which you curate from the <b>Admin</b> tab.'
    : 'The movements on offer are a shared list. If something you do is missing, ask and it can be added for everyone.'}</p>
  ${mine.length?`<div class="note" style="margin-top:6px">You also have ${mine.length} of your own from before the list was shared \u2014 ${esc(mine.map(x=>x.name).join(', '))} \u2014 and they still work wherever you have already chosen them.</div>`:''}</div>`;

  const legacy=Object.values(plan.acc||{}).some(a=>Array.isArray(a)&&a.length);
  if(legacy) h+=`<div class="banner info"><div class="small">Your old typed-in accessory lists have been replaced by the jobs above. Nothing was lost \u2014 they are still in your plan, and what you ticked on past days still shows on those days.</div></div>`;
  return h+`</div>`;
}

/* The books prescribe no mobility routine. TB1's warm-up is ten minutes of jogging or
   skipping plus warm-up sets; TB3 says to do warm-up sets as required, and to stretch
   a little longer if you are sore. Ageless Athlete is the only one to raise the
   subject and it hands the choice over: "If you have a flexibility or mobility
   protocol you like to follow (not a bad idea), incorporate that as much as you like."
   So this card offers a choice rather than a prescription, and says whose each one is. */
function warmSetupCard(){
  const cur=warmKey();
  const lines=warmMine().map(x=>x.d?x.n+', '+x.d:x.n).join('\n');
  let h=`<div class="card"><h2>Warm-up</h2>
  <p class="note" style="margin:0">None of the four books prescribe a mobility routine \u2014 TB1 asks for ten minutes of easy work and your warm-up sets, and <i>Ageless Athlete</i> says to bring a protocol of your own if you have one. So pick one.</p>
  <div class="seg wide">${Object.entries(WARM_ROUTINES).map(([k,r])=>`<button class="segb" data-act="warmroutine" data-v="${k}" aria-pressed="${k===cur}">${esc(r.name)}</button>`).join('')}</div>
  <div class="small muted">${esc(WARM_ROUTINES[cur].note)}</div>`;
  if(cur==='mine') h+=`<label class="f">Your warm-up<textarea id="warm-mine" data-warmmine rows="8" placeholder="Bike or rower, 5 min\nHip airplane, 8 per side">${esc(lines)}</textarea></label>`;
  h+=`<div class="note"><b>90/90 breathing</b> and <b>90/90 hip switches</b> are in every one of these, including yours \u2014 they are the two we keep whatever else changes.</div>`;
  const items=warmItems();
  h+=`<div class="small muted">${items.length} movement${items.length===1?'':'s'}: ${esc(items.map(x=>x.n).join(' \u00b7 '))}</div>`;
  return h+`</div>`;
}

function archiveBanner(){
  if(schemaAhead) return `<div class="banner alert"><div><b>This copy of the app is out of date.</b> Your training data was last saved by a newer version, and writing to it from here could undo something. Nothing will be saved until you reload. If reloading does not help, close the app and open it again.</div><div><button class="btn sm primary" data-act="reload">Reload</button></div></div>`;
  if(!viewing) return '';
  return `<div class="banner info"><div><b>Viewing ${esc(viewing.name)}</b> · ${fmtD(viewing.startMonday)} – ${fmtD(viewing.end)} · archived, read-only</div><div><button class="btn sm primary" data-act="progexit">Back to current program</button></div></div>`;
}
function programPicker(){
  const list=archiveList(); if(!list.length) return '';
  const cur=stash?stash.plan:plan;
  return `<div class="restsel"><span>Program</span><div class="seg"><button class="segb pv${!viewing?' on':''}" data-act="progexit">${esc(progName(cur))} (current)</button>${list.map(p=>`<button class="segb pv${viewing&&viewing.id===p.id?' on':''}" data-act="progview" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>`;
}
// Maxes to carry into a new program: next cycle's if a review or retest already set
// them, otherwise the current cycle's.
function carryMaxes(){
  const wk=weekOf(realToday()); let c=1;
  if(wk) c=wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle||1);
  const cur=maxFor(c), nx=maxFor(c+1), out={};
  for(const k of LK){const pick=nx[k]&&nx[k].src==='set'?nx[k]:cur[k]; if(pick) out[k]=pick.v}
  return out;
}
function programsCard(){
  if(viewing) return '';
  const list=archiveList(), cm=carryMaxes();
  let h=`<div class="card"><h2>Programs and archive</h2><div class="grid2"><label class="f">Current program<input type="text" id="p-pname" data-pbind="programName" value="${esc(plan.programName||'')}" placeholder="${esc(progName())}"></label><label class="f">Started<input type="text" value="${fmtLong(plan.startMonday)}" disabled></label></div>`;
  if(list.length) h+=`<div class="stack small">${list.map(p=>`<div class="row between"><span><b>${esc(p.name)}</b> <span class="muted">${fmtD(p.startMonday)}–${fmtD(p.end)}</span></span><button class="btn sm" data-act="progview" data-id="${p.id}">View</button></div>`).join('')}</div>`;
  if(!newProg) h+=`<div class="row"><button class="btn" data-act="prognew">Start a new program…</button><button class="btn ghost" data-act="wzrerun">Run welcome setup again</button></div>`;
  else {
    const carried=activeLifts().filter(k=>cm[k]!=null).map(k=>esc(liftName(k))+' '+(isBW(k)?'+':'')+n(cm[k])).join(' · ')||'no maxes yet';
    h+=`<div class="stack" style="gap:10px;border-top:1px solid var(--line);padding-top:12px">
    <div class="grid2"><label class="f">New program name<input type="text" id="np-name" data-np="name" value="${esc(newProg.name)}"></label><label class="f">Starts (week of)<input type="date" id="np-start" data-np="start" value="${newProg.start}"></label></div>
    <label class="check"><input type="radio" name="np-mode" id="np-carry" data-np="mode" value="carry" ${newProg.mode==='carry'?'checked':''}> <span>Carry my maxes forward <span class="small muted">(${carried})</span></span></label>
    <label class="check"><input type="radio" name="np-mode" id="np-bridge" data-np="mode" value="bridge" ${newProg.mode==='bridge'?'checked':''}> <span>Start with a bridge week and re-test <span class="small muted">(your current maxes show on test days for reference)</span></span></label>
    <p class="note" style="margin:0">${esc(progName())} will be archived. Its calendar, maxes, reviews and every logged session stay viewable here and from History, Status and Plan. Your settings (Lift 3, accessories, rest times, conditioning, wave and deload rules) carry over.</p>
    ${newProg.err?`<div class="banner warn"><div class="small">${esc(newProg.err)}</div></div>`:''}
    <div class="row"><button class="btn primary" data-act="progstart">${newProg.arm?'Tap again to confirm':'Archive and start '+esc(newProg.name||'new program')}</button><button class="btn ghost" data-act="progcancel">Cancel</button></div></div>`;
  }
  return h+`</div>`;
}
function startProgram(){
  const np=newProg, start=mondayOf(np.start||realToday());
  if(start<=plan.startMonday){np.err='The new program has to start after '+fmtLong(plan.startMonday)+'.';np.arm=false;render();return}
  if(start<mondayOf(realToday())){np.err='Pick this week or a later one. Past weeks belong to the current program.';np.arm=false;render();return}
  const end=addDays(start,-1), oldName=progName();
  // Stamp format and activity on this program's conditioning entries so they keep
  // their meaning once the plan that implied them is archived.
  for(const [d,L] of Object.entries(logs)) if(d>=plan.startMonday&&d<=end&&L.hic){const f=effFmt(d);if(f&&!L.hic.format)setLog(d,'hic.format',f);if(!L.hic.mod)setLog(d,'hic.mod',modOf(d))}
  let id='p-'+plan.startMonday.replace(/-/g,''); while(programs[id]) id+='b';
  programs[id]={id,name:oldName,startMonday:plan.startMonday,end,archivedAt:realToday(),plan:clone(plan)};
  queueWrite('programs/'+id,()=>programs[id]);
  const cm=carryMaxes(), keep={}; for(const k of PREF_KEYS) if(plan[k]!==undefined) keep[k]=clone(plan[k]);
  const next=deepMerge(clone(DEF),keep);
  next.startMonday=start; next.programName=np.name||('Block '+((plan.programSeq||1)+1)); next.programSeq=(plan.programSeq||1)+1;
  if(np.mode==='carry'){next.bridge=false;next.maxes=Object.assign({},clone(DEF.maxes),cm)}
  else {next.bridge=true;next.maxes=clone(DEF.maxes);next.prevMaxes=cm}
  plan=next; planV++; queueWrite('plan/main',()=>plan);
  newProg=null; sel=realToday(); view='today'; render(); window.scrollTo(0,0);
}

/* ---------------- rearranging in the calendar ----------------
Pick a session, pick the day, done. There is no mode to turn on first and no chooser
afterwards, because there is only one thing a move can mean now: that session happens
on that day. `calMove` holds the session being carried, as {monday, slot, from}. */
let calMove=null;
/* A tap and a drop both land here. The first tap picks a session up -- the first one
   on the day, since a cell that holds two shows both and either is a reasonable thing
   to mean -- and the second puts it down. */
function calTarget(d){
  if(!d||viewing) return false;
  if(!calMove){
    const ss=dayPlans(d); if(!ss.length) return false;
    calMove={monday:ss[0].sess.monday,slot:ss[0].sess.slot,from:d}; render(); return true;
  }
  if(calMove.from===d){ calMove=null; render(); return true }
  if(idxOf(d)<0) return false;
  offerUndo('Session moved',snapPlan());
  moveSession(calMove.monday,calMove.slot,d);
  calMove=null; openWarm.clear(); openPx.clear(); render();
  return true;
}
function calCancel(){ calMove=null; render() }
function calCard(){
  const t=realToday();
  if(!calMonth) calMonth=(viewing?viewing.end:(sel||t)).slice(0,7);
  const y=+calMonth.slice(0,4), m=+calMonth.slice(5,7);
  const first=S(Date.UTC(y,m-1,1)), last=S(Date.UTC(y,m,0)), start=mondayOf(first);
  const rows=Math.round(((D(mondayOf(last))-D(start))/864e5)/7)+1;
  const live=!viewing;
  // Dragging needs touch-action off the cells, and it is always available now, so the
  // class goes on whenever the calendar is live rather than only in a mode.
  if(document.body) document.body.classList.toggle('rearranging',!!live);
  let h=`<div class="card"><div class="dnav"><button class="btn sm ghost" data-act="calm" data-v="-1" aria-label="Previous month">\u2039</button><h2 style="flex:1;text-align:center">${MON[m-1]} ${y}</h2><button class="btn sm ghost" data-act="calm" data-v="1" aria-label="Next month">\u203a</button></div>`;
  if(live&&calMonth!==t.slice(0,7)) h+=`<div class="row"><button class="btn sm ghost" data-act="calm" data-v="0">This month</button></div>`;
  if(live) h+=`<div class="banner info"><div class="small">${calMove
    ? `Carrying <b>${esc(dayPlanSlot(addDays(calMove.monday,calMove.slot),calMove.slot).short||'Session')}</b>. Tap the day to do it on \u2014 any day, any week. Nothing else will move.`
    : 'Drag a session to another day, or tap it and then tap where it should go. Only what you move moves; a day can hold more than one, and a day with none is a rest day.'}</div>${calMove?`<div class="row"><button class="btn sm ghost" data-act="calcancel">Cancel</button></div>`:''}</div>`;
  h+=`<div class="cal"><div class="cal-h">${DAYN.map(d=>`<span>${d[0]}</span>`).join('')}</div>`;
  for(let r=0;r<rows;r++){
    const mon=addDays(start,r*7), wk=weekOf(mon), wt=wk?weekTitle(wk):null;
    h+=`<div class="cal-w">${wt?`<b>${esc(wt.t)}</b><span class="chip ${wt.cls}">${esc(wt.chip)}</span>${isReordered(mon)?'<span class="chip blue">days moved</span>':''}`:'<span class="muted">Before the program starts</span>'}</div>`;
    for(let i=0;i<7;i++){
      const d=addDays(mon,i), ss=dayPlans(d), out=d<first||d>last, st=sessState(d,t);
      const picked=!!(calMove&&calMove.from===d), moved=ss.some(x=>x.moved);
      const lbl=ss.length?ss.map(x=>x.short||'Session').join(' + '):'';
      h+=`<button class="cal-d${out?' out':''}${d===t?' today':''}${d===sel&&!calMove?' sel':''}${picked?' picked':''}${moved?' shifted':''}" data-act="${live?'calpick':'open'}" data-date="${d}" aria-label="${fmtLong(d)} ${esc(lbl)}"><span class="n">${+d.slice(8)}</span><span class="l">${esc(lbl)}</span><span class="dot ${calMove?'':st}"></span></button>`;
    }
  }
  h+=`</div>`;
  if(!calMove) h+=`<div class="row small muted" style="gap:12px"><span><i class="lg done"></i>done</span><span><i class="lg missed"></i>missed</span></div>`;
  return h+`</div>`;
}
function vPlan(){
  const head=`<div class="card" style="padding:10px 12px"><div class="seg">${[['list','Weeks'],['cal','Calendar']].map(([v,l])=>`<button class="segb${planMode===v?' on':''}" data-act="planmode" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  return head+(planMode==='cal'?calCard():vPlanList());
}
function vPlanList(){
  const t=todayStr(), ti=Math.max(0,idxOf(t)), list=weeks(ti+planShow+2), from=Math.max(0,ti-4), to=ti+planShow;
  let h=`<div class="card" style="gap:6px"><h2>Plan</h2><p class="note" style="margin:0">Cycles run back to back forever. Deload every ${+plan.deloadEvery?plan.deloadEvery+' cycle'+(plan.deloadEvery>1?'s':''):'— (off)'} · retest every ${+plan.testEvery?plan.testEvery+' cycle'+(plan.testEvery>1?'s':''):'— (off)'}. Add a deload, retest or off week anywhere; everything after it shifts back a week.</p></div><div class="card" style="gap:0;padding-block:4px">`;
  for(let i=from;i<=to&&i<list.length;i++){
    const wk=list[i], wt=weekTitle(wk), past=wk.idx<ti, cur=wk.idx===ti;
    let done=0,tot=0; for(let d=0;d<7;d++){const dd=addDays(wk.monday,d),p=dayPlan(dd); if(p.t!=='off'){tot++; if(lg(dd).done) done++}}
    const hol=[];for(let d=0;d<7;d++){const dd=addDays(wk.monday,d),x=holidayOn(dd);if(x)hol.push(x)}
    let sub=[];
    if(wk.kind==='cycle') sub.push('Plyo: '+plyoPhase(wk).name);
    if(wk.kind==='cycle'&&wk.w===1){const m=maxFor(wk.cycle);sub.push(activeLifts().map(k=>m[k]?n(m[k].v):'—').join(' / '))}
    if(hol.length) sub.push('⚑ '+hol.join(', '));
    let menu='';
    if(!past){
      const opts=[];
      if(wk.kind==='bb') opts.push(`<button class="btn sm" data-act="bbremove" data-monday="${wk.monday}">Remove the whole block</button>`);
      else if(wk.inserted) opts.push(`<button class="btn sm" data-act="uninsert" data-monday="${wk.monday}">Remove this week</button>`);
      else if(wk.rule) opts.push(`<button class="btn sm" data-act="skip" data-rule="${wk.rule}">Skip this ${wk.kind==='test'?'retest':'deload'}</button>`);
      if(!wk.inserted) opts.push(`<span class="lbl">Start here instead</span><button class="btn sm" data-act="bbadd" data-monday="${wk.monday}" data-ver="standard">Base Building · 8 weeks</button><button class="btn sm ghost" data-act="bbadd" data-monday="${wk.monday}" data-ver="strength">Base Building · strength-first</button><button class="btn sm ghost" data-act="bbadd" data-monday="${wk.monday}" data-ver="mass">Base Building · TB III · 6 weeks</button>`);
      if(!wk.inserted) opts.push(`<span class="lbl">Insert this week</span>${['deload','test','bridge3','travel','off'].map(k=>`<button class="btn sm" data-act="insert" data-kind="${k}" data-monday="${wk.monday}">${{deload:'Deload',test:'Retest',bridge3:'Bridge · TB III',travel:'Travel',off:'Off week'}[k]}</button>`).join('')}`);
      menu=`<details class="menu"><summary>Change</summary><div class="pop">${opts.join('')}</div></details>`;
    }
    h+=`<div class="wk-row${cur?' cur':''}${past?' past':''}"><div class="wk-date">${fmtD(wk.monday)}–${fmtD(addDays(wk.monday,6))}</div><div class="wk-main"><div class="row" style="gap:8px"><span class="t">${wt.t}</span><span class="chip ${wt.cls}">${wt.chip}</span>${wk.inserted?'<span class="chip">Added</span>':''}</div>${sub.length?`<div class="small muted">${esc(sub.join(' · '))}</div>`:''}</div><div class="row" style="gap:6px;justify-content:flex-end">${done?`<span class="small mono muted">${done}/${tot}</span>`:''}${menu}</div></div>`;
  }
  h+=`</div><div class="row"><button class="btn" data-act="more">Show 26 more weeks</button></div>`;
  const sk=Object.keys(plan.skips||{}).filter(k=>plan.skips[k]);
  if(sk.length) h+=`<div class="card"><h3>Skipped</h3><div class="row">${sk.map(k=>{const [kind,c]=k.split('@');return `<button class="btn sm" data-act="unskip" data-rule="${k}">Restore ${kind==='test'?'retest':'deload'} after Cycle ${c}</button>`}).join('')}</div></div>`;
  return h;
}

function vHistory(){
  const t=todayStr(), wk=weekOf(t), curC=wk?(wk.kind==='cycle'?wk.cycle:(wk.nextCycle||wk.refCycle)):1;
  const list=weeks(), range={};
  for(const w of list){ if(w.kind==='cycle'){ (range[w.cycle]||(range[w.cycle]={a:w.monday,b:w.monday})).b=w.monday } }
  let h=sixMonthCard(t)+reportsCard()+`<div class="card"><h2>Maxes by cycle</h2><p class="note" style="margin:0">Type a number to override a cycle. Blank cells follow the previous cycle plus the increment. Later cycles update automatically.</p><div class="tbl-wrap"><table><thead><tr><th>Cycle</th><th>Dates</th>${activeLifts().map(k=>`<th class="n">${esc(liftName(k))}</th>`).join('')}</tr></thead><tbody>`;
  for(let c=1;c<=curC+(viewing?0:2);c++){
    const m=maxFor(c), r=range[c], o=plan.cycleMaxes[c]||{};
    h+=`<tr class="${c===curC?'cur':c<curC?'past':''}"><td><b>${c}</b></td><td class="small mono">${r?fmtD(r.a)+'–'+fmtD(addDays(r.b,4)):''}</td>${activeLifts().map(k=>c===1&&(o[k]==null||o[k]==='')?`<td class="n"><span title="Set in Setup">${m[k]?n(m[k].v):'—'}</span></td>`:`<td class="n"><input type="number" inputmode="decimal" step="any" id="cm-${c}-${k}" data-cmax="${c}.${k}" value="${o[k]??''}" placeholder="${m[k]?n(m[k].v):''}" aria-label="Cycle ${c} ${esc(liftName(k))}"></td>`).join('')}</tr>`;
  }
  h+=`</tbody></table>`;
  // The line per lift, moved here from Status: a trend belongs where the table is.
  {
    let g='', anyChart=false;
    for(const k of activeLifts()){
      const pts=[];for(let c=1;c<=curC+(viewing?0:1);c++){const m=maxFor(c)[k];if(m)pts.push({y:m.v,xl:'C'+c,hollow:c>curC,tip:`Cycle ${c}: ${n(m.v)} ${u()}${m.src==='set'?' (tested/set)':m.src==='proj'?' (projected)':''}`})}
      const cur=maxFor(curC)[k], base=maxFor(1)[k], hv=heavySet(k);
      if(pts.length<2&&!hv) continue;
      if(pts.length>=2) anyChart=true;
      // Where the number came from. A set logged heavier than prescribed is the only
      // thing here that is evidence of a new max rather than a restatement of the old.
      let note='';
      if(hv){
        let say='';
        if(hv.off){ const d=Math.round(hv.e-hv.max);
          say=` You logged your own weight, which implies <b class="mono">${n(Math.round(hv.e))}</b> — ${d===0?'the max it replaced':(d>0?n(d)+' '+u()+' above':n(-d)+' '+u()+' below')+' the max for that cycle'}.`; }
        else if(hv.grinder) say=' It ground, which is what the end-of-cycle review reads.';
        note=`<div class="small muted">Heaviest set completed: <b class="mono">${fmtLoad(k,hv.w)} × ${hv.r}</b> at ${hv.p}% on ${fmtD(hv.d,true)}.${say}</div>`;
      }
      g+=`<div class="sm"><div class="sm-h"><b>${esc(liftName(k))}</b>${cur?`<span class="v">${n(cur.v)}<small>${u()}${base&&cur.v!==base.v?` · ${cur.v>base.v?'+':''}${n(cur.v-base.v)} since C1`:''}</small></span>`:''}</div>${pts.length>=2?lineChart(pts,{label:liftName(k)+' max by cycle',minStep:+plan.round[k]||5}):''}${note}</div>`;
    }
    if(g) h+=`<div class="sm-grid" style="margin-top:16px">${g}</div>${anyChart?'<div class="small muted">Hollow is next cycle, projected.</div>':''}`;
  }
  h+=`</div>`;
  // Recovery
  const cis=progLogs().filter(([d,L])=>L.checkin&&readiness(L.checkin)!=null).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,14);
  h+=`<div class="card"><h2>Recovery</h2>`;
  if(!cis.length) h+=`<div class="empty">No check-ins yet. Answer the daily check-in on the Today tab and your readiness trend shows up here.</div>`;
  else{
    const avg=(f)=>{const xs=cis.slice(0,7).map(([d,L])=>L.checkin[f]).filter(v=>v!=null&&v!=='').map(Number);return xs.length?(xs.reduce((a,b)=>a+b,0)/xs.length):null};
    const ar=cis.slice(0,7).map(([d,L])=>readiness(L.checkin));const ra=ar.reduce((a,b)=>a+b,0)/ar.length;
    h+=`<div class="grid3"><div class="stack" style="gap:2px"><span class="small muted">Readiness · last 7</span><span class="big" style="font-size:34px">${Math.round(ra)}</span></div><div class="stack" style="gap:2px"><span class="small muted">Sleep · last 7</span><span class="big" style="font-size:34px">${avg('sleepH')!=null?avg('sleepH').toFixed(1):'—'}<small>h</small></span></div><div class="stack" style="gap:2px"><span class="small muted">Bodyweight</span><span class="big" style="font-size:34px">${latestBw(todayStr())?n(latestBw(todayStr())):'—'}<small>${u()}</small></span></div></div>`;
    const rd=[];for(let i=27;i>=0;i--){const d=addDays(t,-i),r=readiness(ci(d));if(r!=null)rd.push({d,r})}
    if(rd.length>=2) h+=`<div class="sm" style="margin:12px 0"><div class="sm-h"><b>Readiness \u00b7 28 days</b><span class="v">${rd[rd.length-1].r}<small>latest</small></span></div>${lineChart(rd.map(x=>({y:x.r,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: readiness ${x.r}`})),{min:0,max:100,label:'Readiness'})}</div>`;
    h+=`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Ready</th><th class="n">Sleep</th><th class="n">Energy</th><th class="n">Sore</th><th class="n">BW</th></tr></thead><tbody>${cis.map(([d,L])=>{const c=L.checkin,r=readiness(c),lv=rLevel(r);return `<tr><td>${fmtD(d,true)}</td><td class="n"><span class="chip ${lv.cls}">${r}</span></td><td class="n">${c.sleepH!=null&&c.sleepH!==''?n(c.sleepH):'—'}</td><td class="n">${c.energy||'—'}</td><td class="n">${c.soreness||'—'}</td><td class="n">${c.bw?n(c.bw):'—'}</td></tr>`}).join('')}</tbody></table></div>`;
  }
  h+=`</div>`;
  // HIC
  const hic=hicSessions().reverse();
  h+=`<div class="card"><h2>Conditioning</h2>`;
  if(!hic.length) h+=`<div class="empty">No conditioning logged yet. Results you enter on HIC and LISS days show up here.</div>`;
  else{
    const groups={};for(const x of hic) if(x.f!=='liss'&&x.v!=null)(groups[x.mod+'|'+x.f]=groups[x.mod+'|'+x.f]||[]).push(x);
    const top=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length).slice(0,4);
    if(top.length) h+=`<div class="grid4">${top.map(key=>{const xs=groups[key],[m,f]=key.split('|'),b=xs.reduce((a,x)=>Math.max(a,x.v),0);return `<div class="stack" style="gap:2px"><span class="small muted">${MOD[m].name} · ${HIC[f].name}</span><span class="big" style="font-size:34px">${n(b)}<small style="font-size:13px;color:var(--muted);margin-left:3px">${esc(xs[0].u)}</small></span><span class="small muted">best · ${xs.length} logged</span></div>`}).join('')}</div>`;
    {
      const keys=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length).slice(0,6);
      const g=keys.map(key=>{const xs=groups[key].slice().reverse().slice(-24),[m,f]=key.split('|'),best=xs.reduce((a,x)=>Math.max(a,x.v),0),un=xs[xs.length-1].u;
        if(xs.length<2) return '';
        return `<div class="sm"><div class="sm-h"><b>${MOD[m].name} \u00b7 ${HIC[f].name}</b><span class="v">${n(best)}<small>${esc(un)} best</small></span></div>${lineChart(xs.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${n(x.v)} ${x.u}`})),{label:MOD[m].name+' '+HIC[f].name,minStep:1})}</div>`}).filter(Boolean).join('');
      if(g) h+=`<div class="sm-grid" style="margin:16px 0">${g}</div>`;
    }
    h+=`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Format</th><th>Activity</th><th class="n">Result</th></tr></thead><tbody>${hic.slice(0,20).map(x=>`<tr><td>${fmtD(x.d,true)}</td><td>${HIC[x.f].name}</td><td>${esc(x.mod==='other'&&x.what?x.what:MOD[x.mod].name)}${x.load?` <span class="small muted">(${n(x.load)} ${u()})</span>`:''}</td><td class="n">${[x.v!=null?n(x.v)+' '+x.u:'',x.min?x.min+' min':'',x.elev?'↑'+n(x.elev)+' '+elevUnit():'',flatEquiv(x)!=null?'≈ '+n(flatEquiv(x))+' '+x.u+' flat':''].filter(Boolean).join(' · ')||'—'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  h+=`</div>`;
  // Jumps
  const jm=progLogs().filter(([d,L])=>(L.plyo&&(L.plyo.best||L.plyo.mark))||(L.jumps&&(L.jumps.broad||L.jumps.vertical))).sort((a,b)=>a[0]<b[0]?1:-1);
  h+=`<div class="card"><h2>Jumps</h2>`;
  {
    const bj=jm.map(([d,L])=>({d,v:+((L.jumps&&L.jumps.broad)||(L.plyo&&(L.plyo.best||L.plyo.mark))||0)})).filter(x=>x.v).sort((a,b)=>a.d<b.d?-1:1).slice(-24);
    if(bj.length>=2) h+=`<div class="sm" style="margin-bottom:12px"><div class="sm-h"><b>Broad jump</b><span class="v">${r1(Math.max(...bj.map(x=>x.v)))}<small>in best</small></span></div>${lineChart(bj.map(x=>({y:x.v,xl:fmtD(x.d),tip:`${fmtD(x.d,true)}: ${r1(x.v)} in`})),{label:'Broad jump',minStep:1})}</div>`;
  }
  h+=jm.length?`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th class="n">Broad</th><th class="n">Vertical</th><th class="n">Triple</th></tr></thead><tbody>${jm.slice(0,15).map(([d,L])=>`<tr><td>${fmtD(d,true)}</td><td class="n">${n((L.jumps&&L.jumps.broad)||(L.plyo&&(L.plyo.best||L.plyo.mark)))}</td><td class="n">${n(L.jumps&&L.jumps.vertical)}</td><td class="n">${n(L.jumps&&L.jumps.triple)}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">No jumps yet. Log Thursday's first broad jump on the plyo card, or a full set on a test day.</div>`;
  h+=`</div>`;
  // Sessions
  const ss=progLogs().filter(([d,L])=>L.done||L.notes).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,20);
  h+=`<div class="card"><h2>Recent sessions</h2>`+(ss.length?`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Session</th><th class="n">RPE</th><th>Notes</th></tr></thead><tbody>${ss.map(([d,L])=>`<tr><td><button class="btn sm ghost" data-act="open" data-date="${d}">${fmtD(d,true)}</button></td><td>${esc(dayPlan(d).short||'')}</td><td class="n">${L.rpe||'—'}</td><td class="small">${esc((L.notes||'').slice(0,80))}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">Nothing logged yet. Mark a session done on Today and it appears here with its RPE and notes.</div>`)+`</div>`;
  return h;
}

function pIn(path,val,attrs){return `<input type="number" inputmode="decimal" step="any" id="p-${path.replace(/\./g,'-')}" data-pbind="${path}" data-type="num" value="${val??''}" ${attrs||''}>`+oddNote(path,val)}
// Zulu runs half the cluster at a time. Which lifts are in which half is yours: TB's
// whole cluster idea is that you choose the lifts, and the book's own suggested splits
// differ from one example to the next.
function halvesCard(){
  const H=halvesOf();
  const label=k=>k==='l3'?'Lift 3 ('+esc(liftName(l3On()[0]).toLowerCase())+' etc.)':esc(liftName(k));
  const where=k=>H.a.includes(k)?'a':H.b.includes(k)?'b':'';
  let h=`<div class="restsel" style="display:block"><span>The two halves</span>
  <div class="stack" style="gap:6px;margin-top:6px">`;
  for(const k of HALF_KEYS){
    const w=where(k);
    h+=`<div class="row between" style="gap:8px"><span class="acc-role">${label(k)}</span>
    <div class="seg">${[['a','A'],['b','B'],['','Off']].map(([v,t])=>`<button class="segb${w===v?' on':''}" data-act="half" data-k="${k}" data-v="${v}" aria-pressed="${w===v}">${t}</button>`).join('')}</div></div>`;
  }
  h+=`</div><div class="note" style="margin-top:6px">A is ${esc(H.a.map(k=>k==='l3'?'Lift 3':liftName(k)).join(' + '))} \u00b7 B is ${esc(H.b.map(k=>k==='l3'?'Lift 3':liftName(k)).join(' + '))}. The book's suggestion is bench and squat against deadlift and overhead press. A half left empty falls back to the default.</div></div>`;
  return h;
}
// One row of seven, with every chosen day lit and numbered when there are two. `act` is
// the click action to fire, so the wizard and Setup draw the identical control.
function plyoDayRow(days,per,act){
  const order=days.slice().sort((a,b)=>a-b);
  return `<div class="row wrap" style="gap:6px">${DAYN.map((nm,i)=>{
    const at=order.indexOf(i), on=at>=0;
    return `<button class="btn sm${on?' primary':''}" data-act="${act}" data-v="${i}" aria-pressed="${on}">${nm}${on&&per===2?` <small>${at+1}</small>`:''}</button>`;
  }).join('')}</div>`;
}
// Plyos: everything about them that is a setting, in one card like every other part of
// the program. Moving a session for a single week is the Move… sheet's job, not this
// one, and the phases and exercises are in the Guide where the rest of the reference is.
function plyoCardSetup(){
  const on=plan.plyoOn!==false, d=plyoDowDefault(), two=plyoPerWeek()===2;
  let h=`<div class="card"><div class="lift-h"><h2>Plyometrics</h2><span class="chip ${on?'light':''}">${on?(two?esc(DAYN[d])+' and '+esc(DAYN[plyoDow2()]):esc(DAYN[d])):'Off'}</span></div>
  <p class="note" style="margin:0">Jumps and bounds, in three-week phases. They are not part of a session: they go first on whatever day they land on, with ten minutes before hard conditioning.</p>
  <label class="check"><input type="checkbox" id="p-plyoon" data-pbind="plyoOn" ${on?'checked':''}> Schedule plyometrics</label>`;
  if(on){
    h+=`<label class="f">Sessions a week<div class="seg">${[[1,'One'],[2,'Two, shorter']].map(([v,l])=>`<button class="segb${plyoPerWeek()===v?' on':''}" data-act="plyoper" data-v="${v}" aria-pressed="${plyoPerWeek()===v}">${l}</button>`).join('')}</div></label>
    <div class="note">${two?'The week\u2019s contacts are split across the two rather than doubled, so this is the same work with fresher reps in it. Two a week is the usual recommendation, with 48 to 72 hours between them.':'One session carrying the whole phase target.'} How much volume a week is the app\u2019s own call \u2014 published figures disagree enough that keeping the week\u2019s total fixed is the honest reading.</div>
    <label class="f">${two?'Which two days':'Which day'}${plyoDayRow(two?[d,plyoDow2()]:[d],plyoPerWeek(),'plyodow')}</label>
    ${two?'<div class="note">Both are lit, numbered in the order the week runs them. Tapping a third replaces whichever you picked longer ago.</div>':''}`;
    const ws=plyoWarnings(stemplKey(),cprotoKey(),d,(plan.cardio||{}).def);
    if(ws.length) h+=`<div class="banner warn"><div class="small">${ws.map(x=>`<div style="margin-top:4px">${esc(x.text)}</div>`).join('')}</div></div>`;
    h+=`<div class="note">To shift a session for one week only, use <b>Move\u2026</b> on any day of that week. The phases, the exercises and the pull-back rules are in the Guide.</div>`;
  } else h+=`<div class="note">Nothing is lost by leaving them off \u2014 jumps you have already logged stay, and the day goes back to whatever else it had.</div>`;
  return h+`</div>`;
}
// Which program you are running. Two choices, composed into a week — see 00b-templates.js.
function templateCard(){
  const T=stemplOf(), P=cprotoOf(), keys=Object.keys(STEMPL), pkeys=Object.keys(CPROTO);
  const days=P.noStrength?0:T.days.length, hard=(typeof P.sessions==='function'?P.sessions({w:1}):P.sessions||[]).length;
  let h=`<div class="card"><div class="lift-h"><h2>Template and protocol</h2><span class="chip light">${esc(T.name)} + ${esc(P.name)}</span></div>
  <p class="note" style="margin:0">Your strength template and your conditioning protocol are separate choices, the way the books put them. The week is built from the two: ${days} lifting day${days===1?'':'s'} and ${hard} conditioning session${hard===1?'':'s'}, laid out so no two hard days land together and a rest day survives.</p>`;
  if(keys.length>1){
    h+=`<label class="f">Strength template<select id="p-stempl" data-pbind="stempl">${keys.map(k=>`<option value="${k}"${k===stemplKey()?' selected':''}>${esc(STEMPL[k].name)} · ${tplDays(STEMPL[k],{w:1}).length} day${tplDays(STEMPL[k],{w:1}).length===1?'':'s'} · ${esc(STEMPL[k].book)}</option>`).join('')}</select></label>
    <div class="small muted">${esc(T.blurb)}</div>`;
  }
  if(pkeys.length>1){
    h+=`<label class="f">Conditioning protocol<select id="p-cproto" data-pbind="cproto">${pkeys.map(k=>`<option value="${k}"${k===cprotoKey()?' selected':''}>${esc(CPROTO[k].name)} · ${esc(CPROTO[k].book)}</option>`).join('')}</select></label>
    <div class="small muted">${esc(P.blurb)}</div>`;
  }
  if(P.noStrength) h+=`<div class="banner info"><div class="small">${esc(P.name)} does no barbell work at all \u2014 the book is explicit about it \u2014 so your strength template is set aside while this protocol is running. It comes back the moment you switch off it.</div></div>`;
  else if(T.split) h+=halvesCard();
  const warn=programWarnings(stemplKey(),cprotoKey(),false);
  if(warn.length) h+=`<div class="banner info"><div class="small"><b>Worth knowing:</b>${warn.map(x=>`<div style="margin-top:4px">${esc(x.text)}</div>`).join('')}</div></div>`;
  h+=`<div class="note">Changing either re-draws this week and every week after it. Weeks you have already trained keep the program they were done under, so your history stays what it was. Each template keeps its own wave below, so switching back and forth does not lose your numbers.</div>`;
  return h+`</div>`;
}
/* The Ageless Athlete preset. It writes three real settings rather than layering a
   hidden mode over them, so each one stays visible in Setup and individually
   reversible. `agelessOn()` is what the card checks to know it has been applied. */
function agelessPreset(p){
  p.recovery313=true;
  p.basis='tm';
  if(!(+p.tmPct)||+p.tmPct>90) p.tmPct=90;
  p.deloadEvery=0;
}
function agelessOn(){
  return !!plan.recovery313&&plan.basis==='tm'&&(+plan.tmPct||90)<=90&&!(+plan.deloadEvery);
}
/* Setup had grown to twenty-seven cards on one scroll, in the order they happened to
   be written: Maxes near the top, the wave and the cycle rules twenty cards below it,
   and three different cards called some form of "Program".

   Rather than rewrite two hundred lines of string building -- which is how you lose a
   card -- each one is preceded by a sentinel naming its section, and the finished
   HTML is split on those and regrouped. The sentinel is a NUL, which cannot occur in
   anything esc() produces, so the split cannot be fooled by content. */
const SETUP_SECS=[['program','Program'],['training','Training'],['sound','Alerts and sound'],
  ['you','About you'],['data','Your data'],['app','This app']];
const SEC=k=>'\u0000'+k+'\u0000';
/* Which sections are open, as a set rather than one name.

   Setup re-renders on every field change, and a <details> keeps its open state in the
   DOM, so anything not written down here collapses the moment you type. This codebase
   already learned that with the mobility panels (`openPx`): open state is state, not
   DOM. More than one section can be open at once, which is the whole point of
   remembering a set. */
let setupSecs=null;
function setupOpen(){
  if(setupSecs) return setupSecs;
  let v=null;
  try{ v=JSON.parse(localStorage.getItem('ob.setupsec')||'null') }catch(e){}
  const keys=SETUP_SECS.map(([k])=>k);
  setupSecs=new Set(Array.isArray(v)?v.filter(k=>keys.includes(k)):['program']);
  return setupSecs;
}
function setSetupOpen(k,on){
  const set=setupOpen();
  if(on) set.add(k); else set.delete(k);
  try{ localStorage.setItem('ob.setupsec',JSON.stringify([...set])) }catch(e){}
  return set;
}
/* Group the chunks by the sentinel in front of them, then render one <details> per
   section. Anything emitted before the first sentinel is a bug rather than a section,
   so it is shown rather than silently dropped. */
function setupSections(html){
  // Anything before the first sentinel is deliberately outside the sections: the
  // account card is who you are signed in as and where you sign out, which should
  // not be two taps inside a collapsed group.
  const parts=html.split('\u0000'), loose=parts[0];
  const by={};
  for(let i=1;i<parts.length;i+=2){ const k=parts[i]; (by[k]=by[k]||[]).push(parts[i+1]||'') }
  const open=setupOpen();
  let out=loose;
  for(const [k,label] of SETUP_SECS){
    const body=(by[k]||[]).join('');
    if(!body.trim()) continue;
    const n=(body.match(/<h2>/g)||[]).length;
    out+=`<details class="setup-sec"${open.has(k)?' open':''} data-sec="${k}"><summary><b>${esc(label)}</b><span class="small muted">${n} setting${n===1?'':'s'}</span></summary>${body}</details>`;
  }
  return out;
}
function vSetup(){
  let h=`<div class="card" id="account"><h2>Account</h2><dl class="kv"><dt>Signed in</dt><dd>${esc(me||'Not signed in')}</dd></dl>
  <p class="note" style="margin:0">Sign-in goes through Cloudflare Access, and everything you log — plan, sessions, archived programs and backups — belongs to this address alone. Signing out leaves this phone’s copy in place; it syncs again the moment you sign back in.</p>
  <div class="row"><a class="btn" href="${signedOut?'/':'/cdn-cgi/access/logout'}">${signedOut?'Sign in':'Sign out'}</a><button class="btn ghost" data-act="view" data-view="guide">Guide</button></div></div>
  ${SEC('program')}<div class="card"><h2>Maxes</h2><p class="note" style="margin:0">True 1RM for Cycle 1. Later cycles add the increment below unless a retest or a manual override replaces it.</p>
  <div class="grid4">${activeLifts().map(k=>`<label class="f">${esc(liftName(k,todayStr()))} 1RM${isBW(k)?' (added)':''}${pIn('maxes.'+k,plan.maxes[k])}</label>`).join('')}</div>
  <details class="plain"><summary>Have a 5RM instead?</summary><div class="stack" style="margin-top:8px"><p class="small muted" style="margin:0">Enter a clean 5RM. The 1RM is the 5RM ÷ 0.87, rounded down.</p><div class="grid4">${activeLifts().filter(k=>!isBW(k)).map(k=>`<label class="f">${esc(liftName(k))} 5RM<input type="number" inputmode="decimal" step="any" id="c5-${k}" data-calc="${k}" value="${calc5[k]??''}"><span class="mono small">${calc5[k]?'→ '+n(floorTo(calc5[k]/.87,plan.round[k])):''}</span></label>`).join('')}</div><div><button class="btn sm" data-act="calc5">Use these as maxes</button></div></div></details></div>`;
  {
    const t=themePref();
    h+=SEC('app')+`<div class="card"><h2>Appearance</h2><p class="small muted" style="margin:0">Set per device, so your phone and laptop can differ.</p>
    <label class="f">Theme<div class="seg">${[['auto','Match device'],['light','Light'],['dark','Dark']].map(([v,l])=>`<button class="segb${t===v?' on':''}" data-act="theme" data-v="${v}">${l}</button>`).join('')}</div></label>
    <label class="check"><input type="checkbox" id="p-gym" data-act="gym" ${gymOn()?'checked':''}> <span>Gym mode: bigger buttons and stronger contrast for sweaty hands</span></label></div>`;
  }
  h+=SEC('program')+programsCard();
  h+=SEC('program')+templateCard();
  h+=SEC('program')+plyoCardSetup();
  h+=SEC('program')+`<div class="card"><h2>Start and units</h2><div class="grid2"><label class="f">Start (Monday of first week)<input type="date" id="p-start" data-pbind="startMonday" value="${plan.startMonday}"></label></div>
  <label class="check"><input type="checkbox" id="p-bridge" data-pbind="bridge" ${plan.bridge?'checked':''}> Begin with the bridge (calibration) week</label>
  <div class="grid4"><label class="f">Units<select id="p-unit" data-pbind="unit"><option value="lb"${u()==='lb'?' selected':''}>lb</option><option value="kg"${u()==='kg'?' selected':''}>kg</option></select></label><label class="f">Bar weight${pIn('bar',plan.bar)}</label><label class="f">Bodyweight${pIn('bodyweight',plan.bodyweight)}</label><label class="f">Percent of<select id="p-basis" data-pbind="basis"><option value="1rm"${plan.basis!=='tm'?' selected':''}>True 1RM</option><option value="tm"${plan.basis==='tm'?' selected':''}>Training max</option></select></label></div>
  <div class="stack" style="gap:6px"><div class="small muted" style="font-weight:650">Plates your gym has (${u()})</div><div class="seg">${ALL_PLATES[u()].map(v=>`<button class="segb${plateSet().includes(v)?' on':''}" data-act="platetoggle" data-v="${v}" aria-pressed="${plateSet().includes(v)}">${n(v)}</button>`).join('')}</div><div class="note">Plate math only uses these. If a weight can’t be loaded exactly, the lift card says so and shows the nearest you can load.</div></div>
  ${plan.basis==='tm'?`<label class="f" style="max-width:200px">Training max % of 1RM${pIn('tmPct',plan.tmPct)}</label>`:''}
  <div><div class="small muted" style="margin-bottom:6px;font-weight:650">Round working weights to</div><div class="grid4">${activeLifts().map(k=>`<label class="f">${esc(liftName(k))}${pIn('round.'+k,plan.round[k])}</label>`).join('')}</div></div></div>`;
  const on=l3On(), L3=plan.l3||{};
  h+=SEC('program')+`<div class="card"><h2>Lift 3</h2><p class="note" style="margin:0">Pick the variants you use on Mondays and Wednesdays. Each keeps its own max. With more than one, choose how they rotate. You can also swap on any day from the lift card.</p>
  <div class="stack">${L3K.map(k=>`<label class="check"><input type="checkbox" id="l3-${k}" data-pbind="l3.on.${k}" ${on.includes(k)&&(L3.on||{})[k]?'checked':''}> ${esc(liftName(k))}${k==='wpu'?' <span class="small muted">(percentages use bodyweight + added weight)</span>':''}</label>`).join('')}</div>
  ${on.length>1?`<div class="grid2"><label class="f">Rotation<select id="l3-mode" data-pbind="l3.mode">${[['same','Same every session'],['alt-day','Alternate Monday ↔ Wednesday'],['alt-week','Alternate each week'],['alt-cycle','Alternate each cycle']].map(([v,l])=>`<option value="${v}"${L3.mode===v?' selected':''}>${l}</option>`).join('')}</select></label>${L3.mode==='same'||!L3.mode?`<label class="f">Default<select id="l3-primary" data-pbind="l3.primary">${on.map(k=>`<option value="${k}"${L3.primary===k?' selected':''}>${esc(liftName(k))}</option>`).join('')}</select></label>`:''}</div>`:''}
  ${on.includes('pull')?`<div class="grid2"><label class="f">Pulldown name<input type="text" id="p-l3" data-pbind="lift3Name" value="${esc(plan.lift3Name)}"></label><label class="f">Machine and pin setting<input type="text" id="p-mn" data-pbind="machineNote" value="${esc(plan.machineNote)}" placeholder="e.g. Hammer Strength pulldown, seat 4"></label></div>`:''}
  ${on.some(k=>plan.maxes[k]==null||plan.maxes[k]==='')?`<div class="banner warn"><div class="small">Add a 1RM above for ${on.filter(k=>plan.maxes[k]==null||plan.maxes[k]==='').map(k=>liftName(k)).join(' and ')}. Until then its sessions show no working weight.</div></div>`:''}</div>`;
  {
    const sup=alertsSupport(), on=alertsOn();
    h+=SEC('sound')+`<div class="card"><div class="lift-h"><h2>Rest alerts</h2>${on?'<span class="chip light">On</span>':'<span class="chip">Off</span>'}</div><p class="note" style="margin:0">A notification when each rest ends, even with the phone locked or another app open. Set per device.</p>`;
    if(sup==='install') h+=`<div class="banner info"><div class="small">On iPhone, alerts only work in the home-screen app. In Safari tap <b>Share → Add to Home Screen</b>, open Operator from there, then turn alerts on. Needs iOS 16.4 or later.</div></div>`;
    else if(sup==='unsupported') h+=`<div class="small muted">This browser can’t receive push notifications.</div>`;
    else if(sup==='denied') h+=`<div class="banner warn"><div class="small">Notifications are blocked for this app. Turn them on in iOS Settings → Notifications → Operator, then come back here.</div></div>`;
    else h+=`<div class="row">${on?`<button class="btn" data-act="alerttest" ${alerts.busy?'disabled':''}>Send a test</button><button class="btn ghost" data-act="alertoff" ${alerts.busy?'disabled':''}>Turn off</button>`:`<button class="btn primary" data-act="alerton" ${alerts.busy?'disabled':''}>${alerts.busy?'Turning on…':'Turn on rest alerts'}</button>`}</div>`;
    if(alerts.msg) h+=`<div class="small">${esc(alerts.msg)}</div>`;
    // Open it when there is something wrong to see. A diagnostic folded away is a
    // diagnostic nobody reads, and this one exists because somebody is already stuck.
    const bad=(pushLast&&!pushLast.ok)||(pushStat&&!pushStat.busy&&!pushStat.err&&pushStat.devices===0);
    if(bad&&pushLast&&!pushLast.ok) h+=`<div class="banner alert"><div class="small"><b>The last alert was not scheduled.</b> ${esc(pushLast.what)} was ${esc(pushLast.d||'refused')}. That is why nothing arrived — the detail is below.</div></div>`;
    if(bad&&pushStat&&pushStat.devices===0) h+=`<div class="banner alert"><div class="small"><b>The server has no device registered for you.</b> There is nothing for it to push to. Turn alerts off and on again above.</div></div>`;
    h+=`<details class="plain" style="margin-top:10px"${bad?' open':''}><summary>Is it actually working?</summary>
      <p class="note" style="margin:6px 0">What this phone last asked the server for, and what the server says it is holding. Until 3.49 every one of those requests threw its answer away, so an alert that was never scheduled looked exactly like one that was.${pushLast?'':' <b>Nothing has been asked for yet on this build</b> — start a rest, then come back here.'}</p>
      <div class="mono small tlog">${esc(pushStatusText())}</div>
      ${pushAdvice().map(t=>`<div class="small" style="margin-top:6px">${esc(t)}</div>`).join('')}
      <div class="row" style="margin-top:8px"><button class="btn sm" data-act="pushcheck" ${pushStat&&pushStat.busy?'disabled':''}>${pushStat&&pushStat.busy?'Asking\u2026':'Ask the server'}</button><button class="btn sm ghost" data-act="pushcopy">Copy for a bug report</button></div>
    </details>`;
    h+=`<div class="note">Alerts use the standard notification sound. Silent mode and Focus apply, and they also show on a paired Apple Watch. With the app open you’ll get both the in-app beep and the notification.</div></div>`;
  }
  {
    const sm=soundMode(), SMN={duck:'Ducks music',takeover:'Takes over',silent:'Silent'};
    h+=SEC('sound')+`<div class="card"><div class="lift-h"><h2>Sound</h2><span class="chip ${sm==='silent'?'':'light'}">${SMN[sm]}</span></div>
    <p class="note" style="margin:0">iOS gives a web page one audio channel and one choice about it: share it with your music, or take it. There is no third option \u2014 a native app can ask for both at once, the web cannot.</p>
    <div class="stack" style="gap:6px">
      ${[['duck','Keep my music playing','The beep goes over the top and nothing pauses. Heard whenever the ring switch on the side of the phone is on \u2014 with the switch off, iOS silences it, and nothing a web app can do changes that.'],
         ['takeover','Always be audible','Heard even with the ring switch off, at the price of pausing your music for about a second each time.'],
         ['silent','No sound at all','Screen and vibration only. Rest alerts still arrive as notifications, which reach a paired Apple Watch as a tap.']]
        .map(([v,t,d])=>`<button class="btn${sm===v?' primary':''}" style="justify-content:flex-start;text-align:left;height:auto;padding:10px 12px" data-act="soundmode" data-v="${v}" aria-pressed="${sm===v}"><span><b>${sm===v?'\u2713 ':''}${t}</b><br><span class="small">${d}</span></span></button>`).join('')}
    </div>
    ${sm==='silent'?`<div class="note">The rest timer shows a <b>Silent</b> tag while this is on, so a quiet timer never looks like a broken one.</div>`:''}
    <div class="restsel" style="margin-top:10px"><span>Warning</span><div class="seg">${REST_WARNS.map(v=>`<button class="segb${restWarnSecs()===v?' on':''}" data-act="restwarn" data-v="${v}" aria-pressed="${restWarnSecs()===v}">${v?v+'s':'Off'}</button>`).join('')}</div></div>
    <div class="note">A short low tone before the rest ends, so you can get back under the bar rather than find out you are late. A tone and nothing spoken: on iPhone, speech can interrupt the audio, and a spoken warning was enough to cost you the beep at the end. Deliberately not the finishing sound — one low note against three rising ones — or you would have to look at the phone to tell which had happened. Skipped on a rest shorter than twice the warning.</div>
    <div class="note">Spoken cues follow this setting too. <b>On iPhone there is no way to vibrate</b> \u2014 Safari gives a web app no Vibration API at all \u2014 so sound, the screen and notifications are the whole of it there. Android buzzes whatever this is set to.</div></div>
    <div class="row"><button class="btn" data-act="beeptest">Test the beep</button></div>
    <p class="note" style="margin:0">Plays the rest-end alert right now, the same way the timer does, and says what it found. Use it on the phone you train with — what works on a laptop tells you nothing about the ringer switch.</p>
    ${beepSeen?`<div class="banner ${beepSeen.silent?'warn':'info'}"><div class="small">${beepAdvice(beepSeen).map(t=>`<div>${esc(t)}</div>`).join('')}
      <details class="plain" style="margin-top:6px"><summary>What the app saw</summary><div class="mono small" style="word-break:break-word;margin-top:4px">${esc(['mode '+beepSeen.mode,'silent '+beepSeen.silent,'vibrate '+(beepSeen.canVibrate?'yes':'no')+(beepSeen.vibrated?' (fired)':''),'clip '+beepSeen.media,'tones '+beepSeen.tones,'channel '+beepSeen.ctx,'session '+beepSeen.session,beepSeen.ua].join(' \u00b7 '))}</div></details></div>
      <div class="row"><button class="btn sm ghost" data-act="beepcopy">Copy for a bug report</button></div></div>`:''}
    <details class="plain" style="margin-top:10px"><summary>Timer log</summary>
      <p class="note" style="margin:6px 0">What the timers did on this phone: every sound and what the audio was doing when it was asked for, how late each rest\u2019s end was noticed, and when the screen lock was refused. It holds a whole interval session now, so if the beeps stop partway through, copy it straight after and the line where they stopped will still be in it.</p>
      <div class="mono small tlog">${esc(tlogText())}</div>
      <div class="row"><button class="btn sm ghost" data-act="tlogcopy">Copy the timer log</button></div>
    </details>`;
  }
  {
    const v=!!plan.voice&&!plan.quietTimer;
    h+=SEC('sound')+`<div class="card"><div class="lift-h"><h2>Spoken cues</h2>${v?'<span class="chip light">On</span>':'<span class="chip">Off</span>'}</div>
    <p class="note" style="margin:0">The app’s own voice, separate from notifications. It reads interval changes (“Round 3 of 8. Go hard.”) and what’s next when a rest ends.</p>
    <label class="check"><input type="checkbox" id="p-voice" data-pbind="voice" ${v?'checked':''}> Speak cues while the app is on screen</label>
    ${plan.quietTimer?`<div class="small" style="color:var(--muted)">Silent timers are on, so cues stay quiet whatever this says.</div>`:''}
    ${v?`<div><button class="btn" data-act="voicetest">Try a cue</button></div>`:''}
    <div class="note">Only while the app is on screen — iOS silences a web app the moment the phone locks. For a whole session, set Auto-Lock to Never. The <b>Send a test</b> button above is a notification, not speech: it will never be read aloud.</div></div>`;
  }
  {
    const fmtAt=t=>{if(!t)return '';const d=new Date(t);return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+', '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})};
    const status=!APP_VER||APP_VER==='dev'?'Version unknown in this preview.':!upd.latest?(upd.err||'Not checked yet.'):updateAvailable()?'A newer version is available.':'You’re on the latest version.';
    const latestV=tagVersion(upd.tag), rel=RELEASES[0];
    h+=SEC('app')+`<div class="card"><h2>About this app</h2><dl class="kv">
    <dt>This app</dt><dd><b>${esc(APP_VERSION)}</b> · ${esc(rel.title)} <span class="small muted">(${esc((APP_VER||'—').slice(0,8))})</span></dd>
    <dt>Latest</dt><dd>${latestV?`<b>${esc(latestV)}</b> `:''}<span class="small muted">${upd.latest?esc(upd.latest.slice(0,8)):'—'}${upd.at?` · deployed ${esc(fmtAt(upd.at))}`:''}</span></dd></dl>
    <div class="small">${esc(status)}${upd.checked?` <span class="muted">Last checked ${esc(new Date(upd.checked).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}))}.</span>`:''}</div>
    <div class="row">${updateAvailable()?'<button class="btn primary" data-act="updnow">Reload to update</button>':''}<button class="btn" data-act="updcheck" ${upd.busy?'disabled':''}>${upd.busy?'Checking…':'Check for updates'}</button></div>
    <div class="note">The app checks on its own whenever you open it or come back to it. If a new version is ready, a banner appears at the top.</div>
    <div><button class="btn" data-act="view" data-view="releases">What’s new in each release</button></div></div>`;
  }
  {
    const key=((plan.se||{}).cluster)in SE_CLUSTERS?plan.se.cluster:'bw';
    h+=SEC('training')+`<div class="card"><h2>Strength-endurance</h2><p class="note" style="margin:0">Circuits of five to eight exercises covering the whole body, light and high-rep. Used by Base Building, and you can pick a different cluster on any single day.</p>
    <div class="restsel"><span>Default cluster</span><div class="seg">${Object.entries(SE_CLUSTERS).map(([k,c])=>`<button class="segb${key===k?' on':''}" data-act="sedef" data-v="${k}">${c.name}</button>`).join('')}</div></div>
    <label class="f">My own cluster<textarea id="se-mine" data-seMine rows="7" placeholder="One exercise per line, five to eight of them">${esc(((plan.se||{}).custom||[]).join('\n'))}</textarea></label>
    <div class="note">Pick movements you can get to without queueing, since the short rests are the point. Anything one arm or one leg at a time splits the reps. With barbells or dumbbells use roughly 15–30% of your one-rep max.</div></div>`;
  }
  const mobs=plan.mob||{};
  h+=SEC('training')+`<div class="card"><h2>Mobility</h2><p class="note" style="margin:0">The block at the end of each session, matched to what that day loaded. One movement per line; add the dose after a comma.</p><div class="grid3">${[['lift','After lifting'],['dead','After deadlift day'],['hic','After conditioning'],['plyo','After plyos'],['off','Rest days']].map(([k,l])=>`<label class="f">${l}<textarea id="mob-${k}" data-mobday="${k}" rows="6">${esc(mobList(k).map(([n,d])=>d?n+', '+d:n).join('\n'))}</textarea></label>`).join('')}</div></div>`;
  h+=SEC('training')+`<div class="card"><h2>Travel week</h2><p class="note" style="margin:0">What you do on a week away from the barbell. Add a travel week from the Plan tab: the cycle pauses and picks up after it, and the week stays out of the end-of-cycle review. One movement per line, dose after a comma.</p><div class="grid3">${['day1','day2','day3'].map(k=>`<label class="f">${esc(TRAVEL[k].name)}<textarea id="trv-${k}" data-trvday="${k}" rows="5">${esc(travelList(k).map(([n,d])=>d?n+', '+d:n).join('\n'))}</textarea></label>`).join('')}</div></div>`;
  const accs=plan.acc||{};
  h+=SEC('you')+suppSetupCard();
  h+=SEC('training')+warmSetupCard();
  h+=SEC('training')+accSetupCard();
  h+=SEC('training')+bandsCard();
  h+=SEC('training')+`<div class="card"><h2>Conditioning</h2><p class="note" style="margin:0">Your main tool for HIC and LISS days. You can switch activity on any session from its card.</p><label class="f" style="max-width:260px">Climbing counts as distance<div class="row" style="align-items:center;gap:8px">${pIn('elevPer.'+u(),elevPerDist(),'style="max-width:110px"')}<span class="small muted">${elevUnit()} of gain = 1 ${u()==='kg'?'km':'mi'}</span></div></label>
  <label class="f" style="max-width:260px">Default FOBBIT<select id="p-fobbit" data-pbind="fobbit">${Object.entries(FOBBIT).map(([k,x])=>`<option value="${esc(k)}"${k===defFob()?' selected':''}>${esc(x.name)}${x.gear?' \u00b7 '+esc(x.gear):''}</option>`).join('')}</select></label>
  <div class="small muted">${esc(fobLine(defFob())||'You type the movements on the day.')}${fobDef(defFob())?' \u00b7 '+esc(fobEveryLabel(defFob()))+' of base \u00b7 '+esc(fobSrcLabel(defFob())):''} Swap it on any single session from that day's card.</div>
  <label class="f" style="max-width:260px">Default activity<select id="p-cardio" data-pbind="cardio.def">${Object.entries(MOD).filter(([k])=>k!=='other').map(([k,x])=>`<option value="${k}"${defMod()===k?' selected':''}>${x.name}</option>`).join('')}</select></label>
  ${(()=>{const b=benchmark()||{};return `<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px"><div class="small muted" style="font-weight:650">Benchmark session</div>
  <p class="note" style="margin:4px 0 0">One hard session you repeat to compare against itself. Results only compare within an activity and a format, so if the rest of your conditioning moves around, this is the line worth watching.${b.auto?' Picked for you from what you repeat most — choosing here pins it.':''}</p>
  <div class="grid3"><label class="f">Activity<select id="p-bmod" data-pbind="benchmark.mod">${Object.entries(MOD).filter(([k])=>k!=='other').map(([k,x])=>`<option value="${k}"${b.mod===k?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
  <label class="f">Format<select id="p-bfmt" data-pbind="benchmark.fmt">${Object.entries(HIC).filter(([k,x])=>k!=='liss'&&!x.noMetric).map(([k,x])=>`<option value="${k}"${b.fmt===k?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
  <label class="f">Repeat every (days)${pIn('benchEvery',plan.benchEvery)}</label></div></div>`})()}</div>`;
  const ptS=proteinTarget(todayStr());
  {
    const wk=weekOf(todayStr()), cyc=wk?(wk.kind==='cycle'?wk.cycle:wk.refCycle):null;
    h+=SEC('training')+`<div class="card"><h2>Lift variants</h2><p class="note" style="margin:0">Which ${esc(activeLifts().filter(k=>VARS[k]).map(k=>VAR_OF[k].toLowerCase()).join(', ').replace(/, ([^,]*)$/,' and $1'))} this program runs on. Tactical Barbell picks its cluster lifts for a block and keeps them for the block, so this is a per-cycle choice \u2014 and the max you enter above is that lift\u2019s max, used as it stands with no conversion.</p>`;
    for(const k of Object.keys(VARS).filter(k=>activeLifts().includes(k))){
      const V=varsOf(k), bv=blockVar(k,todayStr()), def=varDefault(k), m=cyc?maxFor(cyc)[k]:null;
      h+=`<div class="stack" style="gap:8px;margin-top:14px"><div class="small muted" style="font-weight:650">${esc(VAR_OF[k]||k)}</div>
      <div class="grid2">${cyc?`<label class="f">Cycle ${cyc} (now)<select id="p-cv-${k}" data-pbind="cycleVar.${cyc}.${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===bv?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`:''}
      <label class="f">Later cycles<select id="p-var-${k}" data-pbind="liftVar.${k}">${Object.entries(V).map(([id,x])=>`<option value="${id}"${id===def?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>
      <div class="small muted">${esc(V[bv].note)}</div>`;
      if(m) h+=`<div class="note">Your ${n(m.v)} ${u()} max is read as a <b>${esc(V[bv].name.toLowerCase())}</b> max.${bv!==varRef(k)?` If that number came from a ${esc(V[varRef(k)].name.toLowerCase())}, the usual equivalent is about <b class="mono">${n(rnd(m.v*V[bv].r,plan.round[k]))}</b> \u2014 change it in Maxes if so.`:''}</div>`;
      const mine=((plan.customVar||{})[k])||[];
      h+=`<details class="plain"><summary>Your own variants <small class="muted">\u00b7 ${mine.length||'none'}</small></summary>
      <p class="note" style="margin:8px 0 0">Anything the list is missing: a bar, a tempo, a stance. Give it a name and what share of your ${esc(V[varRef(k)].name.toLowerCase())} it carries \u2014 that is all the program needs to work out the weight. Not sure? Use what you can actually lift on it against what you lift on the ${esc(V[varRef(k)].short.toLowerCase())}.</p>
      ${mine.length?`<div class="stack" style="gap:6px;margin-top:8px">${mine.map((c,i)=>`<div class="row between"><span>${esc(c.name)} <span class="small muted mono">${Math.round(+c.r*100)}%</span>${bv===c.id||def===c.id?' <span class="chip">in use</span>':''}</span><button class="btn sm ghost" data-act="vardel" data-k="${k}" data-i="${i}">Remove</button></div>`).join('')}</div>`:''}
      <div class="grid3" style="margin-top:8px"><label class="f">Name<input type="text" id="cv-name-${k}" placeholder="e.g. Pin squat"></label><label class="f">% of ${esc(V[varRef(k)].short)}<input type="number" inputmode="decimal" id="cv-pct-${k}" placeholder="85"></label><div style="display:flex;align-items:flex-end"><button class="btn" data-act="varadd" data-k="${k}">Add</button></div></div>
      ${cvErr[k]?`<div class="small" style="color:var(--red)">${esc(cvErr[k])}</div>`:''}</details>`;
      h+=`</div>`;
    }
    h+=`<div class="note" style="margin-top:14px">Changing the lift mid-cycle is a deviation from the template: the wave builds to heavy weeks on a max you set for a particular lift. For one session \u2014 a taken rack, a sore back \u2014 swap it on the lift\u2019s card on Today instead, and the weight is scaled for you.</div></div>`;
  }
  h+=SEC('you')+`<div class="card"><h2>About you</h2><p class="note" style="margin:0">Only used for the energy and body-fat estimates on Status. Nothing else in the app reads them, and leaving them blank just hides those estimates.</p>
  <div class="grid4"><label class="f">Sex<select id="p-sex" data-pbind="sex"><option value=""${!plan.sex?' selected':''}>—</option><option value="m"${plan.sex==='m'?' selected':''}>Male</option><option value="f"${plan.sex==='f'?' selected':''}>Female</option></select></label>
  <label class="f">Height (${u()==='kg'?'cm':'in'})${pIn('height',plan.height)}</label>
  <label class="f">Birth year${pIn('birthYear',plan.birthYear)}</label>
  <label class="f">Daily activity<select id="p-act" data-pbind="activity">${ACT.map(([v,l])=>`<option value="${v}"${actFactor()===v?' selected':''}>${esc(l)}</option>`).join('')}</select></label></div>
  <div class="note">The formulas: Mifflin-St Jeor for the predicted burn, the US Navy circumference method for body fat. Both are estimates — once you have logged calories and weigh-ins for a few weeks, Status uses your own numbers instead.</div></div>
  ${SEC('you')}<div class="card"><h2>Recovery and nutrition</h2><p class="small muted" style="margin:0">Used by the daily check-in to tailor suggestions.</p><div class="grid3"><label class="f">Goal<select id="p-goal" data-pbind="goal"><option value="lose"${plan.goal==='lose'?' selected':''}>Lose fat</option><option value="maintain"${plan.goal==='maintain'?' selected':''}>Maintain</option><option value="gain"${plan.goal==='gain'?' selected':''}>Build</option></select></label><label class="f">Sleep target (h)${pIn('sleepTarget',plan.sleepTarget)}</label><label class="f">Protein (g per lb)${pIn('proteinPerLb',plan.proteinPerLb)}</label></div><div class="note">${ptS?`Daily protein target: <b class="mono">${ptS} g</b> from ${r1(bwFor(todayStr()))} ${u()} bodyweight${(bwAvg(todayStr(),7)||{}).n>1?' (7-day average)':''}.`:'Enter your bodyweight above (or in a check-in) to get a protein target.'} 0.7–1.0 g per lb covers most people training this hard.</div></div>`;
  {
    const g=plan.programGoals||{}, st=g.sticking||{};
    h+=SEC('you')+`<div class="card"><h2>Goals</h2><p class="note" style="margin:0">What you are training for, in your own words. Nothing here changes the program — the coach reads it, so that its advice is about your goals rather than about training in general.</p>
    <label class="f">What are you working toward?<input type="text" id="p-goal-aim" data-pbind="programGoals.aim" value="${esc(g.aim||'')}" placeholder="e.g. 315 squat without losing my mile time"></label>
    <label class="f" style="max-width:220px">By when <span style="font-weight:500">(optional)</span><input type="date" id="p-goal-by" data-pbind="programGoals.by" value="${esc(g.by||'')}"></label>
    ${g.by?`<div class="small muted">${esc(weeksUntil(g.by))}</div>`:''}
    <div class="small muted" style="font-weight:650;margin-top:10px">Where each lift stalls</div>
    <p class="note" style="margin:0 0 4px">The most useful thing here. Say where the bar slows and the coach can suggest accessories for that part of the lift, from the ones the app already offers.</p>
    <div class="grid2">${activeLifts().map(k=>`<label class="f">${esc(liftName(k))}<input type="text" id="p-stick-${esc(k)}" data-pbind="programGoals.sticking.${esc(k)}" value="${esc(st[k]||'')}" placeholder="e.g. stalls just off the chest"></label>`).join('')}</div>
    <label class="f">Anything else worth knowing<textarea id="p-goal-notes" data-pbind="programGoals.notes" rows="3" placeholder="Injuries, kit you do not have, days you can never train, a sport you play.">${esc(g.notes||'')}</textarea></label>
 
    <label class="check"><input type="checkbox" id="p-debrief" data-pbind="coachDebrief" ${plan.coachDebrief!==false?'checked':''}> A weekly debrief from the coach on Monday mornings</label>
    <p class="note" style="margin:0">A short review of the week just finished, from your log and the books. It counts as one of the month's coach questions, and is skipped in a week with nothing logged.</p>
    </div>`;
  }
  h+=SEC('program')+`<div class="card"><h2>The wave</h2><p class="note" style="margin:0">Six weeks, repeating. Sources disagree on weeks 5–6 (some use 3×3 @ 85% and 3×1 @ 95%). Check your copy of the book.</p>
  <p class="note" style="margin:0"><b>Up to</b> sets a standing ceiling for a week, and is optional twice over: you can also just tap <b>+</b> on any lift card to add a set on the day. Leave this blank and the week is exactly the sets prescribed. Set it higher and the extra sets show on the lift card as dashed buttons you can take or leave — this is the Operator I/A idea, where you decide the volume session by session. <i>Ageless Athlete</i> allows as many as ten sets per lift, and calls a couple of extra sets the gentlest way to add size. The two-minute rest rule still applies to every set.</p><div class="tbl-wrap"><table class="wavetbl"><thead><tr><th>Week</th><th class="n">Sets</th><th class="n">Up to</th><th class="n">Reps</th><th class="n">%</th><th></th></tr></thead><tbody>${waveOf().map((v0,i)=>{const v=v0||{},W='waves.'+stemplKey()+'.'+i+'.';return `<tr><td><b>${i+1}</b></td><td class="n">${pIn(W+'s',v.s)}</td><td class="n">${pIn(W+'sMax',v.sMax,'placeholder="'+(v.s??'')+'"')}</td><td class="n">${pIn(W+'r',v.r)}</td><td class="n">${pIn(W+'p',v.p)}</td><td><span class="chip ${tier(+v.p)}">${{light:'Light',mid:'Medium',heavy:'Heavy'}[tier(+v.p)]}</span></td></tr>`}).join('')}</tbody></table></div></div>`;
  {
    const byBook=(+plan.testEvery||0)===2&&(+plan.deloadEvery||0)===0;
    h+=SEC('program')+`<div class="card"><h2>Cycles, deloads and retests</h2>
    <div class="row between" style="align-items:center"><span class="small muted">${byBook?'Running the book\u2019s cadence: two cycles, then retest, no scheduled deload.':'Your cadence differs from the book\u2019s.'}</span>${byBook?'<span class="chip light">By the book</span>':'<button class="btn sm" data-act="bookcadence">Match the book</button>'}</div>`;
  }
  h+=`
  <div><div class="small muted" style="margin-bottom:6px;font-weight:650">Added to the max each new cycle</div><div class="grid4">${activeLifts().map(k=>`<label class="f">${esc(liftName(k))}${pIn('inc.'+k,plan.inc[k])}</label>`).join('')}</div></div>
  <div class="stack" style="gap:6px"><div class="small muted" style="font-weight:650">Ageless Athlete <span style="font-weight:400">· a preset, not a mode</span></div><p class="note" style="margin:0 0 2px">The book’s answer to whether an older athlete needs a different strength program is <b>no</b> — what changes is the dosing and the scaffolding around it. So this is not a separate program, it is three settings you could set yourself: recovery weeks every fourth week, training off a <b>training max</b> at 90% rather than a true 1RM, and no scheduled deload because the recovery weeks are the back-off. It sets them and tells you what it set; undo any of them individually afterwards.</p>
  ${agelessOn()?`<div class="small">✓ All three are set.</div>`:`<button class="btn sm" data-act="ageless">Set all three</button>`}</div>
  <div class="stack" style="gap:6px"><div class="small muted" style="font-weight:650">Recovery weeks <span style="font-weight:400">· Ageless Athlete</span></div><p class="note" style="margin:0 0 2px">A recovery week after every third training week, so a six-week cycle takes eight. The book's words for it: stay <b>entirely away from barbells and HIC</b> — that is what recharges the nervous system, joints and hormones. Not an off week: two easy sessions, kept easy, plus whatever you already do and as much mobility as you like. It is aimed at trainees past forty, and it replaces the scheduled deload rather than sitting alongside it.</p><label class="check"><input type="checkbox" id="p-rec313" data-pbind="recovery313" ${plan.recovery313?'checked':''}> Take a recovery week every fourth week</label>${plan.recovery313?`<div class="note">On. The scheduled deload below is suspended while this is — the recovery weeks are the back-off.</div>`:''}</div>
  <div class="stack" style="gap:6px"><div class="small muted" style="font-weight:650">Scheduled deload week <span style="font-weight:400">\u00b7 not in the book</span></div><p class="note" style="margin:0 0 2px">Operator runs its cycles back to back and retests; there is no deload week in it. What the book does prescribe is a full week or more off every three to six months \u2014 add that from the Plan tab when you want it. A scheduled light week is our addition, off by default, and worth having if you are running this year-round.</p><div class="seg">${[[0,'As needed'],[1,'After every cycle'],[2,'After every 2 cycles']].map(([v,l])=>`<button class="segb${(+plan.deloadEvery||0)===v?' on':''}" data-act="deloadevery" data-v="${v}" aria-pressed="${(+plan.deloadEvery||0)===v}">${l}</button>`).join('')}${[0,1,2].includes(+plan.deloadEvery||0)?'':`<button class="segb on" aria-pressed="true">Every ${+plan.deloadEvery} cycles</button>`}</div><div class="small muted">${nextScheduled('deload')}${(+plan.deloadEvery||0)===0?' The app still offers a one-tap deload when readiness is low or sessions run hard, and you can add one from Plan anytime.':''}</div>
  <label class="check"><input type="checkbox" id="p-askdl" data-pbind="askDeload" ${plan.askDeload!==false?'checked':''}> Ask me to confirm this every 2 cycles (weeks 5–6 of cycles 2, 4, 6…)</label></div>
  <label class="f" style="max-width:260px">Retest after every N cycles (0 = never)${pIn('testEvery',plan.testEvery)}</label>
  <p class="note" style="margin:0"><b>2 is the book\u2019s recommendation</b> \u2014 two six-week blocks, so twelve weeks between tests, which it calls the optimal length of a strength phase. 1 (six weeks) is the minimum and is offered to experienced lifters who respond better to testing often. Going longer is explicitly fine: if the loads still feel heavy, stay on your current numbers and test when they feel solid.</p>
  <p class="note" style="margin:0">A retest week doubles as a deload: 3 easy days, then heavy singles. When both land on the same cycle, the retest wins.</p>
  <div><div class="small muted" style="margin-bottom:6px;font-weight:650">Deload week lifting</div><div class="grid3"><label class="f">Sets${pIn('deload.s',plan.deload.s)}</label><label class="f">Reps${pIn('deload.r',plan.deload.r)}</label><label class="f">% of max${pIn('deload.p',plan.deload.p)}</label></div></div>
  <div class="banner"><div class="small">Past weeks are locked, and so is the week you are in: changing the deload or retest cadence takes effect from <b>next</b> week, so a week already under way cannot turn into something else on the Wednesday. The wave and your maxes still apply from this week on. Changing the start date or the bridge week re-plans everything, locked weeks included.</div></div></div>`;
  const bk=backups.list;
  h+=SEC('data')+syncCard();
  h+=SEC('data')+crashCard();
  h+=SEC('data')+calFeedCard();
  h+=SEC('data')+`<div class="card"><h2>Backups</h2><p class="note" style="margin:0">A full copy of your plan and every logged session is saved automatically every Sunday. The last 26 of those are kept, so about six months, and your own backups are counted separately: the newest six you take by hand and the newest six taken before a restore. Taking a few by hand can’t push out the weekly history.</p>
  ${backups.err?`<div class="small muted">${esc(backups.err)}</div>`:!bk?'<div class="small muted">Loading backups…</div>':bk.length?`<div class="tbl-wrap"><table><thead><tr><th>Backup</th><th class="n">Sessions</th><th class="n">Size</th><th></th></tr></thead><tbody>${bk.slice(0,6).map(x=>`<tr><td>${esc(x.name.replace(/-(manual|before-restore(-\d{6})?)$/,''))}${x.name.endsWith('-manual')?' <span class="chip">manual</span>':''}${x.name.includes('-before-restore')?' <span class="chip">before restore</span>':''}</td><td class="n">${x.logs??'—'}</td><td class="n">${x.bytes?Math.max(1,Math.round(x.bytes/1024))+' KB':'—'}</td><td class="n" style="white-space:nowrap"><a class="btn sm ghost" href="/api/backups/${encodeURIComponent(x.name)}">Download</a><button class="btn sm ghost" data-act="restore" data-name="${esc(x.name)}" ${restoreState.busy?'disabled':''}>${restoreState.arm===x.name?'Tap again':'Restore'}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="small muted">No backups yet. The first automatic one runs Sunday.</div>'}
  <div class="row"><button class="btn" data-act="backupnow" ${backups.busy?'disabled':''}>${backups.busy?'Backing up…':'Back up now'}</button><a class="btn ghost" href="/api/export">Download current data</a><label class="btn ghost" for="restore-file">Restore from a file…</label><input type="file" id="restore-file" accept="application/json,.json" hidden></div>
  ${restoreState.file?`<div class="banner warn"><div class="small"><b>Restore ${esc(restoreState.file.name)}?</b> It holds ${restoreState.file.logs} logged day${restoreState.file.logs===1?'':'s'}${restoreState.file.from?' from '+esc(fmtLong(restoreState.file.from.slice(0,10))):''}${restoreState.file.user&&me&&restoreState.file.user!==me?`, saved by <b>${esc(restoreState.file.user)}</b>, not you`:''}. This replaces everything in your account. A safety backup is taken first.</div><div class="row"><button class="btn sm primary" data-act="restorefile" ${restoreState.busy?'disabled':''}>Replace my data with this file</button><button class="btn sm ghost" data-act="restorecancel">Cancel</button></div></div>`:''}
  ${restoreState.msg?`<div class="small">${esc(restoreState.msg)}</div>`:''}
  ${backupCheckLine()}
  <div class="note">Restoring replaces your plan, every logged day and archived programs with the backup’s. A “before restore” backup of your current data is saved first, so a restore can be undone.</div></div>`;
  h+=SEC('data')+`<div class="card"><h2>Export to a spreadsheet</h2><p class="note" style="margin:0">CSV files for Numbers, Excel or Google Sheets, covering every program. <b>Sessions</b>: one row per day (check-in, conditioning, plyos, jumps, notes). <b>Lifts</b>: one row per lift per session (prescribed vs working weight, sets done, grinders, warm-ups, test results).</p><div class="row"><button class="btn" data-act="csv" data-v="sessions">Export sessions</button><button class="btn" data-act="csv" data-v="lifts">Export lifts</button></div></div>`;
  if(!backups.list&&!backups.busy&&!backups.err&&!backups.loading) loadBackups();
  return setupSections(h);
}
let calc5={};
// Restore: from a listed backup (two taps) or a chosen file (confirm banner).
const restoreState={arm:null,busy:false,msg:null,file:null};
async function doRestore(path,body){
  restoreState.busy=true; restoreState.msg='Restoring…'; render();
  try{
    const r=await api('POST',path,body);
    // Drop anything unsent: it belongs to the data being replaced.
    for(const w of Object.values(writers)) clearTimeout(w.timer);
    for(const k of Object.keys(writers)) delete writers[k];
    outbox={}; saveOutbox();
    const st=await api('GET','/state');
    if(stash){stash=null;viewing=null}
    plan=st.plan?deepMerge(clone(DEF),st.plan):clone(DEF); logs=st.logs||{}; programs=st.programs||{}; planV++; saveCache();
    restoreState.msg=`Restored ${r.restored.logs} logged day${r.restored.logs===1?'':'s'}${r.restored.programs?' and '+r.restored.programs+' archived program'+(r.restored.programs===1?'':'s'):''}${r.from?' from '+fmtLong(String(r.from).slice(0,10)):''}. Your previous data was saved as backup “${r.safetyBackup}”.`;
    restoreState.file=null; backups.list=null; loadBackups();
  }catch(e){ restoreState.msg=e&&e.status===413?'That file is too large to restore.':e&&e.status===400?'That file isn’t a backup this app can restore.':'Restore failed. Check your connection and try again. Nothing was changed.' }
  restoreState.busy=false; restoreState.arm=null; render();
}
document.addEventListener('change',e=>{
  const t=e.target; if(t.id!=='restore-file'||!t.files||!t.files[0]) return;
  const f=t.files[0], rd=new FileReader();
  rd.onload=()=>{ try{ const d=JSON.parse(rd.result); if(!d||typeof d.logs!=='object') throw 0;
      restoreState.file={name:f.name,data:d,logs:Object.keys(d.logs).length,from:d.backedUpAt||d.exportedAt||null,user:d.user||null}; restoreState.msg=null }
    catch(err){ restoreState.file=null; restoreState.msg='That file isn’t a backup this app can restore.' }
    t.value=''; render(); };
  rd.readAsText(f);
});
const backups={list:null,err:null,busy:false,loading:false};
// Every backup is read straight back after it is written and checked against what was
// meant to be stored. "There are backups" and "the backups are good" are different
// claims; this is the second one, and it is worth saying out loud either way.
function backupCheckLine(){
  const c=backups.check;
  if(!c) return '';
  const when=c.at?fmtD(String(c.at).slice(0,10),true):'';
  if(c.ok) return `<div class="small muted">\u2713 Checked ${esc(when)}: the newest backup was read back and matched what it should hold${c.logs!=null?' ('+c.logs+' logged day'+(c.logs===1?'':'s')+')':''}.</div>`;
  return `<div class="banner alert"><div><b>The last backup did not verify.</b> It was written on ${esc(when)} but did not read back as what it should hold. Take one now, and if this keeps happening do not rely on these backups \u2014 use <b>Download current data</b> instead.</div><div><button class="btn sm primary" data-act="backupnow">Back up now</button></div></div>`;
}

async function loadBackups(){
  backups.loading=true;
  try{const r=await api('GET','/backups');backups.list=r.backups;backups.check=r.check||null;backups.err=null}
  catch(e){backups.err=e&&(e.status===401||e.status===403)?'Sign in again to see backups.':navigator.onLine===false?'Backups need a connection.':'Couldn’t load backups.'}
  backups.loading=false; if(view==='setup') render();
}

function vGuide(){
  return `<div class="card guide"><h2>How the week works</h2><p>Operator keeps strength work minimal and sub-maximal so conditioning can carry the real weekly load. Three lifts, three sets, never near failure.</p>
  <dl class="kv"><dt>Mon</dt><dd>Operator Day 1: squat, bench, Lift 3 + accessories</dd><dt>Tue</dt><dd>HIC: MAP</dd><dt>Wed</dt><dd>Operator Day 2: squat, bench, Lift 3 + accessories</dd><dt>Thu</dt><dd>Plyos first, rest 10 min, then HIC: Anaerobic</dd><dt>Fri</dt><dd>Operator Day 3: squat, bench, deadlift + accessories</dd><dt>Sat</dt><dd>HIC: Threshold / Long HIC alternating, or LISS after a heavy week</dd><dt>Sun</dt><dd>Off</dd></dl></div>
  <div class="card guide"><h3>Strength rules</h3><ul class="tight"><li>Sets can range 3–5 depending on what you can handle. Deadlift stays 1–3 sets.</li><li>Minimum 2 min rest between sets; 5 min on heavy squat and deadlift weeks.</li><li>If a set grinds at 70–80%, your max is too high. Lower it rather than pushing through.</li><li>Ramp: skip the 85% single on light weeks; add a 90% single on heavy weeks. Deadlift needs only 2–3 ramp sets; Lift 3 needs one light set of 10 and one at 70%.</li></ul></div>
  <div class="card guide"><h3>Cluster lifts and their variants</h3>
  <p>Each cluster lift has a list of variants, and the first on each list is the <b>reference</b> — the lift your stored max belongs to. Pick the one your block actually runs in Setup \u2192 Program; it is a per-cycle choice, like your accessories, because the wave builds to heavy weeks on a max for a particular lift and changing it mid-block makes those weeks mean nothing.</p>
  <ul class="tight"><li><b>The block's lift uses the max you stored, unscaled.</b> Choose the safety squat bar for a cycle and the number you type is your safety squat bar max. The app does not derive it from a back squat you were never asked for.</li>
  <li><b>A one-day swap is scaled.</b> Change the lift on a single day's card and the weight is your block max times the ratio between the two variants, so a front squat on a Wednesday is prescribed off the squat you are actually training.</li>
  <li><b>Test and bridge weeks always use the reference</b>, even against an explicit swap. Otherwise a front-squat single would be written back as a back-squat max and quietly drop every weight in the next cycle.</li>
  <li><b>Variants change the working weight and nothing else.</b> Personal records, the strength charts and the cycle review all stay on the reference lift.</li>
  <li><b>Your own</b> variants go in Setup: a name and its share of the reference max is the whole prescription. Anything from 25 to 150%.</li></ul>
  <p class="note"><b>A variant is a barbell</b> — a straight bar, or a specialty bar: safety squat, trap, football, axle. Dumbbell, kettlebell and landmine work is accessory work and lives in the accessory slots, which is where you will find it. The rule gives the same answer as the mechanical one and is easier to apply: if the limit is what your hands can hold, or there is no lockout to test, there is no honest one-rep max and the percentages would be invented. Hence no goblet squats, no double-kettlebell front squats and no Romanian deadlifts here — they are in the accessory and travel-week lists.</p>
  <p class="note">The weighted pull-up is the exception, and it is an exception to the wording rather than to the reason: change the grip and it is still the same lift with the same testable max, loaded off a belt. Its percentages work differently, though, because the max you store is the <b>added</b> weight while the variant is a share of what you actually lift. A chin-up at 105% means 105% of bodyweight plus the belt, so at 180 lb with +60 on it — 240 in all — the chin-up equivalent is 252, which is +72 rather than +63. The app does that arithmetic; it needs a recent bodyweight to do it, and says nothing rather than guessing if it has not got one.</p>
  ${Object.keys(VARS).map(k=>`<h4 class="sub-h">${esc(VAR_OF[k]||k)}</h4><div class="tbl-wrap" style="margin-top:6px"><table><thead><tr><th>Variant</th><th class="n">Of the reference max</th><th>What it is</th></tr></thead><tbody>${Object.values(varsOf(k)).map((v,i)=>`<tr><td><b>${esc(v.name)}</b></td><td class="n mono small">${i?Math.round(v.r*100)+'%':'reference'}</td><td class="small">${esc(v.note||'')}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>
  <div class="card guide"><h3>Pull-ups</h3>
  <p>The one accessory the app programs rather than just lists, because it is the one that takes years and responds to being told what to do next. Wednesday's card prints the prescription for whichever rung your best logged set puts you on, and moves you up on its own.</p>
  <div class="tbl-wrap"><table><thead><tr><th class="n">Best set</th><th>Rung</th><th>The work</th><th>Moves you up</th></tr></thead><tbody>${PULLUP.map(r=>`<tr><td class="n small">${r.at?r.at+'+':'0'}</td><td><b>${esc(r.name)}</b><div class="small muted">${esc(r.why)}</div></td><td class="small">${esc(r.work)}</td><td class="small">${esc(r.next)}</td></tr>`).join('')}</tbody></table></div>
  <p><b>Weighted pull-ups as Lift 3.</b> Once you are on the last rung they can be a cluster lift like any other, and the percentages apply to <b>bodyweight plus the added weight</b> — so the app works out what to hang off the belt from your seven-day average bodyweight, not from the number on the plate. A rung is read from your history at the date you are looking at, so a day last spring shows the rung you were on then.</p></div>
  <div class="card guide"><h3>Conditioning: Black</h3><div class="tbl-wrap"><table><thead><tr><th>Format</th><th>Session</th><th>System</th></tr></thead><tbody>${Object.values(HIC).map(x=>`<tr><td><b>${x.name}</b></td><td>${x.sess}</td><td class="small muted">${x.sys}</td></tr>`).join('')}</tbody></table></div><ul class="tight"><li>Black sets the dose, not the tool. The ${MOD[defMod()].name.toLowerCase()} is your default; switch activity on any HIC or LISS day, from the list below.</li><li>Keep the format and activity fixed to track progress. Results only compare within the same activity.</li><li>If most sessions are on a bike, watch hip flexors and saddle position: it compounds with squats and deadlifts.</li><li>Running and rucking add impact and back load. Plyos come first on whichever day they land, so keep sprint volume low that day.</li></ul>
  <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Activity</th><th>Hard sessions measured in</th><th>Steady measured in</th></tr></thead><tbody>${Object.values(MOD).map(m=>`<tr><td><b>${esc(m.name)}</b>${m.elev?' <span class="small muted">\u00b7 climbs</span>':''}</td><td class="small">${m.hic?esc(metricLabel(m.hic)):'\u2014'}</td><td class="small">${m.liss?esc(metricLabel(m.liss)):'\u2014'}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">Each has its own warm-up and its own advice, printed on the day. Results only ever compare within the same activity and format, so switching tools does not corrupt your history \u2014 it just starts another thread of it.</p>
  <p><b>Climbing counts as distance.</b> Trail runs, hikes and rucks ask for elevation gain, and the app turns it into flat-equivalent distance at ${plan.unit==='kg'?((plan.elevPer||{}).kg||190)+' m per kilometre':((plan.elevPer||{}).lb||1000)+' ft per mile'} \u2014 so five miles with 3,000 feet of climbing reads as eight miles flat. The raw numbers stay on screen next to it. That equivalent is what \u201clast\u201d and \u201cbest\u201d compare, so a brutal climbing day stops looking worse than an easy flat one, and Status keeps a climbing total for the week and the last four. Change the factor in Setup if a thousand feet is not your mile. Nothing else in the programming reads it: it is there to compare sessions, not to move your deloads around.</p>
  <p><b>Benchmarks.</b> One activity-and-format pairing you keep coming back to, so there is something in the log that is genuinely comparable over a year. Pin one in Setup, or leave it and the app takes whichever hard pairing you have the most results for. Status charts it with your best and the days since, and on a conditioning day where it is due \u2014 every ${+plan.benchEvery||35} days \u2014 the check-in asks for it. A format with no number to compare, like a FOBBIT, cannot be a benchmark.</p>
  <p><b>Stuck in a rut?</b> Six hard sessions in a row sharing a format or a tool and the app says so. Steady work is exempt: it is meant to be samey.</p>
  <p><b>Optional sets (Operator I/A).</b> K. Black's intermediate/advanced take on Operator hands you the volume decision: rather than a fixed three sets, you work somewhere in a range and choose on the day. Tap <b>+</b> at the end of the sets on any lift card and you get another one, for that lift on that day only — the program is not touched and tomorrow is back to normal. If you want the room there every week instead, give the week an <b>Up to</b> value in Setup. Either way the surplus sets show dashed, and nothing is counted as missed if you skip them. In <i>Ageless Athlete</i> Jim Madden calls this the part of I/A he considers essential, and a few extra sets on weighted pull-ups his favorite way to add upper-body size without derailing recovery. Deadlift has always worked this way here: one set required, up to three.</p>
  <p><b>What this is not.</b> Full Operator I/A also floats your lifting days 48 to 72 hours apart, so the wave advances by session rather than by week. This app runs on a calendar, so it does not do that — and Madden says he mostly keeps a fixed three-sessions-a-week schedule himself, taking his variability in sets and intensity instead. That is the part you have here.</p>
  <p><b>What matters today.</b> Before a session you pick up to three things to pay attention to, and afterwards you get an account of them. Three is the cap on purpose: any more and none of them is a focus.</p>
  <p>The questions depend on the day. <b>Lifting days</b> ask about execution — finishing every set, a proper warm-up, keeping technique tight, stopping short of failure. <b>Conditioning days</b> ask about where the effort went, which is the thing that actually goes wrong on a bike: hitting the rounds, holding the pace, keeping the easy parts easy, finishing able to do one more. A question that cannot apply is not asked — a steady session is never asked about rounds. Test days and Base Building circuits set no aims at all.</p>
  <p>Some the app can score from what you logged, and does. The rest only you can judge, so those ask you once at the end rather than being guessed at. The difference is visible: a scored line tells you what it counted, a self-rated line asks.</p>
  <p><b>The note is the point.</b> What you write in \u201canything to remember\u201d is shown to you before your next session of the same kind \u2014 your last squat note before you squat again, not Tuesday's bike session. A note nobody reads again is just journalling.</p>
  <p><b>Easy week.</b> Every third week the conditioning load comes down, and it is meant to land on the wave's 90% and 95% weeks so the heavy lifting gets the energy. The app does this for you: fewer rounds, shorter LISS, on weeks 3 and 6 of each cycle. It is not a week you have missed.</p>
  <p><b>FOBBITs.</b> Named for the soldier who never leaves the forward operating base — the session you can run with no ground to cover and barely any kit. A FOBBIT is not one workout, it is a shape: hold an easy aerobic base, step off it every so often for a bout of work, get back on.</p>
  <p>Beyond that the sources disagree on nearly everything, so the app does not pretend otherwise. Tactical Barbell II gives the original — two minutes of base, then swings, then snatches. Mass Protocol gives a shorter one and says plainly that you are not restricted to kettlebells. The author then published three more as Mods: one that buys press volume at 70–75% of your 1RM every three to five minutes, one that rotates three strength-endurance movements, and one that runs the other way round, with a two to three minute striking drill off sixty to ninety seconds of base.</p>
  <p><b>The rule that matters.</b> In the author’s words: <b>any FOBBIT over 30 minutes is an E, anything under is a HIC.</b> So the length you pick is not cosmetic — it decides whether the session counts against your hard days or your easy ones, and the app counts it the way you logged it.</p>
  <p>A bout of reps is not on the clock: the timer holds at it until you tap Done. A timed bout — an AMRAP, a striking round — is, so it counts toward the session.</p>
  <div class="tbl-wrap"><table><thead><tr><th>FOBBIT</th><th>Kit</th><th>Base</th><th>The rotation</th><th>Source</th></tr></thead><tbody>${Object.entries(FOBBIT).filter(([k])=>fobDef(k)).map(([k,x])=>`<tr><td><b>${esc(x.name)}</b></td><td class="small">${esc(x.gear)}</td><td class="small">${esc(fobEveryLabel(k))}</td><td class="small">${esc(fobLine(k))}</td><td class="small">${esc(fobSrcLabel(k))}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">Pick a default in Setup and swap it on any single session from that day’s card. <b>Something else</b> lets you type your own movements, separated by a slash. Where a row says <b>Ours</b> the shape is the book’s and the movements and counts are the app’s — the sources sanction substituting but do not prescribe these.</p>
  <p class="note">Good for weather, for a hotel, for a day when the bike is taken, and for keeping impact off the legs the day before a heavy squat.</p></div>
  <div class="card guide"><h3>Plyometrics</h3><p>A nervous-system stimulus, not a workout. Quality of each rep matters far more than how many you do: 15 to 20 minutes of actual work, once a week and never after conditioning. Phases rotate every 3 training weeks. Deload weeks use the extensive session at half volume.</p>
  <p><b>They are not tied to a session.</b> Thursday is the default, because that is where the week's middle conditioning day sits, but plyos are their own thing and move on their own. Open any day in a training week, tap <b>Move…</b>, and pick a day under Plyometrics. That changes the week you are looking at and nothing else; picking Thursday again clears it. Whatever was already on the day you choose stays — plyos go first, and on a conditioning day you get ten minutes between the two.</p>
  <div class="tbl-wrap"><table><thead><tr><th>Phase</th><th>Exercise</th><th>Sets × reps</th><th class="n">Contacts</th><th class="n">Rest</th></tr></thead><tbody>${PLYO.map(ph=>ph.ex.map((e,i)=>`<tr><td>${i?'':`<b>${ph.name}</b><br><span class="small muted">~${ph.target}</span>`}</td><td>${esc(e.label)}</td><td class="mono small">${e.s} × ${esc(e.r)}</td><td class="n">${e.c}</td><td class="n">${e.rest>=120?e.rest/60+' min':e.rest+' s'}</td></tr>`).join('')).join('')}</tbody></table></div>
  <ul class="tight"><li><b>Watch distance, not set count.</b> If any jump drops more than ~5% off your first broad jump, the session is over.</li><li><b>Every rep maximal or near it.</b> If you’re breathing hard, you’re doing conditioning.</li><li><b>Cut, don’t skip.</b> After a hard lifting week, halve the contacts.</li><li><b>Counting contacts:</b> one landing = one contact, even on two feet. The volumes are calibrated that way.</li></ul>
  <p><b>Progressing between blocks.</b> Add contacts before you add intensity. Raise intensity by shortening ground contact time, not by jumping higher or adding box height. If your broad jump hasn’t moved after two full blocks, the limiter is usually recovery or strength, not jump volume.</p></div>
  <div class="card guide"><h3>Plyo exercise library</h3><p class="note">Setup, execution, cues and the errors that matter. Tap an exercise to open it. The same entries open from Thursday’s card.</p>
  <div class="stack" style="gap:10px">${[['Warm-up drills',['pogo','askip']],['Jump tests',['broad','vertj','triple']],['Extensive',['broad','box','lbound']],['Unilateral + reactive',['cbroad','slhop','bdist','hurdle']],['Elastic',['depth','sllat','bheight']],['Upper body (optional)',['slam','scoop','dbsnatch','highpull','chestpass','plyopush','plyopushbox','speedpress','explpull','bandrow','rotthrow','bandrot']]].map(([g,ids])=>`<div class="stack" style="gap:6px"><h4 style="margin:6px 0 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">${g}</h4>${ids.map(id=>`<details class="px"><summary><span>${esc(PLIB[id].name)}</span></summary>${plyoEntry(id)}</details>`).join('')}</div>`).join('')}</div></div>
  <div class="card guide"><h3>Programs</h3><p>Your strength template and your conditioning protocol are separate choices, set in Setup \u2192 Program, and the week is built from the two. That is how the books present it: Tactical Barbell II's sample weeks are headed \u201cBlack + Zulu\u201d, \u201cBlack + Operator\u201d, \u201cBlack + Fighter\u201d.</p>
  <div class="tbl-wrap"><table><thead><tr><th>Strength</th><th class="n">Days</th><th>What it is</th></tr></thead><tbody>${Object.entries(STEMPL).map(([k,v])=>`<tr><td><b>${esc(v.name)}</b></td><td class="n">${tplDays(v,{w:1}).length}</td><td class="small">${esc(v.blurb)}</td></tr>`).join('')}</tbody></table></div>
  <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Conditioning</th><th class="n">Sessions</th><th>What it is</th></tr></thead><tbody>${Object.entries(CPROTO).map(([k,v])=>{const n=(typeof v.sessions==='function'?v.sessions({w:1}):v.sessions||[]).length;return `<tr><td><b>${esc(v.name)}</b></td><td class="n">${n}</td><td class="small">${esc(v.blurb)}</td></tr>`}).join('')}</tbody></table></div>
  <ul class="tight"><li><b>The lifting days go where the book's table puts them.</b> Operator on days 1, 3 and 5, Fighter on 1 and 4, Zulu on 1, 2, 4 and 5. Zulu's pairs sit together on purpose \u2014 A and B work different lifts.</li>
  <li><b>Conditioning fills what is left</b>, spread out where the week allows. That is a preference, not a rule: TB II says plainly that “your HIC and E can be done on any day … you can do two days in a row, or whatever. As long as you’re hitting your weekly minimums.” So the app arranges them apart and lets you put them together, with a note rather than a refusal.</li>
  <li><b>The default layout follows the book’s own principle</b> for arranging a week: “It’s not set in stone. As long as you adhere to the principles — one rest day. No back to back same sessions. Completed within 7 days.” So a protocol lays its week out with the strength days apart. Zulu’s A and B are different sessions, so they are allowed to touch, and are meant to.</li>
  <li><b>Moving a session is one thing and it is never refused.</b> Pick the day, and that session happens on that day. Nothing else moves — not the day you took it from, not the day it lands on, not the rest of the week. A day can hold two sessions or none, and a day with none is a rest day. Move it into next week if that is when you will do it.</li>
  <li><b>You get told, not stopped.</b> Two lifting sessions on one day, or on consecutive days, is the one thing the book asks you not to do, so the app says so — do the heavier one first and cut the accessories on the second. It is a remark, not a veto: the week you can actually train beats the week that reads correctly.</li>
  <li><b>If it will not fit, a session rides along after the barbell work</b> rather than taking your rest day. Four lifting days and three conditioning sessions is seven, so Zulu + Black puts a HIC on day 1 \u2014 exactly what the book's own Black + Zulu week does.</li>
  <li><b>Specificity is a block, not a program.</b> Alpha and Bravo come from Tactical Barbell III and run three weeks at a time, four days a week on days 1, 2, 4 and 5. The book wants them after a stretch of General Mass, and says to bridge between blocks. Alpha keeps two maximal-strength days (bench, squat and deadlift — the deadlift at one work set per session) against two hypertrophy days; Bravo drops the barbell work entirely and trains nothing but the cluster, which is the point of it rather than an oversight. Bravo also runs the back half of its week five percent heavier than the front.</li>
  <li><b>A hypertrophy day has no barbell prescription.</b> The whole session is your H cluster, so it shows up under Supplementary rather than as a list of lifts: six to twelve exercises for Alpha, eight to sixteen for Bravo, split in half with each half on its own day. What goes in them is yours — the book gives sample clusters and leaves the choice open. The percentage is of your own best for that movement.</li>
  <li><b>Tactical Barbell III brings its own conditioning.</b> The book is blunt about it — use these sessions, not TB II's Green and Black — because while mass is the objective, conditioning is there to keep you operational rather than to build an elite base. <b>Green · TB III</b> is three easy sessions a week (a ruck, a recovery run, and Endurance Predator) and goes with the General Mass templates. <b>Black · TB III</b> is two short maximal ones (Anabolic Sprints, then RESET-20 and Hill Sprints alternating) and goes with Specificity. Both numbers are the book's caps, and the app schedules the cap.</li>
  <li><b>Black sessions stay off lifting days</b>, which the book asks for outright. Green ones may go on either.</li>
  <li><b>Ageless Athlete does not add a different program</b> — the book asks outright whether an older athlete needs one and answers no. What changes is the dosing: train off a training max, take a recovery week every fourth week, and test only when you expect to learn something. Setup has those as a preset. It does add two templates of its own, below.</li>
  <li><b>Old Warhorse</b> is four blocks that start deliberately light and force the numbers up rather than testing for them. Operator's three days and percentages throughout; what moves is the volume — 5 to 10 sets in block 1, then 4 to 8, then 4 to 5, then 3 to 4 — and whether the sets are flexible (I/A) or fixed. Between blocks you add 2 to 5% to the training max, which the book leaves to your judgment, so the app tells you rather than deciding. Block 4 finishes on a 3-rep max at 100 to 107%.</li>
  <li><b>Back “Break”</b> is for a block when your spine wants a rest. One lower-body lift, once a week, on the last day: <b>squat only</b> or <b>deadlift only</b>. You do not work off a percentage — you climb to the best set you have that day, then take optional down sets at 80, 85 or 90% of it depending on the week. Upper body runs Operator as usual, and the other two days carry accessories from the opposite pattern. The book is clear that it is not the best way to progress a squat or deadlift, but it might be the breather that keeps you training.</li>
  <li><b>The recovery week</b> that 3-1-3-1 inserts is not an off week. No barbells and no HIC — that is what recharges the nervous system, joints and hormones — but two easy sessions, kept easy, plus anything you already do and as much mobility as you like. On the last lifting day before one, the app offers the in-block check: one heavy single above 95%, or a rep max, instead of a whole test week.</li>
  <li><b>A travel week</b> is a week-long pause you add from the Plan tab, like Base Building but for a hotel: three sessions of dumbbell and bodyweight work with rep targets instead of percentages, conditioning and plyos unchanged. It touches none of your maxes, and the end-of-cycle review ignores it because it is not a cycle week. The movements are yours, in Setup.</li>
  <li><b>Starting over.</b> Archiving the current program draws a line under it and begins another \u2014 carrying your maxes across, or going back through the bridge week to retest them. Anything archived stays readable from History, Status and the Plan tab, and personal records and conditioning bests still count across every program you have run.</li>
  <li><b>Switching re-draws this week and the ones ahead.</b> Weeks you have already trained keep the program they were done under. Each strength template keeps its own wave, so you can switch across and back without losing tuned numbers.</li></ul></div>
  <div class="card guide"><h3>Base Building</h3><p>Tactical Barbell II's Block I: eight weeks of aerobic base and strength-endurance before you go back to heavy barbell work. Add it from the Plan tab and it runs in place of your next cycle; Operator picks up where it left off afterwards, at the same maxes.</p>
  <div class="tbl-wrap"><table><thead><tr><th>Day</th>${[1,2,3,4,5,6,7,8].map(w=>`<th>W${w}</th>`).join('')}</tr></thead><tbody>${[0,1,2,3,4,5,6].map(d=>`<tr><td>${d+1}</td>${[1,2,3,4,5,6,7,8].map(w=>{const r=BB_WEEKS[w-1][d],k=r[0];return `<td class="small">${k==='se'?'SE '+r[1]+'×'+r[2]:k==='e'?'E '+r[1]+(r[2]?'–'+r[2]:'')+'M':k==='ms'?'Strength':k==='hic'?'HIC':k==='rec'?'Recovery':'Rest'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>
  <ul class="tight"><li>Weeks 1–5 are endurance and strength-endurance dense, with no barbell work at all. That is deliberate: it frees the energy for the long sessions and gives tendons and joints a break before heavy lifting returns.</li><li>Weeks 6–8 taper the long work and bring back two strength days and the aerobic-leaning HIC sessions.</li><li>Every E session is a minimum of 30 minutes. Day 6 is the long one, with a recovery day before it and a rest day after, so push the duration there.</li><li>Recovery days are movement drills, mobility, an easy swim or bike, a walk, yoga, or nothing at all.</li><li>At least one completely free day a week. Walking and pick-up sport are fine.</li><li>Eat for it. The book asks for 1–2 g of protein per pound of bodyweight through the block and is firmly against going low-carb while the volume is up.</li><li><b>Strength-first</b> reverses it: lift for the first five weeks, strength-endurance for the last three. The book doesn't give rep numbers for those late SE weeks, so the app ramps 3×30, 3×40, 3×50.</li></ul>
  <p><b>Tactical Barbell III runs its own version, and it is a different block.</b> Six weeks instead of eight, and only two domains: strength-endurance three times a week on alternate days, endurance on the days between. No barbell strength week, no HIC, no recovery day. The book is explicit that this is not the TB II model — mass is the objective and conditioning is there to keep you operational, not to build an elite base.</p>
  <div class="tbl-wrap"><table><thead><tr><th>Day</th>${[1,2,3,4,5,6].map(w=>`<th>W${w}</th>`).join('')}</tr></thead><tbody>${[0,1,2,3,4,5,6].map(d=>`<tr><td>${d+1}</td>${[1,2,3,4,5,6].map(w=>{const r=BB_MASS[w-1][d],k=r[0];return `<td class="small">${k==='se'?'SE '+r[1]+'×'+r[2]+' @ '+r[3]+'%':k==='e'?'E '+r[1]+'M':'Rest'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>
  <ul class="tight"><li><b>The reps climb inside the week, not across it.</b> Ten, twenty, thirty on the three SE days, and weeks 4 to 6 add five percent to each load. Every week has the same shape.</li>
  <li><b>E is capped at thirty minutes.</b> Not a minimum — a cap. The book says “no more, no less”, and answers the obvious question about longer sessions with “the short answer is NO”: more endurance than this works against the thing you came for.</li>
  <li><b>Low intensity throughout.</b> Talk test, or 120 to 150 bpm, or nose breathing. No intervals and no sprints for the full six weeks. Walking or riding counts if thirty minutes of running is a lot.</li>
  <li><b>The cluster is the General Mass lifts</b> — bench, squat, Romanian deadlift and abs — so the base you build is for the block you are about to run. Pick <b>TB III barbell</b> on the day. The book says to keep the conventional deadlift out of it: light and high-rep, it is an awkward lift.</li>
  <li>Add it from the Plan tab, the same way as the other two.</li></ul></div>
  <div class="card guide"><h3>Strength-endurance circuits</h3><p>Five to eight exercises covering the whole body, done one after another. Do your reps, take a short rest, move to the next. After a full circuit, rest two minutes and go again. The shorter you can make the rests, the better — down to none if you can hold it together.</p>
  <ul class="tight"><li>Reps run 20 to 50. If you can't get them all in one go, rest-pause until they're done, then move on. Failing at 25 now and hitting 40 later is the whole point.</li><li>Barbells and dumbbells: roughly <b>15–30% of your one-rep max</b>. Don't test for it. Too heavy, take weight off.</li><li>Pick movements you can reach without queueing. A busy bench breaks the rests that make this work.</li><li>Avoid anything you can't do for high reps. A rule of thumb: be good for 15–20 reps before putting a movement in. Pull-ups, pistols and one-arm push-ups sit in that gray area.</li><li>One arm or one leg at a time splits the reps: 30 means 15 a side.</li></ul>
  <div class="sm-grid">${Object.entries(SE_CLUSTERS).filter(([k])=>k!=='mine').map(([k,c])=>`<div class="sm"><div class="sm-h"><b>${c.name}</b></div><ul class="tight">${c.ex.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><div class="small muted">${esc(c.note)}</div></div>`).join('')}</div>
  <p class="note">Set your own in Setup → Strength-endurance, or switch cluster on any single SE day from the session card.</p></div>
  <div class="card guide"><h3>Accessories</h3>
  <p><b>Jobs, not a list.</b> Each lifting day covers a few jobs — a horizontal pull, some core, a carry, arms — and you choose what does each one. Setup → Accessories sets which jobs a day covers and what fills them. The choice is per cycle, like your cluster lifts, because that is what it is: a program decision, not something to re-make every session. It is also per day, so a job that comes round three times a week can be a different movement each time.</p>
  <p><b>Swapping on the day.</b> If your biceps slot is barbell curls and the bar is taken, change it on the day’s card. That session uses what you picked and is logged as it, the block’s choice is untouched, and the card marks it <b>today only</b> so you can see at a glance that it was a substitution.</p>
  <p><b>In session mode.</b> Each job is its own step, after the lifts: it names what is doing it, lets you swap for that session, takes the sets, and has a rest timer of its own — 90 seconds by default, where the main lifts use your per-lift two to five minutes.</p>
  <p><b>Logging.</b> Sets, weight and reps, like the main lifts, or just <b>Mark done</b> if you would rather not count. Everything is recorded against the job and against the exercise, so a year later the log still says it was hammer curls and not what happens to be in that slot now.</p>
  <p><b>Missing a movement?</b> The list is shared and curated, so ask and it can be added for everyone. A movement that is retired stops being offered but stays with anyone who had already chosen it — nobody has their program rewritten mid-cycle.</p>
  <p><b>The order is not the order you listed them in.</b> Core runs last and carries run last of all, whatever position they hold in Setup, and a superset containing either moves as a pair rather than being split. A fried grip makes everything after it worse, and bracing is the thing you want intact while you are still loading a bar.</p>
  <p><b>The ab triad</b> is a core option that is one prescription rather than three exercises: it is taken exactly as written, and nothing is added to it.</p>
  <ul class="tight"><li>After the main lifts, never before. Two or three sets of each job, a couple of reps short of failure.</li><li>Skip entirely on heavy weeks and deloads.</li><li>Legs need almost nothing. Keep the pull-up progression in.</li></ul></div>
  <div class="card guide"><h3>After the session</h3>
  <p>Three questions at three different grains, and each one feeds something.</p>
  <p><b>Every heavy set: how did it move?</b> ${EFFORT.map(([k,t])=>'<b>'+esc(t)+'</b>').join(', ')} \u2014 the books' own words for it. Tap one on the last set you ticked, or rate it in session mode. This is the best evidence the app has about whether a max has room in it: with four or more rated heavy sets the end-of-cycle review decides on those rather than on your session RPE, and three in four moving fast is a heavy week that did not look heavy.</p>
  <p><b>Every session: an RPE</b>, and a grinder flag on any set that stalled. A grinder at 70 to 80% means the max is too high \u2014 the book's own rule, not a judgement call.</p>
  <p><b>Every lifting session: how it felt, and whether anything hurt.</b> Easy, about right or hard; and nothing, a niggle or sharp pain, with where. A niggle is only ever reported back to you. <b>Sharp pain is the one answer that outranks every other rule.</b> Once on a lift and the review holds that max instead of adding to it; twice and it comes down, with the joint named. It beats the grinder count, the RPE and the fast-set count, and it applies even when there are too few sessions to judge on otherwise. An averaged score can be argued with; a joint cannot.</p>
  <p class="note">The other half of this is asked before you start rather than after \u2014 see <i>What matters today</i>, above.</p></div>
  <div class="card guide"><h3>What the app works out for you</h3>
  <p><b>The end-of-cycle review.</b> At the end of every block each lift gets a suggested next max \u2014 lower 5%, hold, the standard increase, or a bigger jump \u2014 from your grinders, missed sets, per-set effort on the heavy weeks, average readiness and any pain logged. It shows the arithmetic it used, and nothing is applied until you approve it, lift by lift.</p>
  <p><b>The weekly debrief</b> arrives on a Monday and reads the week you have just finished: what you did, what you missed, and what is worth noticing before you repeat it. <b>The end-of-cycle report</b> takes the whole block, and the <b>six-month report</b> puts where you are now against where you were half a year ago.</p>
  <p><b>The coach</b> answers questions about your own log and can quote the books at you. It only ever suggests: nothing it says changes your program until you do it yourself.</p>
  <p><b>Status</b> is the same thing without the words \u2014 position in the cycle, adherence, strength and conditioning trends, bodyweight and the burn estimate, personal records, the climbing total, your pull-up rung and your benchmark.</p></div>
  <div class="card guide"><h3>Supplements</h3>
  <p class="note">What the books actually recommend, and nothing invented. Level 1 is what they call worth taking; level 2 is optional on top. Setup \u2192 Supplements keeps the list and what you are taking.</p>
  ${[[1,SUPP_LVL[1]],[2,SUPP_LVL[2]],[null,'Named, but not endorsed']].map(([L,head])=>`<h4 class="sub-h">${esc(head||'Level '+L)}</h4><div class="tbl-wrap" style="margin-top:6px"><table><thead><tr><th>Supplement</th><th>Dose</th><th class="n">Source</th></tr></thead><tbody>${Object.values(SUPP).filter(v=>(v.lvl==null?null:v.lvl)===L).map(v=>`<tr><td><b>${esc(v.name)}</b>${v.rec?`<div class="small muted">${esc(v.rec)}</div>`:''}</td><td class="small">${esc(v.dose||'')}</td><td class="n small">${esc(v.src||'')}</td></tr>`).join('')}</tbody></table></div>`).join('')}
  <p class="note">A level-1 entry from TB III is level 1 <i>for building mass</i>, which is the book's own framing \u2014 creatine is not mandatory for somebody running Operator. The bottom table is the ones the books mention and then decline to recommend; they are listed because leaving them out would look like an oversight rather than a verdict.</p></div>
  <div class="card guide"><h3>Deloads and retests</h3>
  <p><b>What the book does.</b> Operator runs six-week blocks back to back and retests after two of them — twelve weeks, which it calls the optimal length of a strength phase. Six weeks is the minimum between tests and suits experienced lifters; waiting longer is fine, and if the loads still feel heavy the advice is to keep your current numbers rather than test on schedule. There is no deload week: the recovery it prescribes is a full week or more off every three to six months. Rest two to three days before a test day, ramp up, and take a 3–5 rep max rather than a true single if you prefer — the calculator does the rest.</p>
  <p><b>What we add.</b> An optional scheduled deload, off by default, because a light week every few cycles suits running this year-round outside a unit. Turn it on in Setup if you want it.</p>
  <p>Deload weeks drop to ${plan.deload.s}×${plan.deload.r} @ ${plan.deload.p}% (deadlift 1 set), swap all HIC to LISS, halve plyos and drop accessories. Retest weeks take three easy days, then heavy singles split across Thursday (squat, bench, jumps) and Saturday (deadlift, Lift 3, max pull-ups). Saturday's card feeds results into the next cycle.</p><p>Need a deload sooner? Add one from the Plan tab, or from the warning on Today after repeated hard sessions.</p></div>
  <div class="card guide"><h3>Calendar feed</h3>
  <p>Your plan, subscribed to in the calendar app you already use. Every training day turns up as an all-day entry with the session on it: which lifts, the sets and reps, the percentage and the actual weight to put on the bar. Rest days are left out. It covers eighteen weeks ahead and a fortnight behind, and it is read-only, so nothing you do in your calendar changes your training.</p>
  <p><b>Turning it on.</b> Setup &rarr; Calendar feed &rarr; <b>Turn on the feed</b>. You get a private web address ending in <code>.ics</code>. That address is all anyone needs to read your schedule, so treat it like a password: don\u2019t post it anywhere, and don\u2019t let it into a shared document.</p>
  <p><b>On iPhone or iPad.</b> The quickest way is the <b>Add to iPhone</b> button on that card, which opens Calendar with the address already filled in. Tap Subscribe, then Add. If the button does nothing, copy the address and go to Settings &rarr; Apps &rarr; Calendar &rarr; Calendar Accounts &rarr; Add Account &rarr; Other &rarr; Add Subscribed Calendar, and paste it there. On older versions of iOS the same screen is at Settings &rarr; Calendar &rarr; Accounts.</p>
  <p><b>On Android.</b> Google Calendar can only add a subscription on a computer, not in the phone app. Open <b>calendar.google.com</b>, find <b>Other calendars</b> in the left column, press <b>+</b>, choose <b>From URL</b>, paste the address and press Add calendar. Then open Google Calendar on the phone, go to the menu &rarr; Settings, find the new calendar in the list and turn <b>Sync</b> on. That last step catches people out: until you do it the calendar exists on your account but never appears on the phone.</p>
  <p><b>Putting it at the time you train.</b> By default every session is an all-day entry, which sits at the top of the day and blocks nothing out. On the same Setup card, switch <b>In the calendar</b> to <b>At a set time</b> and give it your usual training time, and each session is booked properly instead: 75 minutes for a lifting day, 90 for a retest, and for conditioning however long the timer says that format actually runs, so a 23-minute MAP session books 23 minutes. If you train later at weekends, put that time in the <b>Saturdays and Sundays</b> box; leave it empty to use the same time all week.</p>
  <p>The time is read as the local time wherever you are. Set 6am and it stays 6am in another country, rather than sliding to 1am because of the time difference. That is what you want for a training time, and it is why the entries carry no timezone.</p>
  <p><b>Reminders.</b> Pick one under <b>Reminder</b> and every session gets an alert: at the start, or 15 minutes, half an hour, one hour or two hours before. The reminder hangs off the session time, so it needs <b>At a set time</b> to mean anything precise. If you would rather keep all-day entries, the one reminder on offer there is <b>8pm the night before</b>, which is the useful one anyway for packing a bag. Reminders are off until you choose one.</p>
  <p><b>How often it updates.</b> The app writes the calendar, not the server, because the schedule is worked out on your phone and a second copy on the server would eventually disagree with it. So the feed is as fresh as the last time you opened the app. Move a week, change a max, swap a lift: open the app once and the calendar follows. Your calendar app then picks the change up on its own schedule. iPhone usually does that within a few hours, and you can force it by pulling down in Calendar. <b>Google is slow</b> and can take most of a day for the first sync and for later changes. That is Google\u2019s refresh interval, not something this app can hurry.</p>
  <p><b>What is in it, and what is not.</b> The feed carries the schedule only: dates, session types, lifts, prescriptions and working weights. It does not carry what you logged, your maxes, bodyweight, measurements, readiness scores or anything about your account. Someone who found the address would learn what you are planning to lift, and nothing else.</p>
  <p><b>If you need to revoke it.</b> <b>New address</b> on the same card issues a fresh one and stops the old address working immediately. Use it if the link gets out. You then have to re-subscribe on your devices, because the old subscription is pointing at an address that no longer exists. <b>Turn off</b> removes the feed entirely.</p>
  <p><b>If the calendar says it cannot connect.</b> Check the address is the current one, since <b>New address</b> invalidates the previous link. If it is right and it still fails, open this app once to make sure the feed has been written, then try again.</p></div>
  <div class="card guide"><h3>Warm-up</h3>${warmupShort()}
  <p class="note">Anything with a time on it has a ⏱ next to it, on the day's card and inside session mode. Tap it and the timer runs; per-side holds count both sides. “Guide me through it” is the hands-free version of the same list, not the only way to get a clock.</p>
  <p class="note">Session mode shows one ramp set at a time with − and + beside it, stepping by that lift's rounding increment, because the bar does not come in every weight a percentage asks for. What you set is written to that row, the same place typing it on the day's card writes to, so the plates and the “Next” line follow it.</p>
  <p class="note">Between ramp sets the rest is 90 seconds by default, set per lift in the warm-up block on each lift card. Anything under a minute is no longer on offer — it is not long enough once the bar is heavy. If you want more on the day, the running timer takes +30 s as many times as you like.</p></div>
  <div class="card guide"><h3>Warm-up and mobility library</h3><p class="note">Every movement in the warm-up and the mobility blocks, with what it is for and the ways it usually goes wrong. The same entries open from the checklists on the day.</p>
  <div class="stack" style="gap:10px">${[
    ['Raise and reset',['raise','breath9090','catcow','breathwall']],
    ['Spine and t-spine',['thread','openbook','quadtspine','foamtspine','childlat','deadhang']],
    ['Hips',['hip9090','lean9090','couch','frog','wgs','fig4','pigeon','quadstand']],
    ['Hamstrings and posterior chain',['fold','seatedfold','hamstring']],
    ['Ankles and feet',['calfstraight','calfbent','kneewall','footroll']],
    ['Activation',['legswing','bandpull','glutebridge']],
    // Agile 8 is its own group rather than scattered through the others: it is one
    // named routine by one author, and splitting it up would hide that.
    ['Agile 8 \u00b7 Joe DeFranco',['a8itb','a8add','a8glute','a8roll','a8hydrant','a8mtn','a8groiner','a8hipflex']]
  ].map(([g,ids])=>`<div><h4 class="sub-h">${esc(g)}</h4><div class="stack" style="gap:6px;margin-top:6px">${ids.map(id=>`<details class="px" data-px="ml-${id}"${openPx.has('ml-'+id)?' open':''}><summary><span>${esc(MLIB[id].name)}</span></summary>${libBody(MLIB[id])}</details>`).join('')}</div></div>`).join('')}</div></div>`;
}

/* ---------------- calendar feed ----------------
A subscribable .ics of the plan, for iPhone Calendar, Google Calendar or anything else
that reads a URL.

The schedule only exists in this file's neighbors -- weeks(), dayPlan(), rx() -- so the
app generates the calendar and the Worker stores and serves the text verbatim. That keeps
one implementation of the program instead of a second one on the server that could
drift. The cost is that the feed is as fresh as the last time the app was opened, which
for a plan that changes a few times a cycle is no cost at all.

Subscribers cannot sign in, so the feed is addressed by an unguessable token and sits on
the one path that Cloudflare Access has to let through. */

const CAL_BACK = 2, CAL_AHEAD = 18;   // weeks either side of today

function icsEsc(s){return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
// RFC 5545 wants lines folded at 75 octets, continued with a leading space.
function icsFold(line){
  const b=[...line].reduce((a,ch)=>{const w=new TextEncoder().encode(ch).length;const last=a[a.length-1];
    if(last.n+w>74){a.push({s:ch,n:w+1})}else{last.s+=ch;last.n+=w}return a},[{s:'',n:0}]);
  return b.map((x,i)=>i?' '+x.s:x.s).join('\r\n');
}
function icsDate(d){return d.replace(/-/g,'')}
// Floating local time: no Z and no TZID, so 06:00 means 06:00 wherever you happen to be.
// That is what "my usual gym time" means, and it avoids shipping a VTIMEZONE block.
function icsLocal(d,min){const h=Math.floor(min/60),m=min%60;return icsDate(d)+'T'+pad(h)+pad(m)+'00'}
function hhmm(v){const m=/^(\d{1,2}):(\d{2})$/.exec(String(v||''));if(!m)return null;
  const h=+m[1],mi=+m[2];return h<24&&mi<60?h*60+mi:null}
function icsTrigger(min){ if(!min) return '-PT0S'; return min%60===0?'-PT'+(min/60)+'H':'-PT'+min+'M' }

// The feed's timing settings, with anything missing or malformed falling back to sane.
function calOpts(){
  const c=plan.cal||{};
  const alarm=c.alarm==null||c.alarm===''?null:Math.max(0,+c.alarm||0);
  return {timed:c.mode==='timed',start:hhmm(c.time)??360,weekend:hhmm(c.weekend),alarm};
}
// How long to block out. Conditioning asks the interval timer, so the calendar agrees
// with the session card instead of guessing.
function calMins(dp,date){
  if(dp.t==='lift') return 75;
  if(dp.t==='test'||dp.t==='rm5') return 90;
  if(dp.t==='se') return 45;
  let m=0; if(dp.fmt){ try{ m=ivPartsLabel(dp.fmt,ivOpts(date,dp.fmt)).total||0 }catch(e){} }
  if(dp.plyo) return (m||40)+20;   // plyos first, rest, then the HIC
  return m||45;
}

// One line per lift: what it is, the prescription, and the weight to put on the bar.
function calLiftLines(wk,dp,date){
  const out=[];
  for(const k of dp.lifts||[]){
    const r=rx(wk,k,date);
    const sets=r.sMax>r.s?r.s+'\u2013'+r.sMax:r.s;
    const w=r.w!=null?(isBW(k)?fmtLoad(k,r.w):n(r.w)+' '+u()):null;
    out.push(`${liftName(k,date)} \u2014 ${sets} \u00d7 ${r.r} @ ${r.p}%${w?' \u2014 '+w:''}`);
  }
  return out;
}

// Short labels for the title. liftName gives the variant in full ("High-bar back squat"),
// which is what the description wants and what a phone calendar truncates.
const CAL_SHORT={squat:'Squat',bench:'Bench',dead:'Deadlift',ohp:'Press',pull:'Pulldown',wpu:'Weighted pull-up'};
// What a day is, in a few words, for the event title.
function calTitle(wk,dp,date){
  if(dp.t==='lift'||dp.t==='test'||dp.t==='rm5')
    return `${dp.short} \u00b7 ${(dp.lifts||[]).map(k=>CAL_SHORT[k]||liftName(k,date)).join(', ')}`;
  const fmt=dp.fmt&&HIC[dp.fmt]?HIC[dp.fmt].name:null;
  return fmt?`${dp.short} \u00b7 ${fmt}`:dp.short||'Training';
}

function calEvent(date){
  const wk=weekOf(date); if(!wk) return null;
  const dp=dayPlan(date);
  if(!dp||dp.t==='off'||dp.t==='pre') return null;
  const body=[];
  const wt=weekTitle(wk); if(wt&&wt.t) body.push(wt.t);
  if(dp.t==='lift'||dp.t==='test'||dp.t==='rm5') body.push(...calLiftLines(wk,dp,date));
  if(dp.fmt&&HIC[dp.fmt]) body.push(`${HIC[dp.fmt].name} \u2014 ${HIC[dp.fmt].sess}`);
  if(dp.t==='se'){ const ex=seDayList(date); if(ex&&ex.length) body.push('Circuit: '+ex.join(', ')) }
  if(dp.acc) body.push('Accessories: '+accList(dp.acc).join(', '));
  if(dp.note) body.push(dp.note);
  body.push('operatorblack.com');
  return {date,dp,summary:calTitle(wk,dp,date),desc:body.filter(Boolean).join('\n')};
}

function icsFeed(){
  const mon=mondayOf(todayStr());
  const from=addDays(mon,-7*CAL_BACK), to=addDays(mon,7*CAL_AHEAD);
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Operator + Black//Training plan//EN',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEsc(progName()),
    'X-WR-CALDESC:'+icsEsc('Your Operator + Black plan. Updates when you open the app.'),
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H','X-PUBLISHED-TTL:PT6H'];
  const o=calOpts();
  for(let d=from;d<=to;d=addDays(d,1)){
    const e=calEvent(d); if(!e) continue;
    L.push('BEGIN:VEVENT',
      // Stable per day, so a refresh updates the event instead of adding a second one.
      'UID:ob-'+e.date+'@operatorblack.com',
      'DTSTAMP:'+stamp);
    if(o.timed){
      const wknd=dow(d)>=5&&o.weekend!=null, st=wknd?o.weekend:o.start;
      const end=st+calMins(e.dp,d);
      L.push('DTSTART:'+icsLocal(d,st),
        // Past midnight is possible with a late start, so the end rolls into the next day.
        'DTEND:'+icsLocal(addDays(d,Math.floor(end/1440)),end%1440),
        'TRANSP:OPAQUE');
    } else {
      L.push('DTSTART;VALUE=DATE:'+icsDate(e.date),
        'DTEND;VALUE=DATE:'+icsDate(addDays(e.date,1)),
        'TRANSP:TRANSPARENT');
    }
    L.push('SUMMARY:'+icsEsc(e.summary),'DESCRIPTION:'+icsEsc(e.desc));
    if(o.alarm!=null) L.push('BEGIN:VALARM','ACTION:DISPLAY',
      'DESCRIPTION:'+icsEsc(e.summary),'TRIGGER:'+icsTrigger(o.alarm),'END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n')+'\r\n';
}

/* ---------------- talking to the server ---------------- */

let calFeed=null, calBusy=false, calTimer=null;

async function calLoad(){
  try{
    const r=await fetch('/api/calendar',{headers:{accept:'application/json'}});
    if(r.ok){ calFeed=await r.json(); calPush() }
    // The feed needs its own table. If the migration has not been run against the live
    // database this is where it shows up, so say that rather than spinning forever.
    else calFeed={enabled:false,broken:r.status>=500?'db':'http '+r.status};
  }catch(e){ calFeed={enabled:false,broken:'offline'} }
  if(view==='setup') render();
}
async function calSet(op){
  if(calBusy) return; calBusy=true; render();
  try{ const r=await fetch('/api/calendar/'+op,{method:'POST'});
    if(r.ok){ calFeed=await r.json(); LS.set('ob.ics',null) } }
  catch(e){ setStatus('Could not reach the server',true) }
  calBusy=false; render();
  // No debounce here: the card shows the address the moment it exists, so the body has to
  // be there before someone can paste it into a calendar app.
  calPush(true);
}
// Upload the feed only when it has actually changed. The plan moves a few times a cycle
// and the window shifts once a day, so this is normally a no-op.
function calPush(now){
  if(!calFeed||!calFeed.enabled||viewing||schemaAhead) return;
  clearTimeout(calTimer);
  calTimer=setTimeout(async()=>{
    let text; try{ text=icsFeed() }catch(e){ return }
    // DTSTAMP is the time of generation and differs on every call, so compare without it
    // or this would upload an identical calendar every time the app opened.
    const key=icsKey(text);
    if(LS.get('ob.ics')===key) return;
    try{ const r=await fetch('/api/calendar/ics',{method:'PUT',headers:{'content-type':'text/calendar'},body:text});
      if(r.ok) LS.set('ob.ics',key) }catch(e){}
  },now?0:4000);
}

function icsKey(t){return t.replace(/^DTSTAMP:.*$/gm,'')}
function calCount(){ try{ return (icsFeed().match(/BEGIN:VEVENT/g)||[]).length }catch(e){ return 0 } }

function calFeedCard(){
  const f=calFeed;
  let h=`<div class="card"><h2>Calendar feed</h2>
  <p class="note" style="margin:0">Put the plan in your phone's calendar: every session with the lifts and the weights on it, either as an all-day entry or booked at the time you usually train. It is read-only and it refreshes on its own, so moving a week here moves it there.</p>`;
  if(!f) return h+`<div class="muted small">Checking\u2026</div></div>`;
  if(f.broken) return h+`<div class="banner warn"><div>${f.broken==='offline'?'Could not reach the server. The feed will show up when you are back online.':'The server could not answer. If this site was just updated, the calendar table may not exist yet \u2014 run <code>npm run db:migrate:remote</code>.'}</div></div></div>`;
  if(!f.enabled){
    h+=`<div class="row"><button class="btn primary" data-act="calon"${calBusy?' disabled':''}>${calBusy?'Working\u2026':'Turn on the feed'}</button></div>
    <div class="note">This creates a private web address for your plan. Anyone with the address can read your schedule \u2014 not your logs, maxes or anything else \u2014 so treat it like a password and use <b>New address</b> below if you ever share it by accident.</div></div>`;
    return h;
  }
  const web=f.url.replace(/^https?:/,'webcal:');
  h+=`<label class="f">Your feed address<input type="text" id="cal-url" value="${esc(f.url)}" readonly onclick="this.select()"></label>
  <div class="row"><a class="btn primary" href="${esc(web)}">Add to iPhone</a><button class="btn" data-act="calcopy">Copy address</button></div>
  <div class="note"><b>iPhone:</b> tap Add to iPhone above, or Settings \u2192 Apps \u2192 Calendar \u2192 Accounts \u2192 Add Account \u2192 Other \u2192 Add Subscribed Calendar, and paste the address.
  <b>Android:</b> on a computer open Google Calendar \u2192 Other calendars \u2192 + \u2192 From URL, and paste it there. It then syncs to the phone. Google refreshes subscribed calendars on its own schedule, which can take a day.</div>
  ${calTimeFields()}
  <div class="note">${calCount()} sessions, ${CAL_BACK} weeks back and ${CAL_AHEAD} ahead. It is rewritten whenever you open the app and something has changed.</div>
  <div class="row"><button class="btn sm ghost" data-act="calrotate"${calBusy?' disabled':''}>New address</button><button class="btn sm ghost" data-act="caloff"${calBusy?' disabled':''}>Turn off</button></div>
  <div class="small muted">New address stops the old one working, for a link you shared and want back.</div></div>`;
  return h;
}

// When the sessions land, and whether they nudge you. Bound straight to the plan, so a
// change syncs to your other devices and queues a fresh upload like any other plan edit.
function calTimeFields(){
  const c=plan.cal||{}, o=calOpts();
  const al=o.alarm==null?'':String(o.alarm);
  const opts=o.timed
    ? [['','No reminder'],['0','At the start'],['15','15 min before'],['30','30 min before'],['60','1 hour before'],['120','2 hours before']]
    : [['','No reminder'],['240','8pm the night before']];
  let h=`<div class="grid2"><label class="f">In the calendar<select id="cal-mode" data-pbind="cal.mode">
    <option value="allday"${o.timed?'':' selected'}>All-day entries</option>
    <option value="timed"${o.timed?' selected':''}>At a set time</option></select></label>`;
  h+=o.timed?`<label class="f">Usual training time<input type="time" id="cal-time" data-pbind="cal.time" value="${esc(c.time||'06:00')}"></label></div>
    <div class="grid2"><label class="f">Saturdays and Sundays<input type="time" id="cal-wk" data-pbind="cal.weekend" value="${esc(c.weekend||'')}" placeholder="same"></label>`
    :'</div><div class="grid2">';
  h+=`<label class="f">Reminder<select id="cal-alarm" data-pbind="cal.alarm" data-type="num">${opts.map(([v,l])=>`<option value="${v}"${v===al?' selected':''}>${l}</option>`).join('')}</select></label></div>`;
  h+=o.timed
    ? `<div class="note">Sessions are booked from that time for as long as each one takes: 75 minutes for a lifting day, 90 for a retest, and for conditioning whatever the timer says that format runs to. Leave the weekend box empty to use the same time every day. The time is read as the local time wherever you are, so it stays at ${esc(c.time||'06:00')} when you travel rather than shifting with the clocks.</div>`
    : `<div class="note">All-day entries sit at the top of the day and don't block out any time. Switch to <b>At a set time</b> if you want the session in your day properly, or a reminder closer to it than the evening before.</div>`;
  return h;
}

/* ---------------- administration ----------------
Visible only to addresses in the ADMIN_EMAILS secret. The page asks the server whether
you are one — it never decides for itself — and the server checks every admin route
again regardless, so hiding the link is a convenience and not the control.

What it shows is deliberately narrow. Counts, dates and whether the last backup verified
are enough to run the thing. Reading somebody's training log is not administration, so
there is no screen for it: the export hands their data back whole, which is what you
would want it for. */

let admin = { list: null, loading: false, err: null, busy: null, confirm: null, typed: '', log: null };

async function adminLoad(force) {
  if (admin.loading || (admin.list && !force)) return;
  admin.loading = true; admin.err = null;
  try { const r = await api('GET', '/admin/users'); admin.list = r.users; admin.me = r.me; }
  catch (e) { admin.err = e && e.status === 404 ? 'This account is not an administrator.' : 'Could not load the list.'; }
  admin.loading = false; if (view === 'admin') render();
}
async function adminLoadLog(force) {
  if (admin.logLoading || (admin.log && !force)) return;
  admin.logLoading = true;
  try { const r = await api('GET', '/admin/log'); admin.log = r.log || []; admin.logErr = r.error || null; }
  catch (e) { admin.log = []; admin.logErr = 'Could not load the record.'; }
  admin.logLoading = false; if (view === 'admin') render();
}

// A removal stores what it took as JSON; show it as something readable.
function adminDetail(raw) {
  try {
    const d = JSON.parse(raw);
    const bits = [];
    if (d.docs != null) bits.push(d.docs + ' document' + (d.docs === 1 ? '' : 's'));
    if (d.backups != null) bits.push(d.backups + ' backup' + (d.backups === 1 ? '' : 's'));
    if (d.calendar) bits.push('calendar feed');
    if (d.alerts) bits.push('alerts');
    return bits.join(', ');
  } catch { return String(raw).slice(0, 80) }
}
async function adminBackups(who) {
  admin.bkFor = who; admin.bk = null; admin.bkErr = null; render();
  try { const r = await api('GET', '/admin/users/' + encodeURIComponent(who) + '/backups'); admin.bk = r.backups || []; }
  catch (e) { admin.bk = []; admin.bkErr = 'Could not load their backups.'; }
  render();
}
async function adminRestore(who, name) {
  admin.busy = who; render();
  try {
    const r = await api('POST', '/admin/users/' + encodeURIComponent(who) + '/restore', { name, confirm: who });
    admin.msg = `Restored ${who} from ${name}: ${r.restored.logs} logged day${r.restored.logs === 1 ? '' : 's'}. Their previous data was saved as ${r.safetyBackup}.`;
    admin.rsFor = null; admin.typed = ''; admin.bkFor = null; admin.bk = null;
    admin.list = null; admin.log = null;
    await adminLoad(true); await adminLoadLog(true);
  } catch (e) {
    admin.err = e && e.status === 400 ? 'That did not match. Nothing was restored.' : 'Could not restore that backup.';
  }
  admin.busy = null; render();
}

async function adminWipe(who) {
  admin.busy = who;
  render();
  try {
    const r = await api('DELETE', '/admin/users/' + encodeURIComponent(who), { confirm: who });
    admin.confirm = null; admin.typed = '';
    admin.msg = `Removed ${who}: ${r.removed.docs} documents, ${r.removed.backups} backups.`;
    admin.list = null; admin.log = null;
    await adminLoad(true); await adminLoadLog(true);
  } catch (e) {
    admin.err = e && e.status === 400 ? 'That did not match. Nothing was removed.' : 'Could not remove that account.';
  }
  admin.busy = null; render();
}

// Their backups, newest first, with the one thing worth doing to them. Restoring
// replaces everything they have right now, so it asks in the same way a removal does.
function adminBackupList(who) {
  if (admin.bkErr) return `<div class="banner warn"><div>${esc(admin.bkErr)}</div></div>`;
  if (!admin.bk) return `<div class="small muted" style="margin-top:6px">Loading their backups\u2026</div>`;
  if (!admin.bk.length) return `<div class="small muted" style="margin-top:6px">They have no backups.</div>`;
  let h = `<div class="stack" style="gap:6px;margin-top:8px">`;
  for (const b of admin.bk.slice(0, 10)) {
    const kind = b.name.endsWith('-manual') ? 'taken by hand' : b.name.includes('before-restore') ? 'before a restore' : 'weekly';
    h += `<div class="row between" style="gap:8px"><span class="small"><b class="mono">${esc(b.name.replace(/-(manual|before-restore(-\d{6})?)$/, ''))}</b>
      <span class="muted">${esc(kind)}${b.logs != null ? ' \u00b7 ' + b.logs + ' day' + (b.logs === 1 ? '' : 's') : ''}${b.bytes ? ' \u00b7 ' + Math.round(b.bytes / 1024) + ' kB' : ''}</span></span>
      <button class="btn sm ghost" data-act="adminrs" data-user="${esc(who)}" data-name="${esc(b.name)}">Restore\u2026</button></div>`;
    if (admin.rsFor === who + '|' + b.name) {
      const ok = admin.typed.trim().toLowerCase() === who.toLowerCase();
      h += `<div class="banner alert"><div><b>This replaces everything ${esc(who)} has now</b> with the contents of ${esc(b.name)}.
      Their current data is saved as a \u201cbefore restore\u201d backup first, so it can be undone \u2014 but they will see their training change.
      <label class="f" style="margin-top:8px">Type their address to confirm<input type="text" id="admin-confirm-restore" data-adminconfirm value="${esc(admin.typed)}" placeholder="${esc(who)}" autocomplete="off"></label></div>
      <div class="row"><button class="btn sm" data-act="adminrsoff">Cancel</button><button class="btn sm primary" data-act="adminrsgo" data-user="${esc(who)}" data-name="${esc(b.name)}"${ok && admin.busy !== who ? '' : ' disabled'}>${admin.busy === who ? 'Restoring\u2026' : 'Restore this backup'}</button></div></div>`;
    }
  }
  return h + `</div>`;
}

let catNew = { name: '', slot: 'hpull', gear: '' };
async function catSave(body) {
  admin.catBusy = true; render();
  try {
    const r = await api('POST', '/admin/catalog', body);
    catalog = r.catalog || catalog; LS.set('ob.catalog', catalog);
    admin.catErr = null;
  } catch (e) { admin.catErr = 'Could not save that.' }
  admin.catBusy = false; render();
}
async function catRemove(id) {
  admin.catBusy = true; render();
  try {
    const r = await api('DELETE', '/admin/catalog/' + encodeURIComponent(id));
    catalog = r.catalog || catalog; LS.set('ob.catalog', catalog);
  } catch (e) { admin.catErr = 'Could not remove that.' }
  admin.catBusy = false; render();
}

// The shared list, grouped by the job each movement does.
function vCatalog() {
  const all = accAll();
  let h = `<div class="card"><div class="lift-h"><h2>Exercise list</h2><span class="small muted">${Object.keys(all).length} movements</span></div>
  <p class="note" style="margin:0">What everyone can choose from for their accessories. <b>Retiring</b> a movement stops it being offered; anyone who has already chosen it keeps it until they change it themselves, so nobody's program is rewritten mid-cycle.</p>`;
  if (admin.catErr) h += `<div class="banner warn"><div>${esc(admin.catErr)}</div></div>`;

  for (const [slot, meta] of Object.entries(ASLOT)) {
    const ids = Object.keys(all).filter(k => all[k].slot === slot);
    if (!ids.length) continue;
    h += `<div style="border-top:1px solid var(--line);padding-top:8px"><div class="small" style="font-weight:650">${esc(meta.name)}</div>
    <div class="stack" style="gap:4px;margin-top:4px">${ids.map(id => {
      const e = all[id];
      return `<div class="row between" style="gap:8px"><span class="small${e.hidden ? ' muted' : ''}">${esc(e.name)}${e.hidden ? ' \u00b7 retired' : ''}${e.shared ? ' <span class="chip">added</span>' : ''}${e.mine ? ' <span class="chip">personal</span>' : ''}<span class="muted"> ${esc(e.gear || '')}</span></span>
      <span class="row" style="gap:6px">${e.mine ? '' : `<button class="btn sm ghost" data-act="cathide" data-id="${esc(id)}" data-slot="${esc(slot)}" data-name="${esc(e.name)}" data-gear="${esc(e.gear || '')}" data-on="${e.hidden ? '0' : '1'}"${admin.catBusy ? ' disabled' : ''}>${e.hidden ? 'Bring back' : 'Retire'}</button>`}
      ${e.shared ? `<button class="btn sm ghost" data-act="catrm" data-id="${esc(id)}"${admin.catBusy ? ' disabled' : ''}>Remove</button>` : ''}</span></div>`;
    }).join('')}</div></div>`;
  }

  h += `<div style="border-top:1px solid var(--line);padding-top:12px"><div class="small" style="font-weight:650">Add a movement</div>
  <div class="grid3" style="margin-top:6px"><label class="f">Name<input type="text" id="catnew-name" data-catnew="name" value="${esc(catNew.name)}" placeholder="e.g. Spider curl"></label>
  <label class="f">Job<select id="catnew-slot" data-catnew="slot">${Object.entries(ASLOT).map(([k, v]) => `<option value="${k}"${k === catNew.slot ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
  <label class="f">Kit<input type="text" id="catnew-gear" data-catnew="gear" value="${esc(catNew.gear)}" placeholder="e.g. EZ bar"></label></div>
  <div class="row"><button class="btn" data-act="catadd"${catNew.name.trim() && !admin.catBusy ? '' : ' disabled'}>Add for everyone</button></div></div>`;
  return h + `</div>`;
}

function vAdmin() {
  let h = `<div class="card"><div class="lift-h"><h2>People</h2><button class="btn sm ghost" data-act="adminrefresh">Refresh</button></div>
  <p class="note" style="margin:0">Everyone with data in this app. Counts and dates only — their sessions and numbers are theirs, and there is no screen here that shows them.</p>`;
  if (admin.msg) h += `<div class="banner info"><div>${esc(admin.msg)}</div></div>`;
  if (admin.err) h += `<div class="banner warn"><div>${esc(admin.err)}</div></div>`;
  if (!admin.list) { h += `<div class="small muted">${admin.loading ? 'Loading…' : 'Nothing loaded.'}</div></div>`; adminLoad(); return h; }

  for (const u of admin.list) {
    const mine = u.user === admin.me;
    const when = u.last ? fmtD(new Date(u.last).toISOString().slice(0, 10), true) : '—';
    h += `<div style="border-top:1px solid var(--line);padding-top:10px;margin-top:10px">
    <div class="row between" style="gap:8px"><b style="word-break:break-all">${esc(u.user)}</b>${u.admin ? '<span class="chip blue">admin</span>' : ''}${mine ? '<span class="chip">you</span>' : ''}</div>
    <div class="small muted">${u.logs} logged day${u.logs === 1 ? '' : 's'} · ${u.docs} document${u.docs === 1 ? '' : 's'} · ${Math.round((u.bytes || 0) / 1024)} kB · last activity ${esc(when)}</div>
    <div class="small ${u.backupOk === false ? 'warn-t' : 'muted'}">${u.backups} backup${u.backups === 1 ? '' : 's'}${u.backupOk === true ? ' · last one verified' : u.backupOk === false ? ' · the last one did NOT verify' : ' · never checked'}</div>
    <div class="row" style="gap:8px;margin-top:6px"><a class="btn sm" href="/api/admin/users/${encodeURIComponent(u.user)}/export">Export their data</a>
    <button class="btn sm" data-act="adminbk" data-user="${esc(u.user)}">${admin.bkFor === u.user ? 'Hide backups' : 'Backups\u2026'}</button>
    ${mine ? '<span class="small muted">You cannot clear your own account from here.</span>'
      : `<button class="btn sm ghost" data-act="adminclear" data-user="${esc(u.user)}">Clear their data…</button>`}</div>`;
    if (admin.bkFor === u.user) h += adminBackupList(u.user);

    if (admin.confirm === u.user) {
      const ok = admin.typed.trim().toLowerCase() === u.user.toLowerCase();
      h += `<div class="banner alert" style="margin-top:8px"><div><b>This removes everything ${esc(u.user)} has.</b>
      Their plan, every logged session, all their backups, their calendar feed and their alerts. It cannot be undone from here, so export first if they might want it.
      <label class="f" style="margin-top:8px">Type their address to confirm<input type="text" id="admin-confirm-clear" data-adminconfirm value="${esc(admin.typed)}" placeholder="${esc(u.user)}" autocomplete="off"></label></div>
      <div class="row"><button class="btn sm" data-act="adminclearoff">Cancel</button><button class="btn sm primary" data-act="adminwipe" data-user="${esc(u.user)}"${ok && admin.busy !== u.user ? '' : ' disabled'}>${admin.busy === u.user ? 'Removing…' : 'Remove everything'}</button></div></div>`;
    }
    h += `</div>`;
  }
  h += `</div>`;

  h += vCatalog();
  h += `<div class="card"><div class="lift-h"><h2>Audit log</h2><button class="btn sm ghost" data-act="adminlog">Refresh</button></div>
  <p class="note" style="margin:0">Every export and every removal, newest first. Written by the server as it happens; there is no route that edits or clears it.</p>`;
  if (admin.logErr) h += `<div class="banner warn"><div>${esc(admin.logErr)}</div></div>`;
  if (!admin.log) { h += `<div class="small muted">${admin.logLoading ? 'Loading\u2026' : ''}</div>`; adminLoadLog(); }
  else if (!admin.log.length) h += `<div class="small muted">Nothing yet.</div>`;
  else h += `<div class="stack" style="gap:8px">${admin.log.map(e => {
    const d = new Date(e.at);
    const when = `${fmtD(d.toISOString().slice(0, 10), true)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `<div class="small" style="border-top:1px solid var(--line);padding-top:6px">
      <b>${e.action === 'delete' ? 'Removed' : 'Exported'}</b> ${esc(e.subject)}
      <div class="muted">${esc(when)} \u00b7 by ${esc(e.actor)}${e.detail ? ' \u00b7 ' + esc(adminDetail(e.detail)) : ''}</div></div>`;
  }).join('')}</div>`;
  return h + `</div>`;
}

/* ---------------- the coach ---------------- */
/* A conversation, not a series of lookups. Advice only: the coach can read the plan
   and the books and cannot change anything, which the card says rather than leaving
   to be inferred. Suggestions come back as their own items so that turning them into
   one-tap actions later is a change to this file, not to the contract with the
   server. */
let coach={q:'',busy:false,err:null,last:null,turns:null,thread:null,loaded:false};
const LIBNAME={tb1:'TB1',tb2:'TB2',tb3:'TB III',aa:'Ageless Athlete'};

function coachLoad(){
  if(coach.loaded) return; coach.loaded=true;
  api('GET','/coach').then(r=>{ coach.turns=r.turns||[]; coach.thread=r.thread||null;
    coach.used=r.used; coach.cap=r.cap; coach.configured=r.configured; coach.debrief=r.debrief||null; render() })
    .catch(()=>{ coach.turns=[]; render() });
}
function coachAsk(){
  const q=coach.q.trim(); if(!q||coach.busy) return false;
  // Shown straight away with no answer under it, so a slow reply looks like thinking
  // rather than like nothing happening.
  coach.turns=(coach.turns||[]).concat([{id:'pending',asked_at:Date.now(),question:q,answer:'',cites:[],pending:true}]);
  coach.busy=true; coach.err=null; coach.q='';
  render();
  api('POST','/coach',{q,thread:coach.thread||undefined})
    .then(r=>{ coach.last=r; coach.used=r.used; coach.thread=r.thread; coach.busy=false;
      coach.turns=(coach.turns||[]).filter(t=>!t.pending)
        .concat([{id:r.id,asked_at:Date.now(),question:q,answer:r.answer,cites:r.cites||[]}]);
      render() })
    .catch(e=>{ coach.err=(e&&e.message)||'That did not go through.'; coach.busy=false;
      // The question comes back into the box rather than being lost with the attempt.
      coach.turns=(coach.turns||[]).filter(t=>!t.pending); coach.q=q; render() });
  return true;
}
/* The Monday debrief. Written by the server's cron, not asked for, so it lands on
   Today until it has been read -- and stays at the top of Coach for the week either
   way, because "I dismissed it" should not mean "I can never find it again". */
function debriefSeen(){
  const d=coach.debrief; if(!d||d.seen) return false;
  d.seen=true; render();
  api('POST','/coach/debrief/seen',{week:d.week}).catch(()=>{});
  return true;
}
function debriefHtml(d,today){
  return `<div class="card coach-t"><div class="lift-h"><h3>Coach's debrief</h3><span class="small muted">Week of ${esc(fmtLong(d.week))}</span></div>
  <div class="coach-a">${mdLite(d.answer)}</div>
  ${(d.suggestions||[]).map(s=>`<div class="acc-slot"><div style="font-weight:650">${esc(s.title||'')}</div><div class="small muted">${esc(s.detail||'')}</div></div>`).join('')}
  ${citeLine(d.cites)}
  ${today?`<div class="row" style="gap:10px;align-items:center;margin-top:8px"><button class="btn sm" data-act="debriefseen">Got it</button><button class="btn sm ghost" data-act="view" data-view="coach">Talk it over</button></div>`:''}</div>`;
}
function debriefCard(){
  if(viewing||sel!==todayStr()) return '';
  coachLoad();
  const d=coach.debrief;
  return d&&!d.seen?debriefHtml(d,true):'';
}
function coachNew(){ coach.thread=null; coach.turns=[]; coach.last=null; coach.err=null; render(); return true }

// A citation is only worth printing if it can be found again, so it carries the book
// and the page rather than just a name.
function citeLine(cites){
  if(!cites||!cites.length) return '';
  const byDoc={}; for(const c of cites){ (byDoc[c.doc]=byDoc[c.doc]||[]).push(c.ref) }
  const parts=Object.entries(byDoc).map(([d,refs])=>`${esc(LIBNAME[d]||d)} ${esc(refs.slice(0,4).join(', '))}`);
  return `<div class="small muted">Read from: ${parts.join(' · ')}</div>`;
}
function vCoach(){
  coachLoad();
  const turns=coach.turns;
  let h=`<div class="card"><div class="lift-h"><h2>Coach</h2>${coach.cap?`<span class="small muted">${coach.used||0} of ${coach.cap} this month</span>`:''}</div>
  <p class="note" style="margin:0">It can read your plan, your last four weeks and your copies of the four books, and will search the web when they do not cover something. It cannot change anything — everything it says is a suggestion you act on yourself.</p>`;
  if(coach.configured===false) h+=`<div class="banner warn"><div class="small">No API key set on the server, so the coach cannot answer yet.</div></div>`;
  h+=`</div>`;

  if(coach.debrief) h+=debriefHtml(coach.debrief,false);
  if(turns===null) h+=`<div class="card"><p class="small muted" style="margin:0">Loading…</p></div>`;
  else if(!turns.length) h+=`<div class="card"><p class="note" style="margin:0">Ask it anything about your training. It answers from the books first and says so when it is going beyond them, and it remembers the rest of this conversation — so you can just say “why?”</p></div>`;

  for(const x of (turns||[])){
    h+=`<div class="card coach-t"><div class="coach-q">${esc(x.question)}</div>`;
    if(x.pending) h+=`<div class="small muted">Thinking…</div>`;
    else{
      h+=`<div class="coach-a">${mdLite(x.answer)}</div>`;
      if(coach.last&&coach.last.id===x.id&&coach.last.truncated)
        h+=`<div class="note">That answer hit its length limit, so it stops short. Ask for the rest, or ask something narrower.</div>`;
      const sugg=coach.last&&coach.last.id===x.id?coach.last.suggestions:null;
      if(sugg&&sugg.length){
        h+=`<div class="small muted" style="font-weight:650;margin-top:8px">Worth considering</div>`;
        for(const s of sugg) h+=`<div class="acc-slot"><div style="font-weight:650">${esc(s.title||'')}</div><div class="small muted">${esc(s.detail||'')}</div></div>`;
        h+=`<div class="small muted">Nothing here has been applied. Make the changes yourself in Plan or Setup.</div>`;
      }
      h+=citeLine(x.cites);
    }
    h+=`</div>`;
  }

  h+=`<div class="card"><label class="f">${(turns||[]).length?'Reply':'Ask'}<textarea id="coach-q" data-coachq="1" rows="3" placeholder="${(turns||[]).length?'Follow up, or ask something else…':'e.g. I have missed two HICs this week, what should I drop?'}">${esc(coach.q)}</textarea></label>
  <div class="row" style="gap:10px;align-items:center"><button class="btn primary" data-act="coachask" ${coach.busy||!coach.q.trim()?'disabled':''}>${coach.busy?'Thinking…':'Send'}</button>
  ${(turns||[]).length?`<button class="btn sm ghost" data-act="coachnew">New topic</button>`:''}
  <span class="small muted">Searches the web if the books do not cover it.</span></div>`;
  if(coach.err) h+=`<div class="banner warn"><div class="small">${esc(coach.err)}</div></div>`;
  return h+`</div>`;
}
/* Just enough markdown for what the coach actually returns: paragraphs, bullets, bold
   and inline code. Everything is escaped first, so a model that emits a tag writes
   text rather than markup. */
function mdLite(src){
  const lines=String(src||'').split('\n'); let out='',list=false;
  for(let raw of lines){
    const t=esc(raw.trim())
      .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
      .replace(/`([^`]+)`/g,'<code>$1</code>');
    if(/^[-*]\s+/.test(raw.trim())){ if(!list){out+='<ul class="tight">';list=true} out+=`<li>${t.replace(/^[-*]\s+/,'')}</li>`; continue }
    if(list){out+='</ul>';list=false}
    if(t) out+=`<p>${t}</p>`;
  }
  return out+(list?'</ul>':'');
}

/* ---------------- copying something out of the app ----------------
Five buttons all did `if(navigator.clipboard) ... .then(done,()=>{})`, which means that
where the clipboard is missing or refuses, the button does nothing at all: no copy, no
message, no fallback. Reported as "I did it but I didn't get anything to send you",
which is exactly what that looks like from the outside.

Three ways out, in order, and the last one cannot fail: the async clipboard, the old
execCommand on a temporary textarea, and failing both, put the text on the screen in a
selected box so it can be copied by hand or photographed. */
let copyFallback=null;
/* The last resort, shown at the top of whatever view you are on: the text, selected,
   in a box. Copy it by hand or photograph it -- either way there is something to send,
   which was the whole point of the button. */
function copyBox(){
  if(!copyFallback) return '';
  return `<div class="card"><div class="lift-h"><h3>Here it is</h3><button class="btn sm ghost" data-act="copydismiss">Close</button></div>
  <p class="note" style="margin:0">This phone would not let the app put it on the clipboard. Select it and copy it, or take a screenshot \u2014 either works.</p>
  <textarea id="copy-out" class="mono small" rows="10" readonly style="width:100%">${esc(copyFallback.text)}</textarea></div>`;
}
function copyOut(btn,text,label){
  const say=(t)=>{ if(btn){ btn.textContent=t; setTimeout(()=>{ if(btn) btn.textContent=label },2500) } };
  const ok=()=>{ copyFallback=null; say('Copied'); render() };
  const fail=()=>{ copyFallback={text,label}; say('Can\u2019t copy \u2014 shown below'); render() };
  const legacy=()=>{
    try{
      const ta=document.createElement('textarea');
      ta.value=text; ta.setAttribute('readonly','');
      ta.style.position='fixed'; ta.style.top='-1000px';
      document.body.appendChild(ta); ta.select();
      const done=document.execCommand&&document.execCommand('copy');
      ta.remove();
      return !!done;
    }catch(e){ return false }
  };
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(ok,()=>{ legacy()?ok():fail() });
      return;
    }
  }catch(e){}
  legacy()?ok():fail();
}
/* ---------------- events ---------------- */
function val(t){ if(t.type==='checkbox') return t.checked; if(t.dataset.type==='num'||t.type==='number') return t.value===''?null:+t.value; return t.value; }
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.hasAttribute&&t.hasAttribute('data-adminconfirm')){ admin.typed=t.value; render(); return; }
  // Re-rendering keeps the Add button's state honest; the fields carry ids so focus
  // and the caret survive it.
  // The question is held in memory, not the plan: it is not training data.
  if(t.dataset.coachq){ coach.q=t.value; const btn=document.querySelector('[data-act="coachask"]'); if(btn) btn.disabled=!t.value.trim()||coach.busy; return; }
  if(t.dataset.catnew){ catNew[t.dataset.catnew]=t.value; render(); return; }
  if(t.dataset.accnew){ accNew[t.dataset.accnew]=t.value; render(); return; }
  if(t.dataset.suppnew){ suppNew[t.dataset.suppnew]=t.value; render(); return; }
  if(t.hasAttribute&&t.hasAttribute('data-warmmine')){
    // Same shape as the mobility lists: "movement, dose" a line.
    const rows=t.value.split('\n').map(l=>l.trim()).filter(Boolean)
      .map(l=>{const i=l.indexOf(',');return i<0?[l,'']:[l.slice(0,i).trim(),l.slice(i+1).trim()]});
    setPlan('warmCustom',rows); return;
  }
  if(t.dataset.bandnew){ bandNew[t.dataset.bandnew]=t.value; render(); return; }
  if(t.dataset.wz&&wz){ const k=t.dataset.wz; if(k.startsWith('maxes.')) wz.maxes[k.slice(6)]=t.value; else wz[k]=k==='start'?(t.value||wz.start):t.value; return; }
  if(t.dataset.np&&newProg){ const k=t.dataset.np; newProg[k]=k==='start'?(t.value?mondayOf(t.value):newProg.start):t.value; newProg.arm=false; newProg.err=null; if(k==='mode') render(); return; }
  if(viewing&&(t.dataset.bind||t.dataset.pbind||t.dataset.cmax||t.dataset.accday)){ readOnly(); return; }
  if(t.dataset.bind){ if(t.dataset.bind.startsWith('hic.')&&!(lg(sel).hic||{}).mod) setPath(logs[sel]||(logs[sel]={date:sel}),'hic.mod',modOf(sel)); setLog(sel,t.dataset.bind,val(t)); }
  else if(t.dataset.pbind){
    let v=val(t);
    if(t.dataset.pbind==='startMonday'){ if(!v) return; v=mondayOf(v); }
    if(t.dataset.pbind==='startMonday'||t.dataset.pbind==='bridge'){ plan.frozen={}; plan.lockedMax={}; plan.order={}; }
    setPlan(t.dataset.pbind,v);
  }
  else if(t.dataset.cmax){ const [c,k]=t.dataset.cmax.split('.'); const v=val(t); plan.cycleMaxes[c]=plan.cycleMaxes[c]||{}; if(v==null) delete plan.cycleMaxes[c][k]; else plan.cycleMaxes[c][k]=v; if(!Object.keys(plan.cycleMaxes[c]).length) delete plan.cycleMaxes[c]; planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.calc){ calc5[t.dataset.calc]=val(t); }
  else if(t.dataset.trvday){ const d=t.dataset.trvday, xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.lastIndexOf(', ');return i>0?[x.slice(0,i),x.slice(i+2)]:[x,'']}); plan.travel=Object.assign({},plan.travel||{},{[d]:xs}); planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.seex!=null){ const i=+t.dataset.seex, ex=seDayList(sel).slice(); ex[i]=t.value; setLog(sel,'se.ex',ex); }
  else if(t.hasAttribute&&t.hasAttribute('data-seMine')){ const xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean); plan.se=Object.assign({},plan.se,{custom:xs}); planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.mobday){ const d=t.dataset.mobday, xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.lastIndexOf(', ');return i>0?[x.slice(0,i),x.slice(i+2)]:[x,'']}); plan.mob=Object.assign({},plan.mob||{},{[d]:xs}); planV++; queueWrite('plan/main',()=>plan); }
  else if(t.dataset.accday){ const d=t.dataset.accday, xs=t.value.split('\n').map(x=>x.trim()).filter(Boolean); plan.acc=Object.assign({},plan.acc||{},{[d]:xs}); planV++; queueWrite('plan/main',()=>plan); }
});
(function(){
  const tip=document.getElementById('tip');
  const show=el=>{const r=el.getBoundingClientRect();tip.textContent=el.dataset.tip;tip.style.left=(r.left+r.width/2)+'px';tip.style.top=(r.top)+'px';tip.hidden=false};
  const hide=()=>{tip.hidden=true};
  document.addEventListener('pointerover',e=>{const el=e.target.closest&&e.target.closest('.ch-hit');el?show(el):hide()});
  document.addEventListener('focusin',e=>{const el=e.target.closest&&e.target.closest('.ch-hit');el?show(el):hide()});
  window.addEventListener('scroll',hide,{passive:true});
})();
document.addEventListener('toggle',e=>{const d=e.target;if(!d.matches)return;if(d.dataset&&d.dataset.px){d.open?openPx.add(d.dataset.px):openPx.delete(d.dataset.px);return}if(d.matches('details.wu')){d.open?openWarm.add(d.dataset.lift):openWarm.delete(d.dataset.lift)}else if(d.id&&d.id.startsWith('ci-')){const k=d.id.slice(3);d.open?openCI.add(k):openCI.delete(k)}},true);
document.addEventListener('change',e=>{ const t=e.target;
  if(t.dataset&&t.dataset.actAccadd){
    const d=t.dataset.actAccadd, k=t.value; if(!k||!ASLOT[k]) return;
    mutatePlan(p=>{p.accSlots=Object.assign({},p.accSlots||{},{[d]:[...accSlots(d),k]})});
    return;
  }
  if(t.dataset&&t.dataset.actSuper){ const [day,sl]=t.dataset.actSuper.split(':'); accSuperToggle(day,sl); return }
  if(t.dataset&&t.dataset.actAccpick){
    const [day,sl]=t.dataset.actAccpick.split(':'), cyc=accCycleOf(todayStr());
    if(accLater||cyc==null){ setPlan('accPick.'+day+'.'+sl,t.value); render(); return }
    mutatePlan(p=>{const c=Object.assign({},p.accCycle||{});
      c[cyc]=Object.assign({},c[cyc]||{},{[day]:Object.assign({},(c[cyc]||{})[day]||{},{[sl]:t.value})});
      p.accCycle=c});
    return;
  }
  // Picking a band fills every empty set's weight for that slot, and leaves anything
  // you already typed alone.
  if(t.dataset&&t.dataset.actBand){
    const sl=t.dataset.actBand, w=+t.value;
    if(w>0){ const cur=accSets(sel,sl).slice();
      if(!cur.length) cur.push({});
      setLog(sel,'acc.sets.'+sl,cur.map(x=>x&&x.w!=null&&x.w!==''?x:Object.assign({},x,{w})));
    }
    t.value=''; render(); return;
  }
  if(t.dataset&&t.dataset.actFob){
    setFob(sel,t.value); render(); return;
  }
  if(t.dataset&&t.dataset.actAcc){
    const sl=t.dataset.actAcc, v=t.value;
    // Only a real difference from the block's choice is worth storing as a swap.
    setLog(sel,'acc.ex.'+sl, v===accPickFor(accDayOf(sel),sl,accCycleOf(sel))?null:v);
    render(); return;
  }
  if(t.dataset&&t.dataset.actVar){ const k=t.dataset.actVar,v=t.value; if(v!==varOf(k,sel)){ const cur=(lg(sel).var)||{}; setLog(sel,'var',Object.assign({},cur,{[k]:v===varDefault(k)?null:v})); openWarm.clear(); } render(); return; } });
/* Remember which Setup section was open. Per device, like the theme: it is about how
   you are using this phone right now, not a property of the program. */
document.addEventListener('toggle',e=>{
  const d=e.target; if(!d||!d.dataset||!d.dataset.sec) return;
  setSetupOpen(d.dataset.sec,d.open);
},true);
document.addEventListener('change',e=>{ const t0=e.target; if(t0.dataset&&t0.dataset.actChange){ if(t0.dataset.actChange==='wzbb'){ if(wz){wz.bb=t0.checked; render()} return } if(t0.dataset.actChange==='wzplyo'){ if(wz){wz.plyo=t0.checked; render()} return } setLog(sel,'hic.iv.'+(t0.dataset.actChange==='ivwarm'?'warm':'cool'),t0.checked); render(); return; } });
document.addEventListener('change',e=>{ const t=e.target; if(t.dataset.bind||t.dataset.pbind||t.dataset.cmax||t.dataset.calc||t.dataset.accday||t.dataset.mobday||t.dataset.trvday||t.dataset.np) render(); });
// Top-level navigation: the tabs and the account menu. Remembers the tab across loads.
function goView(v){view=v;try{localStorage.setItem('ob.view',view)}catch(err){}render();window.scrollTo(0,0)}
document.getElementById('nav').addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(!b)return;goView(b.dataset.view)});
document.getElementById('main').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act;
  if(a==='progview'){enterArchive(b.dataset.id);return}
  if(a==='progexit'){exitArchive();return}
  // an archived program is read-only: only navigation works
  if(a==='csv'){exportCsv(b.dataset.v);return}
  if(a==='dlcheck'){const wk=weekOf(sel),c=wk&&wk.cycle,v=b.dataset.v;if(!c)return;replan(v==='keep'?'Deload setting kept':'Deload every '+v+' cycles',p=>{if(v!=='keep')p.deloadEvery=+v;p.deloadChecks=Object.assign({},p.deloadChecks||{},{[c]:{at:realToday(),choice:v==='keep'?+p.deloadEvery||0:+v}})});return}
  if(a==='platetoggle'){const v=+b.dataset.v,cur=plateSet();const next=cur.includes(v)?cur.filter(x=>x!==v):[...cur,v];if(!next.length)return;mutatePlan(p=>{p.plates=Object.assign({},p.plates||{},{[u()]:next.sort((a,b)=>b-a)})});return}
  if(a==='bookcadence'&&!viewing){replan('Set to the book\u2019s cadence',p=>{p.testEvery=2;p.deloadEvery=0});return}
  if(a==='deloadevery'&&!viewing){const v=+b.dataset.v;if((+plan.deloadEvery||0)===v)return;replan(v?'Deload every '+v+' cycles':'Deloads off',p=>{p.deloadEvery=v});return}
  if(viewing&&!['go','open','view','more','updcheck','updnow','rvsel'].includes(a)){readOnly();return}
  if(a==='prognew'){newProg={name:'Block '+((plan.programSeq||1)+1),start:addDays(mondayOf(realToday()),7),mode:'carry'};render();return}
  if(a==='progcancel'){newProg=null;render();return}
  if(a==='progstart'){if(!newProg.arm){newProg.arm=true;newProg.err=null;render();setTimeout(()=>{if(newProg&&newProg.arm){newProg.arm=false;render()}},4000);return} startProgram();return}
  if(a==='go'){sel=b.dataset.date;openWarm.clear();openPx.clear();render();return}
  if(a==='open'){sel=b.dataset.date;view='today';render();window.scrollTo(0,0);return}
  if(a==='bwrange'){LS.set('ob.bwRange',b.dataset.v);render();return}
  if(a==='view'){view=b.dataset.view;render();window.scrollTo(0,0);return}
  if(a==='ci'){const f=b.dataset.f,raw=b.dataset.v,v=/^\d+(\.\d+)?$/.test(raw)?+raw:raw;setLog(sel,'checkin.'+f,ci(sel)[f]==v?null:v);render();return}
  if(a==='wu'||a==='wurm'||a==='wuadd'){
    const k=b.dataset.lift,i=+b.dataset.i,W=wuList(k).map(x=>x?Object.assign({},x):{});
    if(a==='wuadd') W.push({});
    else if(a==='wurm') W.splice(i,1);
    else {
      const x=W[i]||(W[i]={}); x.done=!x.done;
      // logging a set as suggested stores the suggested numbers, so history shows real weights
      if(x.done){const ins=b.parentNode.querySelectorAll('input');if(x.w==null||x.w==='')x.w=ins[0].placeholder!==u()&&ins[0].placeholder!==''?+ins[0].placeholder:null;if(x.r==null||x.r==='')x.r=ins[1].placeholder!=='reps'?+ins[1].placeholder:null}
    }
    for(let j=0;j<W.length;j++) if(!W[j]) W[j]={};
    openWarm.add(k); setLog(sel,'lifts.'+k+'.warmup',W); render(); return}
  if(a==='eff'){ setEffort(sel,b.dataset.lift,+b.dataset.i,b.dataset.v); render(); return }
  if(a==='set'){const k=b.dataset.lift,i=+b.dataset.i;const L=lg(sel);const arr=((L.lifts||{})[k]||{}).sets?[...L.lifts[k].sets]:[];
    offerUndo((arr[i]?'Set unticked':'Set ticked')+' · '+liftName(k),snapLog(sel));
    arr[i]=!arr[i];for(let j=0;j<arr.length;j++)if(arr[j]==null)arr[j]=false;setLog(sel,'lifts.'+k+'.sets',arr);
    if(arr[i]){popKey=k+':'+i;setTimeout(()=>{popKey=null},400)}
    if(arr[i]&&sel===todayStr()){unlockAudio();const nx=nextAfterSet(k,arr);if(nx!==undefined)startRest(k,nx);else stopRest()}
    render();return}
  if(a==='addset'||a==='rmset'){
    const k=b.dataset.lift, snap=snapLog(sel);
    if(addSet(k,a==='addset'?1:-1)){ offerUndo((a==='addset'?'Set added · ':'Set removed · ')+liftName(k),snap); render() }
    return}
  if(a==='reload'){ location.reload(); return }
  if(a==='noteseen'){ setLog(sel,'noteSeen',true); render(); return }
  if(a==='aim'){ pickAim(sel,b.dataset.id); render(); return }
  if(a==='aimrate'){ rateAim(sel,b.dataset.id,b.dataset.v); render(); return }
  if(a==='errclear'){ crashClear(); return }
  if(a==='syncclear'){ clearConflicts(); return }
  if(a==='adminrefresh'){ admin.msg=null; adminLoad(true); adminLoadLog(true); return }
  if(a==='adminlog'){ adminLoadLog(true); return }
  if(a==='adminclear'){ admin.confirm=b.dataset.user; admin.rsFor=null; admin.typed=''; admin.err=null; admin.msg=null; render(); return }
  if(a==='adminclearoff'){ admin.confirm=null; admin.typed=''; render(); return }
  if(a==='adminwipe'){ adminWipe(b.dataset.user); return }
  if(a==='adminbk'){ if(admin.bkFor===b.dataset.user){admin.bkFor=null;admin.bk=null;render()} else adminBackups(b.dataset.user); return }
  if(a==='adminrs'){ admin.rsFor=b.dataset.user+'|'+b.dataset.name; admin.confirm=null; admin.typed=''; admin.err=null; admin.msg=null; render(); return }
  if(a==='adminrsoff'){ admin.rsFor=null; admin.typed=''; render(); return }
  if(a==='adminrsgo'){ adminRestore(b.dataset.user,b.dataset.name); return }
  if(a==='cathide'){ catSave({id:b.dataset.id,slot:b.dataset.slot,name:b.dataset.name,gear:b.dataset.gear,hidden:b.dataset.on==='1'}); return }
  if(a==='catrm'){ catRemove(b.dataset.id); return }
  if(a==='catadd'){
    const name=(catNew.name||'').trim(); if(!name) return;
    catSave({slot:catNew.slot,name,gear:(catNew.gear||'').trim()});
    catNew={name:'',slot:catNew.slot,gear:''};
    return }
  if(a==='accadd'||a==='accrm'){
    const sl=b.dataset.slot, cur=accSets(sel,sl).slice();
    if(a==='accadd') cur.push({}); else cur.splice(+b.dataset.i,1);
    setLog(sel,'acc.sets.'+sl,cur);
    // Logging a set is itself the record that it happened; drop the manual tick.
    if(cur.length) setLog(sel,'acc.done.'+sl,null);
    render();return}
  if(a==='acclater'){ accLater=b.dataset.v==='1'; render(); return }
  if(a==='accslotrm'){
    const d=b.dataset.day, cur=accSlots(d).filter(x=>x!==b.dataset.slot);
    mutatePlan(p=>{p.accSlots=Object.assign({},p.accSlots||{},{[d]:cur})});
    return}
  if(a==='accmineAdd'){
    const name=(accNew.name||'').trim(); if(!name) return;
    const id='mine-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)+'-'+Math.random().toString(36).slice(2,6);
    mutatePlan(p=>{p.accCustom=[...(Array.isArray(p.accCustom)?p.accCustom:[]),{id,slot:accNew.slot,name,gear:(accNew.gear||'').trim()}]});
    accNew={name:'',slot:accNew.slot,gear:''}; render();
    return}
  if(a==='accmineRm'){
    const id=b.dataset.id;
    mutatePlan(p=>{p.accCustom=(Array.isArray(p.accCustom)?p.accCustom:[]).filter(x=>x&&x.id!==id)});
    return}
  if(a==='warmroutine'){
    // Ticks are an index into the routine's own list, so they do not survive a swap.
    if(b.dataset.v!==warmKey()) setLog(sel,'warmup',null);
    mutatePlan(p=>{p.warmRoutine=b.dataset.v});
    return}
  if(a==='suppadd'){
    const name=(suppNew.name||'').trim(); if(!name) return;
    const id='mine-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)+'-'+Math.random().toString(36).slice(2,6);
    const when=suppNew.when==='pre'?'pre':'daily';
    // Added means taken: nobody types a supplement in to leave it unticked.
    mutatePlan(p=>{p.suppCustom=[...(Array.isArray(p.suppCustom)?p.suppCustom:[]),{id,name,when}];p.supps=Object.assign({},p.supps||{},{[id]:true})});
    suppNew={name:'',when}; render();
    return}
  if(a==='supprm'){
    const id=b.dataset.id;
    // The days you already logged it on keep it; this only stops it being offered.
    mutatePlan(p=>{p.suppCustom=(Array.isArray(p.suppCustom)?p.suppCustom:[]).filter(x=>x&&x.id!==id);if(p.supps)delete p.supps[id]});
    return}
  if(a==='accskip'){ setLog(sel,'acc.skip',accSkipped(sel)?null:true); render(); return }
  if(a==='accdone'){
    const sl=b.dataset.slot;
    setLog(sel,'acc.done.'+sl,accDone(sel,sl)?null:true);
    render();return}
  if(a==='errcopy'){ copyOut(b,crashReport(),'Copy all details'); return }
  if(a==='calon'||a==='caloff'||a==='calrotate'){ calSet(a==='calon'?'on':a==='caloff'?'off':'rotate'); return }
  if(a==='calcopy'){
    const el=document.getElementById('cal-url'); if(!el) return;
    el.select(); copyOut(b,el.value,'Copy address'); return}
  if(a==='rvsel'){reviewSel[b.dataset.lift]=b.dataset.v;render();return}
  if(a==='rvapply'||a==='rvdismiss'){
    const c=+b.dataset.c;
    if(a==='rvapply'){
      const {stats,readiness:rdAvg}=cycleStats(c), mx=maxFor(c), chosen={};
      offerUndo('Cycle review applied',snapPlan());
      for(const k of activeLifts()){ if(!mx[k]) continue; const ch=reviewSel[k]||((((plan.cycleMaxes||{})[c+1]||{})[k]!=null)?'keep':recommend(stats[k],rdAvg)[0]); if(ch!=='keep') chosen[k]=reviewOptions(k,mx[k].v)[ch]; }
      mutatePlan(p=>{p.cycleMaxes[c+1]=Object.assign({},p.cycleMaxes[c+1]||{},chosen);p.reviews=Object.assign({},p.reviews||{},{[c]:{at:todayStr(),set:chosen}})});
    } else mutatePlan(p=>{p.reviews=Object.assign({},p.reviews||{},{[c]:{at:todayStr(),dismissed:true}})});
    reviewSel={}; return}
  if(a==='updcheck'){checkUpdate(true);return}
  if(a==='updnow'){applyUpdate();return}
  if(a==='alerton'){enableAlerts();return}
  if(a==='alertoff'){disableAlerts();return}
  if(a==='alerttest'){testAlert();return}
  if(a==='pushcheck'){checkAlerts();return}
  if(a==='pushcopy'){ copyOut(b,pushReport(),'Copy for a bug report'); return }
  if(a==='copydismiss'){ copyFallback=null; render(); return }
  if(a==='voicetest'){unlockAudio();setTimeout(()=>say('Rest over. Next: squat, set two.'),120);return}
  if(a==='soundmode'){setSoundMode(b.dataset.v);return}
  if(a==='bandadd'){ if(bandAdd(bandNew.n,bandNew.w)){bandNew={n:'',w:''};render()} return }
  if(a==='bandrm'){ bandRemove(b.dataset.n); return }
  if(a==='bandseed'){ bandSeed(b.dataset.v); return }
  if(a==='beeptest'){unlockAudio();beepTest();return}
  if(a==='tlogcopy'){ copyOut(b,tlogReport(),'Copy the timer log'); return }
  if(a==='beepcopy'){ copyOut(b,beepReport(),'Copy for a bug report'); return }
  if(a==='restore'){const nm=b.dataset.name;if(restoreState.arm!==nm){restoreState.arm=nm;restoreState.msg=null;render();setTimeout(()=>{if(restoreState.arm===nm){restoreState.arm=null;render()}},4000);return}doRestore('/backups/'+encodeURIComponent(nm)+'/restore');return}
  if(a==='restorefile'){if(restoreState.file) doRestore('/restore',restoreState.file.data);return}
  if(a==='restorecancel'){restoreState.file=null;render();return}
  if(a==='backupnow'){backups.busy=true;render();api('POST','/backups').then(()=>{backups.busy=false;backups.list=null;loadBackups()}).catch(()=>{backups.busy=false;backups.err='Backup failed. Check your connection and try again.';render()});return}
  if(a==='lsstart'){lsStart();return}
  if(a==='wzset'){wzSet(b.dataset.k,b.dataset.v);render();return}
  if(a==='wzplyoday'){
    const v=+b.dataset.v; if(!(v>=0&&v<=6)||!wz) return;
    const next=plyoPick(wz.plyoPer===2?[wz.plyoDow,wz.plyoDow2]:[wz.plyoDow],wz.plyoPer,v);
    wz.plyoDow=next[0]; if(wz.plyoPer===2&&next[1]!=null) wz.plyoDow2=next[1];
    render(); return}
  if(a==='wzl3'){const k=b.dataset.v;wz.l3[k]=!wz.l3[k];if(!L3K.some(x=>wz.l3[x]))wz.l3.pull=true;render();return}
  if(a==='wznext'){wz.step=Math.min(WZ_STEPS.length-1,wz.step+1);render();window.scrollTo(0,0);return}
  if(a==='wzback'){wz.step=Math.max(0,wz.step-1);render();return}
  if(a==='wzdone'){wzFinish();return}
  if(a==='wzcancel'){wz=null;render();return}
  if(a==='wzskip'){mutatePlan(p=>{p.onboarded=true;if(!st0Saved())p.startMonday=nextMonday()});wz=null;render();return}
  if(a==='wzrerun'){wz=wzNew(true);render();window.scrollTo(0,0);return}
  if(a==='ivopt'){if(ivOpts(sel,effFmt(sel))[b.dataset.k]===+b.dataset.v)return;setLog(sel,'hic.iv.'+b.dataset.k,+b.dataset.v);render();return}
  if(a==='ivstart'){ivStart(b.dataset.f);render();return}
  if(a==='mod'){if(modOf(sel)===b.dataset.v)return;setLog(sel,'hic.mod',b.dataset.v);render();return}
  // choices that are already selected save nothing (no empty log entries)
  if(a==='mlib'){const k=b.dataset.k;openPx.has(k)?openPx.delete(k):openPx.add(k);render();return}
  // 0 clears the adjustment; anything else steps it, which is how the book's +500
  // compounds if the scale still will not move a month later.
  if(a==='macrobump'){const d=+b.dataset.v;mutatePlan(p=>{p.macroBump=d===0?0:(+p.macroBump||0)+d});render();return}
  if(a==='coachask'){coachAsk();return}
  if(a==='macrowin'){setMacroWin(b.dataset.v);render();return}
  if(a==='macrowhy'){setMacroWhy(!macroWhy);render();return}
  if(a==='restwarn'){setPlan('restWarn',+b.dataset.v);render();return}
  if(a==='coachnew'){coachNew();return}
  if(a==='debriefseen'){debriefSeen();return}
  if(a==='minplan'){setLog(sel,'hic.min',+b.dataset.v);render();return}
  if(a==='boutplan'){setLog(sel,'hic.rounds',+b.dataset.v);render();return}
  if(a==='varadd'){
    const k=b.dataset.k, nm=(document.getElementById('cv-name-'+k)||{}).value, pct=+(document.getElementById('cv-pct-'+k)||{}).value;
    const name=(nm||'').trim();
    cvErr[k]=!name?'Give it a name.':!(pct>=25&&pct<=150)?'The percentage should be between 25 and 150.':
      Object.values(varsOf(k)).some(x=>x.name.toLowerCase()===name.toLowerCase())?'There is already a variant with that name.':'';
    if(!cvErr[k]){
      const id='c'+Date.now().toString(36);
      mutatePlan(p=>{p.customVar=Object.assign({},p.customVar||{});p.customVar[k]=[...(p.customVar[k]||[]),{id,name,short:name.length>12?name.slice(0,11)+'\u2026':name,r:pct/100}]});
      const el=document.getElementById('cv-name-'+k); if(el) el.value='';
      const el2=document.getElementById('cv-pct-'+k); if(el2) el2.value='';
    }
    render(); return;
  }
  if(a==='vardel'){
    const k=b.dataset.k, i=+b.dataset.i, gone=(((plan.customVar||{})[k])||[])[i];
    if(!gone) return;
    offerUndo('Removed '+gone.name,snapPlan());
    mutatePlan(p=>{
      p.customVar=Object.assign({},p.customVar||{});
      p.customVar[k]=(p.customVar[k]||[]).filter((_,j)=>j!==i);
      if((p.liftVar||{})[k]===gone.id) p.liftVar=Object.assign({},p.liftVar,{[k]:null});
      for(const c of Object.keys(p.cycleVar||{})) if((p.cycleVar[c]||{})[k]===gone.id) p.cycleVar[c]=Object.assign({},p.cycleVar[c],{[k]:null});
    });
    return;
  }
  if(a==='varswap'){const k=b.dataset.k,v=b.dataset.v;if(v===varOf(k,sel))return;const cur=(lg(sel).var)||{};setLog(sel,'var',Object.assign({},cur,{[k]:v===varDefault(k)?null:v}));openWarm.clear();render();return}
  if(a==='l3swap'){const v=b.dataset.v;if(v===l3For(sel))return;setLog(sel,'l3',v===l3Auto(sel)?null:v);openWarm.clear();render();return}
  if(a==='planmode'){planMode=b.dataset.v;try{localStorage.setItem('ob.planmode',planMode)}catch(e){}render();window.scrollTo(0,0);return}
  if(a==='calcancel'){calCancel();return}
  if(a==='calpick'){ calTarget(b.dataset.date); return }
  // Which of the three a drop meant. Chosen after the drop rather than before, so the
  // reasons the other two are unavailable are visible at the moment of deciding.
  if(a==='calm'){const v=+b.dataset.v;if(!v)calMonth=realToday().slice(0,7);else{const y=+calMonth.slice(0,4),m=+calMonth.slice(5,7)+v;calMonth=S(Date.UTC(y,m-1,1)).slice(0,7)}render();return}
  if(a==='move'){moveOpen=!moveOpen;render();return}
  if(a==='movex'){moveOpen=false;render();return}
  if(a==='moveto'){
    offerUndo('Session moved',snapPlan());
    moveSession(b.dataset.mon,+b.dataset.sl,b.dataset.to);
    moveOpen=false; openWarm.clear(); openPx.clear(); render(); return;
  }
  if(a==='moveback'){
    offerUndo('Session put back',snapPlan());
    moveSession(b.dataset.mon,+b.dataset.sl,addDays(b.dataset.mon,+b.dataset.sl));
    moveOpen=false; render(); return;
  }
  if(a==='ordreset'){const mon=mondayOf(sel);offerUndo('Week put back',snapPlan());resetWeekPlacement(mon);moveOpen=false;render();return}
  if(a==='guide'){gdStart(b.dataset.k);return}
  if(a==='theme'){LS.set('ob.theme',b.dataset.v);applyTheme();render();return}
  if(a==='gym'){LS.set('ob.gym',!gymOn());applyTheme();render();return}
  if(a==='weekseen'){mutatePlan(p=>{p.weekSeen=mondayOf(todayStr())});return}
  if(a==='hold'){startHold(b.dataset.n,+b.dataset.s,+b.dataset.sides||1,1);render();return}
  if(a==='wshort'){const v=b.dataset.v==='1';if(!!lg(sel).warmShort===v)return;setLog(sel,'warmShort',v);render();return}
  if(a==='wclear'){offerUndo('Warm-up cleared',snapLog(sel));setLog(sel,'warmup',[]);render();return}
  if(a==='mclear'){offerUndo('Mobility cleared',snapLog(sel));setLog(sel,'mobility',[]);render();return}
  if(a==='pwu'){const i=+b.dataset.i,arr=[...((lg(sel).plyo||{}).warm||[])];arr[i]=!arr[i];for(let j=0;j<arr.length;j++)if(arr[j]==null)arr[j]=false;setLog(sel,'plyo.warm',arr);render();return}
  if(a==='plyoupper'){mutatePlan(p=>{p.plyoUpper=!p.plyoUpper});return}
  if(a==='plyoday'){setPlyoDay(mondayOf(sel),b.dataset.d);return}
  if(a==='addon'){ addonAdd(sel,b.dataset.kind); render(); return }
  if(a==='addondel'){ offerUndo('Session removed',snapLog(sel)); addonDel(sel,+b.dataset.i); render(); return }
  if(a==='addonsetadd'){ addonSetAdd(sel,+b.dataset.i); render(); return }
  if(a==='addonsetdel'){ addonSetDel(sel,+b.dataset.i,+b.dataset.j); render(); return }
  if(a==='plyodow'){
    const v=+b.dataset.v; if(!(v>=0&&v<=6)) return;
    const per=plyoPerWeek(), next=plyoPick(per===2?[plyoDowDefault(),plyoDow2()]:[plyoDowDefault()],per,v);
    mutatePlan(p=>{p.plyoDow=next[0]; if(per===2) p.plyoDow2=next[1]!=null?next[1]:next[0]});
    return}
  if(a==='plyoper'){const v=+b.dataset.v===2?2:1; mutatePlan(p=>{p.plyoPerWeek=v}); return}
  if(a==='plyoon'){mutatePlan(p=>{p.plyoOn=true}); return}
  if(a==='half'){setHalf(b.dataset.k,b.dataset.v);return}
  if(a==='upset'){
    const i=+b.dataset.i,j=+b.dataset.j, L=(lg(sel).plyo||{}).up||{}, arr=[...((L[i])||[])];
    arr[j]=!arr[j]; for(let x=0;x<arr.length;x++) if(arr[x]==null) arr[x]=false;
    offerUndo('Throw set '+(arr[j]?'ticked':'unticked'),snapLog(sel));
    setLog(sel,'plyo.up.'+i,arr);
    if(arr[j]&&sel===todayStr()){const wk=weekOf(sel),e=plyoUpperEx(plyoUpperPhase(wk))[i];unlockAudio();startRest(null,null,e.rest,'Rest · '+e.label)}
    render();return}
  if(a==='pset'){
    const i=+b.dataset.i,j=+b.dataset.j, wk=weekOf(sel), dp=dayPlan(sel), ph=plyoPhase(wk), L=lg(sel).plyo||{}, cut=!!(dp.plyoCut||L.cut);
    const arr=[...(((L.sets||[])[i])||[])]; arr[j]=!arr[j]; for(let x=0;x<arr.length;x++) if(arr[x]==null) arr[x]=false;
    setLog(sel,'plyo.sets.'+i,arr);
    if(arr[j]&&sel===todayStr()){
      unlockAudio(); const e=ph.ex[i]; let next=null;
      const firstOpen=a=>{for(let x=0;x<plyoSets(ph.ex[a],cut);x++) if(!(((lg(sel).plyo||{}).sets||[])[a]||[])[x]) return x; return -1};
      const fo=firstOpen(i); if(fo>=0) next=e.label+' · set '+(fo+1);
      else for(let a2=i+1;a2<ph.ex.length;a2++){const f2=firstOpen(a2);if(f2>=0){next=ph.ex[a2].label+' · set '+(f2+1);break}}
      if(next) startRest(null,next,e.rest,'Rest · '+e.label);
      else startRest(null,'HIC: '+HIC[effFmt(sel)].name,600,'Rest before HIC');
    }
    render();return}
  if(a==='warmrest'){const k=b.dataset.lift,v=+b.dataset.v;if(warmRestSecs(k)===v)return;mutatePlan(p=>{p.warmRest=Object.assign({},p.warmRest,{[k]:v})});
    if(rest&&rest.ramp&&rest.k===k&&!rest.done){const el=Date.now()-(rest.end-rest.dur*1000);rest.dur=v;rest.end=Date.now()-el+rest.dur*1000;LS.set('ob.rest',rest);tickRest();syncPush()}
    return}
  if(a==='sfeel'){const v=b.dataset.v;setLog(sel,'feel',lg(sel).feel===v?null:v);render();return}
  if(a==='spain'){const v=b.dataset.v,same=lg(sel).pain===v;setLog(sel,'pain',same?null:v);if(!same&&v==='none')setLog(sel,'painAt',[]);render();return}
  if(a==='spainat'){const k=b.dataset.v,cur=painAt(lg(sel));setLog(sel,'painAt',cur.includes(k)?cur.filter(x=>x!==k):[...cur,k]);render();return}
  if(a==='bbadd'){
    const mon=b.dataset.monday, ver=b.dataset.ver==='strength'?'strength':'standard';
    if(mon<mondayOf(realToday())) return;
    offerUndo('Base Building added · 8 weeks from '+fmtD(mon),snapPlan());
    mutatePlan(p=>{p.inserts=Object.assign({},p.inserts,{[mon]:'bb'});p.bbVer=Object.assign({},p.bbVer,{[mon]:ver})});
    return}
  if(a==='bbremove'){
    // find the block's first week, then drop the insert that starts it
    const list=weeks(), i=list.findIndex(w=>w.monday===b.dataset.monday);
    let s=i; while(s>0&&list[s-1].kind==='bb'&&list[s].w>1) s--;
    const mon=list[s].monday;
    offerUndo('Base Building removed',snapPlan());
    mutatePlan(p=>{const ins=Object.assign({},p.inserts),v=Object.assign({},p.bbVer);delete ins[mon];delete v[mon];p.inserts=ins;p.bbVer=v});
    return}
  if(a==='sedef'){const v=b.dataset.v;mutatePlan(p=>{p.se=Object.assign({},p.se,{cluster:v})});return}
  if(a==='secl'){const v=b.dataset.v;if(seCluster(sel)===v&&!seEdited(sel))return;seEdit=null;setLog(sel,'se.cluster',v);setLog(sel,'se.ex',null);render();return}
  if(a==='serest'){const v=+b.dataset.v;if(seRestSecs()===v)return;mutatePlan(p=>{p.se=Object.assign({},p.se,{rest:v})});return}
  if(a==='seedit'){const i=+b.dataset.i;seEdit=seEdit===i?null:i;render();return}
  if(a==='seput'||a==='serm'||a==='seadd'){
    const i=+b.dataset.i, ex=seDayList(sel).slice(), done=seDone(sel).map(r=>Array.isArray(r)?r.slice():[]);
    if(a==='seput') ex[i]=b.dataset.v;
    else if(a==='serm'){ ex.splice(i,1); done.splice(i,1); seEdit=null; }
    else { ex.push('New exercise'); seEdit=ex.length-1; }
    setLog(sel,'se.ex',ex); setLog(sel,'se.done',done);
    if(a==='seput') seEdit=null;
    render();return}
  if(a==='sereset'){seEdit=null;setLog(sel,'se.ex',null);render();return}
  if(a==='setick'){
    const i=+b.dataset.i,j=+b.dataset.j,dp=dayPlan(sel),ex=seList(seCluster(sel));
    const done=seDone(sel).map(r=>Array.isArray(r)?r.slice():[]);
    while(done.length<ex.length) done.push([]);
    const row=done[i]; while(row.length<dp.circuits) row.push(false);
    row[j]=!row[j]; setLog(sel,'se.done',done);
    if(row[j]&&sel===todayStr()){
      unlockAudio();
      const last=i===ex.length-1, nextName=last?ex[0]:ex[i+1];
      if(last&&j+1<dp.circuits) startRest(null,'Circuit '+(j+2)+' · '+nextName,120,'Rest · circuit done');
      else if(!last&&seRestSecs()) startRest(null,nextName,seRestSecs(),'Rest · '+ex[i]);
      else if(last) stopRest();
    }
    render();return}
  if(a==='restmin'){const k=b.dataset.lift,m=+b.dataset.v;if(restMins(k)===m)return;mutatePlan(p=>{p.rest=Object.assign({},p.rest,{[k]:m})});
    if(rest&&rest.k===k&&!rest.done){const el=Date.now()-(rest.end-rest.dur*1000);rest.dur=m*60;rest.end=Date.now()-el+rest.dur*1000;LS.set('ob.rest',rest);tickRest();syncPush()}
    return}
  if(a==='done'){offerUndo(lg(sel).done?'Session reopened':'Session marked done',snapLog(sel));setLog(sel,'done',!lg(sel).done);render();return}
  if(a==='lower'){const k=b.dataset.lift,c=b.dataset.c;const m=maxFor(+c)[k];if(!m)return;offerUndo('Lowered the '+liftName(k)+' max',snapPlan());mutatePlan(p=>{p.cycleMaxes[c]=p.cycleMaxes[c]||{};p.cycleMaxes[c][k]=floorTo(m.v*.95,p.round[k])});return}
  // The Ageless Athlete preset writes real settings rather than layering a hidden mode
  // over them, so every one of them stays visible and individually reversible.
  if(a==='ageless'){replan('Ageless Athlete settings applied',agelessPreset);return}
  if(a==='insert'){replan(({deload:'Deload',test:'Retest',bridge3:'Bridge',travel:'Travel'}[b.dataset.kind]||'Off')+' week added',p=>{p.inserts[b.dataset.monday]=b.dataset.kind});return}
  if(a==='uninsert'){replan('Week removed',p=>{delete p.inserts[b.dataset.monday]});return}
  if(a==='skip'){replan('Week skipped',p=>{p.skips[b.dataset.rule]=true});return}
  if(a==='unskip'){replan('Week restored',p=>{delete p.skips[b.dataset.rule]});return}
  if(a==='more'){planShow+=26;render();return}
  if(a==='applytest'){const wk=weekOf(b.dataset.monday),res=weekResults(wk,'test'),nc=wk.nextCycle;if(!nc)return;offerUndo('Results applied to Cycle '+nc,snapPlan());mutatePlan(p=>{p.cycleMaxes[nc]=Object.assign({},p.cycleMaxes[nc]||{},res)});return}
  if(a==='savemaxes'){const wk=weekOf(b.dataset.monday),res=weekResults(wk,'test');offerUndo('Maxes saved',snapPlan());mutatePlan(p=>{Object.assign(p.maxes,res)});return}
  if(a==='calc5'){mutatePlan(p=>{for(const k of LK) if(calc5[k]) p.maxes[k]=floorTo(calc5[k]/.87,p.round[k])});calc5={};return}
});

/* ---------------- dragging days in the calendar ----------------
   Pointer events, not the HTML5 drag API, which iOS Safari does not implement -- and
   this is a phone-first app, so the drag API would have shipped a feature that works
   only on the desktop nobody uses it from.

   A drag is only a second way to reach `calTarget`. Tapping still works and is the
   keyboard and screen-reader path; both end at the same three choices, so there is one
   set of rules rather than two. Nothing is written until a choice is made and applied.  */
const calDrag={id:null,from:null,x:0,y:0,on:false,el:null};
function calCell(x,y){
  const el=document.elementFromPoint&&document.elementFromPoint(x,y);
  return el&&el.closest?el.closest('.cal-d'):null;
}
function calDragEnd(){
  if(calDrag.el&&calDrag.el.remove) calDrag.el.remove();
  document.querySelectorAll&&document.querySelectorAll('.cal-d.over').forEach(e=>e.classList.remove('over'));
  const was=calDrag.on;
  calDrag.id=null; calDrag.from=null; calDrag.on=false; calDrag.el=null;
  document.body&&document.body.classList.remove('dragging');
  return was;
}
document.addEventListener('pointerdown',e=>{
  if(viewing||e.button) return;
  const c=e.target.closest&&e.target.closest('.cal-d');
  if(!c||c.disabled||!c.dataset.date) return;
  if(!calMove&&!dayPlans(c.dataset.date).length) return;   // nothing on that day to pick up
  calDrag.id=e.pointerId; calDrag.from=c.dataset.date; calDrag.x=e.clientX; calDrag.y=e.clientY; calDrag.on=false;
});
document.addEventListener('pointermove',e=>{
  if(calDrag.id!==e.pointerId||!calDrag.from) return;
  if(!calDrag.on){
    // A few pixels of slop, so a tap with a shaky thumb is still a tap.
    if(Math.abs(e.clientX-calDrag.x)+Math.abs(e.clientY-calDrag.y)<8) return;
    calDrag.on=true;
    document.body&&document.body.classList.add('dragging');
    const d=document.createElement('div');
    d.className='cal-ghost'; d.textContent=fmtD(calDrag.from,true);
    document.body&&document.body.appendChild(d); calDrag.el=d;
    // Picking the session up front means the drop only has to name the target.
    if(!calMove||calMove.from!==calDrag.from){ calMove=null; calTarget(calDrag.from) }
  }
  e.preventDefault();
  if(calDrag.el&&calDrag.el.style){ calDrag.el.style.left=e.clientX+'px'; calDrag.el.style.top=e.clientY+'px' }
  const over=calCell(e.clientX,e.clientY);
  document.querySelectorAll&&document.querySelectorAll('.cal-d.over').forEach(x=>x.classList.remove('over'));
  if(over&&over.dataset.date!==calDrag.from&&idxOf(over.dataset.date)>=0) over.classList.add('over');
},{passive:false});
document.addEventListener('pointerup',e=>{
  if(calDrag.id!==e.pointerId) return;
  const from=calDrag.from, cell=calDrag.on?calCell(e.clientX,e.clientY):null;
  if(!calDragEnd()) return;                       // never moved: let the click handler have it
  if(cell&&cell.dataset.date&&cell.dataset.date!==from) calTarget(cell.dataset.date);
  else { calMove=null; render() }
});
document.addEventListener('pointercancel',()=>{ if(calDragEnd()){ calMove=null; render() } });


applyTheme();
loadLocal();
render();
if(rest) showRest();
if(gt && Date.now() - (gt.mode === 'down' ? gt.end : gt.start) > GT_STALE_MS){ gt = null; LS.set('ob.gt', null) }
if(gt) gtShow();
if(iv&&Date.now()-iv.start>3*3600*1000){iv=null;LS.set('ob.iv',null)}
if(iv) ivShow();
if(ls&&ls.date!==realToday()){ls=null;LS.set('ob.ls',null)}
if(ls) lsShow();
if(guide&&guide.date!==realToday()){guide=null;LS.set('ob.guide',null)}
if(guide) gdShow();
connect();
calLoad();
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
setTimeout(()=>checkUpdate(false),2000);
})();
