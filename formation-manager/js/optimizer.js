// OPTIMIZER

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

// ═══════════════════════════════════════════════════════
// SYMMETRY
// ═══════════════════════════════════════════════════════
// Symmetry = fraction of dancers that have a bilateral mirror partner
// around stage center (50,50), within thresholds.
// Mirror of (x,y) around center = (100-x, y) for horizontal symmetry.
// We also check rotational (180°) symmetry.
function computeSym(positions){
  if(!positions.length) return 0;
  const thr=1; // 1% — only near-exact mirror pairs count
  let sym=0;
  positions.forEach(p=>{
    const mx=100-p.x, my=p.y; // horizontal mirror
    const hasMirrorH=positions.some(q=>q.dancerId!==p.dancerId&&Math.abs(q.x-mx)<thr&&Math.abs(q.y-my)<thr);
    const hasCenterV=Math.abs(p.x-50)<thr; // on center line
    if(hasMirrorH||hasCenterV) sym++;
  });
  return sym/positions.length;
}
function symLbl(pos){ const s=computeSym(pos); return s>.82?'✦ High':s>.5?'◈ Med':'◇ Low'; }

// ═══════════════════════════════════════════════════════
// OPTIMIZATION ENGINE
// ═══════════════════════════════════════════════════════
function debugFormation(){
  // Print all dancer coordinates for all formations to the console,
  // plus the computeSym score after removing absent dancers.
  console.group('=== FORMATION DEBUG ===');
  S.formations.forEach((f, fi) => {
    console.group('Formation ' + (fi+1) + ': ' + f.name);
    const remaining = f.positions.filter(p => !S.absentIds.includes(p.dancerId));
    const absent    = f.positions.filter(p =>  S.absentIds.includes(p.dancerId));
    console.log('ALL positions:');
    f.positions.forEach(p => {
      const d = S.dancers.find(x => x.id === p.dancerId);
      const tag = S.absentIds.includes(p.dancerId) ? ' [ABSENT]' : '';
      console.log('  ' + (d?d.name:'?') + tag + '  x=' + p.x.toFixed(1) + '  y=' + p.y.toFixed(1));
    });
    console.log('After removal — computeSym = ' + computeSym(remaining).toFixed(3));
    absent.forEach(ap => {
      const sorted = [...remaining].sort((a,b) =>
        Math.hypot(a.x-ap.x,a.y-ap.y) - Math.hypot(b.x-ap.x,b.y-ap.y));
      console.log('Absent ' + (S.dancers.find(x=>x.id===ap.dancerId)||{name:'?'}).name +
        ' was at x=' + ap.x.toFixed(1) + ' y=' + ap.y.toFixed(1));
      console.log('2 nearest remaining:');
      sorted.slice(0,2).forEach(p => {
        const d = S.dancers.find(x=>x.id===p.dancerId);
        console.log('  ' + (d?d.name:'?') + '  x=' + p.x.toFixed(1) + '  y=' + p.y.toFixed(1) +
          '  dist=' + Math.hypot(p.x-ap.x,p.y-ap.y).toFixed(1));
      });
    });
    console.groupEnd();
  });
  console.groupEnd();
  showAlert('Debug info printed to browser console (F12)', 'info');
}

function runOptimize(){
  if(!S.absentIds.length){ showAlert('Mark at least one absent dancer first.','warn'); return; }
  const fms=[], label='Optimized — absent dancer removed, neighbours mirror to centre';
  let prev=null;
  S.formations.forEach((f,i)=>{
    const nextF = i+1 < S.formations.length ? S.formations[i+1] : null;
    const r=optimizeFormation(f, prev, nextF);
    fms.push(r); p