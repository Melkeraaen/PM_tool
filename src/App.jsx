import { useState, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────
// STANDARDDATA
// ─────────────────────────────────────────────────────────────────
const DEFAULT_PROJECT = "Ghent City Marathon";
const DEFAULT_ACTIVITIES = [
  { id:"A", name:"Project initiation",    dur:2,  preds:[],          cost:12000, res:"Project Director", pct:100, ac:11200 },
  { id:"B", name:"City council approval", dur:8,  preds:["A"],       cost:40000, res:"Legal Officer",    pct:100, ac:42000 },
  { id:"C", name:"Police & road closure", dur:4,  preds:["B"],       cost:15000, res:"Operations",       pct:100, ac:14500 },
  { id:"D", name:"Insurance & clearance", dur:3,  preds:["A"],       cost:8000,  res:"Project Director", pct:100, ac:7800  },
  { id:"E", name:"Course route design",   dur:4,  preds:["A"],       cost:18000, res:"Operations",       pct:100, ac:16500 },
  { id:"F", name:"Course certification",  dur:6,  preds:["E"],       cost:25000, res:"Operations",       pct:100, ac:26000 },
  { id:"G", name:"Safety infrastructure", dur:3,  preds:["E","C"],   cost:22000, res:"Operations",       pct:0,   ac:0     },
  { id:"H", name:"Timing installation",   dur:2,  preds:["F","G"],   cost:15000, res:"Logistics",        pct:0,   ac:0     },
  { id:"I", name:"Registration platform", dur:6,  preds:["A"],       cost:22000, res:"IT Team",          pct:100, ac:23500 },
  { id:"J", name:"Participant campaign",  dur:4,  preds:["I"],       cost:18000, res:"Marketing",        pct:100, ac:18000 },
  { id:"K", name:"Race pack production",  dur:3,  preds:["J"],       cost:20000, res:"Logistics",        pct:67,  ac:14500 },
  { id:"L", name:"Sponsor acquisition",   dur:10, preds:["A"],       cost:55000, res:"Project Director", pct:100, ac:58000 },
  { id:"M", name:"Supplier contracts",    dur:4,  preds:["L","B"],   cost:35000, res:"Logistics",        pct:50,  ac:19000 },
  { id:"N", name:"Equipment procurement", dur:3,  preds:["M"],       cost:28000, res:"Logistics",        pct:0,   ac:0     },
  { id:"O", name:"Water station setup",   dur:1,  preds:["N","G"],   cost:8000,  res:"Logistics",        pct:0,   ac:0     },
  { id:"P", name:"Brand & website",       dur:5,  preds:["A"],       cost:15000, res:"Marketing",        pct:100, ac:13000 },
  { id:"Q", name:"Marketing campaign",    dur:8,  preds:["P"],       cost:25000, res:"Marketing",        pct:87,  ac:23000 },
  { id:"R", name:"Post-event closeout",   dur:2,  preds:["H","K","O","Q"], cost:5000, res:"Project Director", pct:0, ac:0 },
];

// ─────────────────────────────────────────────────────────────────
// CPM-MOTOR
// ─────────────────────────────────────────────────────────────────
function computeCPM(activities) {
  if (!activities.length) return { nodes:{}, duration:0, critPath:[] };
  const byId = Object.fromEntries(activities.map(a => [a.id, a]));
  const es={}, ef={}, ls={}, lf={};

  const visited = new Set(), order = [];
  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const a = byId[id];
    if (a) (a.preds||[]).forEach(p => visit(p));
    order.push(id);
  }
  activities.forEach(a => visit(a.id));

  order.forEach(id => {
    const a = byId[id]; if (!a) return;
    const vp = (a.preds||[]).filter(p => byId[p]);
    es[id] = vp.length === 0 ? 0 : Math.max(...vp.map(p => ef[p]||0));
    ef[id] = es[id] + a.dur;
  });

  const duration = activities.length ? Math.max(...activities.map(a => ef[a.id]||0)) : 0;

  [...order].reverse().forEach(id => {
    const a = byId[id]; if (!a) return;
    const succs = activities.filter(x => (x.preds||[]).includes(id));
    lf[id] = succs.length === 0 ? duration : Math.min(...succs.map(s => ls[s.id]));
    ls[id] = lf[id] - a.dur;
  });

  const nodes = {};
  activities.forEach(a => {
    const fl = Math.round((ls[a.id] - es[a.id]) * 10) / 10;
    nodes[a.id] = {
      es: es[a.id]||0, ef: ef[a.id]||0,
      ls: ls[a.id]||0, lf: lf[a.id]||0,
      float: fl, critical: Math.abs(fl) < 0.01,
    };
  });

  const critPath = order.filter(id => nodes[id]?.critical);
  return { nodes, duration, critPath };
}

