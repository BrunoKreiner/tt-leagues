// Ensure env is set before requiring the database/app singletons.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = ''; // force SQLite in tests
process.env.DATABASE_PATH = `/tmp/league-badges-test-${Date.now()}.db`;

const fs = require('fs');
const request = require('supertest');
const app = require('../src/app');
const database = require('../src/models/database');

describe('Badges (private ownership)', () => {
  let userToken;
  let userId;
  let badgeId;

  beforeAll(async () => {
    try {
      fs.rmSync(process.env.DATABASE_PATH, { force: true });
    } catch (_) {}
    await database.initialize();

    const register = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'badge_user',
        password: 'password123',
        first_name: 'Badge',
        last_name: 'Owner',
        email: 'badge.owner@example.com',
      });

    expect(register.status).toBe(201);
    userToken = register.body.token;
    userId = register.body.user.id;
  });

  afterAll(async () => {
    await database.close();
    try {
      fs.rmSync(process.env.DATABASE_PATH, { force: true });
    } catch (_) {}
  });

  test('non-admin can create private badge (public request forced private)', async () => {
    const res = await request(app)
      .post('/api/badges')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Private Triumph',
        description: 'Created by non-admin',
        icon: 'trophy',
        badge_type: 'achievement',
        visibility: 'public',
      });

    expect(res.status).toBe(201);
    expect(res.body.badge).toHaveProperty('visibility', 'private');
    expect(res.body.badge).toHaveProperty('created_by', userId);
    badgeId = res.body.badge.id;
  });

  test('badge owner can update private badge', async () => {
    const res = await request(app)
      .put(`/api/badges/${badgeId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Private Triumph Updated',
        description: 'Owner updated',
        icon: 'medal',
        badge_type: 'achievement',
      });

    expect(res.status).toBe(200);
    expect(res.body.badge).toHaveProperty('name', 'Private Triumph Updated');
  });

  test('non-owner cannot update private badge', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'other_user',
        password: 'password123',
        first_name: 'Other',
        last_name: 'User',
        email: 'other.user@example.com',
      });

    expect(register.status).toBe(201);
    const otherToken = register.body.token;

    const res = await request(app)
      .put(`/api/badges/${badgeId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        name: 'Not Allowed',
      });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Only the badge owner may edit this badge');
  });

  test('badge owner can delete private badge', async () => {
    const res = await request(app)
      .delete(`/api/badges/${badgeId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});
