import { Mina, PublicKey, fetchAccount, Field, Poseidon } from 'o1js';
import * as Comlink from "comlink";
import { DIDRegistry } from '../lib/contracts/DIDRegistry';
import { ZKPVerifier } from '../lib/contracts/ZKPVerifier';
import { AgeVerificationProgram } from '../lib/contracts/AgeVerificationProgram';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

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
    console.log("Contracts loaded - will compile from scratch when needed (2-3 min)");
  },

  async compileAgeVerificationProgram() {
    console.log("Compiling AgeVerificationProgram from scratch...");
    const result = await state.AgeVerificationProgramInstance.compile();
    console.log("AgeVerificationProgram compiled, vk:", result.verificationKey.hash.toString().slice(0, 10) + '...');
  },

  async compileDIDRegistry() {
    console.log("Compiling DIDRegistry from scratch (2-3 min)...");
    const result = await state.DIDRegistryInstance.compile();
    console.log("DIDRegistry compiled, vk:", result.verificationKey.hash.toString().slice(0, 10) + '...');
  },

  async compileZKPVerifier() {
    console.log("Compiling ZKPVerifier from scratch...");
    const result = await state.ZKPVerifierInstance.compile();
    console.log("ZKPVerifier compiled, vk:", result.verificationKey.hash.toString().slice(0, 10) + '...');
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