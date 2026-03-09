import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'

function CopyBtn({ text, label }) {
  var [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(function() {
      setCopied(true)
      setTimeout(function() { setCopied(false) }, 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className={'flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all ' +
        (copied
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-slate-700/80 hover:bg-slate-600 text-slate-300 border border-white/8')}
    >
      {copied ? '✓ Copied!' : (label || '⎘ Copy')}
    </button>
  )
}

export default function ShareModal({ address, balance, onClose }) {
  var [amount,   setAmount]   = useState('')
  var [note,     setNote]     = useState('')
  var [link,     setLink]     = useState('')
  var [showQR,   setShowQR]   = useState(false)

  useEffect(function() {
    var base   = window.location.origin + window.location.pathname
    var params = new URLSearchParams()
    params.set('to', address)
    if (amount && parseFloat(amount) > 0) params.set('amount', amount)
    if (note.trim()) params.set('note', note.trim())
    setLink(base + '?' + params.toString())
  }, [address, amount, note])

  function shareWhatsApp() {
    var text = '💳 *VEC Payment Request*\n\n'
    if (note.trim()) text += '📝 ' + note.trim() + '\n'
    if (amount && parseFloat(amount) > 0) text += '💰 Amount: *' + amount + ' VEC*\n'
    text += '\n🔗 Pay here (gasless — no BNB needed):\n' + link
    var url = 'https://wa.me/?text=' + encodeURIComponent(text)
    window.open(url, '_blank')
  }

  function shareTelegram() {
    var text = '💳 VEC Payment Request'
    if (note.trim()) text += ' — ' + note.trim()
    if (amount) text += ' (' + amount + ' VEC)'
    var url = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text)
    window.open(url, '_blank')
  }

  function shareNative() {
    if (navigator.share) {
      navigator.share({
        title: 'VEC Payment Request',
        text:  note.trim() || 'Pay me with VEC — gasless!',
        url:   link,
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-md bg-[#0d1117] border border-white/8 rounded-2xl flex flex-col max-h-[92vh] overflow-hidden"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.8)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20 flex items-center justify-center text-lg">
              🔗
            </div>
            <div>
              <h2 className="text-sm font-extrabold">Share Payment Link</h2>
              <p className="text-xs text-slate-600">Customer clicks → pays instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-white/8 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">

          {/* Your address info */}
          <div className="bg-slate-800/40 border border-white/6 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Receiving Wallet</p>
              <p className="font-mono text-xs text-slate-300">{address.slice(0, 10)}...{address.slice(-6)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-0.5">Balance</p>
              <p className="text-xs font-bold text-cyan-400">{balance} VEC</p>
            </div>
          </div>

          {/* Optional amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Amount (Optional)
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="Leave empty for customer to choose"
                min="0"
                value={amount}
                onChange={function(e) { setAmount(e.target.value) }}
                onWheel={function(e) { e.target.blur() }}
                className="w-full bg-slate-800/60 border border-white/8 focus:border-cyan-500/60 outline-none rounded-xl px-4 py-3 pr-16 text-sm text-slate-100 placeholder-slate-700 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-cyan-400">VEC</span>
            </div>
          </div>

          {/* Note / purpose */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Note / Purpose (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Order #123 — Home Delivery"
              value={note}
              maxLength={80}
              onChange={function(e) { setNote(e.target.value) }}
              className="w-full bg-slate-800/60 border border-white/8 focus:border-cyan-500/60 outline-none rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-700 transition-all"
            />
            <p className="text-xs text-slate-700 text-right">{note.length}/80</p>
          </div>

          {/* Generated link */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Generated Payment Link
            </label>
            <div className="bg-slate-900/60 border border-white/6 rounded-xl p-3">
              <p className="font-mono text-xs text-slate-400 break-all leading-relaxed line-clamp-3">{link}</p>
            </div>
            <CopyBtn text={link} label="⎘ Copy Link" />
          </div>

          {/* QR Code toggle */}
          <button
            onClick={function() { setShowQR(function(v) { return !v }) }}
            className={'text-xs font-bold px-4 py-2.5 rounded-xl border transition-all flex items-center justify-center gap-2 ' +
              (showQR
                ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                : 'bg-slate-800/60 border-white/8 text-slate-400 hover:text-slate-200')}
          >
            <span>⬛</span>
            <span>{showQR ? 'Hide QR Code' : 'Show as QR Code'}</span>
          </button>

          {showQR && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="bg-white p-4 rounded-2xl border border-white/10 shadow-2xl shadow-cyan-500/10">
                <QRCodeSVG
                  value={link}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#0a0d14"
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-xs text-slate-600 text-center">Customer can scan this to open payment form</p>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-slate-600">Share Via</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-2 gap-3">

            {/* WhatsApp */}
            <button
              onClick={shareWhatsApp}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-[#075E54]/20 hover:bg-[#075E54]/35 border border-[#25D366]/20 hover:border-[#25D366]/40 text-[#25D366] font-bold text-sm transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>

            {/* Telegram */}
            <button
              onClick={shareTelegram}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-[#0088cc]/15 hover:bg-[#0088cc]/25 border border-[#0088cc]/20 hover:border-[#0088cc]/40 text-[#29b6f6] font-bold text-sm transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Telegram
            </button>

            {/* Copy Link */}
            <button
              onClick={function() { navigator.clipboard.writeText(link) }}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-white/8 hover:border-white/15 text-slate-300 font-bold text-sm transition-all"
            >
              <span className="text-base">⎘</span>
              Copy Link
            </button>

            {/* Native Share (mobile) */}
            <button
              onClick={shareNative}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/15 hover:border-violet-500/30 text-violet-400 font-bold text-sm transition-all"
            >
              <span className="text-base">↗</span>
              More Apps
            </button>

          </div>

          {/* Info box */}
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 flex flex-col gap-1.5">
            <p className="text-xs font-bold text-amber-400">How it works for customer</p>
            <div className="flex items-start gap-2 text-xs text-slate-400">
              <span className="text-amber-500 flex-shrink-0">1.</span>
              <span>Customer opens the link on any device</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-400">
              <span className="text-amber-500 flex-shrink-0">2.</span>
              <span>Your address {amount ? 'and amount are' : 'is'} pre-filled automatically</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-400">
              <span className="text-amber-500 flex-shrink-0">3.</span>
              <span>Customer connects MetaMask → signs → done ⚡</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-400">
              <span className="text-amber-500 flex-shrink-0">✓</span>
              <span className="text-emerald-400/80">Zero BNB needed — Paymaster covers gas</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}