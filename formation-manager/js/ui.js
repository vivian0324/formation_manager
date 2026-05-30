// ═══════════════════════════════════════════════════════
// UI — navigation, results, export, utilities, init
// ═══════════════════════════════════════════════════════

);
    });
  }

  // Score = DIST_W × dist_to_spot + TRANS_W × dist_from_spot_to_next_formation
  function candidateScore(p, tx, ty){
    const d = Math.hypot(p.x - tx, p.y - ty);
    let t = 0;
    if(nextPositions){
      const np = nextPositions.find(q => q.dancerId === p.dancerId);
      if(np) t = Math.hypot(tx - np.x, ty - np.y);
    }
    return DIST_W * d + TRANS_W * t;
  }

  // Moving-Distance check — applies to both primary and cascade moves.
  // FAILS (returns false) if ANY of these conditions is met:
  //   A. Candidate moves toward back of stage vertically > avgRowGap
  //   B. Candidate moves horizontally > 10 units (2 × grid spacing)
  //   C. After the move, any row closer to audience than the absent spot
  //      is no longer bilaterally symmetric (front rows must stay intact)
  //   D. Horizontal distance from absent spot to candidate's next-formation
  //      position > 10 units
  //   E. Vertical distance from absent spot to candidate's next-formation
  //      position > 2 × avgRowGap
  function passesDistCheck(p, tx, ty, pos){
    // Condition A: vertical move toward back of stage (threshold = A × avgRowGap)
    const thrA = (S.thresholds&&S.thresholds.A!=null ? S.thresholds.A : 1.0) * rowGap;
    const moveTowardBack = audBot ? (p.y - ty) : (ty - p.y);
    if(moveTowardBack > thrA) return false;

    // Condition B: horizontal move > B units
    const thrB = S.thresholds&&S.thresholds.B!=null ? S.thresholds.B : colGap;
    const moveHoriz = Math.abs(p.x - tx);
    if(moveHoriz > thrB) return false;

    // Condition C: front rows must stay symmetric after the move
    const simPos = pos.map(q => q.dancerId === p.dancerId
      ? {...q, x: tx, y: ty} : {...q}
    );
    const frontYs = [...new Set(
      simPos
        .filter(q => audBot ? q.y > ty : q.y < ty)
        .map(q => Math.round(q.y * 2) / 2)
    )];
    for(const fy of frontYs){
      const row = simPos.filter(q => Math.abs(q.y - fy) < THR);
      const symmetric = row.every(q => {
        if(Math.abs(q.x - 50) < THR) return true;
        return row.some(r => r.dancerId !== q.dancerId && Math.abs(r.x - (100 - q.x)) < THR);
      });
      if(!symmetric) return false;
    }

    // Conditions D & E: next-formation position must be close to the absent spot
    if(nextPositions){
      const np = nextPositions.find(q => q.dancerId === p.dancerId);
      if(np){
        const thrD = S.thresholds&&S.thresholds.D!=null ? S.thresholds.D : colGap;
        const thrE = (S.thresholds&&S.thresholds.E!=null ? S.thresholds.E : 2.0) * rowGap;
        // D: horizontal distance from absent spot to next-formation position
        if(Math.abs(tx - np.x) > thrD) return false;
        // E: vertical distance from absent spot to next-formation position
        if(Math.abs(ty - np.y) > thrE) return false;
      }
    }

    return true;
  }

  // Pick best candidate for filling spot (tx, ty).
  // Excludes hardVipId and excludeIds.
  // Builds score tiers (within EPS); skipFirst=true → use second tier (Method B).
  // Tiebreak: dancer furthest from audience (further back = preferred).
  function pickCandidate(pos, tx, ty, excludeIds, skipFirst){
    const scored = pos
      .filter(p => !excludeIds.has(p.dancerId) && p.dancerId !== hardVipId)
      .map(p => ({ p, score: candidateScore(p, tx, ty) }))
      .sort((a,b) => a.score - b.score);
    if(!scored.length) return null;
    const tiers = [];
    let ts = 0;
    for(let i = 1; i <= scored.length; i++){
      if(i === scored.length || scored[i].score - scored[ts].score >= EPS){
        tiers.push(scored.slice(ts, i));
        ts = i;
      }
    }
    const tierIdx = skipFirst ? 1 : 0;
    if(tierIdx >= tiers.length) return null;
    const tier = tiers[tierIdx];
    if(tier.length === 1) return tier[0].p;
    return tier.sort((a,b) =>
      distFromAudience(b.p) - distFromAudience(a.p)
    )[0].p;
  }

  // ── Core fill routine ─────────────────────────────────────────────────────
  function runFill(firstFillerId){
    const pos = positions.map(p => ({...p}));
    const moved = new Set();

    function applyMove(dancerId, tx, ty){
      const p = pos.find(q => q.dancerId === dancerId);
      if(p){ p.x = tx; p.y = ty; moved.add(dancerId); }
    }

    // Primary fill — Moving-Distance check applies
    const firstP = pos.find(q => q.dancerId === firstFillerId);
    if(!firstP || !passesDistCheck(firstP, absentPos[0].x, absentPos[0].y, pos)){
      // Candidate fails check — optimization done, no moves
      return { sym: computeSym(pos), movedCount: 0, overLimit: false, pos };
    }
    applyMove(firstFillerId, absentPos[0].x, absentPos[0].y);

    // Iterative orphan repair — Moving-Distance check applies here too
    for(let iter = 0; iter < 20; iter++){
      if(computeSym(pos) >= SYM_THR) break;
      if(moved.size > moveLimit) break;

      const orphans = findOrphans(pos);
      if(!orphans.length) break;

      const jobs = [];
      for(const o of orphans){
        const tx = 100 - o.x, ty = o.y;
        const excl = new Set([...moved, o.dancerId]);
        const candidate = pickCandidate(pos, tx, ty, excl, false);
        if(!candidate) continue;
        if(!passesDistCheck(candidate, tx, ty, pos)) continue; // fails → skip
        jobs.push({ cost: candidateScore(candidate, tx, ty), tx, ty, filler: candidate });
      }

      if(!jobs.length) break;
      jobs.sort((a,b) => a.cost - b.cost);
      const { filler, tx, ty } = jobs[0];
      applyMove(filler.dancerId, tx, ty);
    }

    return {
      sym: computeSym(pos),
      movedCount: moved.size,
      overLimit: moved.size > moveLimit,
      pos
    };
  }

  // ── Step 1: symmetry check ────────────────────────────────────────────────
  if(computeSym(positions) >= SYM_THR) return positions;

  // ── Step 2: pick primary candidate (Method A = lowest score) ─────────────
  const absRef = absentPos[0];
  const fillerA = pickCandidate(positions, absRef.x, absRef.y, new Set(), false);
  if(!fillerA) return positions;
  const resultA = runFill(fillerA.dancerId);
  let best = resultA;

  // ── Method B: if A exceeds move limit, try second-lowest scorer ──────────
  if(resultA.overLimit){
    const fillerB = pickCandidate(positions, absRef.x, absRef.y, new Set(), true);
    if(fillerB){
      const resultB = runFill(fillerB.dancerId);
      if(resultB.movedCount < resultA.movedCount ||
        (resultB.movedCount === resultA.movedCount && resultB.sym > resultA.sym)){
        best = resultB;
      }
    }
  }

  // Apply best result to positions in-place
  best.pos.forEach((p, i) => {
    positions[i].x = p.x;
    positions[i].y = p.y;
  });
  return positions;
}

