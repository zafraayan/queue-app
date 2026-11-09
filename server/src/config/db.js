import mongoose from 'mongoose';
export async function connectDB(uri) { await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 }); console.log('MongoDB connected'); }
