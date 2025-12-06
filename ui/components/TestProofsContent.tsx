'use client';

import React, { useState } from 'react';
import { PrivateKey, PublicKey } from 'o1js';
import { 
  generateCitizenshipZKProof, 
  verifyCitizenshipZKProof,
  generateAgeProof
} from '../lib/ProofGenerator';
import styles from '../styles/Home.module.css';
import GradientBG from './GradientBG';

export default function TestProofsContent() {
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
      addResult(`  Verify "  india  " (whitespace): ${verify2d ? '✅ PASS' : '❌ FAIL'}`);

      // Test 3: Different country
      addResult('\n📝 Test 3: Different Country (Should Fail)');
      const verify3 = verifyCitizenshipZKProof('USA', proof1.commitment, salt, proof1.signature, publicKey);
      addResult(`  Verify "USA" against India proof: ${!verify3 ? '✅ PASS (correctly failed)' : '❌ FAIL (should have failed)'}`);

      // Test 4: Invalid salt
      addResult('\n📝 Test 4: Invalid Salt (Should Fail)');
      const verify4 = verifyCitizenshipZKProof('India', proof1.commitment, 'wrong_salt', proof1.signature, publicKey);
      addResult(`  Verify with wrong salt: ${!verify4 ? '✅ PASS (correctly failed)' : '❌ FAIL (should have failed)'}`);

      addResult('\n' + '━'.repeat(60));
      addResult('✅ All citizenship tests completed!');
    } catch (error: any) {
      addResult(`\n❌ Error: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  const runAgeTests = async () => {
    setRunning(true);
    clearResults();
    addResult('🧪 Testing Age Proofs');
    addResult('━'.repeat(60));

    try {
      const privateKey = PrivateKey.random();
      const publicKey = privateKey.toPublicKey();

      // Mock Aadhar data for a 25-year-old
      const mockAadhar25 = {
        uid: '1234-5678-9012',
        name: 'Test User',
        dateOfBirth: '01-01-1999', // 25 years old
        gender: 'M' as const,
        address: {
          country: 'India',
          state: 'Test State',
          district: 'Test District',
          locality: 'Test Locality',
          pincode: '123456',
        },
        issuer: 'UIDAI' as const,
        verifiedAt: Date.now(),
      };

      // Test with age 25 (should pass for 18+)
      addResult('\n📝 Test 1: Age Proof for 25-year-old (min 18)');
      const proof1 = await generateAgeProof(mockAadhar25, 18, privateKey);
      addResult(`  Generated age proof`);
      addResult(`  Minimum age: ${proof1.minimumAge}`);
      addResult(`  Proof generated: ✅ YES`);

      // Mock Aadhar data for a 16-year-old
      const mockAadhar16 = {
        uid: '9876-5432-1098',
        name: 'Young User',
        dateOfBirth: '01-01-2008', // 16 years old
        gender: 'F' as const,
        address: {
          country: 'India',
          state: 'Test State',
          district: 'Test District',
          locality: 'Test Locality',
          pincode: '123456',
        },
        issuer: 'UIDAI' as const,
        verifiedAt: Date.now(),
      };

      // Test with age 16 (should fail for 18+)
      addResult('\n📝 Test 2: Age Proof for 16-year-old (min 18)');
      try {
        const proof2 = await generateAgeProof(mockAadhar16, 18, privateKey);
        addResult(`  Proof generated (unexpected): ❌ FAIL (should have thrown)`);
      } catch (error: any) {
        addResult(`  ✅ PASS - Correctly rejected: ${error.message}`);
      }

      addResult('\n' + '━'.repeat(60));
      addResult('✅ All age tests completed!');
    } catch (error: any) {
      addResult(`\n❌ Error: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <GradientBG>
      <div className={styles.main}>
        <div className="w-full max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-white mb-8 text-center">
            🧪 ZK Proof Test Suite
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button
              onClick={runCitizenshipTests}
              disabled={running}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {running ? 'Running...' : '🌍 Run Citizenship Tests'}
            </button>
            <button
              onClick={runAgeTests}
              disabled={running}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {running ? 'Running...' : '🎂 Run Age Tests'}
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm text-green-400 min-h-[400px] overflow-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-500">Click a button above to run tests...</p>
            ) : (
              testResults.map((result, index) => (
                <pre key={index} className="whitespace-pre-wrap">{result}</pre>
              ))
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={clearResults}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Clear Results
            </button>
          </div>
        </div>
      </div>
    </GradientBG>
  );
}
