
# Apollo.ai

**Natural Language Database Intelligence Platform**

Apollo.ai is a revolutionary AI-powered platform that bridges the gap between business users and their data by transforming natural language questions into accurate database queries across any database system.

## Vision

Democratizing Data Access for Non-Technical Business Users

## Key Features

- 🗣️ **Natural Language Queries** - Ask questions in plain English, no SQL required
- 🔐 **Enterprise Security** - Built-in PII masking, encryption, and audit trails
- 🗄️ **Universal Database Support** - Works with PostgreSQL, MySQL, SQL Server, MongoDB, Snowflake, and more
- 📊 **Intelligent Visualizations** - Auto-generated charts and graphs
- 📄 **Actionable Reports** - Export to PDF, Excel, PowerPoint
- 🎯 **Next Steps & Recommendations** - Deep links and pre-populated actions
- 🔍 **Auto Schema Discovery** - Automatically understands database structures
- ✅ **Confidence Scoring** - Know how accurate each answer is

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (production), SQLite (development)
- **Authentication**: NextAuth.js
- **AI/NLP**: OpenAI GPT-4 (via Abacus.AI)
- **Testing**: Jest, MC/DC Coverage

## Project Structure

```
apollo-ai/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard page
│   └── page.tsx           # Landing page
├── components/            # React components
├── lib/                   # Utilities & database
├── prisma/               # Database schema
├── __tests__/            # Test suite
└── public/               # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn
- PostgreSQL (for production) or SQLite (for development)

### Installation

```bash
# Install dependencies
yarn install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Initialize database
yarn prisma generate
yarn prisma db push

# Seed database (optional)
yarn prisma db seed

# Run development server
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Testing

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run tests in watch mode
yarn test:watch
```

## Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/apolloai"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
ABACUSAI_API_KEY="your-api-key"
```

## Security Features

- **Database Encryption**: Sensitive data encrypted at rest
- **PII Masking**: Automatic detection and tokenization of personal information
- **Audit Trails**: Complete logging of all queries and data access
- **Role-Based Access Control**: Fine-grained permissions
- **SOC 2, GDPR, HIPAA Compliant**: Enterprise-grade security

## Documentation

- [Testing Documentation](nextjs_space/TESTING.md)
- [MC/DC Coverage Report](nextjs_space/MC_DC_COVERAGE_REPORT.md)
- [Business Case](docs/business-case.pdf)

## License

Proprietary - All Rights Reserved

## Contact

For questions or support, contact: [Your Email]

---

**Apollo.ai** - Intelligence Without Barriers
