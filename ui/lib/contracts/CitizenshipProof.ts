import { Field, ZkProgram, Poseidon, PublicKey, Struct, Bool, Provable } from 'o1js';

/**
 * Citizenship Proof Public Input
 * Contains the data that will be public in the proof
 */
export class CitizenshipProofPublicInput extends Struct({
  subjectPublicKey: PublicKey,    // User's public key
  citizenshipHash: Field,         // Hash of the citizenship (normalized to lowercase)
  issuerPublicKey: PublicKey,     // Issuer's public key (e.g., UIDAI)
  timestamp: Field,               // When the proof was created
}) {}

/**
 * Helper to convert string to Field array (case-insensitive)
 * Converts to lowercase first to ensure case-insensitive matching
 * 
 * @param str - The string to convert
 * @returns Array of Field elements representing the string
 */
export function stringToFields(str: string): Field[] {
  // Normalize to lowercase for case-insensitive comparison
  const normalized = str.toLowerCase().trim();
  const fields: Field[] = [];
  
  // Convert each character to its ASCII code as a Field
  for (let i = 0; i < normalized.length; i++) {
    fields.push(Field(normalized.charCodeAt(i)));
  }
  
  return fields;
}

/**
 * Citizenship Verification ZkProgram
 * 
 * Generates zero-knowledge proofs that verify a person's citizenship
 * without revealing the exact citizenship unless needed. Uses case-insensitive
 * matching to prevent verification failures due to capitalization differences.
 * 
 * Example Use Case: 
 * - Prove citizenship is "India" when verifier checks "india", "INDIA", or "India"
 * - Selective disclosure: Share citizenship proof only when needed
 * 
 * Security Features:
 * - Case-insensitive: "India", "india", "INDIA" all match
 * - Uses Poseidon hash for efficient ZK proofs
 * - Salted commitments prevent rainbow table attacks
 */
