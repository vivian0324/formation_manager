// ═══════════════════════════════════════════════════════
// OPTIMIZER — formation optimization engine
// ═══════════════════════════════════════════════════════

];
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
function closeGap(positions, absentPos, mode, nextPositions, fid, formVipId){
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
  //   colGap = 10 units (= 2 × 5-unit grid spacing between neighbouring columns)
  const rowYs = [...new Set(positions.map(p => Math.round(p.y * 2) / 2))].sort((a,b)=>a-b);
  const rowGap = rowYs.length > 1
    ? (rowYs[rowYs.length-1] - rowYs[0]) / (rowYs.length - 1) : 10;
  const colGap = 10; // 2 × width between 2 neighbouring vertical gridlines

  // Hard-constrained VIP — cannot be moved at all
  const isFormHard = S.vipHardIds && S.vipHardIds.has(fid);
  const hardVipId  = (isFormHard && formVipId && !S.absentIds.includes(formVipId))
    ? formVipId : null;

  const audBot    = S.dir === 'bot';
  const moveLimit = Math.max(1, Math.floor(positions.length * MOVE_LIMIT_RATIO));

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
        Math.abs(q.x - mx) < THR && Math.abs(q.y - my) < THR