// api/relay.js — VelaCore Gasless Relay (Vercel Serverless Function)
// Place in your frontend repo: /api/relay.js
// Vercel auto-deploys this as a serverless function
//
// Required Vercel env vars (Settings → Environment Variables):
//   RELAYER_PRIVATE_KEY = 0x...your relayer wallet private key
//   VEC_TOKEN_ADDRESS   = 0x5172335bF34D96B541581B1f656d8fC2D94D3be8
//   RPC_URL             = https://data-seed-prebsc-1-s1.binance.org:8545/

const { ethers } = require('ethers')

// Global in-memory store — survives warm requests, resets on cold start
if (!global._vecHistory) global._vecHistory = {}

const RPC_URL           = process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/'
const RELAYER_PK        = process.env.RELAYER_PRIVATE_KEY
const VEC_TOKEN_ADDRESS = process.env.VEC_TOKEN_ADDRESS

const VEC_ABI = [
  'function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)',
  'function transferFrom(address from,address to,uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
]

function calcFee(amountWei) {
  return (BigInt(amountWei) * BigInt(50)) / BigInt(10000) // 0.5%
}

function saveTx(owner, txData) {
  var key = owner.toLowerCase()
  if (!global._vecHistory[key]) global._vecHistory[key] = []
  global._vecHistory[key].unshift(txData)
  if (global._vecHistory[key].length > 200) global._vecHistory[key] = global._vecHistory[key].slice(0, 200)
}

function friendlyError(msg) {
  if (!msg) return 'Unknown error'
  var m = msg.toLowerCase()
  if (m.includes('invalid signature') || m.includes('invalid sig')) return 'Invalid permit signature. Please try again.'
  if (m.includes('deadline') || m.includes('expired'))              return 'Signature expired. Please try again.'
  if (m.includes('insufficient') || m.includes('transfer amount'))  return 'Insufficient VEC balance.'
  if (m.includes('execution reverted'))                             return 'Contract reverted: ' + msg
  if (m.includes('nonce'))                                          return 'Nonce error — refresh and retry.'
  return msg
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET /api/relay?history=0xADDRESS  — fetch tx history
  if (req.method === 'GET') {
    var addr = req.query.history
    if (addr && ethers.isAddress(addr)) {
      var history = global._vecHistory[addr.toLowerCase()] || []
      return res.json({ success:true, address:addr, count:history.length, history })
    }
    // GET /api/relay — status check
    return res.json({ success:true, healthy:true, status:'ONLINE', version:'vercel-serverless' })
  }

  if (req.method !== 'POST') return res.status(405).json({ success:false, error:'Method not allowed' })

  // Env check
  if (!RELAYER_PK) return res.status(500).json({ success:false,
    error:'RELAYER_PRIVATE_KEY not set. Add it in Vercel → Settings → Environment Variables.' })
  if (!VEC_TOKEN_ADDRESS) return res.status(500).json({ success:false,
    error:'VEC_TOKEN_ADDRESS not set in Vercel env vars.' })

  const { owner, to, amount, v, r, s, deadline } = req.body || {}

  // Validate
  if (!owner || !to || !amount || v === undefined || !r || !s || !deadline)
    return res.status(400).json({ success:false, error:'Missing required fields.' })
  if (!ethers.isAddress(owner))
    return res.status(400).json({ success:false, error:'Invalid owner address.' })
  if (!ethers.isAddress(to))
    return res.status(400).json({ success:false, error:'Invalid recipient address.' })
  if (owner.toLowerCase() === to.toLowerCase())
    return res.status(400).json({ success:false, error:'Cannot send to yourself.' })
  if (Math.floor(Date.now() / 1000) > parseInt(deadline))
    return res.status(400).json({ success:false, error:'Permit expired — please retry.' })

  try {
    const provider      = new ethers.JsonRpcProvider(RPC_URL)
    const relayerWallet = new ethers.Wallet(RELAYER_PK, provider)
    const token         = new ethers.Contract(VEC_TOKEN_ADDRESS, VEC_ABI, relayerWallet)
    const platformAddr  = relayerWallet.address

    const fee       = calcFee(amount)
    const netAmount = BigInt(amount) - fee

    console.log('[relay] permit:', owner.slice(0,10), '->', to.slice(0,10))
    const permitTx   = await token.permit(owner, platformAddr, amount, deadline, v, r, s)
    await permitTx.wait()

    console.log('[relay] transferFrom to recipient')
    const transferTx   = await token.transferFrom(owner, to, netAmount.toString())
    const transferRcpt = await transferTx.wait()

    console.log('[relay] collect fee')
    const feeTx   = await token.transferFrom(owner, platformAddr, fee.toString())
    const feeRcpt = await feeTx.wait()

    const amountFmt = ethers.formatUnits(amount, 18)
    const netFmt    = ethers.formatUnits(netAmount.toString(), 18)
    const feeFmt    = ethers.formatUnits(fee.toString(), 18)

    saveTx(owner, { hash:transferRcpt.hash, from:owner, to, amount:amountFmt, net:netFmt, feeVec:feeFmt, timestamp:Date.now() })
    console.log('[relay] done:', transferRcpt.hash)

    return res.json({
      success:true, txHash:transferRcpt.hash,
      permitHash:permitTx.hash, feeHash:feeRcpt.hash,
      feeCollected:feeFmt, amountSent:netFmt, from:owner, to
    })

  } catch (err) {
    console.error('[relay] ERROR:', err.message)
    return res.status(500).json({ success:false, error:friendlyError(err.message) })
  }
}