import { runTransaction } from '../services/transaction.js';
import { getSteps } from '../models/StepConfig.js';
import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, allowRoles, allowStep } from '../middleware/auth.js';
import { QueueCounter } from '../models/QueueCounter.js';
import { QueueTransaction } from '../models/QueueTransaction.js';
import { QueueAudit } from '../models/QueueAudit.js';
import { QueueLock } from '../models/QueueLock.js';
import { compareWaiting } from '../services/queueOrder.js';
const router=Router();router.use(requireAuth);
const TZ=process.env.QUEUE_TIMEZONE || 'Asia/Manila';
const dayKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const idOK=id=>mongoose.isValidObjectId(id);
const asStep=(req,res)=>{const n=Number(req.params.step);if(!Number.isInteger(n)||n<1){res.status(400).json({error:'Invalid step'});return null;}return n;};
const counterSchema=z.object({counterLabel:z.string().trim().min(1).max(40)}).strict();
const registerSchema=z.object({clientName:z.string().trim().min(1).max(120),purpose:z.string().trim().min(1).max(200),remarks:z.string().trim().max(1000).optional(),priority:z.boolean().default(false)}).strict();
const fail=(res,error)=>res.status(400).json({error});
const conflict=(res)=>res.status(409).json({error:'Queue state changed. Refresh and try again.'});
async function audit(session,t,action,step,actor,details={}){await QueueAudit.create([{transactionId:t._id,action,step,actor,details}],{session});}
// An explicit per-step queue sequence is assigned when a client enters each step.
// The server uses priority, then queuedAt + _id ordering. Concurrent transfers share a timestamp only rarely;
// _id provides a deterministic tie-breaker.
router.post('/register',allowRoles('admin','receptionist'),async(req,res,next)=>{const parsed=registerSchema.safeParse(req.body);if(!parsed.success)return fail(res,'Invalid registration fields');try{const result=await runTransaction(async session=>{const day=dayKey();const prefix=parsed.data.priority?'P':'A';const counter=await QueueCounter.findOneAndUpdate({day,prefix},{$inc:{value:1},$setOnInsert:{day,prefix}},{upsert:true,new:true,session});const queueNumber=`${prefix}-${String(counter.value).padStart(3,'0')}`;const now=new Date();const steps=(await getSteps(session)).map((step,index)=>({step,status:index===0?'WAITING':'LOCKED',...(index===0?{queuedAt:now}:{})}));const [t]=await QueueTransaction.create([{day,queueNumber,...parsed.data,registeredBy:req.user._id,currentStep:steps[0].step,status:'ACTIVE',steps}],{session});await audit(session,t,'REGISTER',steps[0].step,req.user._id);return t;});req.app.get('io')?.to(`step:${result.currentStep}`).emit('queue:changed',{step:result.currentStep});
req.app.get('io')?.to('staff').emit('queue:summary-changed');res.status(201).json({transaction:result});}catch(e){next(e);}});
router.get('/steps/:step',allowStep,async(req,res,next)=>{const step=asStep(req,res);if(!step)return;try{const docs=await QueueTransaction.find({status:'ACTIVE',currentStep:step}).sort({createdAt:1}).lean();const waiting=docs.filter(t=>t.steps.find(item=>item.step===step).status==='WAITING').sort(compareWaiting(step));const active=docs.filter(t=>['CALLED','PROCESSING'].includes(t.steps.find(item=>item.step===step).status));res.json({step,waiting,active,steps:await getSteps()});}catch(e){next(e);}});
router.get('/transactions/:id',async(req,res,next)=>{if(!idOK(req.params.id))return fail(res,'Invalid transaction ID');try{const t=await QueueTransaction.findById(req.params.id).lean();if(!t)return res.status(404).json({error:'Not found'});if(req.user.role==='staff'&&!req.user.assignedSteps.includes(t.currentStep))return res.status(403).json({error:'Forbidden'});if(req.user.role==='receptionist'&&t.registeredBy.toString()!==req.user._id.toString())return res.status(403).json({error:'Forbidden'});res.json({transaction:t});}catch(e){next(e);}});
router.get('/recent',allowRoles('admin','receptionist','supervisor'),async(req,res,next)=>{try{const docs=await QueueTransaction.find().sort({createdAt:-1}).limit(30).lean();res.json({transactions:docs});}catch(e){next(e);}});
router.post('/steps/:step/next',allowStep,async(req,res,next)=>{const step=asStep(req,res);if(!step)return;const parsed=counterSchema.safeParse(req.body);if(!parsed.success)return fail(res,'counterLabel is required');const counterLabel=parsed.data.counterLabel;try{const t=await runTransaction(async session=>{// Writing a shared per-step lock document serializes competing Next calls.
const lock=await QueueLock.findOneAndUpdate({step},{$inc:{version:1}},{upsert:true,new:true,session});
if(!lock)throw new Error('Queue lock unavailable');
const occupied=await QueueTransaction.exists({status:'ACTIVE',currentStep:step,steps:{$elemMatch:{step,status:{$in:['CALLED','PROCESSING']},assignedTo:req.user._id}}}).session(session);if(occupied)throw Object.assign(new Error('Finish your current client first'),{status:409});const waiting=await QueueTransaction.find({status:'ACTIVE',currentStep:step,steps:{$elemMatch:{step,status:'WAITING'}}}).session(session).lean();waiting.sort(compareWaiting(step));if(!waiting.length)return null;const candidate=waiting[0];const now=new Date();const stepIndex=candidate.steps.findIndex(item=>item.step===step);const updated=await QueueTransaction.findOneAndUpdate({_id:candidate._id,status:'ACTIVE',currentStep:step,steps:{$elemMatch:{step,status:'WAITING'}}},{$set:{[`steps.${stepIndex}.status`]:'CALLED',[`steps.${stepIndex}.calledAt`]:now,[`steps.${stepIndex}.assignedTo`]:req.user._id,[`steps.${stepIndex}.counterLabel`]:counterLabel}},{new:true,session});if(!updated)throw Object.assign(new Error('Queue changed, retry'),{status:409});await audit(session,updated,'CALL',step,req.user._id,{counterLabel});return updated;});if(!t)return res.status(404).json({error:'No waiting clients'});req.app.get('io')?.to(`step:${step}`).emit('queue:changed',{step});
req.app.get('io')?.to('staff').emit('queue:summary-changed');
req.app.get('io')?.to('display').emit('display:changed');
req.app.get('io')?.to('display').emit('display:announce',{step,queueNumber:t.queueNumber,counterLabel});
res.json({transaction:t});}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e);}});
async function transition(req,res,next,action){const step=asStep(req,res);if(!step)return;if(!idOK(req.params.id))return fail(res,'Invalid transaction ID');try{const result=await runTransaction(async session=>{const t=await QueueTransaction.findById(req.params.id).session(session);if(!t||t.status!=='ACTIVE'||t.currentStep!==step)return null;const item=t.steps.find(item=>item.step===step);if(!item.assignedTo||String(item.assignedTo)!==String(req.user._id))throw Object.assign(new Error('Only the assigned staff member can act on this client'),{status:403});if(action==='RECALL'&&item.status!=='CALLED'||action==='START'&&item.status!=='CALLED'||action==='COMPLETE'&&item.status!=='PROCESSING')throw Object.assign(new Error('Invalid state transition'),{status:409});const now=new Date();if(action==='RECALL')item.recalls+=1;if(action==='START'){item.status='PROCESSING';item.startedAt=now;}if(action==='COMPLETE'){item.status='COMPLETED';item.completedAt=now;const nextStep=t.steps[t.steps.findIndex(item=>item.step===step)+1];if(nextStep){t.currentStep=nextStep.step;nextStep.status='WAITING';nextStep.queuedAt=now;}else{t.status='COMPLETED';t.completedAt=now;}}await t.save({session});await audit(session,t,action,step,req.user._id);return t;});if(!result)return res.status(404).json({error:'Active transaction not found at this step'});req.app.get('io')?.to(`step:${step}`).emit('queue:changed',{step});
if(action==='COMPLETE'&&result.status==='ACTIVE')req.app.get('io')?.to(`step:${result.currentStep}`).emit('queue:changed',{step:result.currentStep});
req.app.get('io')?.to('staff').emit('queue:summary-changed');
req.app.get('io')?.to('display').emit('display:changed');
if(action==='RECALL')req.app.get('io')?.to('display').emit('display:announce',{step,queueNumber:result.queueNumber,counterLabel:result.steps.find(item=>item.step===step).counterLabel});res.json({transaction:result});}catch(e){if(e.status)return res.status(e.status).json({error:e.message});if(e.name==='VersionError')return conflict(res);next(e);}}
for(const [path,action] of [['recall','RECALL'],['start','START'],['complete','COMPLETE']])router.post(`/steps/:step/:id/${path}`,allowStep,(req,res,next)=>transition(req,res,next,action));
export default router;
