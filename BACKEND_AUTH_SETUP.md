# Backend User Authentication Setup Guide

## What's Been Implemented

I've built a complete user authentication system for the FastAPI backend with the following features:

### 1. **User Management**
- ✅ User model with PostgreSQL-ready SQLAlchemy ORM
- ✅ Email uniqueness constraint with database index
- ✅ Bcrypt password hashing with salting
- ✅ Active/inactive user states

### 2. **JWT Authentication**
- ✅ JWT token generation (HS256 algorithm)
- ✅ Token payload: user_id, email, expiration
- ✅ 30-day token lifetime
- ✅ Token verification and expiration checking

### 3. **Redis Session Management**
- ✅ Token storage in Redis with 30-day TTL
- ✅ Fallback in-memory storage if Redis unavailable
- ✅ Token revocation support
- ✅ Session invalidation on logout
- ✅ Bulk token revocation for password reset flows

### 4. **Authentication Middleware**
- ✅ Bearer token extraction from Authorization header
- ✅ JWT validation dependency for protected routes
- ✅ 401/403 error handling
- ✅ Token revocation check

### 5. **REST API Endpoints**
- ✅ **POST /auth/signup** - User registration
- ✅ **POST /auth/login** - User login
- ✅ **GET /auth/profile** - Get current user (protected)
- ✅ **POST /auth/logout** - Logout (protected)

### 6. **Complete Test Suite**
- ✅ 14+ test cases
- ✅ Signup success/validation tests
- ✅ Login success/failure tests
- ✅ Profile access tests
- ✅ Logout tests
- ✅ Token verification tests

## Files Created/Modified

### New Files
```
apps/backend/
├── src/
│   ├── api/
│   │   └── auth.py                  # Auth endpoints
│   ├── db/
│   │   └── models.py               # SQLAlchemy User & Card models
│   ├── middleware/
│   │   └── auth.py                 # Auth verification middleware
│   ├── services/
│   │   └── user_service.py         # User CRUD operations
│   └── utils/
│       ├── jwt_handler.py          # JWT token utilities
│       ├── password.py             # Password hashing
│       └── redis_session.py        # Redis session manager
├── tests/
│   └── test_auth.py                # Authentication tests
├── .env.example                     # Environment variables template
└── AUTH_IMPLEMENTATION.md           # Detailed documentation
```

### Modified Files
```
apps/backend/
├── src/
│   ├── api/main.py                 # Added auth router, lifespan
│   ├── db/database.py              # Added init_db(), env config
│   └── models/__init__.py           # Added auth schemas
├── pyproject.toml                   # Added JWT & password libraries
└── tests/conftest.py               # Added test fixtures
```

## Quick Start

### 1. Install Dependencies
```bash
cd apps/backend

# With uv (recommended)
uv sync

# OR with pip
pip install -e ".[dev]"
```

### 2. Create .env file
```bash
cp .env.example .env
```

Edit `.env` and set:
```bash
SECRET_KEY=your-random-secret-key-here  # Generate a secure random string
DATABASE_URL=sqlite+aiosqlite:///./test.db  # Or PostgreSQL
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
```

### 3. Start Development Server
```bash
uvicorn src.api.main:app --reload
```

Server starts at `http://localhost:8000`

## API Usage Examples

### Sign Up
```bash
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "password": "SecurePassword123"
  }'
```

**Response (201 Created):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2026-10-25T12:34:56Z",
    "is_active": true
  }
}
```

### Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePassword123"
  }'
```

### Get User Profile (Protected)
```bash
curl -X GET http://localhost:8000/auth/profile \
  -H "Authorization: Bearer <your_access_token>"
```

### Logout
```bash
curl -X POST http://localhost:8000/auth/logout \
  -H "Authorization: Bearer <your_access_token>"
```

## Protecting Routes

To protect other endpoints with authentication:

```python
from fastapi import Depends
from src.middleware.auth import verify_user_auth, get_current_user_id
from uuid import UUID

@app.get("/protected-route")
async def protected_route(
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> dict:
    user_id = get_current_user_id(payload)
    # Use user_id to restrict access to user's own data
    return {"user_id": user_id}
```

## Running Tests

```bash
# Run all tests
pytest

# Run auth tests only
pytest tests/test_auth.py -v

# Run with coverage
pytest --cov=src tests/

# Run specific test
pytest tests/test_auth.py::test_signup_success -v
```

