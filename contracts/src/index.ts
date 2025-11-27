import { DIDRegistry } from './DIDRegistry.js';
import { ZKPVerifier, CredentialClaim } from './ZKPVerifier.js';
import { 
  AgeVerificationProgram, 
  AgeProof, 
  AgeProofPublicInput 
} from './AgeVerificationProgram.js';
import {
  CitizenshipVerificationProgram,
  CitizenshipProof,
  CitizenshipProofPublicInput,
  createCitizenshipHash,
  citizenshipToField,
  compileCitizenshipProgram
} from './CitizenshipProof.js';

export { 
  DIDRegistry,
  ZKPVerifier,
  CredentialClaim,
  AgeVerificationProgram,
  AgeProof,
  AgeProofPublicInput,
  CitizenshipVerificationProgram,
  CitizenshipProof,
  CitizenshipProofPublicInput,
  createCitizenshipHash,
  citizenshipToField,
  compileCitizenshipProgram
};
