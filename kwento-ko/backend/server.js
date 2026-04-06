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
// ── AISettingsManager ─────────────────────────────────────────────────────────
class AISettingsManager {
  constructor() {
    this.cache = null;
    this.cacheAt = 0;
    this.TTL = 5 * 60 * 1000; // 5 minutes
  }

  _loadFromDb() {
    const rows = db.prepare('SELECT * FROM ai_provider_settings WHERE is_active = 1').all();
    const result = {};
    for (const row of rows) {
      result[row.feature] = {
        provider: row.provider,
        apiKey: row.api_key_enc ? decryptKey(row.api_key_enc) : null,
        model: row.model,
        extraConfig: row.extra_config ? JSON.parse(row.extra_config) : {},
      };
    }
    return result;
  }

  refreshCache() {
    this.cache = this._loadFromDb();
    this.cacheAt = Date.now();
  }

  getActiveProvider(feature) {
    if (!this.cache || Date.now() - this.cacheAt > this.TTL) {
      this.refreshCache();
    }
    return this.cache[feature] || null;
  }

  updateProvider(feature, provider, apiKey, model, extraConfig, adminEmail, ipAddress) {
    const existing = db.prepare('SELECT * FROM ai_provider_settings WHERE feature = ? AND provider = ?').get(feature, provider);
    if (!existing) return { ok: false, error: 'Provider not found' };

    const updates = {};
    if (apiKey) {
      updates.api_key_enc = encryptKey(apiKey);
      updates.api_key_hint = keyHint(apiKey);
    }
    if (model) updates.model = model;
    if (extraConfig !== undefined) updates.extra_config = JSON.stringify(extraConfig);
    updates.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
    updates.updated_by = adminEmail;

    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE ai_provider_settings SET ${sets} WHERE feature = ? AND provider = ?`)
      .run(...Object.values(updates), feature, provider);

    db.prepare(`
      INSERT INTO ai_key_audit_log (feature, provider, action, result, admin_email, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(feature, provider, apiKey ? 'key_updated' : 'model_changed', 'success', adminEmail, ipAddress);

    this.refreshCache();
    return { ok: true };
  }

  switchActiveProvider(feature, provider, adminEmail, ipAddress) {
    const target = db.prepare('SELECT id FROM ai_provider_settings WHERE feature = ? AND provider = ?').get(feature, provider);
    if (!target) return { ok: false, error: 'Provider not found' };

    db.transaction(() => {
      db.prepare('UPDATE ai_provider_settings SET is_active = 0 WHERE feature = ?').run(feature);
      db.prepare('UPDATE ai_provider_settings SET is_active = 1 WHERE feature = ? AND provider = ?').run(feature, provider);
      db.prepare(`
        INSERT INTO ai_key_audit_log (feature, provider, action, result, admin_email, ip_address)
        VALUES (?, ?, 'provider_switched', 'success', ?, ?)
      `).run(feature, provider, adminEmail, ipAddress);
    })();

    this.refreshCache();
    return { ok: true };
  }

  async testConnection(feature, provider, apiKey, model, extraConfig = {}) {
    const start = Date.now();
    let key = apiKey;
    if (apiKey === '__USE_STORED__') {
      const row = db.prepare('SELECT api_key_enc FROM ai_provider_settings WHERE feature = ? AND provider = ?').get(feature, provider);
      key = row ? decryptKey(row.api_key_enc) : null;
    }

    try {
      if (provider === 'gemini') {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(key);
        const m = genAI.getGenerativeModel({ model: model || 'gemini-2.0-flash' });
        const result = await m.generateContent('Reply with exactly one word: OK');
        const text = result.response.text();
        if (!text.includes('OK')) throw new Error('Unexpected response: ' + text);
      } else if (provider === 'openrouter') {
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://alibebeph.com', 'X-Title': 'Kwento Ko' },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with exactly one word: OK' }] }),
          signal: AbortSignal.timeout(15000),
        });
        const data = await resp.json();
        if (!data.choices?.[0]?.message?.content?.includes('OK')) throw new Error('Unexpected response');
      } else if (provider === 'ollama') {
        const host = extraConfig.host || 'http://localhost:11434';
        const resp = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) throw new Error('Ollama unreachable');
        const tags = await resp.json();
        const models = tags.models?.map(m => m.name) || [];
        if (!models.some(m => m.startsWith(model.split(':')[0]))) {
          throw new Error(`Model ${model} not found on this Ollama instance`);
        }
      } else if (provider === 'fal') {
        const { fal } = require('@fal-ai/client');
        fal.config({ credentials: key });
        await fal.run(model || 'fal-ai/flux/dev', { input: { prompt: 'sunshine', num_inference_steps: 1 } });
      } else if (provider === 'replicate') {
        const Replicate = require('replicate');
        const replicate = new Replicate({ auth: key });
        const output = await replicate.run(model, { input: { prompt: 'sunshine', num_inference_steps: 1 } });
        if (!output) throw new Error('No output from Replicate');
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const latencyMs = Date.now() - start;
      db.prepare(`UPDATE ai_provider_settings SET last_tested_at = CURRENT_TIMESTAMP, last_test_ok = 1, last_test_msg = ? WHERE feature = ? AND provider = ?`)
        .run(`Connected in ${latencyMs}ms`, feature, provider);
      return { ok: true, latencyMs, message: `Connected successfully in ${latencyMs}ms`, model };
    } catch (err) {
      const latencyMs = Date.now() - start;
      db.prepare(`UPDATE ai_provider_settings SET last_tested_at = CURRENT_TIMESTAMP, last_test_ok = 0, last_test_msg = ? WHERE feature = ? AND provider = ?`)
        .run(err.message, feature, provider);
      return { ok: false, latencyMs, message: err.message, model };
    }
  }
}

