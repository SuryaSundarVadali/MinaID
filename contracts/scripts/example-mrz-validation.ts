/**
 * Example: Using MRZUtils to Validate Passport Data
 * 
 * Run with: npm run build && node build/scripts/example-mrz-validation.js
 */

import { Field, Bool } from 'o1js';
import { MRZUtils } from '../src/lib/MRZUtils.js';

console.log('='.repeat(60));
console.log('MRZ Checksum Validation Example');
console.log('='.repeat(60));
console.log();

// Example 1: Basic Character Mapping
console.log('📋 Example 1: Character Mapping');
console.log('-'.repeat(60));

const charExamples = [
  { char: '0', ascii: 48, expected: 0 },
  { char: '5', ascii: 53, expected: 5 },
  { char: '9', ascii: 57, expected: 9 },
  { char: 'A', ascii: 65, expected: 10 },
  { char: 'M', ascii: 77, expected: 22 },
  { char: 'Z', ascii: 90, expected: 35 },
  { char: '<', ascii: 60, expected: 0 },
];

charExamples.forEach(({ char, ascii, expected }) => {
  const value = MRZUtils.getCharValue(Field(ascii));
  console.log(`'${char}' (ASCII ${ascii}) → ${value.toBigInt()} (expected: ${expected})`);
});

console.log();

// Example 2: Validate Passport Number
console.log('🛂 Example 2: Passport Number Validation');
console.log('-'.repeat(60));

const passportNumber = 'L898902C3';
const passportCheckDigit = '6';
const passportFull = passportNumber + passportCheckDigit;

console.log(`Passport Number: ${passportNumber}`);
console.log(`Check Digit: ${passportCheckDigit}`);

const passportFields = MRZUtils.stringToFields(passportNumber);
const calculatedCheck = MRZUtils.calculateCheckDigit(passportFields);

console.log(`Calculated Check Digit: ${calculatedCheck.toBigInt()}`);

const isValid = MRZUtils.verifyCheckDigit(passportFields, Field(6));
console.log(`✅ Valid: ${isValid.toBoolean()}`);

// Test with full string (including check digit)
const passportWithCheck = MRZUtils.stringToFields(passportFull);
const isValidFull = MRZUtils.validateMRZ(passportWithCheck);
console.log(`✅ Full validation: ${isValidFull.toBoolean()}`);

console.log();

// Example 3: Validate Birth Date
console.log('🎂 Example 3: Birth Date Validation');
console.log('-'.repeat(60));

const birthDate = '740812'; // Aug 12, 1974
const birthCheckDigit = '2';
const birthFull = birthDate + birthCheckDigit;

console.log(`Birth Date: ${birthDate} (YYMMDD format)`);
console.log(`Check Digit: ${birthCheckDigit}`);

const birthFields = MRZUtils.stringToFields(birthDate);
const birthCheck = MRZUtils.calculateCheckDigit(birthFields);

console.log(`Calculated Check Digit: ${birthCheck.toBigInt()}`);

const birthValid = MRZUtils.verifyCheckDigit(birthFields, Field(2));
console.log(`✅ Valid: ${birthValid.toBoolean()}`);

console.log();

// Example 4: Validate Expiry Date
console.log('📅 Example 4: Expiry Date Validation');
console.log('-'.repeat(60));

const expiryDate = '120415'; // Apr 15, 2012
const expiryCheckDigit = '9';
const expiryFull = expiryDate + expiryCheckDigit;

console.log(`Expiry Date: ${expiryDate} (YYMMDD format)`);
console.log(`Check Digit: ${expiryCheckDigit}`);

const expiryFields = MRZUtils.stringToFields(expiryDate);
const expiryCheck = MRZUtils.calculateCheckDigit(expiryFields);

console.log(`Calculated Check Digit: ${expiryCheck.toBigInt()}`);

const expiryValid = MRZUtils.verifyCheckDigit(expiryFields, Field(9));
console.log(`✅ Valid: ${expiryValid.toBoolean()}`);

console.log();

// Example 5: Complete Passport Validation
console.log('🌐 Example 5: Complete Passport MRZ Validation');
console.log('-'.repeat(60));

