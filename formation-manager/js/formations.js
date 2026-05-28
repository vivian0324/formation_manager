// ═══════════════════════════════════════════════════════
// FORMATIONS — CRUD, auto-place, stage preview rendering
// ═══════════════════════════════════════════════════════

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

function renderFormations(){
  const cont = document.getElementById('f-list');
  cont.innerHTML='';
  if(!S.formations.length){
    cont.innerHTML='<div class="empty"><div class="ico">⬡</div><h3>No formations yet</h3><p>Click "+ Add" above</p></div>'; return;
  }
  S.formations.forEach((f,idx)=>{
    const card=el('div','fc');
    const vd=f.vipDancerId?S.dancers.find(d=>d.id===f.vipDancerId):null;
    // header
    const hdr=el('div','fc-hdr');
    hdr.innerHTML='<span class="fidx mono">'+String(idx+1).padStart(2,'0')+'</span>'
      +'<input type="text" value="'+esc(f.name)+'" style="background:transparent;border:none;color:var(--txt);font-size:13px;font-weight:500;padding:0;flex:1" oninput="renameF('+f.id+',this.value)">'
      +(vd?'<span class="badge badge-vip">'+esc(vd.name)+' VIP</span>':'')
      +'<button class="btn btn-sm btn-acc" onclick="openEditor('+f.id+')">✏ Edit</button>'
      +'<button class="btn btn-sm" onclick="shuffleF('+f.id+')" title="Shuffle">↻</button>'
      +'<button class="btn btn-sm btn-red" onclick="removeFormation('+f.id+')">×</button>';
    card.appendChild(hdr);
    // body
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
    if(idx<S.formations.length-1){
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

