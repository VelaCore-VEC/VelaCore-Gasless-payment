import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ethers } from 'ethers'
import { VEC_TOKEN_ADDRESS, PAYMASTER_ADDRESS, RELAY_SERVER_URL, LOGO_URL, BNB_TESTNET, VEC_ABI } from './config.js'
import { signPermit, calcFee, shortAddr } from './helpers.js'
import { Badge, StatCard, FlowStep } from './components.jsx'
import TransactionHistory from './TransactionHistory.jsx'
import QRModal from './QRModal.jsx'
import ShareModal from './ShareModal.jsx'

function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Please try again.'
  var m = msg.toLowerCase()
  if (m.includes('user rejected') || m.includes('user denied'))
    return 'You cancelled the signature in MetaMask.'
  if (m.includes('insufficient') || m.includes('balance'))
    return 'Insufficient VEC balance.'
  if (m.includes('nonce'))
    return 'Nonce error — refresh the page and try again.'
  if (m.includes('deadline') || m.includes('expired'))
    return 'Signature expired — please try again.'
  if (m.includes('fetch') || m.includes('failed to fetch'))
    return 'Cannot reach relay server. Make sure it is running on port 3001.'
  if (m.includes('relay server'))
    return 'Relay server error. Check that the relayer has BNB for gas.'
  if (m.includes('permit'))
    return 'Permit signing failed. Make sure you are on BNB Testnet.'
  if (m.includes('invalid') && m.includes('address'))
    return 'Invalid wallet address. Double-check the recipient.'
  if (m.includes('metamask') || m.includes('provider'))
    return 'MetaMask not detected. Please install MetaMask.'
  if (m.includes('chain') || m.includes('network'))
    return 'Wrong network. Switch to BNB Smart Chain Testnet in MetaMask.'
  return msg
}

function Toast({ toasts, remove }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none w-full max-w-[340px]">
      {toasts.map(function(t) {
        var colors = t.type === 'success' ? 'bg-[#0d2218] border-emerald-500/50 text-emerald-100'
          : t.type === 'error'   ? 'bg-[#1f0d0d] border-red-500/50 text-red-100'
          : t.type === 'warning' ? 'bg-[#1f1800] border-amber-500/50 text-amber-100'
          : 'bg-[#0d1520] border-cyan-500/30 text-cyan-100'
        var iconBg = t.type === 'success' ? 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30'
          : t.type === 'error'   ? 'text-red-400 bg-red-400/15 border-red-400/30'
          : t.type === 'warning' ? 'text-amber-400 bg-amber-400/15 border-amber-400/30'
          : 'text-cyan-400 bg-cyan-400/15 border-cyan-400/30'
        var icon = t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'
        return (
          <div key={t.id} className={'pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl ' + colors} style={{ animation: 'slideIn 0.25s ease-out' }}>
            <div className={'w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 font-bold text-xs ' + iconBg}>{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-snug">{t.title}</p>
              {t.desc && <p className="text-xs opacity-70 mt-0.5 leading-snug">{t.desc}</p>}
            </div>
            <button onClick={function() { remove(t.id) }} className="opacity-40 hover:opacity-80 text-lg leading-none flex-shrink-0">×</button>
          </div>
        )
      })}
    </div>
  )
}

