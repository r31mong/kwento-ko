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
