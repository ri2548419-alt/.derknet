// Frontend-only demo app with hash routing + localStorage
const S = {
  usersKey: 'dn_users',
  currentKey: 'dn_current',
  actReqKey: 'dn_activation_requests',
  wReqKey: 'dn_withdraw_requests'
};

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
function uid(){ return 'U' + Math.floor(Math.random()*1e10).toString().padStart(10,'0'); }
function id(){ return 'ID' + Math.random().toString(36).slice(2,8).toUpperCase(); }
function today(){ return new Date().toISOString().slice(0,10); }

function read(key, def){ try{ return JSON.parse(localStorage.getItem(key)) ?? def; }catch(e){ return def; } }
function write(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function currentUser(){
  const id = read(S.currentKey, null);
  const users = read(S.usersKey, []);
  return users.find(u => u.id === id) || null;
}
function saveUser(u){
  const users = read(S.usersKey, []);
  const idx = users.findIndex(x => x.id === u.id);
  if(idx >= 0){ users[idx] = u; } else { users.push(u); }
  write(S.usersKey, users);
}

function route(){
  const hash = location.hash || '#/login';
  const path = hash.split('?')[0];

  // auth guard
  const me = currentUser();
  const needAuth = ['#/dashboard','#/referral','#/earning','#/withdraw','#/profile','#/admin','#/activate'];
  if(needAuth.includes(path) && !me){
    show('login'); return;
  }
  switch(path){
    case '#/login': show('login'); break;
    case '#/register': show('register'); break;
    case '#/dashboard': renderDashboard(); show('dashboard'); break;
    case '#/activate': renderActivate(); show('activate'); break;
    case '#/referral': renderReferral(); show('referral'); break;
    case '#/earning': show('earning'); break;
    case '#/withdraw': renderWithdraw(); show('withdraw'); break;
    case '#/profile': renderProfile(); show('profile'); break;
    case '#/admin': renderAdmin(); show('admin'); break;
    default: location.hash = me ? '#/dashboard' : '#/login';
  }
}

function show(id){
  // toggle nav visibility based on auth
  const me = currentUser();
  $('#logoutBtn').classList.toggle('hidden', !me);
  $all('main > section').forEach(s => s.classList.add('hidden'));
  $('#' + id)?.classList.remove('hidden');
}

function parseQuery(){
  const hash = location.hash;
  const qIndex = hash.indexOf('?');
  const out = {};
  if(qIndex === -1) return out;
  const qs = new URLSearchParams(hash.slice(qIndex+1));
  qs.forEach((v,k)=> out[k]=v);
  return out;
}

// --- Auth ---
$('#registerForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#regName').value.trim();
  const email = $('#regEmail').value.trim().toLowerCase();
  const phone = $('#regPhone').value.trim();
  const pass = $('#regPassword').value;

  if(!name || !email || !phone || !pass){ alert('সব ঘর পূরণ করুন'); return; }

  const users = read(S.usersKey, []);
  if(users.some(u => u.email === email)){ alert('এই ইমেইল আগেই ব্যবহৃত হয়েছে'); return; }

  const u = {
    id: uid(),
    name, email, phone,
    password: pass,
    balance: 0,
    referrals: [],
    status: 'inactive',
    requestedActivation: false,
    isAdmin: false,
    createdAt: today(),
    theme: 'dark',
    referralBy: null
  };

  // referral capture from #/register?ref=UID
  const q = parseQuery();
  if(q.ref){ u.referralBy = q.ref; }

  users.push(u);
  write(S.usersKey, users);
  write(S.currentKey, u.id);
  alert('একাউন্ট তৈরি হয়েছে! লগইন করা হলো।');
  location.hash = '#/dashboard';
});

$('#loginForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const email = $('#loginEmail').value.trim().toLowerCase();
  const pass = $('#loginPassword').value;
  const users = read(S.usersKey, []);
  const u = users.find(x => x.email === email && x.password === pass);
  if(!u){ alert('ভুল ইমেইল বা পাসওয়ার্ড'); return; }
  write(S.currentKey, u.id);
  location.hash = '#/dashboard';
});

$('#logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem(S.currentKey);
  location.hash = '#/login';
});

// --- Dashboard ---
function renderDashboard(){
  const me = currentUser();
  if(!me) return;
  $('#dName').textContent = me.name;
  $('#dUID').textContent = me.id;
  $('#dBalance').textContent = me.balance.toString();
  $('#dRefs').textContent = me.referrals.length.toString();
  const st = $('#dStatus');
  st.textContent = me.status[0].toUpperCase() + me.status.slice(1);
  st.style.background = me.status === 'active' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)';
  $('#activateBtn').classList.toggle('hidden', me.status === 'active');
}

