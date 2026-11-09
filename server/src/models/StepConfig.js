import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String, default: 'main' },
  count: { type: Number, default: 4, min: 4 },
  revision: { type: Number, default: 0 },
  deleted: { type: [Number], default: [] },
  names: { type: Map, of: String, default: {} },
});
export const StepConfig = mongoose.model('StepConfig', schema);
export async function getStepCount(session) {
  if (session) {
    const config = await StepConfig.findOneAndUpdate({ _id: 'main' }, { $inc: { revision: 1 } }, { upsert: true, new: true, session });
    return config.count;
  }
  return (await StepConfig.findById('main').lean())?.count || 4;
}
export const stepNumbers = count => Array.from({ length: count }, (_, index) => index + 1);
export async function getSteps(session) {
  const config = session
    ? await StepConfig.findOneAndUpdate({ _id: 'main' }, { $inc: { revision: 1 } }, { upsert: true, new: true, session })
    : await StepConfig.findById('main').lean();
  return stepNumbers(config?.count || 4).filter(step => !config?.deleted?.includes(step));
}
export async function getStepNames() {
  const names = (await StepConfig.findById('main').lean())?.names || {};
  return names instanceof Map ? Object.fromEntries(names) : names;
}