const aiSettings = new AISettingsManager();
// Auto-refresh cache every 5 minutes
setInterval(() => aiSettings.refreshCache(), 5 * 60 * 1000).unref();

// ── Admin AI Settings Routes ──────────────────────────────────────────────────
const adminAiRateLimit = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, keyGenerator: req => req.adminEmail || req.ip });

app.get('/api/admin/ai-settings', adminMiddleware, (req, res) => {
  const rows = db.prepare('SELECT feature, provider, is_active, api_key_hint, model, extra_config, last_tested_at, last_test_ok, last_test_msg, updated_at, updated_by FROM ai_provider_settings ORDER BY feature, provider').all();
  const grouped = { text: [], image: [], compile: [] };
  for (const row of rows) {
    if (grouped[row.feature]) {
      grouped[row.feature].push({
        ...row,
        is_active: !!row.is_active,
        last_test_ok: row.last_test_ok === null ? null : !!row.last_test_ok,
        extra_config: row.extra_config ? JSON.parse(row.extra_config) : {},
      });
    }
  }
  res.json(grouped);
});

app.post('/api/admin/ai-settings/test', adminMiddleware, adminAiRateLimit, async (req, res) => {
  const { feature, provider, apiKey, model, extraConfig } = req.body;
  if (!feature || !provider) return res.status(400).json({ error: 'feature and provider required' });

  db.prepare(`
    INSERT INTO ai_key_audit_log (feature, provider, action, result, admin_email, ip_address)
    VALUES (?, ?, 'test_run', 'initiated', ?, ?)
  `).run(feature, provider, req.adminEmail, req.ip);

  const result = await aiSettings.testConnection(feature, provider, apiKey || '__USE_STORED__', model, extraConfig || {});

  db.prepare(`
    INSERT INTO ai_key_audit_log (feature, provider, action, result, admin_email, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(feature, provider, result.ok ? 'test_passed' : 'test_failed', result.message, req.adminEmail, req.ip);

  res.json(result);
});

app.put('/api/admin/ai-settings/:feature/active', adminMiddleware, (req, res) => {
  const { feature } = req.params;
  const { provider } = req.body;
  if (!provider) return res.status(400).json({ error: 'provider required' });
  const result = aiSettings.switchActiveProvider(feature, provider, req.adminEmail, req.ip);
  if (!result.ok) return res.status(404).json(result);
  res.json({ ok: true, activeProvider: provider });
});

app.get('/api/admin/ai-settings/audit', adminMiddleware, (req, res) => {
  const { limit = 50, feature, provider } = req.query;
  let query = 'SELECT * FROM ai_key_audit_log';
  const params = [];
  const conditions = [];
  if (feature) { conditions.push('feature = ?'); params.push(feature); }
  if (provider) { conditions.push('provider = ?'); params.push(provider); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Math.min(parseInt(limit) || 50, 200));
  const logs = db.prepare(query).all(...params);
  res.json({ logs });
});

app.put('/api/admin/ai-settings/:feature/:provider', adminMiddleware, async (req, res) => {
  const { feature, provider } = req.params;
  const { apiKey, model, extraConfig } = req.body;
  const result = aiSettings.updateProvider(feature, provider, apiKey, model, extraConfig, req.adminEmail, req.ip);
  if (!result.ok) return res.status(404).json(result);

  // Auto-test after update
  const testKey = apiKey || '__USE_STORED__';
  const row = db.prepare('SELECT model FROM ai_provider_settings WHERE feature = ? AND provider = ?').get(feature, provider);
  const testResult = await aiSettings.testConnection(feature, provider, testKey, model || row?.model, extraConfig || {});
  res.json({ ok: true, testResult });
});

// ── AI Helpers ────────────────────────────────────────────────────────────────
function safeParseAIJson(raw) {
  let cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[1]);
    throw new Error('AI returned unparseable JSON');
  }
}

// ── AIProviderFactory ─────────────────────────────────────────────────────────
class AIProviderFactory {
  async generateText(systemPrompt, userPrompt) {
    const config = aiSettings.getActiveProvider('text');
    if (!config) throw new Error('No active text AI provider configured');

    if (config.provider === 'gemini') {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({
        model: config.model,
        systemInstruction: systemPrompt,
        generationConfig: { responseMimeType: 'application/json' },
      });
      const result = await model.generateContent(userPrompt);
      return result.response.text();
    }

    if (config.provider === 'openrouter') {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://alibebeph.com',
          'X-Title': 'Kwento Ko',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || '';
    }

    if (config.provider === 'ollama') {
      const host = config.extraConfig?.host || 'http://localhost:11434';
      const resp = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          format: 'json',
          stream: false,
        }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await resp.json();
      return data.response || '';
    }

    throw new Error(`Unsupported text provider: ${config.provider}`);
  }

  async generateImage(prompt) {
    const config = aiSettings.getActiveProvider('image');
    if (!config) throw new Error('No active image AI provider configured');

    if (config.provider === 'gemini') {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({ model: config.model });
      const result = await model.generateContent(prompt);
      const part = result.response.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData?.data) return part.inlineData.data; // base64
      throw new Error('Gemini Imagen returned no image data');
    }

    if (config.provider === 'fal') {
      const { fal } = require('@fal-ai/client');
      fal.config({ credentials: config.apiKey });
      const result = await fal.run(config.model, {
        input: { prompt, image_size: 'landscape_16_9', num_inference_steps: 28, guidance_scale: 3.5 },
      });
      const imgUrl = result.images?.[0]?.url;
      if (!imgUrl) throw new Error('fal.ai returned no image URL');
      const imgResp = await fetch(imgUrl);
      const buf = await imgResp.arrayBuffer();
      return Buffer.from(buf).toString('base64');
    }

    if (config.provider === 'replicate') {
      const Replicate = require('replicate');
      const replicate = new Replicate({ auth: config.apiKey });
      const output = await replicate.run(config.model, { input: { prompt } });
      const imgUrl = Array.isArray(output) ? output[0] : output;
      const imgResp = await fetch(imgUrl);
      const buf = await imgResp.arrayBuffer();
      return Buffer.from(buf).toString('base64');
    }

    throw new Error(`Unsupported image provider: ${config.provider}`);
  }

  async generateLayout(storyData, format, template) {
    const config = aiSettings.getActiveProvider('compile');
    if (!config) throw new Error('No active compile AI provider configured');

    const systemPrompt = `You are a children's book layout designer. Given story data, output a JSON layout plan for Puppeteer rendering. Output valid JSON only, no markdown fences.`;
    const userPrompt = `Generate a layout plan for:
Format: ${format}
Template: ${template}
Story title: ${storyData.title}
Page count: ${storyData.pages?.length || 10}
Has images: ${storyData.pages?.some(p => p.image) ? 'yes' : 'no'}

Output this exact JSON shape:
{
  "coverPage": { "titleFontSize": 32, "titlePosition": "center", "imagePosition": "half", "backgroundColor": "#FFF8E1", "accentColor": "#FF6B6B" },
  "storyPages": { "textPosition": "bottom", "imagePosition": "top", "textFontSize": 16, "translationFontSize": 13, "lineHeight": 1.6, "margins": { "top": "15mm", "bottom": "15mm", "inner": "20mm", "outer": "15mm" } },
  "pageOrder": ["cover","dedication","print-instructions","story-pages","moral","discussion-guide","back-cover"]
}`;

    const raw = await this.generateText(systemPrompt, userPrompt);
    return safeParseAIJson(raw);
  }
}

const aiFactory = new AIProviderFactory();

// ── Generation Rate Limiter ───────────────────────────────────────────────────
const genRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyGenerator: req => req.ip });