function CopyBtn({ text }) {
  var [copied, setCopied] = useState(false)
  function copy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(function() {
      setCopied(true)
      setTimeout(function() { setCopied(false) }, 1800)
    })
  }
  return (
    <button onClick={copy} className={'text-xs px-2 py-0.5 rounded-md transition-all font-medium ' + (copied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/80 hover:bg-slate-600 text-slate-400 border border-slate-600/50')}>
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

function ServerStatus({ online }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-700/60 bg-slate-800/60">
      <span className={'w-2 h-2 rounded-full flex-shrink-0 ' + (online === true ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : online === false ? 'bg-red-400' : 'bg-yellow-400 animate-pulse')} />
      <span className="text-xs font-medium text-slate-400 hidden lg:block">
        {online === true ? 'Relay Online' : online === false ? 'Relay Offline' : 'Checking...'}
      </span>
    </div>
  )
}

function RecentActivity({ history, onViewAll }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-2xl mb-3">📭</div>
        <p className="text-slate-500 text-xs font-medium">No transactions yet</p>
        <p className="text-slate-700 text-xs mt-1">Your activity will appear here</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {history.slice(0, 4).map(function(tx) {
        var d = new Date(tx.timestamp)
        var t = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        return (
          <a key={tx.hash} href={'https://testnet.bscscan.com/tx/' + tx.hash} target="_blank" rel="noreferrer"
            className="flex items-center justify-between rounded-xl bg-slate-800/50 border border-slate-700/40 px-3 py-2.5 hover:border-cyan-500/30 hover:bg-slate-800 transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-400 text-sm font-bold">↑</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">{parseFloat(tx.amount).toFixed(2)} VEC</p>
                <p className="text-xs text-slate-600 font-mono truncate">→ {tx.to.slice(0, 6)}...{tx.to.slice(-4)}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="text-xs font-bold text-emerald-400">$0 gas</p>
              <p className="text-xs text-slate-600 whitespace-nowrap">{t}</p>
            </div>
          </a>
        )
      })}
      {history.length > 4 && (
        <button onClick={onViewAll} className="text-xs text-center text-cyan-400 hover:text-cyan-300 py-1.5 transition-colors">
          +{history.length - 4} more →
        </button>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
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
  var [toasts,         setToasts]         = useState([])
  var toastId = useRef(0)

  // ── Read URL params on load (payment link support) ────────────────────────
  useEffect(function() {
    var params = new URLSearchParams(window.location.search)
    var toParam     = params.get('to')
    var amountParam = params.get('amount')
    var noteParam   = params.get('note')
    if (toParam && /^0x[0-9a-fA-F]{40}$/.test(toParam)) {
      setToAddr(toParam)
      if (amountParam && parseFloat(amountParam) > 0) setAmount(amountParam)
      if (noteParam) setPrefillNote(noteParam)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // ── Dashboard stats from txHistory ───────────────────────────────────────
  var stats = useMemo(function() {
    if (!txHistory || txHistory.length === 0) {
      return { gasSaved: '0.000', txCount: 0, feeColl: '0.000', totalVEC: '0.00' }
    }
    return {
      gasSaved: (txHistory.length * 0.003).toFixed(3),
      txCount:  txHistory.length,
      feeColl:  txHistory.reduce(function(s, tx) { return s + parseFloat(tx.feeVec || 0) }, 0).toFixed(3),
      totalVEC: txHistory.reduce(function(s, tx) { return s + parseFloat(tx.amount || 0) }, 0).toFixed(2),
    }
  }, [txHistory])

  function addToast(title, desc, type) {
    var id = toastId.current++
    setToasts(function(p) { return [...p, { id: id, title: title, desc: desc || '', type: type || 'info' }] })
    setTimeout(function() { setToasts(function(p) { return p.filter(function(t) { return t.id !== id }) }) }, 5000)
  }
  function removeToast(id) {
    setToasts(function(p) { return p.filter(function(t) { return t.id !== id }) })
  }

  useEffect(function() {
    var n = parseFloat(amount)
    setFee(n > 0 ? calcFee(n) : null)
  }, [amount])

  useEffect(function() {
    function check() {
      fetch('https://velacore-gasless-payment-production.up.railway.app/status').then(function(r) { return r.json() }).then(function(d) { setServerOnline(d.healthy !== false) }).catch(function() { setServerOnline(false) })
    }
    check()
    var iv = setInterval(check, 15000)
    return function() { clearInterval(iv) }
  }, [])

  var loadBalance = useCallback(async function(w) {
    if (!w) return
    try {
      var token = new ethers.Contract(VEC_TOKEN_ADDRESS, VEC_ABI, w.provider)
      var raw   = await token.balanceOf(w.address)
      var fmt   = ethers.formatUnits(raw, 18)
      setBalance(parseFloat(fmt).toLocaleString(undefined, { maximumFractionDigits: 2 }))
      setRawBalance(fmt)
    } catch (e) { setBalance('0.00'); setRawBalance('0') }
  }, [])

  var loadHistory = useCallback(async function(address) {
    if (!address) return
    setHistoryLoading(true)
    try {
      var res  = await fetch('https://velacore-gasless-payment-production.up.railway.app/history/' + address)
      var data = await res.json()
      if (data.success) setTxHistory(data.history)
    } catch (e) {}
    setHistoryLoading(false)
  }, [])

  var connect = useCallback(async function() {
    if (!window.ethereum) { addToast('MetaMask Not Found', 'Install the MetaMask browser extension.', 'error'); return }
    setStatus('connecting')
    try {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BNB_TESTNET.chainId }] })
      } catch (switchErr) {
        if (switchErr.code === 4902 || switchErr.code === -32603) {
          try { await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [BNB_TESTNET] }) }
          catch (e) { throw new Error('Please manually switch to BNB Smart Chain Testnet.') }
        } else { throw new Error('Please manually switch to BNB Smart Chain Testnet.') }
      }
      var provider = new ethers.BrowserProvider(window.ethereum)
      var signer   = await provider.getSigner()
      var address  = await signer.getAddress()
      var w = { address, signer, provider }
      setWallet(w)
      setStatus('connected')
      setMobileMenu(false)
      addToast('Wallet Connected', shortAddr(address) + ' on BNB Testnet.', 'success')
      await loadBalance(w)
      await loadHistory(address)
    } catch (err) { addToast('Connection Failed', friendlyError(err.message), 'error'); setStatus('idle') }
  }, [loadBalance, loadHistory])

  var disconnect = useCallback(function() {
    setWallet(null); setBalance('0.00'); setRawBalance('0'); setStatus('idle')
    setTxHistory([]); setStep(0); setFee(null); setResult(null)
    setToAddr(''); setAmount(''); setShowQR(false); setShowShare(false); setMobileMenu(false)
    addToast('Disconnected', 'Wallet disconnected successfully.', 'info')
  }, [])

  function fillMax() {
    var bal = parseFloat(rawBalance)
    if (bal > 0) setAmount(Math.max(0, bal - bal * 0.005).toFixed(4))
  }

  var pay = useCallback(async function() {
    setResult(null)
    if (!wallet) { connect(); return }
    if (!toAddr) { addToast('Missing Recipient', 'Enter or scan the recipient wallet address.', 'warning'); return }
    if (!ethers.isAddress(toAddr)) { addToast('Invalid Address', 'Not a valid BNB/Ethereum address.', 'error'); return }
    if (!amount || parseFloat(amount) <= 0) { addToast('Invalid Amount', 'Enter an amount greater than 0.', 'warning'); return }
    var amt = parseFloat(amount)
    if (amt > parseFloat(rawBalance)) { addToast('Insufficient Balance', 'Your balance is ' + balance + ' VEC.', 'error'); return }
    if (toAddr.toLowerCase() === wallet.address.toLowerCase()) { addToast('Same Address', 'Cannot send to your own address.', 'warning'); return }
    try {
      var token     = new ethers.Contract(VEC_TOKEN_ADDRESS, VEC_ABI, wallet.signer)
      var amountWei = ethers.parseUnits(amount, 18)
      var deadline  = Math.floor(Date.now() / 1000) + 3600
      setStatus('signing'); setStep(1)
      addToast('Sign Required', 'Approve the signature in MetaMask.', 'info')
      var sig = await signPermit(wallet.signer, token, wallet.address, PAYMASTER_ADDRESS, amountWei, deadline)
      setStatus('sending'); setStep(2)
      addToast('Relaying...', 'Transaction submitted to blockchain.', 'info')
      var response = await fetch(RELAY_SERVER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: wallet.address, to: toAddr, amount: amountWei.toString(), v: sig.v, r: sig.r, s: sig.s, deadline: sig.deadline }),
      })
      var data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Relay server error.')
      setStep(3); setStatus('success')
      setResult({ hash: data.txHash, amount: amt, net: data.amountSent, gas: fee ? fee.gasCostUSD : '0.003', feeVec: data.feeCollected })
      addToast('Transfer Successful! 🎉', amt + ' VEC sent — $0.00 gas.', 'success')
      setToAddr(''); setAmount(''); setPrefillNote('')
      setTimeout(function() { loadBalance(wallet); loadHistory(wallet.address) }, 3000)
    } catch (err) { addToast('Transaction Failed', friendlyError(err.message), 'error'); setStatus('connected'); setStep(0) }
  }, [wallet, toAddr, amount, fee, connect, loadBalance, loadHistory, rawBalance, balance])

  var busy      = status === 'signing' || status === 'sending'
  var addrValid = toAddr.length > 0 && ethers.isAddress(toAddr)
  var addrTyped = toAddr.length > 0
  var payBtnText = wallet ? 'Pay Now — Gasless ⚡' : 'Connect Wallet to Pay'
  if (status === 'signing') payBtnText = '⏳  Sign in MetaMask...'
  if (status === 'sending') payBtnText = '⏳  Broadcasting...'
  var bscLink = 'https://testnet.bscscan.com/tx/' + (result ? result.hash : '')

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100">
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .fade-up { animation: fadeUp 0.35s ease-out; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
        * { box-sizing: border-box; }
      `}</style>

      <Toast toasts={toasts} remove={removeToast} />
      {showHistory && <TransactionHistory transactions={txHistory} onClose={function() { setShowHistory(false) }} />}
      {showQR && wallet && (
        <QRModal address={wallet.address} balance={balance} onClose={function() { setShowQR(false) }}
          onAddressScanned={function(addr) { setToAddr(addr); addToast('Address Scanned!', addr.slice(0,10) + '...' + addr.slice(-6) + ' filled.', 'success') }} />
      )}
      {showShare && wallet && (
        <ShareModal address={wallet.address} balance={balance} onClose={function() { setShowShare(false) }} />
      )}

      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(6,182,212,0.06), transparent 70%)' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ opacity: 0.022, backgroundImage: 'linear-gradient(#22d3ee 1px,transparent 1px),linear-gradient(90deg,#22d3ee 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#070a10]/95 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 py-3 flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src={LOGO_URL} alt="VelaCore" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl" />
            <span className="font-extrabold text-base sm:text-lg tracking-tight">VelaCore</span>
            <span className="text-xs font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-2 py-0.5">VEC</span>
            <span className="hidden xl:block text-xs text-slate-500 border border-white/8 rounded-full px-3 py-1">Gasless Gateway</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            <ServerStatus online={serverOnline} />
            <Badge status={status} />
            {wallet && (
              <>
                <button onClick={function() { setShowQR(true) }} className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 border border-white/8 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 text-xs font-bold px-3 py-2 rounded-full transition-all">
                  <span>⬛</span><span className="hidden lg:block">QR</span>
                </button>
                <button onClick={function() { setShowShare(true) }} className="flex items-center gap-1.5 bg-[#075E54]/15 hover:bg-[#075E54]/30 border border-[#25D366]/15 hover:border-[#25D366]/30 text-[#25D366] text-xs font-bold px-3 py-2 rounded-full transition-all">
                  <span>🔗</span><span className="hidden lg:block">Share Link</span>
                </button>
                <button onClick={function() { setShowHistory(true) }} className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 border border-white/8 text-slate-300 text-xs font-bold px-3 py-2 rounded-full transition-all">
                  <span>📋</span><span>{historyLoading ? '...' : 'History (' + txHistory.length + ')'}</span>
                </button>
              </>
            )}
            {wallet ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-800/60 border border-white/8 rounded-full px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] flex-shrink-0" />
                  <span className="text-xs font-mono text-slate-300">{shortAddr(wallet.address)}</span>
                  <CopyBtn text={wallet.address} />
                  <span className="text-xs font-bold text-cyan-400 border-l border-white/10 pl-2 hidden lg:block">{balance} VEC</span>
                </div>
                <button onClick={disconnect} title="Disconnect" className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-red-900/50 border border-white/8 hover:border-red-500/50 flex items-center justify-center transition-all group">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover:text-red-400 transition-colors">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button onClick={connect} className="bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white text-sm font-bold px-5 py-2 rounded-full transition-all shadow-lg shadow-cyan-500/20">
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile right */}
          <div className="flex md:hidden items-center gap-2">
            <ServerStatus online={serverOnline} />
            {wallet ? (
              <div className="flex items-center gap-1.5 bg-slate-800/60 border border-white/8 rounded-full px-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] flex-shrink-0" />
                <span className="text-xs font-mono text-slate-300">{shortAddr(wallet.address)}</span>
              </div>
            ) : null}
            <button onClick={function() { setMobileMenu(function(v) { return !v }) }}
              className="w-9 h-9 rounded-full bg-slate-800 border border-white/8 flex items-center justify-center text-slate-400">
              {mobileMenu ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden border-t border-white/5 bg-[#070a10]/98 px-4 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Badge status={status} />
              {wallet && <span className="text-xs font-bold text-cyan-400">{balance} VEC</span>}
            </div>
            {wallet ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={function() { setShowQR(true); setMobileMenu(false) }} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 border border-white/8 text-slate-300 text-sm font-bold">
                    <span>⬛</span> QR Code
                  </button>
                  <button onClick={function() { setShowShare(true); setMobileMenu(false) }} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#075E54]/20 border border-[#25D366]/20 text-[#25D366] text-sm font-bold">
                    <span>🔗</span> Share Link
                  </button>
                  <button onClick={function() { setShowHistory(true); setMobileMenu(false) }} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 border border-white/8 text-slate-300 text-sm font-bold col-span-2">
                    📋 History ({txHistory.length})
                  </button>
                </div>
                <button onClick={disconnect} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-900/20 border border-red-500/20 text-red-400 text-sm font-bold w-full">
                  Disconnect Wallet
                </button>
              </>
            ) : (
              <button onClick={connect} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold text-sm">
                Connect Wallet
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── PAYMENT LINK BANNER ── */}
      {prefillNote && (
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-5 pt-5">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-amber-400 text-lg flex-shrink-0">💳</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-300">Payment Request</p>
              <p className="text-xs text-slate-400 truncate">{prefillNote}</p>
            </div>
            <button onClick={function() { setPrefillNote('') }} className="text-slate-600 hover:text-slate-400 text-sm flex-shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* ── MAIN ── */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-5 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">

        {/* LEFT */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Hero */}
          <div className="rounded-2xl border border-white/6 bg-gradient-to-br from-slate-800/30 to-transparent p-5 sm:p-6 fade-up">
            <div className="flex items-start gap-3 sm:gap-4 mb-4">
              <img src={LOGO_URL} alt="" className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight">Gasless VEC Transfers</h1>
                <p className="text-xs text-cyan-400 font-medium mt-0.5">ERC-4337 · EIP-712 · Zero Gas</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Send VEC to anyone without BNB. Merchants share a QR or payment link — customers pay in seconds, completely gasless.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ boxShadow: '0 0 8px rgba(6,182,212,0.5)' }} />
              </div>
              <span className="text-xs font-bold text-emerald-400 whitespace-nowrap">Gas Tank: Funded</span>
            </div>
          </div>

          {/* Send Form */}
          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-5 sm:p-6 flex flex-col gap-5 fade-up">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold">Send VEC</h2>
              {wallet && <span className="text-xs text-slate-500">Balance: <span className="text-cyan-400 font-bold">{balance} VEC</span></span>}
            </div>

            {/* Recipient */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recipient Address</label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text" placeholder="0x... or scan QR →"
                    value={toAddr} onChange={function(e) { setToAddr(e.target.value.trim()) }}
                    className={'w-full bg-slate-800/60 border outline-none rounded-xl px-4 py-3 text-sm font-mono placeholder-slate-700 transition-all ' +
                      (addrTyped ? (addrValid ? 'border-emerald-500/60 text-slate-100 pr-16' : 'border-red-500/60 text-red-200 pr-10') : 'border-white/8 text-slate-100 focus:border-cyan-500/60')}
                  />
                  {addrTyped && (
                    <span className={'absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-0.5 rounded-full ' + (addrValid ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10')}>
                      {addrValid ? '✓ Valid' : '✕'}
                    </span>
                  )}
                </div>
                {wallet && (
                  <button onClick={function() { setShowQR(true) }} className="flex items-center justify-center gap-1 px-3 sm:px-4 rounded-xl bg-slate-800/80 hover:bg-cyan-500/10 border border-white/8 hover:border-cyan-500/30 text-slate-400 hover:text-cyan-400 transition-all flex-shrink-0">
                    <span className="text-base">📷</span>
                    <span className="hidden sm:block text-xs font-bold">Scan</span>
                  </button>
                )}
              </div>
              {addrTyped && !addrValid && (
                <p className="text-xs text-red-400/80 flex items-center gap-1.5">⚠ Must start with 0x followed by 40 hex characters</p>
              )}
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Amount (VEC)</label>
                {wallet && parseFloat(rawBalance) > 0 && (
                  <button onClick={fillMax} className="text-xs font-bold text-cyan-400 hover:text-white bg-cyan-400/10 hover:bg-cyan-500 border border-cyan-400/20 hover:border-cyan-500 rounded-lg px-3 py-1 transition-all">
                    MAX
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number" placeholder="0.00" min="0"
                  value={amount} onChange={function(e) { setAmount(e.target.value) }}
                  onWheel={function(e) { e.target.blur() }}
                  className="w-full bg-slate-800/60 border border-white/8 focus:border-cyan-500/60 outline-none rounded-xl px-4 py-3 pr-16 text-sm text-slate-100 placeholder-slate-700 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-cyan-400">VEC</span>
              </div>
              {wallet && amount && parseFloat(amount) > parseFloat(rawBalance) && (
                <p className="text-xs text-red-400/80 flex items-center gap-1.5">⚠ Exceeds balance of {balance} VEC</p>
              )}
            </div>

            {/* Fee preview */}
            {fee && (
              <div className="rounded-xl border border-white/6 bg-slate-800/30 p-4 flex flex-col gap-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Transaction Preview</p>
                <div className="flex justify-between text-sm"><span className="text-slate-400">You Send</span><span className="font-bold text-slate-200">{parseFloat(amount).toFixed(4)} VEC</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Platform Fee (0.5%)</span><span className="font-mono text-amber-400">− {fee.feeVec} VEC</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Gas Cost</span><span className="font-bold text-emerald-400">$0.00 (Sponsored)</span></div>
                <div className="border-t border-white/6 pt-2 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-200">Recipient Gets</span>
                  <span className="text-lg font-extrabold text-emerald-400">{fee.netRevenue} VEC</span>
                </div>
              </div>
            )}

            <button onClick={pay} disabled={busy}
              className={'w-full py-4 rounded-xl font-extrabold text-base transition-all duration-200 ' +
                (busy ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.01] active:scale-[0.99]')}>
              {payBtnText}
            </button>
            <p className="text-center text-xs text-slate-700">MetaMask Sign Message — no BNB required</p>
          </div>

          {/* Flow */}
          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-5 sm:p-6 fade-up">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">How It Works</p>
            <div className="flex flex-col gap-3 sm:gap-4">
              <FlowStep num={1} active={step===1} done={step>1} title="Sign Permit (EIP-712)"       desc="Off-chain signature — no gas, no on-chain approval" />
              <FlowStep num={2} active={step===2} done={step>2} title="Relay Submits UserOperation" desc="Signed message sent to BNB bundler" />
              <FlowStep num={3} active={step===2} done={step>2} title="Paymaster Sponsors Gas"      desc="0.5% fee covers BNB gas — user pays nothing" />
              <FlowStep num={4} active={false}    done={step===3} title="Confirmed On-Chain"        desc="Recipient gets VEC — verifiable on BscScan" />
            </div>
          </div>

          {/* Success */}
          {result && (
            <div className="rounded-2xl border border-emerald-500/25 p-5 sm:p-6 flex flex-col gap-4 fade-up" style={{ background: 'linear-gradient(135deg, rgba(16,42,30,0.8), rgba(7,10,16,0.9))', boxShadow: '0 0 40px rgba(52,211,153,0.08)' }}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: '0 0 24px rgba(16,185,129,0.4)' }}>✓</div>
                <div><p className="font-extrabold text-emerald-300 text-lg sm:text-xl">Transfer Complete!</p><p className="text-xs text-slate-400 mt-0.5">Confirmed on BNB Testnet</p></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[['Sent', result.amount + ' VEC', 'text-slate-200'], ['Received', result.net + ' VEC', 'text-emerald-400'], ['Gas Paid', '$0.00', 'text-cyan-400'], ['Fee', result.feeVec + ' VEC', 'text-amber-400']].map(function(item) {
                  return (
                    <div key={item[0]} className="bg-slate-800/40 rounded-xl p-3 border border-white/5">
                      <p className="text-xs text-slate-500 mb-1">{item[0]}</p>
                      <p className={'font-bold text-sm ' + item[2]}>{item[1]}</p>
                    </div>
                  )
                })}
              </div>
              <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-slate-500">Transaction Hash</p>
                  <CopyBtn text={result.hash} />
                </div>
                <p className="font-mono text-xs text-slate-400 break-all leading-relaxed">{result.hash}</p>
              </div>
              <a href={bscLink} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-xl border border-cyan-500/25 bg-cyan-500/8 text-cyan-400 hover:bg-cyan-500/15 font-bold text-sm transition-all">
                View on BscScan ↗
              </a>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-5">

          {/* Dashboard */}
          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-5 fade-up">
            <div className="flex items-center gap-2 mb-1">
              <img src={LOGO_URL} alt="" className="w-5 h-5 opacity-80" />
              <h2 className="font-extrabold text-base">Dashboard</h2>
            </div>
            <p className="text-xs text-slate-600 mb-4">All-time stats — this wallet</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Gas Saved"    value={'$' + stats.gasSaved} sub="USD saved"     color="cyan"    />
              <StatCard label="Transactions" value={stats.txCount}         sub="Total gasless" color="violet"  />
              <StatCard label="Total Sent"   value={stats.totalVEC}        sub="VEC all-time"  color="emerald" />
              <StatCard label="Fees Paid"    value={stats.feeColl}         sub="VEC (0.5%)"    color="amber"   />
            </div>
          </div>

          {/* Quick Actions */}
          {wallet && (
            <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-5 fade-up">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={function() { setShowQR(true) }} className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-slate-800/60 border border-white/6 hover:border-cyan-500/30 hover:bg-slate-800 transition-all group">
                  <span className="text-xl">⬛</span>
                  <span className="text-xs font-bold text-slate-500 group-hover:text-cyan-400 transition-colors text-center leading-tight">My QR</span>
                </button>
                <button onClick={function() { setShowQR(true) }} className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-slate-800/60 border border-white/6 hover:border-violet-500/30 hover:bg-slate-800 transition-all group">
                  <span className="text-xl">📷</span>
                  <span className="text-xs font-bold text-slate-500 group-hover:text-violet-400 transition-colors text-center leading-tight">Scan & Pay</span>
                </button>
                <button onClick={function() { setShowShare(true) }} className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-[#075E54]/15 border border-[#25D366]/15 hover:border-[#25D366]/35 hover:bg-[#075E54]/25 transition-all group">
                  <span className="text-xl">🔗</span>
                  <span className="text-xs font-bold text-[#25D366]/70 group-hover:text-[#25D366] transition-colors text-center leading-tight">Share Link</span>
                </button>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-5 fade-up">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Activity</p>
              {txHistory.length > 0 && <button onClick={function() { setShowHistory(true) }} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">View all →</button>}
            </div>
            <RecentActivity history={txHistory} onViewAll={function() { setShowHistory(true) }} />
          </div>

          {/* Config */}
          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-5 fade-up">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Paymaster Config</p>
            {[['Fee Model','0.5% Merchant Fee'],['Gas Strategy','Fee → Gas Tank'],['Permit','EIP-712 / ERC-2612'],['Standard','ERC-4337'],['Network','BNB Testnet (97)']].map(function(row, i, arr) {
              return (
                <div key={row[0]} className={'flex justify-between items-center py-2 ' + (i < arr.length-1 ? 'border-b border-white/4' : '')}>
                  <span className="text-slate-500 text-xs">{row[0]}</span>
                  <span className="font-mono text-xs text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded-md border border-white/5">{row[1]}</span>
                </div>
              )
            })}
          </div>

          {/* Grant notes */}
          <div className="rounded-2xl border border-violet-500/15 bg-violet-500/4 p-5 fade-up">
            <p className="font-bold text-violet-300 text-sm mb-3">✦ Highlights</p>
            {['Zero BNB required for users','QR code for instant merchant pay','WhatsApp / Telegram payment links','EIP-712 removes on-chain approve()','Gas sponsored by platform fee','Cross-device history sync'].map(function(item) {
              return (
                <div key={item} className="flex items-start gap-2 py-0.5">
                  <span className="text-violet-500 text-xs mt-0.5 flex-shrink-0">◆</span>
                  <p className="text-xs text-slate-400">{item}</p>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/4 mt-4 py-5 text-center px-4">
        <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
          <img src={LOGO_URL} alt="" className="w-4 h-4 opacity-40" />
          <span className="text-xs text-slate-700">VelaCore (VEC) — Gasless Merchant Gateway — BNB Smart Chain</span>
        </div>
        <span className="text-xs text-slate-800">Powered by ERC-4337 Account Abstraction</span>
      </footer>
    </div>
  )
}