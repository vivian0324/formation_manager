// ═══════════════════════════════════════════════════════
// UI — navigation, results render, export, utilities, init
// ═══════════════════════════════════════════════════════

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
  if(!confirm('Reset everything? This cannot be undone.')) return;
  localStorage.removeItem(STORE_KEY);
  S={dancers:[],absentIds:[],vipIds:[],vipBackups:{},dir:'bot',formations:[],results:[]}; nid=1;
  renderAll(); showPanel('setup');
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