// ── Subscription Limit Check ──────────────────────────────────────────────────
function checkStoryLimit(userId) {
  const user = db.prepare('SELECT tier, is_tester, tester_limits FROM users WHERE id = ?').get(userId);
  if (!user) return { allowed: false, reason: 'User not found' };

  const tier = user.tier || 'free';
  let limits;
  try {
    limits = user.is_tester && user.tester_limits ? JSON.parse(user.tester_limits) : null;
  } catch {
    limits = null;
  }
  limits = limits || TIER_LIMITS[tier] || TIER_LIMITS.free;

  if (limits.storiesPerDay === -1) return { allowed: true, limits };

  db.prepare('INSERT OR IGNORE INTO usage_counters (user_id) VALUES (?)').run(userId);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const counters = db.prepare('SELECT * FROM usage_counters WHERE user_id = ?').get(userId);

  if (counters.last_reset_day !== today) {
    db.prepare('UPDATE usage_counters SET stories_today = 0, last_reset_day = ? WHERE user_id = ?').run(today, userId);
    counters.stories_today = 0;
  }
  if (counters.last_reset_month !== thisMonth) {
    db.prepare('UPDATE usage_counters SET stories_month = 0, images_month = 0, compiles_month = 0, last_reset_month = ? WHERE user_id = ?').run(thisMonth, userId);
    counters.stories_month = 0;
  }

  if (counters.stories_today >= limits.storiesPerDay) {
    return { allowed: false, reason: `Daily limit of ${limits.storiesPerDay} stories reached. Resets at midnight.` };
  }
  if (limits.storiesPerMonth !== -1 && counters.stories_month >= limits.storiesPerMonth) {
    return { allowed: false, reason: `Monthly limit of ${limits.storiesPerMonth} stories reached.` };
  }
  return { allowed: true, limits };
}

function incrementStoryCount(userId) {
  db.prepare('UPDATE usage_counters SET stories_today = stories_today + 1, stories_month = stories_month + 1 WHERE user_id = ?').run(userId);
}

// ── Character Generation Prompts ──────────────────────────────────────────────
function buildCharacterSystemPrompt() {
  return `You are a Filipino children's book character creator. Create warm, culturally authentic characters.
Rules:
- Filipino language terms: use Nanay, Tatay, Lola, Lolo, Kuya, Ate — NOT Ina, Ama
- NEVER rhyme unless asked
- Output valid JSON only, no markdown fences`;
}

