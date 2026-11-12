/* ---------------- Tactical Barbell II's core and grip finishers ----------------
The book's Core + Grip list has four sessions. Full Core is a session in its own right
and lives with the formats (01d-hic-book.js). The other three the book calls finishers,
"tacked on after your main training sessions ... every once in a while", so they are
not something a conditioning day is spent on: they are added to whatever day you like,
under the session, in the same card as anything else you did on top of the program.

Each carries the prescription, the book's basic and advanced versions and its reasoning,
paraphrased, in the same shape as a book HIC session. Nothing here is scored or
scheduled, and a finisher counts toward nothing but itself: what is kept is what you did
last time, because for the grip circuit that is the whole of the book's progression. */
const FINISHERS={
  plankshank:{no:1,name:'Plank & Shank',dose:'1 to 3 rounds',gear:'A back extension bench',unit:'rounds',
    lines:['Plank 1 to 5 minutes','Shank 1 to 5 minutes','Rest 1 to 2 minutes','\u00d7 1 to 3'],
    basic:'Shorter holds to start, roughly 30 to 60 seconds each, and work up.',
    advanced:'Hold a weight when shanking, or wear a weight vest for both. Holds of 2 minutes or more. And/or drop the rest and keep moving from one hold to the next.',
    why:'A quick all-in-one core session and a good finisher. The shank is a static back extension: hold the top position of a back extension, spine fairly straight, no reps up and down, like a reverse plank for the back. It is harder than it sounds even for a strong deadlifter, and a good way to strengthen weak links in the posterior chain. Plank then shank with a break between, or superset them, or hold one longer than the other.',
    holds:[30,60,120]},
  quarterdeck:{no:3,name:'Quarterdeck Core',dose:'5 to 10 rounds',gear:'A back extension and an ab wheel or a barbell',unit:'rounds',
    lines:['Plank push-ups \u00d7 10','Back extensions \u00d7 10','V-ups \u00d7 10','Ab wheel or rollout \u00d7 5 to 10','\u00d7 5 to 10, resting as necessary'],
    basic:'5 sets.',
    advanced:'A weighted vest, 10 to 20 lb.',
    why:'A core finisher with the weight on the abdominal muscles. Squats, deadlifts and overhead presses work the core, but mostly the rear of it, and less of the abs than you think, so every so often it is worth some direct work. The posterior chain is kept light here because the rest of your training already covers it, which makes this a good one to add after a posterior-chain-heavy session. The rollouts can be done with a barbell.'},
  grip:{no:4,name:'Progressive Grip Circuit',dose:'1 to 3 laps',gear:'One pair of dumbbells and 100 m, or a gym',unit:'laps',weight:true,
    lines:['Farmer\u2019s walk 100 m, then 10 dumbbell overhead presses','Farmer\u2019s walk 100 m, then 10 dumbbell reverse curls','Farmer\u2019s walk 100 m, then 10 dumbbell shrugs','Farmer\u2019s walk 100 m, then 10 dumbbell hammer curls','Rest 2 to 3 minutes','\u00d7 1 to 3'],
    alt:'In a gym: hold the dumbbells at your sides for 90 seconds in place of each 100 m walk.',
    why:'The same pair of dumbbells for the whole session, both arms at once, and the goal is to get all the way round without putting them down. Start conservatively: the book suggests 20 to 50 lb a dumbbell for men and 5 to 30 lb for women. When you can get all the way round without putting them down, go up 5 to 10 lb a dumbbell. When you cannot, break it into its four segments with a brief rest after each, and work up to two in a row, then three, then all four. There are no basic or advanced versions of this one.',
    holds:[90]},
};
function finOf(a){ return FINISHERS[a&&a.id]||FINISHERS.plankshank }
/* The last time this finisher was logged before `date`, across every program: a finisher
   belongs to no program, and the grip circuit's weight only means something against the
   last one. */
