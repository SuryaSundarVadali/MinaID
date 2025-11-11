'use client';
import "../styles/globals.css";
import { WalletProvider } from '../context/WalletContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SecurityCheck } from '../components/SecurityCheck';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <SecurityCheck>
            <WalletProvider>
              {children}
            </WalletProvider>
          </SecurityCheck>
        </ErrorBoundary>
      </body>
    </html>
  );
}
