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
import { MRZUtils } from './lib/MRZUtils.js';
import {
  PassportVerificationProgram,
  PassportProof,
  PassportPublicInput,
  preparePassportData,
  validatePassportOffChain
} from './lib/PassportVerificationProgram.js';

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
  compileCitizenshipProgram,
  MRZUtils,
  PassportVerificationProgram,
  PassportProof,
  PassportPublicInput,
  preparePassportData,
  validatePassportOffChain
};