// --- Activate ---
function renderActivate(){
  const me = currentUser();
  if(!me) return;
  $('#actStatus').textContent = me.requestedActivation ? 'Pending' : 'Not Submitted';
  $('#activationForm').querySelector('button').disabled = me.requestedActivation;
}
$('#activationForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const me = currentUser();
  if(!me) return;
  if(me.requestedActivation){ alert('আপনি আগে রিকোয়েস্ট করেছেন'); return; }
  const method = document.querySelector('input[name="paymethod"]:checked').value;
  const txid = $('#txid').value.trim();
  if(!txid){ alert('TxID দিন'); return; }

  const reqs = read(S.actReqKey, []);
  reqs.push({ userId: me.id, name: me.name, uid: me.id, method, txid, status: 'pending' });
  write(S.actReqKey, reqs);

  me.requestedActivation = true;
  saveUser(me);
  alert('Activation request submitted (Demo).');
  renderActivate();
});

// --- Referral ---
function siteOrigin(){
  // GitHub Pages friendly
  return location.origin + location.pathname.replace(/index\.html$/,'').replace(/\/$/,'') + '/';
}
function renderReferral(){
  const me = currentUser();
  if(!me) return;
  if(me.status !== 'active'){
    // inactive users cannot access referral in real rule;
    // We'll still show link but warn.
  }
  const link = siteOrigin() + '#/register?ref=' + me.id;
  $('#refLink').value = link;
  $('#copyRef').onclick = () => {
    navigator.clipboard.writeText(link).then(()=>alert('কপি হয়েছে'));
  };

  // build list of people who used this ref
  const users = read(S.usersKey, []);
  const referred = users.filter(u => u.referralBy === me.id);
  const tbody = $('#refTable');
  tbody.innerHTML = '';
  referred.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.name}</td><td>${u.id}</td><td>${u.status}</td><td>${u.createdAt}</td>`;
    tbody.appendChild(tr);
  });
}

// --- Withdraw ---
function renderWithdraw(){
  const me = currentUser(); if(!me) return;
  $('#wBalance').textContent = me.balance.toString();
  const mine = read(S.wReqKey, []).filter(r => r.userId === me.id);
  const tbody = $('#wTable'); tbody.innerHTML='';
  mine.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.id}</td><td>${r.method}</td><td>${r.number}</td><td>${r.amount}</td><td>${r.status}</td>`;
    tbody.appendChild(tr);
  });
}
$('#withdrawForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const me = currentUser(); if(!me) return;
  const method = $('#wMethod').value;
  const number = $('#wNumber').value.trim();
  const amount = parseInt($('#wAmount').value, 10);
  if(isNaN(amount) || amount < 300){ alert('Minimum 300 ৳'); return; }
  if(me.balance < amount){ alert('পর্যাপ্ত ব্যালেন্স নেই'); return; }

  me.balance -= amount;
  saveUser(me);

  const reqs = read(S.wReqKey, []);
  const R = { id: id(), userId: me.id, name: me.name, method, number, amount, status: 'pending' };
  reqs.push(R); write(S.wReqKey, reqs);
  alert('Withdraw request submitted (Demo).');
  renderWithdraw();
  renderDashboard();
});

// --- Profile ---
function renderProfile(){
  const me = currentUser(); if(!me) return;
  $('#pName').value = me.name;
  $('#pEmail').value = me.email;
  $('#pUID').value = me.id;
  const dark = (me.theme || 'dark') === 'dark';
  $('#themeToggle').checked = !dark;
  document.body.classList.toggle('theme-light', !dark);
  $('#themeLabel').textContent = dark ? 'Dark' : 'Light';
}
$('#profileForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const me = currentUser(); if(!me) return;
  me.name = $('#pName').value.trim() || me.name;
  const np = $('#pPassword').value;
  if(np) me.password = np;
  me.theme = $('#themeToggle').checked ? 'light' : 'dark';
  saveUser(me);
  alert('Saved');
  renderDashboard(); renderProfile();
});
$('#themeToggle')?.addEventListener('change', e => {
  const me = currentUser(); if(!me) return;
  me.theme = e.target.checked ? 'light' : 'dark';
  saveUser(me);
  document.body.classList.toggle('theme-light', e.target.checked);
  $('#themeLabel').textContent = e.target.checked ? 'Light' : 'Dark';
});