function buildCharacterUserPrompt({ name, type, customType, traits, distinctiveFeature, ageRange, language }) {
  return `Create a character profile for a Filipino children's book.
Name: ${name}
Type: ${type}${customType ? ` (Custom: ${customType})` : ''}
Personality traits: ${(traits || []).join(', ') || 'Mabait'}
Distinctive feature: ${distinctiveFeature || 'none specified'}
Age range of readers: ${ageRange || '4-6'}
Story language: ${language || 'English'}

Output this exact JSON:
{
  "name": "${name}",
  "type": "${type}",
  "personalityDescription": "2-3 sentences about personality",
  "appearance": "2-3 sentences describing physical look",
  "funFact": "one fun sentence about the character",
  "catchphrase": "short memorable phrase in ${language || 'English'}",
  "catchphraseEnglish": "English translation (null if language is English)",
  "stats": { "bravery": 0-100, "curiosity": 0-100, "kindness": 0-100, "creativity": 0-100 },
  "designPrompt": "Detailed AI art prompt for character design: whimsical digital illustration, soft rounded shapes, flat pastel color palette, subtle traditional watercolor texture, children's book illustration style, warm and friendly atmosphere"
}`;
}

// ── Story Generation Prompts ──────────────────────────────────────────────────
function buildStorySystemPrompt(language, ageRange) {
  const maxWords = { '2-4': 8, '3-5': 12, '4-6': 16, '5-7': 18, '6-8': 20 }[ageRange] || 16;
  const langRules = language === 'Filipino' || language === 'Tagalog'
    ? 'Use conversational Filipino as spoken at home. Use Nanay, Tatay, Lola, Lolo — NOT Ina, Ama. Never use textbook Filipino.'
    : language === 'Cebuano' ? 'Use natural Bisaya as spoken in Cebu/Visayas.'
    : language === 'Ilocano' ? 'Use natural, simple, warm Ilocano rural tone.'
    : language === 'Taglish' ? 'Use natural code-switching Taglish as Filipinos speak day-to-day.'
    : 'Use natural, warm, engaging English children\'s prose.';

  return `You are a Filipino children's book author. Write warm, engaging stories with cultural authenticity.
Language rules: ${langRules}
Sentence length: maximum ${maxWords} words per sentence.
NEVER rhyme unless explicitly asked. Write natural narrative prose.
Cultural authenticity: include naturally where appropriate — sinigang, adobo, bibingka, halo-halo, pan de sal, jeepney, tricycle, sari-sari store, bahay kubo, sampaguita.
Output valid JSON only. No markdown fences.`;
}

function buildStoryUserPrompt({ character, tone, setting, settingFilipino, ageRange, pageCount, valuesCategory, specificLesson, causeEffectEnabled, language, isBilingual }) {
  return `Write a ${pageCount || 10}-page Filipino children's story with these parameters:

Character: ${JSON.stringify(character)}
Tone: ${tone}
Setting: ${settingFilipino || setting} (${setting})
Age range: ${ageRange}
Values: ${valuesCategory} — Lesson: ${specificLesson}
Cause & Effect: ${causeEffectEnabled ? 'YES — one wrong-choice moment on pages 4-6, gentle consequence, character grows' : 'NO'}
Language: ${language}
Bilingual: ${isBilingual ? 'YES — add English translation per page' : 'NO'}

Rules:
- Character name "${character.name}" on every page
- Personality traits reflected in actions
- Catchphrase "${character.catchphrase}" appears at least once
- Distinctive feature mentioned at least twice
- Cause & effect page: ages 2-4 = extremely mild, ages 5-8 = slightly more tangible

Output this exact JSON:
{
  "title": "Story title",
  "titleEnglish": "English title (null if not bilingual)",
  "backCoverSummary": "2-3 sentence teaser",
  "moral": "Moral of the story in ${language}",
  "moralEnglish": "English moral (null if not bilingual)",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Story text in ${language}",
      "textEnglish": "English translation (null if not bilingual)",
      "causeEffect": null,
      "illustrationIdea": "Brief scene for illustrator",
      "imagePrompt": "Full AI art prompt: [character] [scene] whimsical digital illustration, soft rounded shapes, flat pastel color palette, subtle traditional watercolor texture, children's book illustration style, warm and friendly atmosphere"
    }
  ],
  "characterBlueprintPrompt": "Full character reference prompt for consistent art generation"
}
Note: causeEffect is non-null ONLY on one page (pages 4-6): { "wrongChoice": "...", "consequence": "...", "resolution": "..." }`;
}

// ── Generation Routes ─────────────────────────────────────────────────────────
app.post('/api/generate-character', authMiddleware, genRateLimit, async (req, res) => {
  const { name, type, customType, traits, distinctiveFeature, age, ageRange, language } = req.body;
  if (!name) return res.status(400).json({ error: 'Character name is required' });

  try {
    const raw = await aiFactory.generateText(
      buildCharacterSystemPrompt(),
      buildCharacterUserPrompt({ name, type, customType, traits, distinctiveFeature, age, ageRange, language })
    );
    const character = safeParseAIJson(raw);

    db.prepare('INSERT INTO usage_log (user_id, action, provider, model) VALUES (?, ?, ?, ?)')
      .run(req.userId, 'character_generate',
        aiSettings.getActiveProvider('text')?.provider || 'unknown',
        aiSettings.getActiveProvider('text')?.model || 'unknown');

    res.json(character);
  } catch (err) {
    const isKeyError = /invalid.*api|authentication|unauthorized|quota|billing/i.test(err.message) || err.status === 401 || err.status === 403;
    if (isKeyError) {
      const config = aiSettings.getActiveProvider('text');
      if (config) {
        db.prepare('UPDATE ai_provider_settings SET last_test_ok = 0, last_test_msg = ? WHERE feature = ? AND provider = ?')
          .run(err.message, 'text', config.provider);
      }
      return res.status(503).json({ error: 'Story generation is temporarily unavailable. Please try again in a few minutes.' });
    }
    console.error('generate-character error:', err);
    res.status(500).json({ error: 'Character generation failed. Please try again.' });
  }
});