## Environment Variables

### Required
- `SECRET_KEY` - JWT signing secret (change in production!)
- `DATABASE_URL` - Database connection string
- `REDIS_URL` - Redis connection URL

### Optional
- `ALLOWED_ORIGINS` - CORS origins (default: http://localhost:3000)
- `SQL_ECHO` - Enable SQL debug logging (default: False)

## Key Security Features

### ✅ Implemented
- Bcrypt password hashing with automatic salt
- JWT token validation
- Token revocation via Redis
- Bearer token authentication
- Email uniqueness enforcement
- Password minimum length (8 chars)
- Constant-time password comparison
- Token expiration (30 days)

### 🔄 Recommended for Production
- HTTPS/TLS for all endpoints
- Generate new SECRET_KEY (256+ random bits)
- Use PostgreSQL instead of SQLite
- Enable Redis persistence
- Configure rate limiting on auth endpoints
- Implement refresh tokens
- Add email verification
- Enable audit logging
- Set up intrusion detection

## Database Setup

### For SQLite (Development)
```bash
# Automatic on first request - no setup needed
uvicorn src.api.main:app --reload
```

### For PostgreSQL (Production)
1. Create database and user:
```sql
CREATE DATABASE card_db;
CREATE USER card_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE card_db TO card_user;
```

2. Update `.env`:
```bash
DATABASE_URL=postgresql+asyncpg://card_user:secure_password@localhost:5432/card_db
```

3. Run migrations (optional, auto-creates tables):
```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

## Token Lifecycle

1. **Creation**: User signs up or logs in
   - JWT token created with 30-day expiration
   - Token stored in Redis with TTL

2. **Validation**: Client sends request with `Authorization: Bearer <token>`
   - JWT signature verified
   - Expiration checked
   - Token checked in Redis (not revoked)

3. **Revocation**: User logs out
   - All user tokens deleted from Redis
   - Old tokens still valid JWT-wise, but rejected by middleware

4. **Expiration**: After 30 days
   - JWT verification fails
   - Redis key auto-expires
   - User must login again

## Frontend Integration (React)

### Example Authentication Flow

```typescript
// Signup
const signup = async (email: string, firstName: string, lastName: string, password: string) => {
  const response = await fetch('http://localhost:8000/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, first_name: firstName, last_name: lastName, password })
  });
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  return data.user;
};

// Login
const login = async (email: string, password: string) => {
  const response = await fetch('http://localhost:8000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  return data.user;
};

// Protected API call
const getProfile = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:8000/auth/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Logout
const logout = async () => {
  const token = localStorage.getItem('token');
  await fetch('http://localhost:8000/auth/logout', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  localStorage.removeItem('token');
};
```

## Troubleshooting

### Redis Connection Error
- Falls back to in-memory storage automatically
- For production, ensure Redis is running: `redis-server`
- Check REDIS_URL: `redis://localhost:6379`

### Database Connection Error
- For SQLite: Check file permissions
- For PostgreSQL: Verify connection string and server is running
- Set `SQL_ECHO=True` to debug

### Invalid Token Error
- Token expires after 30 days
- Token revoked after logout
- Check SECRET_KEY hasn't changed
- Verify Authorization header format: `Bearer <token>`

### Email Already Exists
- Email is unique per user
- Use different email or reset password

## Next Steps

1. **Email Verification** - Add email confirmation step
2. **Password Reset** - Implement forgot password flow
3. **Refresh Tokens** - Add token refresh mechanism
4. **Rate Limiting** - Add rate limits to auth endpoints
5. **Role-Based Access** - Add admin/user roles
6. **Audit Logging** - Log all auth events
7. **Two-Factor Auth** - Add 2FA support

## Documentation

Detailed documentation available in:
- `apps/backend/AUTH_IMPLEMENTATION.md` - Complete technical details
- `apps/backend/src/api/auth.py` - Endpoint docstrings
- `apps/backend/src/services/user_service.py` - Service layer docs
- `apps/backend/tests/test_auth.py` - Test examples

## Support & Issues

For issues or questions:
1. Check `.env` configuration
2. Review test cases for examples
3. Check FastAPI docs: http://localhost:8000/docs (when running)
4. Inspect logs with `SQL_ECHO=True`
