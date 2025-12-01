'use client';

import React, { useState } from 'react';
import { PrivateKey, PublicKey } from 'o1js';
import { 
  generateCitizenshipZKProof, 
  verifyCitizenshipZKProof,
  generateAgeProof
} from '../../lib/ProofGenerator';
import styles from '../../styles/Home.module.css';
import GradientBG from '../../components/GradientBG';

export default function TestProofsPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runCitizenshipTests = async () => {
    setRunning(true);
    clearResults();
    addResult('🧪 Testing Citizenship ZK Proofs (Case-Insensitive)');
    addResult('━'.repeat(60));

    try {
      const privateKey = PrivateKey.random();
      const publicKey = privateKey.toPublicKey();
      const salt = 'test_salt_123';

      // Test 1: Basic proof generation and verification
      addResult('\n📝 Test 1: Basic Citizenship Proof');
      const proof1 = generateCitizenshipZKProof('India', privateKey, salt);
      addResult(`  Generated proof for "India"`);
      addResult(`  Commitment: ${proof1.commitment.substring(0, 20)}...`);
      addResult(`  Normalized: ${proof1.normalizedValue}`);

      const verify1 = verifyCitizenshipZKProof('India', proof1.commitment, salt, proof1.signature, publicKey);
      addResult(`  Verify "India": ${verify1 ? '✅ PASS' : '❌ FAIL'}`);

      // Test 2: Case insensitivity
      addResult('\n📝 Test 2: Case Insensitivity');
      const verify2a = verifyCitizenshipZKProof('india', proof1.commitment, salt, proof1.signature, publicKey);
      addResult(`  Verify "india" (lowercase): ${verify2a ? '✅ PASS' : '❌ FAIL'}`);

      const verify2b = verifyCitizenshipZKProof('INDIA', proof1.commitment, salt, proof1.signature, publicKey);
      addResult(`  Verify "INDIA" (uppercase): ${verify2b ? '✅ PASS' : '❌ FAIL'}`);

      const verify2c = verifyCitizenshipZKProof('InDiA', proof1.commitment, salt, proof1.signature, publicKey);
      addResult(`  Verify "InDiA" (mixed): ${verify2c ? '✅ PASS' : '❌ FAIL'}`);

      const verify2d = verifyCitizenshipZKProof('  india  ', proof1.commitment, salt, proof1.signature, publicKey);
      addResult(`  Verify "  india  " (with spaces): ${verify2d ? '✅ PASS' : '❌ FAIL'}`);

      // Test 3: Different citizenship should fail
      addResult('\n📝 Test 3: Different Citizenship (Should Fail)');
      const verify3a = verifyCitizenshipZKProof('USA', proof1.commitment, salt, proof1.signature, publicKey);
      addResult(`  Verify "USA": ${verify3a ? '❌ FAIL (should be false)' : '✅ PASS (correctly rejected)'}`);

      const verify3b = verifyCitizenshipZKProof('China', proof1.commitment, salt, proof1.signature, publicKey);
      addResult(`  Verify "China": ${verify3b ? '❌ FAIL (should be false)' : '✅ PASS (correctly rejected)'}`);

      // Test 4: Multiple proofs with different citizenships
      addResult('\n📝 Test 4: Multiple Proofs');
      const proof2 = generateCitizenshipZKProof('USA', privateKey, 'salt2');
      addResult(`  Generated proof for "USA"`);
      
      const verify4a = verifyCitizenshipZKProof('usa', proof2.commitment, 'salt2', proof2.signature, publicKey);
      addResult(`  Verify USA proof with "usa": ${verify4a ? '✅ PASS' : '❌ FAIL'}`);

      const verify4b = verifyCitizenshipZKProof('india', proof2.commitment, 'salt2', proof2.signature, publicKey);
      addResult(`  Verify USA proof with "india": ${verify4b ? '❌ FAIL' : '✅ PASS (correctly rejected)'}`);

      // Test 5: Wrong salt should fail
      addResult('\n📝 Test 5: Wrong Salt (Should Fail)');
      const verify5 = verifyCitizenshipZKProof('India', proof1.commitment, 'wrong_salt', proof1.signature, publicKey);
      addResult(`  Verify with wrong salt: ${verify5 ? '❌ FAIL (should be false)' : '✅ PASS (correctly rejected)'}`);

      // Summary
      addResult('\n' + '━'.repeat(60));
      addResult('✅ All Citizenship ZK Tests Completed!');

    } catch (error: any) {
      addResult(`\n❌ Error: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  const runAgeProofTests = async () => {
    setRunning(true);
    clearResults();
    addResult('🧪 Testing Age ZK Proofs');
    addResult('━'.repeat(60));

    try {
      const privateKey = PrivateKey.random();
      const publicKey = privateKey.toPublicKey();

      // Mock Aadhar data
      const mockAadharData = {
        uid: '1234-5678-9012',
        name: 'Test User',
        dateOfBirth: '01-01-1990', // 34 years old (as of 2024)
        gender: 'M' as const,
        address: {
          country: 'India',
          state: 'Test State',
          district: 'Test District'
        },
        verifiedAt: Date.now(),
        issuer: 'UIDAI' as const
      };

      // Test 1: Age 18+ proof
      addResult('\n📝 Test 1: Age 18+ Proof');
      addResult(`  DOB: ${mockAadharData.dateOfBirth} (Age: 34)`);
      
      const proof18 = await generateAgeProof(mockAadharData, 18, privateKey);
      addResult(`  Generated proof for minimum age 18`);
      addResult(`  Proof generated: ${proof18.proof ? '✅ PASS' : '❌ FAIL'}`);

      // Test 2: Age 21+ proof
      addResult('\n📝 Test 2: Age 21+ Proof');
      const proof21 = await generateAgeProof(mockAadharData, 21, privateKey);
      addResult(`  Generated proof for minimum age 21`);
      addResult(`  Proof generated: ${proof21.proof ? '✅ PASS' : '❌ FAIL'}`);

      // Test 3: Age 50+ proof (should still pass since user is 34... wait, needs adjustment)
      addResult('\n📝 Test 3: Young User Test');
      const youngUser = {
        ...mockAadharData,
        dateOfBirth: '01-01-2010' // 14 years old
      };
      
      try {
        const proofYoung = await generateAgeProof(youngUser, 18, privateKey);
        addResult(`  Generated proof for 14-year-old with min age 18: ${proofYoung ? '⚠️ Should have constraints' : '✅ PASS'}`);
      } catch (err) {
        addResult(`  Cannot generate proof for underage user: ✅ PASS (correctly rejected)`);
      }

      // Summary
      addResult('\n' + '━'.repeat(60));
      addResult('✅ All Age ZK Tests Completed!');

    } catch (error: any) {
      addResult(`\n❌ Error: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  const runBlockchainTests = async () => {
    setRunning(true);
    clearResults();
    addResult('🧪 Testing Blockchain Integration');
    addResult('━'.repeat(60));

    try {
      const { ContractInterface, createNetworkConfig, getContractInterface } = await import('../../lib/ContractInterface');
      
      addResult('\n📝 Test 1: Network Configuration');
      const config = createNetworkConfig('devnet');
      addResult(`  Network: ${config.networkId}`);
      addResult(`  DIDRegistry: ${config.didRegistryAddress.substring(0, 20)}...`);
      addResult(`  ZKPVerifier: ${config.zkpVerifierAddress.substring(0, 20)}...`);
      addResult(`  ✅ Network config loaded`);

      addResult('\n📝 Test 2: Contract Interface');
      const contractInterface = await getContractInterface();
      addResult(`  Contract interface initialized: ✅`);

      addResult('\n📝 Test 3: Blockchain Requirements');
      addResult(`  Note: All blockchain operations require:`);
      addResult(`    - Deployed contracts (no simulation mode)`);
      addResult(`    - Funded wallet`);
      addResult(`    - Network connection`);
      addResult(`  Verification will fail if contracts are not deployed`);

      addResult('\n' + '━'.repeat(60));
      addResult('✅ Blockchain Integration Tests Completed!');
      addResult('ℹ️  For full blockchain testing, use the signup/proof flows');

    } catch (error: any) {
      addResult(`\n❌ Error: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <GradientBG>
      <div className={styles.main}>
        <div className={styles.center}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
            🧪 Proof Testing Suite
          </h1>
          <p style={{ mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
            Test citizenship proofs, age proofs, and blockchain integration
          </p>
        </div>

        <div className={styles.stateContainer}>
          {/* Test Controls */}
          <div className={styles.state}>
            <h2 className={styles.bold}>Run Tests</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                onClick={runCitizenshipTests}
                disabled={running}
              >
                🌍 Test Citizenship ZK Proofs
              </button>
              <button 
                onClick={runAgeProofTests}
                disabled={running}
              >
                🎂 Test Age ZK Proofs
              </button>
              <button 
                onClick={runBlockchainTests}
                disabled={running}
              >
                ⛓️ Test Blockchain Integration
              </button>
              <button 
                onClick={clearResults}
                disabled={running}
                style={{ backgroundColor: '#666' }}
              >
                🗑️ Clear Results
              </button>
            </div>
          </div>

          {/* Test Results */}
          <div className={styles.state}>
            <h2 className={styles.bold}>Test Results</h2>
            <div style={{ 
              textAlign: 'left', 
              fontFamily: 'monospace', 
              fontSize: '0.875rem',
              backgroundColor: '#1a1a1a',
              padding: '1rem',
              borderRadius: '8px',
              maxHeight: '500px',
              overflowY: 'auto',
              marginTop: '1rem'
            }}>
              {testResults.length === 0 ? (
                <p style={{ color: '#888' }}>No tests run yet. Click a button above to start testing.</p>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} style={{ marginBottom: '0.25rem', whiteSpace: 'pre-wrap' }}>
                    {result}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Info */}
          <div className={styles.state}>
            <h2 className={styles.bold}>ℹ️ About Tests</h2>
            <div style={{ textAlign: 'left', fontSize: '0.875rem' }}>
              <p><strong>Citizenship Tests:</strong></p>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>Case-insensitive matching (India = india = INDIA)</li>
                <li>Whitespace handling</li>
                <li>Multiple proof verification</li>
                <li>Wrong citizenship rejection</li>
                <li>Salt validation</li>
              </ul>
              <p style={{ marginTop: '1rem' }}><strong>Age Tests:</strong></p>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>Age 18+ proof generation</li>
                <li>Age 21+ proof generation</li>
                <li>Underage user handling</li>
              </ul>
              <p style={{ marginTop: '1rem' }}><strong>Blockchain Tests:</strong></p>
              <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>Network configuration</li>
                <li>Contract interface initialization</li>
                <li>Deployed contract addresses</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </GradientBG>
  );
}
