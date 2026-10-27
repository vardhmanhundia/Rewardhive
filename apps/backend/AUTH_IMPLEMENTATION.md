# User Authentication & Profile Management Implementation

This document describes the complete user authentication system implemented for the Card Agent Backend.

## Overview

The implementation includes:
1. **User Model & Database** - PostgreSQL-ready SQLAlchemy ORM models
2. **User CRUD Operations** - Complete service layer for user management
3. **JWT Authentication** - Secure token-based authentication
4. **Redis Session Management** - Token storage with 30-day expiration
5. **Authentication Middleware** - Protected route verification
6. **REST API Endpoints** - Signup, login, profile, logout

## Architecture

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

#### Cards Table
```sql
CREATE TABLE cards (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    description VARCHAR(500),
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft',
    is_public BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

### Components

#### 1. Models (`src/db/models.py`)
- **User**: SQLAlchemy ORM model for user accounts
  - UUID primary key
  - Email unique constraint with index
  - Bcrypt-hashed password storage
  - Active flag for soft deletes
  - Auto-managed timestamps

- **Card**: SQLAlchemy ORM model for cards (extended with user_id)
  - Links to user via user_id FK

#### 2. Pydantic Schemas (`src/models/__init__.py`)
- **UserSignupRequest**: Registration input validation
  - Email validation via EmailStr
  - Password minimum 8 characters
  - Name fields required

- **UserLoginRequest**: Login credentials
  - Email and password required

- **UserLoginResponse**: Authentication response
  - Access token with JWT
  - Token type: "bearer"
  - User profile data

- **UserProfileResponse**: User profile endpoint response
  - User metadata without sensitive fields

- **UserSchema**: Full user data model
  - Used for response serialization

#### 3. JWT Handler (`src/utils/jwt_handler.py`)
```python
def create_access_token(user_id: UUID, email: str) -> str
```
- Creates JWT tokens with 30-day expiration
- Uses HS256 algorithm
- Payload includes: sub (user_id), email, exp, iat

```python
def verify_token(token: str) -> Optional[dict]
```
- Validates JWT signature and expiration
- Returns decoded payload or None

```python
def extract_token_from_header(authorization: str) -> Optional[str]
```
- Parses "Bearer <token>" from Authorization header

#### 4. Password Utilities (`src/utils/password.py`)
```python
def hash_password(password: str) -> str
```
- Uses passlib with bcrypt backend
- Automatically handles salt generation

```python
def verify_password(plain_password: str, hashed_password: str) -> bool
```
- Secure password comparison

#### 5. Redis Session Manager (`src/utils/redis_session.py`)
- Stores JWT tokens in Redis with 30-day TTL
- Fallback in-memory storage if Redis unavailable
- Key format: `session:{user_id}:{token_prefix}`
- Supports:
  - `store_token()`: Store new session token
  - `get_token()`: Retrieve token (checks expiry)
  - `revoke_token()`: Delete specific token
  - `revoke_all_user_tokens()`: Logout all sessions

#### 6. Authentication Middleware (`src/middleware/auth.py`)
```python
async def verify_user_auth(request: Request) -> dict
```
- Dependency for protected routes
- Extracts and validates JWT from Authorization header
- Verifies token not revoked in Redis
- Raises 401 on invalid/expired tokens

```python
def get_current_user_id(payload: dict) -> UUID
```
- Helper to extract user_id from token payload

#### 7. User Service (`src/services/user_service.py`)
- **CRUD Operations**:
  - `create_user()`: Register new user, checks uniqueness, hashes password
  - `get_user_by_email()`: Lookup by email
  - `get_user_by_id()`: Lookup by UUID
  - `get_user_by_password()`: Combined lookup and verification
  - `update_user()`: Partial updates
  - `delete_user()`: Soft delete (sets is_active=False)

- **Helpers**:
  - `verify_password()`: Authenticate credentials
  - `to_schema()`: Convert ORM to Pydantic model

#### 8. Authentication Routes (`src/api/auth.py`)

**POST /auth/signup** (201 Created)
```json
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password": "securepassword123"
}
```
Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2026-10-25T12:34:56Z",
    "is_active": true
  }
}
```

**POST /auth/login** (200 OK)
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```
Returns same format as signup response.

**GET /auth/profile** (200 OK)
- Requires: `Authorization: Bearer <token>`
- Returns user profile data

**POST /auth/logout** (200 OK)
- Requires: `Authorization: Bearer <token>`
- Revokes all tokens for the user

## Security Features

### Password Security
- Bcrypt hashing with automatic salt generation
- Minimum 8-character requirement (enforced at API level)
- Never stored in plain text
- Compared using constant-time verification

### JWT Security
- HS256 algorithm with SECRET_KEY
- 30-day expiration time (configurable via TOKEN_EXPIRY_DAYS)
- Includes user_id and email in payload
- Can be revoked via Redis session manager

### Token Revocation
- All tokens stored in Redis with TTL
- Token not found in Redis = session invalidated
- Logout revokes all user tokens immediately
- Supports password reset flow (revoke all tokens)

### Email Validation
- Uses Pydantic's EmailStr for validation
- Prevents invalid email addresses
- Enforces uniqueness at database level

### Protected Routes
- All routes requiring auth use `verify_user_auth` dependency
- Returns 401 if missing/invalid/revoked
- Includes WWW-Authenticate header for clients

## Environment Configuration

### Required Environment Variables
```bash
# JWT Secret (CHANGE IN PRODUCTION!)
SECRET_KEY=your-super-secret-key-change-this-in-production

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/carddb
# or SQLite for development:
DATABASE_URL=sqlite+aiosqlite:///./test.db

