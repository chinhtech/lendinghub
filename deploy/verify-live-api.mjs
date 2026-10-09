import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';

// This creates isolated sample identities and one sample loan on the public DEMO.
// It uses curl's verified TLS/proxy configuration, never insecure certificate flags.
const base=process.env.LENDINGHUB_URL||'https://shenlong.space';
if(new URL(base).protocol!=='https:')throw new Error('Public verification requires HTTPS.');
mkdirSync('.data/live-check',{recursive:true});
const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS '+name);}
function request(path,{method='GET',user,body,status=200,file}={}){
 const args=['--silent','--show-error','--max-time','25','--write-out','\n%{http_code}','--request',method];
 if(user)args.push('--header','x-demo-user: '+user.id);
 if(body!==undefined)args.push('--header','Content-Type: application/json','--data-binary',JSON.stringify(body));
 if(file)args.push('--form','file=@'+file+';type=application/pdf');
 args.push(base+path);
 const out=execFileSync('curl',args,{maxBuffer:8*1024*1024});const split=out.lastIndexOf(10);const code=Number(out.subarray(split+1).toString()),content=out.subarray(0,split);
 assert.equal(code,status,`${method} ${path}: expected ${status}, received ${code}`);
 const decoded=content.toString();return decoded.startsWith('{')||decoded.startsWith('[')?JSON.parse(decoded):content;
}
const health=request('/api/health');
check('health and demo mode',()=>assert.deepEqual(health,{status:'ok',mode:'demo',database:1}));
const html=request('/').toString();
check('frontend title',()=>assert.ok(html.includes('<title>Lending Hub |')));
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);
assert.ok(assets.length>=2);
for(const asset of assets){const data=request(asset);check('compiled asset matches tested release: '+asset,()=>{assert.deepEqual(data,readFileSync(resolve('dist'+asset)));assert.ok(!/ChatGPT|Codex/i.test(data.toString()));});}
check('missing identity rejected',()=>request('/api/loans',{status:401}));
const resume=process.env.LENDINGHUB_RESUME==='true'&&existsSync('.data/live-check/identities.json')?JSON.parse(readFileSync('.data/live-check/identities.json','utf8')):null;
const com=resume?.com||request('/api/demo/users',{method:'POST',body:{role:'COM'},status:201});
const bar=resume?.bar||request('/api/demo/users',{method:'POST',body:{role:'BAR'},status:201});
check('new isolated demo identities',()=>{assert.match(com.alias,/^COM-\d{3,4}$/);assert.match(bar.alias,/^BAR-\d{3,4}$/);});
const input={borrower_type:'COM',title:'Hồ sơ trải nghiệm — kiểm tra triển khai',amount:3000000000,term:24,purpose:'Vốn lưu động',industry:'Sản xuất',location:'TP. Hồ Chí Minh',revenue:15000000000,collateral:'Bất động sản',description:'Hồ sơ giả lập để xác minh luồng hoạt động trên tên miền. Không chứa dữ liệu khách hàng thật và không có giao dịch tiền thật.',consent:true,private_data:{legalName:'Doanh nghiệp mẫu kiểm tra triển khai',contact:'Người liên hệ mẫu',phone:'0900000000',email:'demo@example.com',taxCode:''}};
const loan=resume?request('/api/loans/'+resume.loanId,{user:com}):request('/api/loans',{method:'POST',user:com,body:input,status:201});
writeFileSync('.data/live-check/identities.json',JSON.stringify({com,bar,loanId:loan.id},null,2));
check('create borrower loan',()=>assert.equal(loan.status,'submitted'));
const feed=request('/api/loans',{user:bar});
check('anonymized banker feed',()=>{const l=feed.find(l=>l.id===loan.id);assert.ok(l);assert.ok(!('private_data' in l));assert.ok(!('owner_id' in l));});
const pdfPath=resolve('.data/live-check/sample.pdf');
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>','<< /Length 55 >>\nstream\nBT /F1 12 Tf 30 130 Td (Lending Hub sample only) Tj ET\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;writeFileSync(pdfPath,pdf);
const doc=request(`/api/loans/${loan.id}/documents`,{method:'POST',user:com,file:pdfPath,status:201});
check('private sample document upload and download',()=>assert.deepEqual(request('/api/documents/'+doc.id,{user:com}),readFileSync(pdfPath)));
check('unselected banker cannot download file',()=>request('/api/documents/'+doc.id,{user:bar,status:403}));
const proposal={rate:8.5,fee:3000000,fee_description:'Phí cố định mô phỏng đã công bố',days:10,conditions:'Điều kiện giả lập: thẩm định tài sản và kiểm tra dòng tiền.',simulate_deposit:true};
request(`/api/loans/${loan.id}/proposals`,{method:'POST',user:bar,body:proposal,status:201});
check('duplicate proposal rejected',()=>request(`/api/loans/${loan.id}/proposals`,{method:'POST',user:bar,body:proposal,status:409}));
let current=request('/api/loans/'+loan.id,{user:com});
check('borrower receives banker terms',()=>{assert.equal(current.proposals.length,1);assert.equal(current.proposals[0].rate,8.5);assert.equal(current.proposals[0].banker_alias,bar.alias);});
const selected=current.proposals[0];
request(`/api/loans/${loan.id}/select`,{method:'POST',user:com,body:{proposal_id:selected.id,consent:true}});
check('selected banker receives consented document access',()=>assert.deepEqual(request('/api/documents/'+doc.id,{user:bar}),readFileSync(pdfPath)));
current=request(`/api/loans/${loan.id}/activate`,{method:'POST',user:com,body:{accept_terms:true,simulate_signature:true,simulate_deposit:true}});
check('contract and deposit simulations start review',()=>{assert.equal(current.status,'in_review');assert.equal(current.contract.mode,'simulation');assert.ok(current.due_at);});
request(`/api/loans/${loan.id}/progress`,{method:'POST',user:bar,body:{stage:'in_review',note:'Đã kiểm tra tài liệu mẫu và dòng tiền giả lập.'}});
request(`/api/loans/${loan.id}/progress`,{method:'POST',user:bar,body:{stage:'approved',note:'Đã phê duyệt hồ sơ trong luồng trải nghiệm.'}});
request(`/api/loans/${loan.id}/appointment`,{method:'POST',user:bar,body:{scheduled_at:new Date(Date.now()+86400000).toISOString(),location:'Địa điểm ký mẫu — không có cuộc hẹn thực tế',note:'Lịch hẹn mô phỏng cho kiểm tra triển khai.'}});
check('disbursement requires appointment confirmation',()=>request(`/api/loans/${loan.id}/disburse`,{method:'POST',user:bar,body:{confirm:true},status:409}));
request(`/api/loans/${loan.id}/confirm-appointment`,{method:'POST',user:com,body:{}});
request(`/api/loans/${loan.id}/disburse`,{method:'POST',user:bar,body:{confirm:true}});
current=request(`/api/loans/${loan.id}/complete`,{method:'POST',user:com,body:{confirm_received:true,simulate_payment:true}});
check('full workflow completes with service fee and refund simulations',()=>{assert.equal(current.status,'completed');assert.equal(current.ledger.find(e=>e.kind==='service_fee').amount,15000000);assert.equal(current.ledger.find(e=>e.kind==='customer_deposit').state,'refunded_simulated');assert.ok(current.progress.some(p=>p.stage==='approved'));});
check('banker deposit refunded',()=>assert.equal(request('/api/loans/'+loan.id,{user:bar}).ledger.find(e=>e.kind==='banker_deposit').state,'refunded_simulated'));
check('reloaded loan retains completion and document metadata',()=>{const l=request('/api/loans/'+loan.id,{user:com});assert.equal(l.status,'completed');assert.ok(l.documents.some(d=>d.id===doc.id));});
check('notifications scoped to sample borrower',()=>{const list=request('/api/notifications',{user:com});assert.ok(list.length>=3);assert.ok(list.every(n=>n.user_id===com.id));});
check('non-admin access rejected',()=>request('/api/admin',{user:com,status:403}));
const report={site:base,checkedAt:new Date().toISOString(),passed:checks.length,checks,sampleLoanId:loan.id,sampleAliases:[com.alias,bar.alias],status:'completed',browserLive:'blocked by certificate-store approval; local browser tests previously passed',restartPersistence:'not checked: hosting control panel access is unavailable'};
writeFileSync('.data/live-check/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
