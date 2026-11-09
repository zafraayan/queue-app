import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import stepsRouter from './steps.js';
import queueRouter from './queue.js';
import { StepConfig } from '../models/StepConfig.js';
import { User } from '../models/User.js';
import { QueueTransaction } from '../models/QueueTransaction.js';
import { QueueAudit } from '../models/QueueAudit.js';
import { QueueCounter } from '../models/QueueCounter.js';

test('inline step creation requires admin and new steps work without extending existing tickets', async () => {
  const originals = [];
  const replace = (object, key, value) => { originals.push(() => { object[key] = value; }); object[key] = value; };
  const names = {}; const deleted = []; let count = 4, role = 'admin', assignedSteps = [], ticket, hasActiveTickets = false, removedAssignments = false;
  const userId = '000000000000000000000001';
  replace(StepConfig, 'findById', () => ({ lean: async () => ({ count, deleted, names }) }));
  replace(StepConfig, 'updateOne', async (_filter, update) => { count += update.$inc?.count || 0; if(update.$addToSet)deleted.push(update.$addToSet.deleted); if(update.$set)for(const [key,value] of Object.entries(update.$set))names[key.split('.')[1]]=value; });
  replace(StepConfig, 'findOneAndUpdate', async (_filter, update) => { count += update.$inc?.count || 0; return { count, deleted }; });
  replace(User, 'findById', async () => ({ _id: userId, active: true, sessionVersion: 0, role, assignedSteps }));
  replace(mongoose, 'startSession', async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }));
  replace(QueueTransaction, 'findById', () => ({ session: async () => ticket }));
  replace(QueueAudit, 'create', async () => {});
  const counters = {};
  replace(QueueCounter, 'findOneAndUpdate', async ({ prefix }) => ({ value: counters[prefix] = (counters[prefix] || 0) + 1 }));
  replace(QueueTransaction, 'create', async rows => rows);
  replace(QueueTransaction, 'exists', () => ({ session: async () => hasActiveTickets }));
  replace(User, 'updateMany', async (filter, update) => { assert.equal(filter.assignedSteps, update.$pull.assignedSteps); removedAssignments = true; });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { userId, sessionVersion: 0 }; next(); });
  app.use('/steps', stepsRouter);
  app.use('/queue', queueRouter);
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (path, method = 'POST', body = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, ...(['POST','PATCH'].includes(method) ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const makeTicket = total => ({
    currentStep: 4, status: 'ACTIVE', queueNumber: 'A-001',
    steps: Array.from({ length: total }, (_, index) => ({ step: index + 1, status: index === 3 ? 'PROCESSING' : 'LOCKED', assignedTo: userId })),
    async save() {},
  });
  try {
    for (const [priority, expected] of [[true, 'P-001'], [false, 'A-001'], [true, 'P-002']]) {
      const registered = await request('/queue/register', 'POST', { clientName: 'Test Client', purpose: 'Test', priority });
      assert.equal(registered.status, 201);
      assert.equal((await registered.json()).transaction.queueNumber, expected);
    }
    role = 'staff';
    assert.equal((await request('/steps')).status, 403);
    assert.equal(count, 4);
    role = 'admin';
    let response = await request('/steps');
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { steps: [1, 2, 3, 4, 5], addedStep: 5 });
    response = await request('/steps');
    assert.equal((await response.json()).addedStep, 6);
    assert.equal((await request('/steps', 'POST', { count: 100 })).status, 400);
    role = 'staff';
    assert.equal((await request('/steps/1','PATCH',{name:'Reception'})).status,403);
    role = 'admin';
    assert.equal((await request('/steps/1','PATCH',{name:'  '})).status,400);
    assert.equal((await request('/steps/99','PATCH',{name:'Invalid'})).status,404);
    const renamed = await request('/steps/1','PATCH',{name:' Reception '});
    assert.equal(renamed.status,200);
    assert.equal((await renamed.json()).names['1'],'Reception');
    // Model validation and access accept added steps, not arbitrary step numbers.
    assert.equal(new User({ assignedSteps: [5, 6] }).validateSync(['assignedSteps']), undefined);
    assert.equal(new QueueTransaction({ currentStep: 6 }).validateSync(['currentStep']), undefined);
    ticket = makeTicket(6);
    ticket.currentStep = 6; ticket.steps[5].status = 'PROCESSING';
    role = 'staff'; assignedSteps = [6];
    assert.equal((await request(`/queue/steps/6/${userId}/complete`)).status, 200);
    assert.equal(ticket.status, 'COMPLETED');
    assert.equal((await request(`/queue/steps/7/${userId}/complete`)).status, 400);
    assignedSteps = [1];
    assert.equal((await request(`/queue/steps/6/${userId}/complete`)).status, 403);
    role = 'admin';
    ticket = makeTicket(6);
    assert.equal((await request(`/queue/steps/4/${userId}/complete`)).status, 200);
    assert.equal(ticket.currentStep, 5);
    assert.equal(ticket.steps[4].status, 'WAITING');
    assert.equal(ticket.status, 'ACTIVE');
    ticket = makeTicket(4);
    assert.equal((await request(`/queue/steps/4/${userId}/complete`)).status, 200);
    assert.equal(ticket.status, 'COMPLETED');
    assert.equal(ticket.steps.length, 4);
    role = 'staff';
    assert.equal((await request('/steps/6', 'DELETE')).status, 403);
    role = 'admin';
    assert.equal((await request('/steps/0', 'DELETE')).status, 400);

    hasActiveTickets = true;
    assert.equal((await request('/steps/6', 'DELETE')).status, 409);
    assert.equal(count, 6);
    assert.equal(removedAssignments, false);
    hasActiveTickets = false;
    response = await request('/steps/6', 'DELETE');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { steps: [1, 2, 3, 4, 5] });
    assert.equal(removedAssignments, true);
    response = await request('/steps/2', 'DELETE');
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).steps, [1, 3, 4, 5]);
    ticket = makeTicket(4); ticket.steps = ticket.steps.filter(item => item.step !== 2); ticket.currentStep = 1; ticket.steps[0].status = 'PROCESSING';
    assert.equal((await request(`/queue/steps/1/${userId}/complete`)).status, 200);
    assert.equal(ticket.currentStep, 3);
    assert.equal(ticket.steps[1].status, 'WAITING');
    assert.equal((await request('/steps/2', 'DELETE')).status, 404);
    assert.equal((await request(`/queue/steps/2/${userId}/complete`)).status, 400);
    assert.equal((await request('/steps/1', 'DELETE')).status, 200);
    assert.equal((await request('/steps/3', 'DELETE')).status, 200);
    assert.equal((await request('/steps/4', 'DELETE')).status, 200);
    assert.equal((await request('/steps/5', 'DELETE')).status, 409);
    response = await request('/steps');
    assert.deepEqual((await response.json()).steps, [5, 7]);
    assert.equal((await request('/steps','POST',{name:' '})).status,400);
    assert.equal((await request('/steps','POST',{name:'x'.repeat(81)})).status,400);
    response = await request('/steps','POST',{name:' Document Release '});
    assert.equal(response.status,201);
    const added = await response.json();
    assert.equal(added.names[added.addedStep],'Document Release');
  } finally {
    await new Promise(resolve => server.close(resolve));
    originals.reverse().forEach(restore => restore());
  }
});
