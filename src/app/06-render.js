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
    const g=Object.values(L.lifts).some(x=>x&&x.grinder);
    const miss=L.done&&Object.values(L.lifts).some(x=>x&&Array.isArray(x.sets)&&x.sets.length&&x.sets.slice(0,2).some(v=>!v));
    if((+L.rpe>=9)||g||miss) c++;
  }
  return c;
}
