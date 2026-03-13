// VelaCoreAI.jsx — VelaCore Personal AI Assistant (Vela)
// Features: Chat UI, Voice Input (STT), Voice Output (TTS), Tx Analysis
import React, { useState, useEffect, useRef, useCallback } from 'react'

var AI_ENDPOINT = '/api/ai'

var SUGGESTIONS = [
  'Meri aaj ki transactions kitni hain?',
  'Is week mein kitna VEC bheja?',
  'Gasless payment kaise kaam karta hai?',
  'Wallet connect nahi ho raha — help karo',
  'Mere last 5 transactions dikhao',
  'VEC token ke baare mein batao',
  'Is month mein kitna fee diya?',
  'Send VEC kaise karte hain?',
]

// ── Styles ────────────────────────────────────────────────────────────────────
var S = {
  // Floating button
  fab: {
    position: 'fixed', bottom: '28px', right: '28px', zIndex: 400,
    width: '60px', height: '60px', borderRadius: '50%',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    boxShadow: '0 8px 32px rgba(79,70,229,0.55)',
    border: 'none', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s', color: '#fff',
  },
  fabBadge: {
    position: 'absolute', top: '0', right: '0',
    width: '18px', height: '18px', borderRadius: '50%',
    background: '#4ade80', border: '2px solid #0a0e1a',
    fontSize: '9px', fontWeight: 900, color: '#0a0e1a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  // Panel
  panel: {
    position: 'fixed', bottom: '100px', right: '28px', zIndex: 399,
    width: '380px', height: '580px', borderRadius: '24px',
    background: '#111827', border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    animation: 'velaChatIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
  },
  panelMobile: {
    position: 'fixed', inset: '0', zIndex: 399,
    borderRadius: '0', width: '100%', height: '100%', bottom: '0', right: '0',
  },
  header: {
    padding: '16px 18px', background: 'linear-gradient(135deg,rgba(79,70,229,0.25),rgba(124,58,237,0.15))',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
  },
  avatar: {
    width: '40px', height: '40px', borderRadius: '50%',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '18px', flexShrink: 0, boxShadow: '0 4px 12px rgba(79,70,229,0.4)',
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex',
    flexDirection: 'column', gap: '10px',
    scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
  },
  msgUser: {
    alignSelf: 'flex-end', maxWidth: '80%',
    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    color: '#fff', borderRadius: '18px 18px 4px 18px',
    padding: '10px 14px', fontSize: '13.5px', lineHeight: 1.5,
    boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
  },
  msgAI: {
    alignSelf: 'flex-start', maxWidth: '85%',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
    color: '#e5e7eb', borderRadius: '18px 18px 18px 4px',
    padding: '10px 14px', fontSize: '13.5px', lineHeight: 1.6,
  },
  suggestions: {
    padding: '8px 14px 10px', borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto',
    scrollbarWidth: 'none', flexShrink: 0,
  },
  sugChip: {
    flexShrink: 0, fontSize: '11.5px', padding: '6px 11px',
    borderRadius: '20px', background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
  },
  inputRow: {
    padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0,
    background: '#0d1420',
  },
  input: {
    flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '14px', padding: '10px 14px', color: '#f9fafb', fontSize: '13.5px',
    outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.4,
    maxHeight: '80px', overflowY: 'auto',
  },
  iconBtn: {
    width: '40px', height: '40px', borderRadius: '12px', border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.15s', fontSize: '16px',
  },
}

// ── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ ...S.msgAI, padding: '12px 16px', display: 'flex', gap: '5px', alignItems: 'center' }}>
      {[0,1,2].map(function(i) {
        return <span key={i} style={{
          width: '7px', height: '7px', borderRadius: '50%', background: '#818cf8',
          animation: 'velaDot 1.2s ' + (i*0.2) + 's ease-in-out infinite',
        }} />
      })}
    </div>
  )
}

