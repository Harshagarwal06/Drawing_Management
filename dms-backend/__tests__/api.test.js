const request = require('supertest');
const jwt = require('jsonwebtoken');

// Set test env before requiring server
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-ci';
process.env.DB_PATH = ':memory:';

const { app, db } = require('../server');

let directorToken;
let architectToken;
let teamToken;

beforeAll(async () => {
  // Login as each role to get tokens
  const dirRes = await request(app)
    .post('/api/login')
    .send({ username: 'director', password: 'Unique123!' });
  directorToken = dirRes.body.token;

  const archRes = await request(app)
    .post('/api/login')
    .send({ username: 'architect', password: 'arch123' });
  architectToken = archRes.body.token;

  const teamRes = await request(app)
    .post('/api/login')
    .send({ username: 'team', password: 'team123' });
  teamToken = teamRes.body.token;
});

afterAll(() => {
  db.close();
});

describe('GET /api/health', () => {
  it('returns ok without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
  });
});

describe('POST /api/login', () => {
  it('returns token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'director', password: 'Unique123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe('Director');
    expect(res.body.username).toBe('director');
  });

  it('rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'director', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown username', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'nobody', password: 'test' });
    expect(res.status).toBe(401);
  });
});

describe('Auth middleware', () => {
  it('blocks requests without token', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('blocks requests with invalid token', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/projects', () => {
  it('returns projects for director', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns filtered projects for team member', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${teamToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('RBAC — Director-only routes', () => {
  it('allows director to list users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('blocks architect from listing users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${architectToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks team from listing users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${teamToken}`);
    expect(res.status).toBe(403);
  });
});

describe('RBAC — Write access', () => {
  it('blocks Project Team from creating transmittals', async () => {
    const res = await request(app)
      .post('/api/transmittals')
      .set('Authorization', `Bearer ${teamToken}`)
      .send({ drawingIds: [1], recipients: ['test'], purpose: 'Test' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/projects', () => {
  it('allows director to create project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ name: 'Test Project', code: 'TEST-001' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Project');
    expect(res.body.code).toBe('TEST-001');
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ name: 'No Code' });
    expect(res.status).toBe(400);
  });

  it('blocks non-director', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${architectToken}`)
      .send({ name: 'Blocked', code: 'BLK-001' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/drawings', () => {
  it('returns drawings for a project', async () => {
    const res = await request(app)
      .get('/api/drawings?projectId=1')
      .set('Authorization', `Bearer ${directorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Password change', () => {
  it('rejects wrong current password', async () => {
    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ currentPassword: 'wrong', newPassword: 'newpass123' });
    expect(res.status).toBe(401);
  });

  it('rejects short new password', async () => {
    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ currentPassword: 'Unique123!', newPassword: '12' });
    expect(res.status).toBe(400);
  });
});

describe('Token revocation (token_version)', () => {
  // Each test uses a freshly created user + its own token so it never disturbs
  // the shared role tokens (directorToken etc.) used by the rest of the suite.
  async function createAndLogin(username) {
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ username, password: 'revoke123', name: 'Revoke User', role: 'Project Team', allowedProjects: '[1]' });
    const res = await request(app).post('/api/login').send({ username, password: 'revoke123' });
    return { token: res.body.token, id: res.body.id };
  }

  it('issued login tokens carry a token-version (tv) claim', async () => {
    const { token } = await createAndLogin('rev_tv_claim');
    const decoded = jwt.decode(token);
    expect(decoded.tv).toBeDefined();
    expect(typeof decoded.tv).toBe('number');
  });

  it('accepts a legacy token with no tv claim (backward compatibility for live web sessions)', async () => {
    const legacy = jwt.sign(
      { id: 1, username: 'director', name: 'Director', role: 'Director', avatar: null, allowedProjects: '*' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${legacy}`);
    expect(res.status).toBe(200);
  });

  it('logout-all requires authentication', async () => {
    const res = await request(app).post('/api/logout-all');
    expect(res.status).toBe(401);
  });

  it('POST /api/logout-all invalidates the caller\'s existing tokens', async () => {
    const { token } = await createAndLogin('rev_logout_all');
    const before = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    const out = await request(app).post('/api/logout-all').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(200);

    const after = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
    expect(after.body.error).toMatch(/log in again/i);
  });

  it('self password change invalidates the user\'s old tokens', async () => {
    const { token } = await createAndLogin('rev_pw_change');
    const change = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'revoke123', newPassword: 'revoke456' });
    expect(change.status).toBe(200);

    const after = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('self password change returns a fresh token so the current device stays signed in', async () => {
    const { token } = await createAndLogin('rev_pw_fresh');
    const change = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'revoke123', newPassword: 'revoke456' });
    expect(change.status).toBe(200);
    expect(change.body.token).toBeDefined();

    const oldTok = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(oldTok.status).toBe(401);
    const newTok = await request(app).get('/api/projects').set('Authorization', `Bearer ${change.body.token}`);
    expect(newTok.status).toBe(200);
  });

  it('director reset-password invalidates the target user\'s tokens', async () => {
    const { token, id } = await createAndLogin('rev_reset');
    const reset = await request(app)
      .patch(`/api/users/${id}/reset-password`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ newPassword: 'resetnew123' });
    expect(reset.status).toBe(200);

    const after = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('director deactivate invalidates the target user\'s live tokens', async () => {
    const { token, id } = await createAndLogin('rev_deact');
    const deact = await request(app)
      .patch(`/api/users/${id}/deactivate`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(deact.status).toBe(200);

    const after = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('director role/permission change invalidates the target user\'s tokens', async () => {
    const { token, id } = await createAndLogin('rev_role');
    const role = await request(app)
      .patch(`/api/users/${id}/role`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ role: 'In House Architect', allowedProjects: '[1]' });
    expect(role.status).toBe(200);

    const after = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });
});
