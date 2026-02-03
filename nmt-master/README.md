# NMT Preparation Platform

A comprehensive, production-ready web platform for Ukrainian National Multi-Subject Test (NMT) preparation. Built with Next.js 16, TypeScript, PostgreSQL, Prisma, and Tailwind CSS.

## Features

### Core Features
- 🔐 **Secure Authentication**: JWT-based auth with bcrypt password hashing
- 📝 **Comprehensive Test Library**: Thousands of practice questions across all subjects
- ⏱️ **Realistic Timing**: Tests with accurate time limits matching real NMT conditions
- 🎯 **Flexible Question Types**: Single choice, multiple answers, written answers, and matching
- 💾 **Smart Auto-Save**: Automatic answer saving with pause/resume functionality
- 📊 **Detailed Analytics**: Track progress with comprehensive performance metrics
- 🏆 **Leaderboard**: Compete with other users and track top scorers
- 🎖️ **Achievements & Badges**: Unlock badges as you progress
- 🌙 **Dark Mode**: Toggle between light and dark themes
- 📱 **Mobile-First Design**: Fully responsive layout for all devices

### Advanced Features
- **Answer Validation**: Smart grading for all question types
- **Partial Credit**: Support for partial correctness in multiple-choice questions
- **Official NMT Scoring**: Conversion to official 200-point NMT scale
- **Progress Tracking**: Subject-by-subject accuracy statistics
- **Admin Panel**: Create tests, manage questions, monitor platform activity
- **Export Results**: Download test results in multiple formats
- **Smooth Animations**: Polished UI with transitions and effects

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **React 19** - UI library
- **Tailwind CSS v4** - Utility-first CSS
- **Zustand** - State management
- **Recharts** - Data visualization
- **js-cookie** - Cookie management

### Backend
- **Node.js 20+** - JavaScript runtime
- **Next.js API Routes** - Serverless backend
- **PostgreSQL** - Relational database
- **Prisma ORM** - Database toolkit
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication

## Project Structure

```
nmt-master/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/              # Authentication endpoints
│   │   ├── tests/             # Test management
│   │   ├── users/             # User endpoints
│   │   ├── leaderboard/       # Leaderboard
│   │   └── subjects/          # Subject data
│   ├── admin/                  # Admin panel pages
│   ├── test/                   # Test taking page
│   ├── tests/                  # Test list page
│   ├── dashboard/              # User dashboard
│   ├── results/                # Results display
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   ├── leaderboard/            # Leaderboard page
│   ├── page.tsx                # Home page
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/                 # React components
├── lib/                        # Utility functions
├── store/                      # Zustand stores
├── prisma/                     # Database schema
└── public/                     # Static assets
```

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 12+
- npm or yarn

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env.local
# Edit .env.local with your database URL
```

3. **Initialize database:**
```bash
npm run prisma:generate
npm run prisma:migrate
npx ts-node prisma/seed.ts
```

4. **Start development server:**
```bash
npm run dev
```

5. **Open browser:**
```
http://localhost:3000
```

## Default Admin Account

- **Email**: www.macs2009@gmail.com
- **Password**: 25242118

## Key Features Explained

### Authentication
- User registration and login
- JWT token stored in HTTP-only cookies
- Persistent login across sessions
- Protected routes for authenticated users
- Admin-only endpoints

### Tests & Questions
- Four question types with intelligent grading
- Auto-save answers during test
- Pause/resume functionality
- Real-time timer
- Progress tracking per question

### Scoring System
- Raw score to NMT 200-point scale conversion
- Partial credit for multiple-choice
- Automatic accuracy calculation
- Historical results tracking

### User Dashboard
- Personal performance charts
- Recent test results
- Achievement system
- Progress statistics
- Quick access to tests

### Admin Panel
- Create and edit tests
- Manage questions
- Monitor user activity
- View platform statistics
- Generate reports

## Database Schema Highlights

- **Users**: Authentication & profiles
- **Tests**: Test definitions
- **Questions**: Individual questions
- **Answers**: Answer options
- **TestAttempts**: User test sessions
- **Results**: Calculated scores
- **Achievements**: User badges
- **UserStats**: Aggregated metrics

## API Overview

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### Tests
```
GET    /api/tests
POST   /api/tests (admin)
GET    /api/tests/:id
PUT    /api/tests/:id (admin)
DELETE /api/tests/:id (admin)
POST   /api/tests/:id/submit
```

### Users
```
GET    /api/users/stats
GET    /api/leaderboard
POST   /api/attempts/:id/answers/:qid
```

## Styling

- **Tailwind CSS v4** - Complete styling
- **Dark Mode** - Full dark theme support
- **Responsive** - Mobile-first design
- **Animations** - Smooth transitions
- **Accessible** - WCAG compliant

## Performance

- Code splitting per route
- Optimized images
- API response caching
- Database query optimization
- CSS minification
- Lazy loading components

## Security

- JWT authentication
- bcrypt password hashing
- CSRF protection
- Secure HTTP-only cookies
- Input validation
- Role-based access control

## Development

### Build for Production
```bash
npm run build
npm start
```

### Code Quality
- TypeScript strict mode
- ESLint configuration
- Type checking on all files
- Modular architecture

## Troubleshooting

### Database Issues
```bash
# Reset database
npx prisma migrate reset

# View database
npm run prisma:studio
```

### Build Issues
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

## Future Enhancements

- Video tutorials for topics
- Live practice sessions
- Peer discussion forums
- Mobile app (React Native)
- Offline mode
- AI-powered recommendations
- Proctored exams
- Institution management

## Support

For issues or questions, refer to the documentation or contact the development team.

---

**Version**: 1.0.0  
**Built with ❤️ for NMT preparation**
