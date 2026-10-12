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
    name:'Operator', book:'TB1', blurb:'Three full-body days a week, the same three lifts, never near failure. The default, and what Black is built around.',
    days:[
      {lifts:'SBP',acc:'mon',short:'Op 1'},
      {lifts:'SBP',acc:'wed',short:'Op 2'},
      {lifts:'SBD',acc:'fri',short:'Op 3'},
    ],
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
function cprotoOf(){ return CPROTO[plan.cproto]||CPROTO.black }

/* Lay out a week of nS strength days and nC conditioning days across seven.

   Two days of the same kind must not touch (see ADJACENT_BAN), so the two sets interleave,
   starting with whichever there are more of. Whatever is left over is rest. For Operator
   and Black that is three and three, giving S C S C S C R — the week this app has always
   drawn, now derived rather than typed out. */
function weekShape(nS,nC){
  const out=[]; let s=nS, c=nC, r=Math.max(0,7-nS-nC), last=null;
  while(out.length<7&&(s>0||c>0)){
    const canS=s>0&&last!=='S', canC=c>0&&last!=='C';
    let pick;
    if(canS&&canC) pick=s>=c?'S':'C';            // alternate, leading with the bigger pile
    else if(canS) pick='S';
    else if(canC) pick='C';
    else if(r>0){ out.push('R'); r--; last='R'; continue }   // spend a rest as a spacer
    else pick=s>0?'S':'C';   // nothing left to separate them with; orderIssues will say so
    out.push(pick); last=pick;
    if(pick==='S') s--; else c--;
  }
  while(out.length<7) out.push('R');
  return out;
}

// One slot of a composed week. `wk` carries the week number, `date` resolves Lift 3.
function composeSlot(date,wk,d){
  const T=stemplOf(), P=cprotoOf();
  const sd=T.days, cs=(typeof P.sessions==='function'?P.sessions(wk):P.sessions)||[];
  const shape=weekShape(sd.length,cs.length);
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
