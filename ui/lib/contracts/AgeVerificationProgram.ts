import { Field, ZkProgram, SelfProof, Poseidon, PublicKey, Struct } from 'o1js';

/**
 * Age Proof Public Input
 * Contains the data that will be public in the proof
 */
export class AgeProofPublicInput extends Struct({
  subjectPublicKey: PublicKey,  // User's public key
  minimumAge: Field,             // Minimum age requirement
  ageHash: Field,                // Hash of the actual age (keeps age private)
  issuerPublicKey: PublicKey,    // Issuer's public key
  timestamp: Field,              // When the proof was created
}) {}

/**
 * Age Verification ZkProgram
 * 
 * Generates zero-knowledge proofs that a person's age is greater than
 * a minimum requirement without revealing the actual age.
 * 
 * Example Use Case: Prove you're over 18 to access a service without
 * revealing you're 25 years old.
 */
export const AgeVerificationProgram = ZkProgram({
  name: 'age-verification',
  publicInput: AgeProofPublicInput,
  publicOutput: Field,

  methods: {
    /**
     * Initialize age proof
     * 
     * Creates the first proof in a potential chain of proofs.
     * Verifies that the actual age is greater than the minimum age.
     * 
     * @param publicInput - Contains subject, age hash, minimum age, issuer
     * @param actualAge - The real age (private input, not revealed)
     * @param salt - Random salt used in age hash (private)
     * @returns Commitment hash as public output
     */
    proveAgeAboveMinimum: {
      privateInputs: [Field, Field], // actualAge, salt
      
      async method(
        publicInput: AgeProofPublicInput,
        actualAge: Field,
        salt: Field
      ) {
        // Verify the age hash matches
        const computedHash = Poseidon.hash([actualAge, salt]);
        publicInput.ageHash.assertEquals(computedHash);

        // Verify age is above minimum (this stays private!)
        actualAge.assertGreaterThanOrEqual(publicInput.minimumAge);

        // Ensure age is reasonable (0-120)
        actualAge.assertGreaterThanOrEqual(Field(0));
        actualAge.assertLessThanOrEqual(Field(120));

        // Create commitment that proves verification without revealing age
        const commitment = Poseidon.hash([
          publicInput.ageHash,
          publicInput.minimumAge,
          ...publicInput.subjectPublicKey.toFields(),
          ...publicInput.issuerPublicKey.toFields(),
          publicInput.timestamp,
        ]);

        return { publicOutput: commitment };
      },
    },

    /**
     * Verify age in range
     * 
     * Proves age is within a specific range [min, max] without revealing exact age.
     * Useful for age-gated content (e.g., "must be 18-65 years old")
     * 
     * @param publicInput - Contains subject, age hash, minimum age (min), issuer
     * @param actualAge - The real age (private)
     * @param salt - Salt for age hash (private)
     * @param maximumAge - Maximum age allowed (private)
     * @returns Commitment hash
     */
    proveAgeInRange: {
      privateInputs: [Field, Field, Field], // actualAge, salt, maximumAge
      
      async method(
        publicInput: AgeProofPublicInput,
        actualAge: Field,
        salt: Field,
        maximumAge: Field
      ) {
        // Verify age hash
        const computedHash = Poseidon.hash([actualAge, salt]);
        publicInput.ageHash.assertEquals(computedHash);

        // Verify age is in range [minimum, maximum]
        actualAge.assertGreaterThanOrEqual(publicInput.minimumAge);
        actualAge.assertLessThanOrEqual(maximumAge);

        // Create commitment
        const commitment = Poseidon.hash([
          publicInput.ageHash,
          publicInput.minimumAge,
          maximumAge,
          ...publicInput.subjectPublicKey.toFields(),
          ...publicInput.issuerPublicKey.toFields(),
          publicInput.timestamp,
        ]);

        return { publicOutput: commitment };
      },
    },

    /**
     * Recursive proof composition
     * 
     * Combines multiple age proofs to create a composite proof.
     * Useful for proving multiple age-related claims at once.
     * 
     * @param publicInput - Public input for new proof
     * @param previousProof - Previous age proof in the chain
     * @returns Combined commitment
     */
    composeAgeProofs: {
      privateInputs: [SelfProof],
      
      async method(
        publicInput: AgeProofPublicInput,
        previousProof: SelfProof<AgeProofPublicInput, Field>
      ) {
        // Verify the previous proof
        previousProof.verify();

        // Verify the subject is the same
        publicInput.subjectPublicKey.assertEquals(
          previousProof.publicInput.subjectPublicKey
        );

        // Create new composite commitment
        const compositeCommitment = Poseidon.hash([
          previousProof.publicOutput,
          publicInput.ageHash,
          publicInput.minimumAge,
          ...publicInput.subjectPublicKey.toFields(),
          ...publicInput.issuerPublicKey.toFields(),
          publicInput.timestamp,
        ]);

        return { publicOutput: compositeCommitment };
      },
    },
  },
});

/**
 * Age Proof Class
 * Exported proof class for use in smart contracts
 */
export class AgeProof extends ZkProgram.Proof(AgeVerificationProgram) {}
