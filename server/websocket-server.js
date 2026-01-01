import WebSocket from 'ws';
import http from 'http';

/**
 * MinaID WebSocket Server
 * 
 * Provides real-time communication for:
 * - Proof verification events
 * - DID registration confirmations
 * - Transaction status updates
 * 
 * Features:
 * - Auto-reconnection support
 * - Heartbeat to keep connections alive
 * - Broadcast events to all connected clients
 * - Connection state tracking
 */

const PORT = process.env.PORT || 8080;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      connections: clients.size,
      uptime: process.uptime(),
      timestamp: Date.now()
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

// Setup heartbeat interval
const heartbeatInterval = setInterval(() => {
  clients.forEach((client, id) => {
    if (!client.isAlive) {
      console.log(`Terminating inactive client: ${id}`);
      client.terminate();
      clients.delete(id);
      return;
    }
    
    client.isAlive = false;
    client.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws, req) => {
  const clientId = generateClientId();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Initialize client
  ws.isAlive = true;
  clients.set(clientId, ws);
  
  console.log(`[${new Date().toISOString()}] Client connected: ${clientId} from ${clientIp} (${clients.size} total)`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    event: 'CONNECTED',
    data: {
      clientId,
      timestamp: Date.now(),
      message: 'Connected to MinaID WebSocket server'
    },
    timestamp: Date.now(),
    messageId: generateMessageId()
  }));
  
  // Handle pong responses
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle ping
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ 
          type: 'pong',
          timestamp: Date.now()
        }));
        return;
      }
      
      console.log(`[${new Date().toISOString()}] Message from ${clientId}:`, data.event);
      
      // Broadcast to all other clients
      broadcast(data, clientId);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Message parse error from ${clientId}:`, error.message);
      
      ws.send(JSON.stringify({
        event: 'ERROR',
        data: {
          message: 'Invalid message format',
          error: error.message
        },
        timestamp: Date.now(),
        messageId: generateMessageId()
      }));
    }
  });
  
  // Handle client disconnect
  ws.on('close', (code, reason) => {
    clients.delete(clientId);
    console.log(`[${new Date().toISOString()}] Client disconnected: ${clientId} (code: ${code}, ${clients.size} remaining)`);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] Client error ${clientId}:`, error.message);
  });
});

// Broadcast message to all clients except sender
function broadcast(data, senderId) {
  const message = JSON.stringify(data);
  let successCount = 0;
  
  clients.forEach((client, id) => {
    if (client.readyState === WebSocket.OPEN && id !== senderId) {
      try {
        client.send(message);
        successCount++;
      } catch (error) {
        console.error(`Error broadcasting to ${id}:`, error.message);
      }
    }
  });
  
  console.log(`[${new Date().toISOString()}] Broadcasted ${data.event} to ${successCount} clients`);
}

// Generate unique client ID
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate unique message ID
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  clearInterval(heartbeatInterval);
  
  wss.clients.forEach((client) => {
    client.close(1000, 'Server shutting down');
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  clearInterval(heartbeatInterval);
  
  wss.clients.forEach((client) => {
    client.close(1000, 'Server shutting down');
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   MinaID WebSocket Server Running     ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`✓ Port: ${PORT}`);
  console.log(`✓ Heartbeat interval: ${HEARTBEAT_INTERVAL}ms`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ WebSocket URL: ws://localhost:${PORT}\n`);
  console.log('Waiting for connections...\n');
});

// Log unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
