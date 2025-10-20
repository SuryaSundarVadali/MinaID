# MinaID Frontend UI - Quick Start Guide

## 🚀 Running the Application

### Start the Development Server

```bash
cd ui
npm run dev
```

The application will be available at: **http://localhost:3000**

---

## 📱 Available Routes

### 1. **Home Page** (`/`)
- **URL**: http://localhost:3000
- **Purpose**: Landing page with auto-redirect
- **Behavior**: 
  - Redirects to `/dashboard` if user is logged in
  - Redirects to `/login` if user is not logged in

### 2. **Login Page** (`/login`)
- **URL**: http://localhost:3000/login
- **Purpose**: Biometric login with Passkey
- **Features**:
  - One-click biometric authentication (Face ID / Touch ID / Fingerprint)
  - Decrypts private key using Passkey
  - Establishes session (1-hour expiry)
  - Redirects to dashboard on success

### 3. **Signup Page** (`/signup`)
- **URL**: http://localhost:3000/signup
- **Purpose**: 6-step registration wizard
- **Flow**:
  1. **Welcome** - Introduction to MinaID
  2. **Connect Wallet** - Choose Auro Wallet or Metamask
  3. **Upload Aadhar** - Upload Indian government ID XML
  4. **Create Passkey** - Set up biometric authentication
  5. **Register DID** - Deploy identity on blockchain
  6. **Complete** - Success screen

### 4. **Dashboard** (`/dashboard`)
- **URL**: http://localhost:3000/dashboard
- **Purpose**: User dashboard for identity management
- **Features**:
  - View DID information
  - Generate age proofs (18+, 21+)
  - View generated proofs gallery
  - Security status indicators
  - Logout functionality

---

## 🎨 Current UI State

### ✅ What's Working
- All routes accessible
- WalletContext provider integrated
- Components load without errors
- Biometric prompts (if browser supports WebAuthn)
- Responsive design with Tailwind CSS
- Gradient background animations

### ⚠️ What Needs Contract Deployment
- **On-chain DID registration** - Requires deployed contracts
- **Proof verification** - Requires ZKPVerifier contract
- **Wallet balance checks** - Requires network connection

---

## 🧪 Testing the UI (Without Deployed Contracts)

### Test Login Flow
1. Go to http://localhost:3000/login
2. Click "Login with Passkey"
3. You'll see browser compatibility check
4. **Note**: Full flow requires existing account (created via signup)

### Test Signup Flow
1. Go to http://localhost:3000/signup
2. Click "Get Started"
3. **Step 1**: Choose wallet (Auro or Metamask)
   - **Note**: Requires wallet browser extension installed
4. **Step 2**: Upload Aadhar XML
   - **Note**: Requires valid eAadhaar XML file
5. **Step 3**: Create Passkey
   - Works in browsers supporting WebAuthn (Chrome, Safari, Edge)
6. **Steps 4-6**: Require deployed contracts

### Test Dashboard (Mock Data)
1. Go to http://localhost:3000/dashboard
2. Will show "Please log in" if no session
3. Can view UI layout and structure

---

## 🔧 Development Tips

### Hot Reload
- Save any file and see changes immediately
- No need to restart server

### View Console Logs
- Open browser DevTools (F12)
- Check Console tab for debug logs
- Check Network tab for API calls

### Clear Session
```javascript
// In browser console:
localStorage.clear();
// Then refresh page
```

### Check Environment Variables
```bash
cat ui/.env.local
```

---

## 🎯 Full End-to-End Testing (After Deployment)

### Prerequisites
1. **Fund Deployer Account**
   - Address: `B62qisMwygWT9F4BrSasaKRJ5LiQZaFXmY5c3Cej4icjjc5mPRbeNKx`
   - Get testnet MINA: https://faucet.minaprotocol.com/

2. **Deploy Contracts**
   ```bash
   cd contracts
   npm run deploy
   ```

3. **Verify Deployment**
   - Check that `ui/.env.local` is updated with contract addresses
   - Check Minascan for deployed contracts

### Complete User Flow
1. **Signup**: Create new identity
   - Connect Auro Wallet
   - Upload Aadhar XML
   - Create biometric Passkey
   - Register DID on-chain (transaction ~1-2 min)

2. **Login**: Access dashboard
   - Use biometric to authenticate
   - Private key decrypted in memory only
   - Session established

