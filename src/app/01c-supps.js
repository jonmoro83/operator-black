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
  creatine:{name:'Creatine monohydrate',lvl:1,ctx:'mass',when:'daily',src:'TB3',
    dose:'5 to 10 g once a day, training days and rest days alike',
    note:'The book is blunt about giving up early: you are not a non-responder until you have taken it for a month or two without skipping doses, and most people who say they are have not. Monohydrate, and Creapure if you can get it.'},
  protein:{name:'Protein powder',lvl:1,ctx:'both',when:'daily',src:'TB3 and TB2',
    dose:'whatever it takes to reach 1 to 2 g of protein per lb of bodyweight',
    note:'Only there to make up the difference food did not. TB3: if you can eat four or five steaks a day and get it all from whole food, do that and skip this.'},
  multi:{name:'Multivitamin',lvl:1,ctx:'mass',when:'daily',src:'TB3',
    dose:'one a day, a quality brand',
    note:'Not recommended across the board — the book puts it on the mass list because gaining twenty or thirty pounds of muscle is a demanding job and the processes doing it need the raw material.'},
  caffeine:{name:'Caffeine',lvl:2,ctx:'mass',when:'pre',src:'TB3',
    dose:'100 to 200 mg, 20 to 30 minutes before training',
    note:'Level 1 for many people, but the book says that if you have never trained on caffeine there is no reason to start: it does not drive mass gain. Tablets are a cheaper and cleaner substitute for a pre-workout.'},
  citrulline:{name:'Citrulline malate',lvl:2,ctx:'mass',when:'pre',src:'TB3',
    dose:'4 to 6 g, 30 to 45 minutes before training',
    note:'For work capacity and delaying fatigue. Less than 4 g may do nothing. Beet powder or extract is the alternative the book offers.'},
  magnesium:{name:'Magnesium',lvl:2,ctx:'both',when:'daily',src:'TB3 and TB2',
    dose:'200 to 300 mg a day; glycinate or malate',
    note:'Depleted by stimulants, stress and a high training load. Glycinate relaxes and malate energizes. Some people react badly to glycinate and feel flat the next day — try malate before giving up on it.'},
  beets:{name:'Beets or TMG',lvl:2,ctx:'cond',when:'daily',src:'TB2',
    dose:'a couple of glasses of blended beets a day; TMG (betaine) if you would rather not',
    note:'The author’s own: noticeably more in the tank on long work, and fatigue taking longer to arrive. Canned sliced beets are fine.'},
  electrolyte:{name:'Electrolytes',lvl:2,ctx:'cond',when:'daily',src:'TB2',
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
  if(s.ctx!=='both'&&s.ctx!==suppCtx()) return `${s.src} ${SUPP_LVL[s.lvl]}, for ${s.ctx==='mass'?'building mass':'a conditioning load'}`;
  return s.lvl===1?`${s.src} Level 1 — the book calls it mandatory`:`${s.src} Level 2 — worth having, not necessary`;
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
  <p class="small muted" style="margin:0">The list is the books’, doses included. TB3: <i>"There are supplements that work, supplements that work for some people, and supplements that probably don’t work for anyone."</i> Tick what you take and it appears in the daily check-in and on session days. Tracking what you take is ours; none of the doses are.</p>
  <p class="small muted" style="margin:0"><b>The book’s own caveat, kept:</b> Level 1 is mandatory <i>if you have the budget and are cleared by your physician</i>. This is general training guidance, not medical advice.</p>`;
  h+=`<div class="small" style="font-weight:650;margin-top:4px">For what you are running — ${ctx==='mass'?'a mass template, so TB3’s list applies':'a conditioning load, so TB2’s list applies'}</div>`;
  h+=`<div class="supps">${fits.map(([k,s])=>suppRow(k,s)).join('')}</div>`;
  h+=`<details class="plain"><summary>The rest of the books’ list</summary><div class="small muted" style="margin-top:6px">Written for the other context. Nothing stops you taking them; the book just does not prescribe them for the program you are on.</div><div class="supps">${rest.map(([k,s])=>suppRow(k,s)).join('')}</div></details>`;
  h+=`<div style="border-top:1px solid var(--line);padding-top:12px"><div class="small" style="font-weight:650">Yours</div>
  <p class="small muted" style="margin:2px 0 0">Anything the books do not cover. No dose is shown for these, because the books do not give one and making one up is not the app’s job.</p>`;
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
    h+=`<div class="small muted">${st?`Creatine: <b class="mono">${st} day${st===1?'':'s'}</b> unbroken.${st<60?` The book asks for a month or two without skipping before you decide it does nothing for you.`:''}`:'Creatine not logged today. The book’s whole point about it is the doses you do not skip.'}</div>`;
  }
  return h+`</div>`;
}
