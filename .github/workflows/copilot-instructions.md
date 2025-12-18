# Copilot Code Review Instructions — MinaID

## Purpose
Provide focused review guidance for this full-stack ZK identity project, including:
- Mina smart contracts (zk/Snarky) and proof circuits
- React/Next.js UI and client logic
- Transaction queue, WebSocket server, and CLI tooling

## Scope of Review
For all pull requests, review:
- Correctness of cryptographic logic and proof generation
- Contract correctness, invariants, and on-chain security
- UI/UX flows for identity operations (signup, proof creation, verification)
- Network and transaction handling (retry/backoff)
- Input validation & sanitization
- Integration between ProofGenerator, contract interface, and wallet

## What to Flag
❗ **Security & correctness**
- Unsafe cryptography
- Unchecked proof/public output verification
- Missing signature/auth validation
- ZK proof invariants and circuit assumptions

⚠️ **Maintainability & quality**
- Unclear control flow
- Missing or outdated API docs
- Untyped interfaces in TypeScript
- Redundant or unreachable code

ℹ️ **Optional improvements**
- Suggest test cases for uncovered logic
- UI feedback edge cases (loading/error states)

## Review Comments Format
- Reference file and exact code lines
- Use clear classification (Must fix / Should fix / Optional)
- Provide actionable suggestions where possible
