import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ethers } from 'ethers'
import { VEC_TOKEN_ADDRESS, PAYMASTER_ADDRESS, RELAY_SERVER_URL, LOGO_URL, BNB_TESTNET, VEC_ABI } from './config.js'
import { signPermit, calcFee, shortAddr } from './helpers.js'
import { StatCard, FlowStep } from './components.jsx'
import TransactionHistory from './TransactionHistory.jsx'
import QRModal from './QRModal.jsx'
import ShareModal from './ShareModal.jsx'
import CurrencyConverter from './CurrencyConverter.jsx'
import { web3modal } from './walletconnect.js'

// ─── Color System ───────────────────────────────────────────────────────────────
// BG:       #0a0e1a   (deep navy)
// CARD:     #111827   (dark blue-gray)
// BORDER:   rgba(255,255,255,0.10)  visible border
// TEXT-1:   #f9fafb   headings     (white)
// TEXT-2:   #e5e7eb   body         (light gray)
// TEXT-3:   #d1d5db   secondary    (medium gray)
// TEXT-4:   #9ca3af   labels/muted (readable gray)
// TEXT-5:   #6b7280   subtle text  (minimum, sparingly)

function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Please try again.'
  var m = msg.toLowerCase()
  if (m.includes('user rejected') || m.includes('user denied'))  return 'You cancelled the MetaMask signature.'
  if (m.includes('nonce'))                                        return 'Nonce error — refresh the page and retry.'
  if (m.includes('deadline') || m.includes('expired'))           return 'Signature expired — please try again.'
  if (m.includes('cannot reach') || m.includes('failed to fetch') || m.includes('networkerror')) return 'Cannot reach relay server — make sure it is running on port 3001.'
  if (m.includes('metamask') || m.includes('provider'))          return 'MetaMask not found — please install it.'
  if (m.includes('wrong network') || m.includes('switch to bnb')) return 'Wrong network — switch to BNB Testnet.'
  // For all other errors (including server errors) — show the REAL message
  return msg
}

