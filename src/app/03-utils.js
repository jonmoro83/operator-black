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
  const d=date||sel, wk=d?weekOf(d):null, bv=blockVar(k,d);
  if(wk&&(wk.kind==='test'||wk.kind==='bridge')) return bv;
  const o=((logs[d]||{}).var||{})[k];
  return varsOf(k)[o]?o:bv;
}
function blockVar(k,date){
  if(!VARS[k]) return null;
  const d=date||sel, wk=d?weekOf(d):null;
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
function elevUnit(){return u()==='kg'?'m':'ft'}
// Climbing counted as distance: the trail rule of thumb is 1,000 ft of gain ≈ 1 mile
// (190 m ≈ 1 km). One factor for every activity, so the numbers stay comparable.
function elevPerDist(){const v=+((plan.elevPer||{})[u()]);return v>0?v:(u()==='kg'?190:1000)}
function u(){return plan.unit||'lb'}
