# Environment Variables Update Guide

**New Contract Addresses (Deployed December 8, 2025)**

```
DIDRegistry:  B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD
ZKPVerifier:  B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw
```

---

## 🚀 Step 1: Update Vercel Environment Variables

### Via Vercel Dashboard (Easiest)

1. **Go to Vercel Project Settings:**
   - URL: https://vercel.com/suryasundarvadalis-projects/mina-id/settings/environment-variables

2. **Update the following variables for ALL environments (Production, Preview, Development):**

   | Variable Name | New Value |
   |--------------|-----------|
   | `NEXT_PUBLIC_DID_REGISTRY_DEVNET` | `B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD` |
   | `NEXT_PUBLIC_ZKP_VERIFIER_DEVNET` | `B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw` |

3. **For each variable:**
   - Click the three dots (⋮) next to the variable
   - Select "Edit"
   - Update the value
   - Click "Save"

4. **After updating all variables:**
   - Trigger a new deployment to apply changes
   - You can do this by pushing a commit or clicking "Redeploy" in Vercel

---

## 🔐 Step 2: Update GitHub Repository Secrets

### Via GitHub Web Interface

1. **Go to Repository Secrets:**
   - URL: https://github.com/SuryaSundarVadali/MinaID/settings/secrets/actions

2. **Update or create these secrets:**

   | Secret Name | Value |
   |------------|-------|
   | `NEXT_PUBLIC_DID_REGISTRY_DEVNET` | `B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD` |
   | `NEXT_PUBLIC_ZKP_VERIFIER_DEVNET` | `B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw` |

3. **For each secret:**
   - If it exists: Click "Update" next to the secret
   - If new: Click "New repository secret"
   - Enter the Name and Value
   - Click "Add secret" or "Update secret"

### Via GitHub CLI (Alternative)

```bash
# Make sure you're authenticated with GitHub CLI
gh auth login

# Update the secrets
gh secret set NEXT_PUBLIC_DID_REGISTRY_DEVNET --body "B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD"
gh secret set NEXT_PUBLIC_ZKP_VERIFIER_DEVNET --body "B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw"
```

---

## ✅ Step 3: Verify and Deploy

### 1. Build and Test Locally

```bash
cd ui
npm run build
```

### 2. Verify Deployment Configuration

```bash
node verify-deployment.js
```

### 3. Deploy to Production

```bash
vercel --prod
```

### 4. Test the Application

After deployment, test:
- ✅ Proof generation
- ✅ Blockchain transaction signing via Auro Wallet
- ✅ Proof registration on DIDRegistry
- ✅ Age/KYC verification on ZKPVerifier

---

## 📝 What Changed

### Contract Updates
- **New Method:** `registerDIDSimple()` - Simplified registration without separate signature parameter
- **Uses:** `this.sender.getAndRequireSignature()` for authentication
- **Fixes:** "Invalid signature" error that occurred with previous implementation

### Code Updates
- ✅ Updated `ui/lib/ContractInterface.ts` with new addresses
- ✅ Updated `ui/lib/BlockchainHelpers.ts` with new addresses
- ✅ Updated `verify-deployment.js` with new addresses
- ✅ Updated `ui/.env.local` with new addresses
- ✅ Added old addresses to `DEPRECATED_ADDRESSES` list

### Old Contract Addresses (DO NOT USE)
```
DIDRegistry (Dec 7): B62qkoY7NFfriUPxXYm5TWqJtz4TocpQhmzYq4LK7uXw63v8L8yZQfy
ZKPVerifier (Dec 7): B62qkRuB4ojsqGmtJaH4eJQqMMdJYfGR2UNKtEUMeJzr1qd3G7rTDLG
```

---

## 🐛 Troubleshooting

### If you see "Invalid signature" error:
- Make sure Vercel environment variables are updated
- Redeploy the application
- Clear browser cache and reload

### If transactions fail:
- Check Auro Wallet is connected to Devnet
- Verify contract addresses in browser console
- Check transaction status on Minascan

### If proof generation fails:
- Clear local storage
- Check browser console for errors
- Verify cache files are loaded

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify environment variables are set correctly
3. Test with a fresh browser session
4. Check contract addresses match the new deployment

---

**Last Updated:** December 8, 2025
**Network:** Mina Devnet
**Status:** ✅ Ready for deployment
