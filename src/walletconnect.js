// ─── VelaCore — Universal Wallet Connect (Web3Modal v3 / Reown AppKit) ─────────
//
// Supports: MetaMask · Trust Wallet · Coinbase · WalletConnect QR · 300+ wallets
//
// SETUP: Get a FREE Project ID from https://cloud.reown.com
//   1. Sign up at cloud.reown.com
//   2. Create a new project → copy the Project ID
//   3. Replace 'YOUR_PROJECT_ID' below with your actual ID
//
import { createWeb3Modal, defaultConfig } from '@web3modal/ethers'

// ── Replace with your Project ID from https://cloud.reown.com ──────────────────
export const PROJECT_ID = 'YOUR_PROJECT_ID'

// ── BNB Smart Chain Testnet ────────────────────────────────────────────────────
const bnbTestnet = {
  chainId:     97,
  name:        'BNB Smart Chain Testnet',
  currency:    'tBNB',
  explorerUrl: 'https://testnet.bscscan.com',
  rpcUrl:      'https://data-seed-prebsc-1-s1.binance.org:8545/',
}

// ── App metadata (shown in wallet connection popup) ────────────────────────────
const metadata = {
  name:        'VelaCore Gasless Payment',
  description: 'Send VEC tokens gaslessly — zero BNB required',
  url:         typeof window !== 'undefined' ? window.location.origin : 'https://velacore.app',
  icons:       ['https://velacore.github.io/VelaCore-DApp9/VelaCore-symbol-dark.svg'],
}

// ── Create the modal (singleton) ───────────────────────────────────────────────
export const web3modal = createWeb3Modal({
  ethersConfig: defaultConfig({
    metadata,
    enableEIP6963:  true,   // detects injected wallets (MetaMask, Rabby, etc.)
    enableInjected: true,   // shows injected wallets in list
    enableCoinbase: true,   // Coinbase Wallet support
    defaultChainId: 97,
  }),
  chains:           [bnbTestnet],
  projectId:        PROJECT_ID,
  enableAnalytics:  false,
  enableOnramp:     false,
  themeMode:        'dark',
  themeVariables: {
    '--w3m-color-mix':              '#4f46e5',
    '--w3m-color-mix-strength':     20,
    '--w3m-accent':                 '#818cf8',
    '--w3m-border-radius-master':   '4px',
    '--w3m-font-family':            "'Inter', 'Segoe UI', sans-serif",
    '--w3m-z-index':                200,
  },
  // Featured wallets shown first in the list
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase
  ],
})
