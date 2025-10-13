# 0xGuard Quick Start

## Project Status

✅ Project foundation complete and ready for development

## What's Built

- **TypeScript** setup with strict mode and ESM
- **Prisma** ORM with SQLite database initialized
- **Core utilities**: Logger, DB client, Environment validation, RPC client manager
- **Type system**: Strongly typed domain models
- **Risk calculator**: Basic health factor assessment logic
- **Express server**: Minimal HTTP server with health endpoint

## Next Steps

### 1. Configure Environment

Edit `.env` with your RPC credentials:

```bash
ALCHEMY_API_KEY="your_key_here"
```

### 2. Verify RPC Providers

```bash
pnpm script:verify-rpc
```

### 3. Start Development Server

```bash
pnpm dev
```

Server will run on `http://localhost:3000`

Test health endpoint:
```bash
curl http://localhost:3000/health
```

## Development Workflow

### Run Tests
```bash
pnpm test
```

### Lint Code
```bash
pnpm lint
```

### Format Code
```bash
pnpm format
```

### Database Commands
```bash
pnpm prisma:studio    # Visual database editor
pnpm prisma:migrate   # Create new migration
```

## What to Build Next

**Priority 1: Protocol Adapters**
- [ ] Aave V3 adapter (`src/services/data/aave-adapter.ts`)
- [ ] Compound V3 adapter (`src/services/data/compound-adapter.ts`)

**Priority 2: Position Monitor**
- [ ] Fetch user positions across chains
- [ ] Cache position data

**Priority 3: Execution Layer**
- [ ] Avail Nexus integration stub
- [ ] Transaction manager

**Priority 4: API Routes**
- [ ] GET /positions
- [ ] POST /policy
- [ ] GET /actions

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed design.
