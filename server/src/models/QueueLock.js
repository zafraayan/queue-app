import mongoose from 'mongoose';
const schema=new mongoose.Schema({step:{type:Number,required:true,unique:true},version:{type:Number,default:0}});
export const QueueLock=mongoose.model('QueueLock',schema);
