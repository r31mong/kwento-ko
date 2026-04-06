process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-min-32-chars-here-ok';
process.env.AI_ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'testpass';
process.env.NODE_ENV = 'test';
process.env.TEXT_AI_PROVIDER = 'gemini';
process.env.IMAGE_AI_PROVIDER = 'gemini';
process.env.COMPILE_AI_PROVIDER = 'gemini';

const request = require('supertest');
const { app } = require('../server');

let adminToken, userId;

beforeAll(async () => {
  const adminRes = await request(app)
    .post('/api/admin/login')
    .send({ email: 'admin@test.com', password: 'testpass' });
  adminToken = adminRes.body.token;

  const userRes = await request(app)
    .post('/api/auth/register')
    .send({ email: 'target@test.com', password: 'pass1234', displayName: 'Target' });
  userId = userRes.body.user.id;
});

describe('GET /api/admin/overview', () => {
  it('returns overview stats', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(res.body.todayStories).toBeDefined();
  });
});

describe('GET /api/admin/users', () => {
  it('returns paginated user list', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});

describe('PUT /api/admin/users/:id/tier', () => {
  it('upgrades a user tier', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${userId}/tier`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tier: 'pro' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('POST /api/admin/users/:id/tester', () => {
  it('assigns tester status with custom limits', async () => {
    const res = await request(app)
      .post(`/api/admin/users/${userId}/tester`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ storiesPerDay: 50, storiesPerMonth: 500, imagesPerMonth: 100, note: 'Beta tester' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('GET /api/health', () => {
  it('returns health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(['ok', 'degraded', 'maintenance']).toContain(res.body.status);
    expect(res.body.odoo).toBeDefined();
    expect(res.body.ai).toBeDefined();
  });
});

describe('POST /api/promo/validate', () => {
  it('returns valid=false for non-existent code', async () => {
    const res = await request(app)
      .post('/api/promo/validate')
      .send({ code: 'FAKE123', tier: 'pro', billingCycle: 'monthly' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });
});
