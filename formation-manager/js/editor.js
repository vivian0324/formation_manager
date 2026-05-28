// ═══════════════════════════════════════════════════════
// EDITOR — full-screen drag-and-drop stage editor
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// EDITOR
// ═══════════════════════════════════════════════════════
let eFormId=null, ePts=[], eDrag=null, eSelected=new Set();

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
  f.positions=deepClone(ePts);
  f.vipDancerId=parseInt(document.getElementById('e-vip').value)||null;
  eClose(); renderFormations(); autoSave(); showAlert('Formation saved!','ok');
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
    const lbl=el('div','psec'); lbl.style.marginTop='8px'; lbl.textContent='On stage'; pal.appendChild(lbl);
    placed.forEach(d=>pal.appendChild(buildPalItem(d,true)));
  }
}
function buildPalItem(d,placed){
  const it=el('div','pi'+(placed?' placed':''));
  it.dataset.dancerId=d.id;
  const pos=ePts.find(p=>p.dancerId===d.id);
  const isAbs=S.absentIds.includes(d.id);
  const poseBadge=pos&&pos.pose!=='none'?'<span class="pose-pip '+POSE_CLS[pos.pose]+'" style="position:relative;top:0;right:0;width:12px;height:12px;display:inline-flex">'+POSE_ICON[pos.pose]+'</span>':'';
  it.innerHTML=av(d)+'<span style="flex:1;font-size:12px">'+esc(d.name)+'</span>'+poseBadge+(isAbs?'<span class="badge badge-abs">ABS</span>':'');
  if(!placed){
    it.draggable=true;
    it.addEventListener('dragstart',ev=>{ ev.dataTransfer.setData('text/plain',d.id); ev.dataTransfer.effectAllowed='copy'; });
    it.addEventListener('pointerdown',ev=>{ if(ev.button!==0) return; ev.preventDefault(); eStartPalDrag(ev,d); });
  }
  return it;
}

// drag state
let dragMulti=[]; // for multi-select drag: [{idx, startX, startY}]
let dragStartMouseX=0, dragStartMouseY=0;
let isDragging=false;

function eStartPalDrag(ev,d){
  eDrag={type:'pal',dancerId:d.id,d};
  showGhost(d,ev.clientX,ev.clientY);
  document.getElementById('dg-ghost').style.display='block';
  isDragging=false;
}
function eStartDrag(ev,idx,d,wrapEl){
  // If multi-selected, drag all selected
  if(eSelected.size>1 && eSelected.has(d.id)){
    const selectedIdxs=[];
    ePts.forEach((p,i)=>{ if(eSelected.has(p.dancerId)) selectedIdxs.push(i); });
    dragMulti=selectedIdxs;
  } else {
    dragMulti=[idx];
  }
  dragStartMouseX=ev.clientX; dragStartMouseY=ev.clientY;
  eDrag={type:'stage',primaryIdx:idx,d,wrapEl};
  wrapEl.classList.add('dragging');
  showGhost(d,ev.clientX,ev.clientY);
  document.getElementById('dg-ghost').style.display='block';
  isDragging=false;
}
function showGhost(d,cx,cy){
  const g=document.getElementById('dgh'),gd=document.getElementById('dgh-dot');
  gd.style.background=d.color+'30'; gd.style.border='2px solid '+d.color; gd.style.color=d.color;
  gd.textContent=ini(d.name); g.style.display='block'; g.style.left=cx+'px'; g.style.top=cy+'px';
}

