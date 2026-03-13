// VelaCoreAI.jsx — Vela, VelaCore Personal AI Assistant
import React, { useState, useEffect, useRef, useCallback } from 'react'

var AI_ENDPOINT = '/api/ai'

var SUGGESTIONS = [
  "How does gasless payment work?",
  "Show my transaction history",
  "How to send VEC?",
  "What is VEC token?",
  "Why is relay offline?",
  "This week's transactions",
]

// Detect language from user message
function detectLang(text) {
  if (!text) return 'en'
  // Urdu script (Arabic unicode range)
  if (/[\u0600-\u06FF]/.test(text)) return 'ur'
  // Sindhi specific chars
  if (/[\u0621-\u063A]/.test(text) && /ڄ|ڃ|ٺ|ٻ|ڀ|ڦ|ڙ|ڍ|ڌ|ڏ|ڊ|ڈ/.test(text)) return 'sd'
  // Roman Urdu — only words that are NEVER used in English
  // Require at least 2 matches to avoid false positives
  var urduOnly = [
    'nahi','kya','kaise','mera','meri','mere','aap','tum',
    'yeh','woh','aur','sab','kuch','karo','batao','batana',
    'mujhe','humain','hum','hoga','hogi','hoge','kyun',
    'kahan','kitna','kitni','phir','abhi','wala','wali',
    'lagta','chahiye','milta','bhejo','bheja','rakho',
    'dekho','samjho','pata','matlab','seedha'
  ]
  var lower   = text.toLowerCase()
  var matches = urduOnly.filter(function(w){ return new RegExp('\\b'+w+'\\b').test(lower) })
  if (matches.length >= 2) return 'roman-ur'
  return 'en'
}

function getLangInstruction(lang) {
  if (lang === 'ur')       return 'IMPORTANT: User wrote in Urdu script. Reply ONLY in Urdu script.'
  if (lang === 'sd')       return 'IMPORTANT: User wrote in Sindhi. Reply ONLY in Sindhi.'
  if (lang === 'roman-ur') return 'IMPORTANT: User wrote in Roman Urdu. Reply ONLY in Roman Urdu (Roman script, Urdu language, no Hindi words).'
  return ''
}

// Auto-growing textarea hook
function useAutoResize(ref, value) {
  useEffect(function() {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    var h = Math.min(ref.current.scrollHeight, 120)
    ref.current.style.height = h + 'px'
  }, [value])
}

// Simple markdown → JSX
function MsgText({ text }) {
  return (
    <div style={{ fontSize:'13.5px', lineHeight:1.65, color:'#e5e7eb' }}>
      {text.split('\n').map(function(line, i) {
        if (!line.trim()) return <div key={i} style={{ height:'6px' }} />
        var parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
        return (
          <p key={i} style={{ margin:0, marginTop: i > 0 ? '4px' : 0 }}>
            {parts.map(function(p, j) {
              if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={j} style={{ color:'#f9fafb', fontWeight:700 }}>{p.slice(2,-2)}</strong>
              if (p.startsWith('`') && p.endsWith('`'))
                return <code key={j} style={{ fontSize:'12px', background:'rgba(255,255,255,0.1)', padding:'1px 5px', borderRadius:'4px', color:'#a5b4fc' }}>{p.slice(1,-1)}</code>
              return p
            })}
          </p>
        )
      })}
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display:'flex', gap:'5px', alignItems:'center', padding:'6px 2px' }}>
      {[0,1,2].map(function(i){
        return <span key={i} style={{
          width:'7px', height:'7px', borderRadius:'50%',
          background:'#6366f1', opacity:0.7,
          animation:'velaDot 1.2s '+(i*0.18)+'s ease-in-out infinite',
          display:'inline-block',
        }}/>
      })}
    </div>
  )
}