// Fix left/right pose symmetry — only if a pair is clearly mismatched (gap > THR).
function fixPoseSymmetry(positions){
  const lefties=positions.filter(p=>p.pose==='left');
  const righties=positions.filter(p=>p.pose==='right');
  lefties.forEach(lp=>{
    const mx=100-lp.x, my=lp.y;
    let best=null, bestD=Infinity;
    righties.forEach(rp=>{ const d=Math.hypot(rp.x-mx,rp.y-my); if(d<bestD){bestD=d;best=rp;} });
    if(best&&bestD>14&&bestD<40){ best.x=mx; best.y=my; }
  });
  return positions;
}

function countMoves(optimized, original){
  // Count how many dancers moved compared to their position in the SAME
  // formation before optimization (not compared to a previous formation).
  // Threshold: more than 1 unit = a real move (not just floating point noise).
  let c=0;
  optimized.forEach(p=>{
    const orig=original.find(x=>x.dancerId===p.dancerId);
    if(orig && Math.hypot(p.x-orig.x, p.y-orig.y) > 1) c++;
  });
  return c;
}

// Single optimisation method: remove absent dancer, close gap with exact mirroring,
// fix pose symmetry, then place VIP if needed.
function optimizeFormation(f, prev, nextF){
  const pos=absFilter(f.positions);
  const absPts=absentPositions(f);
  // Pass next formation's positions so closeGap can penalise large transition jumps
  const nextPositions = nextF ? absFilter(nextF.positions) : null;
  closeGap(pos, absPts, 'exact', nextPositions, f.id, f.vipDancerId);
  fixPoseSymmetry(pos);
  const {positions:pos2,actualVip}=placeVips(pos,f.vipDancerId,f.id);
  // Count moves vs the ORIGINAL formation positions (not vs previous formation)
  return{id:f.id,name:f.name,vipDancerId:actualVip,positions:pos2,
    sym:computeSym(pos2),changes:countMoves(pos2, f.positions)};
}