app.post('/api/generate-story', authMiddleware, genRateLimit, async (req, res) => {
  const { character, tone, setting, settingFilipino, ageRange, pageCount, valuesCategory, specificLesson, causeEffectEnabled, language, isBilingual } = req.body;
  if (!character || !character.name) return res.status(400).json({ error: 'Character profile is required' });
  if (!tone || !setting) return res.status(400).json({ error: 'Tone and setting are required' });

  const check = checkStoryLimit(req.userId);
  if (!check.allowed) return res.status(429).json({ error: check.reason });

  try {
    const raw = await aiFactory.generateText(
      buildStorySystemPrompt(language || 'English', ageRange || '4-6'),
      buildStoryUserPrompt({ character, tone, setting, settingFilipino, ageRange, pageCount, valuesCategory, specificLesson, causeEffectEnabled, language, isBilingual })
    );
    const story = safeParseAIJson(raw);
    incrementStoryCount(req.userId);

    db.prepare('INSERT INTO usage_log (user_id, action, provider, model) VALUES (?, ?, ?, ?)')
      .run(req.userId, 'story_generate',
        aiSettings.getActiveProvider('text')?.provider || 'unknown',
        aiSettings.getActiveProvider('text')?.model || 'unknown');

    res.json(story);
  } catch (err) {
    const isKeyError = /invalid.*api|authentication|unauthorized|quota|billing/i.test(err.message);
    if (isKeyError) {
      const config = aiSettings.getActiveProvider('text');
      if (config) db.prepare('UPDATE ai_provider_settings SET last_test_ok = 0, last_test_msg = ? WHERE feature = ? AND provider = ?').run(err.message, 'text', config.provider);
      return res.status(503).json({ error: 'Story generation is temporarily unavailable. Please try again in a few minutes.' });
    }
    console.error('generate-story error:', err);
    res.status(500).json({ error: 'Story generation failed. Please try again.' });
  }
});

app.post('/api/regenerate-page', authMiddleware, genRateLimit, async (req, res) => {
  const { character, pageNumber, tone, language, isBilingual, storyContext, ageRange } = req.body;
  if (!character || !pageNumber) return res.status(400).json({ error: 'character and pageNumber required' });

  const systemPrompt = buildStorySystemPrompt(language || 'English', ageRange || '4-6');
  const userPrompt = `Regenerate only page ${pageNumber} of a children's story.
Character: ${JSON.stringify(character)}
Story context (previous pages summary): ${storyContext || 'Beginning of story'}
Tone: ${tone || 'Gentle'}
Language: ${language || 'English'}
Bilingual: ${isBilingual ? 'YES' : 'NO'}

Output this exact JSON for ONE page only:
{
  "pageNumber": ${pageNumber},
  "text": "Story text",
  "textEnglish": null,
  "causeEffect": null,
  "illustrationIdea": "Brief scene",
  "imagePrompt": "Full AI art prompt"
}`;

  try {
    const raw = await aiFactory.generateText(systemPrompt, userPrompt);
    res.json(safeParseAIJson(raw));
  } catch (err) {
    const isKeyError = /invalid.*api|authentication|unauthorized|quota|billing/i.test(err.message);
    if (isKeyError) {
      const config = aiSettings.getActiveProvider('text');
      if (config) db.prepare('UPDATE ai_provider_settings SET last_test_ok = 0, last_test_msg = ? WHERE feature = ? AND provider = ?').run(err.message, 'text', config.provider);
      return res.status(503).json({ error: 'Story generation is temporarily unavailable. Please try again in a few minutes.' });
    }
    console.error('regenerate-page error:', err);
    res.status(500).json({ error: 'Page regeneration failed. Please try again.' });
  }
});

// ── OdooClient ────────────────────────────────────────────────────────────────
const xmlrpc = require('xmlrpc');

class OdooClient {
  constructor(primaryCfg, secondaryCfg) {
    this.primary = primaryCfg;
    this.secondary = secondaryCfg;
    this.active = 'primary';
    this.failoverCount = 0;
    this.lastFailover = null;
    this.primaryDown = false;
    this.secondaryDown = false;
    this.maintenanceSince = null;

    // Health check loop every 60s
    this._healthInterval = setInterval(() => this._healthCheck(), 60 * 1000).unref();
  }

  _makeClients(cfg) {
    const parsed = new URL(cfg.url);
    const opts = { host: parsed.hostname, port: parseInt(parsed.port) || 8069 };
    return {
      common: xmlrpc.createClient({ ...opts, path: '/xmlrpc/2/common' }),
      models: xmlrpc.createClient({ ...opts, path: '/xmlrpc/2/object' }),
    };
  }