export const CitizenshipVerificationProgram = ZkProgram({
  name: 'citizenship-verification',
  publicInput: CitizenshipProofPublicInput,
  publicOutput: Field,

  methods: {
    /**
     * Prove Citizenship Match
     * 
     * Creates a ZK proof that the user's citizenship matches a specific value
     * without revealing the citizenship directly. Uses case-insensitive comparison.
     * 
     * @param publicInput - Contains subject, citizenship hash, issuer, timestamp
     * @param actualCitizenship - The real citizenship value (private, normalized to lowercase)
     * @param salt - Random salt used in citizenship hash (private)
     * @param expectedCitizenship - The citizenship to verify against (private, normalized)
     * @returns Commitment hash as public output
     */
    proveCitizenshipMatch: {
      privateInputs: [Field, Field, Field], // actualCitizenship (as Field array hash), salt, expectedCitizenship
      
      async method(
        publicInput: CitizenshipProofPublicInput,
        actualCitizenship: Field,      // Hash of actual citizenship string
        salt: Field,
        expectedCitizenship: Field     // Hash of expected citizenship string
      ) {
        // Verify the citizenship hash matches the stored hash
        const computedHash = Poseidon.hash([actualCitizenship, salt]);
        publicInput.citizenshipHash.assertEquals(computedHash);

        // Verify actual citizenship matches expected (case-insensitive, already normalized)
        actualCitizenship.assertEquals(expectedCitizenship);

        // Create commitment proving verification succeeded
        const commitment = Poseidon.hash([
          publicInput.citizenshipHash,
          expectedCitizenship,
          ...publicInput.subjectPublicKey.toFields(),
          ...publicInput.issuerPublicKey.toFields(),
          publicInput.timestamp,
        ]);

        return { publicOutput: commitment };
      },
    },

    /**
     * Prove Citizenship with Selective Disclosure
     * 
     * Proves citizenship matches one of several allowed values without revealing
     * which specific one. Useful for regional access control.
     * 
     * Example: Prove citizenship is either "India" or "USA" for SAARC/NAFTA access
     * 
     * @param publicInput - Contains subject, citizenship hash, issuer, timestamp
     * @param actualCitizenship - The real citizenship (private)
     * @param salt - Salt for hash (private)
     * @param allowedCitizenship1 - First allowed citizenship (private)
     * @param allowedCitizenship2 - Second allowed citizenship (private)
     * @returns Commitment hash
     */
    proveCitizenshipInSet: {
      privateInputs: [Field, Field, Field, Field], // actualCitizenship, salt, allowed1, allowed2
      
      async method(
        publicInput: CitizenshipProofPublicInput,
        actualCitizenship: Field,
        salt: Field,
        allowedCitizenship1: Field,
        allowedCitizenship2: Field
      ) {
        // Verify citizenship hash
        const computedHash = Poseidon.hash([actualCitizenship, salt]);
        publicInput.citizenshipHash.assertEquals(computedHash);

        // Check if citizenship matches any of the allowed values
        const matchesFirst = actualCitizenship.equals(allowedCitizenship1);
        const matchesSecond = actualCitizenship.equals(allowedCitizenship2);
        const isValid = matchesFirst.or(matchesSecond);

        // Assert at least one match
        isValid.assertTrue();

        // Create commitment
        const commitment = Poseidon.hash([
          publicInput.citizenshipHash,
          allowedCitizenship1,
          allowedCitizenship2,
          ...publicInput.subjectPublicKey.toFields(),
          ...publicInput.issuerPublicKey.toFields(),
          publicInput.timestamp,
        ]);

        return { publicOutput: commitment };
      },
    },

    /**
     * Prove Citizenship NOT in Restricted Set
     * 
     * Proves citizenship is NOT one of the restricted values.
     * Useful for sanctions compliance, restricted access lists.
     * 
     * @param publicInput - Contains subject, citizenship hash, issuer, timestamp
     * @param actualCitizenship - The real citizenship (private)
     * @param salt - Salt for hash (private)
     * @param restrictedCitizenship1 - First restricted citizenship (private)
     * @param restrictedCitizenship2 - Second restricted citizenship (private)
     * @returns Commitment hash
     */
    proveCitizenshipNotRestricted: {
      privateInputs: [Field, Field, Field, Field], // actualCitizenship, salt, restricted1, restricted2
      
      async method(
        publicInput: CitizenshipProofPublicInput,
        actualCitizenship: Field,
        salt: Field,
        restrictedCitizenship1: Field,
        restrictedCitizenship2: Field
      ) {
        // Verify citizenship hash
        const computedHash = Poseidon.hash([actualCitizenship, salt]);
        publicInput.citizenshipHash.assertEquals(computedHash);

        // Verify citizenship does NOT match restricted values
        const matchesFirst = actualCitizenship.equals(restrictedCitizenship1);
        const matchesSecond = actualCitizenship.equals(restrictedCitizenship2);
        const isRestricted = matchesFirst.or(matchesSecond);

        // Assert NOT restricted
        isRestricted.assertFalse();

        // Create commitment
        const commitment = Poseidon.hash([
          publicInput.citizenshipHash,
          restrictedCitizenship1,
          restrictedCitizenship2,
          ...publicInput.subjectPublicKey.toFields(),
          ...publicInput.issuerPublicKey.toFields(),
          publicInput.timestamp,
        ]);

        return { publicOutput: commitment };
      },
    },
  },
});

/**
 * Compile the citizenship verification program
 * Must be called before generating or verifying proofs
 */
export async function compileCitizenshipProgram() {
  console.log('Compiling citizenship verification program...');
  const { verificationKey } = await CitizenshipVerificationProgram.compile();
  console.log('Citizenship program compiled successfully');
  return verificationKey;
}

/**
 * Create a citizenship hash from a string (case-insensitive)
 * 
 * @param citizenship - The citizenship string (e.g., "India", "india", "INDIA")
 * @param salt - Random salt for the hash
 * @returns Field representing the citizenship hash
 */
export function createCitizenshipHash(citizenship: string, salt: Field): Field {
  // Normalize to lowercase and trim
  const normalized = citizenship.toLowerCase().trim();
  
  // Convert string to Field using character codes
  const charFields: Field[] = [];
  for (let i = 0; i < normalized.length; i++) {
    charFields.push(Field(normalized.charCodeAt(i)));
  }
  
  // Create a single hash from all characters
  const citizenshipField = Poseidon.hash(charFields);
  
  // Return salted hash
  return Poseidon.hash([citizenshipField, salt]);
}

/**
 * Convert citizenship string to a single Field (case-insensitive)
 * Used for comparisons in ZK proofs
 * 
 * @param citizenship - The citizenship string
 * @returns Field representing the citizenship
 */
export function citizenshipToField(citizenship: string): Field {
  const normalized = citizenship.toLowerCase().trim();
  const charFields: Field[] = [];
  
  for (let i = 0; i < normalized.length; i++) {
    charFields.push(Field(normalized.charCodeAt(i)));
  }
  
  return Poseidon.hash(charFields);
}

// Export proof class for type checking
export class CitizenshipProof extends ZkProgram.Proof(CitizenshipVerificationProgram) {}
