// ═══════════════════════════════════════════════════════
// DANCERS — add/remove/toggle absent/VIP, sidebar render
// ═══════════════════════════════════════════════════════

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
    chip.onclick = ()=>{ if(isAbs) toggleAbsent(d.id); else if(isVip) toggleVip(d.id); else showDancerMenu(d.id); };
    dl.appendChild(chip);
  });
  // absent multi-select
  const al = document.getElementById('abs-list');
  al.innerHTML = '';
  S.dancers.forEach(d=>{
    const chk = S.absentIds.includes(d.id);
    const it = document.createElement('div');
    it.className = 'ms-item'+(chk?' checked':'');
    it.innerHTML = av(d)+'<span style="flex:1">'+esc(d.name)+'</span>'+(chk?'✓':'');
    it.onclick = ()=>toggleAbsent(d.id);
    al.appendChild(it);
  });
  // vip multi-select
  const vl = document.getElementById('vip-list');
  vl.innerHTML = '';
  S.dancers.forEach(d=>{
    const chk = S.vipIds.includes(d.id);
    const it = document.createElement('div');
    it.className = 'ms-item'+(chk?' checked':'');
    it.innerHTML = av(d)+'<span style="flex:1">'+esc(d.name)+'</span>'+(chk?'✓':'');
    it.onclick = ()=>toggleVip(d.id);
    vl.appendChild(it);
  });
  // vip backup
  const bsec = document.getElementById('vip-backup-section');
  const blist = document.getElementById('vip-backups');
  if(S.vipIds.length>0){
    bsec.style.display='block';
    blist.innerHTML='';
    S.vipIds.forEach(vid=>{
      const vd = S.dancers.find(d=>d.id===vid);
      if(!vd) return;
      const row = document.createElement('div');
      row.style.marginBottom='6px';
      row.innerHTML='<div style="font-size:11px;color:var(--txt2);margin-bottom:3px">Backup for <strong>'+esc(vd.name)+'</strong>:</div>';
      const backs = S.vipBackups[vid]||[];
      for(let i=0;i<3;i++){
        const sel = document.createElement('select');
        sel.style.cssText='font-size:11px;margin-bottom:3px;width:100%';
        sel.innerHTML='<option value="">— slot '+(i+1)+' —</option>';
        S.dancers.filter(d=>d.id!==vid&&!S.vipIds.includes(d.id)).forEach(d=>{
          sel.innerHTML+='<option value="'+d.id+'"'+(backs[i]===d.id?' selected':'')+'>'+esc(d.name)+'</option>';
        });
        sel.onchange=((vi,idx)=>function(){
          if(!S.vipBackups[vi]) S.vipBackups[vi]=[];
          S.vipBackups[vi][idx]=parseInt(this.value)||null;
          autoSave();
        })(vid,i);
        row.appendChild(sel);
      }
      blist.appendChild(row);
    });
  } else { bsec.style.display='none'; }
  // direction buttons
  document.getElementById('btn-bot').className='btn btn-sm f1'+(S.dir==='bot'?' btn-acc':'');
  document.getElementById('btn-top').className='btn btn-sm f1'+(S.dir==='top'?' btn-acc':'');
}
function showDancerMenu(id){
  // simple cycle: absent → vip → none
  const d = S.dancers.find(x=>x.id===id);
  if(!d) return;
  // just open a tiny modal
  const isAbs=S.absentIds.includes(id), isVip=S.vipIds.includes(id);
  if(!isAbs&&!isVip){ toggleAbsent(id); }
  else if(isAbs){ toggleAbsent(id); toggleVip(id); }
  else { toggleVip(id); }
}

function setDir(d){ S.dir=d; renderSidebar(); renderFormations(); autoSave(); }

