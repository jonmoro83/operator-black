/* ---------------- programme templates ----------------
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
};

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
};

function stemplOf(){ return STEMPL[plan.stempl]||STEMPL.operator }
function stemplKey(){ return STEMPL[plan.stempl]?plan.stempl:'operator' }
function cprotoOf(){ return CPROTO[plan.cproto]||CPROTO.black }
function cprotoKey(){ return CPROTO[plan.cproto]?plan.cproto:'black' }
// The wave belongs to the template: Fighter's is a three-week block run twice, not
// Operator's six. Yours, once you have edited it, lives under plan.waves by template,
// so switching templates does not carry one programme's numbers into another.
function waveOf(tpl){
  const k=tpl&&STEMPL[tpl]?tpl:stemplKey();
  const w=(plan.waves||{})[k];
  return Array.isArray(w)&&w.length?w:STEMPL[k].wave;
}
// How long a cycle runs. Derived, so a template with a three- or nine-week wave works.
function cycleWeeks(){ return Math.max(1,waveOf().length) }

/* Lay out a week: the lifting days where the template's table puts them, then the
   conditioning sessions spread through what is left.

   The books number the lifting days — Operator trains on days 1, 3 and 5, Fighter on 1
   and 4 — so that is data on the template rather than something to infer. Two days of
   the same kind must not touch (see ADJACENT_BAN), so conditioning takes free slots
   greedily, skipping any that would sit next to one already taken, and falling back to
   filling in order when there are more sessions than the week can keep apart.

   Operator and Black come out as S C S C S C R, the week this app has always drawn. */
function weekShape(slots,nC){
  const out=new Array(7).fill('R');
  const S=(Array.isArray(slots)?slots:[]).filter(v=>v>=0&&v<7);
  for(const i of S) out[i]='S';
  const free=[]; for(let i=0;i<7;i++) if(out[i]==='R') free.push(i);
  const take=[];
  for(const i of free){
    if(take.length>=nC) break;
    if(take.length&&i-take[take.length-1]===1) continue;   // would touch the last one
    take.push(i);
  }
  for(const i of free){ if(take.length>=nC) break; if(!take.includes(i)) take.push(i) }
  for(const i of take) out[i]='C';
  return out;
}

// One slot of a composed week. `wk` carries the week number, `date` resolves Lift 3.
function composeSlot(date,wk,d){
  // A week frozen in the past carries the template it was trained under, so changing
  // programme now does not rewrite what you already did into something else.
  const T=STEMPL[wk.tpl]||stemplOf(), P=CPROTO[wk.cpr]||cprotoOf();
  const sd=T.days, cs=(typeof P.sessions==='function'?P.sessions(wk):P.sessions)||[];
  const shape=weekShape(T.slots||sd.map((_,i)=>i*2),cs.length);
  let si=0, ci=0;
  for(let i=0;i<7;i++){
    const role=shape[i];
    if(i===d){
      if(role==='S'){
        const x=sd[si];
        return {t:'lift',day:si+1,lifts:(LIFTSET[x.lifts]||LIFTSET.SBD)(date),acc:x.acc,short:x.short};
      }
      if(role==='C'){
        const x=cs[ci];
        return Object.assign({short:'HIC'},x,{t:x.t||'hic'});
      }
      return {t:'off',short:'Off'};
    }
    if(role==='S') si++; else if(role==='C') ci++;
  }
  return {t:'off',short:'Off'};
}
