// api/ai.js — VelaCore AI Assistant (Gemini API)
// Vercel env var needed: GEMINI_API_KEY
// Get free API key: https://aistudio.google.com/app/apikey
const https = require('https')

function httpsPost(options, body) {
  return new Promise(function(resolve, reject) {
    var req = https.request(options, function(res) {
      var data = ''
      res.on('data', function(chunk) { data += chunk })
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch(e) { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  var apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({
    success: false,
    error: 'GEMINI_API_KEY not set. Go to Vercel → Settings → Environment Variables and add it. Get free key from https://aistudio.google.com/app/apikey'
  })

  var body     = req.body || {}
  var messages = body.messages
  var wc       = body.walletContext || null

  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ success: false, error: 'messages array required' })

  // ── Build wallet context ────────────────────────────────────────────────────
  var ctxLines = []
  if (wc) {
    if (wc.address) ctxLines.push('Wallet Address: ' + wc.address)
    if (wc.balance) ctxLines.push('VEC Balance: ' + wc.balance + ' VEC')
    ctxLines.push('Network: BNB Smart Chain Testnet (Chain ID: 97)')

    var history = wc.txHistory || []
    if (history.length > 0) {
      var now  = Date.now()
      var DAY  = 86400000
      var sum  = function(arr, k) { return arr.reduce(function(s,t){ return s + parseFloat(t[k]||0) }, 0).toFixed(2) }
      var todayTx = history.filter(function(t){ return now - t.timestamp < DAY })
      var weekTx  = history.filter(function(t){ return now - t.timestamp < DAY*7 })
      var monthTx = history.filter(function(t){ return now - t.timestamp < DAY*30 })

      ctxLines.push('--- Transaction Summary ---')
      ctxLines.push('Today:      ' + todayTx.length + ' txs | ' + sum(todayTx,'amount') + ' VEC sent')
      ctxLines.push('This week:  ' + weekTx.length  + ' txs | ' + sum(weekTx,'amount')  + ' VEC sent')
      ctxLines.push('This month: ' + monthTx.length + ' txs | ' + sum(monthTx,'amount') + ' VEC sent')
      ctxLines.push('All-time:   ' + history.length + ' txs | ' + sum(history,'amount') + ' VEC sent | fees: ' + sum(history,'feeVec') + ' VEC')

      ctxLines.push('--- Last 5 Transactions ---')
      history.slice(0, 5).forEach(function(t, i) {
        var d = new Date(t.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })
        ctxLines.push(
          (i+1) + '. ' + d +
          ' | Sent: ' + parseFloat(t.amount||0).toFixed(2) + ' VEC' +
          ' → ' + (t.to||'?').slice(0,12) + '...' +
          ' | Fee: ' + parseFloat(t.feeVec||0).toFixed(4) + ' VEC'
        )
      })
    } else {
      ctxLines.push('No transactions yet.')
    }
  } else {
    ctxLines.push('No wallet connected.')
  }

  // ── System instruction ─────────────────────────────────────────────────────
  var systemInstruction = `You are Vela, the official AI assistant for VelaCore (VEC) — a gasless payment DApp on BNB Smart Chain Testnet.

LANGUAGE RULE (strictly follow):
- Default: English
- If user writes in Roman Urdu → reply in Roman Urdu only
- If user writes in Urdu script → reply in Urdu script only
- If user writes in Sindhi → reply in Sindhi only
- Never use Hindi. Never mix languages unless user does.

SCOPE: Only answer VelaCore-related questions. If asked anything else, say:
"I can only help with VelaCore-related questions! Ask me anything about VEC, gasless payments, or your wallet."

VELACORE KNOWLEDGE:
- VEC Token: ERC-20 | BNB Testnet | Contract: 0x5172335bF34D96B541581B1f656d8fC2D94D3be8 | 18 decimals
- Gasless payments: EIP-712 permit signature + relay server pays gas | 0.5% platform fee
- Paymaster: 0x2e2B3D1979fFc20Df732b205391cDDfDeb9CE890
- Features: Send VEC · QR Code · Share & Pay links · Currency Converter (PKR/USD/EUR/GBP/AED) · Tx History · CSV Export · Universal Wallet Connect
- Wallets: MetaMask, Trust Wallet, Coinbase, any EIP-6963 wallet, mobile deep links
- Explorer: https://testnet.bscscan.com

HOW TO USE:
1. Click "Connect Wallet" → pick your wallet
2. Auto-switches to BNB Testnet (Chain ID 97)
3. Enter recipient address + amount
4. Click Pay → sign permit (no BNB needed)
5. Confirmed on-chain — gaslessly

COMMON ISSUES:
- Relay Offline → wait 10s, refresh page
- Signature expired → click Pay again
- Wrong network → switch to BNB Testnet in wallet
- No wallet detected → install MetaMask or use mobile deep link button
- Insufficient balance → need VEC tokens on BNB Testnet

STYLE: Concise, friendly, helpful. Short paragraphs. No excessive emojis.

USER WALLET CONTEXT:
${ctxLines.join('\n')}`

  // ── Convert messages to Gemini format ──────────────────────────────────────
  // Gemini uses 'user' and 'model' roles (not 'assistant')
  // System instruction is separate, not part of contents
  var contents = messages.map(function(m) {
    return {
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || m.text || '' }]
    }
  })

  // Ensure conversation starts with 'user' (Gemini requirement)
  if (contents.length > 0 && contents[0].role !== 'user') {
    contents = contents.slice(1)
  }

  var requestBody = JSON.stringify({
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: contents,
    generationConfig: {
      maxOutputTokens: 800,
      temperature:     0.7,
      topP:            0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
  })

  // Using gemini-2.0-flash — fast, free tier available
  var model = 'gemini-2.0-flash'
  var path  = '/v1beta/models/' + model + ':generateContent?key=' + apiKey

  var options = {
    hostname: 'generativelanguage.googleapis.com',
    port:     443,
    path:     path,
    method:   'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
    }
  }

  try {
    var result = await httpsPost(options, requestBody)

    if (result.status !== 200) {
      console.error('[ai] Gemini error:', result.status, JSON.stringify(result.body).slice(0, 300))
      var errMsg = 'AI API error (HTTP ' + result.status + ')'
      if (result.body && result.body.error) errMsg = result.body.error.message || errMsg
      return res.status(500).json({ success: false, error: errMsg })
    }

    // Extract text from Gemini response
    var candidate = result.body.candidates && result.body.candidates[0]
    var reply     = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text

    if (!reply) {
      // Check for blocked content
      var blockReason = candidate && candidate.finishReason
      if (blockReason === 'SAFETY') return res.status(200).json({ success: true, reply: "I couldn't generate a response for that. Please try rephrasing your question." })
      return res.status(500).json({ success: false, error: 'Empty response from Gemini.' })
    }

    return res.json({ success: true, reply: reply })

  } catch(err) {
    console.error('[ai] Network error:', err.message)
    return res.status(500).json({ success: false, error: 'Network error: ' + err.message })
  }
}