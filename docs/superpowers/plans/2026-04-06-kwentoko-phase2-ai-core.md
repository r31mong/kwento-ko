# KwentoKo Phase 2 — AI Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Prerequisite:** Phase 1 complete (`2026-04-06-kwentoko-phase1-foundation.md`).

**Goal:** Implement AISettingsManager, all AI provider clients, and the story + character generation endpoints — making Kwento Ko capable of generating Filipino children's stories.

**Architecture:** `AISettingsManager` is a class instance in `server.js` that caches decrypted AI provider settings from SQLite with a 5-min TTL. `AIProviderFactory` reads from that cache and exposes a unified `generate()` interface for text, image, and compile features. Generation endpoints validate subscription limits before calling AI.

**Tech Stack:** @google/generative-ai, node-fetch (built-in via Node 20), @fal-ai/client, replicate, crypto (AES-256)

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `kwento-ko/backend/server.js` | Modify | Add AISettingsManager class, AIProviderFactory, admin AI settings routes, rate-limited generation routes |
| `kwento-ko/backend/tests/ai-settings.test.js` | Create | Tests for admin AI settings CRUD + test-connection endpoint |
| `kwento-ko/backend/tests/generation.test.js` | Create | Tests for generate-character and generate-story endpoints (mock AI calls) |

---

## Task 4: AISettingsManager + Admin AI Settings Routes

**Files:**
- Modify: `kwento-ko/backend/server.js` — add after auth routes
- Create: `kwento-ko/backend/tests/ai-settings.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// kwento-ko/backend/tests/ai-settings.test.js
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-min-32-chars-here-ok';
process.env.AI_ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'testpass';
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-gemini-key-1234';
process.env.TEXT_AI_PROVIDER = 'gemini';
process.env.IMAGE_AI_PROVIDER = 'gemini';
process.env.COMPILE_AI_PROVIDER = 'gemini';

const request = require('supertest');
const { app } = require('../server');

let adminToken;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/admin/login')
    .send({ email: 'admin@test.com', password: 'testpass' });
  adminToken = res.body.token;
});

describe('GET /api/admin/ai-settings', () => {
  it('returns all providers grouped by feature', async () => {
    const res = await request(app)
      .get('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.text).toBeDefined();
    expect(res.body.image).toBeDefined();
    expect(res.body.compile).toBeDefined();
    expect(Array.isArray(res.body.text)).toBe(true);
    // Gemini should be seeded and active
    const gemini = res.body.text.find(p => p.provider === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini.is_active).toBe(true);
  });

  it('never returns api_key_enc or decrypted key', async () => {
    const res = await request(app)
      .get('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${adminToken}`);
    const allProviders = [...res.body.text, ...res.body.image, ...res.body.compile];
    allProviders.forEach(p => {
      expect(p.api_key_enc).toBeUndefined();
      expect(p.apiKey).toBeUndefined();
    });
  });

  it('returns 401 without admin token', async () => {
    const res = await request(app).get('/api/admin/ai-settings');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/admin/ai-settings/:feature/active', () => {
  it('switches active provider for a feature', async () => {
    const res = await request(app)
      .put('/api/admin/ai-settings/text/active')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provider: 'openrouter' });
    expect(res.status).toBe(200);
    expect(res.body.activeProvider).toBe('openrouter');
  });
});

