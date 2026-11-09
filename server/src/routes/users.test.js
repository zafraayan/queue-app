import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import router from './users.js';
import { User } from '../models/User.js';
import { QueueTransaction } from '../models/QueueTransaction.js';
import { StepConfig } from '../models/StepConfig.js';

test('account updates and deletion enforce access, validation and active-client safeguards', async () => {
  const restores = [];
  const replace = (object, key, value) => { const original = object[key]; restores.push(() => { object[key] = original; }); object[key] = value; };
  const adminId = '000000000000000000000001', targetId = '000000000000000000000002';
  let role = 'admin', activeClient = false, deleted = false;
  const target = { _id: targetId, name: 'Staff', email: 'staff@example.com', role: 'staff', active: true, assignedSteps: [1], sessionVersion: 0, async save() {} };
  replace(User, 'findById', async id => id === adminId ? { _id: adminId, role, active: true, sessionVersion: 0 } : target);
  replace(User, 'countDocuments', async () => 1);
  replace(User, 'deleteOne', async () => { deleted = true; });
  replace(QueueTransaction, 'exists', async () => activeClient);
  replace(StepConfig, 'findById', () => ({ lean: async () => ({ count: 4 }) }));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { userId: adminId, sessionVersion: 0 }; next(); });
  app.use('/users', router);
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (method, body, id = targetId) => fetch(`http://127.0.0.1:${server.address().port}/users/${id}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    role = 'staff';
    assert.equal((await request('DELETE')).status, 403);
    assert.equal((await request('PATCH', { name: 'Changed' })).status, 403);
    role = 'admin';
    assert.equal((await request('DELETE', null, adminId)).status, 400);
    assert.equal((await request('PATCH', { name: 'A' })).status, 400);
    assert.equal((await request('PATCH', { email: 'invalid' })).status, 400);
    assert.equal((await request('PATCH', { name: 'Updated Staff', email: 'updated@example.com', role: 'staff', assignedSteps: [2] })).status, 200);
    assert.equal(target.name, 'Updated Staff'); assert.equal(target.email, 'updated@example.com'); assert.equal(target.sessionVersion, 1);
    activeClient = true;
    assert.equal((await request('DELETE')).status, 409);
    assert.equal((await request('PATCH', { role: 'receptionist', assignedSteps: [] })).status, 409);
    assert.equal(deleted, false);
    activeClient = false; target.role = 'admin';
    assert.equal((await request('DELETE')).status, 409);
    target.role = 'staff';
    assert.equal((await request('DELETE')).status, 200);
    assert.equal(deleted, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
    restores.reverse().forEach(restore => restore());
  }
});
