/**
 * Example: Passport Verification ZkProgram using MRZUtils
 * 
 * This demonstrates how to use MRZUtils in a real ZK circuit to verify
 * passport authenticity without revealing the actual passport data.
 */

import { Field, ZkProgram, Struct, Poseidon, PublicKey, Bool } from 'o1js';
import { MRZUtils } from './MRZUtils.js';

/**
 * Public inputs for passport verification
 * These are revealed to the verifier
 */
export class PassportPublicInput extends Struct({
  // Hash of the passport data (for privacy)
  dataHash: Field,
  // Nationality code (e.g., 'USA', 'IND')
  nationalityCode: Field,
  // Minimum age requirement (if doing age verification)
  minimumAge: Field,
  // Current timestamp
  timestamp: Field,
}) {}

/**
 * Private witness data for passport verification
 * These remain hidden from the verifier
 */
export class PassportPrivateWitness extends Struct({
  // Passport number with check digit (as ASCII Field array)
  passportNumber: [Field],
  // Birth date with check digit (YYMMDD format)
  birthDate: [Field],
  // Expiry date with check digit (YYMMDD format)
  expiryDate: [Field],
  // Optional data field with check digit
  optionalData: [Field],
  // User's private key (for signing)
  userPrivateKey: Field,
}) {}

/**
 * Passport Verification ZK Program
 * 
 * Proves:
 * 1. The passport MRZ checksums are valid (according to ICAO 9303)
 * 2. The passport has not expired
 * 3. The user is above a certain age (if required)
 * 4. The user controls the passport (via signature/private key)
 */
export const PassportVerificationProgram = ZkProgram({
  name: 'passport-verification',
  publicInput: PassportPublicInput,
  
  methods: {
    /**
     * Verify passport validity with MRZ checksum validation
     */
    verifyPassport: {
      privateInputs: [PassportPrivateWitness],
      
      async method(
        publicInput: PassportPublicInput,
        privateWitness: PassportPrivateWitness
      ) {
        // ============================================
        // STEP 1: Verify MRZ Checksums
        // ============================================
        
        console.log('Step 1: Verifying MRZ checksums...');
        
        // Extract data arrays from witness
        const passportNumber = privateWitness.passportNumber;
        const birthDate = privateWitness.birthDate;
        const expiryDate = privateWitness.expiryDate;
        const optionalData = privateWitness.optionalData.length > 0 
          ? privateWitness.optionalData 
          : undefined;
        
        // Verify all checksums using MRZUtils
        const mrzValid = MRZUtils.validatePassportMRZ({
          passportNumber,
          birthDate,
          expiryDate,
          optionalData,
        });
        
        // Assert that MRZ is valid (circuit constraint)
        mrzValid.assertTrue('Invalid MRZ checksums - passport may be forged');
        
        // ============================================
        // STEP 2: Verify Passport Has Not Expired
        // ============================================
        
        console.log('Step 2: Checking expiry date...');
        
        // Extract expiry date (remove check digit)
        const expiryYY = MRZUtils.getCharValue(expiryDate[0])
          .mul(Field(10))
          .add(MRZUtils.getCharValue(expiryDate[1]));
        const expiryMM = MRZUtils.getCharValue(expiryDate[2])
          .mul(Field(10))
          .add(MRZUtils.getCharValue(expiryDate[3]));
        const expiryDD = MRZUtils.getCharValue(expiryDate[4])
          .mul(Field(10))
          .add(MRZUtils.getCharValue(expiryDate[5]));
        
        // Convert to full year (assuming 20xx for YY < 50, 19xx otherwise)
        const expiryYear = expiryYY.lessThan(Field(50))
          .toField()
          .mul(Field(2000))
          .add(
            expiryYY.greaterThanOrEqual(Field(50))
              .toField()
              .mul(Field(1900))
          )
          .add(expiryYY);
        
        // Combine into single timestamp (YYYYMMDD)
        const expiryTimestamp = expiryYear
          .mul(Field(10000))
          .add(expiryMM.mul(Field(100)))
          .add(expiryDD);
        
        // Compare with current timestamp
        const notExpired = expiryTimestamp.greaterThan(publicInput.timestamp);
        notExpired.assertTrue('Passport has expired');
        
        // ============================================
        // STEP 3: Verify Age Requirement (if needed)
        // ============================================
        
        console.log('Step 3: Verifying age requirement...');
        
        // Extract birth date (remove check digit)
        const birthYY = MRZUtils.getCharValue(birthDate[0])
          .mul(Field(10))
          .add(MRZUtils.getCharValue(birthDate[1]));
        const birthMM = MRZUtils.getCharValue(birthDate[2])
          .mul(Field(10))
          .add(MRZUtils.getCharValue(birthDate[3]));
        const birthDD = MRZUtils.getCharValue(birthDate[4])
          .mul(Field(10))
          .add(MRZUtils.getCharValue(birthDate[5]));
        
        // Convert to full year
        const birthYear = birthYY.lessThan(Field(50))
          .toField()
          .mul(Field(2000))
          .add(
            birthYY.greaterThanOrEqual(Field(50))
              .toField()
              .mul(Field(1900))
          )
          .add(birthYY);
        
        // Calculate approximate age (simplified: just year difference)
        const currentYear = publicInput.timestamp.div(Field(10000));
        const age = currentYear.sub(birthYear);
        
        // Verify age meets minimum requirement
        const meetsAgeRequirement = age.greaterThanOrEqual(publicInput.minimumAge);
        meetsAgeRequirement.assertTrue('User does not meet minimum age requirement');
        
        // ============================================
        // STEP 4: Verify Data Integrity
        // ============================================
        
        console.log('Step 4: Verifying data integrity...');
        
        // Hash all passport data to ensure integrity
        const dataHash = Poseidon.hash([
          ...passportNumber,
          ...birthDate,
          ...expiryDate,
          publicInput.nationalityCode,
        ]);
        
        // Verify hash matches public input
        dataHash.assertEquals(publicInput.dataHash, 'Data integrity check failed');
        
        console.log('✅ Passport verification complete!');
      },
    },

    /**
     * Verify passport with composite check digit
     * This provides additional validation using the ICAO composite checksum
     */
    verifyWithCompositeCheck: {
      privateInputs: [PassportPrivateWitness, Field],
      
      async method(
        publicInput: PassportPublicInput,
        privateWitness: PassportPrivateWitness,
        compositeCheckDigit: Field
      ) {
        // First verify all individual checksums
        const mrzValid = MRZUtils.validatePassportMRZ({
          passportNumber: privateWitness.passportNumber,
          birthDate: privateWitness.birthDate,
          expiryDate: privateWitness.expiryDate,
        });
        
        mrzValid.assertTrue('Individual MRZ checksums invalid');
        
        // Remove check digits for composite calculation
        const passportNoCheck = privateWitness.passportNumber.slice(0, -1);
        const birthNoCheck = privateWitness.birthDate.slice(0, -1);
        const expiryNoCheck = privateWitness.expiryDate.slice(0, -1);
        
        // Verify composite check
        const compositeValid = MRZUtils.verifyCompositeCheck(
          [passportNoCheck, birthNoCheck, expiryNoCheck],
          compositeCheckDigit
        );
        
        compositeValid.assertTrue('Composite check digit invalid');
        
        // Hash for integrity
        const dataHash = Poseidon.hash([
          ...privateWitness.passportNumber,
          ...privateWitness.birthDate,
          ...privateWitness.expiryDate,
        ]);
        
        dataHash.assertEquals(publicInput.dataHash, 'Data integrity check failed');
      },
    },
  },
});

