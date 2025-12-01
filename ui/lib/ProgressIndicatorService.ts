/**
 * ProgressIndicatorService
 * 
 * Centralized progress tracking for long-running operations:
 * - Proof generation (0-100%)
 * - Circuit compilation
 * - Transaction processing
 * - Account sync
 * 
 * Features:
 * - Real-time progress updates
 * - Step-by-step tracking
 * - Time estimates
 * - Progress callbacks
 */

export interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number; // 0-100
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface ProgressOperation {
  id: string;
  type: 'proof-generation' | 'circuit-compilation' | 'transaction' | 'sync' | 'verification';
  title: string;
  steps: ProgressStep[];
  overallProgress: number; // 0-100
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  estimatedDuration?: number;
}

type ProgressCallback = (operation: ProgressOperation) => void;

class ProgressIndicatorService {
  private operations: Map<string, ProgressOperation> = new Map();
  private callbacks: Map<string, Set<ProgressCallback>> = new Map();

  /**
   * Start a new operation
   */
  startOperation(
    type: ProgressOperation['type'],
    title: string,
    steps: string[],
    estimatedDuration?: number
  ): string {
    const operationId = this.generateOperationId();

    const operation: ProgressOperation = {
      id: operationId,
      type,
      title,
      steps: steps.map((name, index) => ({
        id: `step_${index}`,
        name,
        status: (index === 0 ? 'in-progress' : 'pending') as ProgressStep['status'],
        progress: 0
      })),
      overallProgress: 0,
      status: 'in-progress',
      startTime: Date.now(),
      estimatedDuration
    };

    this.operations.set(operationId, operation);
    this.notifyCallbacks(operationId, operation);

    console.log(`[Progress] Started operation: ${title} (${operationId})`);
    return operationId;
  }

