/* ---------------- administration ----------------
Visible only to addresses in the ADMIN_EMAILS secret. The page asks the server whether
you are one — it never decides for itself — and the server checks every admin route
again regardless, so hiding the link is a convenience and not the control.

What it shows is deliberately narrow. Counts, dates and whether the last backup verified
are enough to run the thing. Reading somebody's training log is not administration, so
there is no screen for it: the export hands their data back whole, which is what you
would want it for. */

let admin = { list: null, loading: false, err: null, busy: null, confirm: null, typed: '', log: null };

async function adminLoad(force) {
  if (admin.loading || (admin.list && !force)) return;
  admin.loading = true; admin.err = null;
  try { const r = await api('GET', '/admin/users'); admin.list = r.users; admin.me = r.me; }
  catch (e) { admin.err = e && e.status === 404 ? 'This account is not an administrator.' : 'Could not load the list.'; }
  admin.loading = false; if (view === 'admin') render();
}
async function adminLoadLog(force) {
  if (admin.logLoading || (admin.log && !force)) return;
  admin.logLoading = true;
  try { const r = await api('GET', '/admin/log'); admin.log = r.log || []; admin.logErr = r.error || null; }
  catch (e) { admin.log = []; admin.logErr = 'Could not load the record.'; }
  admin.logLoading = false; if (view === 'admin') render();
}

// A removal stores what it took as JSON; show it as something readable.
function adminDetail(raw) {
  try {
    const d = JSON.parse(raw);
    const bits = [];
    if (d.docs != null) bits.push(d.docs + ' document' + (d.docs === 1 ? '' : 's'));
    if (d.backups != null) bits.push(d.backups + ' backup' + (d.backups === 1 ? '' : 's'));
    if (d.calendar) bits.push('calendar feed');
    if (d.alerts) bits.push('alerts');
    return bits.join(', ');
  } catch { return String(raw).slice(0, 80) }
}
async function adminWipe(who) {
  admin.busy = who;
  render();
  try {
    const r = await api('DELETE', '/admin/users/' + encodeURIComponent(who), { confirm: who });
    admin.confirm = null; admin.typed = '';
    admin.msg = `Removed ${who}: ${r.removed.docs} documents, ${r.removed.backups} backups.`;
    admin.list = null; admin.log = null;
    await adminLoad(true); await adminLoadLog(true);
  } catch (e) {
    admin.err = e && e.status === 400 ? 'That did not match. Nothing was removed.' : 'Could not remove that account.';
  }
  admin.busy = null; render();
}

function vAdmin() {
  let h = `<div class="card"><div class="lift-h"><h2>People</h2><button class="btn sm ghost" data-act="adminrefresh">Refresh</button></div>
  <p class="small muted" style="margin:0">Everyone with data in this app. Counts and dates only — their sessions and numbers are theirs, and there is no screen here that shows them.</p>`;
  if (admin.msg) h += `<div class="banner info"><div>${esc(admin.msg)}</div></div>`;
  if (admin.err) h += `<div class="banner warn"><div>${esc(admin.err)}</div></div>`;
  if (!admin.list) { h += `<div class="small muted">${admin.loading ? 'Loading…' : 'Nothing loaded.'}</div></div>`; adminLoad(); return h; }

  for (const u of admin.list) {
    const mine = u.user === admin.me;
    const when = u.last ? fmtD(new Date(u.last).toISOString().slice(0, 10), true) : '—';
    h += `<div style="border-top:1px solid var(--line);padding-top:10px;margin-top:10px">
    <div class="row between" style="gap:8px"><b style="word-break:break-all">${esc(u.user)}</b>${u.admin ? '<span class="chip blue">admin</span>' : ''}${mine ? '<span class="chip">you</span>' : ''}</div>
    <div class="small muted">${u.logs} logged day${u.logs === 1 ? '' : 's'} · ${u.docs} document${u.docs === 1 ? '' : 's'} · ${Math.round((u.bytes || 0) / 1024)} kB · last activity ${esc(when)}</div>
    <div class="small ${u.backupOk === false ? 'warn-t' : 'muted'}">${u.backups} backup${u.backups === 1 ? '' : 's'}${u.backupOk === true ? ' · last one verified' : u.backupOk === false ? ' · the last one did NOT verify' : ' · never checked'}</div>
    <div class="row" style="gap:8px;margin-top:6px"><a class="btn sm" href="/api/admin/users/${encodeURIComponent(u.user)}/export">Export their data</a>
    ${mine ? '<span class="small muted">You cannot clear your own account from here.</span>'
      : `<button class="btn sm ghost" data-act="adminclear" data-user="${esc(u.user)}">Clear their data…</button>`}</div>`;

    if (admin.confirm === u.user) {
      const ok = admin.typed.trim().toLowerCase() === u.user.toLowerCase();
      h += `<div class="banner alert" style="margin-top:8px"><div><b>This removes everything ${esc(u.user)} has.</b>
      Their plan, every logged session, all their backups, their calendar feed and their alerts. It cannot be undone from here, so export first if they might want it.
      <label class="f" style="margin-top:8px">Type their address to confirm<input type="text" data-adminconfirm value="${esc(admin.typed)}" placeholder="${esc(u.user)}" autocomplete="off"></label></div>
      <div class="row"><button class="btn sm" data-act="adminclearoff">Cancel</button><button class="btn sm primary" data-act="adminwipe" data-user="${esc(u.user)}"${ok && admin.busy !== u.user ? '' : ' disabled'}>${admin.busy === u.user ? 'Removing…' : 'Remove everything'}</button></div></div>`;
    }
    h += `</div>`;
  }
  h += `</div>`;

  h += `<div class="card"><div class="lift-h"><h2>Audit log</h2><button class="btn sm ghost" data-act="adminlog">Refresh</button></div>
  <p class="small muted" style="margin:0">Every export and every removal, newest first. Written by the server as it happens; there is no route that edits or clears it.</p>`;
  if (admin.logErr) h += `<div class="banner warn"><div>${esc(admin.logErr)}</div></div>`;
  if (!admin.log) { h += `<div class="small muted">${admin.logLoading ? 'Loading\u2026' : ''}</div>`; adminLoadLog(); }
  else if (!admin.log.length) h += `<div class="small muted">Nothing yet.</div>`;
  else h += `<div class="stack" style="gap:8px">${admin.log.map(e => {
    const d = new Date(e.at);
    const when = `${fmtD(d.toISOString().slice(0, 10), true)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `<div class="small" style="border-top:1px solid var(--line);padding-top:6px">
      <b>${e.action === 'delete' ? 'Removed' : 'Exported'}</b> ${esc(e.subject)}
      <div class="muted">${esc(when)} \u00b7 by ${esc(e.actor)}${e.detail ? ' \u00b7 ' + esc(adminDetail(e.detail)) : ''}</div></div>`;
  }).join('')}</div>`;
  return h + `</div>`;
}