function finLast(date,id){
  let best=null;
  for(const [d,L] of Object.entries(logs)){
    if(d>=date||!Array.isArray(L.addons)) continue;
    for(const a of L.addons) if(a&&a.kind==='fin'&&(a.id||'plankshank')===id&&(a.rounds||a.w||a.plank||a.shank)) if(!best||d>best.d) best={d,a};
  }
  return best;
}
// What last time says about today. For the grip circuit this is the book's rule, not
// ours: all the way round without putting them down means 5 to 10 lb more a dumbbell.
function finLastLine(date,id){
  const x=finLast(date,id); if(!x) return '';
  const a=x.a, F=FINISHERS[id], bits=[];
  if(a.rounds) bits.push(`${n(a.rounds)} ${+a.rounds===1?F.unit.replace(/s$/,''):F.unit}`);
  if(F.weight&&a.w) bits.push(`${n(a.w)} ${u()} a dumbbell`);
  if(id==='plankshank'&&(a.plank||a.shank)) bits.push(`${a.plank?mmss(+a.plank)+' plank':''}${a.plank&&a.shank?', ':''}${a.shank?mmss(+a.shank)+' shank':''}`);
  let h=`Last time, ${fmtD(x.d,true)}: ${bits.join(', ')||'done'}.`;
  if(F.weight&&a.w) h+=a.unbroken?` You got all the way round without putting them down, so the book says go up: <b>${n(+a.w+(u()==='kg'?2.5:5))} to ${n(+a.w+(u()==='kg'?5:10))} ${u()}</b> a dumbbell.`
    :' You had to put them down, so the book says stay at that weight and link more of the segments together.';
  return h;
}
function finBlock(date,a,i){
  const F=finOf(a), id=FINISHERS[a.id]?a.id:'plankshank';
  const vs=[];
  if(F.basic) vs.push(`<b>Basic:</b> ${esc(F.basic)}`);
  if(F.advanced) vs.push(`<b>Advanced:</b> ${esc(F.advanced)}`);
  if(F.alt) vs.push(`<b>Alternative:</b> ${esc(F.alt)}`);
  const last=finLastLine(date,id);
  let h=`<label class="f">Finisher<select id="in-addon-fin-${i}" data-bind="addons.${i}.id">${Object.entries(FINISHERS).map(([k,x])=>`<option value="${k}"${k===id?' selected':''}>${esc(x.name)} \u00b7 ${esc(x.dose)}</option>`).join('')}</select></label>
    <ul class="tight" style="margin:2px 0">${F.lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>
    ${vs.length?`<div class="small">${vs.join('<br>')}</div>`:''}
    <details class="plain" data-px="finwhy${i}"${openPx.has('finwhy'+i)?' open':''}><summary>What the book says</summary><div class="small muted" style="margin-top:6px">${esc(F.why)}</div></details>
    ${last?`<div class="note">${last}</div>`:''}`;
  if(F.holds) h+=`<div class="row" style="gap:6px;align-items:center;flex-wrap:wrap"><span class="small muted">Time a hold</span>${F.holds.map(s=>`<button class="btn sm" data-act="fintimer" data-v="${s}">${mmss(s)}</button>`).join('')}</div>`;
  h+=`<div class="grid2"><label class="f">${F.unit==='laps'?'Laps':'Rounds'} done${numIn('addons.'+i+'.rounds',a.rounds)}</label>`;
  if(F.weight) h+=`<label class="f">Each dumbbell (${u()})${numIn('addons.'+i+'.w',a.w)}</label></div>
    <label class="check"><input type="checkbox" id="in-addon-unb-${i}" data-bind="addons.${i}.unbroken" ${a.unbroken?'checked':''}> All the way round without putting them down</label>`;
  else if(id==='plankshank') h+=`<label class="f">Plank hold (s)${numIn('addons.'+i+'.plank',a.plank)}</label></div>
    <label class="f">Shank hold (s)${numIn('addons.'+i+'.shank',a.shank)}</label>`;
  else h+=`</div>`;
  h+=`<div class="small muted">Tactical Barbell II, core and grip, session ${F.no}. Needs: ${esc(F.gear.toLowerCase())}.</div>`;
  return h;
}
