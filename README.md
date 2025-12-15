# Transparent RFP Copilot

AI-powered RFP response assistant with full transparency. Every answer includes confidence scores, source citations, and visible reasoning.

## Features

### Core Capabilities

- **RFP Projects** - Upload Excel/CSV questionnaires, answer questions individually or in bulk, export completed responses
- **Chat** - Conversational interface to explore your knowledge base with selected skills and customer context
- **Contracts** - Upload and analyze contracts, extract key terms, identify risks, review obligations
- **Knowledge Base** - Skills, documents, URLs, and customer profiles that ground all AI responses

### Full Transparency

Every response includes:
- **Confidence Scores** - High/Medium/Low rating so you know when to trust or verify
- **Source Citations** - Which skills, documents, and URLs were used
- **Reasoning** - How the answer was derived, what was inferred vs. found directly
- **Editable Prompts** - View and customize system prompts (admin)

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **AI:** Claude API (Anthropic)
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js with Google OAuth
- **UI:** React 19, Tailwind CSS, shadcn/ui, Radix primitives
- **State:** React Query (server), Zustand (client)
- **Rate Limiting:** Upstash Redis

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Claude API key from Anthropic
- Google OAuth credentials (for authentication)

### Environment Variables

Create a `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/rfp_copilot"

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Rate Limiting (optional - falls back to in-memory)
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the app.

### First-Time Setup

1. Navigate to `/setup` to configure Google OAuth credentials
2. Sign in with Google
3. Add knowledge items (skills, documents, URLs) via the Knowledge Base
4. Start answering questions or chatting

## Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # Run ESLint
npm run test       # Run tests once
npm run test:watch # Run tests in watch mode
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── chat/              # Chat feature
│   ├── contracts/         # Contract analysis
│   ├── knowledge/         # Knowledge base management
│   ├── projects/          # RFP projects
│   └── admin/             # Admin settings
├── components/            # Reusable React components
├── lib/                   # Utilities and helpers
│   ├── promptBlocks.ts   # Composable prompt system
│   ├── auth.ts           # Authentication config
│   └── prisma.ts         # Database client
└── stores/               # Zustand state stores
```

## License

Private - All rights reserved
