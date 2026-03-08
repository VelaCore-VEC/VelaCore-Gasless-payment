import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import jsQR from 'jsqr'

function CopyBtn({ text }) {
  var [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(function() {
      setCopied(true)
      setTimeout(function() { setCopied(false) }, 1800)
    })
  }
  return (
    <button
      onClick={copy}
      className={'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ' +
        (copied
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-white/8')}
    >
      {copied ? '✓ Copied!' : '⎘ Copy Address'}
    </button>
  )
}

// ─── QR Code Tab ─────────────────────────────────────────────────────────────
function MyQRCode({ address, balance }) {
  var [size, setSize] = useState(220)

  useEffect(function() {
    setSize(window.innerWidth < 400 ? 180 : 220)
  }, [])

  return (
    <div className="flex flex-col items-center gap-5 py-4">

      <div className="text-center">
        <p className="text-slate-300 text-sm font-medium">Your VEC Receive Address</p>
        <p className="text-slate-500 text-xs mt-1">Anyone can scan this to send you VEC — gasless</p>
      </div>

      <div className="relative">
        <div className="absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.15), transparent 70%)' }} />
        <div className="relative bg-white p-4 rounded-2xl shadow-2xl shadow-cyan-500/10 border border-white/10">
          <QRCodeSVG
            value={address}
            size={size}
            bgColor="#ffffff"
            fgColor="#0a0d14"
            level="H"
            includeMargin={false}
            imageSettings={{
              src: '',
              x: undefined,
              y: undefined,
              height: 0,
              width: 0,
              excavate: false,
            }}
          />
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, transparent 50%)',
            }}
          />
        </div>
        {/* Corner accents */}
        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />
      </div>

      <div className="w-full bg-slate-800/60 border border-white/8 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 uppercase tracking-widest">Wallet Address</span>
          <span className="text-xs font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-2 py-0.5">{balance} VEC</span>
        </div>
        <p className="font-mono text-xs text-slate-300 break-all leading-relaxed">{address}</p>
        <div className="flex gap-2">
          <CopyBtn text={address} />
          <button
            onClick={function() {
              if (navigator.share) {
                navigator.share({ title: 'My VEC Address', text: address })
              } else {
                navigator.clipboard.writeText(address)
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 transition-all"
          >
            ↗ Share
          </button>
        </div>
      </div>

      <div className="w-full rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-center">
        <p className="text-xs text-emerald-400/80">
          ✓ Payer needs zero BNB — all gas is sponsored by Paymaster
        </p>
      </div>

    </div>
  )
}

// ─── QR Scanner Tab ──────────────────────────────────────────────────────────
function QRScanner({ onScan }) {
  var videoRef   = useRef(null)
  var canvasRef  = useRef(null)
  var streamRef  = useRef(null)
  var rafRef     = useRef(null)
  var [camError, setCamError]   = useState(null)
  var [scanning, setScanning]   = useState(false)
  var [found,    setFound]      = useState(null)
  var [torch,    setTorch]      = useState(false)

  var startCamera = useCallback(async function() {
    setCamError(null)
    setScanning(true)
    setFound(null)
    try {
      var constraints = {
        video: {
          facingMode:  { ideal: 'environment' },
          width:       { ideal: 1280 },
          height:      { ideal: 720 },
        }
      }
      var stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err) {
      setScanning(false)
      if (err.name === 'NotAllowedError') {
        setCamError('Camera permission denied. Please allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setCamError('No camera found on this device.')
      } else {
        setCamError('Camera error: ' + err.message)
      }
    }
  }, [])

  var stopCamera = useCallback(function() {
    if (rafRef.current)    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(function(t) { t.stop() })
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  useEffect(function() {
    startCamera()
    return function() { stopCamera() }
  }, [startCamera, stopCamera])

  useEffect(function() {
    if (!scanning || found) return

    function tick() {
      var video  = videoRef.current
      var canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== 4) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      var ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      var code      = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })
      if (code && code.data) {
        var raw     = code.data.trim()
        var address = raw.replace(/^(ethereum:|velacore:|bnb:)/i, '').split('?')[0].trim()
        if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
          setFound(address)
          stopCamera()
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return function() { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [scanning, found, stopCamera])

  async function toggleTorch() {
    if (!streamRef.current) return
    var track = streamRef.current.getVideoTracks()[0]
    if (!track) return
    try {
      var newVal = !torch
      await track.applyConstraints({ advanced: [{ torch: newVal }] })
      setTorch(newVal)
    } catch (e) {}
  }

  if (camError) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">📵</div>
        <div>
          <p className="text-slate-300 font-semibold mb-1">Camera Unavailable</p>
          <p className="text-slate-500 text-xs max-w-xs leading-relaxed">{camError}</p>
        </div>
        <button
          onClick={startCamera}
          className="text-sm font-bold px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (found) {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl" style={{ boxShadow: '0 0 24px rgba(52,211,153,0.3)' }}>
          ✓
        </div>
        <div>
          <p className="text-emerald-400 font-extrabold text-lg">Address Scanned!</p>
          <p className="text-slate-400 text-xs mt-1">Ready to fill in payment form</p>
        </div>
        <div className="w-full bg-slate-800/60 border border-white/8 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-widest">Recipient Address</p>
          <p className="font-mono text-xs text-slate-300 break-all">{found}</p>
        </div>
        <div className="flex gap-2 w-full">
          <button
            onClick={function() { onScan(found) }}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-extrabold text-sm hover:opacity-90 transition-all"
          >
            Use This Address ⚡
          </button>
          <button
            onClick={function() { setFound(null); startCamera() }}
            className="px-4 py-3 rounded-xl bg-slate-800 border border-white/8 text-slate-400 hover:text-white text-sm font-bold transition-all"
          >
            Rescan
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="text-center">
        <p className="text-slate-300 text-sm font-medium">Scan Recipient QR Code</p>
        <p className="text-slate-500 text-xs mt-1">Point camera at a VelaCore or Ethereum wallet QR</p>
      </div>

      <div className="relative w-full max-w-xs">
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-white/8" style={{ aspectRatio: '1/1' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {scanning && (
            <>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-48 h-48">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-cyan-400 rounded-tl-lg" style={{ borderWidth: '3px' }} />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-cyan-400 rounded-tr-lg" style={{ borderWidth: '3px' }} />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-cyan-400 rounded-bl-lg" style={{ borderWidth: '3px' }} />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-cyan-400 rounded-br-lg" style={{ borderWidth: '3px' }} />
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                    style={{ top: '50%', animation: 'scanLine 2s ease-in-out infinite' }}
                  />
                </div>
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-xs text-white/70 font-medium">Scanning...</span>
              </div>
            </>
          )}
        </div>

        <style>{`
          @keyframes scanLine {
            0%, 100% { top: 15%; opacity: 0.8; }
            50% { top: 85%; opacity: 1; }
          }
        `}</style>
      </div>

      <div className="flex gap-2">
        <button
          onClick={toggleTorch}
          className={'text-xs font-bold px-3 py-2 rounded-xl border transition-all ' +
            (torch ? 'bg-amber-400/20 border-amber-400/30 text-amber-400' : 'bg-slate-800 border-white/8 text-slate-400 hover:text-white')}
        >
          {torch ? '🔦 Torch ON' : '🔦 Torch'}
        </button>
        <button
          onClick={function() { stopCamera(); setTimeout(startCamera, 300) }}
          className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-800 border border-white/8 text-slate-400 hover:text-white transition-all"
        >
          ↺ Restart
        </button>
      </div>

      <p className="text-xs text-slate-700 text-center max-w-xs">
        Supports VelaCore, Ethereum, and standard wallet QR codes
      </p>
    </div>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function QRModal({ address, balance, onClose, onAddressScanned }) {
  var [tab, setTab] = useState('myqr')

  function handleScan(scannedAddress) {
    onAddressScanned(scannedAddress)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-md bg-[#0d1117] border border-white/8 rounded-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 flex items-center justify-center text-base">
              {tab === 'myqr' ? '⬛' : '📷'}
            </div>
            <div>
              <h2 className="text-sm font-extrabold">{tab === 'myqr' ? 'My QR Code' : 'Scan QR Code'}</h2>
              <p className="text-xs text-slate-600">{tab === 'myqr' ? 'Share to receive VEC' : 'Scan to send VEC'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-white/8 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-white/5 bg-slate-900/40">
          <button
            onClick={function() { setTab('myqr') }}
            className={'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ' +
              (tab === 'myqr'
                ? 'bg-gradient-to-r from-cyan-500/15 to-violet-500/10 border border-cyan-500/20 text-cyan-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60')}
          >
            <span>⬛</span>
            <span>My QR Code</span>
          </button>
          <button
            onClick={function() { setTab('scan') }}
            className={'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ' +
              (tab === 'scan'
                ? 'bg-gradient-to-r from-cyan-500/15 to-violet-500/10 border border-cyan-500/20 text-cyan-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60')}
          >
            <span>📷</span>
            <span>Scan & Pay</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {tab === 'myqr' && (
            <MyQRCode address={address} balance={balance} />
          )}
          {tab === 'scan' && (
            <QRScanner onScan={handleScan} />
          )}
        </div>
      </div>
    </div>
  )
}