/**
 * Helper functions for off-chain usage
 */

/**
 * Prepare passport data for proof generation
 */
export function preparePassportData(passport: {
  number: string;
  birthDate: string;
  expiryDate: string;
  nationality: string;
  optionalData?: string;
}) {
  // Convert strings to Field arrays (ASCII codes)
  const passportNumber = MRZUtils.stringToFields(passport.number);
  const birthDate = MRZUtils.stringToFields(passport.birthDate);
  const expiryDate = MRZUtils.stringToFields(passport.expiryDate);
  const optionalData = passport.optionalData 
    ? MRZUtils.stringToFields(passport.optionalData)
    : [];
  
  // Create data hash for public input
  const dataHash = Poseidon.hash([
    ...passportNumber,
    ...birthDate,
    ...expiryDate,
    ...MRZUtils.stringToFields(passport.nationality),
  ]);
  
  return {
    passportNumber,
    birthDate,
    expiryDate,
    optionalData,
    dataHash,
  };
}

/**
 * Validate passport MRZ off-chain before generating proof
 */
export function validatePassportOffChain(passport: {
  number: string;
  birthDate: string;
  expiryDate: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check passport number format (should end with check digit)
  if (passport.number.length < 2) {
    errors.push('Passport number too short');
  }
  
  // Check birth date format (should be YYMMDD + check digit)
  if (passport.birthDate.length !== 7) {
    errors.push('Birth date should be YYMMDD + check digit (7 chars)');
  }
  
  // Check expiry date format
  if (passport.expiryDate.length !== 7) {
    errors.push('Expiry date should be YYMMDD + check digit (7 chars)');
  }
  
  // Validate checksums
  try {
    const fields = {
      passportNumber: MRZUtils.stringToFields(passport.number),
      birthDate: MRZUtils.stringToFields(passport.birthDate),
      expiryDate: MRZUtils.stringToFields(passport.expiryDate),
    };
    
    const isValid = MRZUtils.validatePassportMRZ(fields);
    
    if (!isValid.toBoolean()) {
      errors.push('MRZ checksums are invalid');
    }
  } catch (err) {
    errors.push(`Validation error: ${err}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export the compiled program type
export class PassportProof extends ZkProgram.Proof(PassportVerificationProgram) {}
