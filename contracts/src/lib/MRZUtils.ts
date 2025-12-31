/**
 * MRZ (Machine Readable Zone) Checksum Calculator for o1js
 * 
 * Implements ICAO 9303 standard checksum validation for passport MRZ data
 * using Zero-Knowledge proof constraints.
 * 
 * CRITICAL: This code runs inside a ZK circuit. Standard JavaScript arithmetic
 * (like % operator) will NOT work on Field elements. We use the "Witness Pattern"
 * for modulo 10 operations.
 */

import { Field, Bool, Provable } from 'o1js';

export class MRZUtils {
  /**
   * Maps MRZ characters to their numeric values according to ICAO 9303
   * 
   * Mapping:
   * - '0'-'9' (ASCII 48-57) -> 0-9
   * - 'A'-'Z' (ASCII 65-90) -> 10-35
   * - '<' (ASCII 60) -> 0
   * 
   * @param charAscii - Field representing ASCII code of the character
   * @returns Field representing the mapped value (0-35)
   */
  static getCharValue(charAscii: Field): Field {
    // ASCII codes for reference:
    // '0' = 48, '9' = 57
    // 'A' = 65, 'Z' = 90
    // '<' = 60
    
    const ascii48 = Field(48); // '0'
    const ascii57 = Field(57); // '9'
    const ascii60 = Field(60); // '<'
    const ascii65 = Field(65); // 'A'
    const ascii90 = Field(90); // 'Z'
    
    // Check if it's a digit ('0'-'9')
    const isDigit = charAscii.greaterThanOrEqual(ascii48)
      .and(charAscii.lessThanOrEqual(ascii57));
    const digitValue = charAscii.sub(ascii48);
    
    // Check if it's a letter ('A'-'Z')
    const isLetter = charAscii.greaterThanOrEqual(ascii65)
      .and(charAscii.lessThanOrEqual(ascii90));
    const letterValue = charAscii.sub(ascii65).add(Field(10));
    
    // Check if it's the filler character '<'
    const isFiller = charAscii.equals(ascii60);
    const fillerValue = Field(0);
    
    // Return the appropriate value using provable conditionals
    const value1 = Provable.if(isDigit, digitValue, Field(0));
    const value2 = Provable.if(isLetter, letterValue, value1);
    const finalValue = Provable.if(isFiller, fillerValue, value2);
    
    return finalValue;
  }

  /**
   * Calculates the MRZ check digit using the witness pattern for modulo 10.
   * 
   * Process:
   * 1. Map each character to its ICAO value
   * 2. Multiply by weight [7, 3, 1] repeating
   * 3. Sum all products
   * 4. Calculate sum % 10 using witness pattern
   * 
   * @param data - Array of Fields representing ASCII codes of MRZ characters
   * @returns Field representing the check digit (0-9)
   */
  static calculateCheckDigit(data: Field[]): Field {
    // Weight sequence [7, 3, 1] repeating
    const weights = [Field(7), Field(3), Field(1)];
    
    // Calculate weighted sum
    let sum = Field(0);
    
    for (let i = 0; i < data.length; i++) {
      const charValue = this.getCharValue(data[i]);
      const weight = weights[i % 3];
      const product = charValue.mul(weight);
      sum = sum.add(product);
    }
    
    // CRITICAL: Witness Pattern for Modulo 10
    // We cannot use sum.mod(10) directly in a ZK circuit.
    // Instead, we compute the result off-chain and prove it's correct.
    
    // Witness the quotient and remainder
    const quotient = Provable.witness(Field, () => {
      const sumValue = sum.toBigInt();
      return Field(sumValue / 10n);
    });
    
    const remainder = Provable.witness(Field, () => {
      const sumValue = sum.toBigInt();
      return Field(sumValue % 10n);
    });
    
    // Prove the division is correct: quotient * 10 + remainder = sum
    const reconstructed = quotient.mul(Field(10)).add(remainder);
    reconstructed.assertEquals(sum, 'Invalid modulo 10 calculation');
    
    // Prove remainder is in range [0, 9]
    remainder.assertLessThanOrEqual(Field(9), 'Remainder must be less than 10');
    remainder.assertGreaterThanOrEqual(Field(0), 'Remainder must be non-negative');
    
    return remainder;
  }

