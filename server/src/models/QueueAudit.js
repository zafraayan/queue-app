import mongoose from 'mongoose';
const schema=new mongoose.Schema({transactionId:{type:mongoose.Schema.Types.ObjectId,ref:'QueueTransaction',required:true,index:true},action:{type:String,required:true},step:{type:Number,required:true},actor:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},at:{type:Date,default:Date.now},details:{type:mongoose.Schema.Types.Mixed,default:{}}},{versionKey:false});
export const QueueAudit=mongoose.model('QueueAudit',schema);
