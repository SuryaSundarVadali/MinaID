import { Mina, PublicKey, fetchAccount, Field, Poseidon, Cache } from 'o1js';
import * as Comlink from "comlink";
import { DIDRegistry } from '../lib/contracts/DIDRegistry';
import { ZKPVerifier } from '../lib/contracts/ZKPVerifier';
import { AgeVerificationProgram } from '../lib/contracts/AgeVerificationProgram';
import { getCacheLoader } from '../lib/CacheLoader';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// Progress callback type
export type ProgressCallback = (step: string, percentage: number, message?: string) => void;

const state = {
  DIDRegistryInstance: DIDRegistry,
  ZKPVerifierInstance: ZKPVerifier,
  AgeVerificationProgramInstance: AgeVerificationProgram,
  didRegistryContract: null as null | DIDRegistry,
  zkpVerifierContract: null as null | ZKPVerifier,
  transaction: null as null | Transaction,
  cache: null as null | Cache,
  progressCallback: null as null | ProgressCallback,
  cacheLoader: getCacheLoader((progress) => {
    console.log(`[Cache] Loading ${progress.fileId}: ${progress.percentage.toFixed(1)}%`);
    if (state.progressCallback) {
      state.progressCallback('LOADING_CACHE', progress.percentage, `Loading ${progress.fileId}`);
    }
  }),
};

export const api = {

  setProgressCallback: Comlink.proxy((callback: ProgressCallback) => {
    state.progressCallback = callback;
  }),

  async setActiveInstanceToBerkeley() {
    state.progressCallback?.('INITIALIZING', 5, 'Connecting to Berkeley network');
    const Network = Mina.Network({
      mina: "https://api.minascan.io/node/berkeley/v1/graphql",
      archive: "https://api.minascan.io/archive/berkeley/v1/graphql"
    });
    console.log("Berkeley testnet network instance configured");
    Mina.setActiveInstance(Network);
  },

  async setActiveInstanceToDevnet() {
    state.progressCallback?.('INITIALIZING', 5, 'Connecting to Devnet');
    const Network = Mina.Network(
      "https://api.minascan.io/node/devnet/v1/graphql"
    );
    console.log("Devnet network instance configured");
    Mina.setActiveInstance(Network);
  },

  async loadContracts() {
    state.progressCallback?.('INITIALIZING', 10, 'Loading contract modules');
    console.log("Loading contracts in worker...");
    state.DIDRegistryInstance = DIDRegistry;
    state.ZKPVerifierInstance = ZKPVerifier;
    state.AgeVerificationProgramInstance = AgeVerificationProgram;
    console.log("Contracts loaded - will compile from scratch when needed (2-3 min)");
  },

  async compileAgeVerificationProgram() {
    state.progressCallback?.('COMPILING_CIRCUIT', 20, 'Compiling AgeVerificationProgram');
    console.log("Compiling AgeVerificationProgram from scratch...");
    const result = await state.AgeVerificationProgramInstance.compile();
    state.progressCallback?.('COMPILING_CIRCUIT', 40, 'AgeVerificationProgram compiled');
    console.log("AgeVerificationProgram compiled, vk:", result.verificationKey.hash.toString().slice(0, 10) + '...');
  },

  async compileDIDRegistry() {
    state.progressCallback?.('FETCHING_KEYS', 15, 'Preloading cache files');
    console.log("Compiling DIDRegistry...");
    
    // Preload critical cache files for registerDIDSimple method
    console.log("[Cache] Preloading cache for registerDIDSimple...");
    await state.cacheLoader.preloadForMethod('didregistry', 'registerdidsimple');
    
    // Create o1js Cache that uses Merkle-cached files
    const cache = Cache.FileSystemDefault;
    state.cache = cache;
    
    state.progressCallback?.('COMPILING_CIRCUIT', 30, 'Compiling DIDRegistry');
    console.log("Compiling DIDRegistry with cached files...");
    const result = await state.DIDRegistryInstance.compile({ cache });
    state.progressCallback?.('COMPILING_CIRCUIT', 45, 'DIDRegistry compiled');
    console.log("✅ DIDRegistry compiled, vk:", result.verificationKey.hash.toString().slice(0, 10) + '...');
  },

  async compileZKPVerifier() {
    state.progressCallback?.('FETCHING_KEYS', 15, 'Preloading cache files');
    console.log("Compiling ZKPVerifier...");
    
    // Preload cache for verifyAgeProof method
    console.log("[Cache] Preloading cache for verifyAgeProof...");
    await state.cacheLoader.preloadForMethod('zkpverifier', 'verifyageproof');
    
    const cache = Cache.FileSystemDefault;
    state.cache = cache;
    
    state.progressCallback?.('COMPILING_CIRCUIT', 30, 'Compiling ZKPVerifier');
    console.log("Compiling ZKPVerifier with cached files...");
    const result = await state.ZKPVerifierInstance.compile({ cache });
    state.progressCallback?.('COMPILING_CIRCUIT', 45, 'ZKPVerifier compiled');
    console.log("✅ ZKPVerifier compiled, vk:", result.verificationKey.hash.toString().slice(0, 10) + '...');
  },

  async fetchAccount(publicKey58: string) {
    const publicKey = PublicKey.fromBase58(publicKey58);
    return fetchAccount({ publicKey });
  },

  async initDIDRegistryInstance(publicKey58: string) {
    const publicKey = PublicKey.fromBase58(publicKey58);
    state.didRegistryContract = new state.DIDRegistryInstance!(publicKey);
  },

  async initZKPVerifierInstance(publicKey58: string) {
    const publicKey = PublicKey.fromBase58(publicKey58);
    state.zkpVerifierContract = new state.ZKPVerifierInstance!(publicKey);
  },

  async getDIDStatus(userPublicKey58: string) {
    const userPublicKey = PublicKey.fromBase58(userPublicKey58);
    const didHash = Poseidon.hash(userPublicKey.toFields());
    // Note: In real implementation, would check Merkle tree
    return JSON.stringify({ exists: true, hash: didHash.toString() });
  },

  async createRegisterDIDTransaction(
    userPublicKey58: string,
    witnessData: any
  ) {
    const userPublicKey = PublicKey.fromBase58(userPublicKey58);
    // Note: Witness would be created from actual Merkle tree
    state.transaction = await Mina.transaction(async () => {
      // Simplified - in real implementation would use MerkleWitness
      // await state.didRegistryContract!.registerDID(userPublicKey, witness);
    });
  },

  async proveTransaction() {
    state.progressCallback?.('PROVING', 60, 'Generating zero-knowledge proof');
    await state.transaction!.prove();
    state.progressCallback?.('PROVING', 75, 'Proof generated');
  },

  async getTransactionJSON() {
    return state.transaction!.toJSON();
  }
}

// Expose the API to be used by the main thread
Comlink.expose(api);