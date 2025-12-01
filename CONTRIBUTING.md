# Contributing to MinaID

Thank you for your interest in contributing to MinaID! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/SuryaSundarVadali/MinaID/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, Node version, browser)

### Suggesting Enhancements

1. Check [existing issues](https://github.com/SuryaSundarVadali/MinaID/issues) for similar suggestions
2. Create a new issue with:
   - Clear title and detailed description
   - Use cases and benefits
   - Possible implementation approach
   - Examples from other projects (if applicable)

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/MinaID.git
   cd MinaID
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/amazing-feature
   # or
   git checkout -b fix/bug-fix
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed
   - Ensure all tests pass

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```
   
   Use conventional commit messages:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting)
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Create Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template
   - Link related issues

## Development Setup

### First Time Setup

```bash
# Clone repository
git clone https://github.com/SuryaSundarVadali/MinaID.git
cd MinaID

# Run setup script
./setup.sh
```

### Running Locally

```bash
# Start all services
./run-dev.sh

# Or start individually:

# Contracts
cd contracts
npm run build

# UI
cd ui
npm run dev

# WebSocket server
cd server
npm start
```

### Running Tests

```bash
# Contract tests
cd contracts
npm test

# UI tests
cd ui
npm test

# Watch mode
npm run test -- --watch
```

## Code Style Guidelines

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for functions
- Prefer `const` over `let`, avoid `var`
- Use async/await over promises

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use descriptive component names
- Add PropTypes or TypeScript types
- Extract reusable logic into custom hooks

### Smart Contracts

- Follow o1js best practices
- Add comprehensive comments
- Include test cases
- Optimize for gas efficiency
- Use meaningful method names

### Example

```typescript
/**
 * Generate a citizenship proof
 * 
 * @param citizenship - User's actual citizenship
 * @param expectedCitizenship - Expected citizenship to prove
 * @param salt - Random salt for privacy
 * @returns Zero-knowledge proof
 */
async function generateCitizenshipProof(
  citizenship: string,
  expectedCitizenship: string,
  salt: string
): Promise<Proof> {
  // Implementation
}
```

## Project Structure

```
MinaID/
├── contracts/          # Smart contracts
│   ├── src/           # Contract source
│   ├── scripts/       # Deployment scripts
│   └── cache/         # Compiled circuits
│
├── ui/                # Frontend
│   ├── app/          # Next.js pages
│   ├── components/   # React components
│   └── lib/          # Core services
│
└── server/           # WebSocket server
```

## Testing Requirements

All contributions must include tests:

### Contract Tests
- Unit tests for all contract methods
- Integration tests for workflows
- Edge case coverage

### UI Tests
- Component tests
- Integration tests for user flows
- Accessibility tests

### Example Test

```typescript
describe('TransactionQueueService', () => {
  it('should retry failed transactions with exponential backoff', async () => {
    const txId = transactionQueue.addTransaction(
      'registerDID',
      mockData,
      mockCallback,
      3 // max retries
    );
    
    // Simulate failure
    // Assert retry behavior
    expect(retryCount).toBe(3);
  });
});
```

## Documentation

Update documentation when making changes:

- **README.md** - Overview and quick start
- **DEPLOYMENT.md** - Deployment instructions
- **API_REFERENCE.md** - API documentation
- **PRODUCTION_FEATURES.md** - Feature details
- Inline code comments

## Review Process

1. **Automated Checks**
   - All tests must pass
   - Code must be properly formatted
   - No linting errors
   - TypeScript compilation successful

2. **Code Review**
   - At least one maintainer approval required
   - Address all review comments
   - Keep discussion constructive

3. **Merge**
   - Squash commits if needed
   - Update changelog
   - Merge to main branch

## Questions?

- Open a [Discussion](https://github.com/SuryaSundarVadali/MinaID/discussions)
- Join [Mina Discord](https://discord.gg/minaprotocol)
- Check existing documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing to MinaID! 🎉
