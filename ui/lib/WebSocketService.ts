/**
 * WebSocketService
 * 
 * Real-time communication service for MinaID with:
 * - Auto-reconnection with exponential backoff
 * - Message queuing when offline
 * - Event subscription system
 * - Connection state management
 */

export type WebSocketEvent =
  | 'PROOF_VERIFIED'
  | 'PROOF_FAILED'
  | 'VERIFICATION_REQUEST'
  | 'USER_VERIFIED'
  | 'DID_REGISTERED'
  | 'DID_UPDATED'
  | 'DID_REVOKED'
  | 'TRANSACTION_CONFIRMED'
  | 'TRANSACTION_FAILED';

export interface WebSocketMessage {
  event: WebSocketEvent;
  data: any;
  timestamp: number;
  messageId: string;
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private handlers: Map<WebSocketEvent, Set<MessageHandler>> = new Map();
  private connectionState: ConnectionState = 'disconnected';
  private stateChangeCallbacks: Set<(state: ConnectionState) => void> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor(url?: string) {
    // Use environment variable or default to localhost
    this.url = url || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/minaid';
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Already connected or connecting');
      return;
    }

    this.updateConnectionState('connecting');
    console.log(`[WebSocket] Connecting to ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.handleConnectionError();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[WebSocket] Disconnecting...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.updateConnectionState('disconnected');
  }

  /**
   * Send a message
   */
  send(event: WebSocketEvent, data: any): void {
    const message: WebSocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        console.log(`[WebSocket] Sent ${event}:`, data);
      } catch (error) {
        console.error('[WebSocket] Send error:', error);
        this.queueMessage(message);
      }
    } else {
      console.log(`[WebSocket] Not connected, queuing ${event}`);
      this.queueMessage(message);
    }
  }

  /**
   * Subscribe to an event
   */
  on(event: WebSocketEvent, handler: MessageHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    
    this.handlers.get(event)!.add(handler);
    console.log(`[WebSocket] Subscribed to ${event}`);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: WebSocketEvent, handler: MessageHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      console.log(`[WebSocket] Unsubscribed from ${event}`);
    }
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => this.stateChangeCallbacks.delete(callback);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get queued message count
   */
  getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[WebSocket] ✓ Connected');
      this.reconnectAttempts = 0;
      this.updateConnectionState('connected');
      this.startHeartbeat();
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[WebSocket] Message parse error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.updateConnectionState('error');
    };

    this.ws.onclose = (event) => {
      console.log(`[WebSocket] Closed (code: ${event.code}, reason: ${event.reason})`);
      this.updateConnectionState('disconnected');
      
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Attempt reconnection if not a clean close
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    console.log(`[WebSocket] Received ${message.event}:`, message.data);

    const handlers = this.handlers.get(message.event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`[WebSocket] Handler error for ${message.event}:`, error);
        }
      });
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.updateConnectionState('error');
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(): void {
    this.updateConnectionState('error');
    this.scheduleReconnect();
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('[WebSocket] Heartbeat error:', error);
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Queue message for later delivery
   */
  private queueMessage(message: WebSocketMessage): void {
    this.messageQueue.push(message);
    console.log(`[WebSocket] Queued message (${this.messageQueue.length} in queue)`);

    // Limit queue size to prevent memory issues
    if (this.messageQueue.length > 100) {
      const removed = this.messageQueue.shift();
      console.warn('[WebSocket] Queue full, removed oldest message:', removed?.event);
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`[WebSocket] Flushing ${this.messageQueue.length} queued messages...`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(message => {
      try {
        this.ws?.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WebSocket] Error flushing message:', error);
        this.queueMessage(message);
      }
    });
  }

  /**
   * Update connection state and notify callbacks
   */
  private updateConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;

    this.connectionState = state;
    console.log(`[WebSocket] State changed: ${state}`);

    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('[WebSocket] State change callback error:', error);
      }
    });
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

// Auto-connect on initialization (can be disabled if needed)
if (typeof window !== 'undefined') {
  // Only auto-connect in browser environment
  websocketService.connect();
}
