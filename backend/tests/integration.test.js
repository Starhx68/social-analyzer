require('dotenv').config();
const request = require('supertest');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const app = require('../src/index');
const db = require('../src/config/database');

const createPhone = () => `139${String(Date.now()).slice(-8)}`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

describe('API Integration Tests', () => {
  let authToken;
  let adminToken;
  let testOrderId;
  let orgId;
  const testUser = {
    username: `testuser_${Date.now()}`,
    password: 'test123',
    phone: createPhone(),
    realName: 'Test User'
  };
  const adminUser = {
    username: `adminuser_${Date.now()}`,
    password: 'admin123',
    phone: createPhone(),
    realName: 'Admin User'
  };

  beforeAll(async () => {
    console.log('Setup: Starting database connection...');
    const client = await pool.connect();
    client.release();
    console.log('Setup: Database connected successfully');

    const orgResult = await pool.query(
      `INSERT INTO organizations (name, code, type, contact_person, contact_phone, district, status)
       VALUES ('测试单位', 'DEMO001', 'retailer', '李四', '13900000000', '长沙市芙蓉区', 'active')
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    orgId = orgResult.rows[0].id;

    await pool.query('DELETE FROM users WHERE username IN ($1, $2) OR phone IN ($3, $4)', [
      testUser.username,
      adminUser.username,
      testUser.phone,
      adminUser.phone
    ]);

    const hashedUserPassword = await bcrypt.hash(testUser.password, 10);
    const hashedAdminPassword = await bcrypt.hash(adminUser.password, 10);

    await pool.query(
      `INSERT INTO users (username, password_hash, phone, real_name, role, organization_id, status)
       VALUES ($1, $2, $3, $4, 'user', $5, 'active')`,
      [testUser.username, hashedUserPassword, testUser.phone, testUser.realName, orgId]
    );

    await pool.query(
      `INSERT INTO users (username, password_hash, phone, real_name, role, organization_id, status)
       VALUES ($1, $2, $3, $4, 'admin', $5, 'active')`,
      [adminUser.username, hashedAdminPassword, adminUser.phone, adminUser.realName, orgId]
    );

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: testUser.password });
    authToken = userLogin.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: adminUser.username, password: adminUser.password });
    adminToken = adminLogin.body.token;
  });

  afterAll(async () => {
    if (testOrderId) {
      await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
    }
    await pool.query('DELETE FROM users WHERE username IN ($1, $2) OR phone IN ($3, $4)', [
      testUser.username,
      adminUser.username,
      testUser.phone,
      adminUser.phone
    ]);
    await pool.end();
    await db.pool.end();
  });

  describe('Health Check', () => {
    test('GET /health should return status ok', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Authentication', () => {
    test('POST /api/auth/login - should fail with invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ username: testUser.username, password: 'wrongpass' })
        .expect(401);
    });

    test('GET /api/auth/me - should get current user info', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user).toHaveProperty('username', testUser.username);
    });
  });

  describe('Orders', () => {
    test('POST /api/orders - should create a new order', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mchntOrdNo: 'TEST-' + Date.now(),
          plateType: 'home_appliance',
          productName: 'Test Product',
          productModel: 'Model X',
          productCategory: '家电',
          productBrand: 'TestBrand',
          productQuantity: 1,
          productPrice: 1000,
          productTotalAmount: 1000
        })
        .expect(201);

      expect(response.body).toHaveProperty('message', '订单创建成功');
      expect(response.body.order).toHaveProperty('id');
      testOrderId = response.body.order.id;
    });

    test('GET /api/orders - should list orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.orders)).toBe(true);
    });

    test('GET /api/orders/:id - should get order by id', async () => {
      if (!testOrderId) return;

      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testOrderId);
    });
  });

  describe('Users', () => {
    test('GET /api/users - should list users (admin only)', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.users)).toBe(true);
    });
  });

  describe('Organizations', () => {
    test('GET /api/organizations - should list organizations', async () => {
      const response = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.organizations)).toBe(true);
    });
  });

  describe('Reports', () => {
    test('GET /api/reports/logs - should list reports', async () => {
      const response = await request(app)
        .get('/api/reports/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.logs)).toBe(true);
    });
  });
});