  _call(client, method, params) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Odoo timeout')), 5000);
      client.methodCall(method, params, (err, val) => {
        clearTimeout(timer);
        err ? reject(err) : resolve(val);
      });
    });
  }

  async _authenticate(cfg) {
    const { common } = this._makeClients(cfg);
    return this._call(common, 'authenticate', [cfg.db, cfg.user, cfg.apiKey, {}]);
  }

  async execute(model, method, args, kwargs = {}) {
    // Try primary first
    try {
      const uid = await this._authenticate(this.primary);
      const { models } = this._makeClients(this.primary);
      const result = await this._call(models, 'execute_kw', [this.primary.db, uid, this.primary.apiKey, model, method, args, kwargs]);
      this.primaryDown = false;
      this.maintenanceSince = null;
      this.active = 'primary';
      return result;
    } catch (err) {
      console.warn(`[Odoo] Primary failed: ${err.message} — trying secondary`);
      if (!this.primaryDown) {
        this.primaryDown = true;
        this.failoverCount++;
        this.lastFailover = new Date().toISOString();
        this.active = 'secondary';
      }
    }

    // Try secondary
    try {
      const uid = await this._authenticate(this.secondary);
      const { models } = this._makeClients(this.secondary);
      const result = await this._call(models, 'execute_kw', [this.secondary.db, uid, this.secondary.apiKey, model, method, args, kwargs]);
      this.secondaryDown = false;
      return result;
    } catch (err) {
      console.warn(`[Odoo] Secondary also failed: ${err.message}`);
      this.secondaryDown = true;
      this.active = 'none';
      if (!this.maintenanceSince) this.maintenanceSince = new Date();
      throw new Error('Both Odoo instances unavailable');
    }
  }

  async _healthCheck() {
    try {
      const uid = await this._authenticate(this.primary);
      if (uid) { this.primaryDown = false; this.active = this.secondaryDown ? 'primary' : this.active; }
    } catch { this.primaryDown = true; }

    try {
      const uid = await this._authenticate(this.secondary);
      if (uid) this.secondaryDown = false;
    } catch { this.secondaryDown = true; }

    if (!this.primaryDown && !this.secondaryDown) {
      this.active = 'primary';
      this.maintenanceSince = null;
    }
  }

  isFullyDown() { return this.primaryDown && this.secondaryDown; }

  maintenanceGrantsAccess() {
    if (!this.maintenanceSince) return false;
    const hours = (Date.now() - this.maintenanceSince) / 3600000;
    return hours < 24;
  }

  getStatus() {
    const maintenanceUntil = this.maintenanceSince
      ? new Date(this.maintenanceSince.getTime() + 24 * 3600000).toISOString()
      : null;
    return {
      primary: this.primaryDown ? 'down' : 'up',
      secondary: this.secondaryDown ? 'down' : 'up',
      active: this.active,
      failoverCount: this.failoverCount,
      lastFailover: this.lastFailover,
      maintenanceUntil,
    };
  }

  queueSync(payload) {
    db.prepare('INSERT INTO odoo_sync_queue (payload) VALUES (?)').run(JSON.stringify(payload));
  }

  async flushSyncQueue() {
    const pending = db.prepare('SELECT * FROM odoo_sync_queue WHERE attempts < 5 ORDER BY created_at LIMIT 20').all();
    for (const item of pending) {
      try {
        const payload = JSON.parse(item.payload);
        await this.logUsageEvent(payload.userId, payload.action, payload.provider, payload.model, payload.tokensUsed);
        db.prepare('DELETE FROM odoo_sync_queue WHERE id = ?').run(item.id);
      } catch {
        db.prepare('UPDATE odoo_sync_queue SET attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP WHERE id = ?').run(item.id);
      }
    }
  }

  async createPartner(email, displayName) {
    return this.execute('res.partner', 'create', [{
      name: displayName,
      email,
      lang: 'en_US',
      comment: 'Kwento Ko user — registered via app',
    }]);
  }

  async getSubscriptionTier(email) {
    const partners = await this.execute('res.partner', 'search_read',
      [[['email', '=', email]]], { fields: ['id'], limit: 1 });
    if (!partners.length) return null;

    const partnerId = partners[0].id;
    const subs = await this.execute('sale.subscription', 'search_read',
      [[['partner_id', '=', partnerId], ['state', 'in', ['open', 'pending']]]],
      { fields: ['id', 'template_id', 'stage_id'], limit: 1 });

    if (!subs.length) return 'free';
    const templateName = subs[0].template_id?.[1] || '';
    if (templateName.toLowerCase().includes('business') || templateName.toLowerCase().includes('negosyo')) return 'business';
    if (templateName.toLowerCase().includes('pro')) return 'pro';
    if (templateName.toLowerCase().includes('lifetime')) return 'pro';
    return 'free';
  }

  async logUsageEvent(userId, action, provider, model, tokensUsed) {
    if (!this.primary.url || this.primary.url.includes('192.168.1.XX')) return;
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    if (!user) return;
    // Production: call Odoo to log usage event
  }
}

// Instantiate OdooClient (gracefully handles missing config)
const odooCfg = {
  primary: {
    url: process.env.ODOO_PRIMARY_URL || '',
    db: process.env.ODOO_PRIMARY_DB || 'odoo',
    user: process.env.ODOO_PRIMARY_USER || 'admin',
    apiKey: process.env.ODOO_PRIMARY_API || '',
  },
  secondary: {
    url: process.env.ODOO_SECONDARY_URL || '',
    db: process.env.ODOO_SECONDARY_DB || 'odoo',
    user: process.env.ODOO_SECONDARY_USER || 'admin',
    apiKey: process.env.ODOO_SECONDARY_API || '',
  },
};
const odoo = new OdooClient(odooCfg.primary, odooCfg.secondary);

