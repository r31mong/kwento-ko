# KwentoKo Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working Express + SQLite server with JWT auth, all 15 database tables, and Docker packaging — the foundation every other phase builds on.

**Architecture:** Single `backend/server.js` file exports the Express `app`; `server.js` only calls `listen()` when run directly, enabling supertest-based integration tests. SQLite initialises synchronously on startup using `better-sqlite3`. Tests use an in-memory DB via `process.env.DB_PATH=:memory:`.

**Tech Stack:** Node 20, Express 4, better-sqlite3, bcryptjs, jsonwebtoken, jest, supertest, Docker (node:20-alpine + chromium)

---

## File Map

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `kwento-ko/backend/package.json` | Create | Dependencies + test scripts |
| `kwento-ko/backend/Dockerfile` | Create | Node 20 Alpine + Chromium for Puppeteer |
| `kwento-ko/docker-compose.yml` | Create | Service definition, volumes, env_file |
| `kwento-ko/.env.example` | Create | All required env vars with placeholder values |
| `kwento-ko/data/.gitkeep` | Create | Keeps the data/ directory in git |
| `kwento-ko/frontend/index.html` | Create | Placeholder (replaced in Phase 4) |
| `kwento-ko/backend/server.js` | Create | Express app, SQLite schema, auth routes |
| `kwento-ko/backend/tests/auth.test.js` | Create | Integration tests for auth endpoints |

---

## Task 1: Project Scaffold

**Files:**
- Create: `kwento-ko/backend/package.json`
- Create: `kwento-ko/backend/Dockerfile`
- Create: `kwento-ko/docker-compose.yml`
- Create: `kwento-ko/.env.example`
- Create: `kwento-ko/data/.gitkeep`
- Create: `kwento-ko/frontend/index.html`

- [ ] **Step 1: Create package.json**

```json
// kwento-ko/backend/package.json
{
  "name": "kwento-ko",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "jest --testEnvironment node --forceExit",
    "test:watch": "jest --watch --testEnvironment node"
  },
  "dependencies": {
    "@fal-ai/client": "^1.2.0",
    "@google/generative-ai": "^0.17.1",
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "express-rate-limit": "^7.2.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.13",
    "puppeteer-core": "^22.6.5",
    "replicate": "^0.34.3",
    "xmlrpc": "^1.3.2"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  },
  "jest": {
    "testMatch": ["**/tests/**/*.test.js"]
  }
}
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
# kwento-ko/backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

- [ ] **Step 3: Create docker-compose.yml**

```yaml
# kwento-ko/docker-compose.yml
services:
  kwento-ko:
    build: ./backend
    ports:
      - "${PORT:-3000}:3000"
    env_file: .env
    volumes:
      - ./frontend:/app/frontend
      - ./data:/app/data
    restart: unless-stopped
```

- [ ] **Step 4: Create .env.example**

```bash
# kwento-ko/.env.example

# ── App ──────────────────────────────────────────────────
PORT=3000
NODE_ENV=production
ALLOWED_ORIGIN=*

# ── Auth ─────────────────────────────────────────────────
# Min 32 chars — generate: openssl rand -base64 32
JWT_SECRET=GENERATE_MIN_32_CHAR_RANDOM_STRING

# ── Admin ────────────────────────────────────────────────
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=EDIT_THIS_ADMIN_PASSWORD

# ── AI Encryption ────────────────────────────────────────
# MUST be exactly 32 chars — NEVER change after first run
# Generate: openssl rand -hex 16
AI_ENCRYPTION_KEY=GENERATE_32_CHAR_RANDOM_STRING

# ── AI Bootstrap (seed only — managed via Admin Dashboard after first run) ──
TEXT_AI_PROVIDER=gemini
IMAGE_AI_PROVIDER=gemini
COMPILE_AI_PROVIDER=gemini

GEMINI_API_KEY=EDIT_THIS_KEY
GEMINI_TEXT_MODEL=gemini-2.0-flash
GEMINI_IMAGE_MODEL=imagen-3.0-generate-002

OPENROUTER_API_KEY=EDIT_THIS_KEY
OPENROUTER_TEXT_MODEL=meta-llama/llama-3.1-70b-instruct

OLLAMA_HOST=http://EDIT_THIS_IP:11434
OLLAMA_TEXT_MODEL=qwen2.5:7b

FAL_API_KEY=EDIT_THIS_KEY
FAL_IMAGE_MODEL=fal-ai/flux/dev

REPLICATE_API_KEY=EDIT_THIS_KEY
REPLICATE_IMAGE_MODEL=black-forest-labs/flux-1.1-pro

