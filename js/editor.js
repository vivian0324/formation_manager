// EDITOR

if(idx<0||idx>=S.formations.length-1) return;
  [S.formations[idx],S.formations[idx+1]]=[S.formations[idx+1],S.formations[idx]];
  renderFormations(); autoSave();
}
function insertFormationBefore(targetId){
  const targetIdx=S.formations.findIndex(x=>x.id===targetId);
  if(targetIdx<0) return;
  const src=targetIdx>0?S.formations[targetIdx-1]:S.formations[0];
  const f=deepClone(src); f.id=uid(); f.name='Formation '+(targetIdx+1);
  S.formations.splice(targetIdx,0,f);
  renderFormations(); autoSave();
  showAlert('Inserted before formation '+(targetIdx+2),'ok');
}

function renderFormations(){
  const cont=document.getElementById('f-list');
  cont.innerHTML='';
  if(!S.formations.length){
    cont.innerHTML='<div class="empty"><div class="ico">⬡</div><h3>No formations yet</h3><p>Click "+ Add" above</p></div>'; return;
  }
  const n=S.formations.length;
  S.formations.forEach((f,idx)=>{
    const card=el('div','fc');
    const vd=f.vipDancerId?S.dancers.find(d=>d.id===f.vipDancerId):null;
    const hdr=el('div','fc-hdr');
    const isHard = S.vipHardIds.has(f.id);
    hdr.innerHTML='<span class="fidx mono">'+String(idx+1).padStart(2,'0')+'</span>'
      +'<input type="text" value="'+esc(f.name)+'" style="background:transparent;border:none;color:var(--txt);font-size:13px;font-weight:500;padding:0;flex:1" oninput="renameF('+f.id+',this.value)">'
      +(vd?'<span class="badge badge-vip">'+esc(vd.name)+' VIP</span>':'')
      +'<button class="btn btn-sm'+(isHard?' btn-acc':'')+'" onclick="toggleVipHard('+f.id+')" title="'+(isHard?'VIP frozen — click to make soft':'VIP may move — click to freeze')+'">'+(isHard?'🔒':'🔓')+'</button>'
      +'<button class="btn btn-sm" onclick="moveFormationUp('+f.id+')" title="Move up" '+(idx===0?'disabled':'')+'>↑</button>'
      +'<button class="btn btn-sm" onclick="moveFormationDown('+f.id+')" title="Move down" '+(idx===n-1?'disabled':'')+'>↓</button>'
      +'<button class="btn btn-sm" onclick="insertFormationBefore('+f.id+')" title="Insert copy before this">＋↑</button>'
      +'<button class="btn btn-sm btn-acc" onclick="openEditor('+f.id+')">✏ Edit</button>'
      +'<button class="btn btn-sm" onclick="shuffleF('+f.id+')" title="Shuffle">↻</button>'
      +'<button class="btn btn-sm" onclick="revertFormation('+f.id+')" title="Revert to previous save (Ctrl+Z)">↩</button>'
      +'<button class="btn btn-sm btn-red" onclick="removeFormation('+f.id+')">×</button>';
    card.appendChild(hdr);
    const body=el('div','fc-body');
    const sw=el('div','sw');
    sw.innerHTML='<div class="slbl">STAGE '+(S.dir==='bot'?'↑':'↓')+' AUDIENCE</div>';
    sw.appendChild(makeStage(f,false));
    body.appendChild(sw);
    const fm=el('div','fm');
    const ps=poseSummary(f.positions);
    fm.innerHTML='<div class="mr"><span class="ml">Dancers</span><span class="mv">'+f.positions.length+'</span></div>'
      +'<div class="mr"><span class="ml">Sym</span><span class="mv">'+symLbl(f.positions)+'</span></div>'
      +'<div class="mr"><span class="ml">VIP</span><span class="mv" style="color:var(--acc)">'+(vd?esc(vd.name):'—')+'</span></div>'
      +(ps?'<div class="mr"><span class="ml">Poses</span><span class="mv" style="font-size:10px">'+ps+'</span></div>':'');
    body.appendChild(fm);
    card.appendChild(body);
    cont.appendChild(card);
    if(idx<n-1){
      const tr=el('div','trbar');
      tr.innerHTML='<div class="trline"></div><div class="trlbl">↓ transition</div><div class="trline"></div>';
      cont.appendChild(tr);
    }
  });
}

