import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ethers } from 'ethers'
import { VEC_TOKEN_ADDRESS, PAYMASTER_ADDRESS, RELAY_SERVER_URL, LOGO_URL, BNB_TESTNET, VEC_ABI } from './config.js'
import { signPermit, calcFee, shortAddr } from './helpers.js'
import { Badge, StatCard, FlowStep } from './components.jsx'
import TransactionHistory from './TransactionHistory.jsx'
import QRModal from './QRModal.jsx'

function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Please try again.'
  var m = msg.toLowerCase()
  if (m.includes('user rejected') || m.includes('user denied'))
    return 'You cancelled the signature request in MetaMask.'
  if (m.includes('insufficient') || m.includes('balance'))
    return 'Insufficient VEC balance for this transaction.'
  if (m.includes('nonce'))
    return 'Nonce error — please refresh the page and try again.'
  if (m.includes('deadline') || m.includes('expired'))
    return 'Signature expired — please try the transaction again.'
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch'))
    return 'Cannot reach relay server. Make sure it is running on port 3001.'
  if (m.includes('relay server'))
    return 'Relay server returned an error. Check that the relayer has BNB for gas.'
  if (m.includes('permit'))
    return 'Permit signing failed. Make sure you are on BNB Testnet.'
  if (m.includes('invalid') && m.includes('address'))
    return 'Invalid wallet address. Please double-check the recipient address.'
  if (m.includes('metamask') || m.includes('provider'))
    return 'MetaMask not detected. Please install MetaMask and refresh.'
  if (m.includes('chain') || m.includes('network'))
    return 'Wrong network. Please switch to BNB Smart Chain Testnet in MetaMask.'
  return msg
}

function Toast({ toasts, remove }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2.5 pointer-events-none" style={{ maxWidth: '380px' }}>
      {toasts.map(function(t) {
        var icon   = t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'
        var colors = t.type === 'success'
          ? 'bg-[#0d2218] border-emerald-500/50 text-emerald-100 shadow-emerald-900/40'
          : t.type === 'error'
          ? 'bg-[#1f0d0d] border-red-500/50 text-red-100 shadow-red-900/40'
          : t.type === 'warning'
          ? 'bg-[#1f1800] border-amber-500/50 text-amber-100 shadow-amber-900/40'
          : 'bg-[#0d1520] border-cyan-500/30 text-cyan-100 shadow-cyan-900/30'
        var iconColor = t.type === 'success' ? 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30'
          : t.type === 'error'   ? 'text-red-400 bg-red-400/15 border-red-400/30'
          : t.type === 'warning' ? 'text-amber-400 bg-amber-400/15 border-amber-400/30'
          : 'text-cyan-400 bg-cyan-400/15 border-cyan-400/30'
        return (
          <div
            key={t.id}
            className={'pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl text-sm font-medium ' + colors}
            style={{ animation: 'slideIn 0.25s ease-out' }}
          >
            <div className={'w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs ' + iconColor}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-snug">{t.title}</p>
              {t.desc && <p className="text-xs opacity-70 mt-0.5 leading-snug">{t.desc}</p>}
            </div>
            <button onClick={function() { remove(t.id) }} className="opacity-40 hover:opacity-80 text-lg leading-none flex-shrink-0 mt-0.5">×</button>
          </div>
        )
      })}
    </div>
  )
}

