import { Mina, PublicKey, fetchAccount, Field, MerkleWitness, Poseidon } from 'o1js';
import * as Comlink from "comlink";

// Note: These types are placeholders since contracts aren't used in Web Worker currently
type DIDRegistry = any;
type ZKPVerifier = any;

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

const state = {
  DIDRegistryInstance: null as any,
  ZKPVerifierInstance: null as any,
  AgeVerificationProgramInstance: null as any,
  didRegistryContract: null as null | DIDRegistry,
  zkpVerifierContract: null as null | ZKPVerifier,
  transaction: null as null | Transaction
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
    // Note: Contract loading disabled - contracts not available in web worker context
    // In production, use ContractInterface instead
    console.log("Contract loading skipped - using ContractInterface instead");
    // Placeholder instances
    state.DIDRegistryInstance = null;
    state.ZKPVerifierInstance = null;
    state.AgeVerificationProgramInstance = null;
  },

  async compileAgeVerificationProgram() {
    console.log("Compiling AgeVerificationProgram...");
    await state.AgeVerificationProgramInstance!.compile();
    console.log("AgeVerificationProgram compiled");
  },

  async compileDIDRegistry() {
    console.log("Compiling DIDRegistry contract...");
    await state.DIDRegistryInstance!.compile();
    console.log("DIDRegistry contract compiled");
  },

  async compileZKPVerifier() {
    console.log("Compiling ZKPVerifier contract...");
    await state.ZKPVerifierInstance!.compile();
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