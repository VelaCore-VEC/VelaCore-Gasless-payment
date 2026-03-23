# VelaCore Gasless Payment Platform

> **White-label ready** · BNB Smart Chain · EIP-712 Permit · Gasless Transactions · AI Assistant

A production-grade, gasless crypto payment DApp built on BNB Smart Chain Testnet. Users send ERC-20 tokens without holding BNB for gas — the relay server sponsors all gas fees automatically.

[![Live Demo](https://img.shields.io/badge/Live-Demo-6366f1?style=for-the-badge)](https://your-vercel-url.vercel.app)
[![BNB Testnet](https://img.shields.io/badge/Network-BNB_Testnet-f0b90b?style=for-the-badge)](https://testnet.bscscan.com)
[![EIP-712](https://img.shields.io/badge/Standard-EIP--712_Permit-0f172a?style=for-the-badge)](https://eips.ethereum.org/EIPS/eip-712)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start — Clone & Deploy](#quick-start--clone--deploy)
3. [Environment Variables](#environment-variables)
4. [Smart Contract Deployment](#smart-contract-deployment)
5. [White-Label Guide — Branding](#white-label-guide--branding)
6. [Fee Structure](#fee-structure)
7. [API Reference](#api-reference)
8. [Tech Stack](#tech-stack)

---

## Architecture Overview

```
User Wallet (MetaMask / Trust Wallet)
        │
        │  eth_signTypedData_v4  (EIP-712 Permit)
        │  — No BNB needed —
        ▼
  React Frontend (Vite + Tailwind)
        │
        │  POST /api/relay  {permit signature}
        ▼
  Vercel Serverless Function  (api/relay.js)
        │
        │  relayPermitTransfer()  — pays gas from relayer wallet
        ▼
  VelaCoreToken.sol  (BNB Smart Chain)
        │
        ├── 0.5% Platform Fee  →  Gas Tank / Staking / Treasury
        └── 0.5% Native Fee   →  0.3% Burned / 0.2% LP
```

**Key principle:** The user only signs a typed message — they never pay gas. The relay wallet pays all BNB gas costs, funded by the platform fee.

---

## Quick Start — Clone & Deploy

### Prerequisites

- Node.js 18+
- A [Vercel](https://vercel.com) account (free tier works)
- A funded BNB Testnet wallet (for the relayer)
- A deployed `VelaCoreToken` contract (see [Smart Contract Deployment](#smart-contract-deployment))

### Step 1 — Fork & Clone

```bash
# Fork the repo on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/VelaCore-DApp.git
cd VelaCore-DApp
npm install
```

### Step 2 — Create Environment File

```bash
cp .env.example .env.local
```

Fill in your values (see [Environment Variables](#environment-variables) below).

### Step 3 — Run Locally

```bash
npm run dev
```

App runs at `http://localhost:5173`

### Step 4 — Deploy to Vercel

**Option A — Vercel Dashboard (Recommended):**

1. Push your fork to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import your repo
3. Framework: **Vite**
4. Add all environment variables (Settings → Environment Variables)
5. Click **Deploy**

**Option B — Vercel CLI:**

```bash
npm install -g vercel
vercel --prod
```

### Step 5 — Add Your Domain to Firebase (if using Auth)

Firebase Console → Authentication → Settings → **Authorized domains** → Add your Vercel URL.

---

## Environment Variables

### Frontend Variables (`VITE_` prefix — visible in browser)

| Variable | Description | Example |
|---|---|---|
| `VITE_VEC_TOKEN_ADDRESS` | Your deployed ERC-20 token contract | `0x57Cd84e...` |
| `VITE_PAYMASTER_ADDRESS` | Your paymaster/relay contract address | `0x2e2B3D...` |
| `VITE_LOGO_URL` | Your logo URL (SVG or PNG) | `https://yourcdn.com/logo.svg` |

### Server Variables (Vercel only — never exposed to browser)

| Variable | Description | Example |
|---|---|---|
| `VEC_TOKEN_ADDRESS` | Same token address (server-side) | `0x57Cd84e...` |
| `RELAYER_PRIVATE_KEY` | Private key of your relay wallet | `0xabc123...` |
| `RPC_URL` | BNB Testnet RPC endpoint | `https://data-seed-prebsc-1-s1.binance.org:8545/` |
| `GEMINI_API_KEY` | Google Gemini API key (for AI assistant) | `AIzaSy...` |

### How to Add Variables in Vercel

1. Vercel Dashboard → Your Project → **Settings**
2. Sidebar → **Environment Variables**
3. Add each variable → Select environments: **Production, Preview, Development**
4. **Redeploy** after adding variables

> ⚠️ **Security:** Never commit `.env.local` to Git. It is already in `.gitignore`. The `RELAYER_PRIVATE_KEY` must only live in Vercel — never in code.

### Relayer Wallet Setup

The relayer wallet is a dedicated wallet that pays gas on behalf of users:

```
1. Create a new wallet in MetaMask (separate from your personal wallet)
2. Export its private key
3. Add it to Vercel as RELAYER_PRIVATE_KEY
4. Fund it with BNB Testnet tokens:
   https://testnet.bnbchain.org/faucet-smart
5. Keep a minimum of 0.5 BNB Testnet for gas
```

---

## Smart Contract Deployment

### Using Remix IDE (No Local Setup Required)

1. Open [remix.ethereum.org](https://remix.ethereum.org)
2. Upload `VelaCoreToken.sol` and `VelaCoreStaking.sol`
3. Compiler settings:
   ```
   Solidity Version: 0.8.20
   Optimization:     ✅ Enabled
   Runs:             1
   viaIR:            ✅ Enabled
   ```
4. Connect MetaMask → Select **BNB Smart Chain Testnet** (Chain ID: 97)
5. Deploy `VelaCoreToken` with constructor args:
   ```
   _liquidityWallet:  0x... (your LP wallet)
   _gasTankWallet:    0x... (accumulates gas fees)
   _treasury:         0x... (your treasury wallet)
   _authorizedRelay:  0x... (your relayer wallet — same as RELAYER_PRIVATE_KEY address)
   ```
6. Copy the deployed contract address → Update `VEC_TOKEN_ADDRESS` env var

### Constructor Arguments Explained

| Argument | Purpose | Recommended |
|---|---|---|
| `_liquidityWallet` | Receives 0.2% LP portion of native fee | Your founder wallet |
| `_gasTankWallet` | Receives 40% of platform fee for gas | Your relay wallet |
| `_treasury` | Receives 20% of platform fee | Your business wallet |
| `_authorizedRelay` | Only address allowed to call `relayPermitTransfer()` | Your relayer wallet |

### BNB Testnet Configuration

```
Network Name:   BNB Smart Chain Testnet
RPC URL:        https://data-seed-prebsc-1-s1.binance.org:8545/
Chain ID:       97
Symbol:         tBNB
Explorer:       https://testnet.bscscan.com
```

Faucet: [https://testnet.bnbchain.org/faucet-smart](https://testnet.bnbchain.org/faucet-smart)

---

## White-Label Guide — Branding

This DApp is designed to be white-label friendly. Here is everything you need to change for a client deployment.

### 1. Logo

**File:** `src/config.js`

```js
export const LOGO_URL = 'https://yourcdn.com/your-logo.svg'
```

Or use a local file:

```js
export const LOGO_URL = '/logo.svg'  // place file in /public/logo.svg
```

The logo renders in:
- Top navbar
- AI assistant header
- Transaction receipt screen
- QR share modal

### 2. Brand Colors

**File:** `index.css` or `tailwind.config.js`

The entire app uses CSS variables. Change these to rebrand instantly:

```css
:root {
  --color-primary:    #0f172a;   /* Dark navy — main backgrounds */
  --color-accent:     #d4a017;   /* Gold — highlights, CTAs */
  --color-success:    #4ade80;   /* Green — success states */
  --color-error:      #f87171;   /* Red — error states */
  --color-bg:         #0a0f1e;   /* Page background */
}
```

### 3. App Name & Metadata

**File:** `index.html`

```html
<title>YOUR APP NAME | Gasless Payments</title>
<meta name="description" content="Your custom description" />
```

**File:** `src/config.js`

```js
// These strings appear in toasts, AI assistant, and UI labels
export const APP_NAME    = 'YourApp'
export const TOKEN_NAME  = 'YOUR TOKEN'
export const TOKEN_SYMBOL = 'TKN'
```

### 4. AI Assistant Persona

**File:** `api/ai.js`

Find the system prompt and replace the persona:

```js
const SYSTEM_PROMPT = `
You are Aria, the AI assistant for YourApp — a gasless payment platform.
// ... customize personality and knowledge here
`
```

### 5. Sound Effects

**File:** `src/App.jsx` — `playSound()` function

Tones are generated via Web Audio API — no external files needed. Adjust frequencies:

```js
// Send tone
osc.frequency.setValueAtTime(520, ctx.currentTime)   // change pitch
osc.frequency.setValueAtTime(680, ctx.currentTime + 0.12)

// Receive tone
osc.frequency.setValueAtTime(440, ctx.currentTime)
```

### 6. Network Configuration

**File:** `src/config.js`

Switch from Testnet to Mainnet (when ready):

```js
export const BNB_MAINNET = {
  chainId:            '0x38',           // 56 in decimal
  chainName:          'BNB Smart Chain',
  nativeCurrency:     { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls:            ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls:  ['https://bscscan.com'],
}
```

### White-Label Checklist

```
□ Logo URL updated in config.js
□ Brand colors updated in CSS variables
□ App name updated in index.html
□ Token name/symbol updated in config.js
□ AI assistant persona customized in api/ai.js
□ New VelaCoreToken contract deployed with client wallets
□ New relayer wallet created and funded
□ All environment variables updated in Vercel
□ Firebase authorized domains updated (if using auth)
□ Custom domain configured in Vercel
```

---

## Fee Structure

All fees are enforced at the smart contract level — they cannot be bypassed.

### Platform Fee (via Relay)

| User Type | Fee | Trigger |
|---|---|---|
| Regular | 0.5% of transfer | Always |
| Special (≥10,000 tokens) | 0.3% of transfer | Balance threshold |

Platform fee distribution:
```
40%  →  Gas Tank Wallet    (funds relay operations)
40%  →  Staking Rewards    (distributed to stakers)
20%  →  Treasury Wallet    (project revenue)
```

### Native Token Fee (on every transfer)

```
0.5% total:
  0.3%  →  Burned permanently (deflationary)
  0.2%  →  Liquidity Pool wallet
```

### Recipient Calculation

```
User sends:      1,000 tokens
Platform fee:   −    5 tokens  (0.5%)
After platform:    995 tokens
Native fee:     −  4.975 tokens (0.5%)
Recipient gets:   990.025 tokens
```

---

## API Reference

### `POST /api/relay`

Executes a gasless token transfer after verifying the EIP-712 permit signature.

**Request:**
```json
{
  "owner":    "0x...",
  "to":       "0x...",
  "amount":   "1000000000000000000",
  "deadline": 1234567890,
  "v": 27,
  "r": "0x...",
  "s": "0x..."
}
```

**Response (success):**
```json
{
  "success":       true,
  "txHash":        "0x...",
  "amountSent":    "990.025000",
  "feeCollected":  "5.000000"
}
```

**Response (error):**
```json
{
  "success": false,
  "error":   "Permit expired"
}
```

### `GET /api/relay`

Health check endpoint.

**Response:**
```json
{
  "healthy": true,
  "status":  "ONLINE"
}
```

### `GET /api/relay?history=0xADDRESS`

Fetch transaction history for a wallet address.

**Response:**
```json
{
  "success": true,
  "count":   5,
  "history": [
    {
      "hash":      "0x...",
      "from":      "0x...",
      "to":        "0x...",
      "amount":    "100.000000",
      "net":       "99.002500",
      "feeVec":    "0.500000",
      "type":      "sent",
      "timestamp": 1234567890000
    }
  ]
}
```

### `POST /api/ai`

AI assistant query using Gemini.

**Request:**
```json
{
  "message":  "What is the platform fee?",
  "language": "english"
}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Wallet Connect | EIP-6963 multi-wallet (no WalletConnect Project ID needed) |
| Blockchain | BNB Smart Chain Testnet (Chain ID: 97) |
| Smart Contract | Solidity 0.8.20 — ERC-20 + EIP-712 Permit |
| Gasless Mechanism | EIP-712 `eth_signTypedData_v4` → Server-side relay |
| Backend | Vercel Serverless Functions (Node.js) |
| AI Assistant | Google Gemini 1.5 Flash |
| Audio | Web Audio API (no external library) |
| History | In-memory (server) + localStorage (client) merge |

---

## Security Considerations

- **Relayer private key** must only live in Vercel environment variables — never in code or Git
- **Permit signatures** are single-use and expire at `deadline` timestamp
- **`relayPermitTransfer()`** can only be called by `authorizedRelay` address set at deployment
- **Emergency functions** (`emergencyBurn`, `rescueTokens`) are owner-only with timelocks
- **Blacklist** functionality allows blocking malicious addresses at contract level
- **Pause** mechanism allows halting all transfers in emergency

---

## Support & Contact

Built by **VelaCore Team**

- Main site: [velacore.site](https://velacore.site)
- Audit platform: [analytics.velacore.site](https://analytics.velacore.site)
- Token contract: [`0x57Cd84ebe7cb619277760Bd26CdF18d75a14c37B`](https://testnet.bscscan.com/token/0x57Cd84ebe7cb619277760Bd26CdF18d75a14c37B)

---

*VelaCore Gasless Payment Platform — Documentation v2.5*