  /**
   * Verifies if the provided check digit matches the calculated check digit.
   * 
   * @param data - Array of Fields representing ASCII codes of MRZ characters
   * @param expectedCheckDigit - Field representing the expected check digit (0-9)
   * @returns Bool - true if check digit is valid, false otherwise
   */
  static verifyCheckDigit(data: Field[], expectedCheckDigit: Field): Bool {
    const calculated = this.calculateCheckDigit(data);
    return calculated.equals(expectedCheckDigit);
  }

  /**
   * Validates a complete MRZ field with its embedded check digit.
   * 
   * @param mrzWithCheck - Array of Fields representing MRZ data with check digit at the end
   * @returns Bool - true if the check digit is valid
   */
  static validateMRZ(mrzWithCheck: Field[]): Bool {
    if (mrzWithCheck.length === 0) {
      return Bool(false);
    }
    
    // Extract data (all except last) and check digit (last)
    const data = mrzWithCheck.slice(0, -1);
    const checkDigit = mrzWithCheck[mrzWithCheck.length - 1];
    
    // Convert check digit from ASCII to numeric value
    const checkDigitValue = this.getCharValue(checkDigit);
    
    return this.verifyCheckDigit(data, checkDigitValue);
  }

  /**
   * Helper function to convert a string to an array of Field elements (ASCII codes).
   * 
   * NOTE: This should be called OFF-CHAIN (in the prover, not in the circuit).
   * It's provided as a utility for testing and integration.
   * 
   * @param str - Input string
   * @returns Array of Fields representing ASCII codes
   */
  static stringToFields(str: string): Field[] {
    return str.split('').map(char => Field(char.charCodeAt(0)));
  }

  /**
   * Validates multiple MRZ check digits at once (e.g., passport number, birth date, expiry date).
   * 
   * Example for TD3 (passport):
   * - Passport number (chars 0-8, check at 9)
   * - Birth date (chars 13-18, check at 19)
   * - Expiry date (chars 21-26, check at 27)
   * - Composite check (chars 0-9, 13-19, 21-43, check at 43)
   * 
   * @param fields - Object containing arrays of Fields for each MRZ field
   * @returns Bool - true if all check digits are valid
   */
  static validatePassportMRZ(fields: {
    passportNumber: Field[];
    birthDate: Field[];
    expiryDate: Field[];
    optionalData?: Field[];
  }): Bool {
    const passportValid = this.validateMRZ(fields.passportNumber);
    const birthDateValid = this.validateMRZ(fields.birthDate);
    const expiryDateValid = this.validateMRZ(fields.expiryDate);
    
    let allValid = passportValid.and(birthDateValid).and(expiryDateValid);
    
    if (fields.optionalData && fields.optionalData.length > 0) {
      const optionalValid = this.validateMRZ(fields.optionalData);
      allValid = allValid.and(optionalValid);
    }
    
    return allValid;
  }

  /**
   * Calculates the composite check digit for the entire MRZ line.
   * Used in TD3 (passport) format where a final check digit validates the entire line.
   * 
   * @param compositeParts - Array of Field arrays representing different parts of the MRZ
   * @returns Field - the composite check digit (0-9)
   */
  static calculateCompositeCheck(compositeParts: Field[][]): Field {
    // Flatten all parts into a single array
    const allData: Field[] = [];
    for (const part of compositeParts) {
      allData.push(...part);
    }
    
    return this.calculateCheckDigit(allData);
  }

  /**
   * Verifies the composite check digit for a complete MRZ.
   * 
   * @param compositeParts - Array of Field arrays representing different parts of the MRZ
   * @param expectedCheckDigit - The expected composite check digit
   * @returns Bool - true if composite check is valid
   */
  static verifyCompositeCheck(compositeParts: Field[][], expectedCheckDigit: Field): Bool {
    const calculated = this.calculateCompositeCheck(compositeParts);
    return calculated.equals(expectedCheckDigit);
  }
}
