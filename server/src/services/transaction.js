import mongoose from 'mongoose';

export async function runTransaction(fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await fn(session); }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
      return result;
    } catch (error) {
      if (attempt < 4 && (error.hasErrorLabel?.('TransientTransactionError') || [112, 11000].includes(error.code))) continue;
      throw error;
    } finally { await session.endSession(); }
  }
}
