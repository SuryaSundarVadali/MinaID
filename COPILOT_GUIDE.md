# GitHub Copilot Prompts Guide for MinaID

This document contains specific prompts you can use with GitHub Copilot to build each component of the MinaID application. Copy these prompts as comments in your code files to guide Copilot.

---

## 📋 Table of Contents

1. [React Contexts](#react-contexts)
2. [UI Components](#ui-components)
3. [Utility Functions](#utility-functions)
4. [Backend Services](#backend-services)
5. [Testing](#testing)

---

## React Contexts

### WalletContext.tsx

Create file: `ui/context/WalletContext.tsx`

```typescript
// React context for managing Mina wallet state and DID information
// State should include: userAddress (string | null), publicKey (PublicKey | null), 
// privateKey (PrivateKey | null), did (string | null), credentials (array),
// isConnected (boolean), network (string)

// Create a WalletProvider component that wraps children with the context

// Implement connectWallet function:
// - Use window.mina to detect Auro Wallet
// - Request accounts using window.mina.requestAccounts()
// - Store the connected address and public key in state
// - Set isConnected to true

// Implement generateDID function:
// - Use o1js PrivateKey.random() to generate new keypair
// - Convert public key to DID format: did:mina:<base58-publickey>
// - Store privateKey, publicKey, and did in state
// - Persist to localStorage for session management

// Implement storeDID function:
// - Serialize the private key, public key, and DID to JSON
// - Save to localStorage with key 'minaid_session'
// - Handle errors gracefully

// Implement loadDID function:
// - Read from localStorage key 'minaid_session'
// - Parse JSON and reconstruct PrivateKey and PublicKey objects
// - Restore state if valid session exists

// Implement addCredential function:
// - Accept a W3C Verifiable Credential object
// - Add to credentials array in state
// - Store updated credentials array in localStorage

// Implement clearSession function:
// - Clear all state variables
// - Remove localStorage items
// - Set isConnected to false

// Export WalletContext and useWallet hook for easy consumption
```

### DIDContext.tsx

Create file: `ui/context/DIDContext.tsx`

```typescript
// React context for DID operations and contract interactions

// Import DIDRegistry contract from contracts build folder

// State should include: didContract instance, loading state, error state

// Implement initContract function:
// - Load DIDRegistry contract from build
// - Set active Mina instance (devnet or mainnet based on WalletContext)
// - Create contract instance with deployed address
// - Store in state

// Implement registerDID function:
// - Accept didDocument object
// - Hash the DID document using Poseidon hash
// - Create MerkleMap and generate witness
// - Sign the hash with user's private key from WalletContext
// - Create Mina transaction calling DIDRegistry.registerDID
// - Prove the transaction
// - Sign with private key
// - Send transaction to network
// - Wait for confirmation
// - Return transaction hash or throw error

// Implement revokeDID function:
// - Get current user's public key from WalletContext
// - Generate MerkleMap witness
// - Sign with private key
// - Create transaction calling DIDRegistry.revokeDID
// - Prove, sign, and send transaction

// Implement updateDID function:
// - Similar to registerDID but calls updateDID method
// - Hash new DID document
// - Generate witness and signature
// - Execute update transaction

// Implement verifyDID function:
// - Query the DIDRegistry contract state
// - Generate MerkleMap witness for given public key
// - Call verifyDID method on contract
// - Listen for emitted event
// - Return verification status

// Implement getDIDDocument function:
// - Fetch DID document from off-chain storage (IPFS/local)
// - Given a DID or public key, retrieve the document
// - Parse and validate the document structure
// - Return DID document object

// Export DIDContext and useDID hook
```

---

## UI Components

### Signup.tsx

Create file: `ui/components/Signup.tsx`

```typescript
// React component for user registration with Aadhar KYC flow
// Use Tailwind CSS for styling
// Import useWallet from WalletContext
// Import useDID from DIDContext

// Component state:
// - aadharFile: File | null
// - isGeneratingProof: boolean
// - registrationStep: 'upload' | 'parsing' | 'proof' | 'issuing' | 'registering' | 'complete'
// - error: string | null

// Render UI with:
// - Card container with centered layout
// - Title: "Create Your MinaID"
// - Subtitle explaining privacy-preserving identity
// - "Generate MinaID" button that calls wallet.generateDID()
// - Display generated DID after creation
// - File input for Aadhar XML upload with drag-and-drop support
// - Progress indicator showing current registration step
// - Error display area
// - Success message with link to dashboard

// Implement handleGenerateDID function:
// - Call wallet.generateDID() from context
// - Show success message
// - Enable Aadhar upload section

// Implement handleAadharUpload function:
// - Accept file from input
// - Validate file is XML format
// - Store in aadharFile state
// - Automatically trigger processAadhar()

// Implement processAadhar function:
// - Set registrationStep to 'parsing'
// - Read file contents as text
// - Parse XML using DOMParser
// - Extract elements: name, dateOfBirth, gender, etc.
// - Set registrationStep to 'proof'
// - Call generateAadharProof()

// Implement generateAadharProof function using o1js:
// - Calculate age from dateOfBirth
// - Generate random salt using Field.random()
// - Create ageHash = Poseidon.hash([Field(age), salt])
// - Prepare publicInput: { subjectPublicKey, minimumAge: 18, ageHash, issuerPublicKey, timestamp }
// - Call AgeVerificationProgram.proveAgeAboveMinimum(publicInput, Field(age), salt)
// - Wait for proof generation (show loading spinner)
// - Set registrationStep to 'issuing'
// - Call issueCredential()

// Implement issueCredential function:
// - Make POST request to backend '/api/issue-credential'
// - Send: { publicKey: wallet.publicKey, ageProof: proof.toJSON(), aadharData }
// - Receive W3C Verifiable Credential from response
// - Store credential using wallet.addCredential(credential)
// - Set registrationStep to 'registering'
// - Call registerDIDOnChain()

// Implement registerDIDOnChain function:
// - Create DID document with user's public key and credentials
// - Call didContext.registerDID(didDocument)
// - Handle success: set registrationStep to 'complete'
// - Handle error: display error message

// Add styling:
// - Gradient background
// - Card shadow and rounded corners
// - Button hover effects
// - Loading spinners
// - Success/error animations
```

### Login.tsx

Create file: `ui/components/Login.tsx`

```typescript
// React component for MinaID authentication
// Use Tailwind CSS for styling
// Import useWallet and useRouter (Next.js)

// Component state:
// - isAuthenticating: boolean
// - error: string | null
// - step: 'idle' | 'challenge' | 'signing' | 'proving' | 'verifying' | 'success'

// Render UI with:
// - Card container with centered layout
// - Title: "Login with MinaID"
// - Subtitle: "Zero-knowledge proof authentication"
// - Single button: "Login with MinaID"
// - Status indicator showing current step
// - Error message area if authentication fails

// Implement handleLogin function:
// - Set isAuthenticating to true
// - Set step to 'challenge'
// - Call getChallenge()

// Implement getChallenge function:
// - Make GET request to '/api/get-challenge'
// - Receive { nonce } from response
// - Set step to 'signing'
// - Call signChallenge(nonce)

// Implement signChallenge function:
// - Get private key from wallet context
// - Create signature using Signature.create(privateKey, [Field(nonce)])
// - Set step to 'proving'
// - Call generateCredentialProof()

// Implement generateCredentialProof function:
// - Get user's credential from wallet.credentials[0]
// - Extract age and salt from credential claims
// - Recreate age hash
// - Call AgeVerificationProgram.proveAgeAboveMinimum()
// - Wait for proof generation (show loading indicator)
// - Set step to 'verifying'
// - Call submitLogin()

// Implement submitLogin function:
// - Make POST request to '/api/login'
// - Send: { publicKey, signature, nonce, credentialProof: proof.toJSON() }
// - Receive { token, expiresIn } from response
// - Store JWT token in localStorage with key 'auth_token'
// - Set step to 'success'
// - Redirect to dashboard using router.push('/dashboard')

// Handle errors at each step:
// - Display user-friendly error messages
// - Allow retry
// - Log errors to console for debugging

// Add styling:
// - Smooth transitions between steps
// - Animated loading states
// - Success checkmark animation
// - Error shake animation
```

### Dashboard.tsx

Create file: `ui/components/Dashboard.tsx`

```typescript
// React component for user dashboard
// Import useWallet, useDID, and necessary components

// Component state:
// - didStatus: { registered: boolean, hash: Field } | null
// - credentials: VerifiableCredential[]
// - isLoadingStatus: boolean

// Render UI with:
// - Header with user's DID displayed
// - Section showing DID status (registered/not registered)
// - Credentials list with cards for each credential
// - For each credential, show: type, issuer, issuedDate, expiryDate, status
// - Button to generate new ZK proof for each credential
// - Button to revoke DID (with confirmation modal)
// - Button to update DID document
// - Section to share proofs with third parties

// Implement useEffect to fetch DID status on mount:
// - Call didContext.verifyDID(wallet.publicKey)
// - Update didStatus state
// - Load credentials from wallet.credentials

// Implement handleGenerateProof function:
// - Accept credential as parameter
// - Prompt user for proof type (age, KYC, custom)
// - Generate appropriate ZK proof using AgeVerificationProgram or similar
// - Display proof JSON or QR code for sharing

// Implement handleRevokeDID function:
// - Show confirmation modal
// - If confirmed, call didContext.revokeDID()
// - Update UI to reflect revoked status
// - Clear local session

// Implement handleUpdateDID function:
// - Show form to edit DID document
// - On submit, call didContext.updateDID(newDocument)
// - Refresh DID status

// Implement checkCredentialExpiry function:
// - For each credential, check if expiresAt < current time
// - Mark expired credentials with warning badge
// - Suggest renewal if needed

// Add credential status badges:
// - Active: green badge
// - Expired: red badge
// - Revoked: gray badge

// Styling:
// - Grid layout for credentials
// - Card components with shadows
// - Status badges with colors
// - Modal for confirmations
// - Tooltips for actions
```

---

## Utility Functions

### AadharParser.ts

Create file: `ui/lib/AadharParser.ts`

```typescript
// Utility functions for parsing and verifying Aadhar XML files

// Import necessary cryptographic libraries (if needed for signature verification)

// Function parseAadharXML:
// - Accept File object as parameter
// - Read file contents using FileReader as text
// - Parse XML string using DOMParser
// - Extract elements: uid, name, gender, dateOfBirth, address
// - Return structured AadharData object with all fields
// - Throw error if XML is malformed

// Function verifyUIDAISignature:
// - Accept parsed AadharData object
// - Extract signature element from XML
// - TODO: Obtain UIDAI public key (hardcode for now or fetch from config)
// - Verify RSA or ECDSA signature using public key
// - Return true if valid, false otherwise
// - Note: This is a placeholder; actual implementation needs UIDAI specs

// Function extractAttributes:
// - Accept parsed AadharData
// - Return object with: name, dob, gender, address
// - Sanitize all strings (remove extra whitespace)

// Function calculateAge:
// - Accept date of birth string in format 'DD-MM-YYYY'
// - Parse to Date object
// - Calculate age = current year - birth year
// - Adjust if birthday hasn't occurred this year
// - Return age as number

// Function hashAadharData:
// - Accept AadharData and salt
// - Use Poseidon.hash to create commitment
// - Return Field hash for use in ZK proofs

// Export all functions
```

### ProofGenerator.ts

Create file: `ui/lib/ProofGenerator.ts`

```typescript
// Utility functions for generating zero-knowledge proofs

// Import o1js, AgeVerificationProgram, and other ZK contracts

// Function generateAgeProof:
// - Accept parameters: age (number), minAge (number), salt (Field), publicKey, issuerKey
// - Create AgeProofPublicInput structure
// - Call AgeVerificationProgram.proveAgeAboveMinimum(publicInput, Field(age), salt)
// - Return proof object
// - Handle errors (e.g., age below minimum)

// Function generateKYCProof:
// - Accept kycData object and salt
// - Hash KYC data using Poseidon
// - Create public input with kycHash, subject, issuer
// - Generate ZK proof demonstrating KYC completion
// - Return proof object

// Function generateCredentialProof:
// - Accept W3C Verifiable Credential
// - Extract claim type and value
// - Create appropriate ZK proof based on claim type
// - Return proof with commitment hash

// Function verifyProofLocally:
// - Accept proof object
// - Call proof.verify() to check validity
// - Return boolean indicating if proof is valid
// - This is client-side verification before sending to contract

// Function serializeProof:
// - Accept proof object
// - Convert to JSON using proof.toJSON()
// - Return JSON string for API transmission

// Function deserializeProof:
// - Accept JSON string
// - Reconstruct proof object from JSON
// - Return proof instance

// Export all functions
```

### ContractInterface.ts

Create file: `ui/lib/ContractInterface.ts`

```typescript
// Interface layer for interacting with deployed smart contracts

// Import contracts from build folder and o1js

// Define contract addresses (from environment variables or config)
const DID_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_DID_REGISTRY_ADDRESS;
const ZKP_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_ZKP_VERIFIER_ADDRESS;

// Function initContracts:
// - Set active Mina instance (devnet/mainnet)
// - Load DIDRegistry contract at DID_REGISTRY_ADDRESS
// - Load ZKPVerifier contract at ZKP_VERIFIER_ADDRESS
// - Compile contracts if not already compiled
// - Return contract instances

// Function registerDID:
// - Accept publicKey, didDocumentHash, witness, signature
// - Create Mina transaction
// - Call didRegistry.registerDID(publicKey, didDocumentHash, witness, signature)
// - Prove transaction
// - Sign with sender's private key
// - Send transaction
// - Return transaction hash

// Function revokeDID:
// - Similar structure to registerDID
// - Call didRegistry.revokeDID()

// Function updateDID:
// - Similar structure
// - Call didRegistry.updateDID()

// Function verifyAgeProof:
// - Accept subject, ageHash, proof, issuerKey, signature components
// - Create transaction calling zkpVerifier.verifyAgeProof()
// - Execute transaction
// - Return verification result

// Function verifyKYCProof:
// - Similar to verifyAgeProof
// - Call zkpVerifier.verifyKYCProof()

// Function getDIDStatus:
// - Accept publicKey
// - Query DIDRegistry contract state
// - Generate witness
// - Call verifyDID method
// - Return { registered: boolean, hash: Field }

// Function listenForEvents:
// - Set up event listeners for DIDRegistered, DIDRevoked, CredentialVerified
// - Use contract.events to subscribe
// - Emit events to UI for real-time updates

// Export all functions and contract instances
```

---

## Backend Services

### Issuer Service (issuer-service.js)

Create file: `services/issuer-service.js`

```javascript
// Set up Express.js server for credential issuance

// Import required packages: express, body-parser, cors, did-jwt-vc, o1js

// Configure Express app:
// - Enable CORS with appropriate origins
// - Use body-parser for JSON
// - Add helmet for security headers
// - Add rate limiting middleware (express-rate-limit)

// POST /api/issue-credential endpoint:
// - Accept request body: { publicKey, ageProof, aadharData }
// - Verify the ageProof is valid using o1js
// - TODO: Send proof to ZKPVerifier contract for on-chain verification
// - If proof is valid, create W3C Verifiable Credential
// - Credential structure:
//   {
//     "@context": ["https://www.w3.org/2018/credentials/v1"],
//     "type": ["VerifiableCredential", "AadharKYCCredential"],
//     "issuer": "did:mina:<issuer-public-key>",
//     "issuanceDate": new Date().toISOString(),
//     "expirationDate": new Date(Date.now() + 365*24*60*60*1000).toISOString(), // 1 year
//     "credentialSubject": {
//       "id": "did:mina:<user-public-key>",
//       "isAadharVerified": true,
//       "ageAbove18": true
//     }
//   }
// - Sign the credential using did-jwt-vc library with server's private key
// - Return signed credential in response

// Function verifyAgeProofOffChain:
// - Accept ageProof JSON
// - Deserialize proof using o1js
// - Call proof.verify() to check validity
// - Return boolean

// Function signCredential:
// - Accept credential object
// - Use did-jwt-vc's createVerifiableCredentialJwt()
// - Sign with issuer's private key
// - Return JWT string

// Error handling:
// - Catch all errors in try-catch blocks
// - Return appropriate HTTP status codes (400, 500)
// - Log errors to console or logging service

// Start server on port 3001
// - Listen on all interfaces
// - Log startup message

// Export app for testing
```

### Verifier Service (verifier-service.js)

Create file: `services/verifier-service.js`

```javascript
// Set up Express.js server for authentication and verification

// Import required packages: express, body-parser, cors, jsonwebtoken, crypto

// Configure Express app:
// - Enable CORS
// - Use body-parser
// - Add security middleware

// In-memory storage for challenges (use Redis in production)
const challenges = new Map(); // Map<nonce, { createdAt, used }>

// GET /api/get-challenge endpoint:
// - Generate secure random 32-byte nonce using crypto.randomBytes()
// - Convert to hex string
// - Store in challenges Map with current timestamp
// - Set expiry to 5 minutes
// - Return { nonce } in response

// POST /api/login endpoint:
// - Accept request body: { publicKey, signature, nonce, credentialProof }
// - Verify nonce exists and hasn't expired
// - Verify nonce hasn't been used (prevent replay attacks)
// - Verify signature of challenge using o1js Signature.verify()
// - TODO: Verify credentialProof on ZKPVerifier contract on-chain
// - If all valid, generate JWT session token
// - Token payload: { publicKey, did, iat, exp }
// - Sign token with JWT_SECRET from environment variable
// - Set expiry to 24 hours
// - Mark nonce as used
// - Return { token, expiresIn } in response

// POST /api/verify-credential endpoint:
// - Accept credential and proof
// - TODO: Call ZKPVerifier contract to verify proof on-chain
// - Return verification result

// Function verifySignature:
// - Accept publicKey, nonce, and signature
// - Use o1js Signature.verify(publicKey, [Field(nonce)], signature)
// - Return boolean

// Function generateJWT:
// - Accept payload object
// - Use jsonwebtoken.sign(payload, JWT_SECRET, { expiresIn: '24h' })
// - Return token string

// Function verifyJWT:
// - Accept token string
// - Use jsonwebtoken.verify(token, JWT_SECRET)
// - Return decoded payload or throw error

// Middleware authenticateToken:
// - Extract token from Authorization header
// - Verify JWT
// - Attach decoded payload to req.user
// - Call next()

// Protected route example: GET /api/profile
// - Use authenticateToken middleware
// - Return user profile data from req.user

// Cleanup expired challenges periodically:
// - setInterval to run every minute
// - Remove challenges older than 5 minutes

// Start server on port 3002

// Export app for testing
```

---

## Testing

### Contract Tests

Create file: `contracts/src/DIDRegistry.test.ts`

```typescript
// Unit tests for DIDRegistry contract using Jest

// Import DIDRegistry, Mina, PrivateKey, PublicKey, MerkleMap, etc.

// Describe block: 'DIDRegistry Contract Tests'

// beforeAll:
// - Setup local blockchain using Mina.LocalBlockchain()
// - Deploy DIDRegistry contract
// - Create test accounts (deployer, user1, user2)

// Test: 'should initialize with empty root'
// - Verify didMapRoot equals empty MerkleMap root
// - Verify totalDIDs equals 0

// Test: 'should register a new DID'
// - Create DID document hash
// - Generate MerkleMap and witness
// - Sign with user1 private key
// - Call registerDID()
// - Verify totalDIDs increased to 1
// - Verify DIDRegistered event was emitted

// Test: 'should fail to register duplicate DID'
// - Try to register same DID twice
// - Expect transaction to fail with error message

// Test: 'should revoke an existing DID'
// - Register a DID
// - Generate revocation witness
// - Call revokeDID()
// - Verify totalDIDs decreased
// - Verify DIDRevoked event emitted

// Test: 'should update DID document'
// - Register a DID
// - Create new DID document hash
// - Call updateDID()
// - Verify new hash is stored
// - Verify DIDUpdated event emitted

// Test: 'should verify DID status'
// - Register a DID
// - Call verifyDID()
// - Check event for verification result

// Test: 'should only allow owner to transfer ownership'
// - Try transfer ownership as non-owner (should fail)
// - Transfer ownership as owner (should succeed)
// - Verify new owner is set

// afterAll:
// - Cleanup blockchain instance
```

### Component Tests

Create file: `ui/__tests__/Signup.test.tsx`

```typescript
// Component tests for Signup using React Testing Library

// Import Signup component, render, screen, fireEvent, waitFor

// Mock WalletContext and DIDContext

// Describe block: 'Signup Component Tests'

// Test: 'should render signup form'
// - Render <Signup />
// - Expect to see "Create Your MinaID" heading
// - Expect to see "Generate MinaID" button
// - Expect to see file input for Aadhar XML

// Test: 'should generate DID when button clicked'
// - Render component
// - Mock generateDID function
// - Click "Generate MinaID" button
// - Wait for DID to appear in UI
// - Verify generateDID was called

// Test: 'should handle Aadhar file upload'
// - Render component
// - Create mock File object (Aadhar XML)
// - Upload file using fireEvent.change()
// - Wait for parsing to complete
// - Verify file name is displayed

// Test: 'should show error for invalid XML'
// - Upload invalid file (not XML)
// - Expect error message to appear
// - Verify registration does not proceed

// Test: 'should complete full registration flow'
// - Generate DID
// - Upload valid Aadhar XML
// - Mock all async functions (parseAadhar, generateProof, issueCredential, registerDID)
// - Wait for completion
// - Expect success message
// - Expect redirect to dashboard

// Test: 'should display loading states'
// - Render component
// - Start registration flow
// - Check for loading spinner during proof generation
// - Verify step indicators update correctly
```

---

## Tips for Using These Prompts

1. **Copy prompts as comments**: Paste the entire prompt block as a comment at the top of a new file
2. **Let Copilot generate**: Press Enter and let Copilot suggest implementations
3. **Review and edit**: Copilot won't be perfect - review generated code carefully
4. **Iterate**: If output isn't what you want, add more specific comments
5. **One section at a time**: Don't overwhelm Copilot with too much at once
6. **Use examples**: If Copilot struggles, provide a small example of what you want
7. **Test frequently**: Run and test code as you build to catch issues early

---

## Environment Variables to Set

Create `.env.local` in `ui/` directory:

```
NEXT_PUBLIC_MINA_NETWORK=devnet
NEXT_PUBLIC_DID_REGISTRY_ADDRESS=B62q...
NEXT_PUBLIC_ZKP_VERIFIER_ADDRESS=B62q...
NEXT_PUBLIC_ISSUER_API_URL=http://localhost:3001
NEXT_PUBLIC_VERIFIER_API_URL=http://localhost:3002
```

Create `.env` in `services/` directory:

```
JWT_SECRET=your-secure-random-secret
ISSUER_PRIVATE_KEY=EKE...
PORT_ISSUER=3001
PORT_VERIFIER=3002
MINA_NETWORK=https://api.minascan.io/node/devnet/v1/graphql
```

---

**Ready to build!** Start with `WalletContext.tsx` and work through the components systematically.
