# NMT Platform - Troubleshooting Guide

## Quick Fixes

### Installation Issues

#### npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Remove lock file and reinstall
rm package-lock.json
npm install
```

#### Node version mismatch
```bash
# Check Node version (should be 20+)
node --version

# If too old, update Node
# Visit https://nodejs.org/
# Or use nvm (Node Version Manager)
nvm install 20
nvm use 20
```

---

## Database Issues

### PostgreSQL Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL if stopped
sudo systemctl start postgresql

# Verify connection string in .env.local
# Format: postgresql://user:password@localhost:5432/nmt_prep
```

### Database doesn't exist
```
Error: database "nmt_prep" does not exist
```

**Solution:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE nmt_prep;

# Exit psql
\q

# Run migrations
npm run prisma:migrate
```

### Migration fails
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or manually
npx prisma migrate deploy

# Recreate schema
npm run prisma:generate
npm run prisma:migrate
```

### Prisma Client not generated
```
Error: Cannot find module '@prisma/client'
```

**Solution:**
```bash
npm run prisma:generate

# Or manually
npx prisma generate

# Reinstall if still failing
rm -rf node_modules
npm install
npm run prisma:generate
```

---

## Development Server Issues

### Port 3000 already in use
```
Error: Port 3000 already in use
```

**Solution:**
```bash
# Option 1: Use different port
npm run dev -- -p 3001

# Option 2: Kill process on port 3000 (macOS/Linux)
lsof -i :3000
kill -9 <PID>

# Option 2: Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Hot reload not working
```bash
# Restart dev server
# Press Ctrl+C to stop
# Run again
npm run dev

# Clear Next.js cache if needed
rm -rf .next
npm run dev
```

### TypeScript errors but code looks fine
```bash
# Regenerate types
npm run prisma:generate

# Clear TSC cache
rm -rf node_modules/.cache

# Restart IDE
# Restart VS Code
```

---

## Authentication Issues

### Can't login
1. Check .env.local has JWT_SECRET
2. Verify user exists in database
3. Clear browser cookies: DevTools → Application → Cookies → Delete auth-token
4. Try registering new account

### Login redirects to /login repeatedly
```bash
# Clear localStorage
# In browser console:
# localStorage.clear()
# Reload page
```

### Admin page shows "Forbidden"
- Verify user role in database
- Use correct admin account
- Check role is 'admin' (case-sensitive)

**SQL to check user role:**
```sql
SELECT id, email, role FROM "User" WHERE email = 'www.macs2009@gmail.com';
```

---

## Test Taking Issues

### Timer not counting down
- Refresh the page
- Check browser isn't minimized
- Clear browser cache: Ctrl+Shift+Delete

### Answer not saving
- Check network in DevTools (F12 → Network)
- Verify API endpoint works
- Try different answer type

### Test doesn't submit
1. Check all answers are provided
2. Verify API response in DevTools
3. Check database has space

### Question doesn't load
```bash
# Check test has questions
# In browser console:
# fetch('/api/tests/TEST_ID').then(r => r.json()).then(d => console.log(d.questions))

# If empty, seed test data:
npm run prisma:migrate
npx ts-node prisma/seed.ts
```

---

## UI/Styling Issues

### Dark mode not working
```bash
# Clear theme preference
# In browser console:
# localStorage.removeItem('theme-storage')
# Reload page

# Or check store/theme.ts is loaded
```

### Styles not applying
```bash
# Rebuild Tailwind CSS
# Delete Next.js cache
rm -rf .next

# Rebuild
npm run build
npm run dev

