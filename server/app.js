import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { id, now, transaction, createUser, audit, notify } from './database.js';
import { demoPayments, demoSigning, resolveIdentity } from './adapters.js';

const text = (max=200) => z.string().trim().min(1).max(max);
const money = z.number().int().min(0).max(10000000000000);
const loanSchema=z.object({borrower_type:z.enum(['COM','PER']),title:text(120),amount:money.min(10000000),term:z.number().int().min(1).max(360),purpose:text(),industry:text(),location:text(),revenue:money,collateral:text(),description:text(4000),consent:z.literal(true),private_data:z.object({legalName:text(),contact:text(),phone:z.string().trim().regex(/^\+?[0-9\s.-]{8,20}$/),email:z.email(),taxCode:z.string().trim().max(30).default('')})});
const proposalSchema=z.object({rate:z.number().min(0.1).max(60),fee:money,fee_description:text(500),days:z.number().int().min(1).max(180),conditions:text(3000),simulate_deposit:z.literal(true)});
const fail=(status,message)=>{const e=new Error(message);e.status=status;throw e;};
export function createApp(db,{uploadDir,distDir=resolve('dist'),demoMode=true}={}) {
  if (!demoMode) throw new Error('Phiên bản này chỉ hỗ trợ DEMO_MODE=true; cần tích hợp xác thực và thanh toán trước khi vận hành thật.');
  mkdirSync(uploadDir,{recursive:true});
  const app=express(); app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:{directives:{imgSrc:["'self'","data:"],connectSrc:["'self'"]}}}));
  app.use('/api',rateLimit({windowMs:60000,limit:300,standardHeaders:true,legacyHeaders:false}));
  app.use(express.json({limit:'100kb'}));
  const auth=(req,res,next)=>{req.user=resolveIdentity(db,req); if(!req.user)return res.status(401).json({error:'Vui lòng chọn tài khoản trải nghiệm.'});next();};
  const roles=(...allowed)=>(req,res,next)=>{if(!allowed.includes(req.user.role)) return res.status(403).json({error:'Tài khoản không có quyền thực hiện thao tác này.'});next();};
  const getLoan=(loanId)=>db.prepare('SELECT * FROM loans WHERE id=?').get(loanId)||fail(404,'Không tìm thấy hồ sơ.');
  const selected=(loan)=>loan.selected_proposal_id?db.prepare('SELECT * FROM proposals WHERE id=?').get(loan.selected_proposal_id):null;
  const owner=(req,loan)=>{if(loan.owner_id!==req.user.id)fail(403,'Bạn không sở hữu hồ sơ này.');};
  const banker=(req,loan)=>{if(selected(loan)?.banker_id!==req.user.id)fail(403,'Bạn chưa được chọn cho hồ sơ này.');};
  const canRead=(user,loan)=>user.role==='ADMIN'||loan.owner_id===user.id||(user.role==='BAR'&&(['submitted','offers_received'].includes(loan.status)||selected(loan)?.banker_id===user.id));
  const canReadPrivate=(user,loan)=>user.role==='ADMIN'||loan.owner_id===user.id||(user.role==='BAR'&&selected(loan)?.banker_id===user.id&&loan.consent===1);
  const serialize=(loan,user,detail=false)=>{
    const {private_data,owner_id,...publicLoan}=loan;
    const full=canReadPrivate(user,loan);
    let proposals=db.prepare('SELECT p.*,u.alias banker_alias FROM proposals p JOIN users u ON u.id=p.banker_id WHERE loan_id=? ORDER BY rate').all(loan.id);
    if(user.role==='BAR')proposals=proposals.filter(p=>p.banker_id===user.id);
    const result={...publicLoan,is_owner:owner_id===user.id,document_count:db.prepare('SELECT count(*) AS n FROM documents WHERE loan_id=?').get(loan.id).n,proposal_count:db.prepare('SELECT count(*) AS n FROM proposals WHERE loan_id=?').get(loan.id).n,proposals,selected_banker_alias:loan.selected_proposal_id?db.prepare('SELECT u.alias FROM proposals p JOIN users u ON u.id=p.banker_id WHERE p.id=?').get(loan.selected_proposal_id)?.alias:null};
    if(detail){
      if(full)result.private_data=JSON.parse(private_data);
      result.documents=full?db.prepare('SELECT id,name,mime,size,created_at FROM documents WHERE loan_id=?').all(loan.id):[];
      result.progress=db.prepare('SELECT p.*,u.alias actor_alias FROM progress p JOIN users u ON u.id=p.actor_id WHERE loan_id=? ORDER BY created_at').all(loan.id);
      result.appointment=db.prepare('SELECT * FROM appointments WHERE loan_id=?').get(loan.id)||null;
      result.contract=full?db.prepare('SELECT * FROM contracts WHERE loan_id=?').get(loan.id)||null:null;
      result.ledger=db.prepare('SELECT l.*,u.alias user_alias FROM ledger l JOIN users u ON u.id=l.user_id WHERE loan_id=? AND (user_id=? OR ?=1)').all(loan.id,user.id,Number(user.role==='ADMIN'));
      result.due_at=loan.selected_proposal_id&&result.contract?new Date(new Date(result.progress.find(p=>p.stage==='in_review')?.created_at||now()).getTime()+selected(loan).days*86400000).toISOString():null;
    }
    return result;
  };
  const event=(req,loan,stage,note)=>{db.prepare('UPDATE loans SET status=?,updated_at=? WHERE id=?').run(stage,now(),loan.id);db.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?)').run(id(),loan.id,req.user.id,stage,note,now());audit(db,req.user.id,loan.id,stage,note);};
  app.get('/api/health',(req,res)=>res.json({status:'ok',mode:'demo',database:db.prepare('SELECT 1 AS ok').get().ok}));
  app.get('/api/demo/users',(req,res)=>res.json(db.prepare('SELECT id,role,alias FROM users ORDER BY created_at').all()));
  app.post('/api/demo/users',(req,res)=>{const {role}=z.object({role:z.enum(['COM','PER','BRO','BAR'])}).parse(req.body);res.status(201).json(transaction(db,()=>createUser(db,role)));});
  app.use('/api',auth);
  app.get('/api/me',(req,res)=>res.json({...req.user,mode:'demo'}));
  app.get('/api/loans',(req,res)=>{const loans=db.prepare('SELECT * FROM loans ORDER BY created_at DESC').all().filter(l=>canRead(req.user,l));res.json(loans.map(l=>serialize(l,req.user)));});
  app.get('/api/loans/:id',(req,res)=>{const l=getLoan(req.params.id);if(!canRead(req.user,l))fail(403,'Không có quyền xem hồ sơ.');res.json(serialize(l,req.user,true));});
  app.post('/api/loans',roles('COM','PER','BRO'),(req,res)=>{
    const v=loanSchema.parse(req.body);if(req.user.role!=='BRO'&&req.user.role!==v.borrower_type)fail(400,'Loại hồ sơ phải phù hợp với tài khoản.');
    const loanId=transaction(db,()=>{const loanId=id();const t=now();db.prepare('INSERT INTO loans VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)').run(loanId,req.user.id,req.user.alias,v.borrower_type,v.title,v.amount,v.term,v.purpose,v.industry,v.location,v.revenue,v.collateral,v.description,JSON.stringify(v.private_data),'submitted',1,t,t);db.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?)').run(id(),loanId,req.user.id,'submitted','Đã gửi hồ sơ và đồng ý chia sẻ dữ liệu với banker được chọn.',t);audit(db,req.user.id,loanId,'loan_created');return loanId;});res.status(201).json(serialize(getLoan(loanId),req.user,true));
  });
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,['application/pdf','image/jpeg','image/png'].includes(file.mimetype))});
  app.post('/api/loans/:id/documents',roles('COM','PER','BRO'),(req,res,next)=>{const l=getLoan(req.params.id);owner(req,l);if(!['submitted','offers_received','selected','in_review'].includes(l.status))fail(409,'Hồ sơ không còn nhận tài liệu.');next();},upload.single('file'),(req,res)=>{
    const l=getLoan(req.params.id);if(!req.file)fail(400,'Chỉ hỗ trợ PDF, JPG và PNG, tối đa 10 MB.');
    if(db.prepare('SELECT count(*) AS n FROM documents WHERE loan_id=?').get(l.id).n>=12)fail(400,'Tối đa 12 tài liệu cho mỗi hồ sơ.');
    const b=req.file.buffer,m=req.file.mimetype;
    const valid=m==='application/pdf'?b.subarray(0,5).toString()==='%PDF-':m==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b[0]===255&&b[1]===216&&b[2]===255;
    if(!valid)fail(400,'Nội dung tệp không đúng định dạng đã khai báo.');
    const documentId=id();writeFileSync(join(uploadDir,documentId),b,{flag:'wx'});
    const name=req.file.originalname.replace(/[^\p{L}\p{N} ._()-]/gu,'_').slice(0,180);
    db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?)').run(documentId,l.id,name,m,req.file.size,documentId,now());audit(db,req.user.id,l.id,'document_uploaded',name);res.status(201).json({id:documentId,name,size:req.file.size});
  });
  app.get('/api/documents/:id',(req,res)=>{const d=db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id)||fail(404,'Không tìm thấy tài liệu.');const l=getLoan(d.loan_id);if(!canReadPrivate(req.user,l))fail(403,'Tài liệu chỉ được chia sẻ với banker đã được chọn.');res.type(d.mime);res.set('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`);res.sendFile(d.storage_name,{root:resolve(uploadDir),dotfiles:'allow'});});
  app.post('/api/loans/:id/proposals',roles('BAR'),(req,res)=>{
    const v=proposalSchema.parse(req.body),l=getLoan(req.params.id);if(!['submitted','offers_received'].includes(l.status))fail(409,'Hồ sơ đã đóng nhận đề xuất.');if(db.prepare('SELECT id FROM proposals WHERE loan_id=? AND banker_id=?').get(l.id,req.user.id))fail(409,'Bạn đã gửi đề xuất cho hồ sơ này.');
    transaction(db,()=>{db.prepare('INSERT INTO proposals VALUES(?,?,?,?,?,?,?,?,?,?)').run(id(),l.id,req.user.id,v.rate,v.fee,v.fee_description,v.days,v.conditions,'published',now());demoPayments.deposit(db,{loanId:l.id,userId:req.user.id,kind:'banker_deposit',amount:1000000,id,now});event(req,l,'offers_received','Có đề xuất tài trợ mới.');notify(db,l.owner_id,l.id,`${req.user.alias} đã gửi đề xuất tài trợ.`);});res.status(201).json(serialize(getLoan(l.id),req.user,true));
  });
  app.post('/api/loans/:id/select',roles('COM','PER','BRO'),(req,res)=>{
    const {proposal_id,consent}=z.object({proposal_id:z.uuid(),consent:z.literal(true)}).parse(req.body);const l=getLoan(req.params.id);owner(req,l);if(!['submitted','offers_received'].includes(l.status))fail(409,'Hồ sơ đã chọn banker hoặc ngừng nhận đề xuất.');const p=db.prepare("SELECT * FROM proposals WHERE id=? AND loan_id=? AND status='published'").get(proposal_id,l.id)||fail(404,'Đề xuất không hợp lệ.');
    transaction(db,()=>{db.prepare('UPDATE loans SET selected_proposal_id=?,consent=1 WHERE id=?').run(p.id,l.id);db.prepare("UPDATE proposals SET status=CASE WHEN id=? THEN 'selected' ELSE 'not_selected' END WHERE loan_id=?").run(p.id,l.id);db.prepare("UPDATE ledger SET state='refunded_simulated' WHERE loan_id=? AND user_id<>? AND kind='banker_deposit' AND state='held'").run(l.id,p.banker_id);event(req,l,'selected',`Đã chọn ${db.prepare('SELECT alias FROM users WHERE id=?').get(p.banker_id).alias} và đồng ý chia sẻ thông tin.`);notify(db,p.banker_id,l.id,'Đề xuất của bạn đã được lựa chọn.');});res.json(serialize(getLoan(l.id),req.user,true));
  });
  app.post('/api/loans/:id/activate',roles('COM','PER','BRO'),(req,res)=>{
    z.object({accept_terms:z.literal(true),simulate_signature:z.literal(true),simulate_deposit:z.literal(true)}).parse(req.body);const l=getLoan(req.params.id);owner(req,l);if(l.status!=='selected')fail(409,'Hồ sơ chưa sẵn sàng để bắt đầu xử lý.');const p=selected(l);
    transaction(db,()=>{demoSigning.accept(db,{id,loanId:l.id,terms:{version:'demo-1',service_fee:Math.round(l.amount*0.005),appraisal_budget:2000000,customer_deposit:3000000,banker_deposit:1000000,banker_fee:p.fee,rate:p.rate,days:p.days,disclaimer:'Mô phỏng, không phải hợp đồng điện tử có chữ ký số hợp lệ. Không giao dịch tiền thật. Các khoản khấu trừ và hoàn cọc thực tế cần được xác minh và công bố trước.'},now});demoPayments.deposit(db,{loanId:l.id,userId:req.user.id,kind:'customer_deposit',amount:3000000,id,now});event(req,l,'in_review','Đã xác nhận điều khoản, mô phỏng chữ ký và cọc. Bắt đầu thẩm định.');notify(db,p.banker_id,l.id,'Hồ sơ đã sẵn sàng để thẩm định.');});res.json(serialize(getLoan(l.id),req.user,true));
  });
  app.post('/api/loans/:id/progress',roles('BAR'),(req,res)=>{
    const v=z.object({stage:z.enum(['in_review','approved']),note:text(3000)}).parse(req.body),l=getLoan(req.params.id);banker(req,l);if(l.status!=='in_review')fail(409,'Chỉ cập nhật hồ sơ đang thẩm định.');transaction(db,()=>{event(req,l,v.stage,v.note);notify(db,l.owner_id,l.id,v.stage==='approved'?'Hồ sơ đã được duyệt. Hãy sắp xếp lịch ký hợp đồng.':'Banker vừa cập nhật tiến độ hồ sơ.');});res.json(serialize(getLoan(l.id),req.user,true));
  });
  app.post('/api/loans/:id/appointment',roles('BAR'),(req,res)=>{
    const v=z.object({scheduled_at:z.iso.datetime({offset:true}),location:text(300),note:z.string().trim().max(1000).default('')}).parse(req.body),l=getLoan(req.params.id);banker(req,l);if(l.status!=='approved')fail(409,'Hồ sơ cần được duyệt trước khi đặt lịch.');if(new Date(v.scheduled_at)<=new Date())fail(400,'Lịch hẹn phải ở trong tương lai.');transaction(db,()=>{db.prepare('INSERT INTO appointments VALUES(?,?,?,?,0)').run(l.id,v.scheduled_at,v.location,v.note);event(req,l,'appointment','Đã đề xuất lịch ký hợp đồng giải ngân.');notify(db,l.owner_id,l.id,'Bạn có lịch hẹn ký hợp đồng cần xác nhận.');});res.json(serialize(getLoan(l.id),req.user,true));
  });
  app.post('/api/loans/:id/confirm-appointment',roles('COM','PER','BRO'),(req,res)=>{const l=getLoan(req.params.id);owner(req,l);if(l.status!=='appointment')fail(409,'Chưa có lịch hẹn.');transaction(db,()=>{db.prepare('UPDATE appointments SET confirmed=1 WHERE loan_id=?').run(l.id);audit(db,req.user.id,l.id,'appointment_confirmed');notify(db,selected(l).banker_id,l.id,'Khách hàng đã xác nhận lịch hẹn.');});res.json(serialize(getLoan(l.id),req.user,true));});
  app.post('/api/loans/:id/disburse',roles('BAR'),(req,res)=>{z.object({confirm:z.literal(true)}).parse(req.body);const l=getLoan(req.params.id);banker(req,l);if(l.status!=='appointment'||!db.prepare('SELECT confirmed FROM appointments WHERE loan_id=?').get(l.id)?.confirmed)fail(409,'Lịch ký cần được khách hàng xác nhận.');transaction(db,()=>{event(req,l,'disbursed','Banker đã báo giải ngân; đang chờ khách hàng xác nhận nhận vốn.');notify(db,l.owner_id,l.id,'Vui lòng xác nhận bạn đã nhận vốn (mô phỏng).');});res.json(serialize(getLoan(l.id),req.user,true));});
  app.post('/api/loans/:id/complete',roles('COM','PER','BRO'),(req,res)=>{
    z.object({confirm_received:z.literal(true),simulate_payment:z.literal(true)}).parse(req.body);const l=getLoan(req.params.id);owner(req,l);if(l.status!=='disbursed')fail(409,'Banker chưa báo giải ngân.');transaction(db,()=>{const terms=JSON.parse(db.prepare('SELECT terms FROM contracts WHERE loan_id=?').get(l.id).terms);db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?,?,?)').run(id(),l.id,req.user.id,'service_fee',terms.service_fee,'paid_simulated','simulation',now());demoPayments.settle(db,l.id);event(req,l,'completed','Khách hàng xác nhận nhận vốn, mô phỏng thanh toán phí dịch vụ và hoàn cọc.');notify(db,selected(l).banker_id,l.id,'Hồ sơ hoàn tất, cọc được hoàn trong sổ mô phỏng.');});res.json(serialize(getLoan(l.id),req.user,true));
  });
  app.post('/api/loans/:id/cancel',roles('COM','PER','BRO','BAR'),(req,res)=>{
    const {reason}=z.object({reason:text(1000)}).parse(req.body),l=getLoan(req.params.id);if(req.user.role==='BAR')banker(req,l);else owner(req,l);if(['completed','cancelled','disbursed'].includes(l.status))fail(409,'Không thể hủy ở trạng thái hiện tại.');transaction(db,()=>{db.prepare("UPDATE ledger SET state='review_required' WHERE loan_id=? AND state='held'").run(l.id);event(req,l,'cancelled',reason);notify(db,l.owner_id,l.id,'Hồ sơ đã hủy. Quản trị sẽ xem xét xử lý cọc mô phỏng.');});res.json(serialize(getLoan(l.id),req.user,true));
  });
  app.get('/api/products',(req,res)=>res.json(db.prepare('SELECT p.*,u.alias banker_alias FROM products p JOIN users u ON u.id=p.banker_id ORDER BY created_at DESC').all()));
  app.post('/api/products',roles('BAR'),(req,res)=>{const v=z.object({title:text(120),borrower_type:z.enum(['COM','PER']),rate:z.number().min(0.1).max(60),max_amount:money.min(10000000),term:z.number().int().min(1).max(360),description:text(2000)}).parse(req.body);const productId=id();db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?)').run(productId,req.user.id,v.title,v.borrower_type,v.rate,v.max_amount,v.term,v.description,now());audit(db,req.user.id,null,'product_created',v.title);res.status(201).json({id:productId,...v,banker_id:req.user.id,banker_alias:req.user.alias});});
  app.get('/api/notifications',(req,res)=>res.json(db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)));
  app.post('/api/notifications/read',(req,res)=>{db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.id);res.json({ok:true});});
  app.get('/api/admin',roles('ADMIN'),(req,res)=>res.json({users:db.prepare('SELECT id,alias,role,created_at FROM users').all(),loans:db.prepare('SELECT * FROM loans ORDER BY created_at DESC').all().map(l=>serialize(l,req.user)),ledger:db.prepare('SELECT l.*,u.alias user_alias FROM ledger l JOIN users u ON u.id=l.user_id ORDER BY created_at DESC').all(),audit:db.prepare('SELECT a.*,u.alias actor_alias FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY created_at DESC LIMIT 100').all()}));
  app.post('/api/admin/ledger/:id/resolve',roles('ADMIN'),(req,res)=>{const {outcome,reason}=z.object({outcome:z.enum(['refunded_simulated','forfeited_simulated']),reason:text(1000)}).parse(req.body);const entry=db.prepare('SELECT * FROM ledger WHERE id=?').get(req.params.id)||fail(404,'Không tìm thấy bút toán.');if(entry.state!=='review_required')fail(409,'Bút toán không chờ xem xét.');transaction(db,()=>{db.prepare('UPDATE ledger SET state=? WHERE id=?').run(outcome,entry.id);audit(db,req.user.id,entry.loan_id,'deposit_resolved',`${outcome}: ${reason}`);notify(db,entry.user_id,entry.loan_id,'Quản trị đã xử lý cọc mô phỏng của bạn.');});res.json({ok:true});});
  app.use('/api',(req,res)=>res.status(404).json({error:'API không tồn tại.'}));
  if(existsSync(distDir)){app.use(express.static(distDir));app.get('/{*path}',(req,res)=>res.sendFile(join(distDir,'index.html')));}
  app.use((error,req,res,next)=>{if(res.headersSent)return next(error);if(error instanceof z.ZodError)return res.status(400).json({error:'Thông tin chưa hợp lệ.',fields:error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});if(error instanceof multer.MulterError)return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?'Tệp vượt quá 10 MB.':'Tệp tải lên không hợp lệ.'});if(error.status)return res.status(error.status).json({error:error.message});if(error.type==='entity.parse.failed')return res.status(400).json({error:'JSON không hợp lệ.'});console.error(error);res.status(500).json({error:'Có lỗi xử lý. Vui lòng thử lại.'});});
  return app;
}
