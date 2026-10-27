# End-to-End Authentication Setup Guide

Complete guide for setting up and testing the Card Agent authentication system with frontend and backend integration.

## Quick Start (5 minutes)

### Option 1: Docker Compose (Recommended for E2E Testing)

```bash
# From project root
docker-compose up --build
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Local Development

**Terminal 1 - Backend:**
```bash
cd apps/backend
uv sync  # or pip install -e ".[dev]"
cp .env.example .env
uvicorn src.api.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd apps/web
npm install
npm run dev
```

Access: http://localhost:3000

---

## Complete Setup Instructions

### Backend Setup

#### 1. Install Dependencies

```bash
cd apps/backend

# With uv (recommended)
uv sync

# OR with pip
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e ".[dev]"
```

#### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```bash
# Generate a strong secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy the output to SECRET_KEY

SECRET_KEY=<generated-key>
DATABASE_URL=sqlite+aiosqlite:///./test.db  # For development
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
```

#### 3. Install Redis (Optional, has fallback)

```bash
# macOS
brew install redis
redis-server

# Linux
sudo apt-get install redis-server
redis-server

# Docker
docker run -d -p 6379:6379 redis:latest
```

#### 4. Run Backend

```bash
# Development with auto-reload
uvicorn src.api.main:app --reload

# Production
uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

Backend available at: `http://localhost:8000`

**Check it's working:**
```bash
curl http://localhost:8000/health
# Output: {"status":"ok","version":"0.1.0"}
```

#### 5. View API Documentation

Open in browser: `http://localhost:8000/docs`

---

### Frontend Setup

#### 1. Install Dependencies

```bash
cd apps/web
npm install
```

Installs: react, react-dom, react-router-dom, typescript, vite

#### 2. Configure Environment

```bash
# Create .env.local (usually already set)
cat > .env.local << EOF
VITE_API_URL=http://localhost:8000
EOF
```

#### 3. Run Development Server

```bash
npm run dev
```

Frontend available at: `http://localhost:3000`

#### 4. Build for Production

```bash
npm run build
# Output in dist/
```

---

## Testing the Application

### Test User Data

Use these credentials for testing:

```json
{
  "signup": {
    "email": "testuser@example.com",
    "first_name": "Test",
    "last_name": "User",
    "password": "TestPassword123"
  },
  "login": {
    "email": "testuser@example.com",
    "password": "TestPassword123"
  }
}
```

### Manual E2E Test

#### 1. Sign Up Flow

1. Open http://localhost:3000
2. Click "Sign Up"
3. Fill form:
   - Email: `testuser@example.com`
   - First Name: `Test`
   - Last Name: `User`
   - Password: `TestPassword123`
   - Confirm: `TestPassword123`
4. Click "Sign Up"
5. Should see profile page with your info

#### 2. Logout

1. Click "Logout" button
2. Redirected to home page

#### 3. Login Flow

1. Click "Log In"
2. Fill form:
   - Email: `testuser@example.com`
   - Password: `TestPassword123`
3. Click "Log In"
4. Should see profile page again

#### 4. Protected Route

1. Logout first
2. Try to go to http://localhost:3000/profile
3. Should redirect to login
4. Login to access profile

### API Testing with cURL

#### Signup
```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "first_name": "Test",
    "last_name": "User",
    "password": "TestPassword123"
  }'
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "testuser@example.com",
    "first_name": "Test",
    "last_name": "User",
    "created_at": "2026-10-25T12:00:00",
    "is_active": true
  }
}
```

#### Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPassword123"
  }'
```

#### Get Profile
```bash
# Replace TOKEN with actual access_token from signup/login
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."

curl -X GET http://localhost:8000/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

#### Logout
```bash
curl -X POST http://localhost:8000/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### Testing Invalid Scenarios

#### Signup with Duplicate Email
```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "first_name": "Another",
    "last_name": "User",
    "password": "Password123"
  }'
# Should return 409 Conflict
```

#### Login with Wrong Password
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "WrongPassword"
  }'
# Should return 401 Unauthorized
```

#### Access Profile Without Token
```bash
curl -X GET http://localhost:8000/auth/profile
# Should return 401 Unauthorized
```

---

## Docker Compose Setup

### Complete Stack