// ── Message renderer — supports markdown-like bold/bullets ───────────────────
function MsgText({ text }) {
  var lines = text.split('\n')
  return (
    <div>
      {lines.map(function(line, i) {
        if (!line.trim()) return <br key={i} />
        var parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} style={{ margin: i===0?0:'6px 0 0' }}>
            {parts.map(function(p, j) {
              if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={j} style={{ color: '#f9fafb' }}>{p.slice(2,-2)}</strong>
              return p
            })}
          </p>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VelaCoreAI({ wallet, balance, txHistory }) {
  var [open,       setOpen]       = useState(false)
  var [messages,   setMessages]   = useState([])
  var [input,      setInput]      = useState('')
  var [loading,    setLoading]    = useState(false)
  var [listening,  setListening]  = useState(false)
  var [speaking,   setSpeaking]   = useState(false)
  var [unread,     setUnread]     = useState(0)
  var [voiceOn,    setVoiceOn]    = useState(true)
  var [isMobile]                  = useState(function(){ return window.innerWidth < 640 })

  var bottomRef    = useRef(null)
  var inputRef     = useRef(null)
  var recogRef     = useRef(null)
  var synthRef     = useRef(window.speechSynthesis)

  // Greeting on first open
  useEffect(function() {
    if (messages.length === 0) {
      var name  = wallet ? wallet.address.slice(0,8) + '...' : null
      var greet = wallet
        ? '👋 Salam! Main **Vela** hun — aapka VelaCore personal assistant!\n\nAapka wallet connect hai: `' + wallet.address.slice(0,10) + '...`\nBalance: **' + balance + ' VEC**\n\nMain aapki kaise madad kar sakta hun? Transactions, VEC bhejne ka tarika, ya koi bhi VelaCore sawaal — bas poochein! 🚀'
        : '👋 Salam! Main **Vela** hun — aapka VelaCore personal assistant! 🌟\n\nMujhe VelaCore ecosystem ke baare mein har cheez pata hai. Wallet connect karein aur apni transactions bhi dekh sakte hain.\n\nKya jaanna chahte hain?'
      setMessages([{ role: 'assistant', text: greet, id: Date.now() }])
    }
  }, [])

  // Auto scroll
  useEffect(function() {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Unread badge
  useEffect(function() {
    if (!open && messages.length > 1) setUnread(function(u){ return u + 1 })
  }, [messages])

  useEffect(function() {
    if (open) setUnread(0)
  }, [open])

  // Build wallet context for API
  function buildContext() {
    if (!wallet) return null
    return {
      address:   wallet.address,
      balance:   balance,
      network:   'BNB Smart Chain Testnet',
      txHistory: txHistory || [],
    }
  }

  // Send message
  var sendMessage = useCallback(async function(text) {
    var txt = (text || input).trim()
    if (!txt || loading) return
    setInput('')

    var userMsg = { role: 'user', text: txt, id: Date.now() }
    setMessages(function(prev) { return [...prev, userMsg] })
    setLoading(true)

    // Build messages array for API (only role+content, no id/text)
    var apiMessages = messages
      .filter(function(m) { return m.role === 'user' || m.role === 'assistant' })
      .map(function(m) { return { role: m.role, content: m.text } })
    apiMessages.push({ role: 'user', content: txt })

    try {
      var res  = await fetch(AI_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: apiMessages, walletContext: buildContext() }),
      })
      var data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'AI error')

      var aiMsg = { role: 'assistant', text: data.reply, id: Date.now() }
      setMessages(function(prev) { return [...prev, aiMsg] })
      if (voiceOn) speak(data.reply)

    } catch(err) {
      setMessages(function(prev) { return [...prev, {
        role: 'assistant',
        text: '⚠️ ' + (err.message || 'AI service unavailable. Please try again.'),
        id: Date.now(),
      }]})
    }
    setLoading(false)
  }, [input, messages, loading, wallet, balance, txHistory, voiceOn])

  // Voice Input — Speech Recognition
  var startListening = useCallback(function() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input not supported in this browser. Try Chrome or Edge.')
      return
    }
    var recog = new SpeechRecognition()
    recog.lang          = 'ur-PK'  // Urdu first, falls back to English
    recog.interimResults = false
    recog.maxAlternatives = 1

    recog.onresult = function(e) {
      var transcript = e.results[0][0].transcript
      setInput(transcript)
      setListening(false)
    }
    recog.onerror  = function() { setListening(false) }
    recog.onend    = function() { setListening(false) }

    recogRef.current = recog
    recog.start()
    setListening(true)
  }, [])

  var stopListening = useCallback(function() {
    if (recogRef.current) recogRef.current.stop()
    setListening(false)
  }, [])

  // Voice Output — Speech Synthesis
  function speak(text) {
    if (!synthRef.current) return
    synthRef.current.cancel()
    // Strip markdown symbols for clean speech
    var clean = text.replace(/\*\*/g,'').replace(/`/g,'').replace(/#{1,3}\s/g,'')
    var utt   = new SpeechSynthesisUtterance(clean.slice(0, 500)) // limit length
    utt.lang  = 'en-US'
    utt.rate  = 1.05
    utt.pitch = 1.0
    // Try to use a nicer voice if available
    var voices = synthRef.current.getVoices()
    var pref   = voices.find(function(v){ return v.name.includes('Google') && v.lang.startsWith('en') })
                 || voices.find(function(v){ return v.lang.startsWith('en') })
    if (pref) utt.voice = pref
    utt.onstart = function() { setSpeaking(true) }
    utt.onend   = function() { setSpeaking(false) }
    utt.onerror = function() { setSpeaking(false) }
    synthRef.current.speak(utt)
  }

  function stopSpeaking() {
    if (synthRef.current) synthRef.current.cancel()
    setSpeaking(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  var panelStyle = isMobile
    ? { ...S.panel, ...S.panelMobile }
    : S.panel

  if (!open) {
    return (
      <>
        <style>{`
          @keyframes velaChatIn { from{opacity:0;transform:scale(0.85) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
          @keyframes velaDot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
          @keyframes velaFabPulse { 0%,100%{box-shadow:0 8px 32px rgba(79,70,229,0.55)} 50%{box-shadow:0 8px 48px rgba(79,70,229,0.85),0 0 0 8px rgba(79,70,229,0.15)} }
        `}</style>
        <button style={{ ...S.fab, animation: 'velaFabPulse 2.5s ease-in-out infinite' }}
          onClick={function(){ setOpen(true) }}
          onMouseEnter={function(e){ e.currentTarget.style.transform='scale(1.1)' }}
          onMouseLeave={function(e){ e.currentTarget.style.transform='scale(1)' }}
          title="Chat with Vela — VelaCore AI">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.06L2 22l4.94-1.38A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
            <path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth="2.5"/>
          </svg>
          {unread > 0 && <span style={S.fabBadge}>{unread > 9 ? '9+' : unread}</span>}
        </button>
      </>
    )
  }

  return (
    <>
      <style>{`
        @keyframes velaChatIn { from{opacity:0;transform:scale(0.85) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes velaDot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        .vela-msg-scroll::-webkit-scrollbar { width: 4px; }
        .vela-msg-scroll::-webkit-scrollbar-track { background: transparent; }
        .vela-msg-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius:4px; }
        .vela-sug:hover { background: rgba(99,102,241,0.22) !important; border-color: rgba(99,102,241,0.4) !important; }
      `}</style>

      <div style={panelStyle}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.avatar}>🌟</div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:'15px', fontWeight:900, color:'#f9fafb', margin:0 }}>Vela AI</p>
            <p style={{ fontSize:'11px', color:'#4ade80', margin:'2px 0 0', display:'flex', alignItems:'center', gap:'5px' }}>
              <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#4ade80', display:'inline-block' }} />
              VelaCore Personal Assistant
            </p>
          </div>
          {/* Voice toggle */}
          <button style={{ ...S.iconBtn, background: voiceOn ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
            border: voiceOn ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.1)',
            color: voiceOn ? '#4ade80' : '#6b7280', fontSize:'14px' }}
            onClick={function(){ setVoiceOn(!voiceOn); stopSpeaking() }}
            title={voiceOn ? 'Voice On (click to mute)' : 'Voice Off (click to enable)'}>
            {voiceOn ? '🔊' : '🔇'}
          </button>
          {/* Speaking indicator */}
          {speaking && (
            <button style={{ ...S.iconBtn, background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', color:'#818cf8', fontSize:'13px' }}
              onClick={stopSpeaking} title="Stop speaking">⏹</button>
          )}
          {/* Close */}
          <button style={{ ...S.iconBtn, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#9ca3af' }}
            onClick={function(){ setOpen(false); stopSpeaking() }}>✕</button>
        </div>

        {/* Messages */}
        <div className="vela-msg-scroll" style={S.messages}>
          {messages.map(function(msg) {
            return (
              <div key={msg.id} style={msg.role === 'user' ? S.msgUser : S.msgAI}>
                {msg.role === 'assistant'
                  ? <MsgText text={msg.text} />
                  : msg.text}
              </div>
            )
          })}
          {loading && <TypingDots />}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        <div style={S.suggestions}>
          {SUGGESTIONS.slice(0, 6).map(function(s, i) {
            return (
              <button key={i} className="vela-sug" style={S.sugChip}
                onClick={function(){ sendMessage(s) }}>
                {s}
              </button>
            )
          })}
        </div>

        {/* Input */}
        <div style={S.inputRow}>
          {/* Voice input button */}
          <button
            style={{ ...S.iconBtn,
              background: listening ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
              border: listening ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
              color: listening ? '#ef4444' : '#9ca3af',
              animation: listening ? 'velaFabPulse 1s infinite' : 'none',
            }}
            onClick={listening ? stopListening : startListening}
            title={listening ? 'Stop recording' : 'Voice input (Urdu/English)'}>
            {listening ? '⏹' : '🎙️'}
          </button>

          <textarea
            ref={inputRef}
            style={S.input}
            value={input}
            onChange={function(e){ setInput(e.target.value) }}
            onKeyDown={handleKey}
            placeholder={listening ? '🎙️ Sun raha hun...' : 'Kuch bhi poochein VelaCore ke baare mein...'}
            rows={1}
          />

          <button
            style={{ ...S.iconBtn,
              background: (input.trim() && !loading) ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: (input.trim() && !loading) ? '#fff' : '#4b5563',
              cursor: (input.trim() && !loading) ? 'pointer' : 'default',
            }}
            onClick={function(){ sendMessage() }}
            disabled={!input.trim() || loading}
            title="Send">
            {loading
              ? <span style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#818cf8', borderRadius:'50%', animation:'spin 0.8s linear infinite', display:'block' }} />
              : '➤'}
          </button>
        </div>
      </div>
    </>
  )
}
