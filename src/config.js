export const VEC_TOKEN_ADDRESS = '0x5172335bF34D96B541581B1f656d8fC2D94D3be8'
export const PAYMASTER_ADDRESS = '0x2e2B3D1979fFc20Df732b205391cDDfDeb9CE890'
export const RELAY_SERVER_URL  = 'http://localhost:3001/relay'
export const LOGO_URL = 'https://velacore.github.io/VelaCore-DApp9/VelaCore-symbol-dark.svg'

export const BNB_TESTNET = {
  chainId: '0x61',
  chainName: 'BNB Smart Chain Testnet',
  rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  blockExplorerUrls: ['https://testnet.bscscan.com'],
}

export const VEC_ABI = [
  'function name() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)',
  'function transferFrom(address from,address to,uint256 amount) returns (bool)',
]