// ─── stage rendering (small preview) ────────────────────
function makeStage(f, editable){
  const stage=el('div','stage ratio');
  stage.appendChild(el('div','sg'));
  stage.appendChild(el('div','scv'));
  stage.appendChild(el('div','sch'));
  const abar=el('div','saud '+(S.dir==='bot'?'bot':'top'));
  const albl=el('span','saud-lbl'); albl.textContent='AUDIENCE'; abar.appendChild(albl);
  stage.appendChild(abar);
  const vipId=f.vipDancerId;
  f.positions.forEach(pos=>{
    const d=S.dancers.find(x=>x.id===pos.dancerId); if(!d) return;
    const isAbs=S.absentIds.includes(pos.dancerId);
    const wrap=el('div','dw'+(vipId===pos.dancerId?' vip-dot':'')+(isAbs?' abs-dot':''));
    wrap.style.left=pos.x+'%'; wrap.style.top=pos.y+'%';
    const dot=el('div','dot');
    dot.style.background=d.color+'30'; dot.style.border='2px solid '+(isAbs?'#555':d.color); dot.style.color=isAbs?'#555':d.color;
    if(vipId===pos.dancerId&&!isAbs) dot.style.boxShadow='0 0 0 3px '+d.color+'30';
    dot.textContent=ini(d.name); dot.title=d.name+(isAbs?' (absent)':'');
    if(pos.pose&&pos.pose!=='none'){
      const pip=el('div','pose-pip '+POSE_CLS[pos.pose]); pip.textContent=POSE_ICON[pos.pose]; dot.appendChild(pip);
    }
    const lbl=el('div','dot-lbl'); lbl.textContent=d.name.split(' ')[0]; wrap.appendChild(dot); wrap.appendChild(lbl);
    stage.appendChild(wrap);
  });
  return stage;
}

// ═══════════════════════════════════════════════════════
// EDITOR
// ═══════════════════════════════════════════════════════
let eFormId=null, ePts=[], eDrag=null, eSelected=new Set();
// Undo history: {fid, positions, vipDancerId} snapshots saved before each editor save
const eUndoStack = {}; // keyed by formation id, stores array of snapshots

function openEditor(fid){
  const f=S.formations.find(x=>x.id===fid); if(!f) return;
  eFormId=fid; ePts=deepClone(f.positions); eSelected=new Set();
  document.getElementById('e-title').textContent='Edit: '+f.name;
  // audience bar
  const ab=document.getElementById('e-aud');
  ab.className='saud '+(S.dir==='bot'?'bot':'top');
  document.getElementById('e-dir-hint').textContent=S.dir==='bot'?'AUDIENCE BELOW — backstage above':'AUDIENCE ABOVE — backstage below';
  // vip select
  const vs=document.getElementById('e-vip');
  vs.innerHTML='<option value="">— none —</option>';
  S.dancers.forEach(d=>{ vs.innerHTML+='<option value="'+d.id+'"'+(f.vipDancerId===d.id?' selected':'')+'>'+esc(d.name)+(S.absentIds.includes(d.id)?' (absent)':'')+'</option>'; });
  eSetVip(vs.value,false);
  updatePoseUI();
  document.getElementById('eo').classList.add('open');
  renderEStage(); renderEPal();
}
function eClose(){ document.getElementById('eo').classList.remove('open'); eFormId=null; eDrag=null; eSelected=new Set(); }
function eSave(){
  const f=S.formations.find(x=>x.id===eFormId); if(!f) return;
  // Snapshot current state BEFORE overwriting (enables Ctrl+Z revert)
  if(!eUndoStack[eFormId]) eUndoStack[eFormId]=[];
  eUndoStack[eFormId].push({
    positions: deepClone(f.positions),
    vipDancerId: f.vipDancerId
  });
  // Keep at most 20 undo steps per formation
  if(eUndoStack[eFormId].length > 20) eUndoStack[eFormId].shift();
  f.positions=deepClone(ePts);
  f.vipDancerId=parseInt(document.getElementById('e-vip').value)||null;
  eClose(); renderFormations(); autoSave(); showAlert('Formation saved! (Ctrl+Z to revert)','ok');
}

