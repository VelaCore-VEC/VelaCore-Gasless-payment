require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const { ethers } = require('ethers')
const fs         = require('fs')
const path       = require('path')

const ALLOWED_ORIGINS = [
  // Add your Vercel URL here
  'https://velacore-gasless-payment.vercel.app',
  // Allow any vercel preview URL
  /\.vercel\.app$/,
  // Local dev
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
]

const app = express()
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true)
    var allowed = ALLOWED_ORIGINS.some(function(o) {
      if (o instanceof RegExp) return o.test(origin)
      return o === origin
    })
    if (allowed) return callback(null, true)
    console.warn('[CORS] Blocked origin:', origin)
    return callback(null, true)  // Allow all for now — tighten after testing
  },
  credentials: true,
}))
app.use(express.json())

// ─── DB — In-Memory Store (Railway ephemeral filesystem workaround) ───────────
// Railway wipes files on redeploy. We keep history in memory (survives requests,
// not redeploys) and also try to write to file as backup when possible.

var DB_MEMORY = {}   // in-memory store — always works
const DB_FILE = path.join(__dirname, 'tx_history.json')

// Load from file into memory on startup (works locally, may fail on Railway)
function loadFromFile() {
  try {
    var raw = fs.readFileSync(DB_FILE, 'utf8')
    DB_MEMORY = JSON.parse(raw)
    var total = Object.values(DB_MEMORY).reduce(function(s,a){ return s+a.length },0)
    console.log('[DB] Loaded', total, 'transactions from file into memory')
  } catch(e) {
    DB_MEMORY = {}
    console.log('[DB] Starting with empty in-memory store (file not found or invalid)')
  }
}
loadFromFile()

// Try to persist to file — silently ignore failures (Railway read-only fs)
function tryWriteFile() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB_MEMORY, null, 2))
  } catch(e) {
    // Silent — expected on Railway ephemeral filesystem
  }
}

function saveTx(walletAddress, txData) {
  var key = walletAddress.toLowerCase()
  if (!DB_MEMORY[key]) DB_MEMORY[key] = []
  DB_MEMORY[key].unshift(txData)
  if (DB_MEMORY[key].length > 500) DB_MEMORY[key] = DB_MEMORY[key].slice(0, 500)
  tryWriteFile()
  console.log('[DB] Saved tx for', key.slice(0,10), '— total for wallet:', DB_MEMORY[key].length)
}

function getTxHistory(walletAddress) {
  var key = walletAddress.toLowerCase()
  return DB_MEMORY[key] || []
}

function getDBStats() {
  var wallets = Object.keys(DB_MEMORY).length
  var txTotal = Object.values(DB_MEMORY).reduce(function(s,a){ return s+a.length },0)
  return { wallets: wallets, transactions: txTotal }
}

// ─── Env check ─────────────────────────────────────────────────────────────────
function checkEnv() {
  var missing = []
  if (!process.env.RELAYER_PRIVATE_KEY) missing.push('RELAYER_PRIVATE_KEY')
  if (!process.env.VEC_TOKEN_ADDRESS)   missing.push('VEC_TOKEN_ADDRESS')
  if (missing.length) {
    console.error('╔══════════════════════════════════════════════════════╗')
    console.error('║  ERROR: Missing environment variables in .env file   ║')
    console.error('╚══════════════════════════════════════════════════════╝')
    missing.forEach(function(v) { console.error('  Missing:', v) })
    console.error('')
    console.error('  Create paymaster-relay/.env with:')
    console.error('  RELAYER_PRIVATE_KEY=0x...')
    console.error('  VEC_TOKEN_ADDRESS=0x...')
    console.error('  RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/')
    process.exit(1)
  }
}
checkEnv()

// ─── Config ────────────────────────────────────────────────────────────────────
const RPC_URL           = process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/'
const RELAYER_PK        = process.env.RELAYER_PRIVATE_KEY
const VEC_TOKEN_ADDRESS = process.env.VEC_TOKEN_ADDRESS