# ── Odoo ─────────────────────────────────────────────────
ODOO_PRIMARY_URL=http://192.168.1.XX:8069
ODOO_PRIMARY_DB=odoo
ODOO_PRIMARY_USER=admin
ODOO_PRIMARY_API=EDIT_THIS_API_KEY

ODOO_SECONDARY_URL=http://192.168.1.XX:8069
ODOO_SECONDARY_DB=odoo
ODOO_SECONDARY_USER=admin
ODOO_SECONDARY_API=EDIT_THIS_API_KEY

# ── Email (for PDF delivery to Pro+ users) ───────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=EDIT_THIS_EMAIL
SMTP_PASS=EDIT_THIS_APP_PASSWORD
```

- [ ] **Step 5: Create placeholder frontend and data directory marker**

```html
<!-- kwento-ko/frontend/index.html -->
<!DOCTYPE html>
<html><body><h1>Kwento Ko — Coming Soon</h1></body></html>
```

```bash
touch /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/data/.gitkeep
```

- [ ] **Step 6: Install dependencies**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit scaffold**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo
git init
git add kwento-ko/backend/package.json kwento-ko/backend/Dockerfile \
        kwento-ko/docker-compose.yml kwento-ko/.env.example \
        kwento-ko/frontend/index.html kwento-ko/data/.gitkeep \
        CLAUDE.md .claude/
git commit -m "chore: initial project scaffold with Docker and deps"
```

---

## Task 2: SQLite Schema + Server Bootstrap

**Files:**
- Create: `kwento-ko/backend/server.js`
- Create: `kwento-ko/backend/tests/auth.test.js` (scaffolded, no tests yet)

- [ ] **Step 1: Write failing schema test**

```javascript
// kwento-ko/backend/tests/auth.test.js
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-min-32-chars-here-ok';
process.env.AI_ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'testpass';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { app, db } = require('../server');

describe('Schema', () => {
  it('creates all required tables', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all().map(r => r.name);

    const required = [
      'users', 'stories', 'story_images', 'usage_log',
      'usage_counters', 'referrals', 'affiliate_earnings',
      'promo_codes', 'promo_usage', 'system_settings',
      'odoo_sync_queue', 'ai_provider_settings', 'ai_key_audit_log'
    ];
    required.forEach(t => expect(tables).toContain(t));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npx jest tests/auth.test.js -t "creates all required tables" --no-coverage
```

Expected: FAIL — "Cannot find module '../server'"

- [ ] **Step 3: Create server.js with all boilerplate and schema**

