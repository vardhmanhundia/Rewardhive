# Card Agent App - Technical Specification

**Version:** 0.1.0  
**Last Updated:** 2026-10-11  
**Status:** Draft

---

## 1. Overview

**Card Agent App** is a full-stack application for managing cards (information containers) with AI-powered agent workflows. The system combines:

- **FastAPI backend** with async processing and LangGraph-based agent orchestration
- **React frontend** with TypeScript for type-safe client code
- **PostgreSQL + Redis** for persistent storage and caching
- **LLM integration** (OpenAI/Anthropic) for intelligent card processing and analysis

The core feature: Users create, organize, and interact with cards through both direct API calls and AI agent workflows that can analyze, categorize, and suggest improvements to card content.

---

## 2. Technical Architecture

### 2.1 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| API Framework | FastAPI | ≥0.104.0 |
| Agent Orchestration | LangGraph | ≥0.0.1 |
| Web Server | Uvicorn | ≥0.24.0 |
| ORM | SQLAlchemy | ≥2.0.0 |
| Database | PostgreSQL | 14+ |
| Cache | Redis | ≥5.0.0 |
| Backend Language | Python | ≥3.13 |
| Frontend Framework | React | 18+ |
| Frontend Language | TypeScript | 5+ |
| Build Tool | Vite | Latest |
| Package Manager | uv (backend) | Latest |

### 2.2 Architecture Layers

```
┌─────────────────────────────────────────┐
│         React Frontend (SPA)             │
│     (TypeScript, Vite, fetch API)       │
└──────────────────┬──────────────────────┘
                   │ HTTP/REST
┌──────────────────▼──────────────────────┐
│      FastAPI Application (Port 8000)    │
├──────────────────────────────────────────┤
│  Route Handlers (src/api/main.py)       │
├──────────────────────────────────────────┤
│  Services Layer (src/services/)         │
│  - CardService (CRUD, validation)       │
│  - AgentService (workflow execution)    │
├──────────────────────────────────────────┤
│  LangGraph Agent Workflows (src/agents/)│
│  - StateGraph for agent state mgmt      │
│  - LLM tool bindings                    │
├──────────────────────────────────────────┤
│  Data Layer (src/db/, src/models/)      │
│  - SQLAlchemy async ORM                 │
│  - Pydantic request/response models     │
├──────────────────────────────────────────┤
│  External Services                      │
│  ├─ PostgreSQL Database                │
│  ├─ Redis Cache                        │
│  └─ LLM APIs (OpenAI/Anthropic)        │
└──────────────────────────────────────────┘
```

### 2.3 Key Constraints

- **All endpoints must be async** (`async def`) to prevent blocking the event loop
- **Database queries must use async sessions** from SQLAlchemy async ORM
- **LangGraph graphs must be compiled** before execution; no inline modifications
- **CORS restricted in production** to specific frontend domains
- **All API responses wrapped** in standardized response envelope
- **Request body size limit**: 10MB (FastAPI default)
- **Database connection pool size**: Configured per environment (default 5)

---

## 3. Data Models

### 3.1 Card Model

**Entity:** Card  
**Database Table:** `cards`  
**Purpose:** Core data container for user content

#### Attributes

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier (UUID v4) |
| `title` | String | NOT NULL, max 200 chars | Card title/heading |
| `content` | Text | NOT NULL, max 50,000 chars | Card body content (Markdown-compatible) |
| `description` | String | Optional, max 500 chars | Brief summary of card purpose |
| `category` | String | Optional, max 50 chars | User-defined category tag |
| `tags` | JSON Array | Optional | Flexible tagging: `["ai", "important"]` |
| `status` | Enum | Default: `draft` | One of: `draft`, `active`, `archived` |
| `is_public` | Boolean | Default: false | Public visibility flag |
| `created_at` | DateTime | Auto-set, NOT NULL | UTC timestamp of creation |
| `updated_at` | DateTime | Auto-set, NOT NULL | UTC timestamp of last modification |
| `created_by_user_id` | String | NOT NULL (v2) | Link to user who created card |
| `metadata` | JSON | Optional | Extensible field for future properties |