export default function VelaCoreAI({ wallet, balance, txHistory }) {
  var [open,      setOpen]      = useState(false)
  var [msgs,      setMsgs]      = useState([])
  var [input,     setInput]     = useState('')
  var [loading,   setLoading]   = useState(false)
  var [listening, setListening] = useState(false)
  var [speaking,  setSpeaking]  = useState(false)
  var [voiceOut,  setVoiceOut]  = useState(false)
  var [unread,    setUnread]    = useState(0)

  var bottomRef = useRef(null)
  var inputRef  = useRef(null)
  var recogRef  = useRef(null)

  useAutoResize(inputRef, input)

  // Initial greeting
  useEffect(function() {
    if (msgs.length > 0) return
    var greeting = wallet
      ? 'Hi! I\'m **Vela**, your VelaCore assistant.\n\nWallet connected: `' + wallet.address.slice(0,10) + '...`\nBalance: **' + balance + ' VEC**\n\nAsk me anything about VelaCore!'
      : 'Hi! I\'m **Vela**, your VelaCore assistant.\n\nConnect your wallet and I can show your transaction stats, help you send VEC, or answer any VelaCore question.'
    setMsgs([{ role:'assistant', text:greeting, id:0 }])
  }, [])

  // Update greeting balance when wallet changes
  useEffect(function() {
    if (!wallet || msgs.length === 0) return
    setMsgs(function(prev) {
      var updated = [...prev]
      if (updated[0] && updated[0].role === 'assistant') {
        updated[0] = { ...updated[0],
          text: 'Hi! I\'m **Vela**, your VelaCore assistant.\n\nWallet: `' + wallet.address.slice(0,10) + '...`\nBalance: **' + balance + ' VEC**\n\nAsk me anything about VelaCore!'
        }
      }
      return updated
    })
  }, [wallet, balance])

  useEffect(function() {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior:'smooth' })
  }, [msgs, loading])

  useEffect(function() {
    if (!open && msgs.length > 1) setUnread(function(u){ return u+1 })
  }, [msgs])
  useEffect(function() { if (open) { setUnread(0); setTimeout(function(){ if(inputRef.current) inputRef.current.focus() }, 100) } }, [open])

  function buildContext() {
    if (!wallet) return null
    return { address: wallet.address, balance, network: 'BNB Smart Chain Testnet', txHistory: txHistory || [] }
  }

  var send = useCallback(async function(textOverride) {
    var txt = (textOverride !== undefined ? textOverride : input).trim()
    if (!txt || loading) return
    setInput('')

    var lang        = detectLang(txt)
    var langHint    = getLangInstruction(lang)
    var fullText    = langHint ? langHint + '\n\n' + txt : txt

    var userMsg = { role:'user', text:txt, id:Date.now() }
    setMsgs(function(p){ return [...p, userMsg] })
    setLoading(true)

    var apiMsgs = msgs
      .filter(function(m){ return m.role==='user'||m.role==='assistant' })
      .map(function(m){ return { role:m.role, content:m.text } })
    apiMsgs.push({ role:'user', content:fullText })

    try {
      var res  = await fetch(AI_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type':'application/json' },
        body:    JSON.stringify({ messages:apiMsgs, walletContext:buildContext() }),
      })
      var raw  = await res.text()
      var data
      try { data = JSON.parse(raw) } catch(e) { throw new Error('Server returned invalid response') }

      if (!res.ok || !data.success) throw new Error(data.error || 'AI error (HTTP ' + res.status + ')')

      var aiMsg = { role:'assistant', text:data.reply, id:Date.now() }
      setMsgs(function(p){ return [...p, aiMsg] })
      if (voiceOut) speak(data.reply)

    } catch(err) {
      setMsgs(function(p){ return [...p, { role:'assistant', text:'Sorry, something went wrong: ' + err.message, id:Date.now() }] })
    }
    setLoading(false)
  }, [input, msgs, loading, wallet, balance, txHistory, voiceOut])

  // Speech recognition
  var startListen = useCallback(function() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input not supported. Use Chrome or Edge.'); return }
    var r = new SR()
    r.continuous       = false
    r.interimResults   = false
    r.lang             = 'en-US'
    r.onresult = function(e) { setInput(e.results[0][0].transcript); setListening(false) }
    r.onerror  = function() { setListening(false) }
    r.onend    = function() { setListening(false) }
    recogRef.current = r
    r.start()
    setListening(true)
  }, [])

  function stopListen() { if (recogRef.current) recogRef.current.stop(); setListening(false) }

  function speak(text) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    var clean = text.replace(/\*\*/g,'').replace(/`/g,'').slice(0,400)
    var u = new SpeechSynthesisUtterance(clean)
    u.lang  = 'en-US'; u.rate = 1.0
    var vs  = window.speechSynthesis.getVoices()
    var v   = vs.find(function(v){ return v.name.includes('Google') && v.lang.startsWith('en') }) || vs.find(function(v){ return v.lang.startsWith('en') })
    if (v) u.voice = v
    u.onstart = function(){ setSpeaking(true) }
    u.onend   = function(){ setSpeaking(false) }
    u.onerror = function(){ setSpeaking(false) }
    window.speechSynthesis.speak(u)
  }
  function stopSpeak() { window.speechSynthesis && window.speechSynthesis.cancel(); setSpeaking(false) }

  function onKey(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  var isMobile = window.innerWidth < 640

  // Panel position
  var panelStyle = {
    position:'fixed',
    bottom: isMobile ? 0 : '96px',
    right:  isMobile ? 0 : '24px',
    width:  isMobile ? '100%' : '370px',
    height: isMobile ? '100dvh' : '560px',
    zIndex: 500,
    borderRadius: isMobile ? 0 : '20px',
    background:'#111827',
    border:'1px solid rgba(255,255,255,0.10)',
    boxShadow:'0 24px 64px rgba(0,0,0,0.65)',
    display:'flex', flexDirection:'column', overflow:'hidden',
    animation:'velaChatIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
  }

  if (!open) return (
    <>
      <style>{`
        @keyframes velaChatIn{from{opacity:0;transform:scale(0.9) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes velaDot{0%,80%,100%{transform:scale(0.5);opacity:0.3}40%{transform:scale(1);opacity:1}}
        @keyframes velaPulse{0%,100%{box-shadow:0 6px 28px rgba(79,70,229,0.5)}50%{box-shadow:0 6px 40px rgba(79,70,229,0.8),0 0 0 6px rgba(79,70,229,0.12)}}
      `}</style>
      <button onClick={function(){ setOpen(true) }}
        title="Chat with Vela — VelaCore AI"
        style={{
          position:'fixed', bottom:'24px', right:'24px', zIndex:400,
          height:'48px', borderRadius:'28px',
          paddingLeft:'18px', paddingRight:'20px',
          background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
          border:'none', cursor:'pointer', color:'#fff',
          display:'flex', alignItems:'center', gap:'9px',
          boxShadow:'0 8px 32px rgba(79,70,229,0.6), 0 2px 8px rgba(0,0,0,0.4)',
          animation:'velaPulse 2.5s ease-in-out infinite',
          transition:'transform 0.15s',
        }}
        onMouseEnter={function(e){ e.currentTarget.style.transform='scale(1.05)' }}
        onMouseLeave={function(e){ e.currentTarget.style.transform='scale(1)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span style={{ fontSize:'13px', fontWeight:700, letterSpacing:'0.01em', whiteSpace:'nowrap' }}>
          Ask Vela
        </span>
        {unread > 0 && (
          <span style={{ width:'18px', height:'18px', borderRadius:'50%', background:'#4ade80', fontSize:'9px', fontWeight:900, color:'#0a0e1a', display:'flex', alignItems:'center', justifyContent:'center', marginLeft:'2px' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  )

  return (
    <>
      <style>{`
        @keyframes velaChatIn{from{opacity:0;transform:scale(0.9) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes velaDot{0%,80%,100%{transform:scale(0.5);opacity:0.3}40%{transform:scale(1);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .vela-scroll::-webkit-scrollbar{width:3px}
        .vela-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px}
        .vela-input:focus{border-color:rgba(99,102,241,0.5)!important;outline:none}
        .vela-sug:hover{background:rgba(99,102,241,0.18)!important;color:#c4b5fd!important}
        .vela-icon-btn:hover{opacity:0.8}
      `}</style>

      <div style={panelStyle}>

        {/* ── Header ── */}
        <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>
            ✦
          </div>
          <div style={{ flex:1 }}>
            <p style={{ margin:0, fontSize:'14px', fontWeight:800, color:'#f9fafb', letterSpacing:'-0.01em' }}>Vela</p>
            <p style={{ margin:0, fontSize:'11px', color:'#4ade80', display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#4ade80', display:'inline-block' }}/>
              VelaCore AI
            </p>
          </div>

          {/* Voice output toggle */}
          <button className="vela-icon-btn" title={voiceOut ? 'Voice on' : 'Voice off'}
            onClick={function(){ setVoiceOut(!voiceOut); stopSpeak() }}
            style={{ width:'32px', height:'32px', borderRadius:'9px', border:'1px solid rgba(255,255,255,0.09)', background: voiceOut ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)', color: voiceOut ? '#4ade80' : '#4b5563', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {speaking ? <span style={{ fontSize:'12px', color:'#818cf8' }}>⏹</span> : (voiceOut ? '🔊' : '🔇')}
          </button>

          {/* Close */}
          <button className="vela-icon-btn"
            onClick={function(){ setOpen(false); stopSpeak() }}
            style={{ width:'32px', height:'32px', borderRadius:'9px', border:'1px solid rgba(255,255,255,0.09)', background:'rgba(255,255,255,0.05)', color:'#6b7280', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            ✕
          </button>
        </div>

        {/* ── Messages ── */}
        <div className="vela-scroll" style={{ flex:1, overflowY:'auto', padding:'14px 14px 6px', display:'flex', flexDirection:'column', gap:'8px' }}>
          {msgs.map(function(msg) {
            var isUser = msg.role === 'user'
            return (
              <div key={msg.id} style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                background: isUser ? 'linear-gradient(135deg,#4f46e5,#6d28d9)' : 'rgba(255,255,255,0.055)',
                border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: isUser ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                padding:'10px 13px',
                color: isUser ? '#fff' : '#e5e7eb',
                fontSize:'13.5px', lineHeight:1.6,
              }}>
                {isUser ? msg.text : <MsgText text={msg.text} />}
              </div>
            )
          })}
          {loading && (
            <div style={{ alignSelf:'flex-start', background:'rgba(255,255,255,0.055)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px 16px 16px 3px', padding:'10px 16px' }}>
              <TypingDots />
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Suggestions ── */}
        {msgs.length <= 2 && (
          <div style={{ padding:'8px 14px', display:'flex', gap:'6px', overflowX:'auto', flexShrink:0, scrollbarWidth:'none' }}>
            {SUGGESTIONS.map(function(s, i) {
              return (
                <button key={i} className="vela-sug"
                  onClick={function(){ send(s) }}
                  style={{ flexShrink:0, fontSize:'11.5px', padding:'5px 10px', borderRadius:'20px', background:'rgba(99,102,241,0.09)', border:'1px solid rgba(99,102,241,0.2)', color:'#818cf8', cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s' }}>
                  {s}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Input ── */}
        <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'flex-end', gap:'7px', flexShrink:0, background:'rgba(0,0,0,0.2)' }}>

          {/* Mic */}
          <button className="vela-icon-btn"
            onClick={listening ? stopListen : startListen}
            title={listening ? 'Stop' : 'Voice input'}
            style={{ width:'36px', height:'36px', borderRadius:'10px', flexShrink:0, border: listening ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.09)', background: listening ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)', color: listening ? '#ef4444' : '#6b7280', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', marginBottom:'1px' }}>
            {listening ? '⏹' : '🎙️'}
          </button>

          {/* Textarea — auto grows */}
          <textarea
            ref={inputRef}
            className="vela-input"
            value={input}
            onChange={function(e){ setInput(e.target.value) }}
            onKeyDown={onKey}
            placeholder={listening ? 'Listening...' : 'Ask anything about VelaCore...'}
            rows={1}
            style={{
              flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.11)',
              borderRadius:'12px', padding:'9px 12px', color:'#f9fafb', fontSize:'13.5px',
              resize:'none', fontFamily:'inherit', lineHeight:1.5, overflowY:'hidden',
              transition:'border-color 0.15s', minHeight:'38px', maxHeight:'120px',
            }}
          />

          {/* Send */}
          <button
            onClick={function(){ send() }}
            disabled={!input.trim() || loading}
            style={{ width:'36px', height:'36px', borderRadius:'10px', flexShrink:0, border:'none', background: (input.trim() && !loading) ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'rgba(255,255,255,0.06)', color: (input.trim() && !loading) ? '#fff' : '#374151', cursor: (input.trim() && !loading) ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', marginBottom:'1px' }}>
            {loading
              ? <span style={{ width:'14px', height:'14px', border:'2px solid rgba(255,255,255,0.2)', borderTopColor:'#818cf8', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'block' }}/>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
            }
          </button>
        </div>
      </div>
    </>
  )
}