// ─── Toast notifications ────────────────────────────────────────────────────────
function Toast({ toasts, remove }) {
  if (!toasts.length) return null
  var MAP = {
    success: { bg:'#052e16', border:'#16a34a', icon:'✓', ic:'#4ade80' },
    error:   { bg:'#450a0a', border:'#dc2626', icon:'✕', ic:'#f87171' },
    warning: { bg:'#422006', border:'#d97706', icon:'⚠', ic:'#fbbf24' },
    info:    { bg:'#0c1a3a', border:'#4f46e5', icon:'ℹ', ic:'#818cf8' },
  }
  return (
    <div style={{ position:'fixed', top:'16px', right:'16px', zIndex:500, display:'flex', flexDirection:'column', gap:'10px', pointerEvents:'none', width:'360px', maxWidth:'calc(100vw - 32px)' }}>
      {toasts.map(function(t) {
        var c = MAP[t.type] || MAP.info
        return (
          <div key={t.id} style={{ pointerEvents:'auto', display:'flex', alignItems:'flex-start', gap:'12px', padding:'14px 16px', borderRadius:'16px', background:c.bg, border:'1px solid '+c.border+'88', boxShadow:'0 8px 32px rgba(0,0,0,0.6)', animation:'toastIn 0.28s ease-out' }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:800, fontSize:'14px', color:c.ic, background:c.ic+'22', border:'1px solid '+c.ic+'44' }}>{c.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontWeight:700, fontSize:'14px', color:'#f9fafb', margin:'0 0 3px', lineHeight:1.3 }}>{t.title}</p>
              {t.desc && <p style={{ fontSize:'13px', color:'#d1d5db', margin:0, lineHeight:1.5 }}>{t.desc}</p>}
            </div>
            <button onClick={function(){ remove(t.id) }} style={{ color:'#9ca3af', fontSize:'20px', background:'none', border:'none', cursor:'pointer', flexShrink:0, lineHeight:1, padding:0 }}>×</button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Copy button ────────────────────────────────────────────────────────────────
function CopyBtn({ text, label }) {
  var [ok, setOk] = useState(false)
  function go(e) {
    e && e.stopPropagation()
    navigator.clipboard.writeText(text).then(function() { setOk(true); setTimeout(function() { setOk(false) }, 1800) })
  }
  return (
    <button onClick={go} style={{ fontSize:'12px', padding:'5px 12px', borderRadius:'8px', fontWeight:700, cursor:'pointer', border:'1px solid', transition:'all 0.15s',
      background:  ok ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)',
      color:       ok ? '#4ade80' : '#d1d5db',
      borderColor: ok ? 'rgba(74,222,128,0.4)'  : 'rgba(255,255,255,0.14)' }}>
      {ok ? '✓ Copied' : (label || 'Copy')}
    </button>
  )
}

// ─── Confetti ───────────────────────────────────────────────────────────────────
var CONFETTI_COLORS = ['#4ade80','#818cf8','#fbbf24','#34d399','#f472b6','#60a5fa','#a78bfa','#fb923c']
function Confetti({ active }) {
  var pieces = useRef(
    Array.from({length: 72}, function(_, i) {
      return {
        id: i,
        x:  Math.random() * 100,
        delay: Math.random() * 0.9,
        dur:   1.8 + Math.random() * 1.2,
        size:  6 + Math.floor(Math.random() * 8),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
        drift:  (Math.random() - 0.5) * 120,
        shape:  Math.random() > 0.5 ? 'circle' : 'rect',
      }
    })
  ).current
  if (!active) return null
  return (
    <div style={{ position:'fixed', inset:0, zIndex:999, pointerEvents:'none', overflow:'hidden' }}>
      {pieces.map(function(p) {
        return (
          <div key={p.id} style={{
            position:'absolute',
            left: p.x + '%',
            top: '-20px',
            width:  p.shape==='circle' ? p.size+'px' : (p.size-2)+'px',
            height: p.shape==='circle' ? p.size+'px' : (p.size+4)+'px',
            borderRadius: p.shape==='circle' ? '50%' : '2px',
            background: p.color,
            boxShadow: '0 0 6px '+p.color+'88',
            animation: 'confettiFall '+p.dur+'s ease-in '+p.delay+'s both',
            '--drift': p.drift+'px',
            '--rot':   p.rotate+'deg',
          }} />
        )
      })}
    </div>
  )
}

// ─── Wallet Icon SVG ──────────────────────────────────────────────────────────
function WalletIcon({ size }) {
  var s = size || 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="3"/>
      <path d="M16 12h2"/>
      <path d="M2 10h20"/>
    </svg>
  )
}

// ─── Wallet Selector Modal ──────────────────────────────────────────────────────
// Shows popular wallets + WalletConnect QR option
function WalletSelectorModal({ onClose, onSelect, status }) {
  var wallets = [
    { id:'metamask',   name:'MetaMask',        icon:'🦊', desc:'Browser extension & mobile', popular:true },
    { id:'trust',      name:'Trust Wallet',    icon:'🛡️', desc:'Mobile & desktop',           popular:true },
    { id:'coinbase',   name:'Coinbase Wallet', icon:'🔵', desc:'Easy crypto wallet',         popular:false },
    { id:'walletconnect', name:'WalletConnect', icon:'🔗', desc:'Scan QR with any wallet',   popular:false },
    { id:'rainbow',    name:'Rainbow',         icon:'🌈', desc:'Ethereum wallet',            popular:false },
    { id:'other',      name:'Other Wallets',   icon:'➕', desc:'Browse 300+ wallets',       popular:false },
  ]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
      onClick={function(e){ if(e.target===e.currentTarget) onClose() }}>
      {/* Backdrop */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)' }} onClick={onClose} />

      {/* Modal */}
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'420px', borderRadius:'24px', background:'#111827', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 32px 80px rgba(0,0,0,0.7)', overflow:'hidden', animation:'receiptIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* Header */}
        <div style={{ padding:'22px 24px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:'18px', fontWeight:900, color:'#f9fafb', margin:0 }}>Connect Wallet</p>
            <p style={{ fontSize:'13px', color:'#9ca3af', margin:'4px 0 0' }}>Choose your preferred wallet</p>
          </div>
          <button onClick={onClose} style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', color:'#9ca3af', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        {/* Wallet list */}
        <div style={{ padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:'8px' }}>
          {wallets.map(function(w) {
            return (
              <button key={w.id} onClick={function(){ onSelect(w.id) }}
                style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 16px', borderRadius:'16px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', cursor:'pointer', transition:'all 0.18s', textAlign:'left', width:'100%' }}
                onMouseEnter={function(e){ e.currentTarget.style.background='rgba(99,102,241,0.12)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.35)'; e.currentTarget.style.transform='translateX(3px)' }}
                onMouseLeave={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.09)'; e.currentTarget.style.transform='none' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'14px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>
                  {w.icon}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <p style={{ fontSize:'15px', fontWeight:700, color:'#f9fafb', margin:0 }}>{w.name}</p>
                    {w.popular && <span style={{ fontSize:'10px', fontWeight:800, color:'#818cf8', background:'rgba(99,102,241,0.18)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'20px', padding:'2px 8px', letterSpacing:'0.05em' }}>POPULAR</span>}
                  </div>
                  <p style={{ fontSize:'12px', color:'#6b7280', margin:'3px 0 0' }}>{w.desc}</p>
                </div>
                <span style={{ fontSize:'18px', color:'#374151', flexShrink:0 }}>›</span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:'0 20px 20px', textAlign:'center' }}>
          <p style={{ fontSize:'12px', color:'#374151', margin:0, lineHeight:1.6 }}>
            By connecting you agree to our{' '}
            <span style={{ color:'#818cf8', cursor:'pointer' }}>Terms of Service</span>
            {' '}and{' '}
            <span style={{ color:'#818cf8', cursor:'pointer' }}>Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Relay status dot ───────────────────────────────────────────────────────────
function RelayDot({ online }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'7px', padding:'7px 14px', borderRadius:'20px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)' }}>
      <span style={{ width:'8px', height:'8px', borderRadius:'50%', flexShrink:0, display:'inline-block',
        background:  online===true?'#4ade80':online===false?'#f87171':'#fbbf24',
        boxShadow:   online===true?'0 0 8px #4ade80,0 0 16px #4ade8066':online===false?'0 0 8px #f87171':'none',
        animation:   online===null?'pulseAnim 1.4s infinite':'none' }} />
      <span style={{ fontSize:'12px', fontWeight:700, color: online===true?'#4ade80':online===false?'#f87171':'#fbbf24' }}>
        {online===true?'Relay Online':online===false?'Relay Offline':'Checking...'}
      </span>
    </div>
  )
}

// ─── Recent Activity ────────────────────────────────────────────────────────────
function RecentActivity({ history, onViewAll }) {
  if (!history || history.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'32px 0' }}>
        <div style={{ width:'52px', height:'52px', borderRadius:'16px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', margin:'0 auto 14px' }}>📭</div>
        <p style={{ color:'#d1d5db', fontSize:'14px', fontWeight:600, margin:'0 0 5px' }}>No transactions yet</p>
        <p style={{ color:'#9ca3af', fontSize:'13px', margin:0 }}>Your activity will appear here</p>
      </div>
    )
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
      {history.slice(0, 4).map(function(tx) {
        var d = new Date(tx.timestamp)
        var timeStr = d.toLocaleDateString('en-US',{month:'short',day:'2-digit'})+' · '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})
        return (
          <a key={tx.hash} href={'https://testnet.bscscan.com/tx/'+tx.hash} target="_blank" rel="noreferrer"
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:'14px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', textDecoration:'none', transition:'all 0.2s' }}
            onMouseEnter={function(e){ e.currentTarget.style.background='rgba(99,102,241,0.12)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.35)' }}
            onMouseLeave={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.09)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', minWidth:0 }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(52,211,153,0.15)', border:'1px solid rgba(52,211,153,0.3)' }}>
                <span style={{ fontSize:'16px', fontWeight:800, color:'#34d399' }}>↑</span>
              </div>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:'14px', fontWeight:700, color:'#f9fafb', margin:'0 0 3px' }}>{parseFloat(tx.amount).toFixed(2)} VEC</p>
                <p style={{ fontSize:'12px', fontFamily:'monospace', color:'#9ca3af', margin:0 }}>→ {tx.to.slice(0,8)}...{tx.to.slice(-4)}</p>
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0, marginLeft:'10px' }}>
              <p style={{ fontSize:'13px', fontWeight:700, color:'#4ade80', margin:'0 0 3px' }}>$0 gas</p>
              <p style={{ fontSize:'11px', color:'#9ca3af', margin:0, whiteSpace:'nowrap' }}>{timeStr}</p>
            </div>
          </a>
        )
      })}
      {history.length > 4 && (
        <button onClick={onViewAll} style={{ fontSize:'13px', fontWeight:700, color:'#818cf8', background:'none', border:'none', cursor:'pointer', padding:'8px', textAlign:'center', transition:'color 0.2s' }}
          onMouseEnter={function(e){ e.currentTarget.style.color='#a5b4fc' }}
          onMouseLeave={function(e){ e.currentTarget.style.color='#818cf8' }}>
          +{history.length-4} more transactions →
        </button>
      )}
    </div>
  )
}

