/* ---------------- the OMS rotation ----------------
Tactical Barbell III, Block Programming: "OMS is a simple but powerful long-term
continuation protocol for strength and mass ... If there was a standard perpetual TB
model for strength and hypertrophy -- this would be it." The book's table is three
boxes: Operator template x 3-6 weeks, Mass template x 3-6 weeks, Specificity x 3-6
weeks, "simply keep repeating the above", ratios adjustable. A variation rotates only
Operator and Mass and adds Specificity as needed. Zulu may stand in for Operator and
another general mass template for Mass.

It is off unless you switch it on (Setup -> Programs), which was asked for in those
words. On, nothing about the engine changes: the app still runs one template per
program, and **each block is its own program**. Setup holds the rotation; in a block's
last week Today offers the next one, and one tap archives the block and starts the
next with the maxes carried. That choice (2026-11-12, over one endless program whose
weeks change template) reuses Programs exactly as built, so History, Status and the
CSV already split by block.

`plan.oms`: `on`; `blocks`, always three, in the book's order (the third can be switched
out of the rotation); `i`, which block the current program is, or -1 when it is not
one of them; `end`, the Sunday the current block ends; `snooze`, the Monday of a week
in which "Not yet" was tapped. It travels with the settings from program to program.

The book's other advice is said, not automated: bridge or deload occasionally, run
Base Building once or twice a year before a rotation, and keep the same core lifts all
the way through. */
const OMS_ROLES=[
  {key:'O',name:'Operator',what:'maximal strength',opts:['operator','zulu'],w:6},
  {key:'M',name:'Mass',what:'general hypertrophy',opts:MASS_TEMPLATES,w:6},
  {key:'S',name:'Specificity',what:'targeted work',opts:['specalpha','specbravo'],w:3,optional:true},
];
const OMS_WEEKS=[3,4,5,6];
// The stored rotation, read defensively: three blocks, a template the role allows, 3 to 6 weeks.
function omsBlocks(p){
  const o=(p||plan).oms||{}, bs=Array.isArray(o.blocks)?o.blocks:[];
  return OMS_ROLES.map((R,j)=>{ const b=bs[j]||{}, w=+b.w;
    return {j,role:R,t:R.opts.includes(b.t)?b.t:R.opts[0],w:OMS_WEEKS.includes(w)?w:R.w,on:!R.optional||b.on!==false} });
}
function omsState(p){
  const o=(p||plan).oms||{};
  return {on:!!o.on,i:Number.isInteger(o.i)&&o.i>=0&&o.i<3?o.i:-1,end:o.end?addDays(mondayOf(o.end),6):null,snooze:o.snooze||null};
}
// The block after the current one, skipping Specificity when it is switched out.
function omsNext(p){
  const bs=omsBlocks(p), i=omsState(p).i;
  for(let s=1;s<=3;s++){ const b=bs[(i+s+3)%3]; if(b.on) return b }
  return bs[0];
}
// Where a plan stands in the rotation by its own template, and when its block ends.
function omsRebase(p){
  if(!p.oms||!p.oms.on) return;
  const b=omsBlocks(p).find(x=>x.on&&x.t===(STEMPL[p.stempl]?p.stempl:'operator'));
  const thisSun=addDays(mondayOf(realToday()),6), natural=b?addDays(p.startMonday,b.w*7-1):null;
  p.oms.i=b?b.j:-1; p.oms.end=natural&&natural>=thisSun?natural:thisSun; p.oms.snooze=null;
}
function omsSet(on){
  mutatePlan(p=>{ p.oms=Object.assign(clone(DEF.oms),p.oms||{}); p.oms.on=!!on; if(on) omsRebase(p) });
}
function omsSetup(){
  const o=omsState(), bs=omsBlocks();
  let h=`<div class="stack" style="gap:10px;border-top:1px solid var(--line);padding-top:12px">
  <div class="lift-h"><h3>OMS rotation</h3><div class="seg"><button class="segb${!o.on?' on':''}" data-act="omsset" data-v="0" aria-pressed="${!o.on}">Off</button><button class="segb${o.on?' on':''}" data-act="omsset" data-v="1" aria-pressed="${o.on}">On</button></div></div>
  <p class="note" style="margin:0">Tactical Barbell III\u2019s long-term model for strength and size: a block of Operator, a block of Mass, a block of Specificity, three to six weeks each, repeated. Each block runs as its own program here. In a block\u2019s last week, Today offers the next one.</p>`;
  if(!o.on) return h+`</div>`;
  for(const b of bs){
    h+=`<div class="grid2"><label class="f">${b.j+1}. ${esc(b.role.name)} <span class="small muted">${esc(b.role.what)}</span><select id="p-oms-t${b.j}" data-pbind="oms.blocks.${b.j}.t">${b.role.opts.map(k=>`<option value="${k}"${k===b.t?' selected':''}>${esc(STEMPL[k].name)}</option>`).join('')}</select></label>
    <label class="f">Weeks<select id="p-oms-w${b.j}" data-pbind="oms.blocks.${b.j}.w">${OMS_WEEKS.map(w=>`<option value="${w}"${w===b.w?' selected':''}>${w}</option>`).join('')}</select></label></div>`;
    if(b.role.optional) h+=`<label class="check"><input type="checkbox" id="p-oms-s" data-pbind="oms.blocks.${b.j}.on" ${b.on?'checked':''}> Include Specificity in the rotation <span class="small muted">(off rotates Operator and Mass only, the book\u2019s variation)</span></label>`;
  }
  const nx=omsNext();
  h+=`<label class="f">This block ends (week of)<input type="date" id="p-oms-end" data-pbind="oms.end" value="${esc(o.end||'')}"></label>
  <div class="note">${o.i>=0?`Now: <b>${esc(STEMPL[bs[o.i].t].name)}</b>, block ${o.i+1} of the rotation.`:`Your current program (${esc(stemplOf().name)}) is not one of the rotation\u2019s blocks, so the rotation begins when it ends.`} Next: <b>${esc(STEMPL[nx.t].name)}</b>, ${nx.w} weeks. The book also says to bridge or deload now and then, and to keep the same core lifts all the way through.</div>`;
  return h+`</div>`;
}
let omsArm=false, omsErr=null;
function omsCard(){
  if(viewing||sel!==todayStr()) return '';
  const o=omsState(); if(!o.on||!o.end) return '';
  const t=realToday(); if(t<addDays(o.end,-6)||o.snooze===mondayOf(t)) return '';
  const bs=omsBlocks(), nx=omsNext(), start=addDays(mondayOf(t),7);
  const cur=o.i>=0?STEMPL[bs[o.i].t].name:stemplOf().name, N=STEMPL[nx.t].name;
  const warn=programWarnings(nx.t,cprotoKey(),false).map(w=>`<div class="note">${w.text}</div>`).join('');
  return `<div class="card"><div class="lift-h"><h3>${esc(cur)} block ${t>o.end?'ended '+fmtD(o.end,true):'ends '+fmtD(o.end,true)}</h3><span class="chip blue">OMS</span></div>
  <p class="small" style="margin:0">Next in the rotation: <b>${esc(N)}</b>, ${nx.w} weeks, from ${fmtD(start,true)}. ${esc(progName())} is archived with everything in it, your maxes carry over, and your settings stay as they are.</p>
  ${warn}${omsErr?`<div class="banner warn"><div class="small">${esc(omsErr)}</div></div>`:''}
  <div class="row"><button class="btn primary" data-act="omsstart">${omsArm?'Tap again to confirm':'Start '+esc(N)+' block'}</button><button class="btn ghost" data-act="omslater">Not yet</button></div>
  <div class="small muted">Not yet asks again next week. The rotation is in Setup, under Programs.</div></div>`;
}
function omsStart(){
  const nx=omsNext(), start=addDays(mondayOf(realToday()),7), was=clone(plan.oms);
  const err=beginProgram({name:STEMPL[nx.t].name+' block',start,mode:'carry'},next=>{
    next.stempl=nx.t;
    next.oms=Object.assign({},was,{on:true,i:nx.j,end:addDays(start,nx.w*7-1),snooze:null});
  });
  omsArm=false; omsErr=err;
  if(err){ render(); return false }
  sel=realToday(); view='today'; render(); window.scrollTo(0,0);
  return true;
}
function guideOms(){
  return `<div class="card guide"><h3>The OMS rotation</h3>
  <p>Tactical Barbell III\u2019s Block Programming chapter ends with OMS, for Operator / Mass / Specificity: \u201ca simple but powerful long-term continuation protocol for strength and mass\u201d, and, in the book\u2019s words, the standard perpetual model if there were one. Operator is the maximal-strength block, Mass the general hypertrophy block, Specificity the targeted one. Each runs three to six weeks, and you keep repeating the three.</p>
  <p><b>It is a choice.</b> Switch it on in Setup \u2192 Programs \u2192 OMS rotation; off, nothing about the app changes. On, you pick the template for each block (Zulu can stand in for Operator, and any of the general mass templates for Mass, though the book calls Operator and Mass the flagship), the weeks for each, and whether Specificity is in the rotation at all: leaving it out and rotating Operator and Mass is the book\u2019s own variation.</p>
  <p><b>Each block is its own program.</b> In the last week of a block, Today shows what comes next and one button starts it the following Monday: the block is archived, your maxes carry over, and your settings stay as they are. Not yet puts it off a week. Because blocks are programs, History, Status and the spreadsheet export already keep them apart.</p>
  <p class="note">The book\u2019s other advice is left to you: bridge or deload occasionally, run Base Building once or twice a year before a rotation, keep the same core lifts all the way through, and if the goal is mass keep Specificity about hypertrophy. Use Specificity Alpha if you want maximal strength kept in that block.</p></div>`;
}
