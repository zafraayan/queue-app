import { getSteps, getStepNames } from '../models/StepConfig.js';
import { QueueTransaction } from '../models/QueueTransaction.js';

// Public projection: NEVER include clientName, purpose, remarks, staff IDs or database IDs.
export async function displaySnapshot() {
  const rows = await QueueTransaction.find({
    status: 'ACTIVE',
    'steps.status': { $in: ['CALLED', 'PROCESSING'] }
  }).select('queueNumber currentStep steps.step steps.status steps.counterLabel steps.calledAt').lean();
  const names = await getStepNames();
  const steps = (await getSteps()).map(step => ({ step, name: names[step], serving: [] }));
  for (const row of rows) {
    const item = row.steps?.find(x => x.step === row.currentStep);
    if (!item || !['CALLED', 'PROCESSING'].includes(item.status)) continue;
    steps.find(item => item.step === row.currentStep)?.serving.push({
      queueNumber: row.queueNumber,
      counterLabel: item.counterLabel || 'Counter',
      status: item.status,
      calledAt: item.calledAt || null
    });
  }
  for (const s of steps) s.serving.sort((a,b) => new Date(b.calledAt) - new Date(a.calledAt));
  return { steps, updatedAt: new Date().toISOString() };
}
