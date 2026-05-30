// ═══════════════════════════════════════════════════════
// FORMATIONS — CRUD, auto-place, stage preview rendering
// ═══════════════════════════════════════════════════════

.find(x=>x.id===id); if(!f) return;
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
// Undo history: {fid, posit