// Flush Odoo sync queue every 5 minutes
setInterval(() => odoo.flushSyncQueue(), 5 * 60 * 1000).unref();

// ── Image Generation Route ────────────────────────────────────────────────────
app.post('/api/generate-image', authMiddleware, genRateLimit, async (req, res) => {
  const { promptText, customization, storyId, pageIndex } = req.body;
  if (!promptText) return res.status(400).json({ error: 'promptText is required' });

  const user = db.prepare('SELECT tier, is_tester, tester_limits FROM users WHERE id = ?').get(req.userId);
  const tier = user.tier || 'free';
  let limits;
  try {
    limits = user.is_tester && user.tester_limits ? JSON.parse(user.tester_limits) : null;
  } catch { limits = null; }
  limits = limits || TIER_LIMITS[tier] || TIER_LIMITS.free;

  if (limits.imagesPerMonth === 0) {
    return res.status(403).json({ error: 'Image generation is not available on the Free plan. Upgrade to Pro to generate images.' });
  }

  if (limits.imagesPerMonth !== -1) {
    db.prepare('INSERT OR IGNORE INTO usage_counters (user_id) VALUES (?)').run(req.userId);
    const counters = db.prepare('SELECT images_month FROM usage_counters WHERE user_id = ?').get(req.userId);
    if ((counters?.images_month || 0) >= limits.imagesPerMonth) {
      return res.status(429).json({ error: `Monthly image limit of ${limits.imagesPerMonth} reached.` });
    }
  }

  const finalPrompt = customization ? `${promptText}. ${customization}` : promptText;

  try {
    const base64 = await aiFactory.generateImage(finalPrompt);

    let savedId = null;
    if (storyId) {
      const imgProvider = aiSettings.getActiveProvider('image');
      const result = db.prepare(`
        INSERT INTO story_images (story_id, page_index, prompt_used, provider, model, image_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(storyId, pageIndex ?? null, finalPrompt,
        imgProvider?.provider || 'unknown',
        imgProvider?.model || 'unknown',
        base64);
      savedId = result.lastInsertRowid;
    }

    const imgProvider = aiSettings.getActiveProvider('image');
    db.prepare('UPDATE usage_counters SET images_month = images_month + 1 WHERE user_id = ?').run(req.userId);
    db.prepare('INSERT INTO usage_log (user_id, action, provider, model) VALUES (?, ?, ?, ?)')
      .run(req.userId, 'image_generate', imgProvider?.provider || 'unknown', imgProvider?.model || 'unknown');

    res.json({ imageBase64: base64, imageUrl: `data:image/png;base64,${base64}`, savedId });
  } catch (err) {
    console.error('generate-image error:', err);
    res.status(500).json({ error: 'Image generation failed. Please try again.' });
  }
});

// ── Book Compilation Route ────────────────────────────────────────────────────
app.post('/api/compile-book', authMiddleware, async (req, res) => {
  const { storyId, format, dedication, includeDiscussionGuide, includePrintGuide, layoutTemplate, removeBranding, emailPDF } = req.body;
  if (!storyId || !format) return res.status(400).json({ error: 'storyId and format are required' });

  const user = db.prepare('SELECT tier, is_tester, tester_limits, email, display_name FROM users WHERE id = ?').get(req.userId);
  const tier = user.tier || 'free';
  let limits;
  try {
    limits = user.is_tester && user.tester_limits ? JSON.parse(user.tester_limits) : null;
  } catch { limits = null; }
  limits = limits || TIER_LIMITS[tier] || TIER_LIMITS.free;
  if (!limits.canCompileBook) return res.status(403).json({ error: 'Book compilation requires a Pro or Business plan.' });

  const story = db.prepare('SELECT * FROM stories WHERE id = ? AND user_id = ?').get(storyId, req.userId);
  if (!story) return res.status(404).json({ error: 'Story not found' });

  const storyData = JSON.parse(story.story_data);
  const images = db.prepare('SELECT page_index, image_data FROM story_images WHERE story_id = ?').all(storyId);
  const imageMap = {};
  images.forEach(img => { imageMap[img.page_index] = img.image_data; });

  try {
    const layoutJSON = await aiFactory.generateLayout(storyData, format, layoutTemplate || 'Classic');

    const formatDims = {
      'A5 Booklet on A4':  { width: '297mm', height: '210mm' },
      'A4 Portrait':       { width: '210mm', height: '297mm' },
      'US Letter / KDP':   { width: '6in',   height: '9in'   },
      'Square 8x8':        { width: '8in',   height: '8in'   },
    };
    const dims = formatDims[format] || { width: '210mm', height: '297mm' };

    const showWatermark = limits.watermark && !removeBranding;
    const showBranding  = !removeBranding && tier !== 'business';

    const printInstructions = {
      'A5 Booklet on A4': 'Step 1: Select "Print on both sides"\nStep 2: Set flip to "Short edge"\nStep 3: Select "Booklet" layout\nStep 4: Fold and staple in the middle',
      'A4 Portrait':       'Step 1: Select A4 paper size\nStep 2: Print single-sided or double-sided\nStep 3: Bind pages together',
      'US Letter / KDP':   'Step 1: Upload this PDF to kdp.amazon.com\nStep 2: Select 6×9 inch trim size\nStep 3: Follow KDP interior upload instructions',
      'Square 8x8':        'Step 1: Upload to your preferred photo book service\nStep 2: Select 8×8 inch square format\nStep 3: Print and enjoy!',
    }[format] || '';

    const pagesHtml = storyData.pages?.map(page => {
      const imgData = imageMap[page.pageNumber];
      const imgHtml = imgData ? `<img src="data:image/png;base64,${imgData}" style="max-width:100%;max-height:45%;object-fit:contain;" />` : '';
      const causeEffectHtml = page.causeEffect ? `
        <div style="background:#FFF3CD;border-left:4px solid #FF9800;padding:8px;margin:8px 0;font-size:0.85em;">
          <strong>Cause &amp; Effect:</strong> ${page.causeEffect.wrongChoice} → ${page.causeEffect.consequence} → ${page.causeEffect.resolution}
        </div>` : '';
      return `
        <div class="page" style="page-break-before:always;padding:20mm;font-family:Georgia,serif;">
          <div style="text-align:right;font-size:0.8em;color:#999;">Page ${page.pageNumber}</div>
          ${imgHtml}
          <p style="font-size:${layoutJSON.storyPages?.textFontSize || 16}pt;line-height:${layoutJSON.storyPages?.lineHeight || 1.6};">${page.text}</p>
          ${page.textEnglish ? `<p style="font-size:${layoutJSON.storyPages?.translationFontSize || 13}pt;color:#555;font-style:italic;">${page.textEnglish}</p>` : ''}
          ${causeEffectHtml}
          ${showWatermark ? '<div style="position:fixed;bottom:5mm;right:5mm;font-size:8pt;color:#ccc;opacity:0.5;">Created with Kwento Ko</div>' : ''}
        </div>`;
    }).join('') || '';

    const discussionGuideHtml = (includeDiscussionGuide && storyData.discussionGuide) ? `
      <div class="page" style="page-break-before:always;padding:20mm;">
        <h2>Discussion Guide</h2>
        <pre style="white-space:pre-wrap;">${JSON.stringify(storyData.discussionGuide, null, 2)}</pre>
      </div>` : '';

    const printGuideHtml = includePrintGuide ? `
      <div class="page" style="page-break-before:always;padding:20mm;">
        <h2>How to Print This Book</h2>
        <pre style="white-space:pre-wrap;">${printInstructions}</pre>
      </div>` : '';

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        @page { size: ${dims.width} ${dims.height}; margin: 0; }
        body { margin: 0; font-family: 'Nunito', Georgia, serif; }
        .page { width: ${dims.width}; min-height: ${dims.height}; box-sizing: border-box; }
      </style>
    </head><body>
      <!-- Cover -->
      <div class="page" style="background:${layoutJSON.coverPage?.backgroundColor || '#FFF8E1'};padding:20mm;display:flex;flex-direction:column;justify-content:center;align-items:center;">
        <h1 style="font-size:${layoutJSON.coverPage?.titleFontSize || 32}pt;color:${layoutJSON.coverPage?.accentColor || '#FF6B6B'};text-align:center;">${storyData.title || story.title}</h1>
        <p style="font-size:16pt;">By ${user.display_name}</p>
        ${showBranding ? '<p style="font-size:10pt;color:#999;">Created with Kwento Ko | alibebeph.com</p>' : ''}
      </div>
      <!-- Dedication -->
      <div class="page" style="page-break-before:always;padding:20mm;display:flex;align-items:center;justify-content:center;">
        <p style="font-style:italic;font-size:14pt;text-align:center;">${dedication ? `This book is dedicated to...<br><br>${dedication}` : 'This book is dedicated to all the little dreamers.'}</p>
      </div>
      ${printGuideHtml}
      ${pagesHtml}
      <!-- Moral -->
      <div class="page" style="page-break-before:always;background:${layoutJSON.coverPage?.accentColor || '#FF6B6B'};padding:20mm;display:flex;align-items:center;justify-content:center;">
        <div style="text-align:center;color:white;">
          <h2>Moral of the Story</h2>
          <p style="font-size:16pt;">${storyData.moral || ''}</p>
          ${storyData.moralEnglish ? `<p style="font-size:13pt;opacity:0.85;">${storyData.moralEnglish}</p>` : ''}
        </div>
      </div>
      ${discussionGuideHtml}
      <!-- Back Cover -->
      <div class="page" style="page-break-before:always;padding:20mm;text-align:center;">
        <p>${storyData.backCoverSummary || ''}</p>
        <p style="font-size:10pt;color:#999;">© 2025 Crafts by AlibebePH | alibebeph.com | All rights reserved.</p>
      </div>
    </body></html>`;

    const puppeteer = require('puppeteer-core');
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ width: dims.width, height: dims.height, printBackground: true });
    await browser.close();

    db.prepare('UPDATE usage_counters SET compiles_month = compiles_month + 1 WHERE user_id = ?').run(req.userId);
    db.prepare('INSERT INTO usage_log (user_id, action, provider, model) VALUES (?, ?, ?, ?)')
      .run(req.userId, 'book_compile', 'puppeteer', 'chromium');

    if (emailPDF && process.env.SMTP_USER) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      transporter.sendMail({
        from: process.env.SMTP_USER,
        to: user.email,
        subject: `Your Kwento Ko book: ${story.title}`,
        text: 'Your compiled book is attached!',
        attachments: [{ filename: `${story.title}.pdf`, content: pdfBuffer }],
      }).catch(err => console.error('Email PDF error:', err));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${story.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('compile-book error:', err);
    res.status(500).json({ error: 'Book compilation failed. Please try again.' });
  }
});
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
