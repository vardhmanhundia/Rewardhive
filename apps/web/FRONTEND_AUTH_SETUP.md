# Frontend Authentication Setup Guide

This guide covers the React + TypeScript frontend for user authentication in the Card Agent application.

## Overview

The frontend includes:
- ✅ User signup page with validation
- ✅ User login page
- ✅ User profile page showing account details
- ✅ Authentication context for state management
- ✅ Protected routes (requires authentication)
- ✅ Token-based authentication (JWT)
- ✅ Persistent authentication (localStorage)
- ✅ E2E integration with backend

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **React Router v6** - Client-side routing
- **Vite** - Build tool
- **Context API** - State management

## Project Structure

```
apps/web/
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx           # Landing page
│   │   ├── SignupPage.tsx         # User registration
│   │   ├── LoginPage.tsx          # User login
│   │   └── ProfilePage.tsx        # User profile (protected)
│   ├── components/
│   │   ├── FormField.tsx          # Reusable form input
│   │   └── ProtectedRoute.tsx     # Route protection wrapper
│   ├── context/
│   │   └── AuthContext.tsx        # Authentication state
│   ├── services/
│   │   └── authService.ts         # Backend API calls
│   ├── App.tsx                    # Main app with routing
│   ├── main.tsx                   # Entry point
│   └── vite-env.d.ts              # Vite types
├── index.html                     # HTML entry point
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript config
├── package.json                   # Dependencies
├── .env.local                     # Local environment vars
├── .env.example                   # Environment template
└── FRONTEND_AUTH_SETUP.md         # This file
```

## Installation & Setup

### 1. Install Dependencies

```bash
cd apps/web
npm install
```

This installs:
- `react` - UI framework
- `react-dom` - DOM rendering
- `react-router-dom` - Routing
- `typescript` - Type checking
- `vite` - Build tool

### 2. Configure Environment Variables

```bash
# Create .env.local from example
cp .env.example .env.local

# Edit .env.local (usually already set)
VITE_API_URL=http://localhost:8000
```

### 3. Start Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

**Frontend is now running and ready to connect to the backend!**

## Pages & Features

### 1. Home Page (`/`)
- Landing page with welcome message
- Links to login and signup
- Feature overview

### 2. Signup Page (`/signup`)
**Features:**
- Email validation
- Password strength validation (min 8 chars)
- Password confirmation
- First/last name fields
- Error handling and display
- Link to login page

**Form Validation:**
- Email: Required, valid format
- First Name: Required, non-empty
- Last Name: Required, non-empty
- Password: Required, min 8 characters
- Confirm Password: Must match password

### 3. Login Page (`/login`)
**Features:**
- Email validation
- Password entry
- Error handling
- Link to signup page
- Remember me capability (future)

### 4. Profile Page (`/profile`) - Protected
**Features:**
- Displays user information:
  - First & last name
  - Email address
  - User ID
  - Account status
  - Member since date
- JSON view of full user data
- Logout button
- Requires authentication (redirects to login if not authenticated)

## Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────┐
│          Frontend Components                │
│  ┌───────────────┐  ┌───────────────────┐  │
│  │  Pages        │  │  ProtectedRoute   │  │
│  │  - Signup     │  │  - Checks auth    │  │
│  │  - Login      │  │  - Redirects      │  │
│  │  - Profile    │  │                   │  │
│  └───────────────┘  └───────────────────┘  │
└──────────────────────┬──────────────────────┘
                       │ uses
┌──────────────────────▼──────────────────────┐
│      AuthContext + useAuth Hook             │
│  ┌────────────────────────────────────────┐ │
│  │ State:                                 │ │
│  │ - user: UserProfile | null            │ │
│  │ - isAuthenticated: boolean             │ │
│  │ - isLoading: boolean                   │ │
│  │ - error: string | null                 │ │
│  │                                        │ │
│  │ Methods:                               │ │
│  │ - login()  - Authenticate user         │ │
│  │ - signup() - Register new user         │ │
│  │ - logout() - Clear session             │ │
│  │ - clearError() - Reset error state     │ │
│  └────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────┘
                       │ calls
