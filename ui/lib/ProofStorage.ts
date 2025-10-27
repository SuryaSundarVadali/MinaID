/**
 * ProofStorage.ts
 * 
 * Local storage management for zero-knowledge proofs
 * Handles CRUD operations for generated proofs
 */

export type ProofStatus = 'pending' | 'verified' | 'failed' | 'expired';

export interface StoredProof {
  id: string;
  type: 'age' | 'kyc' | 'composite';
  status: ProofStatus;
  timestamp: number;
  expiresAt?: number;
  
  // Proof metadata
  metadata: {
    proofType: string;
    minimumAge?: number;
    kycAttributes?: string[];
    verifierAddress?: string;
  };
  
  // Proof data (serialized)
  proofData: string;
  
  // User context
  did: string;
}

const STORAGE_KEY = 'minaid_proofs';
const MAX_PROOFS = 100; // Prevent storage overflow

/**
 * ProofStorage class for managing proof persistence
 */
export class ProofStorage {
  /**
   * Save a new proof to local storage
   */
  static saveProof(proof: Omit<StoredProof, 'id' | 'timestamp'>): string {
    try {
      const proofs = this.getProofs();
      
      // Generate unique ID
      const id = `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newProof: StoredProof = {
        ...proof,
        id,
        timestamp: Date.now(),
      };
      
      // Add to beginning of array (newest first)
      proofs.unshift(newProof);
      
      // Limit storage size
      if (proofs.length > MAX_PROOFS) {
        proofs.splice(MAX_PROOFS);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs));
      
      console.log('[ProofStorage] Saved proof:', id);
      return id;
    } catch (error) {
      console.error('[ProofStorage] Save failed:', error);
      throw new Error('Failed to save proof to storage');
    }
  }

  /**
   * Get all stored proofs
   */
  static getProofs(): StoredProof[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const proofs = JSON.parse(data) as StoredProof[];
      
      // Filter out expired proofs
      const validProofs = proofs.filter(proof => {
        if (proof.expiresAt && proof.expiresAt < Date.now()) {
          return false;
        }
        return true;
      });
      
      // Save back if we filtered any
      if (validProofs.length !== proofs.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(validProofs));
      }
      
      return validProofs;
    } catch (error) {
      console.error('[ProofStorage] Failed to get proofs:', error);
      return [];
    }
  }

  /**
   * Get proofs filtered by DID
   */
  static getProofsByDID(did: string): StoredProof[] {
    return this.getProofs().filter(proof => proof.did === did);
  }

  /**
   * Get a specific proof by ID
   */
  static getProofById(id: string): StoredProof | null {
    const proofs = this.getProofs();
    return proofs.find(proof => proof.id === id) || null;
  }

  /**
   * Update proof status
   */
  static updateProofStatus(id: string, status: ProofStatus): boolean {
    try {
      const proofs = this.getProofs();
      const proofIndex = proofs.findIndex(proof => proof.id === id);
      
      if (proofIndex === -1) {
        console.warn('[ProofStorage] Proof not found:', id);
        return false;
      }
      
      proofs[proofIndex].status = status;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs));
      
      console.log('[ProofStorage] Updated proof status:', id, status);
      return true;
    } catch (error) {
      console.error('[ProofStorage] Failed to update status:', error);
      return false;
    }
  }

  /**
   * Update proof metadata
   */
  static updateProofMetadata(
    id: string, 
    updates: Partial<StoredProof['metadata']>
  ): boolean {
    try {
      const proofs = this.getProofs();
      const proofIndex = proofs.findIndex(proof => proof.id === id);
      
      if (proofIndex === -1) {
        return false;
      }
      
      proofs[proofIndex].metadata = {
        ...proofs[proofIndex].metadata,
        ...updates,
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs));
      return true;
    } catch (error) {
      console.error('[ProofStorage] Failed to update metadata:', error);
      return false;
    }
  }

  /**
   * Delete a proof
   */
  static deleteProof(id: string): boolean {
    try {
      const proofs = this.getProofs();
      const filteredProofs = proofs.filter(proof => proof.id !== id);
      
      if (filteredProofs.length === proofs.length) {
        console.warn('[ProofStorage] Proof not found:', id);
        return false;
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredProofs));
      
      console.log('[ProofStorage] Deleted proof:', id);
      return true;
    } catch (error) {
      console.error('[ProofStorage] Failed to delete:', error);
      return false;
    }
  }

  /**
   * Clear all proofs
   */
  static clearAll(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[ProofStorage] Cleared all proofs');
      return true;
    } catch (error) {
      console.error('[ProofStorage] Failed to clear:', error);
      return false;
    }
  }

  /**
   * Get proof statistics
   */
  static getStats(did?: string): {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<ProofStatus, number>;
  } {
    const proofs = did ? this.getProofsByDID(did) : this.getProofs();
    
    const byType: Record<string, number> = {};
    const byStatus: Record<ProofStatus, number> = {
      pending: 0,
      verified: 0,
      failed: 0,
      expired: 0,
    };
    
    proofs.forEach(proof => {
      // Count by type
      byType[proof.type] = (byType[proof.type] || 0) + 1;
      
      // Count by status
      byStatus[proof.status] = (byStatus[proof.status] || 0) + 1;
    });
    
    return {
      total: proofs.length,
      byType,
      byStatus,
    };
  }

  /**
   * Export proofs as JSON
   */
  static exportProofs(did?: string): string {
    const proofs = did ? this.getProofsByDID(did) : this.getProofs();
    return JSON.stringify(proofs, null, 2);
  }

  /**
   * Import proofs from JSON
   */
  static importProofs(jsonData: string, mergeDuplicates = false): number {
    try {
      const importedProofs = JSON.parse(jsonData) as StoredProof[];
      
      if (!Array.isArray(importedProofs)) {
        throw new Error('Invalid proof data format');
      }
      
      const existingProofs = this.getProofs();
      let addedCount = 0;
      
      importedProofs.forEach(proof => {
        // Check for duplicates
        const exists = existingProofs.some(p => p.id === proof.id);
        
        if (!exists || mergeDuplicates) {
          if (exists && mergeDuplicates) {
            // Remove existing
            const index = existingProofs.findIndex(p => p.id === proof.id);
            existingProofs.splice(index, 1);
          }
          existingProofs.push(proof);
          addedCount++;
        }
      });
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingProofs));
      
      console.log('[ProofStorage] Imported proofs:', addedCount);
      return addedCount;
    } catch (error) {
      console.error('[ProofStorage] Import failed:', error);
      throw new Error('Failed to import proofs');
    }
  }
}

/**
 * Hook for React components to use proof storage
 */
export function useProofStorage(did?: string) {
  const [proofs, setProofs] = React.useState<StoredProof[]>([]);

  const refresh = React.useCallback(() => {
    const allProofs = did ? ProofStorage.getProofsByDID(did) : ProofStorage.getProofs();
    setProofs(allProofs);
  }, [did]);

  React.useEffect(() => {
    refresh();

    // Listen for storage changes (from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        refresh();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refresh]);

  return {
    proofs,
    refresh,
    saveProof: ProofStorage.saveProof,
    deleteProof: (id: string) => {
      const success = ProofStorage.deleteProof(id);
      if (success) refresh();
      return success;
    },
    updateStatus: (id: string, status: ProofStatus) => {
      const success = ProofStorage.updateProofStatus(id, status);
      if (success) refresh();
      return success;
    },
    stats: ProofStorage.getStats(did),
  };
}

// React import for the hook
import React from 'react';
