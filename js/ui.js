// UI

prev, nextF);
    fms.push(r); prev=r;
  });
  S.results=[{label, formations:fms}];
  showPanel('results'); renderResults(); autoSave();
}

// shared helpers
function absFilter(pos){ return pos.filter(p=>!S.absentIds.includes(p.dancerId)).map(p=>deepClone(p)); }

// Resolve effective VIP: if the VIP is absent, walk through backups
function resolveVip(vipDancerId){
  if(!vipDancerId) return null;
  if(!S.absentIds.includes(vipDancerId)) return vipDancerId;
  const backs=(S.vipBackups[vipDancerId]||[]).filter(b=>b&&!S.absentIds.includes(b));
  return backs[0]||null;
}

// Prominence score — lower = more important (center + toward audience)
function importanceScore(p){
  const audBot=S.dir==='bot';
  return Math.abs(p.x-50)+(audBot?(100-p.y)*.6:p.y*.6);
}

// Place VIP into a prominent position.
// Hard mode (S.vipHard=true): VIP stays exactly where they are — no swap at all.
// Soft mode: if VIP is not in top-3 prominent spots, swap them to the best spot.
function placeVips(positions, vipDancerId, fid){
  const effectiveVip=resolveVip(vipDancerId);
  if(!effectiveVip) return{positions,actualVip:null};
  const isHard = S.vipHardIds && S.vipHardIds.has(fid);
  if(isHard) return{positions,actualVip:effectiveVip}; // frozen — no swap
  const ranked=[...positions].map((p,i)=>({i,score:importanceScore(p)})).sort((a,b)=>a.score-b.score);
  const vipIdx=positions.findIndex(p=>p.dancerId===effectiveVip);
  if(vipIdx<0) return{positions,actualVip:effectiveVip};
  const vipRank=ranked.findIndex(s=>s.i===vipIdx);
  if(vipRank<=2) return{positions,actualVip:effectiveVip}; // already prominent — leave alone
  const bestSlot=ranked[0];
  const tmp={x:positions[bestSlot.i].x,y:positions[bestSlot.i].y};
  positions[bestSlot.i].x=positions[vipIdx].x; positions[bestSlot.i].y=positions[vipIdx].y;
  positions[vipIdx].x=tmp.x; positions[vipIdx].y=tmp.y;
  return{positions,actualVip:effectiveVip};
}

// ── SYMMETRY ANALYSIS ──────────────────────────────────────────────────────
// Mirror threshold in percent-of-stage units
// Find the absent dancer's original position(s) in this formation
function absentPositions(f){
  return f.positions.filter(p=>S.absentIds.includes(p.dancerId));
}