// ─── Config Row ─────────────────────────────────────────────────────────────────
function ConfigRow({ label, value, last }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize:'14px', color:'#d1d5db', fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:'12px', fontWeight:700, color:'#e5e7eb', fontFamily:'monospace', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', padding:'4px 10px', borderRadius:'8px' }}>{value}</span>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function App() {
  var [wallet,         setWallet]         = useState(null)
  var [balance,        setBalance]        = useState('0.00')
  var [rawBalance,     setRawBalance]     = useState('0')
  var [status,         setStatus]         = useState('idle')
  var [step,           setStep]           = useState(0)
  var [toAddr,         setToAddr]         = useState('')
  var [amount,         setAmount]         = useState('')
  var [prefillNote,    setPrefillNote]    = useState('')
  var [fee,            setFee]            = useState(null)
  var [result,         setResult]         = useState(null)
  var [txHistory,      setTxHistory]      = useState([])
  var [showHistory,    setShowHistory]    = useState(false)
  var [showQR,         setShowQR]         = useState(false)
  var [showShare,      setShowShare]      = useState(false)
  var [historyLoading, setHistoryLoading] = useState(false)
  var [serverOnline,   setServerOnline]   = useState(null)
  var [mobileMenu,     setMobileMenu]     = useState(false)
  var [showWalletModal, setShowWalletModal] = useState(false)
  var [showConfetti,   setShowConfetti]   = useState(false)
  var [toasts,         setToasts]         = useState([])
  var toastId = useRef(0)

  // URL params
  useEffect(function() {
    var p = new URLSearchParams(window.location.search)
    var to = p.get('to'), amt = p.get('amount'), note = p.get('note')
    if (to && /^0x[0-9a-fA-F]{40}$/.test(to)) {
      setToAddr(to)
      if (amt && parseFloat(amt) > 0) setAmount(amt)
      if (note) setPrefillNote(note)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  var stats = useMemo(function() {
    if (!txHistory.length) return { gas:'0.000', count:0, fee:'0.000', vec:'0.00' }
    return {
      gas:   (txHistory.length * 0.003).toFixed(3),
      count: txHistory.length,
      fee:   txHistory.reduce(function(s,t){ return s+parseFloat(t.feeVec||0) },0).toFixed(3),
      vec:   txHistory.reduce(function(s,t){ return s+parseFloat(t.amount||0) },0).toFixed(2),
    }
  }, [txHistory])

  function addToast(title, desc, type) {
    var id = toastId.current++
    setToasts(function(p){ return [...p,{id,title,desc:desc||'',type:type||'info'}] })
    setTimeout(function(){ setToasts(function(p){ return p.filter(function(t){ return t.id!==id }) }) },5500)
  }
  function removeToast(id){ setToasts(function(p){ return p.filter(function(t){ return t.id!==id }) }) }

  useEffect(function(){ setFee(parseFloat(amount)>0?calcFee(parseFloat(amount)):null) },[amount])

  useEffect(function(){
    function ping(){
      // GET /api/relay returns {healthy:true} — simple status check
      fetch(RELAY_SERVER_URL, { method:'GET' })
        .then(function(r){ return r.ok ? r.json() : Promise.reject() })
        .then(function(d){ setServerOnline(d.healthy !== false) })
        .catch(function(){ setServerOnline(false) })
    }
    ping(); var iv=setInterval(ping,20000); return function(){ clearInterval(iv) }
  },[])

  var loadBalance = useCallback(async function(w){
    if(!w) return
    try{
      var tok = new ethers.Contract(VEC_TOKEN_ADDRESS, VEC_ABI, w.provider)
      var raw = await tok.balanceOf(w.address)
      var fmt = ethers.formatUnits(raw, 18)
      setBalance(parseFloat(fmt).toLocaleString(undefined,{maximumFractionDigits:2}))
      setRawBalance(fmt)
    } catch(e){ setBalance('0.00'); setRawBalance('0') }
  },[])

  var loadHistory = useCallback(async function(addr){
    if(!addr) return
    setHistoryLoading(true)
    try{
      var r = await fetch(RELAY_SERVER_URL + '?history=' + addr)
      var d = await r.json()
      if(d.success) setTxHistory(d.history)
    } catch(e){}
    setHistoryLoading(false)
  },[])

  // ── Universal Wallet Connect via Web3Modal ──────────────────────────────────
  var connectingRef = useRef(false)

  // Called after Web3Modal confirms a wallet is connected
  var onWalletConnected = useCallback(async function(walletProvider){
    if (!walletProvider) return
    try {
      var provider = new ethers.BrowserProvider(walletProvider)
      // Switch to BNB Testnet
      try {
        await provider.send('wallet_switchEthereumChain', [{ chainId: BNB_TESTNET.chainId }])
      } catch(se) {
        if (se.code === 4902 || se.code === -32603) {
          try { await provider.send('wallet_addEthereumChain', [BNB_TESTNET]) } catch(e) {}
        }
      }
      // Re-init provider after chain switch
      provider = new ethers.BrowserProvider(walletProvider)
      var signer  = await provider.getSigner()
      var address = await signer.getAddress()
      var w = { address, signer, provider }
      setWallet(w); setStatus('connected'); setMobileMenu(false)
      addToast('Wallet Connected!', shortAddr(address) + ' — BNB Testnet', 'success')
      await loadBalance(w); await loadHistory(address)
    } catch(err) {
      addToast('Connection Failed', friendlyError(err.message), 'error')
      setStatus('idle')
    }
  }, [loadBalance, loadHistory])

  // Subscribe to Web3Modal state changes
  useEffect(function() {
    // Check if already connected on mount
    var state = web3modal.getState()
    if (state.open === false) {
      var walletProvider = web3modal.getWalletProvider()
      if (walletProvider && !wallet) {
        onWalletConnected(walletProvider)
      }
    }

    var unsub = web3modal.subscribeProvider(function(providerState) {
      if (providerState.isConnected && providerState.provider && !connectingRef.current) {
        connectingRef.current = true
        onWalletConnected(providerState.provider).finally(function() {
          connectingRef.current = false
        })
      }
      if (!providerState.isConnected && wallet) {
        setWallet(null); setBalance('0.00'); setRawBalance('0'); setStatus('idle')
        setTxHistory([]); setStep(0); setFee(null); setResult(null)
        setToAddr(''); setAmount(''); setPrefillNote('')
        addToast('Wallet Disconnected', 'Session ended.', 'info')
      }
    })
    return function() { if (unsub) unsub() }
  }, [onWalletConnected])

  var connect = useCallback(function() {
    setShowWalletModal(true)
  }, [])

  var handleWalletSelect = useCallback(function(walletId) {
    setShowWalletModal(false)
    setStatus('connecting')
    // Open Web3Modal with optional filter
    var opts = {}
    if (walletId === 'walletconnect') opts = { view: 'ConnectingWalletConnect' }
    web3modal.open(opts).catch(function(err) {
      setStatus('idle')
      // Fallback: try injected window.ethereum for MetaMask/Trust
      if (window.ethereum) {
        var provider = new ethers.BrowserProvider(window.ethereum)
        provider.send('wallet_switchEthereumChain', [{ chainId: BNB_TESTNET.chainId }])
          .catch(function(se) {
            if (se.code === 4902 || se.code === -32603) {
              return provider.send('wallet_addEthereumChain', [BNB_TESTNET])
            }
          })
          .then(function() { return new ethers.BrowserProvider(window.ethereum).getSigner() })
          .then(function(signer) { return signer.getAddress().then(function(address) { return { signer, address } }) })
          .then(function(obj) {
            var w = { address: obj.address, signer: obj.signer, provider: new ethers.BrowserProvider(window.ethereum) }
            setWallet(w); setStatus('connected'); setMobileMenu(false)
            addToast('Wallet Connected!', shortAddr(obj.address) + ' — BNB Testnet', 'success')
            loadBalance(w); loadHistory(obj.address)
          })
          .catch(function(e) {
            addToast('Connection Failed', friendlyError(e.message), 'error')
            setStatus('idle')
          })
      } else {
        addToast('No wallet found', 'Please install MetaMask or use a mobile wallet app.', 'warning')
        setStatus('idle')
      }
    })
  }, [loadBalance, loadHistory])

  var disconnect = useCallback(async function(){
    try { await web3modal.disconnect() } catch(e) {}
    setWallet(null); setBalance('0.00'); setRawBalance('0'); setStatus('idle')
    setTxHistory([]); setStep(0); setFee(null); setResult(null)
    setToAddr(''); setAmount(''); setPrefillNote(''); setMobileMenu(false)
    addToast('Disconnected', 'Wallet session ended.', 'info')
  }, [])

  function fillMax(){
    var b = parseFloat(rawBalance)
    if(b>0) setAmount(Math.max(0, b - b*0.005).toFixed(4))
  }

  var pay = useCallback(async function(){
    setResult(null)
    if(!wallet){ connect(); return }
    if(!toAddr)                                            { addToast('Missing Recipient','Enter or scan a recipient address.','warning'); return }
    if(!ethers.isAddress(toAddr))                          { addToast('Invalid Address','Not a valid BNB/ETH wallet address.','error');   return }
    if(!amount||parseFloat(amount)<=0)                     { addToast('Invalid Amount','Please enter an amount greater than 0.','warning'); return }
    if(parseFloat(amount)>parseFloat(rawBalance))          { addToast('Insufficient Balance','Your current balance is '+balance+' VEC.','error'); return }
    if(toAddr.toLowerCase()===wallet.address.toLowerCase()){ addToast('Same Wallet','Cannot send VEC to your own address.','warning'); return }
    try{
      var tok = new ethers.Contract(VEC_TOKEN_ADDRESS, VEC_ABI, wallet.signer)
      var wei = ethers.parseUnits(amount,18)
      var dl  = Math.floor(Date.now()/1000)+3600
      setStatus('signing'); setStep(1)
      addToast('Signature Required','Check MetaMask — approve the sign request.','info')
      var sig = await signPermit(wallet.signer,tok,wallet.address,PAYMASTER_ADDRESS,wei,dl)
      setStatus('sending'); setStep(2)
      addToast('Broadcasting...','Transaction sent to BNB network.','info')
      var res, raw, data
      try {
        res = await fetch(RELAY_SERVER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner:wallet.address, to:toAddr, amount:wei.toString(), v:sig.v, r:sig.r, s:sig.s, deadline:sig.deadline })
        })
      } catch(fetchErr) {
        throw new Error('Cannot reach relay server — make sure it is running: cd paymaster-relay && node server.js')
      }
      try {
        raw  = await res.text()
        data = JSON.parse(raw)
      } catch(e) {
        console.error('[Relay] Non-JSON response (first 400 chars):', raw && raw.slice(0,400))
        throw new Error('Relay server returned invalid response. Check terminal for full error.')
      }
      console.log('[Relay] Response:', res.status, data)
      if (!res.ok || !data.success) {
        var errMsg = data.error || data.hint || ('Server returned HTTP ' + res.status)
        console.error('[Relay] Error:', errMsg)
        throw new Error(errMsg)
      }
      setStep(3); setStatus('success')
      setResult({hash:data.txHash,amount:parseFloat(amount),net:data.amountSent,feeVec:data.feeCollected})
      setShowConfetti(true)
      setTimeout(function(){ setShowConfetti(false) }, 4500)
      addToast('Transfer Successful! 🎉', parseFloat(amount)+' VEC sent — $0.00 gas paid.','success')
      setToAddr(''); setAmount(''); setPrefillNote('')
      setTimeout(function(){ loadBalance(wallet); loadHistory(wallet.address) },3000)
    } catch(err){ addToast('Transaction Failed',friendlyError(err.message),'error'); setStatus('connected'); setStep(0) }
  },[wallet,toAddr,amount,connect,loadBalance,loadHistory,rawBalance,balance])

  var busy      = status==='signing'||status==='sending'
  var addrOk    = toAddr.length>0 && ethers.isAddress(toAddr)
  var addrTyped = toAddr.length>0

  // Input shared style
  var inp = { width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:'14px', padding:'13px 16px', fontSize:'15px', color:'#f9fafb', outline:'none', transition:'border-color 0.2s', boxSizing:'border-box', fontFamily:'inherit' }

  // Reusable section label
  function SectionLabel({ children }) {
    return <p style={{ fontSize:'11px', fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 14px' }}>{children}</p>
  }

  // Card wrapper
  function Card({ children, style, accent }) {
    var base = { borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)', background:'#111827', padding:'24px', ...style }
    if(accent) base.border = '1px solid '+accent+'44'
    if(accent) base.background = accent+'0a'
    return <div style={base}>{children}</div>
  }

  return (
    <div style={{ minHeight:'100vh', width:'100%', background:'#0a0e1a', color:'#e5e7eb', fontFamily:"'Inter','Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes toastIn      { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeUp       { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseAnim    { 0%,100%{opacity:0.5;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes popIn        { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.12)} 100%{opacity:1;transform:scale(1)} }
        @keyframes shimmer      { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes confettiFall {
          0%   { transform: translateY(0)      translateX(0)           rotate(0deg);   opacity:1; }
          80%  { opacity:1; }
          100% { transform: translateY(105vh)  translateX(var(--drift)) rotate(var(--rot)); opacity:0; }
        }
        @keyframes receiptIn    { from{opacity:0;transform:translateY(18px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .fade-up { animation: fadeUp 0.38s ease-out; }
        * { box-sizing:border-box; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
        input::placeholder { color:#4b5563; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#374151; border-radius:4px; }
        a { text-decoration:none; }
        .grid-main { display:grid; grid-template-columns:1fr; gap:22px; }
        @media(min-width:1024px){ .grid-main { grid-template-columns:1fr 380px; } }
        .desk-only { display:flex; }
        .mob-only  { display:none; }
        @media(max-width:767px){ .desk-only{display:none!important} .mob-only{display:flex!important} }
        .xl-text { display:none; }
        @media(min-width:1200px){ .xl-text{display:inline;} }
        .receipt-shimmer {
          background: linear-gradient(90deg, #059669 0%, #34d399 40%, #6ee7b7 50%, #34d399 60%, #059669 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2.5s linear infinite;
        }
      `}</style>

      {/* BG glow */}
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',
        background:'radial-gradient(ellipse 70% 55% at 15% -10%, rgba(79,70,229,0.12) 0%,transparent 55%), radial-gradient(ellipse 55% 45% at 88% 105%, rgba(124,58,237,0.09) 0%,transparent 55%)' }} />

      <Toast toasts={toasts} remove={removeToast} />
      <Confetti active={showConfetti} />

      {showHistory && <TransactionHistory transactions={txHistory} onClose={function(){ setShowHistory(false) }} />}
      {showWalletModal && (
        <WalletSelectorModal
          status={status}
          onClose={function(){ setShowWalletModal(false); if(status==='connecting') setStatus('idle') }}
          onSelect={handleWalletSelect}
        />
      )}
      {showQR && wallet && (
        <QRModal address={wallet.address} balance={balance} onClose={function(){ setShowQR(false) }}
          onAddressScanned={function(a){ setToAddr(a); setShowQR(false); addToast('Address Scanned!', a.slice(0,10)+'...'+a.slice(-6)+' filled in.','success') }} />
      )}
      {showShare && wallet && <ShareModal address={wallet.address} balance={balance} onClose={function(){ setShowShare(false) }} />}

      {/* ═══════════════ NAVBAR ═══════════════ */}
      <header style={{ position:'sticky', top:0, zIndex:40, width:'100%', background:'rgba(10,14,26,0.92)', backdropFilter:'blur(24px)', borderBottom:'1px solid rgba(255,255,255,0.09)' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'0 24px', height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
            <img src={LOGO_URL} alt="VelaCore" style={{ width:'36px', height:'36px', borderRadius:'10px' }} />
            <span style={{ fontWeight:900, fontSize:'18px', color:'#f9fafb', letterSpacing:'-0.3px' }}>VelaCore</span>
            <span style={{ fontSize:'11px', fontWeight:800, color:'#818cf8', background:'rgba(99,102,241,0.18)', border:'1px solid rgba(99,102,241,0.35)', borderRadius:'20px', padding:'3px 10px' }}>VEC</span>
          </div>

          {/* Desktop right */}
          <div className="desk-only" style={{ alignItems:'center', gap:'10px' }}>
            <RelayDot online={serverOnline} />

            {wallet && (
              <>
                {[
                  {icon:'⬛', label:'QR Code',    fn:function(){ setShowQR(true) },     green:false },
                  {icon:'🔗', label:'Share & Pay', fn:function(){ setShowShare(true) },  green:true  },
                  {icon:'📋', label:historyLoading?'Loading…':'History ('+txHistory.length+')', fn:function(){ setShowHistory(true) }, green:false },
                ].map(function(b){
                  return (
                    <button key={b.label} onClick={b.fn}
                      style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'13px', fontWeight:700, padding:'8px 16px', borderRadius:'12px', cursor:'pointer', border:'1px solid', transition:'all 0.2s',
                        background:  b.green ? 'rgba(74,222,128,0.1)'  : 'rgba(255,255,255,0.06)',
                        borderColor: b.green ? 'rgba(74,222,128,0.3)'  : 'rgba(255,255,255,0.12)',
                        color:       b.green ? '#4ade80' : '#d1d5db' }}
                      onMouseEnter={function(e){ e.currentTarget.style.background=b.green?'rgba(74,222,128,0.2)':'rgba(255,255,255,0.12)'; e.currentTarget.style.color=b.green?'#4ade80':'#fff'; e.currentTarget.style.borderColor=b.green?'rgba(74,222,128,0.5)':'rgba(255,255,255,0.25)' }}
                      onMouseLeave={function(e){ e.currentTarget.style.background=b.green?'rgba(74,222,128,0.1)':'rgba(255,255,255,0.06)'; e.currentTarget.style.color=b.green?'#4ade80':'#d1d5db'; e.currentTarget.style.borderColor=b.green?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.12)' }}>
                      <span>{b.icon}</span>
                      <span className="xl-text">{b.label}</span>
                    </button>
                  )
                })}
              </>
            )}

            {wallet ? (
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.13)', borderRadius:'14px', padding:'8px 16px' }}>
                  <span style={{ width:'9px', height:'9px', borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 10px #4ade80', flexShrink:0, display:'inline-block' }} />
                  <span style={{ fontSize:'13px', fontFamily:'monospace', color:'#e5e7eb', fontWeight:600 }}>{shortAddr(wallet.address)}</span>
                  <CopyBtn text={wallet.address} />
                  <span style={{ fontSize:'14px', fontWeight:800, color:'#818cf8', borderLeft:'1px solid rgba(255,255,255,0.1)', paddingLeft:'12px' }}>{balance} VEC</span>
                </div>
                <button onClick={disconnect} title="Disconnect"
                  style={{ width:'40px', height:'40px', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', transition:'all 0.2s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.background='rgba(248,113,113,0.18)'; e.currentTarget.style.borderColor='rgba(248,113,113,0.45)' }}
                  onMouseLeave={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button onClick={connect}
                style={{ display:'flex', alignItems:'center', gap:'10px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', fontWeight:800, fontSize:'14px', padding:'10px 20px', borderRadius:'14px', border:'none', cursor:'pointer', boxShadow:'0 4px 24px rgba(79,70,229,0.4)', transition:'all 0.2s' }}
                onMouseEnter={function(e){ e.currentTarget.style.boxShadow='0 6px 32px rgba(79,70,229,0.6)'; e.currentTarget.style.transform='translateY(-1px)' }}
                onMouseLeave={function(e){ e.currentTarget.style.boxShadow='0 4px 24px rgba(79,70,229,0.4)'; e.currentTarget.style.transform='none' }}>
                <WalletIcon size={16} />
                {status==='connecting' ? 'Opening...' : 'Connect Wallet'}
              </button>
            )}
          </div>

          {/* Mobile */}
          <div className="mob-only" style={{ alignItems:'center', gap:'10px' }}>
            <span style={{ width:'8px', height:'8px', borderRadius:'50%', display:'inline-block',
              background:serverOnline===true?'#4ade80':'#f87171',
              boxShadow:serverOnline===true?'0 0 8px #4ade80':'' }} />
            {wallet && <span style={{ fontSize:'13px', fontWeight:800, color:'#818cf8' }}>{balance} VEC</span>}
            <button onClick={function(){ setMobileMenu(function(v){ return !v }) }}
              style={{ width:'40px', height:'40px', borderRadius:'12px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.13)', color:'#d1d5db', fontSize:'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>
              {mobileMenu?'✕':'☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', background:'rgba(10,14,26,0.98)', padding:'20px 24px', display:'flex', flexDirection:'column', gap:'12px' }}>
            {wallet ? (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderRadius:'14px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)' }}>
                  <span style={{ fontSize:'13px', fontFamily:'monospace', color:'#e5e7eb', fontWeight:600 }}>{shortAddr(wallet.address)}</span>
                  <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                    <span style={{ fontSize:'14px', fontWeight:800, color:'#818cf8' }}>{balance} VEC</span>
                    <CopyBtn text={wallet.address} />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[
                    {l:'⬛ QR Code',    fn:function(){ setShowQR(true);    setMobileMenu(false) }, green:false},
                    {l:'🔗 Share & Pay', fn:function(){ setShowShare(true); setMobileMenu(false) }, green:true },
                  ].map(function(b){
                    return (
                      <button key={b.l} onClick={b.fn}
                        style={{ padding:'14px', borderRadius:'14px', fontWeight:700, fontSize:'14px', cursor:'pointer', border:'1px solid',
                          background:  b.green?'rgba(74,222,128,0.12)':'rgba(255,255,255,0.06)',
                          borderColor: b.green?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.12)',
                          color:       b.green?'#4ade80':'#d1d5db' }}>{b.l}</button>
                    )
                  })}
                </div>
                <button onClick={function(){ setShowHistory(true); setMobileMenu(false) }}
                  style={{ padding:'14px', borderRadius:'14px', fontWeight:700, fontSize:'14px', cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#d1d5db' }}>
                  📋 History ({txHistory.length} transactions)
                </button>
                <button onClick={disconnect}
                  style={{ padding:'14px', borderRadius:'14px', fontWeight:700, fontSize:'14px', cursor:'pointer', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171' }}>
                  ⏻ Disconnect Wallet
                </button>
              </>
            ) : (
              <button onClick={connect}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', padding:'16px', borderRadius:'14px', fontWeight:800, fontSize:'15px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff', border:'none', cursor:'pointer', boxShadow:'0 4px 24px rgba(79,70,229,0.4)' }}>
                <WalletIcon size={18} />
                {status==='connecting' ? 'Opening Wallet Selector...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        )}
      </header>

      {/* Payment link banner */}
      {prefillNote && (
        <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'16px 24px 0', position:'relative', zIndex:10 }}>
          <div style={{ borderRadius:'16px', border:'1px solid rgba(251,191,36,0.35)', background:'rgba(251,191,36,0.08)', padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px' }}>
            <span style={{ fontSize:'24px' }}>💳</span>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:'12px', fontWeight:800, color:'#fbbf24', margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'0.08em' }}>Payment Request Received</p>
              <p style={{ fontSize:'14px', color:'#e5e7eb', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{prefillNote}</p>
            </div>
            <button onClick={function(){ setPrefillNote('') }} style={{ color:'#9ca3af', fontSize:'20px', cursor:'pointer', background:'none', border:'none', flexShrink:0, padding:'4px' }}>✕</button>
          </div>
        </div>
      )}

      {/* ═══════════════ MAIN GRID ═══════════════ */}
      <main className="grid-main fade-up" style={{ position:'relative', zIndex:10, maxWidth:'1400px', margin:'0 auto', padding:'24px' }}>

        {/* ───── LEFT COLUMN ───── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'22px' }}>

          {/* Hero Banner */}
          <div style={{ borderRadius:'20px', border:'1px solid rgba(99,102,241,0.25)', background:'linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(124,58,237,0.1) 50%, rgba(16,24,40,0.8) 100%)', padding:'28px 30px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:'16px', marginBottom:'16px' }}>
              <img src={LOGO_URL} alt="" style={{ width:'48px', height:'48px', borderRadius:'14px', flexShrink:0 }} />
              <div>
                <h1 style={{ fontSize:'24px', fontWeight:900, color:'#f9fafb', margin:0, letterSpacing:'-0.5px' }}>Gasless VEC Transfers</h1>
                <p style={{ fontSize:'14px', color:'#a5b4fc', fontWeight:600, margin:'6px 0 0' }}>ERC-4337 Account Abstraction · EIP-712 Permit · Zero Gas</p>
              </div>
            </div>
            <p style={{ fontSize:'15px', color:'#d1d5db', lineHeight:1.75, margin:'0 0 20px' }}>
              Send VEC tokens to anyone without holding BNB. Share a QR or payment link — customers pay instantly, completely gasless.
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
              <div style={{ flex:1, height:'6px', borderRadius:'6px', background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:'80%', borderRadius:'6px', background:'linear-gradient(90deg,#4f46e5,#34d399)', boxShadow:'0 0 12px rgba(79,70,229,0.7)' }} />
              </div>
              <span style={{ fontSize:'13px', fontWeight:700, color:'#4ade80', whiteSpace:'nowrap', background:'rgba(74,222,128,0.12)', padding:'5px 14px', borderRadius:'20px', border:'1px solid rgba(74,222,128,0.3)' }}>
                ⛽ Gas Tank: 80%
              </span>
            </div>
          </div>

          {/* ─── SEND FORM ─── */}
          <div style={{ borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)', background:'#111827', padding:'28px 30px', display:'flex', flexDirection:'column', gap:'24px' }}>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
              <h2 style={{ fontSize:'20px', fontWeight:900, color:'#f9fafb', margin:0 }}>Send VEC</h2>
              {wallet && (
                <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 16px', borderRadius:'12px', background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)' }}>
                  <span style={{ fontSize:'14px', color:'#d1d5db' }}>Balance:</span>
                  <span style={{ fontSize:'15px', fontWeight:800, color:'#818cf8' }}>{balance} VEC</span>
                </div>
              )}
            </div>

            {/* Recipient */}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <label style={{ fontSize:'12px', fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.1em' }}>Recipient Wallet Address</label>
              <div style={{ display:'flex', gap:'10px' }}>
                <div style={{ position:'relative', flex:1 }}>
                  <input type="text" placeholder="Paste 0x address or scan QR code →"
                    value={toAddr} onChange={function(e){ setToAddr(e.target.value.trim()) }}
                    style={{ ...inp, paddingRight:addrTyped?'88px':'16px', fontFamily:'monospace', fontSize:'13px',
                      borderColor: addrTyped ? (addrOk?'rgba(74,222,128,0.55)':'rgba(248,113,113,0.55)') : 'rgba(255,255,255,0.14)' }}
                    onFocus={function(e){ if(!addrTyped) e.target.style.borderColor='rgba(99,102,241,0.55)' }}
                    onBlur={function(e){  if(!addrTyped) e.target.style.borderColor='rgba(255,255,255,0.14)' }} />
                  {addrTyped && (
                    <span style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', fontSize:'12px', fontWeight:700, padding:'4px 10px', borderRadius:'8px',
                      color: addrOk?'#4ade80':'#f87171',
                      background: addrOk?'rgba(74,222,128,0.15)':'rgba(248,113,113,0.15)',
                      border:'1px solid '+(addrOk?'rgba(74,222,128,0.4)':'rgba(248,113,113,0.4)') }}>
                      {addrOk?'✓ Valid':'✕ Invalid'}
                    </span>
                  )}
                </div>
                {wallet && (
                  <button onClick={function(){ setShowQR(true) }} title="Scan QR Code"
                    style={{ padding:'0 18px', borderRadius:'14px', background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.3)', color:'#818cf8', fontSize:'22px', cursor:'pointer', flexShrink:0, transition:'all 0.2s' }}
                    onMouseEnter={function(e){ e.currentTarget.style.background='rgba(99,102,241,0.25)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.55)' }}
                    onMouseLeave={function(e){ e.currentTarget.style.background='rgba(99,102,241,0.12)'; e.currentTarget.style.borderColor='rgba(99,102,241,0.3)' }}>
                    📷
                  </button>
                )}
              </div>
              {addrTyped&&!addrOk&&(
                <p style={{ fontSize:'13px', color:'#f87171', margin:0, display:'flex', alignItems:'center', gap:'6px' }}>
                  ⚠ Address must start with 0x followed by 40 hex characters
                </p>
              )}
            </div>

            {/* Amount */}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                <label style={{ fontSize:'12px', fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.1em' }}>Amount (VEC)</label>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  {/* 💱 Currency Converter */}
                  <CurrencyConverter onAmountSet={setAmount} />
                  {wallet && parseFloat(rawBalance)>0 && (
                    <button onClick={fillMax}
                      style={{ fontSize:'12px', fontWeight:800, color:'#818cf8', background:'rgba(99,102,241,0.14)', border:'1px solid rgba(99,102,241,0.35)', borderRadius:'10px', padding:'7px 16px', cursor:'pointer', transition:'all 0.2s', letterSpacing:'0.04em' }}
                      onMouseEnter={function(e){ e.currentTarget.style.background='rgba(99,102,241,0.28)'; e.currentTarget.style.color='#c7d2fe' }}
                      onMouseLeave={function(e){ e.currentTarget.style.background='rgba(99,102,241,0.14)'; e.currentTarget.style.color='#818cf8' }}>
                      MAX
                    </button>
                  )}
                </div>
              </div>
              <div style={{ position:'relative' }}>
                <input type="number" placeholder="0.00" min="0" value={amount}
                  onChange={function(e){ setAmount(e.target.value) }}
                  onWheel={function(e){ e.target.blur() }}
                  style={{ ...inp, paddingRight:'70px', fontSize:'20px', fontWeight:700 }}
                  onFocus={function(e){ e.target.style.borderColor='rgba(99,102,241,0.55)' }}
                  onBlur={function(e){  e.target.style.borderColor='rgba(255,255,255,0.14)' }} />
                <span style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', fontSize:'14px', fontWeight:800, color:'#818cf8', background:'rgba(99,102,241,0.14)', padding:'4px 10px', borderRadius:'8px' }}>VEC</span>
              </div>
              {wallet&&amount&&parseFloat(amount)>parseFloat(rawBalance)&&(
                <p style={{ fontSize:'13px', color:'#f87171', margin:0 }}>⚠ Exceeds your balance of {balance} VEC</p>
              )}
            </div>

            {/* Fee preview */}
            {fee && (
              <div style={{ borderRadius:'16px', border:'1px solid rgba(99,102,241,0.2)', background:'rgba(99,102,241,0.07)', padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
                <p style={{ fontSize:'11px', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', color:'#9ca3af', margin:0 }}>Transaction Preview</p>

                {/* Rows */}
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {[
                    ['You Send',           parseFloat(amount).toFixed(4)+' VEC', '#e5e7eb'],
                    ['Platform Fee (0.5%)', '− '+fee.feeVec+' VEC',             '#fbbf24'],
                  ].map(function(r){
                    return (
                      <div key={r[0]} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'14px', color:'#9ca3af', fontWeight:500 }}>{r[0]}</span>
                        <span style={{ fontSize:'14px', fontWeight:700, color:r[2], fontFamily:'monospace' }}>{r[1]}</span>
                      </div>
                    )
                  })}
                </div>

                {/* ── Gasless Badge ── */}
                <div style={{ borderRadius:'14px', background:'linear-gradient(135deg, rgba(74,222,128,0.1), rgba(16,185,129,0.06))', border:'1px solid rgba(74,222,128,0.35)', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'rgba(74,222,128,0.18)', border:'1px solid rgba(74,222,128,0.4)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:'18px' }}>⛽</span>
                    </div>
                    <div>
                      <p style={{ fontSize:'13px', fontWeight:800, color:'#4ade80', margin:'0 0 2px' }}>Network Fee: $0.00</p>
                      <p style={{ fontSize:'12px', color:'#9ca3af', margin:0 }}>Sponsored by VelaCore</p>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px' }}>
                    <span style={{ fontSize:'11px', fontWeight:800, color:'#4ade80', background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.4)', borderRadius:'20px', padding:'3px 10px', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
                      ✓ GASLESS
                    </span>
                    <span style={{ fontSize:'11px', color:'#6b7280', whiteSpace:'nowrap' }}>vs ~$0.05 on standard</span>
                  </div>
                </div>

                {/* Recipient total */}
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'16px', fontWeight:700, color:'#e5e7eb' }}>Recipient Gets</span>
                  <span style={{ fontSize:'26px', fontWeight:900, color:'#34d399', letterSpacing:'-0.5px' }}>{fee.netRevenue} <span style={{ fontSize:'15px' }}>VEC</span></span>
                </div>
              </div>
            )}

            {/* Pay Button */}
            <button onClick={pay} disabled={busy}
              style={{ width:'100%', padding:'18px', borderRadius:'16px', fontWeight:900, fontSize:'17px', cursor:busy?'not-allowed':'pointer', border:'none', transition:'all 0.25s', letterSpacing:'0.01em',
                background: busy ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)',
                color:      busy ? '#4b5563' : '#fff',
                boxShadow:  busy ? 'none' : '0 10px 40px rgba(79,70,229,0.45)' }}
              onMouseEnter={function(e){ if(!busy){ e.currentTarget.style.boxShadow='0 14px 50px rgba(79,70,229,0.65)'; e.currentTarget.style.transform='translateY(-1px)' } }}
              onMouseLeave={function(e){ if(!busy){ e.currentTarget.style.boxShadow='0 10px 40px rgba(79,70,229,0.45)'; e.currentTarget.style.transform='none' } }}>
              {busy
                ? (status==='signing' ? '⏳  Waiting for MetaMask Signature...' : '⏳  Broadcasting to BNB Network...')
                : (wallet ? '⚡  Pay Now — Gasless' : '🔗  Connect Wallet to Pay')}
            </button>

            <p style={{ textAlign:'center', fontSize:'13px', color:'#6b7280', margin:0 }}>
              MetaMask will show a <strong style={{ color:'#9ca3af' }}>Sign Message</strong> — no BNB gas required
            </p>
          </div>

          {/* How It Works */}
          <div style={{ borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)', background:'#111827', padding:'26px 30px' }}>
            <p style={{ fontSize:'11px', fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 22px' }}>How It Works</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
              <FlowStep num={1} active={step===1} done={step>1} title="Sign Permit (EIP-712)"       desc="One-click signature in MetaMask — zero gas, no on-chain approval needed" />
              <FlowStep num={2} active={step===2} done={step>2} title="Relay Submits UserOperation" desc="Signed payload sent to BNB bundler by relay server" />
              <FlowStep num={3} active={step===2} done={step>2} title="Paymaster Sponsors Gas"      desc="0.5% platform fee covers all BNB gas costs automatically" />
              <FlowStep num={4} active={false}    done={step===3} title="Confirmed On-Chain"        desc="Recipient gets VEC instantly — verifiable on BscScan" />
            </div>
          </div>

          {/* ══ RECEIPT CARD ══ */}
          {result && (
            <div style={{ borderRadius:'22px', border:'1px solid rgba(52,211,153,0.4)', background:'linear-gradient(160deg,rgba(5,46,22,0.95) 0%,rgba(10,14,26,0.98) 100%)', padding:'0', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 0 80px rgba(52,211,153,0.12), 0 24px 60px rgba(0,0,0,0.5)', animation:'receiptIn 0.45s cubic-bezier(0.34,1.56,0.64,1)' }}>

              {/* ── Header strip ── */}
              <div style={{ background:'linear-gradient(135deg,#059669,#10b981,#34d399)', padding:'24px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                  <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'2px solid rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', flexShrink:0, animation:'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' }}>✓</div>
                  <div>
                    <p className="receipt-shimmer" style={{ fontSize:'22px', fontWeight:900, margin:0, letterSpacing:'-0.3px' }}>Transfer Complete!</p>
                    <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.8)', margin:'4px 0 0', fontWeight:500 }}>
                      {new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})} · BNB Testnet
                    </p>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.65)', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700 }}>Amount Sent</p>
                  <p style={{ fontSize:'28px', fontWeight:900, color:'#fff', margin:0, letterSpacing:'-1px' }}>{result.amount.toFixed(4)} <span style={{ fontSize:'16px', fontWeight:700, opacity:0.85 }}>VEC</span></p>
                </div>
              </div>

              {/* ── Receipt body ── */}
              <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:'20px' }}>

                {/* Fee breakdown table */}
                <div>
                  <p style={{ fontSize:'11px', fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 12px' }}>Fee Breakdown</p>
                  <div style={{ borderRadius:'14px', border:'1px solid rgba(255,255,255,0.09)', overflow:'hidden' }}>
                    {[
                      { label:'Gross Amount Sent',   value:result.amount.toFixed(6)+' VEC',           note:null,                          color:'#e5e7eb',  bg:'rgba(255,255,255,0.03)' },
                      { label:'Platform Fee (0.5%)', value:'− '+parseFloat(result.feeVec).toFixed(6)+' VEC', note:'Covers BNB gas for all users', color:'#fbbf24',  bg:'rgba(251,191,36,0.04)'  },
                      { label:'Network Gas Fee',     value:'$0.00',                                    note:'Sponsored by VelaCore',       color:'#4ade80',  bg:'rgba(74,222,128,0.04)'  },
                      { label:'Recipient Receives',  value:parseFloat(result.net).toFixed(6)+' VEC',   note:'Net after 0.5% fee',          color:'#34d399',  bg:'rgba(52,211,153,0.05)',  bold:true },
                    ].map(function(row, i, arr) {
                      return (
                        <div key={row.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', background:row.bg, borderBottom: i < arr.length-1 ? '1px solid rgba(255,255,255,0.07)' : 'none', gap:'12px', flexWrap:'wrap' }}>
                          <div>
                            <p style={{ fontSize:'13px', fontWeight: row.bold ? 700 : 500, color: row.bold ? '#e5e7eb' : '#d1d5db', margin:'0 0 2px' }}>{row.label}</p>
                            {row.note && <p style={{ fontSize:'11px', color:'#6b7280', margin:0 }}>{row.note}</p>}
                          </div>
                          <span style={{ fontSize: row.bold ? '17px' : '14px', fontWeight: row.bold ? 900 : 700, color:row.color, fontFamily:'monospace', whiteSpace:'nowrap' }}>{row.value}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Gasless badge */}
                <div style={{ borderRadius:'14px', background:'linear-gradient(135deg,rgba(74,222,128,0.1),rgba(16,185,129,0.06))', border:'1px solid rgba(74,222,128,0.35)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <span style={{ fontSize:'26px' }}>⛽</span>
                    <div>
                      <p style={{ fontSize:'15px', fontWeight:800, color:'#4ade80', margin:'0 0 2px' }}>Network Fee: $0.00</p>
                      <p style={{ fontSize:'12px', color:'#9ca3af', margin:0 }}>Fully sponsored by VelaCore · ERC-4337 Paymaster</p>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'5px' }}>
                    <span style={{ fontSize:'12px', fontWeight:900, color:'#4ade80', background:'rgba(74,222,128,0.18)', border:'1px solid rgba(74,222,128,0.45)', borderRadius:'20px', padding:'4px 14px', letterSpacing:'0.08em' }}>✓ GASLESS TX</span>
                    <span style={{ fontSize:'11px', color:'#6b7280' }}>You saved ~$0.05 vs standard</span>
                  </div>
                </div>

                {/* Tx hash */}
                <div style={{ borderRadius:'14px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', padding:'16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontSize:'14px' }}>🔗</span>
                      <p style={{ fontSize:'12px', color:'#9ca3af', margin:0, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Transaction Hash</p>
                    </div>
                    <CopyBtn text={result.hash} />
                  </div>
                  <p style={{ fontFamily:'monospace', fontSize:'12px', color:'#d1d5db', wordBreak:'break-all', lineHeight:1.7, margin:0 }}>{result.hash}</p>
                </div>

                {/* Actions row */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  <a href={'https://testnet.bscscan.com/tx/'+result.hash} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'14px', borderRadius:'14px', border:'1px solid rgba(99,102,241,0.35)', background:'rgba(99,102,241,0.12)', color:'#a5b4fc', fontWeight:700, fontSize:'14px', transition:'all 0.2s' }}
                    onMouseEnter={function(e){ e.currentTarget.style.background='rgba(99,102,241,0.25)' }}
                    onMouseLeave={function(e){ e.currentTarget.style.background='rgba(99,102,241,0.12)' }}>
                    🔍 BscScan ↗
                  </a>
                  <button onClick={function(){ setResult(null); setStep(0); setStatus('connected') }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'14px', borderRadius:'14px', border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#d1d5db', fontWeight:700, fontSize:'14px', cursor:'pointer', transition:'all 0.2s' }}
                    onMouseEnter={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.12)' }}
                    onMouseLeave={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.06)' }}>
                    ⚡ New Transfer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ───── RIGHT COLUMN ───── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'22px' }}>

          {/* Dashboard */}
          <div style={{ borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)', background:'#111827', padding:'22px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
              <img src={LOGO_URL} alt="" style={{ width:'22px', height:'22px', opacity:0.85 }} />
              <h2 style={{ fontWeight:900, fontSize:'17px', color:'#f9fafb', margin:0 }}>Dashboard</h2>
            </div>
            <p style={{ fontSize:'13px', color:'#9ca3af', margin:'0 0 18px' }}>All-time stats for this wallet</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <StatCard label="Gas Saved"    value={'$'+stats.gas}  sub="USD saved"     color="cyan"    />
              <StatCard label="Transactions" value={stats.count}     sub="Total gasless" color="violet"  />
              <StatCard label="Total Sent"   value={stats.vec}       sub="VEC all-time"  color="emerald" />
              <StatCard label="Fees Paid"    value={stats.fee}       sub="VEC (0.5%)"    color="amber"   />
            </div>
          </div>

          {/* Quick Actions */}
          {wallet && (
            <div style={{ borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)', background:'#111827', padding:'22px' }}>
              <p style={{ fontSize:'11px', fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 16px' }}>Quick Actions</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                {[
                  {icon:'⬛',label:'My QR',  fn:function(){ setShowQR(true) },    bg:'rgba(99,102,241,0.12)',  bd:'rgba(99,102,241,0.3)',  tc:'#a5b4fc'},
                  {icon:'📷',label:'Scan',   fn:function(){ setShowQR(true) },    bg:'rgba(139,92,246,0.12)', bd:'rgba(139,92,246,0.3)', tc:'#c4b5fd'},
                  {icon:'🔗',label:'Share',  fn:function(){ setShowShare(true) }, bg:'rgba(74,222,128,0.1)',  bd:'rgba(74,222,128,0.3)', tc:'#4ade80'},
                ].map(function(btn){
                  return (
                    <button key={btn.label} onClick={btn.fn}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', padding:'18px 8px', borderRadius:'16px', background:btn.bg, border:'1px solid '+btn.bd, cursor:'pointer', transition:'all 0.2s' }}
                      onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.35)' }}
                      onMouseLeave={function(e){ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
                      <span style={{ fontSize:'24px' }}>{btn.icon}</span>
                      <span style={{ fontSize:'12px', fontWeight:700, color:btn.tc }}>{btn.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div style={{ borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)', background:'#111827', padding:'22px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px' }}>
              <p style={{ fontSize:'11px', fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.12em', margin:0 }}>Recent Activity</p>
              {txHistory.length>0 && (
                <button onClick={function(){ setShowHistory(true) }}
                  style={{ fontSize:'13px', fontWeight:700, color:'#818cf8', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', transition:'color 0.2s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.color='#a5b4fc' }}
                  onMouseLeave={function(e){ e.currentTarget.style.color='#818cf8' }}>
                  View all →
                </button>
              )}
            </div>
            <RecentActivity history={txHistory} onViewAll={function(){ setShowHistory(true) }} />
          </div>

          {/* Paymaster Config */}
          <div style={{ borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)', background:'#111827', padding:'22px' }}>
            <p style={{ fontSize:'11px', fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.12em', margin:'0 0 4px' }}>Paymaster Config</p>
            <ConfigRow label="Fee Model"    value="0.5% Merchant"    />
            <ConfigRow label="Gas Strategy" value="Fee → Gas Tank"   />
            <ConfigRow label="Permit Type"  value="EIP-712 / ERC-2612"/>
            <ConfigRow label="Standard"     value="ERC-4337"         />
            <ConfigRow label="Network"      value="BNB Testnet (97)" last={true} />
          </div>

          {/* Key Features */}
          <div style={{ borderRadius:'20px', border:'1px solid rgba(124,58,237,0.25)', background:'rgba(124,58,237,0.07)', padding:'22px' }}>
            <p style={{ fontWeight:800, color:'#c4b5fd', fontSize:'15px', margin:'0 0 16px' }}>✦ Key Features</p>
            {[
              '⚡ Zero BNB required for users',
              '📷 QR code for instant merchant pay',
              '💬 WhatsApp & Telegram payment links',
              '💱 Fiat-to-VEC currency converter',
              '🔐 EIP-712 removes on-chain approve',
              '🛡️ Gas fully sponsored by platform fee',
              '📊 Cross-device transaction history',
            ].map(function(item){
              return (
                <div key={item} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'6px 0' }}>
                  <p style={{ fontSize:'14px', color:'#d1d5db', margin:0, lineHeight:1.5 }}>{item}</p>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <footer style={{ borderTop:'1px solid rgba(255,255,255,0.07)', marginTop:'16px', padding:'24px', textAlign:'center', position:'relative', zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', flexWrap:'wrap' }}>
          <img src={LOGO_URL} alt="" style={{ width:'15px', height:'15px', opacity:0.35 }} />
          <span style={{ fontSize:'13px', color:'#4b5563' }}>VelaCore (VEC) · Gasless Merchant Gateway · BNB Smart Chain · ERC-4337</span>
        </div>
      </footer>
    </div>
  )
}