```bash
docker-compose up --build
```

This starts:
- **Frontend**: http://localhost:3000 (React)
- **Backend**: http://localhost:8000 (FastAPI)
- **PostgreSQL**: localhost:5432 (Database)
- **Redis**: localhost:6379 (Cache)

### Docker Compose Services

View logs:
```bash
docker-compose logs -f  # All services
docker-compose logs -f backend  # Just backend
docker-compose logs -f web  # Just frontend
```

Stop services:
```bash
docker-compose down
```

Remove volumes (clean slate):
```bash
docker-compose down -v
```

### Database Configuration in Docker

PostgreSQL URL for Docker Compose:
```
postgresql+asyncpg://card_user:card_password@postgres:5432/card_db
```

Update `.env`:
```bash
DATABASE_URL=postgresql+asyncpg://card_user:card_password@postgres:5432/card_db
```

---

## Testing Backend Only

### Run Backend Tests

```bash
cd apps/backend

# All tests
pytest

# Auth tests only
pytest tests/test_auth.py -v

# With coverage
pytest --cov=src tests/

# Specific test
pytest tests/test_auth.py::test_signup_success -v
```

### Test Coverage Report

```bash
pytest --cov=src --cov-report=html tests/
# Opens in htmlcov/index.html
```

---

## Troubleshooting

### Backend Issues

**Problem: `ModuleNotFoundError: No module named 'sqlalchemy'`**
- Solution: Run `uv sync` or `pip install -e ".[dev]"`

**Problem: Database locked**
- Solution: Delete `test.db` and restart
- Or use PostgreSQL in Docker

**Problem: Redis connection failed**
- Solution: Fallback to in-memory storage works, or start Redis
- Or ignore - has fallback

**Problem: CORS error from frontend**
- Solution: Check `ALLOWED_ORIGINS` in `.env`
- Should include `http://localhost:3000`

### Frontend Issues

**Problem: `Cannot find module 'react-router-dom'`**
- Solution: Run `npm install`

**Problem: API calls returning 404**
- Solution: Check `VITE_API_URL` in `.env.local`
- Should be `http://localhost:8000`

**Problem: Token not persisting**
- Solution: Check localStorage is enabled
- Clear cache and try again

**Problem: Blank page or white screen**
- Solution: Check browser console for errors
- Ensure backend is running
- Try `npm run dev` again

### Database Issues

**Problem: Tables not created**
- Solution: They auto-create on app startup
- Or manually: `python -c "import asyncio; from src.db.database import init_db; asyncio.run(init_db())"`

**Problem: SQLite file locked**
- Solution: Stop all processes using it
- Delete the `.db` file and restart

---

## File Structure Overview

```
card-manager-assistant/
├── apps/
│   ├── backend/                 # FastAPI + LangGraph
│   │   ├── src/
│   │   │   ├── api/
│   │   │   │   ├── main.py      # FastAPI app
│   │   │   │   └── auth.py      # Auth routes (NEW)
│   │   │   ├── db/
│   │   │   │   ├── database.py  # DB setup
│   │   │   │   └── models.py    # ORM models (NEW)
│   │   │   ├── services/
│   │   │   │   ├── user_service.py  # User CRUD (NEW)
│   │   │   │   └── card_service.py
│   │   │   ├── middleware/
│   │   │   │   └── auth.py      # Auth middleware (NEW)
│   │   │   ├── utils/
│   │   │   │   ├── jwt_handler.py  # JWT utils (NEW)
│   │   │   │   ├── password.py     # Password hashing (NEW)
│   │   │   │   └── redis_session.py # Session mgmt (NEW)
│   │   │   └── models/
│   │   │       └── __init__.py  # Pydantic schemas (UPDATED)
│   │   ├── tests/
│   │   │   ├── test_auth.py     # Auth tests (NEW)
│   │   │   └── conftest.py      # Test fixtures (UPDATED)
│   │   ├── .env.example         # Environment template (NEW)
│   │   ├── pyproject.toml       # Dependencies (UPDATED)
│   │   ├── AUTH_IMPLEMENTATION.md  # Backend docs (NEW)
│   │   └── BACKEND_AUTH_SETUP.md   # Setup guide (NEW)
│   │
│   └── web/                     # React + TypeScript
│       ├── src/
│       │   ├── pages/
│       │   │   ├── HomePage.tsx       # Landing (NEW)
│       │   │   ├── SignupPage.tsx     # Signup form (NEW)
│       │   │   ├── LoginPage.tsx      # Login form (NEW)
│       │   │   └── ProfilePage.tsx    # User profile (NEW)
│       │   ├── components/
│       │   │   ├── ProtectedRoute.tsx # Route guard (NEW)
│       │   │   └── FormField.tsx      # Form input (NEW)
│       │   ├── context/
│       │   │   └── AuthContext.tsx    # Auth state (NEW)
│       │   ├── services/
│       │   │   └── authService.ts     # API client (NEW)
│       │   ├── App.tsx                # Routing (UPDATED)
│       │   ├── main.tsx               # Entry point
│       │   └── vite-env.d.ts
│       ├── .env.local               # Dev config (NEW)
│       ├── .env.example             # Config template (NEW)
│       ├── package.json             # Dependencies (UPDATED)
│       ├── vite.config.ts           # Build config
│       ├── tsconfig.json            # TypeScript config
│       ├── index.html               # HTML entry
│       └── FRONTEND_AUTH_SETUP.md   # Setup guide (NEW)
│
├── docker-compose.yml           # Docker setup
├── BACKEND_AUTH_SETUP.md        # Backend guide
├── E2E_SETUP_GUIDE.md          # This file
└── CLAUDE.md                    # Project instructions
```

