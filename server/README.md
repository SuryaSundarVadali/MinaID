# MinaID WebSocket Server

Real-time communication server for MinaID.

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start

# Development mode (auto-restart)
npm run dev
```

Server runs on `http://localhost:8080` by default.

## Environment Variables

```bash
PORT=8080                    # Server port (default: 8080)
NODE_ENV=production          # Environment
HEARTBEAT_INTERVAL=30000     # Heartbeat interval in ms
```

## Deployment

### Heroku
```bash
heroku create minaid-websocket
git push heroku main
```

### Railway
```bash
railway init
railway up
```

### Docker
```bash
docker build -t minaid-websocket .
docker run -p 8080:8080 minaid-websocket
```

## Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "connections": 5,
  "uptime": 3600,
  "timestamp": 1701234567890
}
```

## WebSocket Events

### Client → Server
- `VERIFICATION_REQUEST` - Request proof verification
- `ping` - Heartbeat ping

### Server → Client
- `PROOF_VERIFIED` - Proof verification completed
- `PROOF_FAILED` - Proof verification failed
- `DID_REGISTERED` - DID registration confirmed
- `TRANSACTION_CONFIRMED` - Transaction confirmed
- `CONNECTED` - Connection established
- `pong` - Heartbeat pong

## Testing

```bash
# Using wscat
npm install -g wscat
wscat -c ws://localhost:8080

# Send message
> {"event":"VERIFICATION_REQUEST","data":{"proofId":"123"}}
```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure proper port
- [ ] Enable SSL/TLS (wss://)
- [ ] Set up monitoring
- [ ] Configure auto-restart (PM2)
- [ ] Set up logging
- [ ] Enable CORS restrictions
- [ ] Set up rate limiting
