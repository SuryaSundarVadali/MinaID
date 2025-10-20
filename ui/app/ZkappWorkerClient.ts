
import { PublicKey } from "o1js";
import * as Comlink from "comlink";

export default class ZkappWorkerClient {
  worker: Worker;

  // Proxy to interact with the worker's methods as if they were local
  remoteApi: Comlink.Remote<typeof import('./ZkappWorker').api>; 
  
  constructor() {
    // Initialize the worker from the ZkappWorker module
    const worker = new Worker(new URL('./ZkappWorker.ts', import.meta.url), { type: 'module' });  
    // Wrap the worker with Comlink to enable direct method invocation
    this.remoteApi = Comlink.wrap(worker);
  }  

  async setActiveInstanceToBerkeley() {
    return this.remoteApi.setActiveInstanceToBerkeley();
  }

  async setActiveInstanceToDevnet() {
    return this.remoteApi.setActiveInstanceToDevnet();
  }

  async loadContracts() {
    return this.remoteApi.loadContracts();
  }

  async compileAgeVerificationProgram() {
    return this.remoteApi.compileAgeVerificationProgram();
  }

  async compileDIDRegistry() {
    return this.remoteApi.compileDIDRegistry();
  }

  async compileZKPVerifier() {
    return this.remoteApi.compileZKPVerifier();
  }

  async fetchAccount(publicKeyBase58: string) {
    return this.remoteApi.fetchAccount(publicKeyBase58);
  }

  async initDIDRegistryInstance(publicKeyBase58: string) {
    return this.remoteApi.initDIDRegistryInstance(publicKeyBase58);
  }

  async initZKPVerifierInstance(publicKeyBase58: string) {
    return this.remoteApi.initZKPVerifierInstance(publicKeyBase58);
  }

  async getDIDStatus(userPublicKeyBase58: string) {
    const result = await this.remoteApi.getDIDStatus(userPublicKeyBase58);
    return JSON.parse(result as string);
  }

  async createRegisterDIDTransaction(userPublicKeyBase58: string, witnessData: any) {
    return this.remoteApi.createRegisterDIDTransaction(userPublicKeyBase58, witnessData);
  }

  async proveTransaction() {
    return this.remoteApi.proveTransaction();
  }

  async getTransactionJSON() {
    return this.remoteApi.getTransactionJSON();
  }
}