const VEC_ABI = [
  'function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)',
  'function transferFrom(address from,address to,uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
]

function calcFee(amountWei) {
  return (BigInt(amountWei) * BigInt(50)) / BigInt(10000)  // 0.5%
}

// ─── /relay ────────────────────────────────────────────────────────────────────
app.post('/relay', async (req, res) => {
  console.log('[/relay] Incoming request from', req.body.owner || '?')

  const { owner, to, amount, v, r, s, deadline } = req.body

  // Input validation
  if (!owner || !to || !amount || v === undefined || !r || !s || !deadline) {
    return res.status(400).json({ success: false, error: 'Missing required fields in request body.' })
  }
  if (!ethers.isAddress(owner)) {
    return res.status(400).json({ success: false, error: 'Invalid owner address.' })
  }
  if (!ethers.isAddress(to)) {
    return res.status(400).json({ success: false, error: 'Invalid recipient address.' })
  }
  if (owner.toLowerCase() === to.toLowerCase()) {
    return res.status(400).json({ success: false, error: 'Cannot send to yourself.' })
  }
  if (Math.floor(Date.now() / 1000) > parseInt(deadline)) {
    return res.status(400).json({ success: false, error: 'Permit signature has expired. Please try again.' })
  }
  if (isNaN(Number(amount)) || BigInt(amount) <= 0n) {
    return res.status(400).json({ success: false, error: 'Invalid amount.' })
  }

  try {
    const provider      = new ethers.JsonRpcProvider(RPC_URL)
    const relayerWallet = new ethers.Wallet(RELAYER_PK, provider)
    const token         = new ethers.Contract(VEC_TOKEN_ADDRESS, VEC_ABI, relayerWallet)
    const platformAddr  = relayerWallet.address

    // Check relayer BNB balance
    const bnbBal = await provider.getBalance(relayerWallet.address)
    console.log('[/relay] Relayer BNB balance:', ethers.formatEther(bnbBal))
    if (bnbBal < ethers.parseEther('0.001')) {
      return res.status(503).json({ success: false, error: 'Relay gas tank is too low. Please contact support.' })
    }

    const fee       = calcFee(amount)
    const netAmount = BigInt(amount) - fee

    console.log('[/relay] Calling permit...')
    const permitTx = await token.permit(owner, platformAddr, amount, deadline, v, r, s)
    const permitRcpt = await permitTx.wait()
    console.log('[/relay] Permit OK:', permitRcpt.hash)

    console.log('[/relay] Sending net amount to recipient...')
    const transferTx = await token.transferFrom(owner, to, netAmount.toString())
    const transferRcpt = await transferTx.wait()
    console.log('[/relay] Transfer OK:', transferRcpt.hash)

    console.log('[/relay] Collecting platform fee...')
    const feeTx = await token.transferFrom(owner, platformAddr, fee.toString())
    const feeRcpt = await feeTx.wait()
    console.log('[/relay] Fee OK:', feeRcpt.hash)

    const amountFmt = ethers.formatUnits(amount, 18)
    const netFmt    = ethers.formatUnits(netAmount.toString(), 18)
    const feeFmt    = ethers.formatUnits(fee.toString(), 18)

    saveTx(owner, {
      hash:      transferRcpt.hash,
      from:      owner,
      to:        to,
      amount:    amountFmt,
      net:       netFmt,
      feeVec:    feeFmt,
      timestamp: Date.now(),
    })

    console.log('[/relay] ✓ Done — sent', amountFmt, 'VEC from', owner.slice(0,10), 'to', to.slice(0,10))

    return res.json({
      success:      true,
      txHash:       transferRcpt.hash,
      permitHash:   permitRcpt.hash,
      feeHash:      feeRcpt.hash,
      feeCollected: feeFmt,
      amountSent:   netFmt,
      from:         owner,
      to:           to,
    })

  } catch (err) {
    console.error('[/relay] ERROR:', err.message)

    // Parse common blockchain errors into friendly messages
    var msg = err.message || 'Unknown relay error'
    if (msg.includes('invalid signature') || msg.includes('INVALID_SIGNATURE')) {
      msg = 'Invalid permit signature. Please try again or refresh the page.'
    } else if (msg.includes('deadline') || msg.includes('DEADLINE')) {
      msg = 'Permit signature expired. Please try again.'
    } else if (msg.includes('insufficient') || msg.includes('transfer amount')) {
      msg = 'Insufficient VEC balance for this transfer.'
    } else if (msg.includes('execution reverted')) {
      msg = 'Contract call reverted: ' + msg
    } else if (msg.includes('ECONNREFUSED') || msg.includes('network')) {
      msg = 'Cannot connect to BNB RPC. Check your internet or RPC_URL.'
    }

    return res.status(500).json({
      success: false,
      error:   msg,
      hint:    'Check server terminal for full error details.',
    })
  }
})