```javascript
// kwento-ko/backend/server.js
'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const AI_ENC_KEY = process.env.AI_ENCRYPTION_KEY; // Must be 32 chars
const DB_PATH = process.env.DB_PATH || '/app/data/kwento.db';

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    email            TEXT UNIQUE NOT NULL,
    password_hash    TEXT NOT NULL,
    display_name     TEXT,
    avatar_emoji     TEXT DEFAULT '📚',
    tier             TEXT DEFAULT 'free',
    tier_cached_at   DATETIME,
    is_tester        INTEGER DEFAULT 0,
    tester_limits    TEXT,
    tester_note      TEXT,
    is_admin         INTEGER DEFAULT 0,
    is_suspended     INTEGER DEFAULT 0,
    referral_code    TEXT UNIQUE,
    referred_by      INTEGER REFERENCES users(id),
    odoo_partner_id  INTEGER,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at   DATETIME
  );

  CREATE TABLE IF NOT EXISTS stories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    language        TEXT NOT NULL,
    tone            TEXT,
    age_range       TEXT,
    character_name  TEXT,
    page_count      INTEGER,
    story_data      TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS story_images (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id     INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    page_index   INTEGER,
    prompt_used  TEXT,
    provider     TEXT,
    model        TEXT,
    image_data   TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS usage_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    action       TEXT NOT NULL,
    provider     TEXT,
    model        TEXT,
    tokens_used  INTEGER,
    cost_usd     REAL,
    synced_odoo  INTEGER DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS usage_counters (
    user_id          INTEGER PRIMARY KEY REFERENCES users(id),
    stories_today    INTEGER DEFAULT 0,
    stories_month    INTEGER DEFAULT 0,
    images_month     INTEGER DEFAULT 0,
    compiles_month   INTEGER DEFAULT 0,
    last_reset_day   DATE,
    last_reset_month DATE
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id      INTEGER REFERENCES users(id),
    referred_id      INTEGER REFERENCES users(id),
    referred_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    rewarded         INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS affiliate_earnings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    affiliate_id INTEGER REFERENCES users(id),
    referred_id  INTEGER REFERENCES users(id),
    amount_php   REAL,
    status       TEXT DEFAULT 'pending',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    code           TEXT UNIQUE NOT NULL,
    discount_type  TEXT NOT NULL,
    discount_value REAL NOT NULL,
    applies_to     TEXT,
    billing_cycle  TEXT,
    max_uses       INTEGER,
    uses_count     INTEGER DEFAULT 0,
    expires_at     DATETIME,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promo_usage (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code_id     INTEGER REFERENCES promo_codes(id),
    user_id     INTEGER REFERENCES users(id),
    used_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS odoo_sync_queue (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    payload      TEXT NOT NULL,
    attempts     INTEGER DEFAULT 0,
    last_attempt DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ai_provider_settings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    feature         TEXT NOT NULL,
    provider        TEXT NOT NULL,
    is_active       INTEGER DEFAULT 0,
    api_key_enc     TEXT,
    api_key_hint    TEXT,
    model           TEXT NOT NULL,
    extra_config    TEXT,
    last_tested_at  DATETIME,
    last_test_ok    INTEGER,
    last_test_msg   TEXT,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by      TEXT,
    UNIQUE(feature, provider)
  );

  CREATE TABLE IF NOT EXISTS ai_key_audit_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    feature      TEXT NOT NULL,
    provider     TEXT NOT NULL,
    action       TEXT NOT NULL,
    result       TEXT,
    admin_email  TEXT NOT NULL,
    ip_address   TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed system_settings defaults
const settingsDefaults = [
  ['text_ai_provider', process.env.TEXT_AI_PROVIDER || 'gemini'],
  ['image_ai_provider', process.env.IMAGE_AI_PROVIDER || 'gemini'],
  ['compile_ai_provider', process.env.COMPILE_AI_PROVIDER || 'gemini'],
  ['lifetime_plan_active', 'true'],
  ['maintenance_mode', 'false'],
  ['maintenance_message', ''],
  ['maintenance_until', ''],
  ['ai_cost_alert_threshold_php', '5000'],
];
const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)'
);
settingsDefaults.forEach(([k, v]) => insertSetting.run(k, v));

// Seed ai_provider_settings from .env on first run
function encryptKey(raw) {
  if (!raw || !AI_ENC_KEY) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(AI_ENC_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
function decryptKey(enc) {
  if (!enc || !AI_ENC_KEY) return null;
  const [ivHex, encHex] = enc.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(AI_ENC_KEY), iv);
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString();
}
function keyHint(raw) {
  if (!raw || raw.length < 4) return '...????';
  return '...' + raw.slice(-4);
}

const seedProviders = [
  { feature: 'text',    provider: 'gemini',      model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash',                    key: process.env.GEMINI_API_KEY,      active: (process.env.TEXT_AI_PROVIDER || 'gemini') === 'gemini' },
  { feature: 'text',    provider: 'openrouter',  model: process.env.OPENROUTER_TEXT_MODEL || 'meta-llama/llama-3.1-70b-instruct', key: process.env.OPENROUTER_API_KEY,  active: process.env.TEXT_AI_PROVIDER === 'openrouter' },
  { feature: 'text',    provider: 'ollama',      model: process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:7b',                           key: null,                             active: process.env.TEXT_AI_PROVIDER === 'ollama',   extra: JSON.stringify({ host: process.env.OLLAMA_HOST }) },
  { feature: 'image',   provider: 'gemini',      model: process.env.GEMINI_IMAGE_MODEL || 'imagen-3.0-generate-002',            key: process.env.GEMINI_API_KEY,      active: (process.env.IMAGE_AI_PROVIDER || 'gemini') === 'gemini' },
  { feature: 'image',   provider: 'fal',         model: process.env.FAL_IMAGE_MODEL || 'fal-ai/flux/dev',                       key: process.env.FAL_API_KEY,         active: process.env.IMAGE_AI_PROVIDER === 'fal' },
  { feature: 'image',   provider: 'replicate',   model: process.env.REPLICATE_IMAGE_MODEL || 'black-forest-labs/flux-1.1-pro',  key: process.env.REPLICATE_API_KEY,   active: process.env.IMAGE_AI_PROVIDER === 'replicate' },
  { feature: 'compile', provider: 'gemini',      model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash',                    key: process.env.GEMINI_API_KEY,      active: (process.env.COMPILE_AI_PROVIDER || 'gemini') === 'gemini' },
  { feature: 'compile', provider: 'openrouter',  model: process.env.OPENROUTER_TEXT_MODEL || 'meta-llama/llama-3.1-70b-instruct', key: process.env.OPENROUTER_API_KEY, active: process.env.COMPILE_AI_PROVIDER === 'openrouter' },
  { feature: 'compile', provider: 'ollama',      model: process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:7b',                          key: null,                            active: process.env.COMPILE_AI_PROVIDER === 'ollama',  extra: JSON.stringify({ host: process.env.OLLAMA_HOST }) },
];
const insertProvider = db.prepare(`
  INSERT OR IGNORE INTO ai_provider_settings
    (feature, provider, is_active, api_key_enc, api_key_hint, model, extra_config)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