3. **Generate Proofs**: Prove credentials
   - Click "Generate Age Proof (18+)"
   - ZK proof created client-side
   - Submit to blockchain (optional)

4. **Logout**: Clear session
   - Click logout
   - Session data cleared
   - Private key removed from memory

---

## 📋 Browser Requirements

### Minimum Requirements
- **Chrome 67+** / **Edge 18+** / **Safari 13+** / **Firefox 60+**
- JavaScript enabled
- LocalStorage enabled

### For Full Functionality
- **WebAuthn/Passkey support** (for biometric login)
  - Chrome 67+
  - Safari 14+
  - Edge 18+
  - Firefox 60+
- **Auro Wallet extension** (for Mina transactions)
- **Metamask extension** (for EVM fallback)

### Supported Biometrics
- **macOS**: Touch ID, Face ID
- **Windows**: Windows Hello (fingerprint, facial recognition, PIN)
- **Android**: Fingerprint, Face Unlock
- **iOS**: Touch ID, Face ID

---

## 🐛 Common Issues & Solutions

### Issue: "Passkey not supported"
**Solution**: Use a modern browser (Chrome/Safari/Edge) with WebAuthn support

### Issue: "Wallet not detected"
**Solution**: Install Auro Wallet extension from https://www.aurowallet.com/

### Issue: "Contract not deployed"
**Solution**: Deploy contracts first using `cd contracts && npm run deploy`

### Issue: "Session expired"
**Solution**: Sessions expire after 1 hour - login again

### Issue: "Aadhar XML parsing failed"
**Solution**: Ensure you're uploading a valid eAadhaar XML file

---

## 🎬 Demo Workflow (Visual Guide)

```
┌─────────────────────────────────────────────────────────┐
│  1. Home (/) → Auto-redirects                           │
│     ├─ Logged in? → Dashboard                           │
│     └─ Not logged in? → Login                           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  2. Login (/login)                                       │
│     ├─ Click "Login with Passkey"                       │
│     ├─ Biometric prompt (Face ID / Touch ID)           │
│     ├─ Decrypt private key                              │
│     └─ → Dashboard                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  3. Dashboard (/dashboard)                               │
│     ├─ View DID: B62q...                                │
│     ├─ Generate Age Proof (18+) ✅                      │
│     ├─ Generate Age Proof (21+) ✅                      │
│     ├─ View Proofs Gallery                              │
│     └─ Logout                                            │
└─────────────────────────────────────────────────────────┘

Alternative: New User Flow
┌─────────────────────────────────────────────────────────┐
│  Signup (/signup) - 6 Steps                              │
│  ┌─────────────────────────────────────────────┐        │
│  │ Step 1: Welcome                              │        │
│  │ Step 2: Connect Wallet (Auro/Metamask)      │        │
│  │ Step 3: Upload Aadhar XML                   │        │
│  │ Step 4: Create Passkey (Biometric)          │        │
│  │ Step 5: Register DID (On-chain TX)          │        │
│  │ Step 6: Complete ✅                          │        │
│  └─────────────────────────────────────────────┘        │
│                      │                                    │
│                      ▼                                    │
│              Redirect to Dashboard                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🌐 Access URLs

| Route | URL | Purpose |
|-------|-----|---------|
| Home | http://localhost:3000 | Landing page |
| Login | http://localhost:3000/login | Biometric login |
| Signup | http://localhost:3000/signup | Registration wizard |
| Dashboard | http://localhost:3000/dashboard | Identity management |

---

## 📊 Next Steps

1. ✅ **UI is running** at http://localhost:3000
2. ⏳ **Fund deployer account** to enable contract deployment
3. ⏳ **Deploy contracts** to Berkeley testnet
4. ⏳ **Test full signup flow** with real blockchain transactions
5. ⏳ **Generate real ZK proofs** using deployed ZKPVerifier

---

## 💡 Pro Tips

- **Use Incognito/Private Mode** for testing multiple accounts
- **Clear localStorage** between tests: `localStorage.clear()`
- **Check browser console** for detailed error messages
- **Use Chrome DevTools** → Application → LocalStorage to inspect stored data
- **Test on mobile** to see biometric authentication on phones

---

**Status**: ✅ UI Running Successfully
**Next Action**: Open http://localhost:3000 in your browser!
