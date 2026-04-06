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
