# CompanyPulse – Employee Polling & Voting Management System

A modern, secure, enterprise-grade Employee Polling Web Application built with Django 5 REST Framework and React 19 / TypeScript / Vite / Tailwind CSS.

---

## 1. System Overview & Architecture

CompanyPulse is designed specifically with **two distinct user types**:
1. **Admin**: Controls employee onboarding, department hierarchies, poll lifecycle (drafting, scheduling, publication, closing), voting analytics, notifications, and audit logging.
2. **Employee**: Strictly pre-registered by the Administrator. Self-registration is disabled. Employees authenticate via **Full Name + Registered Mobile Number** backed by **salted SHA-256 One-Time Password (OTP) verification**, receiving JWT sessions with role-scoped permissions.

```
┌─────────────────────────────────────────────────────────────┐
│                       CompanyPulse                          │
├──────────────────────────────┬──────────────────────────────┤
│        Admin Portal          │       Employee Portal        │
│  - Dashboard & Analytics     │  - Active & Pending Polls    │
│  - Employee Management       │  - Ballot Voting (Mobile UI) │
│  - Department Structure      │  - Anonymous & Non-Anonymous │
│  - Poll Studio & Publishing  │  - Live Results (Role-based) │
│  - Excel/PDF Data Exports    │  - Voting History            │
│  - Tamper-proof Audit Logs   │  - Comments & Feedback       │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 2. Technology Stack

- **Backend**: Python 3.12, Django 5.x, Django REST Framework, SimpleJWT (Custom Token Serializers), PostgreSQL / SQLite, Celery, Redis.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, React Router v7, Axios, Recharts (Bar, Pie, Donut charts).
- **Security**: Salted SHA-256 OTP hashing, attempt limiting, cooldowns, separated anonymous participation tokens, atomic database transactions (`select_for_update`).
- **DevOps & Containers**: Docker, Docker Compose, Nginx (Alpine), Gunicorn WSGI.

---

## 3. Seeded Default Credentials

### Administrator Account
- **Username**: `admin`
- **Email**: `admin@companypulse.com`
- **Password**: `Admin@123456`

### Sample Pre-Registered Employees (for OTP Login)
| Employee ID | Full Name | Registered Mobile | Department | Designation |
|---|---|---|---|---|
| **EMP001** | Rahul Sharma | `+919876543210` | Engineering | Senior Software Engineer |
| **EMP002** | Priya Patel | `+919876543211` | Human Resources | HR Business Partner |
| **EMP003** | Ananya Verma | `+919876543212` | Marketing | Marketing Lead |
| **EMP004** | David Miller | `+919876543213` | Sales | Enterprise Account Executive |
| **EMP005** | Sarah Jenkins | `+919876543214` | Operations | Operations Manager |

*Note: In development test mode (`OTP_DEV_MODE=True`), the generated OTP is displayed in a developer badge on the UI and logged to the terminal, enabling instant login testing without third-party SMS gateway delays.*

---

## 4. Key Security & Voting Features

1. **Strict Two-Role Separation**:
   - Employees cannot self-register or elevate their privileges.
   - Admin access requires traditional password authentication; employee access requires verified mobile ownership via OTP.
2. **Anonymous Voting Privacy**:
   - When a poll is designated as `anonymous_voting=True`, the system records voter eligibility in `AnonymousParticipation(poll, employee)` to prevent duplicate voting, while storing the actual answer selection in `VoteSelection(poll, option)` with **zero link** to employee identity.
   - Identity-to-answer link is mathematically impossible to reconstruct.
3. **Duplicate Vote Prevention**:
   - Atomic database transactions with constraints (`unique_employee_poll_vote` and `unique_anonymous_participation`).
4. **Excel Import / Export**:
   - Bulk employee onboarding from `.xlsx` with automatic header parsing, duplicate detection, and department auto-creation.
   - Comprehensive poll results export to `.xlsx`.

---

## 5. Quickstart – Local Development Setup

### Prerequisites
- Python 3.12+
- Node.js 20+ and npm
- Git

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create & activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Initialize administrator & seed test data
python manage.py setup_admin
python manage.py seed_data

# Run automated tests
python manage.py test

# Start Django development server
python manage.py runserver 127.0.0.1:8000
```

### 2. Frontend Setup
```bash
# In a separate terminal, navigate to frontend
cd frontend

# Install packages
npm install

# Build to verify TypeScript & styles
npm run build

# Start Vite dev server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 6. Production Docker Deployment

Deploy the entire stack (PostgreSQL, Redis, Django Backend, Celery, and Nginx Frontend) with a single command:

```bash
# Clone the repository and enter directory
cd "CompanyPulse"

# Build and start all services
docker compose up --build -d
```

Services started:
- **Frontend & Nginx**: [http://localhost](http://localhost) (Port 80)
- **Django REST API**: [http://localhost:8000/api/v1/](http://localhost:8000/api/v1/) (Port 8000)
- **PostgreSQL Database**: Port 5432
- **Redis Broker**: Port 6379
- **Celery Worker**: Asynchronous background processor

---

## 7. API Reference (`/api/v1/`)

### Authentication
- `POST /api/v1/auth/admin/login/` – Administrator credentials login.
- `POST /api/v1/auth/employee/request-otp/` – Initiates employee login via name and mobile number.
- `POST /api/v1/auth/employee/verify-otp/` – Validates OTP and issues employee JWT tokens.
- `POST /api/v1/auth/token/refresh/` – Refreshes JWT access token.
- `GET /api/v1/auth/me/` – Retrieves authenticated user role and profile details.

### Employee Management (Admin Only)
- `GET /api/v1/employees/` – List employees with department/status filters and search.
- `POST /api/v1/employees/` – Register new employee with unique mobile and employee ID.
- `GET/PUT/DELETE /api/v1/employees/{id}/` – View, update, or archive employee.
- `PATCH /api/v1/employees/{id}/status/` – Activate or deactivate account.
- `POST /api/v1/employees/bulk-import/` – Excel file `.xlsx` bulk upload.
- `GET /api/v1/employees/export/` – Export employee directory to Excel.

### Department Management
- `GET/POST /api/v1/departments/` – View departments with live employee counts or create new units.

### Polls & Ballot Lifecycle
- `GET /api/v1/polls/` – List polls (Role-aware: Admins see all; Employees see eligible active/closed polls).
- `POST /api/v1/polls/` – Create poll with options, targeting, and privacy rules.
- `POST /api/v1/polls/{id}/publish/` – Publish poll and notify eligible employees.
- `POST /api/v1/polls/{id}/close/` – Close poll voting immediately.
- `POST /api/v1/polls/{id}/duplicate/` – Clone poll to drafts.

### Voting & Results
- `POST /api/v1/polls/{id}/vote/` – Cast ballot (atomic duplicate-check, anonymous decoupling).
- `GET /api/v1/polls/{id}/results/` – Live option counts, winner, and turnouts.
- `GET /api/v1/voting/history/` – Personal voting history for employee.

### Analytics & Reports
- `GET /api/v1/analytics/dashboard/` – Total stats, turnout %, and department participation.
- `GET /api/v1/reports/export/?poll_id={id}` – Export poll results to Excel.