// ─── /history/:address ─────────────────────────────────────────────────────────
app.get('/history/:address', (req, res) => {
  var address = req.params.address
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ success: false, error: 'Invalid wallet address.' })
  }
  var history = getTxHistory(address)
  return res.json({ success: true, address, count: history.length, history })
})

// ─── /status ───────────────────────────────────────────────────────────────────
app.get('/status', async (req, res) => {
  try {
    const provider      = new ethers.JsonRpcProvider(RPC_URL)
    const relayerWallet = new ethers.Wallet(RELAYER_PK, provider)
    const bnbBal        = await provider.getBalance(relayerWallet.address)
    const bnbFloat      = parseFloat(ethers.formatEther(bnbBal))
    var dbStats = getDBStats()
    return res.json({
      success:        true,
      healthy:        bnbFloat >= 0.001,
      status:         bnbFloat >= 0.001 ? 'FUNDED' : 'LOW — Please refill BNB',
      relayerAddress: relayerWallet.address,
      gasTankBNB:     ethers.formatEther(bnbBal),
      totalWallets:   dbStats.wallets,
      totalTxInMemory:dbStats.transactions,
    })
  } catch (e) {
    console.error('[/status] ERROR:', e.message)
    return res.status(500).json({ success: false, healthy: false, error: e.message })
  }
})

// ─── 404 fallback — always JSON ────────────────────────────────────────────────
app.use(function(req, res) {
  res.status(404).json({ success: false, error: 'Route not found: ' + req.method + ' ' + req.path })
})

// ─── Global error handler — always JSON ────────────────────────────────────────
app.use(function(err, req, res, next) {
  console.error('[UNHANDLED]', err.message)
  res.status(500).json({ success: false, error: 'Internal server error: ' + err.message })
})

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001
app.listen(PORT, function() {
  try {
    const w = new ethers.Wallet(RELAYER_PK)
    console.log('')
    console.log('╔══════════════════════════════════════════════════════╗')
    console.log('║       VelaCore Relay Server — RUNNING ✓              ║')
    console.log('╚══════════════════════════════════════════════════════╝')
    console.log('  Port:    ', PORT)
    console.log('  Relayer: ', w.address)
    console.log('  Token:   ', VEC_TOKEN_ADDRESS)
    console.log('  RPC:     ', RPC_URL)
    console.log('  DB:      ', DB_FILE)
    console.log('')
    console.log('  Endpoints:')
    console.log('  POST http://localhost:'+PORT+'/relay')
    console.log('  GET  http://localhost:'+PORT+'/status')
    console.log('  GET  http://localhost:'+PORT+'/history/:address')
    console.log('')
  } catch (e) {
    console.error('  Warning: Could not parse RELAYER_PRIVATE_KEY —', e.message)
  }
})

// ─── Catch uncaught exceptions ─────────────────────────────────────────────────
process.on('uncaughtException', function(err) {
  console.error('[CRASH] Uncaught Exception:', err.message)
  console.error(err.stack)
})

process.on('unhandledRejection', function(reason) {
  console.error('[CRASH] Unhandled Promise Rejection:', reason)
})