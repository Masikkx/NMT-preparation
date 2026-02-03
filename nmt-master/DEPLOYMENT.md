# NMT Platform - Deployment & Architecture Guide

## System Architecture

### Overview
```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  - React 19 Components                                       │
│  - Tailwind CSS Styling                                      │
│  - Zustand State Management                                  │
│  - Recharts Visualizations                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓ (HTTP/HTTPS)
┌─────────────────────────────────────────────────────────────┐
│              API Layer (Next.js Route Handlers)              │
│  - Authentication Endpoints                                  │
│  - Test Management APIs                                      │
│  - User Data APIs                                            │
│  - Leaderboard APIs                                          │
│  - Subject/Topic APIs                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓ (Prisma ORM)
┌─────────────────────────────────────────────────────────────┐
│                  Database (PostgreSQL)                       │
│  - Users & Authentication                                    │
│  - Tests & Questions                                         │
│  - Test Attempts & Results                                   │
│  - User Statistics                                           │
│  - Achievements                                              │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack Details

### Frontend Layer
- **Next.js 16**: Full-stack React framework with App Router
- **TypeScript**: Type-safe development
- **React 19**: Latest React features
- **Tailwind CSS v4**: Utility-first CSS framework
- **Zustand**: Lightweight state management
- **Recharts**: React charting library
- **js-cookie**: Cookie management

### Backend Layer
- **Next.js API Routes**: Serverless backend functions
- **Node.js 20+**: JavaScript runtime
- **Prisma ORM**: Database access layer
- **bcryptjs**: Password hashing
- **jsonwebtoken**: JWT authentication

### Database Layer
- **PostgreSQL 12+**: Relational database
- **Prisma Migrations**: Schema versioning
- **Indexes**: Query optimization

## Project Structure & File Organization

```
nmt-master/
├── app/                                    # Next.js app directory
│   ├── api/                               # API routes (/api/*)
│   │   ├── auth/                          # Authentication
│   │   │   ├── register/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── tests/                         # Test endpoints
│   │   │   ├── route.ts                   # GET/POST tests
│   │   │   ├── [id]/route.ts              # GET/PUT/DELETE test
│   │   │   ├── [id]/attempt/route.ts      # Test attempts
│   │   │   ├── [id]/submit/route.ts       # Submit test
│   │   │   └── [id]/check/route.ts        # Check answers
│   │   ├── subjects/route.ts              # Subject list
│   │   ├── leaderboard/route.ts           # Leaderboard
│   │   ├── users/stats/route.ts           # User statistics
│   │   └── attempts/[attemptId]/          # Answer saving
│   │       └── answers/[questionId]/route.ts
│   │
│   ├── (public pages)/
│   │   ├── page.tsx                       # Home page
│   │   ├── login/page.tsx                 # Login
│   │   └── register/page.tsx              # Registration
│   │
│   ├── (protected pages)/
│   │   ├── tests/page.tsx                 # Test listing
│   │   ├── test/[id]/page.tsx             # Test taking
│   │   ├── results/[id]/page.tsx          # Results display
│   │   ├── dashboard/page.tsx             # User dashboard
│   │   └── leaderboard/page.tsx           # Leaderboard
│   │
│   ├── admin/                             # Admin panel
│   │   ├── page.tsx                       # Admin home
│   │   ├── tests/page.tsx                 # Test management
│   │   ├── tests/[id]/page.tsx            # Edit test
│   │   ├── users/page.tsx                 # User management
│   │   ├── analytics/page.tsx             # Analytics
│   │   ├── reports/page.tsx               # Reports
│   │   └── subjects/page.tsx              # Subject management
│   │
│   ├── layout.tsx                         # Root layout
│   └── globals.css                        # Global styles
│
├── components/                             # React components
│   ├── Navbar.tsx                         # Navigation bar
│   ├── RootLayoutClient.tsx               # Client wrapper
│   ├── QuestionRenderer.tsx               # Question display
│   ├── ResultsModal.tsx                   # Results popup
│   └── ProgressBar.tsx                    # Progress indicator
│
├── lib/                                    # Utility functions
│   ├── auth.ts                            # Auth utilities
│   │   ├── hashPassword()
│   │   ├── verifyPassword()
│   │   ├── generateToken()
│   │   ├── verifyToken()
│   │   ├── getCurrentUser()
│   │   ├── setAuthCookie()
│   │   └── clearAuthCookie()
│   │
│   ├── scoring.ts                         # Scoring logic
│   │   ├── convertToNMTScale()
│   │   ├── calculatePercentage()
│   │   ├── checkAnswer()
│   │   ├── calculatePoints()
│   │   └── generateAchievements()
│   │
│   ├── api-middleware.ts                  # API utilities
│   │   ├── requireAuth()
│   │   ├── requireAdmin()
│   │   ├── validateBody()
│   │   └── validators
│   │
│   └── types.ts                           # TypeScript types
│
├── store/                                  # Zustand stores
│   ├── auth.ts                            # Auth state
│   │   ├── user
│   │   ├── isLoading
│   │   ├── login()
│   │   ├── logout()
│   │   ├── register()
│   │   └── initAuth()
│   │
│   └── theme.ts                           # Theme state
│       ├── isDark
│       └── toggleTheme()
│
├── prisma/                                 # Database
│   ├── schema.prisma                      # Data model
│   ├── migrations/                        # Migration files
│   └── seed.ts                            # Seed script
│
├── public/                                 # Static files
├── .env.example                           # Environment template
├── .env.local                             # Local environment (git-ignored)
├── next.config.ts                         # Next.js configuration
├── tsconfig.json                          # TypeScript config
├── tailwind.config.js                     # Tailwind config
├── postcss.config.mjs                     # PostCSS config
├── eslint.config.mjs                      # ESLint config
├── package.json                           # Dependencies
├── README.md                              # Documentation
└── QUICKSTART.md                          # Quick start guide
```

## Authentication Flow

```
User Registration:
  1. User enters email/password
  2. POST /api/auth/register
  3. Password hashed with bcrypt
  4. User created in database
  5. JWT token generated
  6. Token stored in HTTP-only cookie
  7. User redirected to dashboard

