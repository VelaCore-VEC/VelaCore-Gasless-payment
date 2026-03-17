import { ethers } from 'ethers'

// ── Fee Constants (mirror of VelaCoreToken v4.1) ────────────────────────────
export const NATIVE_FEE_BPS          = 50   // 0.5% on all transfers
export const NATIVE_BURN_BPS         = 30   // 0.3% burned
export const NATIVE_LP_BPS           = 20   // 0.2% to LP
export const PLATFORM_FEE_REGULAR    = 50   // 0.5% regular users
export const PLATFORM_FEE_SPECIAL    = 30   // 0.3% special users (≥10k VEC)
export const SPECIAL_THRESHOLD       = 10000 // 10,000 VEC

// ── Calculate full fee breakdown ────────────────────────────────────────────
export function calcFee(amount, userBalance) {
  if (!amount || amount <= 0) return null
  var bal = parseFloat(userBalance || 0)
  var isSpecial = bal >= SPECIAL_THRESHOLD

  var platformBps = isSpecial ? PLATFORM_FEE_SPECIAL : PLATFORM_FEE_REGULAR
  var platformFee = (amount * platformBps) / 10000
  var afterPlatform = amount - platformFee

  var nativeFee = (afterPlatform * NATIVE_FEE_BPS)  / 10000
  var burnAmt   = (afterPlatform * NATIVE_BURN_BPS) / 10000
  var lpAmt     = (afterPlatform * NATIVE_LP_BPS)   / 10000
  var netToRecipient = afterPlatform - nativeFee

  // Platform fee split
  var gasTankAmt  = (platformFee * 40) / 100
  var stakingAmt  = (platformFee * 40) / 100
  var treasuryAmt = platformFee - gasTankAmt - stakingAmt

  return {
    gross:          amount.toFixed(4),
    isSpecial:      isSpecial,
    platformBps:    platformBps,
    platformFee:    platformFee.toFixed(4),
    gasTankAmt:     gasTankAmt.toFixed(4),
    stakingAmt:     stakingAmt.toFixed(4),
    treasuryAmt:    treasuryAmt.toFixed(4),
    burnAmt:        burnAmt.toFixed(4),
    lpAmt:          lpAmt.toFixed(4),
    nativeFee:      nativeFee.toFixed(4),
    netRevenue:     netToRecipient.toFixed(4),
    // Legacy compat
    feeVec:         platformFee.toFixed(4),
  }
}

// ── EIP-712 Permit signature ────────────────────────────────────────────────
export async function signPermit(signer, tokenContract, owner, spender, amountWei, deadline) {
  var network   = await signer.provider.getNetwork()
  var chainId   = Number(network.chainId)
  var tokenName = await tokenContract.name()
  var nonce     = await tokenContract.nonces(owner)
  var tokenAddr = await tokenContract.getAddress()

  var typedData = {
    domain: {
      name:              tokenName,
      version:           '1',
      chainId:           chainId,
      verifyingContract: tokenAddr,
    },
    types: {
      EIP712Domain: [
        { name: 'name',              type: 'string'  },
        { name: 'version',           type: 'string'  },
        { name: 'chainId',           type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner',    type: 'address' },
        { name: 'spender',  type: 'address' },
        { name: 'value',    type: 'uint256' },
        { name: 'nonce',    type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    message: {
      owner:    owner,
      spender:  spender,
      value:    amountWei.toString(),
      nonce:    nonce.toString(),
      deadline: deadline.toString(),
    },
  }

  // Use raw provider request — works on ALL wallets (Trust, MetaMask, Coinbase, etc.)
  var rawProvider = signer.provider
  var sig
  try {
    // Method 1: Direct raw provider (Trust Wallet, WalletConnect compatible)
    sig = await rawProvider.send('eth_signTypedData_v4', [
      owner,
      JSON.stringify(typedData)
    ])
  } catch(e1) {
    try {
      // Method 2: ethers signer fallback
      sig = await signer.signTypedData(typedData.domain, { Permit: typedData.types.Permit }, typedData.message)
    } catch(e2) {
      try {
        // Method 3: personal_sign fallback (very old wallets)
        sig = await rawProvider.send('personal_sign', [
          ethers.TypedDataEncoder.hash(typedData.domain, { Permit: typedData.types.Permit }, typedData.message),
          owner
        ])
      } catch(e3) {
        throw new Error('Wallet signature failed. Please try again or switch wallet.')
      }
    }
  }

  var { v, r, s } = ethers.Signature.from(sig)
  return { v, r, s, deadline }
}

// ── Short address display ────────────────────────────────────────────────────
export function shortAddr(addr) {
  if (!addr) return ''
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}