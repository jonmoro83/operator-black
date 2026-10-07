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
// Floating local time: no Z and no TZID, so 06:00 means 06:00 wherever you happen to be.
// That is what "my usual gym time" means, and it avoids shipping a VTIMEZONE block.
function icsLocal(d,min){const h=Math.floor(min/60),m=min%60;return icsDate(d)+'T'+pad(h)+pad(m)+'00'}
function hhmm(v){const m=/^(\d{1,2}):(\d{2})$/.exec(String(v||''));if(!m)return null;
  const h=+m[1],mi=+m[2];return h<24&&mi<60?h*60+mi:null}
function icsTrigger(min){ if(!min) return '-PT0S'; return min%60===0?'-PT'+(min/60)+'H':'-PT'+min+'M' }

// The feed's timing settings, with anything missing or malformed falling back to sane.
function calOpts(){
  const c=plan.cal||{};
  const alarm=c.alarm==null||c.alarm===''?null:Math.max(0,+c.alarm||0);
  return {timed:c.mode==='timed',start:hhmm(c.time)??360,weekend:hhmm(c.weekend),alarm};
}
// How long to block out. Conditioning asks the interval timer, so the calendar agrees
// with the session card instead of guessing.
function calMins(dp,date){
  if(dp.t==='lift') return 75;
  if(dp.t==='test'||dp.t==='rm5') return 90;
  if(dp.t==='se') return 45;
  let m=0; if(dp.fmt){ try{ m=ivPartsLabel(dp.fmt,ivOpts(date,dp.fmt)).total||0 }catch(e){} }
  if(dp.t==='plyohic') return (m||40)+20;   // plyos first, rest, then the HIC
  return m||45;
}

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
  return {date,dp,summary:calTitle(wk,dp,date),desc:body.filter(Boolean).join('\n')};
}

function icsFeed(){
  const mon=mondayOf(todayStr());
  const from=addDays(mon,-7*CAL_BACK), to=addDays(mon,7*CAL_AHEAD);
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Operator + Black//Training plan//EN',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+icsEsc(progName()),
    'X-WR-CALDESC:'+icsEsc('Your Operator + Black plan. Updates when you open the app.'),
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H','X-PUBLISHED-TTL:PT6H'];
  const o=calOpts();
  for(let d=from;d<=to;d=addDays(d,1)){
    const e=calEvent(d); if(!e) continue;
    L.push('BEGIN:VEVENT',
      // Stable per day, so a refresh updates the event instead of adding a second one.
      'UID:ob-'+e.date+'@operatorblack.com',
      'DTSTAMP:'+stamp);
    if(o.timed){
      const wknd=dow(d)>=5&&o.weekend!=null, st=wknd?o.weekend:o.start;
      const end=st+calMins(e.dp,d);
      L.push('DTSTART:'+icsLocal(d,st),
        // Past midnight is possible with a late start, so the end rolls into the next day.
        'DTEND:'+icsLocal(addDays(d,Math.floor(end/1440)),end%1440),
        'TRANSP:OPAQUE');
    } else {
      L.push('DTSTART;VALUE=DATE:'+icsDate(e.date),
        'DTEND;VALUE=DATE:'+icsDate(addDays(e.date,1)),
        'TRANSP:TRANSPARENT');
    }
    L.push('SUMMARY:'+icsEsc(e.summary),'DESCRIPTION:'+icsEsc(e.desc));
    if(o.alarm!=null) L.push('BEGIN:VALARM','ACTION:DISPLAY',
      'DESCRIPTION:'+icsEsc(e.summary),'TRIGGER:'+icsTrigger(o.alarm),'END:VALARM');
    L.push('END:VEVENT');
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
  <p class="small muted" style="margin:0">Put the plan in your phone's calendar: every session with the lifts and the weights on it, either as an all-day entry or booked at the time you usually train. It is read-only and it refreshes on its own, so moving a week here moves it there.</p>`;
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
  ${calTimeFields()}
  <div class="small muted">${calCount()} sessions, ${CAL_BACK} weeks back and ${CAL_AHEAD} ahead. It is rewritten whenever you open the app and something has changed.</div>
  <div class="row"><button class="btn sm ghost" data-act="calrotate"${calBusy?' disabled':''}>New address</button><button class="btn sm ghost" data-act="caloff"${calBusy?' disabled':''}>Turn off</button></div>
  <div class="small muted">New address stops the old one working, for a link you shared and want back.</div></div>`;
  return h;
}

// When the sessions land, and whether they nudge you. Bound straight to the plan, so a
// change syncs to your other devices and queues a fresh upload like any other plan edit.
function calTimeFields(){
  const c=plan.cal||{}, o=calOpts();
  const al=o.alarm==null?'':String(o.alarm);
  const opts=o.timed
    ? [['','No reminder'],['0','At the start'],['15','15 min before'],['30','30 min before'],['60','1 hour before'],['120','2 hours before']]
    : [['','No reminder'],['240','8pm the night before']];
  let h=`<div class="grid2"><label class="f">In the calendar<select id="cal-mode" data-pbind="cal.mode">
    <option value="allday"${o.timed?'':' selected'}>All-day entries</option>
    <option value="timed"${o.timed?' selected':''}>At a set time</option></select></label>`;
  h+=o.timed?`<label class="f">Usual training time<input type="time" id="cal-time" data-pbind="cal.time" value="${esc(c.time||'06:00')}"></label></div>
    <div class="grid2"><label class="f">Saturdays and Sundays<input type="time" id="cal-wk" data-pbind="cal.weekend" value="${esc(c.weekend||'')}" placeholder="same"></label>`
    :'</div><div class="grid2">';
  h+=`<label class="f">Reminder<select id="cal-alarm" data-pbind="cal.alarm" data-type="num">${opts.map(([v,l])=>`<option value="${v}"${v===al?' selected':''}>${l}</option>`).join('')}</select></label></div>`;
  h+=o.timed
    ? `<div class="small muted">Sessions are booked from that time for as long as each one takes: 75 minutes for a lifting day, 90 for a retest, and for conditioning whatever the timer says that format runs to. Leave the weekend box empty to use the same time every day. The time is read as the local time wherever you are, so it stays at ${esc(c.time||'06:00')} when you travel rather than shifting with the clocks.</div>`
    : `<div class="small muted">All-day entries sit at the top of the day and don't block out any time. Switch to <b>At a set time</b> if you want the session in your day properly, or a reminder closer to it than the evening before.</div>`;
  return h;
}

