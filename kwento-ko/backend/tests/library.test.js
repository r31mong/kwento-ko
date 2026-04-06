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

let token, storyId;

const sampleStory = {
  title: 'Si Miko at ang Mahiwagang Bundok',
  language: 'Filipino',
  tone: 'Adventurous',
  ageRange: '4-6',
  characterName: 'Miko',
  pageCount: 10,
  storyData: JSON.stringify({ title: 'Si Miko', pages: [] }),
};

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'library@test.com', password: 'pass1234', displayName: 'Library' });
  token = res.body.token;
});

describe('POST /api/library', () => {
  it('saves a story', async () => {
    const res = await request(app)
      .post('/api/library')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleStory);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    storyId = res.body.id;
  });
});

describe('GET /api/library', () => {
  it('returns user stories', async () => {
    const res = await request(app)
      .get('/api/library')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stories)).toBe(true);
    expect(res.body.stories.length).toBeGreaterThan(0);
  });
});

describe('GET /api/library/:id', () => {
  it('returns a specific story', async () => {
    const res = await request(app)
      .get(`/api/library/${storyId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe(sampleStory.title);
  });

  it("returns 404 for another user's story", async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'pass1234', displayName: 'Other' });
    const res = await request(app)
      .get(`/api/library/${storyId}`)
      .set('Authorization', `Bearer ${other.body.token}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/library/:id', () => {
  it('updates a story', async () => {
    const res = await request(app)
      .put(`/api/library/${storyId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('DELETE /api/library/:id', () => {
  it('deletes a story', async () => {
    const res = await request(app)
      .delete(`/api/library/${storyId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