User Login:
  1. User enters email/password
  2. POST /api/auth/login
  3. Email found in database
  4. Password verified against hash
  5. JWT token generated
  6. Token stored in HTTP-only cookie
  7. User state updated in Zustand

Protected Routes:
  1. Page/API checks for token in cookie
  2. Token verified with JWT_SECRET
  3. User ID extracted from token
  4. Request processed or rejected
```

## Database Schema Relationships

```
User (1) ──→ (M) TestAttempt
User (1) ──→ (M) Result
User (1) ──→ (M) Achievement
User (1) ──→ (1) UserStats

Subject (1) ──→ (M) Test
Subject (1) ──→ (M) Topic
Topic (1) ──→ (M) Test

Test (1) ──→ (M) Question
Question (1) ──→ (M) Answer

TestAttempt (1) ──→ (M) UserAnswer
TestAttempt (1) ──→ (1) Result

UserAnswer → Question
UserAnswer → Answer[]
```

## Deployment Steps

### 1. Prepare for Production

```bash
# Set environment variables
export NODE_ENV=production
export DATABASE_URL="postgresql://prod_user:prod_password@prod_host:5432/nmt_prod"
export JWT_SECRET="your-very-secret-key-with-high-entropy"
export NEXT_PUBLIC_API_URL="https://yourdomain.com"
```

### 2. Build Application

```bash
# Clean previous build
rm -rf .next

# Generate Prisma client
npm run prisma:generate

# Build application
npm run build
```

### 3. Run Database Migrations

```bash
# On production server
npm run prisma:migrate -- --skip-generate

# Or manually
npx prisma migrate deploy
```

### 4. Start Server

```bash
# Using Node directly
NODE_ENV=production node .next/standalone/server.js

# Or with PM2
pm2 start npm --name "nmt-platform" -- start
```

### 5. Configure Reverse Proxy (Nginx Example)

```nginx
upstream nmt_app {
    server localhost:3000;
}

server {
    listen 80;
    server_name nmt.example.com;
    
    location / {
        proxy_pass http://nmt_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Security headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6. Enable HTTPS (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --nginx -d nmt.example.com

# Auto-renew
sudo systemctl enable certbot.timer
```

## Performance Optimization

### Frontend
- Code splitting per route (automatic with Next.js)
- Image optimization with Next Image
- CSS minification with Tailwind
- Dynamic imports for heavy components

### Backend
- Database query optimization with Prisma
- Connection pooling
- Caching strategies
- Pagination for large datasets

### Database
- Indexes on frequently queried fields
- Proper data types
- Foreign key constraints
- Archive old test attempts

## Monitoring & Logging

### Application Monitoring
```bash
# With PM2
pm2 monit

# Custom logging
logger.info(`Test attempt started by user ${userId}`)
```

### Database Monitoring
```bash
# Check database size
SELECT pg_size_pretty(pg_database_size('nmt_prep'));

# Check slow queries
SELECT query, calls, total_time FROM pg_stat_statements;
```

## Security Checklist

- ✅ HTTPS enabled
- ✅ JWT secrets strong and unique
- ✅ Password hashed with bcrypt
- ✅ SQL injection prevented (Prisma ORM)
- ✅ CSRF tokens implemented
- ✅ XSS protection (React escaping)
- ✅ Rate limiting on auth endpoints
- ✅ HTTP-only cookies
- ✅ Role-based access control
- ✅ Input validation on all endpoints
- ✅ Secure headers configured
- ✅ Secrets in environment variables

## Backup & Recovery

### Database Backup
```bash
# Full backup
pg_dump nmt_prep > backup_$(date +%Y%m%d_%H%M%S).sql

# Scheduled backup (cron)
0 2 * * * pg_dump nmt_prep | gzip > /backups/nmt_$(date +\%Y\%m\%d).sql.gz
```

### Recovery
```bash
# Restore database
psql nmt_prep < backup.sql

# Or if encrypted
gunzip -c backup.sql.gz | psql nmt_prep
```

## Scaling Strategies

### Horizontal Scaling
- Use load balancer (Nginx, HAProxy)
- Multiple application servers
- Shared PostgreSQL database
- Redis for session caching

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Enable query result caching

### Database Scaling
- Read replicas for SELECT queries
- Connection pooling (PgBouncer)
- Partitioning large tables
- Archive old data

## Error Handling

### API Error Responses
```json
{
  "error": "Error message",
  "status": 400,
  "details": {}
}
```

### Logging
- Use structured logging
- Log errors to external service
- Monitor error rates
- Set up alerts

## Version Control

```bash
# Production deployment branch
git checkout main
git pull origin main
npm install
npm run build
npm run prisma:migrate -- --skip-generate
npm start
```

## Continuous Integration/Deployment

### GitHub Actions Example
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run prisma:migrate -- --skip-generate
      # Deploy to server...
```

## Support & Maintenance

- Monitor application logs
- Review performance metrics
- Update dependencies regularly
- Backup database daily
- Test disaster recovery
- Update security patches

---

**Production-Ready Configuration** ✅
