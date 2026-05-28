// ═══════════════════════════════════════════════════════
// OPTIMIZER — formation optimization engine
//
// Key functions:
//   computeSym(positions)         — bilateral symmetry score (0–1)
//   closeGap(positions, absentPos) — move nearest non-orphan to fill gap
//   optimizeFormation(f, prev)    — full optimization for one formation
//   runOptimize()                 — run across all formations
// ═══════════════════════════════════════════════════════

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
  S.formations.forEach(f=>{ const r=optimizeFormation(f,prev); fms.push(r); prev=r; });
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

// Place VIP into a prominent position only if they are currently ranked poorly.
// Swaps the VIP with the best available slot. Leaves everyone else untouched.
function placeVips(positions, vipDancerId){
  const effectiveVip=resolveVip(vipDancerId);
  if(!effectiveVip) return{positions,actualVip:null};
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
function closeGap(positions, absentPos, mode){
  if(!absentPos || !absentPos.length) return positions;

  // Find orphaned dancers — those with no bilateral mirror partner (THR=1%).
  const THR = 1;
  const orphans = positions.filter(p => {
    if(Math.abs(p.x - 50) < THR) return false; // on centre line
    const mx = 100 - p.x, my = p.y;
    return !positions.some(q =>
      q.dancerId !== p.dancerId &&
      Math.abs(q.x - mx) < THR &&
      Math.abs(q.y - my) < THR
    );
  });

  if(!orphans.length) return positions; // already symmetric — nobody moves

  // Sort orphans by distance to absent dancer's position.
  const absRef = absentPos[0];
  orphans.sort((a,b) =>
    Math.hypot(a.x-absRef.x, a.y-absRef.y) -
    Math.hypot(b.x-absRef.x, b.y-absRef.y)
  );

  // Primary orphan: the one closest to the absent dancer's spot.
  const orphan = orphans[0];
  const op = positions.find(q => q.dancerId === orphan.dancerId);
  if(!op) return positions;

  // Find the nearest non-orphan dancer to the orphan.
  // This is the dancer who will move to fill the absent dancer's spot.
  const nonOrphans = positions.filter(p =>
    !orphans.some(o => o.dancerId === p.dancerId)
  );
  const nearest = [...nonOrphans].sort((a,b) =>
    Math.hypot(a.x-op.x, a.y-op.y) - Math.hypot(b.x-op.x, b.y-op.y)
  )[0];
  const np = nearest ? positions.find(q => q.dancerId === nearest.dancerId) : null;

  // Move the nearest non-orphan to the absent dancer's exact original position.
  // This restores the bilateral mirror: orphan stays, partner fills the gap.
  // e.g. Kristen gone at (40,40): Rachel moves to (40,40), wqy stays at (60,40).
  if(np){
    np.x = absRef.x;
    np.y = absRef.y;
  }

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
function optimizeFormation(f, prev){
  const pos=absFilter(f.positions);
  const absPts=absentPositions(f);
  closeGap(pos, absPts, 'exact');
  fixPoseSymmetry(pos);
  const {positions:pos2,actualVip}=placeVips(pos,f.vipDancerId);
  // Count moves vs the ORIGINAL formation positions (not vs previous formation)
  return{id:f.id,name:f.name,vipDancerId:actualVip,positions:pos2,
    sym:computeSym(pos2),changes:countMoves(pos2, f.positions)};
}

