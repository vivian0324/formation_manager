// ═══════════════════════════════════════════════════════
// DANCERS — add/remove/toggle absent, sidebar rendering
// ═══════════════════════════════════════════════════════

ap.defShape)  document.getElementById('def-shape').value  = snap.defShape;
    return true;
  }catch(e){ return false; }
}

// ─── dancers ───────────────────────────────────────────
function addDancer(name){
  name = name || document.getElementById('nd-name').value.trim();
  if(!name) return;
  const d = {id:uid(), name, color:COLORS[S.dancers.length % COLORS.length]};
  S.dancers.push(d);
  document.getElementById('nd-name').value = '';
  // Add to all formations on the left side
  S.formations.forEach(f => {
    if(!f.positions.find(p=>p.dancerId===d.id)){
      f.positions.push({x:5, y:10 + (f.positions.length % 8)*10, dancerId:d.id, pose:'none'});
    }
  });
  renderAll(); autoSave();
}
function removeDancer(id){
  S.dancers = S.dancers.filter(x=>x.id!==id);
  S.absentIds = S.absentIds.filter(x=>x!==id);
  S.vipIds = S.vipIds.filter(x=>x!==id);
  delete S.vipBackups[id];
  Object.keys(S.vipBackups).forEach(k=>{
    S.vipBackups[k] = S.vipBackups[k].filter(x=>x!==id);
  });
  S.formations.forEach(f=>{
    f.positions = f.positions.filter(p=>p.dancerId!==id);
    if(f.vipDancerId===id) f.vipDancerId=null;
  });
  renderAll(); autoSave();
}
function toggleAbsent(id){
  const i = S.absentIds.indexOf(id);
  if(i>=0) S.absentIds.splice(i,1); else S.absentIds.push(id);
  renderSidebar(); renderFormations(); autoSave();
}
function toggleVip(id){
  const i = S.vipIds.indexOf(id);
  if(i>=0){ S.vipIds.splice(i,1); delete S.vipBackups[id]; }
  else if(S.vipIds.length<3){ S.vipIds.push(id); S.vipBackups[id]=[]; }
  else { showAlert('Max 3 VIP dancers.','warn'); return; }
  renderSidebar(); autoSave();
}

// ─── sidebar render ─────────────────────────────────────
function renderSidebar(){
  // roster
  const dl = document.getElementById('d-list');
  dl.innerHTML = '';
  document.getElementById('d-count').textContent = '('+S.dancers.length+')';
  S.dancers.forEach(d=>{
    const isAbs = S.absentIds.includes(d.id);
    const isVip = S.vipIds.includes(d.id);
    const chip = document.createElement('div');
    chip.className = 'chip click'+(isAbs?' absent':isVip?' vip':'');
    chip.innerHTML = av(d)+
      '<div style="flex:1;font-size:12px">'+esc(d.name)+'</div>'+
      (isAbs?'<span class="badge badge-abs">ABS</span>':'')+
      (isVip?'<span class="badge badge-vip">VIP</span>':'')+
      '<button class="btn btn-sm" onclick="event.stopPropagation();removeDancer('+d.id+')" style="color:var(--txt3);padding:0 4px">×</button>';
    chip.onclick = ()=>toggleAbsent(d.id);
    dl.appendChild(chip);
  });
  // vip hard button
  // direction buttons
  document.getElementById('btn-bot').className='btn btn-sm f1'+(S.dir==='bot'?' btn-acc':'');
  document.getElementById('btn-top').className='btn btn-sm f1'+(S.dir==='top'?' btn-acc':'');
}
function showDancerMenu(id){
  toggleAbsent(id);
}

function setDir(d){ S.dir=d; renderSidebar(); renderFormations(); autoSave(); }
function updateThreshold(key, val){
  if(isNaN(val)||val<=0) return;
  if(!S.thresholds) S.thresholds={A:1.0,B:10,D:10,E:2.0};
  S.thresholds[key]=val;
  autoSave();
}
function syncThresholdInputs(){
  if(!S.thresholds) S.thresholds={A:1.0,B:10,D:10,E:2.0};
  ['A','B','D','E'].forEach(k=>{
    const el=document.getElementById('thr-'+k);
    if(el) el.value=S.thresholds[k];
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
  const f=S.formations