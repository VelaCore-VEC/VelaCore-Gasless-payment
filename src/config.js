// ─── VelaCore Gasless Payment — Config ────────────────────────────────────────

export const VEC_TOKEN_ADDRESS = '0x57Cd84ebe7cb619277760Bd26CdF18d75a14c37B'
export const PAYMASTER_ADDRESS  = '0x2e2B3D1979fFc20Df732b205391cDDfDeb9CE890'

// Vercel serverless — same domain, no CORS needed, no Railway needed!
// /api/relay  →  api/relay.js  (auto by Vercel)
export const RELAY_SERVER_URL = '/api/relay'

export const LOGO_URL = 'https://velacore.github.io/VelaCore-DApp9/VelaCore-symbol-dark.svg'

export const BNB_TESTNET = {
  chainId:            '0x61',
  chainName:          'BNB Smart Chain Testnet',
  nativeCurrency:     { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls:            ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
  blockExplorerUrls:  ['https://testnet.bscscan.com'],
}

export const VEC_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function transferFrom(address,address,uint256) returns (bool)',
  'function approve(address,uint256) returns (bool)',
  'function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)',
  'function nonces(address) view returns (uint256)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
]