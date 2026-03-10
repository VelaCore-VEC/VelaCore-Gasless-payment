import { useState, useEffect, useCallback } from 'react'

var CURRENCIES = [
  { code:'USD', symbol:'$',   flag:'🇺🇸', name:'US Dollar'       },
  { code:'PKR', symbol:'₨',  flag:'🇵🇰', name:'Pakistani Rupee'  },
  { code:'EUR', symbol:'€',   flag:'🇪🇺', name:'Euro'             },
  { code:'GBP', symbol:'£',   flag:'🇬🇧', name:'British Pound'    },
  { code:'AED', symbol:'د.إ', flag:'🇦🇪', name:'UAE Dirham'       },
]

// Default fallback exchange rates (USD base)
var DEFAULT_RATES = { USD:1, PKR:278, EUR:0.92, GBP:0.79, AED:3.67 }
var DEFAULT_VEC_USD = 0.01   // Set your VEC price here; override with manual mode

export default function CurrencyConverter({ onAmountSet }) {
  var [open,       setOpen]       = useState(false)
  var [currency,   setCurrency]   = useState('PKR')
  var [fiatInput,  setFiatInput]  = useState('')
  var [rates,      setRates]      = useState(DEFAULT_RATES)
  var [vecUSD,     setVecUSD]     = useState(DEFAULT_VEC_USD)
  var [manualVEC,  setManualVEC]  = useState('')
  var [priceMode,  setPriceMode]  = useState('manual')  // 'manual' recommended since VEC not listed
  var [rateStatus, setRateStatus] = useState('idle')    // idle | loading | ok | error

  var cur = CURRENCIES.find(function(c){ return c.code === currency }) || CURRENCIES[0]

  // Fetch live FX rates from CoinGecko
  var fetchRates = useCallback(async function(){
    setRateStatus('loading')
    try {
      var res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd,pkr,eur,gbp,aed', { signal: AbortSignal.timeout(5000) })
      var data = await res.json()
      if (data && data.tether) {
        setRates({
          USD: 1,
          PKR: data.tether.pkr || 278,
          EUR: data.tether.eur || 0.92,
          GBP: data.tether.gbp || 0.79,
          AED: data.tether.aed || 3.67,
        })
        setRateStatus('ok')
      } else throw new Error('bad')
    } catch(e) {
      setRates(DEFAULT_RATES)
      setRateStatus('error')
    }
  }, [])

  useEffect(function(){ if(open) fetchRates() }, [open])

  var activeVecPrice = (priceMode === 'manual' && parseFloat(manualVEC) > 0)
    ? parseFloat(manualVEC)
    : vecUSD

  var fiatNum   = parseFloat(fiatInput) || 0
  var fiatInUSD = fiatNum / (rates[currency] || 1)
  var vecResult = activeVecPrice > 0 ? fiatInUSD / activeVecPrice : 0

  function handleApply() {
    if (vecResult > 0) {
      onAmountSet(vecResult.toFixed(4))
      setOpen(false)
      setFiatInput('')
    }
  }

  // ── styles shared ──────────────────────────────────────────────────────────────
  var labelStyle = { fontSize:'11px', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 8px', display:'block' }
  var inputStyle = { width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'12px', padding:'11px 14px', fontSize:'14px', color:'#f9fafb', outline:'none', boxSizing:'border-box', fontFamily:'inherit', transition:'border-color 0.2s' }

  return (
    <div style={{ position:'relative' }}>

      {/* ── Toggle Button ── */}
      <button onClick={function(){ setOpen(function(v){ return !v }) }}
        style={{ display:'flex', alignItems:'center', gap:'7px', padding:'8px 14px', borderRadius:'12px', cursor:'pointer', border:'1px solid', fontWeight:700, fontSize:'12px', transition:'all 0.2s',
          background: open ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.1)',
          borderColor:open ? 'rgba(251,191,36,0.5)' : 'rgba(251,191,36,0.3)',
          color:'#fbbf24' }}
        onMouseEnter={function(e){ e.currentTarget.style.background='rgba(251,191,36,0.22)' }}
        onMouseLeave={function(e){ e.currentTarget.style.background=open?'rgba(251,191,36,0.2)':'rgba(251,191,36,0.1)' }}>
        <span>💱</span>
        <span>Pay in {cur.flag} {cur.code}</span>
        <span style={{ fontSize:'10px', opacity:0.7 }}>{open?'▲':'▼'}</span>
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 10px)', right:0, zIndex:100, width:'340px', maxWidth:'calc(100vw - 40px)', borderRadius:'20px', border:'1px solid rgba(251,191,36,0.25)', background:'#111827', boxShadow:'0 24px 64px rgba(0,0,0,0.7)' }}>

          {/* Header */}
          <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <p style={{ fontSize:'15px', fontWeight:800, color:'#f9fafb', margin:0 }}>💱 Currency Converter</p>
                <p style={{ fontSize:'12px', color:'#9ca3af', margin:'4px 0 0' }}>Convert fiat → VEC automatically</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                {rateStatus==='loading' && <span style={{ fontSize:'12px', color:'#fbbf24' }}>⟳ Loading...</span>}
                {rateStatus==='ok'      && <span style={{ fontSize:'12px', color:'#34d399' }}>✓ Live rates</span>}
                {rateStatus==='error'   && <span style={{ fontSize:'12px', color:'#f87171' }}>⚠ Fallback</span>}
                <button onClick={fetchRates} title="Refresh"
                  style={{ width:'28px', height:'28px', borderRadius:'8px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'#d1d5db', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
                <button onClick={function(){ setOpen(false) }}
                  style={{ width:'28px', height:'28px', borderRadius:'8px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'#d1d5db', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>
            </div>
          </div>

          <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:'16px' }}>

            {/* Currency selector */}
            <div>
              <span style={labelStyle}>Select Currency</span>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {CURRENCIES.map(function(c){
                  var sel = currency === c.code
                  return (
                    <button key={c.code} onClick={function(){ setCurrency(c.code) }}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'10px', fontSize:'13px', fontWeight:700, cursor:'pointer', border:'1px solid', transition:'all 0.15s',
                        background:   sel ? 'rgba(251,191,36,0.2)'  : 'rgba(255,255,255,0.06)',
                        borderColor:  sel ? 'rgba(251,191,36,0.5)'  : 'rgba(255,255,255,0.12)',
                        color:        sel ? '#fbbf24' : '#d1d5db' }}>
                      {c.flag} {c.code}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* VEC Price mode */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={labelStyle}>VEC Price (USD)</span>
                <div style={{ display:'flex', gap:'4px' }}>
                  {[{m:'manual',l:'Manual'},{m:'auto',l:'Default'}].map(function(opt){
                    var sel = priceMode === opt.m
                    return (
                      <button key={opt.m} onClick={function(){ setPriceMode(opt.m) }}
                        style={{ fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'8px', cursor:'pointer', border:'1px solid', transition:'all 0.15s',
                          background:  sel ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
                          borderColor: sel ? 'rgba(99,102,241,0.5)'  : 'rgba(255,255,255,0.12)',
                          color:       sel ? '#a5b4fc' : '#9ca3af' }}>
                        {opt.l}
                      </button>
                    )
                  })}
                </div>
              </div>
              {priceMode === 'manual' ? (
                <div style={{ position:'relative' }}>
                  <input type="number" placeholder="Enter VEC price in USD (e.g. 0.01)" min="0" step="0.0001"
                    value={manualVEC} onChange={function(e){ setManualVEC(e.target.value) }}
                    style={{ ...inputStyle, paddingRight:'50px' }}
                    onFocus={function(e){ e.target.style.borderColor='rgba(99,102,241,0.6)' }}
                    onBlur={function(e){  e.target.style.borderColor='rgba(255,255,255,0.15)' }} />
                  <span style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', fontSize:'12px', fontWeight:700, color:'#818cf8' }}>USD</span>
                </div>
              ) : (
                <div style={{ padding:'10px 14px', borderRadius:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize:'13px', fontWeight:700, color:'#fbbf24', margin:0 }}>1 VEC = ${activeVecPrice.toFixed(6)} USD</p>
                  <p style={{ fontSize:'11px', color:'#9ca3af', margin:'3px 0 0' }}>Using default price — set manually for accuracy</p>
                </div>
              )}
              {priceMode==='manual' && parseFloat(manualVEC)>0 && (
                <p style={{ fontSize:'12px', color:'#34d399', margin:'6px 0 0' }}>✓ 1 VEC = ${parseFloat(manualVEC).toFixed(6)} USD</p>
              )}
            </div>

            {/* Fiat Amount Input */}
            <div>
              <span style={labelStyle}>Amount in {cur.name} ({cur.code})</span>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', fontSize:'16px', fontWeight:800, color:'#e5e7eb', zIndex:1 }}>{cur.symbol}</span>
                <input type="number" placeholder="0.00" min="0"
                  value={fiatInput} onChange={function(e){ setFiatInput(e.target.value) }}
                  onWheel={function(e){ e.target.blur() }}
                  style={{ ...inputStyle, paddingLeft: cur.symbol.length > 1 ? '42px' : '34px', fontSize:'18px', fontWeight:700, borderColor:'rgba(251,191,36,0.3)' }}
                  onFocus={function(e){ e.target.style.borderColor='rgba(251,191,36,0.6)' }}
                  onBlur={function(e){  e.target.style.borderColor='rgba(251,191,36,0.3)' }} />
              </div>

              {/* Quick amount pills */}
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'10px' }}>
                {[100, 500, 1000, 5000].map(function(v){
                  return (
                    <button key={v} onClick={function(){ setFiatInput(String(v)) }}
                      style={{ fontSize:'12px', fontWeight:700, padding:'5px 12px', borderRadius:'8px', cursor:'pointer', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'#d1d5db', transition:'all 0.15s' }}
                      onMouseEnter={function(e){ e.currentTarget.style.background='rgba(99,102,241,0.2)'; e.currentTarget.style.color='#a5b4fc'; e.currentTarget.style.borderColor='rgba(99,102,241,0.4)' }}
                      onMouseLeave={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.07)'; e.currentTarget.style.color='#d1d5db'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)' }}>
                      {cur.symbol}{v.toLocaleString()}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Conversion Result */}
            {fiatNum > 0 && (
              <div style={{ borderRadius:'16px', border:'1px solid rgba(52,211,153,0.3)', background:'rgba(52,211,153,0.08)', padding:'16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
                  <div>
                    <p style={{ fontSize:'12px', color:'#9ca3af', margin:'0 0 4px' }}>You will send</p>
                    <p style={{ fontSize:'26px', fontWeight:900, color:'#34d399', margin:0, letterSpacing:'-0.5px' }}>
                      {vecResult.toFixed(4)}
                      <span style={{ fontSize:'14px', fontWeight:700, marginLeft:'6px' }}>VEC</span>
                    </p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontSize:'12px', color:'#9ca3af', margin:'0 0 4px' }}>Equivalent to</p>
                    <p style={{ fontSize:'15px', fontWeight:700, color:'#f9fafb', margin:0 }}>{cur.symbol}{fiatNum.toLocaleString()} {cur.code}</p>
                    {currency !== 'USD' && <p style={{ fontSize:'12px', color:'#6b7280', margin:'3px 0 0' }}>≈ ${fiatInUSD.toFixed(2)} USD</p>}
                  </div>
                </div>

                <button onClick={handleApply}
                  style={{ width:'100%', padding:'12px', borderRadius:'12px', fontWeight:800, fontSize:'14px', cursor:'pointer', border:'none', background:'linear-gradient(135deg,#059669,#10b981)', color:'#fff', boxShadow:'0 4px 20px rgba(16,185,129,0.35)', transition:'all 0.2s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.boxShadow='0 6px 28px rgba(16,185,129,0.55)' }}
                  onMouseLeave={function(e){ e.currentTarget.style.boxShadow='0 4px 20px rgba(16,185,129,0.35)' }}>
                  ✓ Use {vecResult.toFixed(4)} VEC in Payment
                </button>
              </div>
            )}

            <p style={{ fontSize:'11px', color:'#4b5563', margin:0, textAlign:'center' }}>
              FX rates via CoinGecko · VEC price set {priceMode==='manual'?'manually':'to default ($0.01)'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
