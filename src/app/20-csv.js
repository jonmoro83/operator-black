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
  const U=u(), rows=[['date','program','week','session','lift','variant','kind','sets_prescribed','reps','pct','prescribed_'+U,'working_'+U,'sets_done','grinder','test_weight_'+U,'test_reps','est_1rm_'+U,'warmups']];
  eachDateInPrograms((d,prog)=>{
    const L=logs[d], wk=weekOf(d), dp=dayPlan(d), week=wk?weekTitle(wk).t:'';
    if(dp.t==='lift'&&wk) for(const k of dp.lifts){
      const x=(L.lifts||{})[k]; if(!x) continue;
      const r=rx(wk,k,d), sets=Array.isArray(x.sets)?x.sets:[], wu=(Array.isArray(x.warmup)?x.warmup:[]).filter(w=>w&&w.w!=null&&w.w!=='');
      const used=x.used!=null&&x.used!==''?+x.used:r.w;
      rows.push([d,prog,week,dp.short,liftName(k,d),VARS[k]?varOf(k,d):'','working',r.sMax>r.s?r.s+'-'+r.sMax:r.s,r.r,r.p,r.w??'',used??'',sets.filter(Boolean).length,x.grinder?'yes':'','','','',wu.map(w=>(isBW(k)?fmtLoad(k,+w.w):n(w.w))+'x'+(w.r??'')).join('; ')]);
    }
    for(const [k,t] of Object.entries(L.test||{})){
      if(!t||t.w==null||t.w==='') continue;
      const reps=t.r||(dp.t==='rm5'?5:1), e=estMax(k,t.w,reps,d);
      rows.push([d,prog,week,dp.short||'',liftName(k,d),VARS[k]?varRef(k):'',dp.t==='rm5'?'5RM test':'test','',reps,'','','','','',t.w,reps,e!=null?Math.round(e*10)/10:'','']);
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