┌──────────────────────▼──────────────────────┐
│        AuthService (API Client)             │
│  ┌────────────────────────────────────────┐ │
│  │ Methods:                               │ │
│  │ - signup(data) → AuthResponse          │ │
│  │ - login(data) → AuthResponse           │ │
│  │ - getProfile() → UserProfile           │ │
│  │ - logout() → void                      │ │
│  │                                        │ │
│  │ Token Management:                      │ │
│  │ - getToken() - Retrieve from storage   │ │
│  │ - setToken() - Store in localStorage   │ │
│  │ - clearToken() - Remove from storage   │ │
│  │ - isAuthenticated() - Check token      │ │
│  └────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────┘
                       │ HTTP calls
┌──────────────────────▼──────────────────────┐
│      Backend API (FastAPI)                  │
│  POST   /auth/signup                        │
│  POST   /auth/login                         │
│  GET    /auth/profile                       │
│  POST   /auth/logout                        │
└─────────────────────────────────────────────┘
```

### Token Storage

Tokens are stored in browser's `localStorage`:
- Key: `auth_token`
- Value: JWT token string
- Persists across browser sessions
- Cleared on logout

### Protected Routes

The `<ProtectedRoute>` component:
1. Checks if user is authenticated
2. If authenticated → renders component
3. If not authenticated → redirects to `/login`
4. Shows loading state while checking auth

## Authentication Flow (Step-by-Step)

### Sign Up Flow
```
1. User fills signup form
2. Form validation runs
3. User clicks "Sign Up"
4. authService.signup() called
5. Backend creates user
6. Backend returns JWT token + user data
7. Token stored in localStorage
8. AuthContext updated with user data
9. Redirect to /profile
10. Profile page shows user details
```

### Login Flow
```
1. User fills login form
2. Form validation runs
3. User clicks "Log In"
4. authService.login() called
5. Backend validates credentials
6. Backend returns JWT token + user data
7. Token stored in localStorage
8. AuthContext updated with user data
9. Redirect to /profile
10. Profile page shows user details
```

### Accessing Protected Routes
```
1. User navigates to /profile
2. ProtectedRoute checks isAuthenticated
3. If authenticated → show ProfilePage
4. If not authenticated → redirect to /login
5. AuthContext fetches profile on app load
6. Profile data displayed in ProfilePage
```

### Logout Flow
```
1. User clicks "Logout" button
2. authService.logout() called
3. Backend revokes token (optional)
4. Token removed from localStorage
5. AuthContext cleared
6. Redirect to /login
7. useAuth hook will return isAuthenticated: false
```

## Key Components

### AuthContext (`src/context/AuthContext.tsx`)

Provides authentication state and methods:

```typescript
// Use in any component
const { user, isAuthenticated, login, signup, logout } = useAuth();

// Methods
await login(email, password);
await signup(email, firstName, lastName, password);
await logout();

// State
console.log(user); // UserProfile | null
console.log(isAuthenticated); // boolean
console.log(isLoading); // boolean
console.log(error); // string | null
```

### AuthService (`src/services/authService.ts`)

API client for backend communication:

```typescript
// Sign up
const response = await authService.signup({
  email: 'user@example.com',
  first_name: 'John',
  last_name: 'Doe',
  password: 'Password123',
});

// Login
const response = await authService.login({
  email: 'user@example.com',
  password: 'Password123',
});

// Get profile
const profile = await authService.getProfile();

// Logout
await authService.logout();
```

### ProtectedRoute (`src/components/ProtectedRoute.tsx`)

Wrapper for routes requiring authentication:

```typescript
<Route
  path="/profile"
  element={
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  }
/>
```

### FormField (`src/components/FormField.tsx`)

Reusable form input component:

```typescript
<FormField
  label="Email"
  type="email"
  name="email"
  value={email}
  onChange={handleChange}
  placeholder="you@example.com"
  required
  error={errors.email}
/>
```

## API Integration

The frontend communicates with backend via HTTP:

### Environment Variable
```
VITE_API_URL=http://localhost:8000
```

### API Endpoints Used

```
POST   /auth/signup       → Create new user
POST   /auth/login        → Authenticate user
GET    /auth/profile      → Get current user
POST   /auth/logout       → Revoke token
```

### Request Format

All requests include:
- `Content-Type: application/json`
- Authorization header (for protected routes): `Authorization: Bearer <token>`

### Response Format

Success response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1Q...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2026-10-25T...",
    "is_active": true
  }
}
```

Error response:
```json
{
  "detail": "Invalid email or password"
}
```

## Development

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Type Checking
```bash
# TypeScript compiler checks types during build
npm run build
```

## File Descriptions

### Pages

