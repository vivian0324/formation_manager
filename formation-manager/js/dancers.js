// DANCERS

cers.forEach(d=>{ if(d.id>maxId) maxId=d.id; });
    S.formations.forEach(f=>{ if(f.id>maxId) maxId=f.id; });
    nid = maxId + 1;
    if(snap.perfTitle) document.getElementById('perf-title').value = snap.perfTitle;
    if(snap.defShape)  document.getElementById('def-shape').value  = snap.defShape;
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
  if(isMobile()) setTimeout(syncMobRoster, 0);
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

// ── Choreography slots ────────────────────────────────────────────────────
function saveSlot(){
  const name=document.getElementById('slot-name').value.trim();
  if(!name){ showAlert('Enter a name first.','warn'); return; }
  const slots=loadSlots();
  const snap=JSON.parse(JSON.stringify(S,(k,v)=>v instanceof Set?[...v]:v));
  snap._savedAt=new Date().toLocaleString();
  slots[name]=snap; saveSlots(slots);
  document.getElementById('slot-name').value='';
  renderSlots(); showAlert('Saved: '+name,'ok');
}
function loadSlot(name){
  if(!confirm('Load "'+name+'"? Unsaved changes will be lost.')) return;
  const slots=loadSlots(); const snap=slots[name];
  if(!snap){ showAlert('Not found.','warn'); return; }
  S=snap; S.vipHardIds=new Set(snap.vipHardIds||[]);
  if(!S.thresholds) S.thresholds={A:1.0,B:10,D:10,E:2.0,moveLimit:30};
  autoSave(); renderAll(); syncThresholdInputs(); renderSlots();
  showPanel(S.formations.length?'formations':'setup');
  showAlert('Loaded: '+name,'ok');
}
function deleteSlot(name){
  if(!confirm('Delete "'+name+'"?')) return;
  const slots=loadSlots(); delete slots[name]; saveSlots(slots);
  renderSlots(); showAlert('Deleted: '+name,'ok');
}
function renderSlots(){
  const cont=document.getElementById('slot-list'); if(!cont) return;
  const slots=loadSlots(); const names=Object.keys(slots);
  if(!names.length){
    cont.innerHTML='<div class="tm" style="font-size:10px;color:var(--txt3)">No saved choreographies yet.</div>';
    return;
  }
  cont.innerHTML='';
  names.forEach(name=>{
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:4px;font-size:11px';
    const info=document.createElement('div'); info.style.flex='1';
    info.style.overflow='hidden';
    info.innerHTML='<div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(name)+'</div>'
      +'<div style="font-size:9px;color:var(--txt3)">'+esc(slots[name]._savedAt||'')+'</div>';
    const lb=document.createElement('button'); lb.className='btn btn-sm btn-acc'; lb.textContent='Load';
    lb.onclick=()=>loadSlot(name);
    const db=document.createElement('button'); db.classNa