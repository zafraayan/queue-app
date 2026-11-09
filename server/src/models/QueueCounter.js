import mongoose from 'mongoose';
const schema = new mongoose.Schema({ day:{type:String,required:true}, prefix:{type:String,required:true,default:'A'}, value:{type:Number,required:true,default:0} },{timestamps:true});
schema.index({day:1,prefix:1},{unique:true});
export const QueueCounter=mongoose.model('QueueCounter',schema);