# If still broken, check globals.css is imported in layout.tsx
```

### Mobile view broken
- Clear browser cache
- Check viewport meta tag in layout.tsx
- Test in different browser
- Disable browser extensions

---

## API Issues

### API returns 401 Unauthorized
- User not authenticated
- Token expired
- Wrong cookies set
- Clear cookies and login again

### API returns 403 Forbidden
- User doesn't have permission
- Admin action by non-admin
- Check user role in database

### API returns 404 Not Found
- Wrong API endpoint URL
- Resource doesn't exist
- Check API route files exist

### API returns 500 Internal Server Error
1. Check server logs (console output)
2. Check database connection
3. Check .env variables
4. Look at error details in network tab

**Check server logs:**
```bash
# Stop server (Ctrl+C)
# Look at terminal output for errors
# Fix error
# Restart: npm run dev
```

---

## Performance Issues

### Slow page load
1. Check network tab (DevTools F12)
2. Look for slow API responses
3. Check database query performance
4. Disable browser extensions

### Tests loading slowly
- Check question count (limit to 50)
- Optimize database queries
- Clear browser cache

### Build takes too long
```bash
# Use SWC compiler (faster)
# Already configured in Next.js 16

# Clear cache
rm -rf .next node_modules/.cache
npm run build
```

---

## Database Performance

### Slow queries
```sql
-- Check slow queries
SELECT query, calls, total_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Create index if needed
CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_test_attempt_user ON "TestAttempt"("userId");
```

### Database too large
```sql
-- Check size
SELECT pg_size_pretty(pg_database_size('nmt_prep'));

-- Archive old test attempts
DELETE FROM "TestAttempt" 
WHERE "completedAt" < NOW() - INTERVAL '1 year';
```

---

## Build Issues

### Build fails
```bash
# Clear cache
rm -rf .next node_modules

# Reinstall
npm install

# Generate Prisma
npm run prisma:generate

# Try build again
npm run build
```

### Build succeeds but app won't start
1. Check .env variables
2. Check database migrations ran
3. Check port is available
4. Check for runtime errors

### Production build different from dev
```bash
# Use production flag
NODE_ENV=production npm run build
NODE_ENV=production npm start
```

---

## Deployment Issues

### Site not loading after deploy
1. Check database migrations
2. Verify environment variables
3. Check server logs
4. Verify port is exposed
5. Check firewall rules

### Cookies not working on HTTPS
- Add Secure flag (production .env)
- Use SameSite=Lax
- Check domain configuration

### CORS errors
- This app doesn't use CORS (same-domain API)
- If custom domain, check origin header

---

## Useful Commands

```bash
# View database
npm run prisma:studio

# Check database schema
npx prisma db execute --stdin < prisma/schema.prisma

# Reset everything
npm run prisma:migrate -- --skip-generate reset

# View Prisma logs
DEBUG="prisma:*" npm run dev

# Check project structure
find . -type f -name "*.tsx" -o -name "*.ts" | grep -v node_modules | head -20

# Count lines of code
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs wc -l
```

---

## Getting Help

### Check Documentation
1. README.md - Project overview
2. QUICKSTART.md - Setup guide
3. DEPLOYMENT.md - Production guide
4. IMPLEMENTATION.md - Features list

### Debug Strategy
1. Check error message carefully
2. Look in console/terminal output
3. Check DevTools Network tab
4. Check database with Prisma Studio
5. Check .env variables
6. Read full error stack trace

### Common Issues Checklist
- [ ] Node version correct (20+)
- [ ] PostgreSQL running
- [ ] .env.local configured
- [ ] Database exists
- [ ] Migrations ran
- [ ] Prisma generated
- [ ] Dependencies installed
- [ ] No port conflicts
- [ ] Correct login credentials
- [ ] Cookies enabled in browser

---

## Still Stuck?

### Enable Debug Mode
```bash
# View detailed logs
DEBUG=* npm run dev

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log
```

### Check System Requirements
- Node.js 20+
- PostgreSQL 12+
- npm 10+
- 2GB RAM minimum
- 500MB disk space

### Last Resort
```bash
# Complete reset
rm -rf .next node_modules package-lock.json
npm cache clean --force
npm install
npm run prisma:generate
npm run prisma:migrate -- --skip-generate reset
npm run dev
```

---

**Most issues are solved by:**
1. Clearing cache: `rm -rf .next`
2. Resetting database: `npx prisma migrate reset`
3. Reinstalling: `npm install`
4. Restarting dev server: `npm run dev`

Good luck! 🚀