seedProviders.forEach(p => {
  insertProvider.run(p.feature, p.provider, p.active ? 1 : 0,
    encryptKey(p.key), keyHint(p.key), p.model, p.extra || null);
});

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateReferralCode() {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

function makeToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (!payload.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    req.adminEmail = payload.email;
    req.adminId = payload.adminId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid admin token' });
  }
}

// Tier limit lookup
const TIER_LIMITS = {
  free:     { storiesPerDay: 3,  storiesPerMonth: 20,  imagesPerMonth: 0,   canExportPDF: false, canExportDOCX: false, canCompileBook: false, commercialLicense: false, storageLimit: 5,   watermark: true  },
  pro:      { storiesPerDay: 20, storiesPerMonth: 200, imagesPerMonth: 30,  canExportPDF: true,  canExportDOCX: true,  canCompileBook: true,  commercialLicense: false, storageLimit: 100, watermark: false },
  business: { storiesPerDay: -1, storiesPerMonth: -1,  imagesPerMonth: 150, canExportPDF: true,  canExportDOCX: true,  canCompileBook: true,  commercialLicense: true,  storageLimit: -1,  watermark: false },
  tester:   { storiesPerDay: -1, storiesPerMonth: -1,  imagesPerMonth: -1,  canExportPDF: true,  canExportDOCX: true,  canCompileBook: true,  commercialLicense: true,  storageLimit: -1,  watermark: false },
};

// ── PLACEHOLDER: Routes added in later tasks ──────────────────────────────────
// Task 3:  Auth routes
// Task 4:  AISettingsManager + admin AI settings routes
// Task 5:  AIProviderFactory
// Task 6:  OdooClient
// Task 7:  Story generation routes
// Task 8:  Image generation route
// Task 9:  Book compilation route
// Task 10: Library CRUD routes
// Task 11: Growth routes (promo, referral, affiliate)
// Task 12: Admin backend routes
// Task 13: Health route
// ─────────────────────────────────────────────────────────────────────────────

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => console.log(`Kwento Ko running on port ${PORT}`));
}

module.exports = { app, db, encryptKey, decryptKey, keyHint, TIER_LIMITS };
```

- [ ] **Step 4: Run schema test to verify it passes**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npx jest tests/auth.test.js -t "creates all required tables" --no-coverage
```

Expected: PASS — all 13 tables found.

- [ ] **Step 5: Commit**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo
git add kwento-ko/backend/server.js kwento-ko/backend/tests/auth.test.js
git commit -m "feat: server bootstrap with full SQLite schema and seeding"
```

---

## Task 3: Auth Routes (register, login, /me)

**Files:**
- Modify: `kwento-ko/backend/server.js` — add auth routes after the PLACEHOLDER comment
- Modify: `kwento-ko/backend/tests/auth.test.js` — add auth tests

- [ ] **Step 1: Write failing auth tests**

Add below the schema test in `kwento-ko/backend/tests/auth.test.js`:

```javascript
// Append to existing auth.test.js (below the Schema describe block)

