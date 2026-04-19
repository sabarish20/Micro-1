# ShopNative — Cloud-Native Microservices Bookstore

A production-ready microservices application built to demonstrate cloud-native patterns
for DevOps/SRE learning. The app is a bookstore with four independent services.

---

## Architecture Overview

```
                        ┌─────────────────────────────────────┐
                        │           FRONTEND (Next.js)         │
                        │           localhost:3000             │
                        └──────┬──────────┬──────────┬────────┘
                               │          │          │
                    HTTP/REST  │          │          │  HTTP/REST
                               ▼          ▼          ▼
          ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
          │ user-service │  │product-service│  │  order-service   │
          │ Spring Boot  │  │   FastAPI     │  │  Spring Boot     │
          │  :8081       │  │   :8000       │  │  :8082           │
          └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘
                 │                 │                   │
                 │                 │     HTTP/REST      │
                 │                 │◄──────────────────┘
                 │                 │    (product lookup)
                 ▼                 ▼                   ▼
          ┌──────────┐     ┌──────────┐        ┌──────────┐
          │  users   │     │ products │        │  orders  │
          │ Postgres │     │ Postgres │        │ Postgres │
          └──────────┘     └──────────┘        └──────────┘
```

### Key Patterns Demonstrated

| Pattern | Implementation |
|---|---|
| **Database per Service** | Each service owns its own PostgreSQL database |
| **Stateless Services** | No session state; all auth via JWT |
| **Health Probes** | `/health` (FastAPI) and `/actuator/health` (Spring Boot) — K8s-ready |
| **Env-based Config** | All secrets/URLs injected via environment variables |
| **Inter-service HTTP** | order-service calls product-service via `RestClient` |
| **API Gateway Ready** | CORS configured, all routes under `/api/*` prefix |
| **Graceful Failures** | Proper HTTP error codes and structured error responses |

---

## Services

### 1. `product-service` — FastAPI (Python) · Port 8000

Owns the book catalog and categories.

**Endpoints:**
```
GET    /health
GET    /api/products             # paginated list, supports ?search=&category_id=&page=&size=
POST   /api/products
GET    /api/products/{id}
PATCH  /api/products/{id}
DELETE /api/products/{id}        # soft delete (sets is_active=false)
GET    /api/categories
POST   /api/categories
GET    /api/categories/{id}
PATCH  /api/categories/{id}
DELETE /api/categories/{id}
```

**Environment Variables:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/products_db
SERVICE_PORT=8000
CORS_ORIGINS=http://localhost:3000
```

**Run locally:**
```bash
cd product-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Docs available at `http://localhost:8000/docs`

---

### 2. `user-service` — Spring Boot (Java 21) · Port 8081

Handles user registration, JWT-based login, and profile management.

**Endpoints:**
```
POST   /api/auth/register        # returns JWT + user
POST   /api/auth/login           # returns JWT + user
GET    /api/users/me             # requires Authorization: Bearer <token>
PATCH  /api/users/me             # update firstName, lastName
GET    /actuator/health          # K8s health probe
```

**Environment Variables:**
```env
SERVER_PORT=8081
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/users_db
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
JWT_SECRET=<base64-encoded-256-bit-secret>
JWT_EXPIRATION=86400000
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

**Run locally:**
```bash
cd user-service
./mvnw spring-boot:run
```

---

### 3. `order-service` — Spring Boot (Java 21) · Port 8082

Manages the full order lifecycle. Calls `product-service` to validate products
and capture price snapshots at order time.

**Endpoints:**
```
POST   /api/orders               # create order from cart items
GET    /api/orders               # get current user's orders
GET    /api/orders/{id}          # get single order
POST   /api/orders/{id}/cancel   # cancel a PENDING order
GET    /actuator/health
```

**Environment Variables:**
```env
SERVER_PORT=8082
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/orders_db
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
JWT_SECRET=<same secret as user-service>
PRODUCT_SERVICE_URL=http://localhost:8000
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

**Run locally:**
```bash
cd order-service
./mvnw spring-boot:run
```

---

### 4. `frontend` — Next.js 14 (TypeScript) · Port 3000

Full-featured UI with App Router, React Context for cart/auth, and Tailwind CSS.

**Pages:**
- `/` — Product catalog with search + category filter + pagination
- `/products/[id]` — Product detail with quantity selector
- `/login` — Email/password login
- `/register` — Account creation
- `/orders` — Order history with cancel action (protected route)

**Environment Variables:**
```env
NEXT_PUBLIC_USER_SERVICE_URL=http://localhost:8081
NEXT_PUBLIC_PRODUCT_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_ORDER_SERVICE_URL=http://localhost:8082
```

**Run locally:**
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

---

## Project Structure

