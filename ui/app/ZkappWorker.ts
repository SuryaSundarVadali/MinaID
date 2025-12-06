import { Mina, PublicKey, fetchAccount, Field, MerkleWitness, Poseidon, Cache } from 'o1js';
import * as Comlink from "comlink";
import { DIDRegistry } from '../lib/contracts/DIDRegistry';
import { ZKPVerifier } from '../lib/contracts/ZKPVerifier';
import { AgeVerificationProgram } from '../lib/contracts/AgeVerificationProgram';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// In-memory cache store for browser/worker
const cacheStore: Map<string, { header: string; data: Uint8Array }> = new Map();
let cacheInitialized = false;

/**
 * Pre-fetch cache files from public/cache directory into memory
 * Must be called before compilation
 */
async function initializeCache(cacheDirectory: string): Promise<void> {
  if (cacheInitialized) return;
  
  console.log('[Worker] Checking for cache files...');
  
  try {
    // Fetch the cache.json to know what files to load
    const cacheListRes = await fetch('/cache.json');
    if (!cacheListRes.ok) {
      console.log('[Worker] No cache available - contracts will compile from scratch');
      cacheInitialized = true;
      return;
    }
    
    const cacheList = await cacheListRes.json();
    const files = cacheList.files || [];
    
    if (files.length === 0) {
      console.log('[Worker] Empty cache list - compiling from scratch');
      cacheInitialized = true;
      return;
    }
    
    console.log(`[Worker] Attempting to load ${files.length} cache files...`);
    
    // Fetch all cache files in parallel - silently skip unavailable files
    let loadedCount = 0;
    await Promise.all(files.map(async (filename: string) => {
      try {
        const dataUrl = `${cacheDirectory}/${filename}`;
        const headerUrl = `${dataUrl}.header`;
        
        const [headerRes, dataRes] = await Promise.all([
          fetch(headerUrl),
          fetch(dataUrl),
        ]);
        
        if (!headerRes.ok || !dataRes.ok) {
          return;
        }
        
        const header = await headerRes.text();
        const dataText = await dataRes.text();
        const data = new Uint8Array(dataText.split(',').map(Number));
        
        cacheStore.set(filename, { header, data });
        loadedCount++;
      } catch (e) {
        // Silently skip
      }
    }));
    
    cacheInitialized = true;
    
    if (loadedCount > 0) {
      console.log(`[Worker] Loaded ${loadedCount} cache files`);
    } else {
      console.log('[Worker] No cache files available - compiling from scratch (2-3 minutes)');
    }
  } catch (e) {
    console.log('[Worker] Cache check skipped - compiling from scratch');
    cacheInitialized = true;
  }
}

// Create a synchronous cache that reads from pre-loaded memory store
const createBrowserCache = (): Cache => ({
  read({ persistentId, uniqueId, dataType }) {
    const cached = cacheStore.get(persistentId);
    if (!cached) {
      console.log(`[Worker Cache] Miss: ${persistentId}`);
      return undefined;
    }
    
    // Parse header to verify uniqueId and dataType
    const [storedUniqueId, storedDataType] = cached.header.split('\n');
    if (storedUniqueId !== uniqueId || storedDataType !== dataType) {
      console.log(`[Worker Cache] Mismatch for ${persistentId}`);
      return undefined;
    }
    
    console.log(`[Worker Cache] Hit: ${persistentId}`);
    return cached.data;
  },
  write({ persistentId }) {
    console.log(`[Worker Cache] Write (ignored in browser): ${persistentId}`);
  },
  canWrite: false,
});

const state = {
  DIDRegistryInstance: DIDRegistry,
  ZKPVerifierInstance: ZKPVerifier,
  AgeVerificationProgramInstance: AgeVerificationProgram,
  didRegistryContract: null as null | DIDRegistry,
  zkpVerifierContract: null as null | ZKPVerifier,
  transaction: null as null | Transaction,
  cache: null as null | Cache,
};

export const api = {

  async setActiveInstanceToBerkeley() {
    const Network = Mina.Network({
      mina: "https://api.minascan.io/node/berkeley/v1/graphql",
      archive: "https://api.minascan.io/archive/berkeley/v1/graphql"
    });
    console.log("Berkeley testnet network instance configured");
    Mina.setActiveInstance(Network);
  },

  async setActiveInstanceToDevnet() {
    const Network = Mina.Network(
      "https://api.minascan.io/node/devnet/v1/graphql"
    );
    console.log("Devnet network instance configured");
    Mina.setActiveInstance(Network);
  },

  async loadContracts() {
    console.log("Loading contracts in worker...");
    state.DIDRegistryInstance = DIDRegistry;
    state.ZKPVerifierInstance = ZKPVerifier;
    state.AgeVerificationProgramInstance = AgeVerificationProgram;
    
    // Pre-fetch cache files into memory
    await initializeCache('/cache');
    
    // Create browser cache from pre-loaded data
    state.cache = createBrowserCache();
    console.log("Cache initialized from memory store");
  },

  async compileAgeVerificationProgram() {
    console.log("Compiling AgeVerificationProgram with cache...");
    await state.AgeVerificationProgramInstance.compile({ cache: state.cache! });
    console.log("AgeVerificationProgram compiled");
  },

  async compileDIDRegistry() {
    console.log("Compiling DIDRegistry contract with cache...");
    await state.DIDRegistryInstance.compile({ cache: state.cache! });
    console.log("DIDRegistry contract compiled");
  },

  async compileZKPVerifier() {
    console.log("Compiling ZKPVerifier contract with cache...");
    await state.ZKPVerifierInstance.compile({ cache: state.cache! });
    console.log("ZKPVerifier contract compiled");
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
    await state.transaction!.prove();
  },

  async getTransactionJSON() {
    return state.transaction!.toJSON();
  }
}

// Expose the API to be used by the main thread
Comlink.expose(api);