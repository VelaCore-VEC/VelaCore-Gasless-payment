import { ethers } from 'ethers'
import { VEC_TOKEN_ADDRESS } from './config.js'

export async function signPermit(signer, tokenContract, ownerAddress, spenderAddress, amount, deadline) {

  // Force everything to correct types — ethers v6 is very strict
  const cleanOwner    = String(ownerAddress).trim()
  const cleanSpender  = String(spenderAddress).trim()
  const cleanContract = String(VEC_TOKEN_ADDRESS).trim()

  // Validate addresses first — catch bad values early
  if (!ethers.isAddress(cleanOwner)) {
    throw new Error('Invalid owner address: ' + cleanOwner)
  }
  if (!ethers.isAddress(cleanSpender)) {
    throw new Error('Invalid spender address: ' + cleanSpender)
  }
  if (!ethers.isAddress(cleanContract)) {
    throw new Error('Invalid contract address: ' + cleanContract)
  }

  // Checksum all addresses — prevents ENS resolution attempt
  const owner    = ethers.getAddress(cleanOwner)
  const spender  = ethers.getAddress(cleanSpender)
  const contract = ethers.getAddress(cleanContract)

  // Get token name and nonce
  const tokenName = await tokenContract.name()
  const rawNonce  = await tokenContract.nonces(owner)

  // Force BigInt — never let these be floats
  const valueBig    = BigInt(amount.toString())
  const nonceBig    = BigInt(rawNonce.toString())
  const deadlineBig = BigInt(String(deadline))

  const domain = {
    name:              String(tokenName),
    version:           '1',
    chainId:           97,
    verifyingContract: contract,
  }

  const types = {
    Permit: [
      { name: 'owner',    type: 'address' },
      { name: 'spender',  type: 'address' },
      { name: 'value',    type: 'uint256' },
      { name: 'nonce',    type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  }

  const message = {
    owner:    owner,
    spender:  spender,
    value:    valueBig,
    nonce:    nonceBig,
    deadline: deadlineBig,
  }

  console.log('Signing permit with:', {
    owner:    owner,
    spender:  spender,
    value:    valueBig.toString(),
    nonce:    nonceBig.toString(),
    deadline: deadlineBig.toString(),
    contract: contract,
  })

  const signature = await signer.signTypedData(domain, types, message)
  const split     = ethers.Signature.from(signature)

  return {
    v:        split.v,
    r:        split.r,
    s:        split.s,
    deadline: Number(deadlineBig),
  }
}

export function calcFee(vecAmount) {
  const fee    = (vecAmount * 50) / 10000
  const net    = vecAmount - fee
  const gasUSD = 0.003
  return {
    feeVec:     fee.toFixed(4),
    netRevenue: net.toFixed(4),
    gasCostUSD: gasUSD.toFixed(4),
    gasCovered: fee >= gasUSD / 0.05,
  }
}

export function shortAddr(a) {
  if (!a) return ''
  return a.slice(0, 6) + '...' + a.slice(-4)
}