# Redis
REDIS_URL=redis://localhost:6379

# Frontend Origin (CORS)
ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
```

### Optional Environment Variables
```bash
SQL_ECHO=False  # Set True for SQL debugging
```

See `.env.example` for complete list.

## Setup & Installation

### 1. Install Dependencies
```bash
cd apps/backend

# With uv
uv sync

# OR with pip
pip install -e ".[dev]"
```

### 2. Set Environment Variables
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Initialize Database
```bash
# Database tables created automatically on app startup via init_db()
# Or manually:
python -c "import asyncio; from src.db.database import init_db; asyncio.run(init_db())"
```

### 4. Run Development Server
```bash
uvicorn src.api.main:app --reload
```

API available at `http://localhost:8000`

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

### Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePassword123"
  }'
```

### Get Profile
```bash
curl -X GET http://localhost:8000/auth/profile \
  -H "Authorization: Bearer <your_access_token>"
```

### Logout
```bash
curl -X POST http://localhost:8000/auth/logout \
  -H "Authorization: Bearer <your_access_token>"
```

## Testing

Run all tests:
```bash
pytest
```

Run auth tests only:
```bash
pytest tests/test_auth.py -v
```

Run with coverage:
```bash
pytest --cov=src tests/
```

### Test Fixtures
- `test_db`: In-memory SQLite database
- `client`: FastAPI TestClient
- `test_user_data`: Sample user credentials

### Test Coverage
- User signup (success, duplicate email, validation)
- Login (success, invalid credentials, nonexistent user)
- Profile access (with/without token, invalid token)
- Logout (success, without token)
- Token structure and claims
- Authorization header parsing

## File Structure
```
apps/backend/
├── src/
│   ├── api/
│   │   ├── main.py          # FastAPI app, routes
│   │   ├── auth.py          # Auth endpoints (NEW)
│   │   └── __init__.py
│   ├── db/
│   │   ├── database.py      # DB config, session manager
│   │   ├── models.py        # SQLAlchemy ORM models (NEW)
│   │   └── __init__.py
│   ├── middleware/
│   │   ├── auth.py          # Auth dependency/middleware (NEW)
│   │   └── __init__.py      # (NEW)
│   ├── models/
│   │   └── __init__.py      # Pydantic schemas (UPDATED)
│   ├── services/
│   │   ├── user_service.py  # User CRUD (NEW)
│   │   └── card_service.py
│   └── utils/
│       ├── jwt_handler.py   # JWT utilities (NEW)
│       ├── password.py      # Password hashing (NEW)
│       ├── redis_session.py # Session management (NEW)
│       └── __init__.py      # (NEW)
├── tests/
│   ├── test_auth.py         # Auth endpoint tests (NEW)
│   ├── test_api.py
│   ├── conftest.py          # Test fixtures (UPDATED)
│   └── __init__.py
├── .env.example             # Environment template (NEW)
├── pyproject.toml           # Dependencies (UPDATED)
└── AUTH_IMPLEMENTATION.md   # This file (NEW)
```

## Next Steps

### Phase 1 (Current)
- ✅ User model with database
- ✅ CRUD operations
- ✅ JWT authentication
- ✅ Redis session management
- ✅ Authentication middleware
- ✅ Login/signup endpoints
- ✅ Tests

### Phase 2
- [ ] Password reset endpoint
- [ ] Email verification
- [ ] Role-based access control (RBAC)
- [ ] Refresh token mechanism
- [ ] Rate limiting on auth endpoints
- [ ] Audit logging

### Phase 3
- [ ] OAuth2 social login
- [ ] Two-factor authentication
- [ ] API key authentication for service-to-service
- [ ] Session management UI
- [ ] Security headers & CSRF protection

## Troubleshooting

### Redis Connection Fails
- Falls back to in-memory storage automatically
- Check Redis URL in environment: `REDIS_URL=redis://localhost:6379`
- Start Redis: `redis-server` or via Docker

### Database Connection Fails
- For PostgreSQL: Ensure server is running and DATABASE_URL is correct
- For SQLite: Check file permissions in working directory
- Set `SQL_ECHO=True` to see SQL statements

### Invalid Token Errors
- Tokens expire after 30 days
- Logout revokes all tokens immediately
- Check SECRET_KEY hasn't changed
- Verify Authorization header format: `Bearer <token>`

### Email Validation Fails
- Ensure email format is valid (RFC 5322)
- No spaces before/after email
- Pydantic EmailStr is strict by design

## Production Checklist

- [ ] Change `SECRET_KEY` to strong random value
- [ ] Use PostgreSQL with SSL/TLS
- [ ] Enable Redis persistence
- [ ] Set `ALLOWED_ORIGINS` to specific domains
- [ ] Enable HTTPS in reverse proxy
- [ ] Configure rate limiting
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Audit user access and token generation
- [ ] Rotate secrets regularly
- [ ] Enable database backups
- [ ] Set up intrusion detection
- [ ] Review and update password requirements
