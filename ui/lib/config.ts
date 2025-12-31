/**
 * MinaID Configuration
 * Central configuration for Oracle and Contract integration
 */

export const config = {
  // Oracle Configuration
  oracle: {
    url: process.env.NEXT_PUBLIC_ORACLE_URL || 'http://localhost:4000',
    publicKey: process.env.NEXT_PUBLIC_ORACLE_PUBLIC_KEY || 'B62qova14dZ5BZCgD6xDxtxjW6ahbrUL1h9suL69NvDwmZBiXzZZxoT',
  },

  // Contract Configuration
  contract: {
    address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '',
  },

  // Network Configuration
  network: {
    name: process.env.NEXT_PUBLIC_MINA_NETWORK || 'berkeley',
    graphql: process.env.NEXT_PUBLIC_MINA_GRAPHQL || 'https://proxy.berkeley.minaexplorer.com/graphql',
    archive: process.env.NEXT_PUBLIC_MINA_ARCHIVE || 'https://archive.berkeley.minaexplorer.com',
  },

  // Feature Flags
  features: {
    passportVerification: process.env.NEXT_PUBLIC_ENABLE_PASSPORT_VERIFICATION === 'true',
    epassportNFC: process.env.NEXT_PUBLIC_ENABLE_EPASSPORT_NFC === 'true',
  },
};

// Validation
export function validateConfig() {
  const issues: string[] = [];

  if (!config.oracle.url) {
    issues.push('NEXT_PUBLIC_ORACLE_URL is not set');
  }

  if (!config.oracle.publicKey) {
    issues.push('NEXT_PUBLIC_ORACLE_PUBLIC_KEY is not set');
  }

  if (!config.contract.address && process.env.NODE_ENV === 'production') {
    issues.push('NEXT_PUBLIC_CONTRACT_ADDRESS is not set (required for production)');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export default config;