function CopyBtn({ text, label }) {
  var [copied, setCopied] = useState(false)
  function copy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(function() {
      setCopied(true)
      setTimeout(function() { setCopied(false) }, 1800)
    })
  }
  return (
    <button
      onClick={copy}
      className={'text-xs px-2 py-0.5 rounded-md transition-all font-medium ' + (copied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/80 hover:bg-slate-600 text-slate-400 hover:text-slate-200 border border-slate-600/50')}
    >
      {copied ? '✓ Copied' : (label || 'Copy')}
    </button>
  )
}

function ServerStatus({ online }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-700/60 bg-slate-800/60">
      <span className={'w-2 h-2 rounded-full flex-shrink-0 transition-all ' +
        (online === true  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' :
         online === false ? 'bg-red-400 shadow-[0_0_6px_#f87171]' :
         'bg-yellow-400 animate-pulse')} />
      <span className="text-xs font-medium text-slate-400 hidden md:block">
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
        var timeStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) + ' · ' +
          d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        return (
          <a
            key={tx.hash}
            href={'https://testnet.bscscan.com/tx/' + tx.hash}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl bg-slate-800/50 border border-slate-700/40 px-3 py-2.5 hover:border-cyan-500/30 hover:bg-slate-800 transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-400 text-sm font-bold">↑</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200">{parseFloat(tx.amount).toFixed(2)} VEC</p>
                <p className="text-xs text-slate-600 font-mono">→ {tx.to.slice(0, 6)}...{tx.to.slice(-4)}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="text-xs font-bold text-emerald-400">$0 gas</p>
              <p className="text-xs text-slate-600">{timeStr}</p>
            </div>
          </a>
        )
      })}
      {history.length > 4 && (
        <button onClick={onViewAll} className="text-xs text-center text-cyan-400 hover:text-cyan-300 py-1.5 transition-colors">
          +{history.length - 4} more transactions →
        </button>
      )}
    </div>
  )
}

