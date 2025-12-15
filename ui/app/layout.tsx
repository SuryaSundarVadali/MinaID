'use client';
import "../styles/globals.css";
import { WalletProvider } from '../context/WalletContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SecurityCheck } from '../components/SecurityCheck';
import { Toaster } from 'react-hot-toast';
import '../lib/CacheHelpers'; // Load cache debugging helpers
import '../lib/DevCleanup'; // Load dev cleanup utilities

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <SecurityCheck>
            <WalletProvider>
              {children}
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    fontFamily: 'var(--font-monument)',
                  },
                }}
              />
            </WalletProvider>
          </SecurityCheck>
        </ErrorBoundary>
      </body>
    </html>
  );
}