// ─── results render ─────────────────────────────────────
function renderResults(){
  const list=document.getElementById('res-list');
  const sum=document.getElementById('res-summary');
  list.innerHTML='';
  if(!S.results.length){
    list.innerHTML='<div class="empty"><div class="ico">◎</div><h3>No results</h3><p>Run optimize first.</p></div>'; return;
  }
  const r0=S.results[0];
  const absent=S.dancers.filter(d=>S.absentIds.includes(d.id));
  const totalMoves=r0.formations.reduce((s,f)=>s+f.changes,0);
  const avgSym=r0.formations.reduce((s,f)=>s+f.sym,0)/r0.formations.length;
  sum.innerHTML='<div class="sst"><div class="val">'+r0.formations.length+'</div><div class="lbl">Formations</div></div>'
    +'<div class="sst"><div class="val">'+totalMoves+'</div><div class="lbl">Total moves</div></div>'
    +'<div class="sst"><div class="val">'+Math.round(avgSym*100)+'%</div><div class="lbl">Avg symmetry</div></div>'
    +'<div class="sst"><div class="val">'+S.dancers.filter(d=>!S.absentIds.includes(d.id)).length+'</div><div class="lbl">Active dancers</div></div>';
  if(absent.length){
    const ab=document.createElement('div'); ab.className='alert al-warn';
    ab.innerHTML='<span>⚠</span><div>Absent: <strong>'+absent.map(d=>esc(d.name)).join(', ')+'</strong>. Removed from all formations.</div>';
    list.appendChild(ab);
  }
  const m=r0;
  m.formations.forEach((r,idx)=>{
    const card=el('div','fc');
    const sc=r.changes===0?'sc-lo':r.changes<=2?'sc-mi':'sc-hi';
    const vd=r.vipDancerId?S.dancers.find(d=>d.id===r.vipDancerId):null;
    card.innerHTML='<div class="fc-hdr"><span class="fidx mono">'+String(idx+1).padStart(2,'0')+'</span>'
      +'<span style="flex:1;font-weight:500">'+esc(r.name)+'</span>'
      +(vd?'<span class="badge badge-vip">'+esc(vd.name)+' VIP</span>':'')
      +'<span class="csc '+sc+'">'+r.changes+' moves</span>'
      +'<span style="font-size:10px;color:var(--txt3);margin-left:5px">'+(r.sym>.82?'✦ sym':r.sym>.5?'◈ semi':'◇ asym')+'</span></div>';
    const body=el('div','fc-body');
    const sw=el('div','sw'); sw.innerHTML='<div class="slbl">STAGE</div>';
    sw.appendChild(makeStage({positions:r.positions,vipDancerId:r.vipDancerId},false));
    body.appendChild(sw);
    const fm=el('div','fm');
    const ps=poseSummary(r.positions);
    fm.innerHTML='<div class="mr"><span class="ml">Dancers</span><span class="mv">'+r.positions.length+'</span></div>'
      +'<div class="mr"><span class="ml">Moves</span><span class="csc '+sc+'">'+r.changes+'</span></div>'
      +'<div class="mr"><span class="ml">Symmetry</span><span class="mv">'+Math.round(r.sym*100)+'%</span></div>'
      +(vd?'<div class="mr"><span class="ml">VIP</span><span class="mv" style="color:var(--acc)">'+esc(vd.name)+'</span></div>':'')
      +(ps?'<div class="mr"><span class="ml">Poses</span><span class="mv" style="font-size:10px">'+ps+'</span></div>':'')
      +'<div class="mt8">'+r.positions.map(p=>{
        const d=S.dancers.find(x=>x.id===p.dancerId); if(!d) return'';
        return'<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;font-size:11px"><div style="width:6px;height:6px;border-radius:50%;background:'+d.color+'"></div>'+esc(d.name)+(p.pose&&p.pose!=='none'?' '+POSE_ICON[p.pose]:'')+'</div>';
      }).join('')+'</div>';
    body.appendChild(fm); card.appendChild(body); list.appendChild(card);
    if(idx<m.formations.length-1){
      const tr=el('div','trbar');
      tr.innerHTML='<div class="trline"></div><div class="trlbl">↓ transition</div><div class="trline"></div>';
      list.appendChild(tr);
    }
  });
}

