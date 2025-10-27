'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';
import { WalletLogin } from '../../components/auth/WalletLogin';
import { Login } from '../../components/Login';

export default function LoginPage() {
  const { isConnected, hasStoredKey } = useWallet();
  const [showPasskeyLogin, setShowPasskeyLogin] = useState(false);

  useEffect(() => {
    // If wallet is connected and user has stored key, show passkey login
    if (isConnected && hasStoredKey('auro')) {
      setShowPasskeyLogin(true);
    }
  }, [isConnected, hasStoredKey]);

  // Show passkey login if wallet connected and has DID
  if (showPasskeyLogin) {
    return <Login />;
  }

  // Otherwise show wallet connection screen
  return <WalletLogin />;
}