// --- Admin ---
function renderAdmin(){
  const me = currentUser(); if(!me) return;
  if(!me.isAdmin){
    // limited view until they click demo admin button
  }
  const users = read(S.usersKey, []);
  $('#mTotal').textContent = users.length;
  $('#mActive').textContent = users.filter(u=>u.status==='active').length;
  $('#mInactive').textContent = users.filter(u=>u.status!=='active').length;

  // members table
  const tbody = $('#membersTable'); tbody.innerHTML='';
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.name}</td><td>${u.id}</td><td>${u.referrals.length}</td><td>${u.balance}</td><td>${u.status}</td>`;
    tbody.appendChild(tr);
  });

  // activation table
  const acts = read(S.actReqKey, []);
  const actBody = $('#actTable'); actBody.innerHTML='';
  acts.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.name}</td><td>${r.uid}</td><td>${r.method}</td><td>${r.txid}</td><td>${r.status}</td>
      <td>
        <button class="btn small" data-approve="${idx}">Approve</button>
        <button class="btn small outline" data-reject="${idx}">Reject</button>
      </td>`;
    actBody.appendChild(tr);
  });

  // withdraw table
  const wreqs = read(S.wReqKey, []);
  const wBody = $('#adminWTable'); wBody.innerHTML='';
  wreqs.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td>${r.method}</td><td>${r.number}</td><td>${r.amount}</td><td>${r.status}</td>
      <td>
        <button class="btn small" data-wapprove="${idx}">Complete</button>
        <button class="btn small outline" data-wreject="${idx}">Reject</button>
      </td>`;
    wBody.appendChild(tr);
  });

  // action bindings
  actBody.querySelectorAll('button[data-approve]').forEach(btn => btn.onclick = () => {
    const idx = +btn.dataset.approve;
    if(!confirm('Approve activation?')) return;
    const reqs = read(S.actReqKey, []);
    const r = reqs[idx];
    r.status = 'approved';
    write(S.actReqKey, reqs);
    // activate user
    const users = read(S.usersKey, []);
    const u = users.find(x => x.id === r.userId);
    if(u){
      u.status = 'active';
      // reward referrer
      if(u.referralBy){
        const ref = users.find(x => x.id === u.referralBy);
        if(ref){ ref.balance += 200; ref.referrals.push(u.id); }
      }
      write(S.usersKey, users);
    }
    renderDashboard(); renderAdmin(); alert('Approved');
  });
  actBody.querySelectorAll('button[data-reject]').forEach(btn => btn.onclick = () => {
    const idx = +btn.dataset.reject;
    if(!confirm('Reject activation?')) return;
    const reqs = read(S.actReqKey, []);
    reqs[idx].status = 'rejected';
    write(S.actReqKey, reqs);
    renderAdmin(); alert('Rejected');
  });

  wBody.querySelectorAll('button[data-wapprove]').forEach(btn => btn.onclick = () => {
    const idx = +btn.dataset.wapprove;
    if(!confirm('Mark withdraw as completed?')) return;
    const reqs = read(S.wReqKey, []);
    reqs[idx].status = 'completed';
    write(S.wReqKey, reqs);
    renderAdmin(); alert('Completed');
  });
  wBody.querySelectorAll('button[data-wreject]').forEach(btn => btn.onclick = () => {
    const idx = +btn.dataset.wreject;
    if(!confirm('Reject withdraw?')) return;
    const reqs = read(S.wReqKey, []);
    // refund on reject
    const r = reqs[idx];
    const users = read(S.usersKey, []);
    const u = users.find(x => x.id === r.userId);
    if(u){ u.balance += r.amount; write(S.usersKey, users); }
    reqs[idx].status = 'rejected';
    write(S.wReqKey, reqs);
    renderDashboard(); renderAdmin(); alert('Rejected & refunded');
  });
}

$('#becomeAdmin')?.addEventListener('click', () => {
  const me = currentUser(); if(!me) return;
  if(!confirm('Demo mode: Make current user Admin?')) return;
  me.isAdmin = true; saveUser(me); alert('You are Admin (Demo).'); renderAdmin();
});

// --- Activate button from dashboard ---
$('#activateBtn')?.addEventListener('click', () => { location.hash = '#/activate'; });

// --- Init ---
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  // year
  $('#year').textContent = new Date().getFullYear();
  route();
});
