import { useState, useMemo } from 'react'

var TIME_FILTERS = [
  { label: '1 Day',    ms: 86400000 },
  { label: '1 Week',   ms: 604800000 },
  { label: '1 Month',  ms: 2592000000 },
  { label: 'All Time', ms: null },
]

function timeAgo(ts) {
  var d = Date.now() - ts
  var s = Math.floor(d/1000), m = Math.floor(s/60), h = Math.floor(m/60), dy = Math.floor(h/24)
  if (dy > 0) return dy + 'd ago'
  if (h  > 0) return h  + 'h ago'
  if (m  > 0) return m  + 'm ago'
  return 'Just now'
}
function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-US', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}
function short(a) { return a ? a.slice(0,6)+'...'+a.slice(-4) : '' }

function CopyBtn({ text }) {
  var [copied, setCopied] = useState(false)
  return (
    <button onClick={function(e){ e.stopPropagation(); navigator.clipboard.writeText(text).then(function(){ setCopied(true); setTimeout(function(){ setCopied(false) },1500) }) }}
      style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.12)', background: copied?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.06)', color: copied?'#4ade80':'#9ca3af', cursor:'pointer', transition:'all 0.15s', flexShrink:0 }}>
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

function TxRow({ tx, walletAddress }) {
  var [open, setOpen] = useState(false)
  var isSent     = tx.type === 'sent'     || (tx.from && walletAddress && tx.from.toLowerCase() === walletAddress.toLowerCase())
  var isReceived = tx.type === 'received' || (!isSent && tx.to && walletAddress && tx.to.toLowerCase() === walletAddress.toLowerCase())
  var typeColor  = isSent ? '#f87171' : '#4ade80'
  var typeLabel  = isSent ? 'Sent' : 'Received'
  var typeArrow  = isSent ? '↑' : '↓'
  var typeIcon   = isSent ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)'
  var typeIconB  = isSent ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'

  return (
    <div style={{ borderRadius:'14px', border:'1px solid rgba(255,255,255,0.07)', background: open?'rgba(255,255,255,0.04)':'rgba(255,255,255,0.02)', marginBottom:'8px', overflow:'hidden', transition:'all 0.15s' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px', cursor:'pointer' }} onClick={function(){ setOpen(!open) }}>
        {/* Icon */}
        <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:typeIcon, border:'1px solid '+typeIconB, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:'16px', fontWeight:900, color:typeColor }}>{typeArrow}</span>
        </div>
        {/* Main info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'7px', flexWrap:'wrap', marginBottom:'3px' }}>
            <span style={{ fontSize:'14px', fontWeight:700, color:'#f9fafb' }}>{parseFloat(tx.amount).toFixed(4)} VEC</span>
            <span style={{ fontSize:'11px', fontWeight:700, color:typeColor, background: isSent?'rgba(248,113,113,0.12)':'rgba(74,222,128,0.12)', border:'1px solid '+(isSent?'rgba(248,113,113,0.25)':'rgba(74,222,128,0.25)'), borderRadius:'20px', padding:'1px 7px' }}>{typeLabel}</span>
            <span style={{ fontSize:'11px', color:'#4ade80', background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:'20px', padding:'1px 7px' }}>⛽ Gasless</span>
          </div>
          <div style={{ fontSize:'12px', color:'#6b7280', fontFamily:'monospace' }}>
            {isSent ? 'To: '+short(tx.to) : 'From: '+short(tx.from)}
          </div>
        </div>
        {/* Right */}
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <p style={{ fontSize:'13px', fontWeight:700, color:typeColor, margin:'0 0 2px' }}>
            {isSent ? '−' : '+'}{parseFloat(isSent ? tx.amount : tx.net).toFixed(4)}
          </p>
          <p style={{ fontSize:'11px', color:'#6b7280', margin:'0 0 2px' }}>{timeAgo(tx.timestamp)}</p>
          <span style={{ fontSize:'11px', color:'#374151' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'14px 16px', background:'rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', gap:'9px' }}>
          {[
            { label:'Date',         value: fmtDate(tx.timestamp),                        copy: null },
            { label:'From',         value: short(tx.from),                               copy: tx.from },
            { label:'To',           value: short(tx.to),                                 copy: tx.to },
            { label:'Amount',       value: parseFloat(tx.amount).toFixed(6)+' VEC',      copy: null },
            { label:'Net Received', value: parseFloat(tx.net||0).toFixed(6)+' VEC',      copy: null },
            { label:'Platform Fee', value: parseFloat(tx.feeVec||0).toFixed(6)+' VEC',   copy: null },
            { label:'Gas Cost',     value: '$0.00  (Gasless)',                            copy: null },
            { label:'Tx Hash',      value: short(tx.hash),                               copy: tx.hash },
          ].map(function(row) {
            return (
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
                <span style={{ fontSize:'12px', color:'#6b7280', flexShrink:0 }}>{row.label}</span>
                <div style={{ display:'flex', alignItems:'center', gap:'7px', minWidth:0 }}>
                  <span style={{ fontSize:'12px', color:'#d1d5db', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.value}</span>
                  {row.copy && <CopyBtn text={row.copy} />}
                </div>
              </div>
            )
          })}
          {tx.hash && (
            <a href={'https://testnet.bscscan.com/tx/'+tx.hash} target="_blank" rel="noreferrer"
              style={{ marginTop:'4px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'9px', borderRadius:'10px', border:'1px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.1)', color:'#a5b4fc', fontSize:'12px', fontWeight:700, textDecoration:'none', transition:'all 0.15s' }}>
              🔍 View on BscScan ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function TransactionHistory({ transactions, walletAddress, onClose }) {
  var [tab,        setTab]        = useState('all')   // 'all' | 'sent' | 'received'
  var [timeFilter, setTimeFilter] = useState(null)     // ms or null
  var [search,     setSearch]     = useState('')

  var filtered = useMemo(function() {
    var list = (transactions || []).filter(function(tx) {
      // Tab filter
      if (tab === 'sent') {
        var isSent = tx.type === 'sent' || (tx.from && walletAddress && tx.from.toLowerCase() === walletAddress.toLowerCase())
        if (!isSent) return false
      }
      if (tab === 'received') {
        var isSent2 = tx.type === 'sent' || (tx.from && walletAddress && tx.from.toLowerCase() === walletAddress.toLowerCase())
        if (isSent2) return false
      }
      // Time filter
      if (timeFilter && Date.now() - tx.timestamp > timeFilter) return false
      // Search
      if (search) {
        var q = search.toLowerCase()
        return (tx.hash||'').toLowerCase().includes(q) ||
               (tx.from||'').toLowerCase().includes(q) ||
               (tx.to||'').toLowerCase().includes(q)
      }
      return true
    })
    return list
  }, [transactions, tab, timeFilter, search, walletAddress])

  // Stats
  var stats = useMemo(function() {
    var sent     = (transactions||[]).filter(function(t){ return t.type==='sent'||(t.from&&walletAddress&&t.from.toLowerCase()===walletAddress.toLowerCase()) })
    var received = (transactions||[]).filter(function(t){ return t.type==='received'||(!(t.type==='sent'||( t.from&&walletAddress&&t.from.toLowerCase()===walletAddress.toLowerCase()))) })
    return {
      totalSent:     sent.reduce(function(s,t){ return s+parseFloat(t.amount||0) },0).toFixed(2),
      totalReceived: received.reduce(function(s,t){ return s+parseFloat(t.net||t.amount||0) },0).toFixed(2),
      sentCount:     sent.length,
      receivedCount: received.length,
    }
  }, [transactions, walletAddress])

  // CSV export
  function exportCSV() {
    var rows = [['Date','Type','From','To','Amount','Net','Fee','Hash']]
    filtered.forEach(function(t) {
      var isSent = t.type==='sent'||(t.from&&walletAddress&&t.from.toLowerCase()===walletAddress.toLowerCase())
      rows.push([
        fmtDate(t.timestamp), isSent?'Sent':'Received',
        t.from||'', t.to||'',
        parseFloat(t.amount||0).toFixed(6),
        parseFloat(t.net||0).toFixed(6),
        parseFloat(t.feeVec||0).toFixed(6),
        t.hash||''
      ])
    })
    var csv = rows.map(function(r){ return r.join(',') }).join('\n')
    var a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'velacore_history.csv'
    a.click()
  }

  var TABS = [
    { id:'all',      label:'All',       count: (transactions||[]).length },
    { id:'sent',     label:'Sent',      count: stats.sentCount },
    { id:'received', label:'Received',  count: stats.receivedCount },
  ]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
      onClick={function(e){ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)' }} onClick={onClose} />

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'560px', maxHeight:'90vh', borderRadius:'22px', background:'#111827', border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 32px 80px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'18px 20px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
            <p style={{ fontSize:'17px', fontWeight:900, color:'#f9fafb', margin:0 }}>Transaction History</p>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={exportCSV}
                style={{ fontSize:'12px', padding:'6px 12px', borderRadius:'9px', border:'1px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.1)', color:'#a5b4fc', cursor:'pointer', fontWeight:700 }}>
                ↓ CSV
              </button>
              <button onClick={onClose}
                style={{ width:'32px', height:'32px', borderRadius:'9px', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#9ca3af', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                ✕
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
            {[
              { label:'Total Sent',     value: stats.totalSent+' VEC',     color:'#f87171', icon:'↑' },
              { label:'Total Received', value: stats.totalReceived+' VEC', color:'#4ade80', icon:'↓' },
            ].map(function(s) {
              return (
                <div key={s.label} style={{ borderRadius:'12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', padding:'12px 14px' }}>
                  <p style={{ fontSize:'11px', color:'#6b7280', margin:'0 0 4px', fontWeight:600 }}>{s.icon} {s.label}</p>
                  <p style={{ fontSize:'16px', fontWeight:900, color:s.color, margin:0, fontFamily:'monospace' }}>{s.value}</p>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
            {TABS.map(function(t) {
              return (
                <button key={t.id} onClick={function(){ setTab(t.id) }}
                  style={{ flex:1, padding:'8px', borderRadius:'10px', border:'1px solid '+(tab===t.id?'rgba(99,102,241,0.5)':'rgba(255,255,255,0.08)'), background: tab===t.id?'rgba(99,102,241,0.18)':'rgba(255,255,255,0.03)', color: tab===t.id?'#a5b4fc':'#6b7280', fontSize:'13px', fontWeight:700, cursor:'pointer', transition:'all 0.15s' }}>
                  {t.label}
                  <span style={{ marginLeft:'5px', fontSize:'11px', opacity:0.8 }}>({t.count})</span>
                </button>
              )
            })}
          </div>

          {/* Search + Time filter */}
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
            <input value={search} onChange={function(e){ setSearch(e.target.value) }}
              placeholder="Search address or hash..."
              style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', padding:'8px 12px', color:'#f9fafb', fontSize:'13px', outline:'none' }} />
            <select value={timeFilter||''} onChange={function(e){ setTimeFilter(e.target.value ? parseInt(e.target.value) : null) }}
              style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', padding:'8px 10px', color:'#9ca3af', fontSize:'12px', cursor:'pointer', outline:'none' }}>
              <option value="">All Time</option>
              {TIME_FILTERS.filter(function(f){ return f.ms }).map(function(f) {
                return <option key={f.label} value={f.ms}>{f.label}</option>
              })}
            </select>
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 20px 20px', scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.08) transparent' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#374151' }}>
              <p style={{ fontSize:'32px', marginBottom:'10px' }}>📭</p>
              <p style={{ fontSize:'14px' }}>No transactions found</p>
            </div>
          ) : (
            filtered.map(function(tx, i) {
              return <TxRow key={tx.hash||i} tx={tx} walletAddress={walletAddress} />
            })
          )}
        </div>
      </div>
    </div>
  )
}