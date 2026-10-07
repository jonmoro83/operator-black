/* ---------------- calendar feed ----------------
A subscribable .ics of the plan, for iPhone Calendar, Google Calendar or anything else
that reads a URL.

The schedule only exists in this file's neighbours -- weeks(), dayPlan(), rx() -- so the
app generates the calendar and the Worker stores and serves the text verbatim. That keeps
one implementation of the programme instead of a second one on the server that could
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
  return {date,summary:calTitle(wk,dp,date),desc:body.filter(Boolean).join('\n')};
}

function icsFeed(){
  const mon=mondayOf(todayStr());
  const from=addDays(mon,-7*CAL_BACK), to=addDays(mon,7*CAL_AHEAD);
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Operator + Black//Training plan//EN',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEsc(progName()),
    'X-WR-CALDESC:'+icsEsc('Your Operator + Black plan. Updates when you open the app.'),
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H','X-PUBLISHED-TTL:PT6H'];
  for(let d=from;d<=to;d=addDays(d,1)){
    const e=calEvent(d); if(!e) continue;
    L.push('BEGIN:VEVENT',
      // Stable per day, so a refresh updates the event instead of adding a second one.
      'UID:ob-'+e.date+'@operatorblack.com',
      'DTSTAMP:'+stamp,
      'DTSTART;VALUE=DATE:'+icsDate(e.date),
      'DTEND;VALUE=DATE:'+icsDate(addDays(e.date,1)),
      'TRANSP:TRANSPARENT',
      'SUMMARY:'+icsEsc(e.summary),
      'DESCRIPTION:'+icsEsc(e.desc),
      'END:VEVENT');
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
  <p class="small muted" style="margin:0">Put the plan in your phone's calendar: every session as an all-day entry, with the lifts and the weights on it. It is read-only and it refreshes on its own, so moving a week here moves it there.</p>`;
  if(!f) return h+`<div class="muted small">Checking\u2026</div></div>`;
  if(f.broken) return h+`<div class="banner warn"><div>${f.broken==='offline'?'Could not reach the server. The feed will show up when you are back online.':'The server could not answer. If this site was just updated, the calendar table may not exist yet \u2014 run <code>npm run db:migrate:remote</code>.'}</div></div></div>`;
  if(!f.enabled){
    h+=`<div class="row"><button class="btn primary" data-act="calon"${calBusy?' disabled':''}>${calBusy?'Working\u2026':'Turn on the feed'}</button></div>
    <div class="small muted">This creates a private web address for your plan. Anyone with the address can read your schedule \u2014 not your logs, maxes or anything else \u2014 so treat it like a password and use <b>New address</b> below if you ever share it by accident.</div></div>`;
    return h;
  }
  const web=f.url.replace(/^https?:/,'webcal:');
  h+=`<label class="f">Your feed address<input type="text" id="cal-url" value="${esc(f.url)}" readonly onclick="this.select()"></label>
  <div class="row"><a class="btn primary" href="${esc(web)}">Add to iPhone</a><button class="btn" data-act="calcopy">Copy address</button></div>
  <div class="small muted"><b>iPhone:</b> tap Add to iPhone above, or Settings \u2192 Apps \u2192 Calendar \u2192 Accounts \u2192 Add Account \u2192 Other \u2192 Add Subscribed Calendar, and paste the address.
  <b>Android:</b> on a computer open Google Calendar \u2192 Other calendars \u2192 + \u2192 From URL, and paste it there. It then syncs to the phone. Google refreshes subscribed calendars on its own schedule, which can take a day.</div>
  <div class="small muted">${calCount()} sessions, ${CAL_BACK} weeks back and ${CAL_AHEAD} ahead. It is rewritten whenever you open the app and something has changed.</div>
  <div class="row"><button class="btn sm ghost" data-act="calrotate"${calBusy?' disabled':''}>New address</button><button class="btn sm ghost" data-act="caloff"${calBusy?' disabled':''}>Turn off</button></div>
  <div class="small muted">New address stops the old one working, for a link you shared and want back.</div></div>`;
  return h;
}