#### Pydantic Schema

```python
class CardSchema(BaseModel):
    id: str
    title: str
    content: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Literal["draft", "active", "archived"] = "draft"
    is_public: bool = False
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class CardCreateRequest(BaseModel):
    title: str  # min 1, max 200
    content: str  # min 1, max 50,000
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: bool = False

class CardUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[Literal["draft", "active", "archived"]] = None
    is_public: Optional[bool] = None
```

### 3.2 Agent Execution Model

**Entity:** Agent  
**Purpose:** Tracks AI agent workflow executions on cards

#### Attributes

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Execution ID |
| `card_id` | UUID | FK → cards.id | Card being processed |
| `workflow_type` | String | NOT NULL | Type of workflow (e.g., "analyze", "categorize") |
| `status` | Enum | Default: `pending` | One of: `pending`, `running`, `completed`, `failed` |
| `result` | JSON | Nullable | Agent output/suggestions |
| `error_message` | Text | Nullable | Error details if failed |
| `tokens_used` | Integer | Nullable | LLM tokens consumed |
| `execution_time_ms` | Integer | Nullable | Time taken (milliseconds) |
| `created_at` | DateTime | Auto-set | Start time |
| `updated_at` | DateTime | Auto-set | Last state change |

#### Pydantic Schema

```python
class AgentExecutionSchema(BaseModel):
    id: str
    card_id: str
    workflow_type: str
    status: Literal["pending", "running", "completed", "failed"]
    result: Optional[dict] = None
    error_message: Optional[str] = None
    tokens_used: Optional[int] = None
    execution_time_ms: Optional[int] = None
    created_at: datetime
    updated_at: datetime
```

### 3.3 LangGraph State Model

**Purpose:** Encapsulates agent workflow state in LangGraph StateGraph

```python
# State passed between graph nodes
CardAgentState = TypedDict(
    "CardAgentState",
    {
        "card": dict,  # Current card data
        "original_content": str,  # Original card content
        "analysis_results": dict,  # LLM analysis output
        "suggestions": list,  # Suggested improvements
        "user_feedback": str,  # Optional user feedback
        "execution_steps": list,  # Audit trail of graph execution
        "error": Optional[str],  # Error message if any
    }
)
```

---

## 4. API Specification

### 4.1 Base URL
- **Development:** `http://localhost:8000`
- **Production:** `https://api.cardagent.example.com`

### 4.2 Response Envelope

All API responses follow a standardized format:

```json
{
  "success": boolean,
  "data": T | null,
  "error": {
    "code": string,
    "message": string,
    "details": object | null
  } | null,
  "meta": {
    "timestamp": "2026-10-11T12:34:56Z",
    "request_id": "uuid-string"
  }
}
```

### 4.3 Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET, successful PUT/PATCH |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request body or query params |
| 401 | Unauthorized | Missing/invalid authentication (future) |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource state conflict (e.g., duplicate creation) |
| 422 | Unprocessable Entity | Validation error on request data |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled exception |
| 503 | Service Unavailable | Database/Redis unavailable |

### 4.4 Endpoints

#### 4.4.1 Health Check

```
GET /health
```