describe('POST /api/auth/register', () => {
  it('creates a user and returns a JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123', displayName: 'Tester' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.tier).toBe('free');
    expect(res.body.user.referralCode).toBeTruthy();
  });

  it('returns 409 for duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'pass123', displayName: 'A' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'pass123', displayName: 'B' });
    expect(res.status).toBe(409);
  });

  it('returns 400 if email or password missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'no-pass@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@example.com', password: 'correctpass', displayName: 'Login' });
  });

  it('returns token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'correctpass' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  let token;
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'me@example.com', password: 'pass123', displayName: 'Me' });
    token = res.body.token;
  });

  it('returns user profile with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
    expect(res.body.subscription).toBeDefined();
    expect(res.body.usageToday).toBeDefined();
    expect(res.body.usageMonth).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/login', () => {
  it('returns admin token with correct credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'testpass' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npx jest tests/auth.test.js --no-coverage
```

Expected: FAIL — routes return 404.

- [ ] **Step 3: Add auth routes to server.js**

Replace the `// Task 3:  Auth routes` placeholder comment in `server.js` with:

```javascript
// ── Auth Routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName, avatarEmoji, referralCode } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 12);
  const refCode = generateReferralCode();

  let referrerId = null;
  if (referralCode) {
    const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode);
    if (referrer) referrerId = referrer.id;
  }

  const result = db.prepare(`
    INSERT INTO users (email, password_hash, display_name, avatar_emoji, referral_code, referred_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(email, hash, displayName || email.split('@')[0], avatarEmoji || '📚', refCode, referrerId);

  const userId = result.lastInsertRowid;

  // Init usage counters
  db.prepare('INSERT OR IGNORE INTO usage_counters (user_id) VALUES (?)').run(userId);

  // Track referral
  if (referrerId) {
    db.prepare('INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)').run(referrerId, userId);
  }

  const user = db.prepare('SELECT id, email, display_name, avatar_emoji, tier, referral_code FROM users WHERE id = ?').get(userId);
  const token = makeToken(userId);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarEmoji: user.avatar_emoji,
      tier: user.tier,
      referralCode: user.referral_code,
    }
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (user.is_suspended) return res.status(403).json({ error: 'Account suspended' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  db.prepare('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const token = makeToken(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarEmoji: user.avatar_emoji,
      tier: user.tier,
      isTester: !!user.is_tester,
      referralCode: user.referral_code,
    }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  // Reset usage counters if needed
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const counters = db.prepare('SELECT * FROM usage_counters WHERE user_id = ?').get(req.userId);

  if (counters) {
    if (counters.last_reset_day !== today) {
      db.prepare('UPDATE usage_counters SET stories_today = 0, last_reset_day = ? WHERE user_id = ?').run(today, req.userId);
    }
    if (counters.last_reset_month !== thisMonth) {
      db.prepare('UPDATE usage_counters SET stories_month = 0, images_month = 0, compiles_month = 0, last_reset_month = ? WHERE user_id = ?').run(thisMonth, req.userId);
    }
  }

  const fresh = db.prepare('SELECT * FROM usage_counters WHERE user_id = ?').get(req.userId);
  const tier = user.tier || 'free';
  const limits = user.is_tester && user.tester_limits
    ? JSON.parse(user.tester_limits)
    : TIER_LIMITS[tier] || TIER_LIMITS.free;

  res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarEmoji: user.avatar_emoji,
      tier,
      isTester: !!user.is_tester,
      testerNote: user.tester_note,
      referralCode: user.referral_code,
    },
    subscription: {
      tier,
      ...limits,
      isTester: !!user.is_tester,
      testerNote: user.tester_note,
    },
    usageToday: { stories: fresh?.stories_today || 0 },
    usageMonth: {
      stories: fresh?.stories_month || 0,
      images: fresh?.images_month || 0,
      compiles: fresh?.compiles_month || 0,
    },
  });
});

// Admin login (separate from user auth)
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const token = jwt.sign({ isAdmin: true, email, adminId: 0 }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});
```

- [ ] **Step 4: Run auth tests to verify they pass**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npx jest tests/auth.test.js --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Verify server starts**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko
cp .env.example .env
# Edit .env: set JWT_SECRET and AI_ENCRYPTION_KEY to valid values
# JWT_SECRET: any 32+ char string e.g. "dev-jwt-secret-kwentoko-32chars!"
# AI_ENCRYPTION_KEY: exactly 32 chars e.g. "12345678901234567890123456789012"
DB_PATH=/tmp/kwento-test.db node backend/server.js &
curl -s http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"pass1234","displayName":"Test"}' | python3 -m json.tool
kill %1
```

Expected: JSON response with `token` and `user` object.

- [ ] **Step 6: Commit**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo
git add kwento-ko/backend/server.js kwento-ko/backend/tests/auth.test.js
git commit -m "feat: add auth routes — register, login, /me with JWT"
```

---

## Phase 1 Checkpoint — Verify Docker Build

- [ ] **Step 1: Copy .env and build Docker image**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko
# Ensure .env has valid JWT_SECRET (32+ chars) and AI_ENCRYPTION_KEY (32 chars)
docker compose build
```

Expected: Image builds successfully. No errors.

- [ ] **Step 2: Start container and smoke test**

```bash
docker compose up -d
sleep 3
curl -s http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"docker@test.com","password":"pass1234","displayName":"Docker"}' \
  | python3 -m json.tool
docker compose down
```

Expected: `{"token": "...", "user": {...}}` — server responds from inside container.

- [ ] **Step 3: Commit**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo
git add kwento-ko/
git commit -m "chore: verify Phase 1 foundation runs in Docker"
```

---

> **Phase 1 complete.** The foundation is running. Proceed to `2026-04-06-kwentoko-phase2-ai-core.md`.