describe('PUT /api/admin/ai-settings/:feature/:provider', () => {
  it('updates model without requiring a new key', async () => {
    const res = await request(app)
      .put('/api/admin/ai-settings/text/gemini')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ model: 'gemini-1.5-flash' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('GET /api/admin/ai-settings/audit', () => {
  it('returns audit log entries', async () => {
    const res = await request(app)
      .get('/api/admin/ai-settings/audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npx jest tests/ai-settings.test.js --no-coverage
```

Expected: FAIL — routes return 404.

- [ ] **Step 3: Add AISettingsManager class to server.js**

Add after the auth routes section in `server.js`:

```javascript
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
    updates.updated_at = new Date().toISOString();
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

    db.prepare('UPDATE ai_provider_settings SET is_active = 0 WHERE feature = ?').run(feature);
    db.prepare('UPDATE ai_provider_settings SET is_active = 1 WHERE feature = ? AND provider = ?').run(feature, provider);
    db.prepare(`
      INSERT INTO ai_key_audit_log (feature, provider, action, result, admin_email, ip_address)
      VALUES (?, ?, 'provider_switched', 'success', ?, ?)
    `).run(feature, provider, adminEmail, ipAddress);

    this.refreshCache();
    return { ok: true };
  }

  async testConnection(feature, provider, apiKey, model, extraConfig = {}) {
    const start = Date.now();
    const key = apiKey === '__USE_STORED__'
      ? (() => { const row = db.prepare('SELECT api_key_enc FROM ai_provider_settings WHERE feature = ? AND provider = ?').get(feature, provider); return row ? decryptKey(row.api_key_enc) : null; })()
      : apiKey;

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
setInterval(() => aiSettings.refreshCache(), 5 * 60 * 1000);
```

- [ ] **Step 4: Add admin AI settings routes to server.js**

Add immediately after the AISettingsManager instance:

```javascript
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npx jest tests/ai-settings.test.js --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo
git add kwento-ko/backend/server.js kwento-ko/backend/tests/ai-settings.test.js
git commit -m "feat: add AISettingsManager class and admin AI provider management API"
```

---

## Task 5: AIProviderFactory + Story Generation Routes

**Files:**
- Modify: `kwento-ko/backend/server.js` — add AIProviderFactory + generation rate limiter + story routes
- Create: `kwento-ko/backend/tests/generation.test.js`

- [ ] **Step 1: Write failing generation tests**

```javascript
// kwento-ko/backend/tests/generation.test.js
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-min-32-chars-here-ok';
process.env.AI_ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'testpass';
process.env.NODE_ENV = 'test';
process.env.TEXT_AI_PROVIDER = 'gemini';
process.env.IMAGE_AI_PROVIDER = 'gemini';
process.env.COMPILE_AI_PROVIDER = 'gemini';

// Mock the AI call so tests don't need real keys
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            name: 'Miko',
            type: 'Animal Friend',
            personalityDescription: 'Miko is brave and curious.',
            appearance: 'A small brown fox with bright orange ears.',
            funFact: 'Miko can run faster than a jeepney!',
            catchphrase: 'Kaya ko yan!',
            catchphraseEnglish: 'I can do it!',
            stats: { bravery: 80, curiosity: 90, kindness: 70, creativity: 60 },
            designPrompt: 'A small brown fox...'
          })
        }
      })
    })
  }))
}));

const request = require('supertest');
const { app } = require('../server');

let userToken;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'gen@test.com', password: 'pass1234', displayName: 'Generator' });
  userToken = res.body.token;
});

describe('POST /api/generate-character', () => {
  it('returns character profile for free user', async () => {
    const res = await request(app)
      .post('/api/generate-character')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Miko',
        type: 'Animal Friend',
        traits: ['Matapang', 'Mausisa'],
        ageRange: '4-6',
        language: 'English',
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Miko');
    expect(res.body.catchphrase).toBeTruthy();
    expect(res.body.stats).toBeDefined();
    expect(res.body.designPrompt).toBeTruthy();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/generate-character').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/generate-story', () => {
  it('returns 400 if character missing', async () => {
    const res = await request(app)
      .post('/api/generate-story')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ tone: 'Funny', setting: 'Lungsod' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npx jest tests/generation.test.js --no-coverage
```

Expected: FAIL — routes return 404.

- [ ] **Step 3: Add AIProviderFactory and helper functions to server.js**

Add after the admin AI settings routes section:

```javascript
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
```

- [ ] **Step 4: Add subscription check helper and generation routes**

Add after the AIProviderFactory:

```javascript
// ── Generation Rate Limiter ───────────────────────────────────────────────────
const genRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyGenerator: req => req.ip });

// ── Subscription Limit Check ──────────────────────────────────────────────────
function checkStoryLimit(userId) {
  const user = db.prepare('SELECT tier, is_tester, tester_limits FROM users WHERE id = ?').get(userId);
  if (!user) return { allowed: false, reason: 'User not found' };

  const tier = user.tier || 'free';
  const limits = user.is_tester && user.tester_limits
    ? JSON.parse(user.tester_limits)
    : TIER_LIMITS[tier] || TIER_LIMITS.free;

  if (limits.storiesPerDay === -1) return { allowed: true, limits };

  // Ensure counters exist
  db.prepare('INSERT OR IGNORE INTO usage_counters (user_id) VALUES (?)').run(userId);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const counters = db.prepare('SELECT * FROM usage_counters WHERE user_id = ?').get(userId);

  // Reset counters if stale
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
  if (counters.stories_month >= limits.storiesPerMonth) {
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

    // Log usage
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
  const { character, pageNumber, tone, language, isBilingual, storyContext } = req.body;
  if (!character || !pageNumber) return res.status(400).json({ error: 'character and pageNumber required' });

  const systemPrompt = buildStorySystemPrompt(language || 'English', '4-6');
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
    console.error('regenerate-page error:', err);
    res.status(500).json({ error: 'Page regeneration failed. Please try again.' });
  }
});
```

- [ ] **Step 5: Run generation tests**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npx jest tests/generation.test.js --no-coverage
```

Expected: All tests PASS (AI calls are mocked).

- [ ] **Step 6: Run full test suite**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo/kwento-ko/backend
npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
cd /home/r31mong/Claude/Projects/KwentoKo
git add kwento-ko/backend/server.js kwento-ko/backend/tests/generation.test.js
git commit -m "feat: add AIProviderFactory, story/character generation endpoints with subscription gating"
```

---

> **Phase 2 complete.** Story generation works end-to-end with real AI providers. Proceed to `2026-04-06-kwentoko-phase3-backend-features.md`.