**Purpose:** Verify API is running and dependencies are healthy

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "0.1.0",
    "dependencies": {
      "database": "connected",
      "redis": "connected"
    }
  },
  "meta": {
    "timestamp": "2026-10-11T12:34:56Z",
    "request_id": "abc-123"
  }
}
```

**Error Scenarios:**
- If database unreachable → 503 with `database: disconnected`
- If Redis unreachable → 503 with `redis: disconnected`

---

#### 4.4.2 Get All Cards

```
GET /cards?status=active&limit=50&offset=0&sort=created_at:desc
```

**Query Parameters:**
- `status` (optional): Filter by status (`draft`, `active`, `archived`)
- `category` (optional): Filter by category
- `tags` (optional): Comma-separated tags (AND logic)
- `limit` (optional, default 50, max 1000): Pagination limit
- `offset` (optional, default 0): Pagination offset
- `sort` (optional, default `created_at:desc`): Sort by field and direction

**Response (200):**
```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "AI Agent Architecture",
        "content": "...",
        "status": "active",
        "created_at": "2026-10-11T12:00:00Z",
        "updated_at": "2026-10-11T12:00:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "has_more": true
    }
  }
}
```

**Error Scenarios:**
- Invalid `limit` value (>1000) → 400
- Invalid `sort` field → 400
- Database error → 500

---

#### 4.4.3 Create Card

```
POST /cards
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "My New Card",
  "content": "Card content here...",
  "description": "Optional summary",
  "category": "work",
  "tags": ["urgent", "review"],
  "is_public": false
}
```

**Validation Rules:**
- `title`: Required, 1-200 characters, no leading/trailing whitespace
- `content`: Required, 1-50,000 characters
- `description`: Optional, 0-500 characters
- `category`: Optional, alphanumeric + hyphen, max 50 chars
- `tags`: Optional array, max 20 items, each 1-50 chars
- `is_public`: Optional boolean, default false

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "My New Card",
    "content": "Card content here...",
    "status": "draft",
    "created_at": "2026-10-11T12:34:56Z",
    "updated_at": "2026-10-11T12:34:56Z"
  }
}
```

**Error Scenarios:**
- Missing required fields → 422 with validation details
- `title` exceeds 200 chars → 422
- `content` exceeds 50,000 chars → 422
- Duplicate title (future uniqueness constraint) → 409
- Request body exceeds 10MB → 413

---

#### 4.4.4 Get Card by ID

```
GET /cards/{id}
```

**Path Parameters:**
- `id` (UUID): Card ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "My Card",
    "content": "...",
    "status": "active",
    "created_at": "2026-10-11T12:34:56Z",
    "updated_at": "2026-10-11T12:34:56Z"
  }
}
```

**Error Scenarios:**
- Card not found → 404
- Invalid UUID format → 400
- Database error → 500

---

#### 4.4.5 Update Card

```
PUT /cards/{id}
PATCH /cards/{id}
Content-Type: application/json
```

**PUT vs PATCH:**
- **PUT**: Replace entire card (all fields required)
- **PATCH**: Partial update (only provided fields updated)

**Request Body (PATCH):**
```json
{
  "title": "Updated Title",
  "status": "active",
  "tags": ["new-tag"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Updated Title",
    "status": "active",
    "updated_at": "2026-10-11T12:45:00Z"
  }
}
```

**Error Scenarios:**
- Card not found → 404
- Invalid status value → 422
- Concurrent modification (optimistic lock via `updated_at`) → 409
- Validation failure → 422

---

#### 4.4.6 Delete Card

```
DELETE /cards/{id}
```

**Response (204):** Empty body, no JSON response

**Error Scenarios:**
- Card not found → 404
- Card in use by agent workflow → 409 with message
- Database error → 500

---

#### 4.4.7 Run Agent Workflow on Card

```
POST /cards/{id}/analyze
Content-Type: application/json
```

**Request Body:**
```json
{
  "workflow_type": "analyze",
  "options": {
    "include_suggestions": true,
    "depth": "detailed"
  }
}
```

**Response (202 Accepted):** Asynchronous processing
```json
{
  "success": true,
  "data": {
    "execution_id": "exec-uuid",
    "card_id": "550e8400-e29b-41d4-a716-446655440000",
    "workflow_type": "analyze",
    "status": "pending",
    "created_at": "2026-10-11T12:50:00Z"
  }
}
```

**Polling for Results:**
```
GET /cards/{id}/analyze/{execution_id}
```

**Response (200 - completed):**
```json
{
  "success": true,
  "data": {
    "execution_id": "exec-uuid",
    "status": "completed",
    "result": {
      "summary": "Card is well-structured",
      "suggestions": [
        "Consider adding examples",
        "Clarify the scope"
      ],
      "quality_score": 8.5
    },
    "tokens_used": 450,
    "execution_time_ms": 3200
  }
}
```

**Response (200 - still running):**
```json
{
  "success": true,
  "data": {
    "status": "running",
    "estimated_completion_ms": 2000
  }
}
```

**Response (200 - failed):**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "EXECUTION_FAILED",
    "message": "Agent workflow failed",
    "details": {
      "execution_id": "exec-uuid",
      "error_message": "LLM API timeout after 30s"
    }
  }
}
```