export default function App() {
  var [wallet,         setWallet]         = useState(null)
  var [balance,        setBalance]        = useState('0.00')
  var [rawBalance,     setRawBalance]     = useState('0')
  var [status,         setStatus]         = useState('idle')
  var [step,           setStep]           = useState(0)
  var [toAddr,         setToAddr]         = useState('')
  var [amount,         setAmount]         = useState('')
  var [fee,            setFee]            = useState(null)
  var [result,         setResult]         = useState(null)
  var [txHistory,      setTxHistory]      = useState([])
  var [showHistory,    setShowHistory]    = useState(false)
  var [showQR,         setShowQR]         = useState(false)
  var [historyLoading, setHistoryLoading] = useState(false)
  var [serverOnline,   setServerOnline]   = useState(null)
  var [toasts,         setToasts]         = useState([])
  var toastId = useRef(0)

  var stats = useMemo(function() {
    if (!txHistory || txHistory.length === 0) {
      return { gasSaved: '0.000', txCount: 0, revenue: '0.00', feeColl: '0.000', totalVEC: '0.00' }
    }
    var txCount  = txHistory.length
    var feeColl  = txHistory.reduce(function(s, tx) { return s + parseFloat(tx.feeVec  || 0) }, 0)
    var revenue  = txHistory.reduce(function(s, tx) { return s + parseFloat(tx.net     || 0) }, 0)
    var totalVEC = txHistory.reduce(function(s, tx) { return s + parseFloat(tx.amount  || 0) }, 0)
    var gasSaved = txCount * 0.003
    return {
      gasSaved: gasSaved.toFixed(3),
      txCount:  txCount,
      revenue:  revenue.toFixed(2),
      feeColl:  feeColl.toFixed(3),
      totalVEC: totalVEC.toFixed(2),
    }
  }, [txHistory])

  function addToast(title, desc, type) {
    var id = toastId.current++
    setToasts(function(p) { return [...p, { id: id, title: title, desc: desc || '', type: type || 'info' }] })
    setTimeout(function() {
      setToasts(function(p) { return p.filter(function(t) { return t.id !== id }) })
    }, 5000)
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
      fetch('http://localhost:3001/status')
        .then(function(r) { return r.json() })
        .then(function(d) { setServerOnline(d.healthy !== false) })
        .catch(function() { setServerOnline(false) })
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
    } catch (e) {
      setBalance('0.00')
      setRawBalance('0')
    }
  }, [])

  var loadHistory = useCallback(async function(address) {
    if (!address) return
    setHistoryLoading(true)
    try {
      var res  = await fetch('http://localhost:3001/history/' + address)
      var data = await res.json()
      if (data.success) setTxHistory(data.history)
    } catch (e) {}
    setHistoryLoading(false)
  }, [])

  var connect = useCallback(async function() {
    if (!window.ethereum) {
      addToast('MetaMask Not Found', 'Please install the MetaMask browser extension to continue.', 'error')
      return
    }
    setStatus('connecting')
    try {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BNB_TESTNET.chainId }] })
      } catch (switchErr) {
        if (switchErr.code === 4902 || switchErr.code === -32603) {
          try {
            await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [BNB_TESTNET] })
          } catch (e) {
            throw new Error('Please manually switch to BNB Smart Chain Testnet in MetaMask.')
          }
        } else {
          throw new Error('Please manually switch to BNB Smart Chain Testnet in MetaMask.')
        }
      }
      var provider = new ethers.BrowserProvider(window.ethereum)
      var signer   = await provider.getSigner()
      var address  = await signer.getAddress()
      var w = { address, signer, provider }
      setWallet(w)
      setStatus('connected')
      addToast('Wallet Connected', shortAddr(address) + ' connected on BNB Testnet.', 'success')
      await loadBalance(w)
      await loadHistory(address)
    } catch (err) {
      addToast('Connection Failed', friendlyError(err.message), 'error')
      setStatus('idle')
    }
  }, [loadBalance, loadHistory])

  var disconnect = useCallback(function() {
    setWallet(null)
    setBalance('0.00')
    setRawBalance('0')
    setStatus('idle')
    setTxHistory([])
    setStep(0)
    setFee(null)
    setResult(null)
    setToAddr('')
    setAmount('')
    setShowQR(false)
    addToast('Wallet Disconnected', 'You have been disconnected successfully.', 'info')
  }, [])

  function fillMax() {
    var bal = parseFloat(rawBalance)
    if (bal > 0) setAmount(Math.max(0, bal - bal * 0.005).toFixed(4))
  }

  var pay = useCallback(async function() {
    setResult(null)
    if (!wallet) { connect(); return }
    if (!toAddr) {
      addToast('Missing Recipient', 'Please enter or scan the wallet address you want to send VEC to.', 'warning')
      return
    }
    if (!ethers.isAddress(toAddr)) {
      addToast('Invalid Address', 'The recipient address is not a valid BNB/Ethereum address. Check for typos.', 'error')
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      addToast('Invalid Amount', 'Please enter an amount greater than 0 to continue.', 'warning')
      return
    }
    var amt = parseFloat(amount)
    if (amt > parseFloat(rawBalance)) {
      addToast('Insufficient Balance', 'You do not have enough VEC. Your balance is ' + balance + ' VEC.', 'error')
      return
    }
    if (toAddr.toLowerCase() === wallet.address.toLowerCase()) {
      addToast('Same Address', 'You cannot send VEC to your own wallet address.', 'warning')
      return
    }
    try {
      var token     = new ethers.Contract(VEC_TOKEN_ADDRESS, VEC_ABI, wallet.signer)
      var amountWei = ethers.parseUnits(amount, 18)
      var deadline  = Math.floor(Date.now() / 1000) + 3600
      setStatus('signing')
      setStep(1)
      addToast('Sign Required', 'Check MetaMask — approve the signature to authorize this transfer.', 'info')
      var sig = await signPermit(wallet.signer, token, wallet.address, PAYMASTER_ADDRESS, amountWei, deadline)
      setStatus('sending')
      setStep(2)
      addToast('Relaying...', 'Transaction submitted to the blockchain. Please wait.', 'info')
      var response = await fetch(RELAY_SERVER_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: wallet.address, to: toAddr,
          amount: amountWei.toString(),
          v: sig.v, r: sig.r, s: sig.s, deadline: sig.deadline,
        }),
      })
      var data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Relay server error.')
      setStep(3)
      setStatus('success')
      setResult({ hash: data.txHash, amount: amt, net: data.amountSent, gas: fee ? fee.gasCostUSD : '0.003', feeVec: data.feeCollected })
      addToast('Transfer Successful! 🎉', amt + ' VEC sent — $0.00 gas paid.', 'success')
      setToAddr('')
      setAmount('')
      setTimeout(function() { loadBalance(wallet); loadHistory(wallet.address) }, 3000)
    } catch (err) {
      addToast('Transaction Failed', friendlyError(err.message), 'error')
      setStatus('connected')
      setStep(0)
    }
  }, [wallet, toAddr, amount, fee, connect, loadBalance, loadHistory, rawBalance, balance])

  var busy      = status === 'signing' || status === 'sending'
  var addrValid = toAddr && ethers.isAddress(toAddr)
  var addrTyped = toAddr.length > 0

  var payBtnText = wallet ? 'Pay Now — Gasless ⚡' : 'Connect Wallet to Pay'
  if (status === 'signing') payBtnText = '⏳  Sign in MetaMask...'
  if (status === 'sending') payBtnText = '⏳  Broadcasting Transaction...'

  var bscLink = 'https://testnet.bscscan.com/tx/' + (result ? result.hash : '')

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100" style={{ fontFamily: "'Inter', sans-serif" }}>

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .fade-up { animation: fadeUp 0.4s ease-out; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <Toast toasts={toasts} remove={removeToast} />

      {showHistory && (
        <TransactionHistory transactions={txHistory} onClose={function() { setShowHistory(false) }} />
      )}

      {showQR && wallet && (
        <QRModal
          address={wallet.address}
          balance={balance}
          onClose={function() { setShowQR(false) }}
          onAddressScanned={function(addr) {
            setToAddr(addr)
            addToast('Address Scanned!', addr.slice(0, 10) + '...' + addr.slice(-6) + ' filled in.', 'success')
          }}
        />
      )}

      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(6,182,212,0.06), transparent 70%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139,92,246,0.04), transparent)' }} />
      <div className="fixed inset-0 pointer-events-none" style={{ opacity: 0.025, backgroundImage: 'linear-gradient(#22d3ee 1px,transparent 1px),linear-gradient(90deg,#22d3ee 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#070a10]/95 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="VelaCore" className="w-9 h-9 rounded-xl" />
            <span className="font-extrabold text-lg tracking-tight">VelaCore</span>
            <span className="text-xs font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-2.5 py-0.5">VEC</span>
            <span className="hidden md:block text-xs text-slate-500 border border-white/8 rounded-full px-3 py-1">Gasless Gateway</span>
          </div>

          <div className="flex items-center gap-2.5">
            <ServerStatus online={serverOnline} />
            <Badge status={status} />

            {wallet && (
              <>
                {/* QR Button */}
                <button
                  onClick={function() { setShowQR(true) }}
                  title="My QR Code & Scanner"
                  className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-white/8 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 text-xs font-bold px-3 py-2 rounded-full transition-all"
                >
                  <span className="text-base leading-none">⬛</span>
                  <span className="hidden sm:block">QR</span>
                </button>

                {/* History Button */}
                <button
                  onClick={function() { setShowHistory(true) }}
                  className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-white/8 text-slate-300 text-xs font-bold px-3.5 py-2 rounded-full transition-all"
                >
                  <span>📋</span>
                  <span>{historyLoading ? '...' : 'History (' + txHistory.length + ')'}</span>
                </button>
              </>
            )}

            {wallet ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-800/60 border border-white/8 rounded-full px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] flex-shrink-0" />
                  <span className="text-xs font-mono text-slate-300">{shortAddr(wallet.address)}</span>
                  <CopyBtn text={wallet.address} />
                  <span className="text-xs font-bold text-cyan-400 border-l border-white/10 pl-2">{balance} VEC</span>
                </div>

                {/* Disconnect — power icon */}
                <button
                  onClick={disconnect}
                  title="Disconnect Wallet"
                  className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-red-900/50 border border-white/8 hover:border-red-500/50 flex items-center justify-center transition-all group"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover:text-red-400 transition-colors">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                    <line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                className="bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white text-sm font-bold px-5 py-2 rounded-full transition-all shadow-lg shadow-cyan-500/20"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-5 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 flex flex-col gap-5">

          <div className="rounded-2xl border border-white/6 bg-gradient-to-br from-slate-800/30 to-transparent p-6 fade-up">
            <div className="flex items-start gap-4 mb-4">
              <img src={LOGO_URL} alt="VelaCore" className="w-11 h-11 rounded-xl flex-shrink-0" />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Gasless VEC Transfers</h1>
                <p className="text-xs text-cyan-400 font-medium mt-0.5">ERC-4337 Account Abstraction · EIP-712 Permit · Zero Gas</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">
              Send VEC tokens to anyone without holding BNB. Merchants can share their QR code — customers scan and pay in seconds, completely gasless.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ boxShadow: '0 0 10px rgba(6,182,212,0.5)' }} />
              </div>
              <span className="text-xs font-bold text-emerald-400">Gas Tank: Funded</span>
              <span className="text-xs text-slate-600">80%</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-6 flex flex-col gap-5 fade-up" style={{ backdropFilter: 'blur(16px)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">Send VEC</h2>
              {wallet && (
                <span className="text-xs text-slate-500">
                  Balance: <span className="text-cyan-400 font-bold">{balance} VEC</span>
                </span>
              )}
            </div>

            {/* Recipient */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recipient Address</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="0x... or scan QR code →"
                    value={toAddr}
                    onChange={function(e) { setToAddr(e.target.value.trim()) }}
                    className={'w-full bg-slate-800/60 border outline-none rounded-xl px-4 py-3 text-sm font-mono placeholder-slate-700 transition-all pr-20 ' +
                      (addrTyped && addrValid  ? 'border-emerald-500/60 text-slate-100 focus:border-emerald-400' :
                       addrTyped && !addrValid ? 'border-red-500/60 text-red-200 focus:border-red-400' :
                       'border-white/8 text-slate-100 focus:border-cyan-500/60')}
                  />
                  {addrTyped && (
                    <span className={'absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-0.5 rounded-full ' +
                      (addrValid ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10')}>
                      {addrValid ? '✓' : '✕'}
                    </span>
                  )}
                </div>
                {/* Scan QR button inline */}
                {wallet && (
                  <button
                    onClick={function() { setShowQR(true) }}
                    title="Scan QR Code"
                    className="flex items-center justify-center gap-1.5 px-4 rounded-xl bg-slate-800/80 hover:bg-cyan-500/10 border border-white/8 hover:border-cyan-500/30 text-slate-400 hover:text-cyan-400 font-bold text-sm transition-all flex-shrink-0"
                  >
                    <span className="text-base">📷</span>
                    <span className="hidden sm:block text-xs">Scan</span>
                  </button>
                )}
              </div>
              {addrTyped && !addrValid && (
                <p className="text-xs text-red-400/80 flex items-center gap-1.5">
                  <span>⚠</span> A valid address starts with 0x followed by 40 hex characters
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Amount</label>
                {wallet && parseFloat(rawBalance) > 0 && (
                  <button
                    onClick={fillMax}
                    className="text-xs font-bold text-cyan-400 hover:text-white bg-cyan-400/10 hover:bg-cyan-500 border border-cyan-400/20 hover:border-cyan-500 rounded-lg px-3 py-1 transition-all"
                  >
                    MAX
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  value={amount}
                  onChange={function(e) { setAmount(e.target.value) }}
                  onWheel={function(e) { e.target.blur() }}
                  className="w-full bg-slate-800/60 border border-white/8 focus:border-cyan-500/60 outline-none rounded-xl px-4 py-3 pr-16 text-sm text-slate-100 placeholder-slate-700 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-cyan-400">VEC</span>
              </div>
              {wallet && amount && parseFloat(amount) > parseFloat(rawBalance) && (
                <p className="text-xs text-red-400/80 flex items-center gap-1.5">
                  <span>⚠</span> Amount exceeds your balance of {balance} VEC
                </p>
              )}
            </div>

            {fee && (
              <div className="rounded-xl border border-white/6 bg-slate-800/30 p-4 flex flex-col gap-2.5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Transaction Preview</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">You Send</span>
                  <span className="font-bold text-slate-200">{parseFloat(amount).toFixed(4)} VEC</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Platform Fee (0.5%)</span>
                  <span className="font-mono text-amber-400">− {fee.feeVec} VEC</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Network Gas</span>
                  <span className="font-bold text-emerald-400">$0.00 (Sponsored)</span>
                </div>
                <div className="border-t border-white/6 pt-2.5 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-200">Recipient Gets</span>
                  <span className="text-lg font-extrabold text-emerald-400">{fee.netRevenue} VEC</span>
                </div>
              </div>
            )}

            <button
              onClick={pay}
              disabled={busy}
              className={'w-full py-4 rounded-xl font-extrabold text-base transition-all duration-200 ' +
                (busy
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.01] active:scale-[0.99]')}
            >
              {payBtnText}
            </button>

            <p className="text-center text-xs text-slate-700">
              MetaMask will show a Sign Message — no BNB required
            </p>
          </div>

          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-6 fade-up">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">How It Works</p>
            <div className="flex flex-col gap-4">
              <FlowStep num={1} active={step===1} done={step>1} title="Sign Permit (EIP-712)"       desc="Off-chain signature in MetaMask — no gas, no on-chain approval" />
              <FlowStep num={2} active={step===2} done={step>2} title="Relay Submits UserOperation" desc="Signed message is packed and sent to the BNB bundler" />
              <FlowStep num={3} active={step===2} done={step>2} title="Paymaster Sponsors Gas"      desc="0.5% fee covers BNB gas — user pays nothing" />
              <FlowStep num={4} active={false}    done={step===3} title="Confirmed On-Chain"        desc="Recipient receives VEC, tx verifiable on BscScan" />
            </div>
          </div>

          {result && (
            <div className="rounded-2xl border border-emerald-500/25 p-6 flex flex-col gap-4 fade-up" style={{ background: 'linear-gradient(135deg, rgba(16,42,30,0.8), rgba(7,10,16,0.9))', boxShadow: '0 0 40px rgba(52,211,153,0.08)' }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 0 24px rgba(16,185,129,0.4)' }}>✓</div>
                <div>
                  <p className="font-extrabold text-emerald-300 text-xl">Transfer Complete!</p>
                  <p className="text-xs text-slate-400 mt-0.5">Confirmed on BNB Smart Chain Testnet</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Sent',         value: result.amount + ' VEC', color: 'text-slate-200' },
                  { label: 'Received',     value: result.net + ' VEC',    color: 'text-emerald-400' },
                  { label: 'Gas Paid',     value: '$0.00',                color: 'text-cyan-400' },
                  { label: 'Platform Fee', value: result.feeVec + ' VEC', color: 'text-amber-400' },
                ].map(function(item) {
                  return (
                    <div key={item.label} className="bg-slate-800/40 rounded-xl p-3 border border-white/5">
                      <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                      <p className={'font-bold text-sm ' + item.color}>{item.value}</p>
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

        <div className="flex flex-col gap-5">

          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-5 fade-up">
            <div className="flex items-center gap-2 mb-1">
              <img src={LOGO_URL} alt="" className="w-5 h-5 opacity-80" />
              <h2 className="font-extrabold text-base">Dashboard</h2>
            </div>
            <p className="text-xs text-slate-600 mb-5">All-time stats for this wallet</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Gas Saved"      value={'$' + stats.gasSaved} sub="USD saved"      color="cyan"    />
              <StatCard label="Transactions"   value={stats.txCount}         sub="Total gasless"  color="violet"  />
              <StatCard label="Total Sent"     value={stats.totalVEC}        sub="VEC all-time"   color="emerald" />
              <StatCard label="Fees Collected" value={stats.feeColl}         sub="VEC (0.5%)"     color="amber"   />
            </div>
          </div>

          {/* QR Quick Access Card */}
          {wallet && (
            <div className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/5 to-transparent p-5 fade-up">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={function() { setShowQR(true) }}
                  className="flex flex-col items-center gap-2 py-4 rounded-xl bg-slate-800/60 border border-white/6 hover:border-cyan-500/30 hover:bg-slate-800 transition-all group"
                >
                  <span className="text-2xl">⬛</span>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-cyan-400 transition-colors">My QR Code</span>
                  <span className="text-xs text-slate-600">Receive VEC</span>
                </button>
                <button
                  onClick={function() { setShowQR(true) }}
                  className="flex flex-col items-center gap-2 py-4 rounded-xl bg-slate-800/60 border border-white/6 hover:border-violet-500/30 hover:bg-slate-800 transition-all group"
                >
                  <span className="text-2xl">📷</span>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-violet-400 transition-colors">Scan & Pay</span>
                  <span className="text-xs text-slate-600">Send VEC</span>
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-5 fade-up">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Activity</p>
              {txHistory.length > 0 && (
                <button onClick={function() { setShowHistory(true) }} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                  View all →
                </button>
              )}
            </div>
            <RecentActivity history={txHistory} onViewAll={function() { setShowHistory(true) }} />
          </div>

          <div className="rounded-2xl border border-white/6 bg-[#0d1117]/80 p-5 flex flex-col gap-0 fade-up">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Paymaster Config</p>
            {[
              ['Fee Model',    '0.5% Merchant Fee'],
              ['Gas Strategy', 'Fee → Gas Tank'],
              ['Permit Type',  'EIP-712 / ERC-2612'],
              ['AA Standard',  'ERC-4337'],
              ['Bundler',      'Stackup / Pimlico'],
              ['Network',      'BNB Testnet (97)'],
            ].map(function(row, i, arr) {
              return (
                <div key={row[0]} className={'flex justify-between items-center py-2.5 text-sm ' + (i < arr.length - 1 ? 'border-b border-white/4' : '')}>
                  <span className="text-slate-500 text-xs">{row[0]}</span>
                  <span className="font-mono text-xs text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded-md border border-white/5">{row[1]}</span>
                </div>
              )
            })}
          </div>

          <div className="rounded-2xl border border-violet-500/15 bg-violet-500/4 p-5 fade-up">
            <p className="font-bold text-violet-300 text-sm mb-3">✦ Demo Highlights</p>
            {[
              'Users need zero BNB to transact',
              'QR code for instant merchant payments',
              'Camera scanner for quick pay',
              'EIP-712 removes on-chain approve()',
              'Gas fully sponsored by platform fee',
              'Cross-device history via relay server',
            ].map(function(item) {
              return (
                <div key={item} className="flex items-center gap-2 py-1">
                  <span className="text-violet-500 text-xs">◆</span>
                  <p className="text-xs text-slate-400">{item}</p>
                </div>
              )
            })}
          </div>

        </div>
      </main>

      <footer className="relative z-10 border-t border-white/4 mt-4 py-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <img src={LOGO_URL} alt="" className="w-4 h-4 opacity-40" />
          <span className="text-xs text-slate-700">VelaCore (VEC) — Gasless Merchant Gateway — BNB Smart Chain</span>
        </div>
        <span className="text-xs text-slate-800">Powered by ERC-4337 Account Abstraction</span>
      </footer>
    </div>
  )
}