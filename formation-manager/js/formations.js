// FORMATIONS

me='btn btn-sm btn-red'; db.textContent='×';
    db.onclick=()=>deleteSlot(name);
    row.appendChild(info); row.appendChild(lb); row.appendChild(db); cont.appendChild(row);
  });
}
function exportJSON(){
  const snap=JSON.parse(JSON.stringify(S,(k,v)=>v instanceof Set?[...v]:v));
  snap._exportedAt=new Date().toLocaleString();
  const blob=new Blob([JSON.stringify(snap,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  // Use the choreography name from the slot-name input if filled,
  // otherwise fall back to the first formation name, then 'choreography'
  const slotInput = document.getElementById('slot-name');
  const choreoName = (slotInput&&slotInput.value.trim())
    || S.formations[0]?.name
    || 'choreography';
  const safeName = choreoName.replace(/[^a-z0-9]/gi,'-').toLowerCase();
  a.href=url; a.download=safeName+'.json'; a.click(); URL.revokeObjectURL(url);
  showAlert('Exported JSON','ok');
}
function importJSON(ev){
  const file=ev.target.files[0]; if(!file) return;
  if(!confirm('Import "'+file.name+'"? This replaces the current choreography.')) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const snap=JSON.parse(e.target.result);
      // Restore all fields with safe defaults for anything missing
      S = {
        dancers:    snap.dancers    || [],
        absentIds:  snap.absentIds  || [],
        vipIds:     snap.vipIds     || [],
        vipBackups: snap.vipBackups || {},
        dir:        snap.dir        || 'bot',
        formations: snap.formations || [],
        results:    snap.results    || [],
        thresholds: snap.thresholds || {...THRESHOLD_DEFAULTS},
        vipHardIds: new Set(snap.vipHardIds||[]),
      };
      // Restore nid to avoid ID collisions
      const maxId = S.dancers.reduce((m,d)=>Math.max(m,d.id||0),0);
      if(typeof nid !== 'undefined') nid = maxId + 1;
      autoSave();
      renderAll();
      syncThresholdInputs();
      renderSlots();
      showPanel(S.formations.length?'formations':'setup');
      showAlert('Imported: '+file.name,'ok');
    }catch(err){
      console.error('Import error:', err);
      showAlert('Import failed: '+err.message,'warn');
    }
  };
  reader.readAsText(file); ev.target.value='';
}

function setDir(d){ S.dir=d; renderSidebar(); renderFormations(); autoSave(); }
const THRESHOLD_DEFAULTS={A:1.0,B:10,D:10,E:2.0,moveLimit:30};
function updateThreshold(key, val){
  if(!S.thresholds) S.thresholds={...THRESHOLD_DEFAULTS};
  // If empty or invalid, revert to default
  S.thresholds[key] = (isNaN(val)||val===null||val===''||val<=0)
    ? THRESHOLD_DEFAULTS[key]
    : val;
  syncThresholdInputs();
  autoSave();
}
function resetThresholds(){
  S.thresholds={...THRESHOLD_DEFAULTS};
  syncThresholdInputs();
  autoSave();
  showAlert('Thresholds reset to defaults.','ok');
}
function syncThresholdInputs(){
  if(!S.thresholds) S.thresholds={...THRESHOLD_DEFAULTS};
  ['A','B','D','E','moveLimit'].forEach(k=>{
    const el=document.getElementById('thr-'+k);
    if(el) el.value=S.thresholds[k]??THRESHOLD_DEFAULTS[k];
  });
}

function toggleVipHard(fid){
  if(S.vipHardIds.has(fid)) S.vipHardIds.delete(fid);
  else S.vipHardIds.add(fid);
  renderFormations(); autoSave();
}

// ─── formations ────────────────────────────────────────
function addFormationCopy(){
  const last = S.formations[S.formations.length-1];
  if(!last){ addFormationBlank(); return; }
  const f = deepClone(last);
  f.id = uid();
  f.name = 'Formation '+(S.formations.length+1);
  S.formations.push(f);
  renderFormations(); autoSave();
}
function addFormationBlank(){
  const f = {id:uid(), name:'Formation '+(S.formations.length+1), vipDancerId:null, positions:[]};
  autoPlaceF(f);
  S.formations.push(f);
  renderFormations(); autoSave();
}
function autoPlaceF(f){
  const shape = document.getElementById('def-shape').value;
  const pts = genPts(S.dancers.length, shape);
  f.positions = pts.map((p,i)=>({x:p.x,y:p.y,dancerId:S.dancers[i].id,pose:'none'}));
}
function genPts(n, shape){
  const pts=[];
  if(shape==='grid'){
    const cols=Math.ceil(Math.sqrt(n*1.6)), rows=Math.ceil(n/cols); let i=0;
    for(let r=0;r<rows&&i<n;r++){
      const rc=Math.min(cols,n-i), xo=(cols-rc)*.5;
      for(let c=0;c<rc;c++){ pts.push({x:10+(c+xo)*(80/Math.max(cols-1,1)), y:15+r*(65/Math.max(rows-1,1))}); i++; }
    }
  } else if(shape==='arc'){
    for(let i=0;i<n;i++){ const a=Math.PI*(.15+.7*(i/Math.max(n-1,1))); pts.push({x:50+40*Math.cos(a),y:70-55*Math.sin(a)}); }
  } else if(shape==='diagonal'){
    const rows=Math.ceil(n/3); let i=0;
    for(let r=0;r<rows&&i<n;r++){ const rn=Math.min(3,n-i); for(let c=0;c<rn;c++){ pts.push({x:15+r*18+c*22,y:20+r*22-c*10}); i++; } }
  } else {
    for(let i=0;i<n;i++) pts.push({x:10+((i*37+13)%80),y:10+((i*53+7)%70)});
  }
  return pts;
}
function removeFormation(id){ S.formations=S.formations.filter(f=>f.id!==id); renderFormations(); autoSave(); }
function renameF(id,v){ const f=S.formations.find(x=>x.id===id); if(f){ f.name=v; autoSave(); } }
function shuffleF(id){
  const f=S.formations.find(x=>x.id===id); if(!f) return;
  const shape=document.getElementById('def-shape').value;
  const ex=new Map(f.positions.map(p=>[p.dancerId,p.pose]));
  const sh=[...S.dancers].sort(()=>Math.random()-.5);
  const pts=genPts(sh.length,shape);
  f.positions=pts.map((p,i)=>({x:p.x,y:p.y,dancerId:sh[i].id,pose:ex.get(sh[i].id)||'none'}));
  renderFormations(); autoSave();
}
function poseSummary(pos){
  const c={stand:0,floor:0,left:0,right:0};
  pos.forEach(p=>{ if(c[p.pose]!==undefined) c[p.pose]++; });
  return Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>POSE_ICON[k]+'×'+v).join(' ');
}

function moveFormationUp(id){
  const idx=S.formations.findIndex(x=>x.id===id);
  if(idx<=0) return;
  [S.formations[idx-1],S.formations[idx]]=[S.formations[idx],S.formations[idx-1]];
  renderFormations(); autoSave();
}
function moveFormationDown(id){
  const idx=S.formations.findIndex(x=>x.id===id);
  