---

## Development Workflow

### Making Changes

#### Backend Changes
1. Edit file in `apps/backend/src/`
2. Auto-reload picks up changes (uvicorn --reload)
3. Run tests: `pytest`

#### Frontend Changes
1. Edit file in `apps/web/src/`
2. Dev server auto-refreshes
3. Check browser at http://localhost:3000

### Before Committing

**Backend:**
```bash
cd apps/backend
black src  # Format
ruff check --fix src  # Lint
mypy src  # Type check
pytest  # Run tests
```

**Frontend:**
```bash
cd apps/web
npm run build  # Check build
# No formal linting/formatting yet
```

---

## Production Deployment

### Environment Variables - Production

**Backend:**
```bash
SECRET_KEY=<generate-secure-random-key>
DATABASE_URL=postgresql+asyncpg://user:pass@prod-db.example.com:5432/card_db
REDIS_URL=redis://prod-redis.example.com:6379
ALLOWED_ORIGINS=https://app.example.com
```

**Frontend:**
```bash
VITE_API_URL=https://api.example.com
```

### Docker Build

**Backend:**
```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY apps/backend .
RUN pip install -e .
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend:**
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY apps/web .
RUN npm ci && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Deployment Checklist

- [ ] Backend runs without --reload
- [ ] Frontend builds without errors
- [ ] All tests pass
- [ ] SECRET_KEY is secure random string
- [ ] DATABASE_URL points to production DB
- [ ] REDIS_URL points to production Redis
- [ ] ALLOWED_ORIGINS restricted to domains
- [ ] HTTPS enabled on all endpoints
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Error monitoring configured (Sentry, etc.)
- [ ] Logging configured
- [ ] Backup strategy in place

---

## Next Steps

### After Basic Auth Works

1. **Extend Backend:**
   - Add password reset endpoint
   - Add email verification
   - Add role-based access control

2. **Extend Frontend:**
   - Add password reset form
   - Add settings page
   - Add user list (admin)

3. **Add Card Management:**
   - Card creation/editing UI
   - Card list view
   - Card details page

4. **Add AI Features:**
   - Agent workflow UI
   - Analysis results display
   - Suggestions panel

---

## Documentation Files

- `BACKEND_AUTH_SETUP.md` - Backend authentication guide
- `FRONTEND_AUTH_SETUP.md` - Frontend authentication guide
- `apps/backend/AUTH_IMPLEMENTATION.md` - Backend implementation details
- `apps/backend/src/api/auth.py` - Endpoint docstrings
- `CLAUDE.md` - Project instructions

---

## Support

For issues:
1. Check relevant documentation file
2. Review error messages in terminal/console
3. Check logs with `docker-compose logs -f`
4. Verify environment variables
5. Try restarting services

---

**Happy coding! 🚀**
