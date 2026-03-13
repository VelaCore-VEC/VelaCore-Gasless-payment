const https = require('https')

function httpsPost(options, body) {
  return new Promise(function(resolve, reject) {
    var req = https.request(options, function(res) {
      var data = ''
      res.on('data', function(chunk) { data += chunk })
      res.on('end',  function() {
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

  var apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({
    success: false,
    error: 'ANTHROPIC_API_KEY not set in Vercel → Settings → Environment Variables'
  })

  var body = req.body || {}
  var messages = body.messages
  var wc = body.walletContext || null

  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ success: false, error: 'messages array required' })

  var ctxLines = []
  if (wc) {
    if (wc.address) ctxLines.push('Wallet: ' + wc.address)
    if (wc.balance) ctxLines.push('VEC Balance: ' + wc.balance + ' VEC')
    ctxLines.push('Network: BNB Smart Chain Testnet')

    var history = wc.txHistory || []
    if (history.length > 0) {
      var now      = Date.now()
      var DAY      = 86400000
      var todayTx  = history.filter(function(t){ return now - t.timestamp < DAY })
      var weekTx   = history.filter(function(t){ return now - t.timestamp < DAY*7 })
      var monthTx  = history.filter(function(t){ return now - t.timestamp < DAY*30 })
      var sum      = function(arr, k){ return arr.reduce(function(s,t){ return s+parseFloat(t[k]||0) },0).toFixed(2) }

      ctxLines.push('--- Stats ---')
      ctxLines.push('Today: '      + todayTx.length + ' txs, ' + sum(todayTx,'amount')  + ' VEC sent')
      ctxLines.push('This week: '  + weekTx.length  + ' txs, ' + sum(weekTx,'amount')   + ' VEC sent')
      ctxLines.push('This month: ' + monthTx.length + ' txs, ' + sum(monthTx,'amount')  + ' VEC sent')
      ctxLines.push('All-time: '   + history.length + ' txs, ' + sum(history,'amount')  + ' VEC sent')
      ctxLines.push('Total fees: ' + sum(history,'feeVec') + ' VEC')

      ctxLines.push('--- Last 5 Transactions ---')
      history.slice(0,5).forEach(function(t,i){
        var d = new Date(t.timestamp).toLocaleString('en-PK',{timeZone:'Asia/Karachi'})
        ctxLines.push((i+1)+'. '+d+' | '+parseFloat(t.amount).toFixed(2)+' VEC → '+
          (t.to||'?').slice(0,12)+'... | fee: '+parseFloat(t.feeVec||0).toFixed(4)+' VEC')
      })
    } else {
      ctxLines.push('No transactions yet')
    }
  } else {
    ctxLines.push('No wallet connected')
  }

  var systemPrompt = `You are Vela, the official AI assistant for VelaCore (VEC) — a gasless payment DApp on BNB Smart Chain Testnet.

LANGUAGE RULE (very important):
- Default language: English
- If user writes in Roman Urdu → reply in Roman Urdu
- If user writes in Urdu script → reply in Urdu script
- If user writes in Sindhi → reply in Sindhi
- Match user's language exactly. Never switch to Hindi.

SCOPE: Only answer questions about VelaCore ecosystem. If asked anything unrelated, say:
"I can only help with VelaCore-related questions! Ask me anything about VEC, gasless payments, or your wallet. 🌟"

VELACORE KNOWLEDGE:
- VEC Token: ERC-20 on BNB Testnet | Contract: 0x5172335bF34D96B541581B1f656d8fC2D94D3be8 | 18 decimals
- Gasless: Users sign EIP-712 permit → relay submits tx → pays gas | 0.5% platform fee
- Paymaster: 0x2e2B3D1979fFc20Df732b205391cDDfDeb9CE890
- Features: Send VEC · QR Code · Share & Pay links · Currency Converter (PKR/USD/EUR/GBP/AED) · Transaction History · CSV Export · Universal Wallet Connect
- Supported wallets: MetaMask, Trust Wallet, Coinbase Wallet, any EIP-6963 wallet
- Explorer: https://testnet.bscscan.com

HOW TO USE:
1. Click "Connect Wallet" → choose wallet
2. Auto-switches to BNB Testnet (Chain ID 97)
3. Enter recipient address + VEC amount
4. Click Pay → sign permit in wallet (no BNB needed)
5. Done — tx confirmed on-chain gaslessly

COMMON ISSUES:
- Relay Offline → wait 10s, refresh
- Signature expired → click Pay again
- Wrong network → switch to BNB Testnet (Chain ID 97)
- No wallet detected → install MetaMask or use mobile deep link
- Mobile → tap wallet button to open app, approve, return to browser

STYLE: Be concise, friendly, helpful. Use short paragraphs. No excessive emojis.

USER WALLET CONTEXT:
${ctxLines.join('\n')}`

  var requestBody = JSON.stringify({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system:     systemPrompt,
    messages:   messages,
  })

  var options = {
    hostname: 'api.anthropic.com',
    port:     443,
    path:     '/v1/messages',
    method:   'POST',
    headers: {
      'Content-Type':      'application/json',
      'Content-Length':    Buffer.byteLength(requestBody),
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    }
  }

  try {
    var result = await httpsPost(options, requestBody)

    if (result.status !== 200) {
      console.error('[ai] Anthropic error:', result.status, JSON.stringify(result.body))
      var errMsg = (result.body && result.body.error && result.body.error.message) || 'AI API error ' + result.status
      return res.status(500).json({ success: false, error: errMsg })
    }

    var reply = result.body.content && result.body.content[0] && result.body.content[0].text
    if (!reply) return res.status(500).json({ success: false, error: 'Empty AI response' })

    return res.json({ success: true, reply: reply })

  } catch(err) {
    console.error('[ai] Network error:', err.message)
    return res.status(500).json({ success: false, error: 'Network error: ' + err.message })
  }
}