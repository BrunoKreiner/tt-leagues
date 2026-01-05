// Ensure env is set before requiring the database/app singletons.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = ''; // force SQLite in tests
process.env.DATABASE_PATH = `/tmp/league-moderation-test-${Date.now()}.db`;

const fs = require('fs');
const request = require('supertest');
const app = require('../src/app');
const database = require('../src/models/database');

describe('Content moderation', () => {
  beforeAll(async () => {
    try {
      fs.rmSync(process.env.DATABASE_PATH, { force: true });
    } catch (_) {}
    await database.initialize();
  });

  afterAll(async () => {
    await database.close();
    try {
      fs.rmSync(process.env.DATABASE_PATH, { force: true });
    } catch (_) {}
  });

  test('blocks profane registration fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'boob',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'PROFANITY_TEXT');
  });

  test('fails closed when image moderation is not configured', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'clean_user',
        password: 'password123',
        first_name: 'Clean',
        last_name: 'User',
        email: 'clean@example.com',
      });
    expect(register.status).toBe(201);
    const token = register.body.token;
    const userId = register.body.user.id;

    const update = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        avatar_url: 'data:image/png;base64,AAAA',
      });

    expect(update.status).toBe(503);
    expect(update.body).toHaveProperty('code', 'MODERATION_NOT_CONFIGURED');
  });
});