function eMouseMove(ev){
  if(!eDrag) return;
  isDragging=true;
  const stage=document.getElementById('estage');
  const rect=stage.getBoundingClientRect();
  const pct=toPct(ev.clientX,ev.clientY,rect);
  if(pct){ const s=snp(pct.x,pct.y); const gh=document.getElementById('dg-ghost'); gh.style.left=s.x+'%'; gh.style.top=s.y+'%'; gh.style.display='block'; }
}
function eMouseUp(ev){
  if(!eDrag) return;
  const stage=document.getElementById('estage');
  const rect=stage.getBoundingClientRect();
  const pct=toPct(ev.clientX,ev.clientY,rect);
  if(pct){
    const s=snp(pct.x,pct.y);
    if(eDrag.type==='pal'){
      if(!ePts.find(p=>p.dancerId===eDrag.dancerId)){
        ePts.push({x:s.x,y:s.y,dancerId:eDrag.dancerId,pose:'none'});
      }
    } else if(eDrag.type==='stage'){
      // move all selected relative to primary
      const primary=ePts[eDrag.primaryIdx];
      if(primary){
        const dx=s.x-primary.x, dy=s.y-primary.y;
        dragMulti.forEach(i=>{
          if(ePts[i]){ ePts[i].x=Math.min(97,Math.max(3,ePts[i].x+dx)); ePts[i].y=Math.min(93,Math.max(3,ePts[i].y+dy)); }
        });
      }
      if(eDrag.wrapEl) eDrag.wrapEl.classList.remove('dragging');
    }
    renderEStage(); renderEPal();
  } else {
    if(eDrag.wrapEl) eDrag.wrapEl.classList.remove('dragging');
  }
  eDrag=null; dragMulti=[];
  document.getElementById('dgh').style.display='none';
  document.getElementById('dg-ghost').style.display='none';
}
function eDragOver(ev){ ev.preventDefault(); ev.dataTransfer.dropEffect='copy'; }
function eDropPal(ev){
  ev.preventDefault();
  const did=parseInt(ev.dataTransfer.getData('text/plain')); if(!did) return;
  if(ePts.find(p=>p.dancerId===did)) return;
  const stage=document.getElementById('estage');
  const rect=stage.getBoundingClientRect();
  const pct=toPct(ev.clientX,ev.clientY,rect); if(!pct) return;
  const s=snp(pct.x,pct.y);
  ePts.push({x:s.x,y:s.y,dancerId:did,pose:'none'});
  renderEStage(); renderEPal();
}
document.addEventListener('pointermove',ev=>{
  const g=document.getElementById('dgh');
  if(eDrag){ g.style.left=ev.clientX+'px'; g.style.top=ev.clientY+'px'; }
  if(eDrag&&document.getElementById('eo').classList.contains('open')){
    const stage=document.getElementById('estage');
    if(!stage) return;
    const rect=stage.getBoundingClientRect();
    const pct=toPct(ev.clientX,ev.clientY,rect);
    const gh=document.getElementById('dg-ghost');
    if(pct){ const s=snp(pct.x,pct.y); gh.style.left=s.x+'%'; gh.style.top=s.y+'%'; gh.style.display='block'; }
    else gh.style.display='none';
  }
});
document.addEventListener('pointerup',ev=>{
  if(!eDrag) return;
  const stage=document.getElementById('estage');
  if(!stage){ eDrag=null; return; }
  const rect=stage.getBoundingClientRect();
  if(ev.clientX<rect.left||ev.clientX>rect.right||ev.clientY<rect.top||ev.clientY>rect.bottom){
    if(eDrag.wrapEl) eDrag.wrapEl.classList.remove('dragging');
    eDrag=null; dragMulti=[];
    document.getElementById('dgh').style.display='none';
    document.getElementById('dg-ghost').style.display='none';
  }
});
function toPct(cx,cy,rect){
  const x=((cx-rect.left)/rect.width)*100, y=((cy-rect.top)/rect.height)*100;
  if(x<0||x>100||y<0||y>97) return null;
  return{x,y};
}
function snp(x,y){
  if(document.getElementById('snap-chk').checked){
    // Snap to nearest 2.5% — places dot centre exactly ON a gridline
    // (0, 5, 10...) or exactly HALFWAY between two gridlines (2.5, 7.5, 12.5...).
    // Either way the dot centre aligns perfectly with the grid.
    return{x:Math.round(x/2.5)*2.5, y:Math.round(y/2.5)*2.5};
  }
  // Free mode: still round to 0.1 for clean storage
  return{x:Math.round(x*10)/10, y:Math.round(y*10)/10};
}