console.log('ICAO 9303 TD3 Specimen:');
console.log('Line 1: P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<');
console.log('Line 2: L898902C36UTO7408122F1204159ZE184226B<<<<<14');
console.log();

const completePassport = {
  passportNumber: MRZUtils.stringToFields(passportFull),
  birthDate: MRZUtils.stringToFields(birthFull),
  expiryDate: MRZUtils.stringToFields(expiryFull),
};

const allValid = MRZUtils.validatePassportMRZ(completePassport);

console.log('Validating all fields...');
console.log(`  Passport Number: ${passportFull} → ${isValidFull.toBoolean() ? '✅' : '❌'}`);
console.log(`  Birth Date: ${birthFull} → ${birthValid.toBoolean() ? '✅' : '❌'}`);
console.log(`  Expiry Date: ${expiryFull} → ${expiryValid.toBoolean() ? '✅' : '❌'}`);
console.log();
console.log(`🎉 Overall validation: ${allValid.toBoolean() ? 'PASSED ✅' : 'FAILED ❌'}`);

console.log();

// Example 6: Invalid Checksum Detection
console.log('❌ Example 6: Invalid Checksum Detection');
console.log('-'.repeat(60));

const invalidPassport = 'L898902C3';
const wrongCheckDigit = '7'; // Should be 6
const invalidFull = invalidPassport + wrongCheckDigit;

console.log(`Passport Number: ${invalidPassport}`);
console.log(`Wrong Check Digit: ${wrongCheckDigit} (correct is 6)`);

const invalidFields = MRZUtils.stringToFields(invalidFull);
const invalidCheck = MRZUtils.validateMRZ(invalidFields);

console.log(`Validation result: ${invalidCheck.toBoolean() ? 'PASSED ✅' : 'FAILED ❌'}`);
console.log('Expected: FAILED (because check digit is wrong)');

console.log();

// Example 7: Composite Check
console.log('🔗 Example 7: Composite Check Digit');
console.log('-'.repeat(60));

const compositeParts = [
  MRZUtils.stringToFields('L898902C3'),
  MRZUtils.stringToFields('740812'),
  MRZUtils.stringToFields('120415'),
];

const compositeCheck = MRZUtils.calculateCompositeCheck(compositeParts);

console.log('Calculating composite check for:');
console.log(`  - Passport: L898902C3`);
console.log(`  - Birth Date: 740812`);
console.log(`  - Expiry Date: 120415`);
console.log();
console.log(`Composite Check Digit: ${compositeCheck.toBigInt()}`);

// Verify composite check
const compositeValid = MRZUtils.verifyCompositeCheck(compositeParts, compositeCheck);
console.log(`✅ Composite valid: ${compositeValid.toBoolean()}`);

console.log();

// Example 8: Edge Cases
console.log('🔍 Example 8: Edge Cases');
console.log('-'.repeat(60));

// All fillers
const allFillers = MRZUtils.stringToFields('<<<<<<<');
const fillersCheck = MRZUtils.calculateCheckDigit(allFillers);
console.log(`All fillers '<<<<<<<' → Check digit: ${fillersCheck.toBigInt()}`);

// Single character
const singleChar = MRZUtils.stringToFields('A');
const singleCheck = MRZUtils.calculateCheckDigit(singleChar);
console.log(`Single char 'A' → Check digit: ${singleCheck.toBigInt()}`);

// Mixed characters
const mixed = MRZUtils.stringToFields('A1B2C3');
const mixedCheck = MRZUtils.calculateCheckDigit(mixed);
console.log(`Mixed 'A1B2C3' → Check digit: ${mixedCheck.toBigInt()}`);

console.log();
console.log('='.repeat(60));
console.log('✨ All examples completed successfully!');
console.log('='.repeat(60));
console.log();
console.log('💡 Key Takeaways:');
console.log('  1. MRZ checksums use ICAO 9303 algorithm with weights [7, 3, 1]');
console.log('  2. Characters are mapped: 0-9 → 0-9, A-Z → 10-35, < → 0');
console.log('  3. The witness pattern enables modulo 10 in ZK circuits');
console.log('  4. All operations use Field types for ZK compatibility');
console.log('  5. Invalid checksums are reliably detected');
console.log();
