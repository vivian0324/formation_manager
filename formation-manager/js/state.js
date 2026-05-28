// ═══════════════════════════════════════════════════════
// STATE — global data model, constants, persistence
// ═══════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const STORE_KEY = 'fm_v3_state';
let S = {
  dancers: [],       // {id,name,color}
  absentIds: [],     // ids
  vipIds: [],        // ids (up to 3)
  vipBackups: {},    // {vipId: [backupId, backupId, backupId]}
  dir: 'bot',
  formations: [],    // {id,name,vipDancerId,positions:[{x,y,dancerId,pose}]}
  results: [],       // [{method,label,formations:[...]}]
};
let nid = 1;
function uid(){ return nid++; }

const COLORS = ['#7ab8e8','#7ac9a0','#e8c97a','#b07ae8','#e87ab0','#7ae8d4',
  '#e8997a','#a0e87a','#e87a7a','#7a9ae8','#c97ae8','#7ae8b0','#e8c07a',
  '#7abce8','#e87ac9','#d4e87a','#e87a9a','#7ad4e8','#e8b07a','#9ae87a'];
const POSE_ICON = {stand:'↑',floor:'↓',left:'◀',right:'▶',none:''};
const POSE_CLS  = {stand:'p-stand',floor:'p-floor',left:'p-left',right:'p-right',none:''};

// ─── persistence ───────────────────────────────────────
function autoSave(){
  try{
    const snap = JSON.parse(JSON.stringify(S));
    snap.perfTitle = document.getElementById('perf-title').value;
    snap.defShape  = document.getElementById('def-shape').value;
    localStorage.setItem(STORE_KEY, JSON.stringify(snap));
    const dot = document.getElementById('save-dot');
    const lbl = document.getElementById('save-lbl');
    dot.classList.add('vis');
    lbl.textContent = 'Saved ' + new Date().toLocaleTimeString();
    clearTimeout(autoSave._t);
    autoSave._t = setTimeout(()=>dot.classList.remove('vis'), 2000);
  }catch(e){}
}
function loadSaved(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return false;
    const snap = JSON.parse(raw);
    S = snap;
    // restore nid
    let maxId = 0;
    S.dancers.forEach(d=>{ if(d.id>maxId) maxId=d.id; });
    S.formations.forEach(f=>{ if(f.id>maxId) maxId=f.id; });
    nid = maxId + 1;
    if(snap.perfTitle) document.getElementById('perf-title').value = snap.perfTitle;
    if(snap.defShape)  document.getElementById('def-shape').value  = snap.defShape;
    return true;
  }catch(e){ return false; }
}

