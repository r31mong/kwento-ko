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

// ── Startup Validation ────────────────────────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'AI_ENCRYPTION_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
const _missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (_missing.length) {
  console.error('Missing required environment variables:', _missing.join(', '));
  process.exit(1);
}

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
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  const keyBuf = Buffer.from(AI_ENC_KEY, 'utf8');
  if (keyBuf.length !== 32) throw new Error(`AI_ENCRYPTION_KEY must be exactly 32 bytes (got ${keyBuf.length})`);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
function decryptKey(enc) {
  if (!enc || !AI_ENC_KEY) return null;
  try {
    const [ivHex, encHex] = enc.split(':');
    if (!ivHex || !encHex) return null;
    const keyBuf = Buffer.from(AI_ENC_KEY, 'utf8');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString();
  } catch {
    return null;
  }
}
function keyHint(raw) {
  if (!raw) return null;
  if (raw.length < 4) return '(short)';
  return '...' + raw.slice(-4);
}

const seedProviders = [
  { feature: 'text',    provider: 'gemini',      model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash',                     key: process.env.GEMINI_API_KEY,      active: (process.env.TEXT_AI_PROVIDER || 'gemini') === 'gemini' },
  { feature: 'text',    provider: 'openrouter',  model: process.env.OPENROUTER_TEXT_MODEL || 'meta-llama/llama-3.1-70b-instruct', key: process.env.OPENROUTER_API_KEY,  active: process.env.TEXT_AI_PROVIDER === 'openrouter' },
  { feature: 'text',    provider: 'ollama',      model: process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:7b',                            key: null,                             active: process.env.TEXT_AI_PROVIDER === 'ollama',   extra: JSON.stringify({ host: process.env.OLLAMA_HOST }) },
  { feature: 'image',   provider: 'gemini',      model: process.env.GEMINI_IMAGE_MODEL || 'imagen-3.0-generate-002',             key: process.env.GEMINI_API_KEY,      active: (process.env.IMAGE_AI_PROVIDER || 'gemini') === 'gemini' },
  { feature: 'image',   provider: 'fal',         model: process.env.FAL_IMAGE_MODEL || 'fal-ai/flux/dev',                        key: process.env.FAL_API_KEY,         active: process.env.IMAGE_AI_PROVIDER === 'fal' },
  { feature: 'image',   provider: 'replicate',   model: process.env.REPLICATE_IMAGE_MODEL || 'black-forest-labs/flux-1.1-pro',   key: process.env.REPLICATE_API_KEY,   active: process.env.IMAGE_AI_PROVIDER === 'replicate' },
  { feature: 'compile', provider: 'gemini',      model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash',                     key: process.env.GEMINI_API_KEY,      active: (process.env.COMPILE_AI_PROVIDER || 'gemini') === 'gemini' },
  { feature: 'compile', provider: 'openrouter',  model: process.env.OPENROUTER_TEXT_MODEL || 'meta-llama/llama-3.1-70b-instruct', key: process.env.OPENROUTER_API_KEY, active: process.env.COMPILE_AI_PROVIDER === 'openrouter' },
  { feature: 'compile', provider: 'ollama',      model: process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:7b',                           key: null,                            active: process.env.COMPILE_AI_PROVIDER === 'ollama',  extra: JSON.stringify({ host: process.env.OLLAMA_HOST }) },
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

  db.prepare('INSERT OR IGNORE INTO usage_counters (user_id) VALUES (?)').run(userId);

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

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  if (user.is_suspended) return res.status(403).json({ error: 'Account suspended' });

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
  let limits;
  try {
    limits = user.is_tester && user.tester_limits
      ? JSON.parse(user.tester_limits)
      : null;
  } catch {
    limits = null;
  }
  limits = limits || TIER_LIMITS[tier] || TIER_LIMITS.free;

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