// ─────────────────────────────────────────────────────────────────
// DESIGN
// ─────────────────────────────────────────────────────────────────
const C = {
  navy:"#1e3a5f", blue:"#2563eb", teal:"#0891b2",
  orange:"#ea580c", green:"#16a34a", red:"#dc2626",
  gray:"#64748b", light:"#f1f5f9", border:"#e2e8f0",
  white:"#ffffff", text:"#0f172a", muted:"#64748b",
};
const card  = { background:C.white, borderRadius:10, border:`1px solid ${C.border}`, padding:18, marginBottom:14 };
const inp   = { padding:"6px 9px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:12, fontFamily:"inherit", outline:"none", width:"100%" };
const btn   = (v="primary") => ({ padding:"7px 16px", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600,
  background: v==="primary"?C.blue : v==="danger"?C.red : v==="ghost"?C.light : C.light,
  color: v==="primary"||v==="danger" ? C.white : C.text });

// ─────────────────────────────────────────────────────────────────
// ACTIVITETER TABELL
// ─────────────────────────────────────────────────────────────────
function ActivitiesTab({ activities, setActivities, cpm }) {
  const { nodes } = cpm;

  const update = (id, field, val) =>
    setActivities(prev => prev.map(a => a.id===id ? {...a,[field]:val} : a));

  const updatePreds = (id, val) =>
    setActivities(prev => prev.map(a =>
      a.id===id ? {...a, preds: val.split(",").map(s=>s.trim()).filter(Boolean)} : a
    ));

  const del = id => setActivities(prev => prev.filter(a => a.id!==id));

  const add = () => {
    const used = new Set(activities.map(a=>a.id));
    const id = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find(l=>!used.has(l)) || `X${activities.length}`;
    setActivities(prev => [...prev, {id, name:"New activity", dur:1, preds:[], cost:10000, res:"", pct:0, ac:0}]);
  };

  const TH = ({children, center}) => (
    <th style={{padding:"8px 10px", textAlign:center?"center":"left", fontWeight:500, whiteSpace:"nowrap", background:C.navy, color:C.white}}>
      {children}
    </th>
  );

  return (
    <div style={card}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
        <span style={{fontWeight:600, fontSize:14}}>{activities.length} activities</span>
        <button style={btn("ghost")} onClick={add}>+ Add activity</button>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
          <thead>
            <tr>
              <TH>ID</TH><TH>Name</TH><TH>Duration (wks)</TH><TH>Predecessors</TH>
              <TH>Cost (€)</TH><TH>Resource</TH><TH center>ES</TH><TH center>EF</TH>
              <TH center>LS</TH><TH center>LF</TH><TH center>Float</TH><TH center>Status</TH><TH></TH>
            </tr>
          </thead>
          <tbody>
            {activities.map((act,i) => {
              const n = nodes[act.id]||{};
              const crit = n.critical;
              const row = {borderBottom:`1px solid ${C.border}`, background:i%2?"#fafafa":C.white};
              const td  = (center) => ({padding:"6px 10px", textAlign:center?"center":"left"});
              return (
                <tr key={act.id} style={row}>
                  <td style={{...td(), fontWeight:700, color:crit?C.orange:C.navy}}>{act.id}</td>
                  <td style={td()}>
                    <input value={act.name} onChange={e=>update(act.id,"name",e.target.value)} style={{...inp, minWidth:150}} />
                  </td>
                  <td style={td()}>
                    <input type="number" min={1} value={act.dur} onChange={e=>update(act.id,"dur",+e.target.value)} style={{...inp, width:55}} />
                  </td>
                  <td style={td()}>
                    <input value={(act.preds||[]).join(",")} onChange={e=>updatePreds(act.id,e.target.value)}
                      placeholder="A,B" style={{...inp, width:70}} />
                  </td>
                  <td style={td()}>
                    <input type="number" value={act.cost} onChange={e=>update(act.id,"cost",+e.target.value)} style={{...inp, width:85}} />
                  </td>
                  <td style={td()}>
                    <input value={act.res||""} onChange={e=>update(act.id,"res",e.target.value)} style={{...inp, width:110}} />
                  </td>
                  <td style={td(true)}><span style={{color:C.muted}}>{n.es??"-"}</span></td>
                  <td style={td(true)}><span style={{color:C.muted}}>{n.ef??"-"}</span></td>
                  <td style={td(true)}><span style={{color:C.muted}}>{n.ls??"-"}</span></td>
                  <td style={td(true)}><span style={{color:C.muted}}>{n.lf??"-"}</span></td>
                  <td style={td(true)}>
                    <span style={{fontWeight:600, color:n.float===0?C.orange:C.green}}>{n.float??"-"}</span>
                  </td>
                  <td style={td(true)}>
                    {crit
                      ? <span style={{background:"#fff7ed",color:C.orange,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,border:"1px solid #fdba74"}}>CRITICAL</span>
                      : <span style={{background:"#f0fdf4",color:C.green, padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600}}>OK</span>}
                  </td>
                  <td style={td()}>
                    <button style={{...btn("danger"),padding:"3px 8px",fontSize:11}} onClick={()=>del(act.id)}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// GANTT
// ─────────────────────────────────────────────────────────────────
function GanttTab({ activities, cpm }) {
  const { nodes, duration } = cpm;
  const dur = duration || 1;
  const LABEL_W = 195, ROW_H = 28, PAD_TOP = 10, PAD_BOT = 34;
  const SVG_W = Math.max(900, LABEL_W + dur * 30 + 20);
  const areaW = SVG_W - LABEL_W - 20;
  const wW = areaW / dur;
  const H = activities.length * ROW_H + PAD_TOP + PAD_BOT;

  return (
    <div style={card}>
      <div style={{fontWeight:600, fontSize:14, marginBottom:14}}>Gantt Chart — Baseline Schedule</div>
      <div style={{overflowX:"auto"}}>
        <svg width={SVG_W} height={H} style={{display:"block", fontFamily:"inherit"}}>

          {/* Row backgrounds */}
          {activities.map((_,i) => (
            <rect key={i} x={0} y={PAD_TOP+i*ROW_H} width={SVG_W} height={ROW_H} fill={i%2?"#fafafa":C.white}/>
          ))}

          {/* Grid */}
          {Array.from({length:dur+1},(_,w)=>(
            <line key={w}
              x1={LABEL_W+w*wW} y1={PAD_TOP} x2={LABEL_W+w*wW} y2={H-PAD_BOT}
              stroke={w%4===0?"#cbd5e1":"#f1f5f9"} strokeWidth={w%4===0?1:.5}/>
          ))}

          {/* Week labels */}
          {Array.from({length:Math.ceil(dur/4)+1},(_,i)=>i*4).filter(w=>w<=dur).map(w=>(
            <text key={w} x={LABEL_W+w*wW} y={H-14} fontSize={9} fill={C.muted} textAnchor="middle">W{w}</text>
          ))}

          {/* Bars */}
          {activities.map((act,i) => {
            const n = nodes[act.id]||{};
            const crit = n.critical;
            const bx = LABEL_W+(n.es||0)*wW;
            const bw = Math.max(act.dur*wW-2, 4);
            const y  = PAD_TOP+i*ROW_H;
            const by = y+5, bh = ROW_H-10;
            return (
              <g key={act.id}>
                <text x={LABEL_W-8} y={y+ROW_H/2+4} fontSize={10} fill={crit?C.orange:C.navy}
                  textAnchor="end" fontWeight={crit?700:400}>
                  {act.id}. {act.name.slice(0,24)}
                </text>
                <rect x={bx} y={by} width={bw} height={bh} fill={crit?C.orange:C.teal} rx={3} opacity={.88}/>
                {n.float>0 && (
                  <rect x={LABEL_W+(n.ef||0)*wW} y={by+bh/2-1}
                    width={Math.max(n.float*wW-2,0)} height={2} fill="#cbd5e1"/>
                )}
                {bw>26 && (
                  <text x={bx+5} y={by+bh/2+4} fontSize={8} fill={C.white} fontWeight={600}>{act.dur}w</text>
                )}
              </g>
            );
          })}

          {/* Legend */}
          {[
            {fill:C.orange, label:"Critical path", x:0},
            {fill:C.teal,   label:"Non-critical",  x:100},
          ].map(l=>(
            <g key={l.label}>
              <rect x={LABEL_W+l.x} y={H-22} width={10} height={8} fill={l.fill} rx={2}/>
              <text x={LABEL_W+l.x+14} y={H-14} fontSize={9} fill={C.muted}>{l.label}</text>
            </g>
          ))}
          <rect x={LABEL_W+210} y={H-19} width={20} height={3} fill="#cbd5e1"/>
          <text x={LABEL_W+234} y={H-14} fontSize={9} fill={C.muted}>Free float</text>
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// NETWORK
// ─────────────────────────────────────────────────────────────────
function NetworkTab({ activities, cpm }) {
  const { nodes } = cpm;
  const NW=152, NH=68, CW=190, RH=90;
  const byId = Object.fromEntries(activities.map(a=>[a.id,a]));

  const levels={};
  function getLevel(id){
    if (levels[id]!==undefined) return levels[id];
    const a=byId[id];
    if (!a||!a.preds?.length){levels[id]=0;return 0;}
    levels[id]=Math.max(...a.preds.filter(p=>byId[p]).map(p=>getLevel(p)))+1;
    return levels[id];
  }
  activities.forEach(a=>getLevel(a.id));

  const byLevel={};
  activities.forEach(a=>{const l=levels[a.id]||0;if(!byLevel[l])byLevel[l]=[];byLevel[l].push(a.id);});

  const pos={};
  Object.entries(byLevel).forEach(([lv,ids])=>{
    ids.forEach((id,i)=>{ pos[id]={x:parseInt(lv)*CW+10, y:i*RH+10}; });
  });

  const maxLv = Object.keys(byLevel).length ? Math.max(...Object.keys(byLevel).map(Number)) : 0;
  const maxInLv = Object.values(byLevel).length ? Math.max(...Object.values(byLevel).map(ids=>ids.length)) : 1;
  const W=(maxLv+1)*CW+NW+20;
  const H=maxInLv*RH+NH+20;

  const edges=[];
  activities.forEach(act=>{
    (act.preds||[]).forEach(pid=>{
      if(!pos[pid]||!pos[act.id]) return;
      const s=pos[pid], t=pos[act.id];
      const crit=nodes[act.id]?.critical && nodes[pid]?.critical;
      edges.push({x1:s.x+NW, y1:s.y+NH/2, x2:t.x, y2:t.y+NH/2, crit, key:`${pid}-${act.id}`});
    });
  });

  return (
    <div style={card}>
      <div style={{fontWeight:600, fontSize:14, marginBottom:4}}>AON Network Diagram</div>
      <div style={{fontSize:11, color:C.muted, marginBottom:12}}>
        Each node: <b>ES | ID | EF</b> (top) · Name (middle) · <b>LS | dur | LF</b> (bottom) · TF = Total Float ·{" "}
        <span style={{color:C.orange, fontWeight:600}}>Orange = critical path</span>
      </div>
      <div style={{overflowX:"auto"}}>
        <svg width={W} height={H} style={{display:"block"}}>
          <defs>
            <marker id="a"  markerWidth={7} markerHeight={7} refX={5} refY={3} orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#94a3b8"/>
            </marker>
            <marker id="ac" markerWidth={7} markerHeight={7} refX={5} refY={3} orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill={C.orange}/>
            </marker>
          </defs>

          {edges.map(e=>{
            const cx=(e.x1+e.x2)/2;
            return (
              <path key={e.key}
                d={`M${e.x1},${e.y1} C${cx},${e.y1} ${cx},${e.y2} ${e.x2},${e.y2}`}
                fill="none" stroke={e.crit?C.orange:"#cbd5e1"}
                strokeWidth={e.crit?2:1.5} markerEnd={`url(#${e.crit?"ac":"a"})`}/>
            );
          })}

          {activities.map(act=>{
            const p=pos[act.id]; if(!p) return null;
            const n=nodes[act.id]||{};
            const crit=n.critical;
            const {x,y}=p;
            const nm=act.name.length>20?act.name.slice(0,19)+"…":act.name;
            return (
              <g key={act.id}>
                <rect x={x} y={y} width={NW} height={NH} rx={6}
                  fill={crit?"#fff7ed":C.white}
                  stroke={crit?C.orange:C.border} strokeWidth={crit?2:1}/>
                <line x1={x} y1={y+19} x2={x+NW} y2={y+19} stroke={crit?C.orange:C.border} strokeWidth={.7}/>
                <text x={x+6}     y={y+14} fontSize={9}  fill={C.muted}>{n.es??""}</text>
                <text x={x+NW/2}  y={y+14} fontSize={10} fill={crit?C.orange:C.navy} fontWeight={700} textAnchor="middle">{act.id}</text>
                <text x={x+NW-6}  y={y+14} fontSize={9}  fill={C.muted} textAnchor="end">{n.ef??""}</text>
                <text x={x+NW/2}  y={y+35} fontSize={9}  fill={C.text}  fontWeight={500} textAnchor="middle">{nm}</text>
                <line x1={x} y1={y+45} x2={x+NW} y2={y+45} stroke={crit?C.orange:C.border} strokeWidth={.7}/>
                <text x={x+6}     y={y+59} fontSize={8} fill={C.muted}>{n.ls??""}</text>
                <text x={x+NW/2}  y={y+59} fontSize={8} fill={C.muted} textAnchor="middle">{act.dur}w|TF:{n.float??""}</text>
                <text x={x+NW-6}  y={y+59} fontSize={8} fill={C.muted} textAnchor="end">{n.lf??""}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EVM
// ─────────────────────────────────────────────────────────────────
function EVMTab({ activities, setActivities, cpm }) {
  const [week, setWeek] = useState(14);

  const evm = useMemo(()=>{
    const {nodes} = cpm;
    let PV=0, EV=0, AC=0;
    activities.forEach(act=>{
      const n=nodes[act.id]||{};
      const pct = n.ef<=week ? 1 : n.es>=week ? 0 : (week-n.es)/act.dur;
      PV += act.cost*pct;
      EV += act.cost*(act.pct||0)/100;
      AC += act.ac||0;
    });
    PV=Math.round(PV); EV=Math.round(EV); AC=Math.round(AC);
    const SV=EV-PV, CV=EV-AC;
    const SPI=PV>0?Math.round(EV/PV*1000)/1000:0;
    const CPI=AC>0?Math.round(EV/AC*1000)/1000:0;
    const BAC=activities.reduce((s,a)=>s+a.cost,0);
    const EAC=CPI>0?Math.round(BAC/CPI):BAC;
    const ETC=EAC-AC;
    return {PV,EV,AC,SV,CV,SPI,CPI,BAC,EAC,ETC};
  },[activities,week,cpm]);

  const fmt = n => "€"+Math.round(n).toLocaleString();
  const sc  = (v,t=1) => v>=t?C.green:v>=t*.9?"#d97706":C.red;

  const kpis=[
    {label:"Planned Value",     val:fmt(evm.PV),  color:C.blue},
    {label:"Earned Value",      val:fmt(evm.EV),  color:C.teal},
    {label:"Actual Cost",       val:fmt(evm.AC),  color:C.navy},
    {label:"Schedule Variance", val:(evm.SV>=0?"+":"")+fmt(evm.SV), color:evm.SV>=0?C.green:C.red},
    {label:"Cost Variance",     val:(evm.CV>=0?"+":"")+fmt(evm.CV), color:evm.CV>=0?C.green:C.red},
    {label:"SPI",               val:evm.SPI.toFixed(3), color:sc(evm.SPI)},
    {label:"CPI",               val:evm.CPI.toFixed(3), color:sc(evm.CPI)},
    {label:"EAC (Forecast)",    val:fmt(evm.EAC), color:evm.EAC>evm.BAC?C.red:C.green},
    {label:"Budget (BAC)",      val:fmt(evm.BAC), color:C.gray},
  ];

  const updatePct = (id,val) =>
    setActivities(prev=>prev.map(a=>a.id===id?{...a,pct:Math.min(100,Math.max(0,val))}:a));
  const updateAC = (id,val) =>
    setActivities(prev=>prev.map(a=>a.id===id?{...a,ac:+val}:a));

  return (
    <div>
      {/* Slider */}
      <div style={{...card, display:"flex", alignItems:"center", gap:16}}>
        <span style={{fontWeight:600, fontSize:13, whiteSpace:"nowrap"}}>Status week</span>
        <input type="range" min={1} max={cpm.duration||30} value={week}
          onChange={e=>setWeek(+e.target.value)} style={{flex:1}}/>
        <strong style={{fontSize:20, minWidth:40}}>W{week}</strong>
      </div>

      {/* KPIs */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(115px,1fr))", gap:10, marginBottom:14}}>
        {kpis.map(k=>(
          <div key={k.label} style={{background:C.light, borderRadius:8, padding:"11px 13px", border:`1px solid ${C.border}`}}>
            <div style={{fontSize:10, color:C.muted, marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:".04em"}}>{k.label}</div>
            <div style={{fontSize:19, fontWeight:700, color:k.color}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Progress table */}
      <div style={card}>
        <div style={{fontWeight:600, fontSize:13, marginBottom:10}}>Activity progress</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
            <thead>
              <tr style={{background:C.light}}>
                {["ID","Activity","Planned (€)","% Complete","Actual Cost (€)","EV (€)"].map(h=>(
                  <th key={h} style={{padding:"7px 10px", textAlign:"left", fontWeight:600, color:C.muted}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((act,i)=>{
                const ev=Math.round(act.cost*(act.pct||0)/100);
                const crit=cpm.nodes[act.id]?.critical;
                return (
                  <tr key={act.id} style={{borderBottom:`1px solid ${C.border}`, background:i%2?"#fafafa":C.white}}>
                    <td style={{padding:"6px 10px", fontWeight:700, color:crit?C.orange:C.navy}}>{act.id}</td>
                    <td style={{padding:"6px 10px"}}>{act.name}</td>
                    <td style={{padding:"6px 10px"}}>€{act.cost.toLocaleString()}</td>
                    <td style={{padding:"6px 10px"}}>
                      <div style={{display:"flex", alignItems:"center", gap:4}}>
                        <input type="number" min={0} max={100} value={act.pct||0}
                          onChange={e=>updatePct(act.id,+e.target.value)}
                          style={{...inp, width:55}}/>
                        <span style={{color:C.muted}}>%</span>
                      </div>
                    </td>
                    <td style={{padding:"6px 10px"}}>
                      <input type="number" min={0} value={act.ac||0}
                        onChange={e=>updateAC(act.id,e.target.value)}
                        style={{...inp, width:90}}/>
                    </td>
                    <td style={{padding:"6px 10px", fontWeight:600, color:C.teal}}>€{ev.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HOVED-APP
// ─────────────────────────────────────────────────────────────────
const TABS = [
  {id:"activities", label:"📋 Activities"},
  {id:"gantt",      label:"📊 Gantt"},
  {id:"network",    label:"🕸 Network"},
  {id:"evm",        label:"📈 EVM"},
];

export default function App() {
  const [tab,         setTab]         = useState("activities");
  const [projectName, setProjectName] = useState(DEFAULT_PROJECT);
  const [activities,  setActivities]  = useState(DEFAULT_ACTIVITIES);
  const [editingName, setEditingName] = useState(false);

  const cpm      = useMemo(()=>computeCPM(activities),[activities]);
  const bac      = activities.reduce((s,a)=>s+a.cost,0);
  const critPath = cpm.critPath||[];

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif", minHeight:"100vh", background:"#f1f5f9", color:C.text, fontSize:13}}>

      {/* Header */}
      <div style={{background:C.navy, color:C.white, padding:"13px 22px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:10, opacity:.55, letterSpacing:".1em", textTransform:"uppercase", marginBottom:2}}>
            Project Management Tool
          </div>
          {editingName ? (
            <input
              autoFocus
              value={projectName}
              onChange={e=>setProjectName(e.target.value)}
              onBlur={()=>setEditingName(false)}
              onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
              style={{...inp, background:"transparent", border:"1px solid rgba(255,255,255,.3)", color:C.white, fontSize:17, fontWeight:700, width:280}}
            />
          ) : (
            <div
              style={{fontSize:17, fontWeight:700, cursor:"pointer"}}
              title="Click to rename"
              onClick={()=>setEditingName(true)}
            >
              {projectName} <span style={{fontSize:11, opacity:.5}}>✎</span>
            </div>
          )}
        </div>
        <div style={{marginLeft:"auto", display:"flex", gap:16, fontSize:11, opacity:.85, flexWrap:"wrap"}}>
          <span>Duration: <strong style={{fontSize:13}}>{cpm.duration}w</strong></span>
          <span>Activities: <strong style={{fontSize:13}}>{activities.length}</strong></span>
          <span>Budget: <strong style={{fontSize:13}}>€{bac.toLocaleString()}</strong></span>
          <span>Critical: <strong style={{fontSize:12, color:"#fb923c"}}>{critPath.join(" → ")}</strong></span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:C.white, borderBottom:`1px solid ${C.border}`, padding:"10px 22px"}}>
        <div style={{display:"flex", gap:4, background:C.light, borderRadius:8, padding:4, width:"fit-content"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"6px 16px", borderRadius:6, border:"none", cursor:"pointer",
              fontSize:12, fontWeight:500, transition:"all .15s",
              background: tab===t.id?C.white:"transparent",
              color:       tab===t.id?C.navy:C.gray,
              boxShadow:   tab===t.id?"0 1px 3px rgba(0,0,0,.1)":"none",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{padding:"18px 22px", maxWidth:1300, margin:"0 auto"}}>
        {tab==="activities" && <ActivitiesTab activities={activities} setActivities={setActivities} cpm={cpm}/>}
        {tab==="gantt"      && <GanttTab      activities={activities} cpm={cpm}/>}
        {tab==="network"    && <NetworkTab     activities={activities} cpm={cpm}/>}
        {tab==="evm"        && <EVMTab         activities={activities} setActivities={setActivities} cpm={cpm}/>}
      </div>
    </div>
  );
}