function revertFormation(fid){
  const stack = eUndoStack[fid];
  if(!stack||!stack.length){ showAlert('No saved history to revert to.','warn'); return; }
  const snap = stack.pop();
  const f = S.formations.find(x=>x.id===fid); if(!f) return;
  f.positions = deepClone(snap.positions);
  f.vipDancerId = snap.vipDancerId;
  renderFormations(); autoSave();
  showAlert('Reverted to previous save'+(stack.length?' ('+stack.length+' more)':'')+'','ok');
}
function eSetVip(val,re=true){
  const d=val?S.dancers.find(x=>x.id===parseInt(val)):null;
  document.getElementById('e-vip-lbl').textContent=d?'★ VIP: '+d.name:'';
  if(re) renderEStage();
}
function eAutoPlace(){
  const shape=document.getElementById('def-shape').value;
  const ex=new Map(ePts.map(p=>[p.dancerId,p.pose]));
  const pts=genPts(S.dancers.length,shape);
  const sh=[...S.dancers].sort(()=>Math.random()-.5);
  ePts=pts.map((p,i)=>({x:p.x,y:p.y,dancerId:sh[i].id,pose:ex.get(sh[i].id)||'none'}));
  eSelected=new Set(); renderEStage(); renderEPal();
}
function eClearAll(){ ePts=[]; eSelected=new Set(); renderEStage(); renderEPal(); }

// rotate
function toggleRotMenu(){ const m=document.getElementById('rot-menu'); m.style.display=m.style.display==='none'?'block':'none'; }
document.addEventListener('click',e=>{ const m=document.getElementById('rot-menu'); if(m&&!m.contains(e.target)&&!e.target.closest('[onclick="toggleRotMenu()"]')) m.style.display='none'; });
function rotateAll(deg, dir){
  // rotate positions around stage center (50,50)
  const rad = (dir==='cw' ? deg : -deg) * Math.PI / 180;
  const cx=50, cy=50;
  ePts.forEach(p=>{
    const dx=p.x-cx, dy=p.y-cy;
    // scale y by 10/16 to account for aspect ratio, then rotate, then scale back
    const ar=16/10;
    const dxs=dx, dys=dy/ar;
    const rx=dxs*Math.cos(rad)-dys*Math.sin(rad);
    const ry=dxs*Math.sin(rad)+dys*Math.cos(rad);
    p.x=Math.min(97,Math.max(3,cx+rx));
    p.y=Math.min(93,Math.max(3,cy+ry*ar));
  });
  document.getElementById('rot-menu').style.display='none';
  renderEStage();
}

