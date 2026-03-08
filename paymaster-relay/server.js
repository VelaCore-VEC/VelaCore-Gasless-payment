require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const { ethers } = require('ethers')
const fs         = require('fs')
const path       = require('path')

const app = express()
app.use(cors())
app.use(express.json())

const DB_FILE = path.join(__dirname, 'tx_history.json')

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2))
}

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch (e) {
    return {}
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
  } catch (e) {}
}

function saveTx(walletAddress, txData) {
  var db  = readDB()
  var key = walletAddress.toLowerCase()
  if (!db[key]) db[key] = []
  db[key].unshift(txData)
  if (db[key].length > 1000) db[key] = db[key].slice(0, 1000)
  writeDB(db)
}

function getTxHistory(walletAddress) {
  var db  = readDB()
  var key = walletAddress.toLowerCase()
  return db[key] || []
}

if (!process.env.RELAYER_PRIVATE_KEY) process.exit(1)
if (!process.env.VEC_TOKEN_ADDRESS)   process.exit(1)

const PROVIDER_URL      = process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/'
const RELAYER_PK        = process.env.RELAYER_PRIVATE_KEY
const VEC_TOKEN_ADDRESS = process.env.VEC_TOKEN_ADDRESS

const VEC_ABI = [
  'function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)',
  'function transferFrom(address from,address to,uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
]

function getFee(amountWei) {
  return (BigInt(amountWei) * BigInt(50)) / BigInt(10000)
}

app.post('/relay', async (req, res) => {
  const { owner, to, amount, v, r, s, deadline } = req.body

  if (!owner || !to || !amount || v === undefined || !r || !s || !deadline) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (!ethers.isAddress(owner)) {
    return res.status(400).json({ error: 'Invalid owner address' })
  }
  if (!ethers.isAddress(to)) {
    return res.status(400).json({ error: 'Invalid recipient address' })
  }
  if (owner.toLowerCase() === to.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot send to yourself' })
  }
  if (Math.floor(Date.now() / 1000) > parseInt(deadline)) {
    return res.status(400).json({ error: 'Permit signature has expired' })
  }

  try {
    const provider      = new ethers.JsonRpcProvider(PROVIDER_URL)
    const relayerWallet = new ethers.Wallet(RELAYER_PK, provider)
    const token         = new ethers.Contract(VEC_TOKEN_ADDRESS, VEC_ABI, relayerWallet)
    const platformAddr  = relayerWallet.address

    const fee       = getFee(amount)
    const netAmount = BigInt(amount) - fee

    const permitTx = await token.permit(owner, platformAddr, amount, deadline, v, r, s)
    await permitTx.wait()

    const transferTx = await token.transferFrom(owner, to, netAmount.toString())
    await transferTx.wait()

    const feeTx = await token.transferFrom(owner, platformAddr, fee.toString())
    await feeTx.wait()

    const amountTotal = ethers.formatUnits(amount, 18)
    const amountNet   = ethers.formatUnits(netAmount.toString(), 18)
    const amountFee   = ethers.formatUnits(fee.toString(), 18)

    saveTx(owner, {
      hash:      transferTx.hash,
      from:      owner,
      to:        to,
      amount:    amountTotal,
      net:       amountNet,
      feeVec:    amountFee,
      timestamp: Date.now(),
    })

    return res.json({
      success:      true,
      txHash:       transferTx.hash,
      permitHash:   permitTx.hash,
      feeHash:      feeTx.hash,
      feeCollected: amountFee,
      amountSent:   amountNet,
      from:         owner,
      to:           to,
    })

  } catch (err) {
    return res.status(500).json({
      error: err.message,
      hint:  'Check VEC token has permit() and relayer has BNB for gas.',
    })
  }
})

app.get('/history/:address', (req, res) => {
  var address = req.params.address
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid wallet address' })
  }
  return res.json({
    success: true,
    address: address,
    count:   getTxHistory(address).length,
    history: getTxHistory(address),
  })
})

app.get('/status', async (req, res) => {
  try {
    const provider      = new ethers.JsonRpcProvider(PROVIDER_URL)
    const relayerWallet = new ethers.Wallet(RELAYER_PK, provider)
    const bnbBalance    = await provider.getBalance(relayerWallet.address)
    const bnbFloat      = parseFloat(ethers.formatEther(bnbBalance))

    res.json({
      status:         bnbFloat > 0.01 ? 'FUNDED' : 'LOW — Please refill',
      relayerAddress: relayerWallet.address,
      gasTankBNB:     ethers.formatEther(bnbBalance),
      healthy:        bnbFloat > 0.01,
      totalWallets:   Object.keys(readDB()).length,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, function() {
  try {
    const w = new ethers.Wallet(RELAYER_PK)
    console.log('VelaCore Relay Server running on http://localhost:3001')
    console.log('Relayer:', w.address)
  } catch (e) {}
})