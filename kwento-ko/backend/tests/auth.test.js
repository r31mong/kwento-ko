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

  it('seeds system_settings defaults', () => {
    const count = db.prepare("SELECT COUNT(*) as n FROM system_settings").get().n;
    expect(count).toBe(8);
  });

  it('seeds ai_provider_settings rows', () => {
    const count = db.prepare("SELECT COUNT(*) as n FROM ai_provider_settings").get().n;
    expect(count).toBe(9);
  });
});

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