// ─── navigation ─────────────────────────────────────────
function showPanel(name){
  // Switch panel visibility
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('vis'));
  document.getElementById('panel-'+name).classList.add('vis');
  document.getElementById('phase-lbl').textContent=name.charAt(0).toUpperCase()+name.slice(1);
  // Update ALL step bars so active/done always reflects current panel
  const order=['setup','formations','results'];
  const cur=order.indexOf(name);
  document.querySelectorAll('.steps').forEach(bar=>{
    const steps=bar.querySelectorAll('.step');
    steps.forEach((s,i)=>{
      s.classList.remove('active','done');
      if(i===cur) s.classList.add('active');
      else if(i<cur) s.classList.add('done');
    });
  });
}
function goFormations(){
  if(!S.formations.length&&S.dancers.length) addFormationBlank();
  showPanel('formations'); renderFormations();
}

// ─── export ─────────────────────────────────────────────
function doExport(){
  const title=document.getElementById('perf-title').value||'Formation Report';
  const data=S.results.length?S.results[0].formations:S.formations.map(f=>({...f,changes:0,sym:computeSym(f.positions)}));
  const PI=POSE_ICON, PC={stand:'#7ab8e8',floor:'#b07ae8',left:'#e8997a',right:'#7ac9a0'};
  let html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+esc(title)+'</title>'
    +'<style>body{font-family:sans-serif;background:#111;color:#eee;padding:22px}h1{font-size:20px;margin-bottom:3px}.sub{color:#888;font-size:12px;margin-bottom:18px}.card{background:#1a1a1a;border:1px solid #333;border-radius:8px;margin-bottom:10px;overflow:hidden}.ch{background:#222;padding:8px 13px;display:flex;gap:8px;align-items:center;font-size:13px;border-bottom:1px solid #333}.cb{padding:12px;display:flex;gap:12px}.stg{background:#181818;border:1px solid #333;border-radius:5px;position:relative;height:180px;flex:1}.g{position:absolute;inset:0;background-image:linear-gradient(#2a2a2a 1px,transparent 1px),linear-gradient(90deg,#2a2a2a 1px,transparent 1px),linear-gradient(rgba(180,140,80,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(180,140,80,.15) 1px,transparent 1px);background-size:5% 5%,5% 5%,25% 25%,25% 25%}.cv{position:absolute;top:0;bottom:0;left:50%;width:1px;background:#555;opacity:.4}.ch2{position:absolute;left:0;right:0;top:50%;height:1px;background:#555;opacity:.4}.dot{position:absolute;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;transform:translate(-50%,-50%);border:2px solid;font-family:monospace}.dl{position:absolute;top:calc(100%+1px);left:50%;transform:translateX(-50%);font-size:6px;color:#888;white-space:nowrap}.pi{position:absolute;top:-4px;right:-4px;width:12px;height:12px;border-radius:50%;font-size:7px;display:flex;align-items:center;justify-content:center;border:1px solid #111;font-weight:700}.aud{position:absolute;left:0;right:0;height:4px;background:#444}.aud.b{bottom:0}.aud.t{top:0}.meta{width:170px;flex-shrink:0;font-size:12px}.dr{display:flex;align-items:center;gap:4px;margin-bottom:2px}.bdg{font-size:8px;padding:1px 4px;border-radius:2px;font-weight:600;background:rgba(232,201,122,.2);color:#e8c97a;border:1px solid #b8965a}</style>'
    +'</head><body><h1>'+esc(title)+'</h1><div class="sub">Formation report &middot; '+data.length+' formations &middot; '+new Date().toLocaleDateString()+'</div>';
  data.forEach((r,idx)=>{
    const vd=r.vipDancerId?S.dancers.find(d=>d.id===r.vipDancerId):null;
    const ac=S.dir==='bot'?'b':'t';
    html+='<div class="card"><div class="ch"><strong>'+(idx+1)+'. '+esc(r.name)+'</strong>'+(vd?'<span class="bdg">'+esc(vd.name)+' VIP</span>':'')+'<span style="color:#888;font-size:11px;margin-left:auto">'+r.positions.length+' dancers</span></div><div class="cb"><div class="stg"><div class="g"></div><div class="cv"></div><div class="ch2"></div>';
    r.positions.forEach(p=>{
      const d=S.dancers.find(x=>x.id===p.dancerId); if(!d) return;
      const piH=p.pose&&p.pose!=='none'?'<div class="pi" style="background:'+(PC[p.pose]||'#555')+';color:#0f0f0f">'+PI[p.pose]+'</div>':'';
      html+='<div class="dot" style="left:'+p.x+'%;top:'+p.y+'%;background:'+d.color+'22;border-color:'+d.color+';color:'+d.color+'">'+ini(d.name)+piH+'<div class="dl">'+esc(d.name.split(' ')[0])+'</div></div>';
    });
    html+='<div class="aud '+ac+'"></div></div><div class="meta">';
    r.positions.forEach(p=>{ const d=S.dancers.find(x=>x.id===p.dancerId); if(!d) return; html+='<div class="dr"><div style="width:7px;height:7px;border-radius:50%;background:'+d.color+'"></div>'+esc(d.name)+(p.pose&&p.pose!=='none'?' '+PI[p.pose]:'')+'</div>'; });
    html+='</div></div></div>';
  });
  html+='</body></html>';
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));
  a.download=(title.replace(/\s+/g,'-')||'formations')+'.html'; a.click();
}

