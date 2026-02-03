# NMT Platform - Quick Start Guide

## One-Time Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database
Create a PostgreSQL database named `nmt_prep`:
```sql
CREATE DATABASE nmt_prep;
```

Update `.env.local`:
```
DATABASE_URL="postgresql://username:password@localhost:5432/nmt_prep"
JWT_SECRET="nmt_secret_key_25242118"
NEXT_PUBLIC_API_URL="http://localhost:3000"
NODE_ENV="development"
```

### 3. Initialize Database
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed sample data
npx ts-node prisma/seed.ts
```

### 4. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000`

## Login Credentials

### Admin Account
- **Email**: www.macs2009@gmail.com
- **Password**: 25242118
- **Access**: Full admin panel at `/admin`

### Test Account
Create a new account via the registration page.

## Project Features

### 🎯 User Features
- Home page with subject selection
- Tests listing with filters
- Test taking with timer
- Results display with scoring
- User dashboard with analytics
- Leaderboard viewing
- Dark mode toggle

### 👨‍💼 Admin Features
- Test management (Create/Edit/Delete)
- Question management
- User monitoring
- Platform analytics
- Reports generation
- Subject management

### 📱 Technical Highlights
- Next.js 16 with App Router
- TypeScript for type safety
- PostgreSQL + Prisma
- JWT authentication
- Zustand state management
- Tailwind CSS styling
- Mobile-first responsive design
- Recharts for visualizations

## Key Pages

| Page | URL | Requires Auth |
|------|-----|----------------|
| Home | `/` | No |
| Login | `/login` | No |
| Register | `/register` | No |
| Tests | `/tests` | Yes |
| Test Taking | `/test/:id` | Yes |
| Results | `/results/:id` | Yes |
| Dashboard | `/dashboard` | Yes |
| Leaderboard | `/leaderboard` | Yes |
| Admin | `/admin` | Yes (Admin) |

## API Routes

All API routes are in `/app/api/` directory.

### Authentication Routes
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

### Test Routes
- `GET /api/tests` - List tests (with filters)
- `POST /api/tests` - Create test (admin)
- `GET /api/tests/:id` - Get test details
- `POST /api/tests/:id/attempt` - Start test
- `POST /api/tests/:id/submit` - Submit test

### User Routes
- `GET /api/users/stats` - User statistics
- `GET /api/leaderboard` - Top scorers

## Important Notes

### Database
- Uses PostgreSQL (required)
- Prisma ORM handles migrations
- Sample data is seeded on initialization
- Admin user created with seed script

### Authentication
- JWT tokens stored in HTTP-only cookies
- 7-day token expiration
- Secure password hashing with bcrypt
- Protected routes check authentication

### Scoring
- Raw score: 0-100 (percentage)
- NMT scale: 0-200 (official)
- Automatic conversion applied
- Partial credit supported
- Stored in database for tracking

## Common Tasks

### View Database
```bash
npm run prisma:studio
```

### Reset Database
```bash
npx prisma migrate reset
```

### Generate Prisma
```bash
npm run prisma:generate
```

### Build for Production
```bash
npm run build
npm start
```

## Troubleshooting

### Port 3000 Already in Use
```bash
# Change port
npm run dev -- -p 3001
```

### Database Connection Error
1. Verify PostgreSQL is running
2. Check DATABASE_URL in .env.local
3. Ensure database exists
4. Run migrations: `npm run prisma:migrate`

### Missing Dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Errors
1. Clear Next.js cache: `rm -rf .next`
2. Regenerate Prisma: `npm run prisma:generate`
3. Rebuild: `npm run build`

## Next Steps

1. ✅ Install and run the platform
2. 📝 Create your first test as admin
3. 🎓 Add questions to test
4. 👤 Create user accounts
5. 🧪 Take tests as regular user
6. 📊 View dashboard and analytics
7. 🏆 Check leaderboard

## Support Resources

- Next.js Docs: https://nextjs.org/docs
- Prisma Docs: https://www.prisma.io/docs/
- Tailwind Docs: https://tailwindcss.com/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/

---

**Ready to go!** 🚀 Your NMT platform is ready for development.
