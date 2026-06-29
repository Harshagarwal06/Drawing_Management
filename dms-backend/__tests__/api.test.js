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
let limitedArchitectToken;
let projectOneDrawingId;
let projectTwoDrawingId;
let projectTwoRevisionId;

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

  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${directorToken}`)
    .send({
      username: 'limited_architect',
      password: 'limited123',
      name: 'Limited Architect',
      role: 'In House Architect',
      allowedProjects: '[1]',
    });
  const limitedRes = await request(app)
    .post('/api/login')
    .send({ username: 'limited_architect', password: 'limited123' });
  limitedArchitectToken = limitedRes.body.token;

  const drawingInsert = db.prepare(`
    INSERT INTO drawings (number,title,discipline,rev,status,issue_date,originator,transmittals,path,project_id,folder_path)
    VALUES (?,?,?,?,?,?,?,0,?,?,?)
  `);
  projectOneDrawingId = drawingInsert.run(
    'AUTH-P1-001', 'Accessible Project Drawing', 'Architecture', 'A', 'S1',
    '2026-06-27', 'QA', 'project-one.pdf', 1, ''
  ).lastInsertRowid;
  projectTwoDrawingId = drawingInsert.run(
    'AUTH-P2-001', 'Restricted Project Drawing', 'Architecture', 'A', 'S1',
    '2026-06-27', 'QA', 'https://public.example.com/project-two.pdf', 2, ''
  ).lastInsertRowid;
  projectTwoRevisionId = db.prepare(`
    INSERT INTO drawing_revisions (drawing_id, rev, status, title, discipline, originator, path, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectTwoDrawingId, '0', 'S1', 'Restricted Revision', 'Architecture', 'QA',
    'https://public.example.com/project-two-rev0.pdf', 'QA', '2026-06-27'
  ).lastInsertRowid;
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

  it('allows HEAD without auth', async () => {
    const res = await request(app).head('/api/health');
    expect(res.status).toBe(200);
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

  it('rate-limits repeated failed login attempts', async () => {
    const agent = request(app);
    for (let i = 0; i < 10; i++) {
      const res = await agent
        .post('/api/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .send({ username: 'director', password: `wrong-${i}` });
      expect(res.status).toBe(401);
    }
    const limited = await agent
      .post('/api/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ username: 'director', password: 'wrong-again' });
    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatch(/too many failed login attempts/i);
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

  it('blocks malformed Authorization header (no Bearer prefix)', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', directorToken); // missing "Bearer " prefix
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no token/i);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign(
      { id: 1, username: 'director', role: 'Director', allowedProjects: '*' },
      'attacker-secret',
      { expiresIn: '7d' }
    );
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('Token expiration handling', () => {
  it('rejects an expired token with 401', async () => {
    // Sign with the same secret the server uses, but already expired.
    const expired = jwt.sign(
      { id: 1, username: 'director', role: 'Director', allowedProjects: '*' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired|log in again/i);
  });

  it('accepts a token that has not yet expired', async () => {
    const valid = jwt.sign(
      { id: 1, username: 'director', role: 'Director', allowedProjects: '*' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${valid}`);
    expect(res.status).toBe(200);
  });

  it('issued login tokens carry a 7-day expiry claim', () => {
    const decoded = jwt.decode(directorToken);
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    const sevenDays = 7 * 24 * 60 * 60;
    // allow a small clock skew window
    expect(decoded.exp - decoded.iat).toBe(sevenDays);
  });
});

describe('Protected endpoints require authentication', () => {
  const protectedGets = [
    '/api/projects',
    '/api/drawings?projectId=1',
    '/api/users',
    '/api/transmittals?projectId=1',
    '/api/activity?projectId=1',
  ];

  it.each(protectedGets)('blocks unauthenticated GET %s with 401', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated project creation with 401', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'NoAuth', code: 'NA-001' });
    expect(res.status).toBe(401);
  });
});

describe('Login — account state & input', () => {
  it('rejects a deactivated account with 403', async () => {
    // Create a user, deactivate it, then attempt login.
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ username: 'deactivated_user', password: 'secret123', name: 'Gone User', role: 'Project Team', allowedProjects: '[1]' });
    expect(created.status).toBe(201);

    const deact = await request(app)
      .patch(`/api/users/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${directorToken}`);
    expect(deact.status).toBe(200);
    expect(deact.body.active).toBe(0);

    const login = await request(app)
      .post('/api/login')
      .send({ username: 'deactivated_user', password: 'secret123' });
    expect(login.status).toBe(403);
    expect(login.body.error).toMatch(/deactivated/i);
  });

  it('rejects login with missing credentials', async () => {
    const res = await request(app).post('/api/login').send({});
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

  it('blocks Project Team from mutating folder trees', async () => {
    const res = await request(app)
      .put('/api/projects/1/folders')
      .set('Authorization', `Bearer ${teamToken}`)
      .send({ tree: { name: 'Root', children: [] } });
    expect(res.status).toBe(403);
  });

  it('blocks a project-limited writer from uploading to another project', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${limitedArchitectToken}`)
      .field('drawingNumber', 'AUTH-P2-UPLOAD')
      .field('title', 'Blocked upload')
      .field('discipline', 'Architecture')
      .field('revision', 'A')
      .field('originator', 'QA')
      .field('status', 'S1')
      .field('projectId', '2')
      .attach('drawingFile', Buffer.from('%PDF-1.4'), 'blocked.pdf');
    expect(res.status).toBe(403);
  });

  it('blocks a project-limited writer from mutating drawings in another project', async () => {
    const auth = { Authorization: `Bearer ${limitedArchitectToken}` };
    const patch = await request(app)
      .patch(`/api/drawings/${projectTwoDrawingId}`)
      .set(auth)
      .send({ title: 'Blocked edit' });
    const voided = await request(app)
      .patch(`/api/drawings/${projectTwoDrawingId}/void`)
      .set(auth);
    const deleted = await request(app)
      .delete(`/api/drawings/${projectTwoDrawingId}`)
      .set(auth);
    expect(patch.status).toBe(403);
    expect(voided.status).toBe(403);
    expect(deleted.status).toBe(403);
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


describe('Project-scoped transmittals and private files', () => {
  it('rejects transmittals whose drawing IDs are outside the selected project', async () => {
    const res = await request(app)
      .post('/api/transmittals')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        drawingIds: [projectTwoDrawingId],
        recipients: ['Reviewer'],
        purpose: 'For Approval',
        projectId: 1,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/selected project/i);
  });

  it('denies revision history for drawings outside project access', async () => {
    const res = await request(app)
      .get(`/api/drawings/${projectTwoDrawingId}/revisions`)
      .set('Authorization', `Bearer ${teamToken}`);
    expect(res.status).toBe(403);
  });

  it('requires auth for signed drawing file URLs', async () => {
    const res = await request(app).get(`/api/drawings/${projectOneDrawingId}/file-url?mode=view`);
    expect(res.status).toBe(401);
  });

  it('enforces project access for signed drawing file URLs', async () => {
    const res = await request(app)
      .get(`/api/drawings/${projectTwoDrawingId}/file-url?mode=view`)
      .set('Authorization', `Bearer ${teamToken}`);
    expect(res.status).toBe(403);
  });

  it('enforces project access for signed revision file URLs', async () => {
    const res = await request(app)
      .get(`/api/drawing-revisions/${projectTwoRevisionId}/file-url?mode=download`)
      .set('Authorization', `Bearer ${teamToken}`);
    expect(res.status).toBe(403);
  });
});