function resetAll(){
  if(!confirm('Reset to original formations with all dancers active? Absent selections and optimized results will be cleared. Formations and dancers are kept.')) return;
  // Keep dancers and formations exactly as-is.
  // Just clear absent, VIP hard constraints, results, and undo history.
  S.absentIds = [];
  S.vipHardIds = new Set();
  S.results = [];
  Object.keys(eUndoStack).forEach(k => delete eUndoStack[k]);
  autoSave();
  renderAll();
  showPanel('formations');
  showAlert('Reset to original — all dancers active, formations unchanged.', 'ok');
}

// ─── bulk ────────────────────────────────────────────────
function showBulk(){ document.getElementById('bulk-mb').style.display='flex'; }
function closeBulk(){ document.getElementById('bulk-mb').style.display='none'; }
function confirmBulk(){
  document.getElementById('bulk-ta').value.split('\n').map(s=>s.trim()).filter(Boolean).forEach(n=>addDancer(n));
  document.getElementById('bulk-ta').value=''; closeBulk();
}

// ─── utils ───────────────────────────────────────────────
function renderAll(){ renderSidebar(); renderFormations(); }
function el(tag,cls){ const e=document.createElement(tag); e.className=cls; return e; }
function ini(n){ return n.trim().split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function av(d){ return '<div class="av" style="background:'+d.color+'22;color:'+d.color+';border:1px solid '+d.color+'44">'+ini(d.name)+'</div>'; }
function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
let _alertT;
function showAlert(msg,type){
  const types={info:'al-info',warn:'al-warn',ok:'al-ok'};
  const e=document.createElement('div'); e.className='alert '+(types[type]||'al-info');
  e.style.cssText='position:fixed;bottom:18px;right:18px;z-index:9999;min-width:240px;max-width:360px;animation:fi .2s ease;';
  e.textContent=msg; document.body.appendChild(e);
  clearTimeout(_alertT); _alertT=setTimeout(()=>e.remove(),3200);
}
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&document.activeElement.id==='nd-name') addDancer();
  if(e.key==='Escape'&&document.getElementById('eo').classList.contains('open')) eClose();
  // Ctrl+Z (or Cmd+Z on Mac) while NOT in editor — revert last-edited formation
  if((e.ctrlKey||e.metaKey) && e.key==='z' && !document.getElementById('eo').classList.contains('open')){
    e.preventDefault();
    // Find which formation was most recently edited (top of any non-empty undo stack)
    let bestFid=null, bestLen=0;
    Object.entries(eUndoStack).forEach(([fid,stack])=>{
      if(stack.length>bestLen){ bestLen=stack.length; bestFid=parseInt(fid); }
    });
    if(bestFid) revertFormation(bestFid);
    else showAlert('Nothing to revert.','warn');
  }
});

// ─── INIT ────────────────────────────────────────────────
(function init(){
  const had=loadSaved();
  renderAll();
  if(had && S.formations.length){
    showPanel('formations');
    showAlert('Session restored — '+S.formations.length+' formation(s) loaded.','ok');
  } else {
    showPanel('setup');
  }
})();