**Error Scenarios:**
- Card not found → 404
- Invalid workflow type → 400
- LLM API key invalid → 500
- LLM rate limit hit → 429

---

## 5. Edge Cases & Error Handling

### 5.1 Concurrency

| Scenario | Behavior | Handling |
|----------|----------|----------|
| Two concurrent PATCH requests same card | Last write wins (no locking) | Use `updated_at` for optimistic lock (v2) |
| Delete card while agent analyzing | Delete fails with 409 | Cascade delete executions or block deletion |
| Multiple cards with identical title | Allowed (no unique constraint) | Application-level deduplication if needed |
| Agent execution exceeds timeout (30s) | Marked as failed | Return 200 with error in result |

### 5.2 Input Validation

| Field | Validation | Violation Response |
|-------|-----------|-------------------|
| `title` | No HTML/script tags | Sanitize or reject with 422 |
| `content` | Allow Markdown + HTML (v2) | Sanitize before storage |
| `tags` | Alphanumeric + hyphen | Reject with 422 |
| `created_at` format | ISO 8601 UTC | Reject with 400 |
| Request size | Max 10MB | Reject with 413 |

### 5.3 State Transitions

**Card Status Workflow:**
```
draft → active → archived
  ↑________________↓
```
- **draft → active**: Published/ready
- **active → archived**: Deprecated/removed
- **archived → active**: Can un-archive (v2)
- **Deletion**: Any state → deleted (soft delete optional)

**Agent Execution Status Workflow:**
```
pending → running → completed
              ↓
            failed
```
- **pending → running**: Automatic after queue pickup
- **running → completed**: On success
- **running → failed**: On error/timeout
- **No retries** by default (v2: add retry policy)

### 5.4 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /cards` | 100 requests | Per minute |
| `POST /cards/{id}/analyze` | 10 requests | Per minute |
| `GET /cards` | 1000 requests | Per minute |
| Global | 10,000 requests | Per minute |

