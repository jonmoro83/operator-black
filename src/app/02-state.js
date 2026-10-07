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
let view='today', sel=todayStr(), planShow=26, planMode='list', calMonth=null;
try{const pm=localStorage.getItem('ob.planmode'); if(pm==='cal'||pm==='list') planMode=pm}catch(e){}
try{ const v=localStorage.getItem('ob.view'); if(v) view=v; }catch(e){}