// ── CORE: close the gap ────────────────────────────────────────────────────
// The absent dancer left a gap. We find the 2 dancers whose positions are
// CLOSEST to where the absent dancer stood, and move only those two toward
// the center so they stand side by side. Everyone else is completely frozen.
//
// This works regardless of whether the formation was symmetric before:
// we simply ask "who was nearest to Lanna?" and slide them together.
//
// mode: 'tight'  — place the 2 nearest tight at center (x=42, x=58)
//       'half'   — each nearest dancer moves 55% of the way toward absent dancer's x
//       'exact'  — nearest dancer fills absent spot; second goes to its bilateral mirror
function closeGap(positions, absentPos, mode, nextPositions, fid, formVipId, allPositions){
  if(!absentPos || !absentPos.length) return positions;

  // ── Constants ─────────────────────────────────────────────────────────────
  const THR     = 1;    // bilateral mirror threshold (% of stage width)
  const SYM_THR = 0.99; // "symmetric enough" — no action above this
  const DIST_W  = 1.0;  // weight: distance to fill spot (primary)
  const TRANS_W = 0.4;  // weight: transition to next formation (secondary)
  const EPS     = 0.5;  // score tie threshold
  const MOVE_LIMIT_RATIO = 0.30; // max 30% of active dancers may move

  // Moving-Distance thresholds:
  //   rowGap = average vertical distance between rows in this formation
  //   Computed from ALL dancers (including absent) so threshold is stable
  //   regardless of who is absent.
  //   colGap = 10 units (= 2 × 5-unit grid spacing between neighbouring columns)
  const gapSrc = allPositions || positions;
  const rowYs = [...new Set(gapSrc.map(p => Math.round(p.y * 2) / 2))].sort((a,b)=>a-b);
  const rowGap = rowYs.length > 1
    ? (rowYs[rowYs.length-1] - rowYs[0]) / (rowYs.length - 1) : 10;
  const colGap = 10; // fixed: 2 × grid spacing between neighbouring columns

  // Hard-constrained VIP — cannot be moved at all
  const isFormHard = S.vipHardIds && S.vipHardIds.has(fid);
  const hardVipId  = (isFormHard && formVipId && !S.absentIds.includes(formVipId))
    ? formVipId : null;

  const audBot    = S.dir === 'bot';
  const moveLimitPct = (S.thresholds&&S.thresholds.moveLimit!=null ? S.thresholds.moveLimit : 30) / 100;
  const moveLimit = Math.max(1, Math.floor(positions.length * moveLimitPct));

  // ── Helpers ───────────────────────────────────────────────────────────────
  function distFromAudience(p){
    return audBot ? p.y : (100 - p.y); // higher = further from audience
  }

  function computeSym(pos){
    if(!pos.length) return 0;
    let n = 0;
    pos.forEach(p => {
      if(Math.abs(p.x - 50) < THR){ n++; return; }
      const mx = 100 - p.x, my = p.y;
      if(pos.some(q => q.dancerId !== p.dancerId &&
          Math.abs(q.x - mx) < THR && Math.abs(q.y - my) < THR)) n++;
    });
    return n / pos.length;
  }

  function findOrphans(pos){
    return pos.filter(p => {
      if(Math.abs(p.x - 50) < THR) return false;
      const mx = 100 - p.x, my = p.y;
      return !pos.some(q => q.dancerId !== p.dancerId &&
        Math.abs(q.x - mx) < THR && Math.abs(q.y - my) < THR);
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
  //   A. Candidate moves toward back of stage vertically > A × avgRowGap
  //   B. Candidate moves horizontally > B units (default 10)
  //   C. Horizontal distance: absent spot → candidate's next-formation pos > C units
  //   D. Vertical distance: absent spot → candidate's next-formation pos > D × avgRowGap
  //   E. Any row in front of the CANDIDATE (excl. candidate's own row) that WAS
  //      symmetric becomes NOT symmetric after the move
  function passesDistCheck(p, tx, ty, pos){
    // Condition 1: vertical move toward back of stage
    const thrA = (S.thresholds&&S.thresholds.A!=null ? S.thresholds.A : 1.0) * rowGap;
    const moveTowardBack = audBot ? (p.y - ty) : (ty - p.y);
    if(moveTowardBack > thrA) return false;

    // Condition 2: horizontal move too large
    const thrB = S.thresholds&&S.thresholds.B!=null ? S.thresholds.B : colGap;
    if(Math.abs(p.x - tx) > thrB) return false;

    // Conditions 3 & 4: next-formation position relative to absent spot
    if(nextPositions){
      const np = nextPositions.find(q => q.dancerId === p.dancerId);
      if(np){
        const thrD = S.thresholds&&S.thresholds.D!=null ? S.thresholds.D : colGap;
        const thrE = (S.thresholds&&S.thresholds.E!=null ? S.thresholds.E : 2.0) * rowGap;
        if(Math.abs(tx - np.x) > thrD) return false; // Condition 3
        if(Math.abs(ty - np.y) > thrE) return false; // Condition 4
      }
    }

    // Condition 5: rows in front of the CANDIDATE'S current position
    // (not the absent spot), excluding the candidate's own row.
    // Fail only if such a row WAS symmetric and becomes NOT symmetric after the move.
    const simPos = pos.map(q => q.dancerId === p.dancerId
      ? {...q, x: tx, y: ty} : {...q}
    );
    function rowSym(dancers){
      return dancers.every(q => {
        if(Math.abs(q.x - 50) < THR) return true;
        return dancers.some(r => r.dancerId !== q.dancerId && Math.abs(r.x - (100 - q.x)) < THR);
      });
    }
    // "In front of candidate" = closer to audience than candidate's current y
    // Exclude the candidate's own row (Math.abs(fy - p.y) >= THR)
    const candidateFrontYs = [...new Set(
      pos
        .filter(q => (audBot ? q.y > p.y : q.y < p.y) && Math.abs(q.y - p.y) >= THR)
        .map(q => Math.round(q.y * 2) / 2)
    )];
    for(const fy of candidateFrontYs){
      const rowBefore = pos.filter(q => Math.abs(q.y - fy) < THR);
      const rowAfter  = simPos.filter(q => Math.abs(q.y - fy) < THR);
      if(rowSym(rowBefore) && !rowSym(rowAfter)) return false; // Condition 5
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

  // ── findFiller: iterate candidates in score order until one passes check ──
  // skipFirstTier=true → skip the lowest-score tier (used for Method B).
  function findFiller(pos, tx, ty, excludeIds, skipFirstTier){
    const scored = pos
      .filter(p => !excludeIds.has(p.dancerId) && p.dancerId !== hardVipId)
      .map(p => ({ p, score: candidateScore(p, tx, ty) }))
      .sort((a,b) => a.score - b.score);
    if(!scored.length) return null;

    if(skipFirstTier){
      // Build tiers and skip the first one (Method B)
      const tiers = [];
      let ts = 0;
      for(let i = 1; i <= scored.length; i++){
        if(i === scored.length || scored[i].score - scored[ts].score >= EPS){
          tiers.push(scored.slice(ts, i)); ts = i;
        }
      }
      if(tiers.length < 2) return null;
      for(const {p} of tiers.slice(1).flat()){
        if(passesDistCheck(p, tx, ty, pos)) return p;
      }
      return null;
    }

    // Method A: try each candidate lowest→highest until one passes
    for(const {p} of scored){
      if(passesDistCheck(p, tx, ty, pos)) return p;
    }
    return null;
  }

  // ── Core fill routine ─────────────────────────────────────────────────────
  function runFill(skipFirstTier){
    const pos = positions.map(p => ({...p}));
    const moved = new Set();

    function applyMove(dancerId, tx, ty){
      const p = pos.find(q => q.dancerId === dancerId);
      if(p){ p.x = tx; p.y = ty; moved.add(dancerId); }
    }

    // Primary fill: iterate through candidates until one passes dist check
    const primary = findFiller(pos, absentPos[0].x, absentPos[0].y, new Set(), skipFirstTier);
    if(!primary) return { sym: computeSym(pos), movedCount: 0, overLimit: false, pos };
    applyMove(primary.dancerId, absentPos[0].x, absentPos[0].y);

    // Iterative orphan repair: same — try candidates in score order until one passes
    for(let iter = 0; iter < 20; iter++){
      if(computeSym(pos) >= SYM_THR) break;
      if(moved.size > moveLimit) break;

      const orphans = findOrphans(pos);
      if(!orphans.length) break;

      const jobs = [];
      for(const o of orphans){
        const tx = 100 - o.x, ty = o.y;
        const excl = new Set([...moved, o.dancerId]);
        const filler = findFiller(pos, tx, ty, excl, false);
        if(filler) jobs.push({ cost: candidateScore(filler, tx, ty), tx, ty, filler });
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

  // ── Step 2: Method A — iterate candidates lowest score first ─────────────
  const absRef = absentPos[0];
  const resultA = runFill(false);
  let best = resultA;

  // ── Method B: if A exceeds move limit, skip first score tier and retry ───
  if(resultA.overLimit){
    const resultB = runFill(true);
    if(resultB.movedCount < resultA.movedCount ||
      (resultB.movedCount === resultA.movedCount && resultB.sym > resultA.sym)){
      best = resultB;
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
  closeGap(pos, absPts, 'exact', nextPositions, f.id, f.vipDancerId, f.positions);
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
