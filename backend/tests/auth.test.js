const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');

const createPhone = () => `138${String(Date.now()).slice(-8)}`;

describe('Auth API', () => {
  const testUser = {
    username: `testuser_${Date.now()}`,
    password: 'password123',
    phone: createPhone(),
    realName: 'Test User',
    organizationId: '00000000-0000-0000-0000-000000000001'
  };

  beforeAll(async () => {
    await db.query(`
      INSERT INTO organizations (id, name, code, type, status)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Test Org', 'TEST001', 'retailer', 'active')
      ON CONFLICT DO NOTHING
    `);
    await db.query('DELETE FROM users WHERE username = $1 OR phone = $2', [
      testUser.username,
      testUser.phone
    ]);
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE username = $1 OR phone = $2', [
      testUser.username,
      testUser.phone
    ]);
    await db.query("DELETE FROM organizations WHERE code = 'TEST001'");
    await db.pool.end();
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: testUser.username,
        password: testUser.password,
        phone: testUser.phone,
        realName: testUser.realName,
        organizationId: testUser.organizationId
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.username).toEqual(testUser.username);
  });

  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should not login with invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: 'wrongpassword'
      });

    expect(res.statusCode).toEqual(401);
  });
});