**Exceeded Response (429):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 100,
      "reset_at": "2026-10-11T12:35:00Z",
      "retry_after_seconds": 60
    }
  }
}
```

### 5.5 Database Failures

| Failure | Impact | Mitigation |
|---------|--------|-----------|
| Connection pool exhausted | 503 | Exponential backoff, queue requests |
| Primary database down | 503 | Failover to read replica (production) |
| Transaction deadlock | Retry with backoff | SQLAlchemy handles automatically |
| Disk full | 500 | Monitoring + alerts |
| Network timeout | Retry with backoff | Default 30s timeout |

### 5.6 LLM Integration Failures

| Scenario | Response | Behavior |
|----------|----------|----------|
| API key invalid | 500 | Agent execution marked failed |
| Rate limit hit | 429 | Backoff + queue for retry (v2) |
| Timeout (30s) | 504 | Execution marked failed, no data loss |
| Model not found | 500 | Agent execution marked failed |
| Hallucinated output | Depends | Result returned as-is (user reviews) |

### 5.7 Pagination Edge Cases

| Scenario | Behavior |
|----------|----------|
| `offset` > total records | Return empty list with `has_more: false` |
| `limit` = 0 | Reject with 400 (min 1) |
| `limit` > 1000 | Reject with 400 or cap at 1000 |
| Negative `offset` | Treat as 0 or reject with 400 |
| No records match filter | Return empty array, valid response |

---

## 6. Security Considerations

### 6.1 Authentication & Authorization (v2)

- **JWT tokens** for API authentication
- **Bearer token** scheme: `Authorization: Bearer <token>`
- **Scopes**: `read:cards`, `write:cards`, `admin`
- **User ID isolation**: Each user only sees own cards

### 6.2 Input Security

- **SQL injection**: Protected by SQLAlchemy ORM parameterized queries
- **XSS prevention**: Sanitize user content before frontend rendering
- **CSRF**: Use SameSite cookies (when cookies added in v2)

### 6.3 Data Privacy

- `is_public` flag controls visibility
- Private cards not exposed in list endpoints without auth (v2)
- Card content stored encrypted at rest (v2)
- User activity logged for audit (v2)

### 6.4 API Key Management

- LLM API keys stored in environment variables only
- Never logged or returned to client
- Rotate API keys if leaked (runbook)

---

## 7. Performance Requirements

### 7.1 Latency Targets (p95)

| Operation | Target |
|-----------|--------|
| GET /cards | 200ms |
| GET /cards/{id} | 100ms |
| POST /cards | 300ms |
| PATCH /cards/{id} | 300ms |
| DELETE /cards/{id} | 150ms |
| Agent workflow analysis | 5-30s (async) |

### 7.2 Throughput

- **Concurrent connections**: 500+ (Uvicorn workers)
- **Requests per second**: 1,000+ (peak)
- **Database queries**: Sub-100ms with indexing

### 7.3 Caching Strategy

- **Redis cache**: Recent cards (TTL: 5 min)
- **Client-side cache**: React query with 60s stale time
- **ETag support** (future): Conditional requests with `If-None-Match`

---

## 8. Future Enhancements (v2+)

- [ ] User authentication (JWT)
- [ ] Card sharing & collaboration
- [ ] Real-time updates (WebSocket)
- [ ] Card version history
- [ ] Advanced agent workflows (multi-step)
- [ ] Integration with external tools (Slack, email)
- [ ] File attachments to cards
- [ ] Full-text search
- [ ] Card templates
- [ ] Analytics dashboard

---

## 9. Testing Strategy

### 9.1 Unit Tests

- Service layer logic (CardService)
- Pydantic model validation
- Utility functions
- **Target coverage**: 80%+

### 9.2 Integration Tests

- Full API endpoint flows
- Database operations
- Agent workflow execution (mocked LLM)
- **Command**: `pytest --cov=src tests/`

### 9.3 End-to-End Tests

- Frontend + Backend full flow
- Real LLM calls (separate test suite)
- Load testing (k6, locust)

---

## 10. Deployment

### 10.1 Environments

| Environment | Database | Cache | LLM Provider |
|-------------|----------|-------|-------------|
| Development | SQLite | In-memory | Mocked |
| Staging | PostgreSQL | Redis | OpenAI (test key) |
| Production | PostgreSQL HA | Redis Cluster | OpenAI (prod key) |

### 10.2 Docker Deployment

```bash
docker-compose up --build
```

Starts all services: API, DB, Redis, Frontend

### 10.3 Environment Variables

See `.env.example` for full list. Key variables:

```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/carddb
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
LANGCHAIN_API_KEY=ls_...
```

---

## 11. Monitoring & Observability

### 11.1 Metrics

- Request latency (p50, p95, p99)
- Error rate by endpoint
- Database query time
- LLM token usage
- Agent execution success rate

### 11.2 Logging

- Structured JSON logging
- Correlation ID on all requests
- Error stack traces
- Agent execution traces

### 11.3 Alerts

- API response time > 1s → Warning
- Error rate > 5% → Critical
- Database connection pool exhausted → Critical
- LLM API unavailable → Critical

---

**Document End**