  /**
   * Update step progress
   */
  updateStep(
    operationId: string,
    stepId: string,
    progress: number,
    status?: ProgressStep['status']
  ): void {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`[Progress] Operation not found: ${operationId}`);
      return;
    }

    const step = operation.steps.find(s => s.id === stepId);
    if (!step) {
      console.warn(`[Progress] Step not found: ${stepId}`);
      return;
    }

    step.progress = Math.max(0, Math.min(100, progress));
    
    if (status) {
      step.status = status;
      
      if (status === 'in-progress' && !step.startTime) {
        step.startTime = Date.now();
      } else if ((status === 'completed' || status === 'failed') && !step.endTime) {
        step.endTime = Date.now();
      }
    }

    // Auto-complete step if progress reaches 100%
    if (step.progress === 100 && step.status === 'in-progress') {
      step.status = 'completed';
      step.endTime = Date.now();
      
      // Move to next step
      const currentIndex = operation.steps.indexOf(step);
      if (currentIndex < operation.steps.length - 1) {
        const nextStep = operation.steps[currentIndex + 1];
        nextStep.status = 'in-progress';
        nextStep.startTime = Date.now();
      }
    }

    this.updateOverallProgress(operationId);
    this.notifyCallbacks(operationId, operation);
  }

  /**
   * Complete a step
   */
  completeStep(operationId: string, stepId: string): void {
    this.updateStep(operationId, stepId, 100, 'completed');
  }

  /**
   * Fail a step
   */
  failStep(operationId: string, stepId: string, error: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    const step = operation.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'failed';
    step.error = error;
    step.endTime = Date.now();

    operation.status = 'failed';
    operation.endTime = Date.now();

    this.notifyCallbacks(operationId, operation);
    console.error(`[Progress] Step failed: ${step.name} - ${error}`);
  }

  /**
   * Complete entire operation
   */
  completeOperation(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    // Complete all steps
    operation.steps.forEach(step => {
      if (step.status !== 'completed') {
        step.status = 'completed';
        step.progress = 100;
        step.endTime = Date.now();
      }
    });

    operation.status = 'completed';
    operation.overallProgress = 100;
    operation.endTime = Date.now();

    this.notifyCallbacks(operationId, operation);
    console.log(`[Progress] ✓ Completed: ${operation.title}`);
  }

  /**
   * Fail entire operation
   */
  failOperation(operationId: string, error: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    operation.status = 'failed';
    operation.endTime = Date.now();

    this.notifyCallbacks(operationId, operation);
    console.error(`[Progress] ✗ Failed: ${operation.title} - ${error}`);
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): ProgressOperation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Get all operations
   */
  getAllOperations(): ProgressOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get active operations
   */
  getActiveOperations(): ProgressOperation[] {
    return Array.from(this.operations.values()).filter(
      op => op.status === 'in-progress'
    );
  }

  /**
   * Subscribe to operation updates
   */
  subscribe(operationId: string, callback: ProgressCallback): () => void {
    if (!this.callbacks.has(operationId)) {
      this.callbacks.set(operationId, new Set());
    }
    
    this.callbacks.get(operationId)!.add(callback);

    // Immediately call with current state
    const operation = this.operations.get(operationId);
    if (operation) {
      callback(operation);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.callbacks.get(operationId);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Remove operation
   */
  removeOperation(operationId: string): void {
    this.operations.delete(operationId);
    this.callbacks.delete(operationId);
  }

  /**
   * Clear completed operations
   */
  clearCompleted(): void {
    const completed = Array.from(this.operations.entries())
      .filter(([_, op]) => op.status === 'completed' || op.status === 'failed')
      .map(([id, _]) => id);

    completed.forEach(id => {
      this.operations.delete(id);
      this.callbacks.delete(id);
    });

    console.log(`[Progress] Cleared ${completed.length} completed operations`);
  }

  /**
   * Get estimated time remaining
   */
  getEstimatedTimeRemaining(operationId: string): number | null {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status !== 'in-progress') return null;

    if (operation.estimatedDuration) {
      const elapsed = Date.now() - operation.startTime;
      const remaining = operation.estimatedDuration - elapsed;
      return Math.max(0, remaining);
    }

    // Estimate based on progress
    const elapsed = Date.now() - operation.startTime;
    if (operation.overallProgress > 0) {
      const estimatedTotal = (elapsed / operation.overallProgress) * 100;
      return Math.max(0, estimatedTotal - elapsed);
    }

    return null;
  }

  /**
   * Update overall progress based on step progress
   */
  private updateOverallProgress(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    const totalProgress = operation.steps.reduce((sum, step) => sum + step.progress, 0);
    operation.overallProgress = totalProgress / operation.steps.length;

    // Check if all steps are completed
    const allCompleted = operation.steps.every(step => step.status === 'completed');
    if (allCompleted && operation.status === 'in-progress') {
      operation.status = 'completed';
      operation.endTime = Date.now();
      console.log(`[Progress] ✓ Auto-completed: ${operation.title}`);
    }
  }

  /**
   * Notify callbacks of operation update
   */
  private notifyCallbacks(operationId: string, operation: ProgressOperation): void {
    const callbacks = this.callbacks.get(operationId);
    if (!callbacks) return;

    callbacks.forEach(callback => {
      try {
        callback({ ...operation }); // Send copy to prevent mutations
      } catch (error) {
        console.error('[Progress] Callback error:', error);
      }
    });
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Create proof generation operation
   */
  createProofGenerationOperation(proofType: string): string {
    return this.startOperation(
      'proof-generation',
      `Generating ${proofType} proof`,
      [
        'Loading circuit',
        'Compiling program',
        'Computing witness',
        'Generating proof',
        'Verifying proof'
      ],
      10000 // 10 seconds estimated
    );
  }

  /**
   * Helper: Create transaction operation
   */
  createTransactionOperation(txType: string): string {
    return this.startOperation(
      'transaction',
      `${txType} transaction`,
      [
        'Building transaction',
        'Proving transaction',
        'Signing transaction',
        'Submitting to network',
        'Waiting for confirmation'
      ],
      30000 // 30 seconds estimated
    );
  }

  /**
   * Helper: Create circuit compilation operation
   */
  createCircuitCompilationOperation(circuitName: string): string {
    return this.startOperation(
      'circuit-compilation',
      `Compiling ${circuitName}`,
      [
        'Loading dependencies',
        'Analyzing circuit',
        'Generating constraints',
        'Optimizing',
        'Caching artifacts'
      ],
      5000 // 5 seconds estimated with cache
    );
  }
}

// Export singleton instance
export const progressIndicator = new ProgressIndicatorService();