```
proj/
├── product-service/          # FastAPI — catalog & inventory
│   ├── app/
│   │   ├── main.py           # App factory, CORS, lifespan
│   │   ├── config.py         # pydantic-settings (env vars)
│   │   ├── database.py       # SQLAlchemy engine & session
│   │   ├── models.py         # Category, Product ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── seed.py           # Initial data (10 tech books)
│   │   └── routers/
│   │       ├── health.py
│   │       ├── categories.py
│   │       └── products.py
│   └── requirements.txt
│
├── user-service/             # Spring Boot — auth & users
│   ├── src/main/java/com/shopnative/userservice/
│   │   ├── config/           # SecurityConfig (JWT filter, CORS, BCrypt)
│   │   ├── controller/       # AuthController, UserController
│   │   ├── dto/              # RegisterRequest, LoginRequest, AuthResponse, UserDto
│   │   ├── exception/        # GlobalExceptionHandler (ProblemDetail)
│   │   ├── model/            # User entity
│   │   ├── repository/       # UserRepository (JPA)
│   │   ├── security/         # JwtAuthFilter
│   │   └── service/          # JwtService, UserService
│   ├── src/main/resources/application.yml
│   └── pom.xml
│
├── order-service/            # Spring Boot — orders
│   ├── src/main/java/com/shopnative/orderservice/
│   │   ├── client/           # ProductServiceClient (RestClient)
│   │   ├── config/           # SecurityConfig, RestClientConfig
│   │   ├── controller/       # OrderController
│   │   ├── dto/              # CreateOrderRequest, OrderDto, ProductDto
│   │   ├── exception/        # GlobalExceptionHandler
│   │   ├── model/            # Order, OrderItem, OrderStatus
│   │   ├── repository/       # OrderRepository
│   │   ├── security/         # JwtAuthFilter, JwtService, AuthenticatedUser
│   │   └── service/          # OrderService
│   ├── src/main/resources/application.yml
│   └── pom.xml
│
└── frontend/                 # Next.js 14 — UI
    ├── app/
    │   ├── layout.tsx        # Root layout (providers, navbar, footer)
    │   ├── page.tsx          # Home / product catalog
    │   ├── login/page.tsx
    │   ├── register/page.tsx
    │   ├── orders/page.tsx   # Protected
    │   └── products/[id]/page.tsx
    ├── components/
    │   ├── Navbar.tsx        # Sticky nav, cart badge, mobile menu
    │   ├── CartSidebar.tsx   # Slide-out cart with checkout
    │   ├── ProductCard.tsx
    │   └── OrderCard.tsx     # Expandable order with cancel
    ├── context/
    │   ├── AuthContext.tsx   # JWT + user state (cookie + localStorage)
    │   └── CartContext.tsx   # Cart state (useReducer + localStorage)
    ├── lib/
    │   ├── api.ts            # Axios API clients for all services
    │   └── types.ts          # TypeScript interfaces
    └── .env.example
```

---

## What YOU Build (DevOps/SRE Part)

This repo intentionally omits infrastructure files so you can practise building them.
Here is what you should create:

### Dockerfiles (one per service)
- `product-service/Dockerfile` — Python multi-stage build
- `user-service/Dockerfile` — JDK 21 multi-stage (`mvnw package` → JRE runtime)
- `order-service/Dockerfile` — same pattern as user-service
- `frontend/Dockerfile` — Next.js `output: standalone` multi-stage

### Kubernetes Manifests (`k8s/`)
For each service, create:
- `Deployment` — replicas, image, envFrom (ConfigMap/Secret), resource limits
- `Service` — ClusterIP to expose pods internally
- `ConfigMap` — non-secret env vars (SERVICE_URL, CORS_ORIGINS, etc.)
- `Secret` — `JWT_SECRET`, DB passwords
- `HorizontalPodAutoscaler` — scale on CPU

Also create:
- `Ingress` — route external traffic to services (e.g., `/api/products` → product-service)
- PostgreSQL `StatefulSet` + `PersistentVolumeClaim` per service (or use a managed DB)

### Health Probes (already wired — just configure in K8s)
```yaml
livenessProbe:
  httpGet:
    path: /health          # product-service
    port: 8000             # or /actuator/health for Spring Boot
  initialDelaySeconds: 15
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /actuator/health/readiness   # Spring Boot
    port: 8081
```

### CI Pipeline (`.github/workflows/` or similar)
Suggested stages:
1. **Test** — `pytest` / `mvn test`
2. **Build image** — `docker build`
3. **Push to registry** — ECR / GCR / Docker Hub
4. **Deploy** — `kubectl set image` or ArgoCD sync

### Observability
- Prometheus scrape annotations on Deployments
- Grafana dashboards for request rate / error rate / latency
- Centralized logging (ELK / Loki)

---

## JWT Flow

```
User → POST /api/auth/login (user-service)
         │
         └─► Returns JWT signed with JWT_SECRET
                      │
                      ▼
User → GET /api/orders (order-service)
  Authorization: Bearer <token>
         │
         └─► JwtAuthFilter validates token using SAME JWT_SECRET
             Extracts userId, email, username from claims
             Sets SecurityContext — no DB call needed
```

Both `user-service` and `order-service` share the same `JWT_SECRET` environment variable.
In Kubernetes this will be a single `Secret` mounted into both Deployments.

---

## Inter-Service Communication

```
order-service ──HTTP GET──► product-service/api/products/{id}
```

The `ProductServiceClient` uses Spring's `RestClient` (new in Spring Boot 3.2).
The URL is configured via `PRODUCT_SERVICE_URL` env var — in K8s this will be the
ClusterIP Service DNS name: `http://product-service:8000`.

---

## Seed Data

On first startup, `product-service` auto-seeds **10 tech books** including:
- Clean Code, The Pragmatic Programmer
- Kubernetes in Action, The Phoenix Project
- Site Reliability Engineering, Building Microservices
- Designing Data-Intensive Applications, and more

No manual setup required — just point to a fresh database.
# Micro-1
