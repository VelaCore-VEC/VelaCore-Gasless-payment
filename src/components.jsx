// ─── FlowStep ─────────────────────────────────────────────────────────────────
export function FlowStep({ num, active, done, title, desc }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:'14px' }}>
      <div style={{
        width:'34px', height:'34px', borderRadius:'50%', display:'flex', alignItems:'center',
        justifyContent:'center', flexShrink:0, fontWeight:800, fontSize:'13px', transition:'all 0.3s',
        background: done ? '#059669' : active ? '#4f46e5' : 'rgba(255,255,255,0.08)',
        color:      done || active ? '#fff' : '#6b7280',
        border:     done ? '2px solid #059669' : active ? '2px solid #818cf8' : '2px solid rgba(255,255,255,0.12)',
        boxShadow:  active ? '0 0 18px rgba(99,102,241,0.6)' : done ? '0 0 14px rgba(5,150,105,0.5)' : 'none',
      }}>
        {done ? '✓' : num}
      </div>
      <div style={{ paddingTop:'5px' }}>
        <p style={{ fontSize:'14px', fontWeight:700, margin:'0 0 4px', transition:'color 0.3s',
          color: done ? '#34d399' : active ? '#a5b4fc' : '#e2e8f0' }}>{title}</p>
        <p style={{ fontSize:'13px', color:'#9ca3af', margin:0, lineHeight:1.6 }}>{desc}</p>
      </div>
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color }) {
  var theme = {
    cyan:    { accent:'#22d3ee', bg:'rgba(34,211,238,0.08)',  border:'rgba(34,211,238,0.2)'  },
    violet:  { accent:'#a78bfa', bg:'rgba(167,139,250,0.08)', border:'rgba(167,139,250,0.2)' },
    emerald: { accent:'#34d399', bg:'rgba(52,211,153,0.08)',  border:'rgba(52,211,153,0.2)'  },
    amber:   { accent:'#fbbf24', bg:'rgba(251,191,36,0.08)',  border:'rgba(251,191,36,0.2)'  },
  }[color] || { accent:'#818cf8', bg:'rgba(129,140,248,0.08)', border:'rgba(129,140,248,0.2)' }

  return (
    <div style={{ borderRadius:'16px', padding:'16px', background:theme.bg, border:'1px solid '+theme.border }}>
      <p style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:theme.accent, opacity:0.85, margin:'0 0 8px' }}>{label}</p>
      <p style={{ fontSize:'22px', fontWeight:900, color:theme.accent, margin:'0 0 4px', letterSpacing:'-0.5px' }}>{value}</p>
      <p style={{ fontSize:'12px', color:'#9ca3af', margin:0 }}>{sub}</p>
    </div>
  )
}

// ─── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ status }) {
  var cfg = {
    idle:       { label:'Disconnected',  color:'#6b7280', bg:'rgba(107,114,128,0.15)', dot:'#6b7280' },
    connecting: { label:'Connecting...', color:'#fbbf24', bg:'rgba(251,191,36,0.15)',  dot:'#fbbf24' },
    connected:  { label:'Connected',     color:'#34d399', bg:'rgba(52,211,153,0.15)',   dot:'#34d399' },
    signing:    { label:'Signing...',    color:'#818cf8', bg:'rgba(129,140,248,0.15)',  dot:'#818cf8' },
    sending:    { label:'Sending...',    color:'#818cf8', bg:'rgba(129,140,248,0.15)',  dot:'#818cf8' },
    success:    { label:'Success!',      color:'#34d399', bg:'rgba(52,211,153,0.15)',   dot:'#34d399' },
  }[status] || { label:'Unknown', color:'#6b7280', bg:'rgba(107,114,128,0.15)', dot:'#6b7280' }
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:'7px', padding:'5px 12px', borderRadius:'20px', background:cfg.bg }}>
      <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:cfg.dot, boxShadow:'0 0 6px '+cfg.dot, display:'inline-block' }} />
      <span style={{ fontSize:'12px', fontWeight:700, color:cfg.color }}>{cfg.label}</span>
    </div>
  )
}