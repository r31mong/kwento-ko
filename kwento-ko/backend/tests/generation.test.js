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
