// api/ai.js — VelaCore AI Assistant (Vercel Serverless Function)
// Requires: ANTHROPIC_API_KEY in Vercel Environment Variables

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables.' })
  }

  const { messages, walletContext } = req.body || {}
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  // Build wallet context string for system prompt
  var ctxLines = []
  if (walletContext) {
    var wc = walletContext
    if (wc.address)   ctxLines.push('Connected Wallet: ' + wc.address)
    if (wc.balance)   ctxLines.push('VEC Balance: ' + wc.balance + ' VEC')
    if (wc.network)   ctxLines.push('Network: ' + wc.network)

    if (wc.txHistory && wc.txHistory.length > 0) {
      var now     = Date.now()
      var dayMs   = 86400000
      var weekMs  = 7  * dayMs
      var monthMs = 30 * dayMs

      var todayTx = wc.txHistory.filter(function(t){ return now - t.timestamp < dayMs })
      var weekTx  = wc.txHistory.filter(function(t){ return now - t.timestamp < weekMs })
      var monthTx = wc.txHistory.filter(function(t){ return now - t.timestamp < monthMs })

      function sumAmount(arr) { return arr.reduce(function(s,t){ return s + parseFloat(t.amount||0) },0).toFixed(2) }
      function sumReceived(arr) { return arr.reduce(function(s,t){ return s + parseFloat(t.net||0) },0).toFixed(2) }

      ctxLines.push('--- Transaction Summary ---')
      ctxLines.push('Today:    ' + todayTx.length + ' txs | Sent: ' + sumAmount(todayTx) + ' VEC')
      ctxLines.push('This Week: ' + weekTx.length  + ' txs | Sent: ' + sumAmount(weekTx)  + ' VEC')
      ctxLines.push('This Month:' + monthTx.length + ' txs | Sent: ' + sumAmount(monthTx) + ' VEC')
      ctxLines.push('All-time:  ' + wc.txHistory.length + ' txs | Sent: ' + sumAmount(wc.txHistory) + ' VEC')

      // Last 5 transactions detail
      ctxLines.push('--- Last 5 Transactions ---')
      wc.txHistory.slice(0, 5).forEach(function(t, i) {
        var date = new Date(t.timestamp).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })
        ctxLines.push(
          (i+1) + '. ' + date +
          ' | Sent: ' + parseFloat(t.amount).toFixed(2) + ' VEC' +
          ' | To: ' + (t.to ? t.to.slice(0,10) + '...' : 'unknown') +
          ' | Fee: ' + parseFloat(t.feeVec||0).toFixed(4) + ' VEC' +
          ' | Hash: ' + (t.hash ? t.hash.slice(0,12) + '...' : 'N/A')
        )
      })
    } else {
      ctxLines.push('Transaction History: No transactions yet')
    }
  }

  var walletCtxString = ctxLines.length > 0
    ? '\n\n=== CURRENT USER WALLET CONTEXT ===\n' + ctxLines.join('\n') + '\n==================================='
    : '\n\n=== WALLET CONTEXT ===\nNo wallet connected.'

  var systemPrompt = `You are Vela — the official AI assistant for the VelaCore (VEC) ecosystem. You are a friendly, knowledgeable, and helpful personal assistant embedded directly inside the VelaCore DApp.

=== YOUR IDENTITY ===
- Name: Vela (VelaCore AI Assistant)
- You speak in a friendly, helpful, concise tone
- You support both English and Urdu/Hinglish (respond in whatever language the user uses)
- You use short paragraphs, emojis when appropriate, and clear formatting

=== YOUR KNOWLEDGE SCOPE ===
You ONLY answer questions related to:
1. VelaCore (VEC) ecosystem — token, features, gasless payments, smart contracts
2. The user's own wallet — balance, transactions, history, fees paid
3. How to use the VelaCore DApp — sending VEC, connecting wallets, QR codes, share links
4. BNB Smart Chain Testnet — network info, how gasless works via permit/EIP-712
5. Crypto basics — only when directly relevant to using VelaCore
6. Troubleshooting — connection issues, transaction failures, wallet problems on this DApp

If asked about anything OUTSIDE VelaCore ecosystem (e.g. Bitcoin price, other DApps, stock market, general questions), politely say:
"Main sirf VelaCore ecosystem ke baare mein help kar sakta hun! 🌟 Koi aur sawaal ho VelaCore ke baare mein?"

=== VELACORE ECOSYSTEM KNOWLEDGE ===
**VEC Token:**
- Full name: VelaCore Token (VEC)
- Network: BNB Smart Chain Testnet (Chain ID: 97)
- Contract: 0x5172335bF34D96B541581B1f656d8fC2D94D3be8
- Decimals: 18
- Features: EIP-712 permit support (gasless approvals), ERC-20 standard

**Gasless Payments:**
- Users can send VEC WITHOUT holding BNB for gas
- Uses EIP-712 permit signature + relay server (Paymaster)
- Paymaster address: 0x2e2B3D1979fFc20Df732b205391cDDfDeb9CE890
- Fee: 0.5% platform fee (covers gas costs)
- How it works: User signs a permit → Relay submits tx on-chain → pays gas from relay wallet

**DApp Features:**
- Send VEC gaslessly to any address
- QR Code — generate your wallet QR, scan others
- Share & Pay — create payment links via WhatsApp, Telegram
- Currency Converter — convert PKR/USD/EUR/GBP/AED to VEC live rates
- Transaction History — full history with BscScan links
- CSV Export — download your transaction history
- Universal Wallet Connect — MetaMask, Trust Wallet, Coinbase, any EIP-6963 wallet

**How to use:**
1. Connect Wallet — click "Connect Wallet", choose your wallet app
2. Switch to BNB Testnet in your wallet (DApp will prompt automatically)
3. Enter recipient address and VEC amount
4. Click Pay — sign the permit in your wallet (no BNB needed!)
5. Done — transaction confirmed on-chain

**Common Issues & Solutions:**
- "Relay Offline" → Backend server starting up, wait 10 seconds and refresh
- "Signature expired" → Click Pay again, sign within 60 minutes
- "Insufficient balance" → You need VEC tokens — get testnet VEC from the team
- "Wrong network" → Switch to BNB Testnet (Chain ID 97) in your wallet
- "Cannot reach relay" → Check internet, server may be restarting
- MetaMask not connecting → Refresh page, unlock MetaMask first
- Mobile wallet → Use deep link button to open your wallet app${walletCtxString}

=== RESPONSE STYLE ===
- Keep responses concise and helpful
- Use bullet points for lists, but keep it readable
- For transaction queries, use the wallet context above to give EXACT numbers
- Always be encouraging and positive about VelaCore
- End with a helpful follow-up offer when relevant`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   messages,
      }),
    })

    if (!response.ok) {
      var errText = await response.text()
      console.error('[ai] Anthropic API error:', errText)
      return res.status(500).json({ error: 'AI service error. Please try again.' })
    }

    var data = await response.json()
    var reply = data.content && data.content[0] && data.content[0].text
    if (!reply) return res.status(500).json({ error: 'Empty response from AI.' })

    return res.json({ success: true, reply })

  } catch (err) {
    console.error('[ai] ERROR:', err.message)
    return res.status(500).json({ error: 'AI unavailable: ' + err.message })
  }
}