| File | Purpose |
|------|---------|
| `HomePage.tsx` | Landing page, welcome message, links |
| `SignupPage.tsx` | User registration form with validation |
| `LoginPage.tsx` | User login form |
| `ProfilePage.tsx` | Display user information (protected) |

### Components

| File | Purpose |
|------|---------|
| `ProtectedRoute.tsx` | Wrapper for authenticated-only routes |
| `FormField.tsx` | Reusable form input component |

### Services

| File | Purpose |
|------|---------|
| `authService.ts` | API client for auth endpoints |

### Context

| File | Purpose |
|------|---------|
| `AuthContext.tsx` | Global auth state management |

## Error Handling

### Form Validation Errors
- Displayed below each field
- Real-time validation as user types
- Prevents submission if invalid

### API Errors
- Caught and displayed to user
- Set in context error state
- Shown in error message box

### Types of Errors

1. **Validation Errors** (422)
   - Invalid email format
   - Password too short
   - Required field missing

2. **Authentication Errors** (401)
   - Invalid credentials
   - Token expired
   - User not found

3. **Conflict Errors** (409)
   - Email already exists
   - User already registered

4. **Server Errors** (5xx)
   - Backend unavailable
   - Database connection error

## Styling

- **Inline styles** using React CSSProperties
- **Responsive design** with flexbox/grid
- **Color scheme**:
  - Primary: #007bff (blue)
  - Danger: #dc3545 (red)
  - Success: #28a745 (green)
  - Background: #f5f5f5 (light gray)

## Security Considerations

### ✅ Implemented
- JWT token storage in localStorage
- Bearer token in Authorization header
- Token validation on requests
- Automatic logout on token expiry
- Password minimum length enforcement
- Email validation
- Protected routes via ProtectedRoute component

### 🔄 Recommended for Production
- HTTPS/TLS only
- Secure cookies instead of localStorage
- Token refresh mechanism
- CSRF protection
- Rate limiting
- Input sanitization
- Content Security Policy headers
- Clickjacking protection

## Testing E2E

### Manual Testing

1. **Start Backend**
   ```bash
   cd apps/backend
   uvicorn src.api.main:app --reload
   ```

2. **Start Frontend**
   ```bash
   cd apps/web
   npm run dev
   ```

3. **Test Signup**
   - Go to http://localhost:3000
   - Click "Sign Up"
   - Fill form with test data
   - Submit
   - Should see profile page

4. **Test Login**
   - Click "Logout"
   - Click "Log In"
   - Enter credentials
   - Submit
   - Should see profile page

5. **Test Protected Route**
   - Go to http://localhost:3000/profile directly
   - Should redirect to login if not authenticated
   - Login first, then access /profile

### Automated Testing (Future)

```bash
# Setup Vitest/Jest for unit tests
npm install --save-dev vitest @testing-library/react

# Run tests
npm run test
```

## Troubleshooting

### Backend Not Responding
- Check if backend is running: `uvicorn src.api.main:app --reload`
- Check `VITE_API_URL` is correct
- Check CORS settings in backend

### Token Not Persisting
- Check if localStorage is enabled in browser
- Check browser console for errors
- Clear localStorage and try again

### Pages Not Loading
- Check browser console for errors
- Verify all imports in App.tsx
- Check routing in App.tsx

### API Calls Failing
- Check network tab in browser DevTools
- Check backend logs for errors
- Verify API_URL in authService.ts

### Type Errors
- Run TypeScript compiler: `npx tsc --noEmit`
- Check tsconfig.json
- Ensure all imports are correct

## Docker Deployment

### Development with Docker Compose

```bash
docker-compose up --build
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Frontend Docker Build

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## Performance Optimization

- **Code splitting** via React Router
- **Lazy loading** for page components
- **Minimal re-renders** with proper dependency arrays
- **Token caching** in localStorage

## Next Steps

### Phase 1 (Current) ✅
- Signup page
- Login page
- Profile page
- Authentication context
- Protected routes

### Phase 2 (Upcoming)
- Password reset flow
- Email verification
- Remember me functionality
- User settings page
- Update profile endpoint

### Phase 3 (Future)
- Card management UI
- Card creation/editing
- Agent workflow UI
- Dashboard
- Search & filtering

## Resources

- [React Documentation](https://react.dev)
- [React Router v6 Guide](https://reactrouter.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev)
- [Frontend API Integration](./src/services/authService.ts)
