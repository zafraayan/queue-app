import test from 'node:test';
import assert from 'node:assert/strict';
import { compareWaiting } from './queueOrder.js';

const ticket = (_id, priority, queuedAt) => ({
  _id,
  ...(priority === undefined ? {} : { priority }),
  steps: [1, 2, 3, 4].map(step => ({ step, queuedAt })),
});

test('priority precedes regular tickets at every step; each group keeps arrival order', () => {
  const tickets = [
    ticket('regular-new', false, '2026-01-01T09:01:00Z'),
    ticket('priority-new', true, '2026-01-01T10:01:00Z'),
    ticket('legacy', undefined, '2026-01-01T09:00:00Z'),
    ticket('priority-old', true, '2026-01-01T10:00:00Z'),
  ];
  for (const step of [1, 2, 3, 4]) {
    assert.deepEqual([...tickets].sort(compareWaiting(step)).map(t => t._id),
      ['priority-old', 'priority-new', 'legacy', 'regular-new']);
  }
});

test('equal arrival times use ticket ID as a deterministic tie breaker', () => {
  const tickets = ['b', 'a'].map(id => ticket(id, true, '2026-01-01T09:00:00Z'));
  assert.deepEqual(tickets.sort(compareWaiting(1)).map(t => t._id), ['a', 'b']);
});