function renderEStage(){
  const stage=document.getElementById('estage');
  stage.querySelectorAll('.dw').forEach(e=>e.remove());
  const vipVal=parseInt(document.getElementById('e-vip').value)||null;
  ePts.forEach((pos,idx)=>{
    const d=S.dancers.find(x=>x.id===pos.dancerId); if(!d) return;
    const isAbs=S.absentIds.includes(pos.dancerId);
    const isSel=eSelected.has(pos.dancerId);
    const wrap=el('div','dw'+(vipVal===pos.dancerId?' vip-dot':'')+(isAbs?' abs-dot':'')+(isSel?' sel':''));
    wrap.style.left=pos.x+'%'; wrap.style.top=pos.y+'%'; wrap.dataset.idx=idx;
    const dot=el('div','dot');
    dot.style.background=d.color+'30'; dot.style.border='2px solid '+(isAbs?'#666':d.color); dot.style.color=isAbs?'#666':d.color;
    if(vipVal===pos.dancerId&&!isAbs) dot.style.boxShadow='0 0 0 3px '+d.color+'30';
    dot.textContent=ini(d.name); dot.title=d.name+(isAbs?' (absent — will be removed on optimize)':'');
    if(pos.pose&&pos.pose!=='none'){
      const pip=el('div','pose-pip '+POSE_CLS[pos.pose]); pip.textContent=POSE_ICON[pos.pose]; dot.appendChild(pip);
    }
    const lbl=el('div','dot-lbl'); lbl.textContent=d.name.split(' ')[0]+(isAbs?' (abs)':'');
    const rm=el('div','edot-rm'); rm.textContent='×';
    rm.onclick=ev=>{ev.stopPropagation(); eRemove(idx);};
    wrap.appendChild(dot); wrap.appendChild(lbl); wrap.appendChild(rm);
    // pointer events — no shift on click (use pointerdown not mousedown to avoid layout shift)
    wrap.addEventListener('pointerdown',ev=>{
      if(ev.button!==0) return;
      ev.preventDefault(); ev.stopPropagation();
      const isCtrl=ev.ctrlKey||ev.metaKey;
      if(isCtrl){ if(eSelected.has(pos.dancerId)) eSelected.delete(pos.dancerId); else eSelected.add(pos.dancerId); updatePoseUI(); renderEStage(); }
      else { if(!eSelected.has(pos.dancerId)){ eSelected=new Set([pos.dancerId]); updatePoseUI(); renderEStage(); } }
      eStartDrag(ev, idx, d, wrap);
    });
    wrap.addEventListener('contextmenu',ev=>{ev.preventDefault(); eRemove(idx);});
    stage.appendChild(wrap);
  });
}

function eRemove(idx){
  const did=ePts[idx]&&ePts[idx].dancerId;
  ePts.splice(idx,1);
  if(did) eSelected.delete(did);
  updatePoseUI(); renderEStage(); renderEPal();
}

function updatePoseUI(){
  const has=eSelected.size>0;
  ['pb-st','pb-fl','pb-le','pb-ri','pb-no'].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=!has; });
  if(has){
    const names=[...eSelected].map(id=>{ const d=S.dancers.find(x=>x.id===id); return d?d.name:'?'; });
    document.getElementById('pose-who').textContent='Selected: '+names.join(', ');
    // highlight active pose button
    const poses=[...eSelected].map(id=>{ const p=ePts.find(x=>x.dancerId===id); return p?p.pose:'none'; });
    const allSame=poses.every(p=>p===poses[0]);
    ['pb-st','pb-fl','pb-le','pb-ri','pb-no'].forEach(id=>{ const b=document.getElementById(id); if(b) b.classList.remove('btn-acc'); });
    if(allSame){
      const map={stand:'pb-st',floor:'pb-fl',left:'pb-le',right:'pb-ri',none:'pb-no'};
      const b=document.getElementById(map[poses[0]]); if(b) b.classList.add('btn-acc');
    }
  } else {
    document.getElementById('pose-who').textContent='Click dancer to select';
    ['pb-st','pb-fl','pb-le','pb-ri','pb-no'].forEach(id=>{ const b=document.getElementById(id); if(b) b.classList.remove('btn-acc'); });
  }
  const lbl=document.getElementById('e-sel-lbl');
  lbl.textContent=eSelected.size>1?eSelected.size+' selected':'';
}
function setPose(pose){
  eSelected.forEach(did=>{ const p=ePts.find(x=>x.dancerId===did); if(p) p.pose=pose; });
  updatePoseUI(); renderEStage(); renderEPal();
}

function renderEPal(){
  const pal=document.getElementById('e-pal'); pal.innerHTML='';
  const onStage=new Set(ePts.map(p=>p.dancerId));
  const avail=S.dancers.filter(d=>!onStage.has(d.id));
  const placed=S.dancers.filter(d=>onStage.has(d.id));
  if(avail.length){
    const lbl=el('div','psec'); lbl.textContent='Available — drag to stage'; pal.appendChild(lbl);
    avail.forEach(d=>pal.appendChild(buildPalItem(d,false)));
  }
  if(placed.length){
    const lbl=el('div','psec'); lbl.style.marginTop='8px'; lbl.te