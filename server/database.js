import { DatabaseSync } from 'node:sqlite';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export function createDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, role TEXT NOT NULL, alias TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS loans(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), alias TEXT NOT NULL, borrower_type TEXT NOT NULL, title TEXT NOT NULL, amount INTEGER NOT NULL, term INTEGER NOT NULL, purpose TEXT NOT NULL, industry TEXT NOT NULL, location TEXT NOT NULL, revenue INTEGER NOT NULL, collateral TEXT NOT NULL, description TEXT NOT NULL, private_data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted', selected_proposal_id TEXT, consent INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, loan_id TEXT NOT NULL REFERENCES loans(id), name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, storage_name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY, loan_id TEXT NOT NULL REFERENCES loans(id), banker_id TEXT NOT NULL REFERENCES users(id), rate REAL NOT NULL, fee INTEGER NOT NULL, fee_description TEXT NOT NULL, days INTEGER NOT NULL, conditions TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(loan_id,banker_id));
    CREATE TABLE IF NOT EXISTS contracts(id TEXT PRIMARY KEY, loan_id TEXT NOT NULL UNIQUE REFERENCES loans(id), terms TEXT NOT NULL, accepted_at TEXT NOT NULL, mode TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY, loan_id TEXT NOT NULL REFERENCES loans(id), user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, amount INTEGER NOT NULL, state TEXT NOT NULL, mode TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS progress(id TEXT PRIMARY KEY, loan_id TEXT NOT NULL REFERENCES loans(id), actor_id TEXT NOT NULL REFERENCES users(id), stage TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS appointments(loan_id TEXT PRIMARY KEY REFERENCES loans(id), scheduled_at TEXT NOT NULL, location TEXT NOT NULL, note TEXT NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), loan_id TEXT, title TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), loan_id TEXT, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, banker_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, borrower_type TEXT NOT NULL, rate REAL NOT NULL, max_amount INTEGER NOT NULL, term INTEGER NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  return db;
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function createUser(db, role) {
  const used = new Set(db.prepare('SELECT alias FROM users WHERE role=?').all(role).map(u => u.alias));
  if (used.size >= 9999) throw new Error('Đã hết mã tài khoản cho loại này.');
  let alias;
  do { alias = `${role}-${String(randomInt(1,10000)).padStart(3,'0')}`; } while (used.has(alias));
  const user = {id:id(),role,alias,created_at:now()};
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(user.id,role,alias,user.created_at);
  return user;
}
export function audit(db, actor, loan, action, detail='') {
  db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(id(),actor,loan,action,detail,now());
}
export function notify(db, user, loan, title) {
  db.prepare('INSERT INTO notifications VALUES(?,?,?,?,0,?)').run(id(),user,loan,title,now());
}
export function seed(db) {
  if (db.prepare('SELECT count(*) AS n FROM users').get().n) return;
  transaction(db, () => {
    const com=createUser(db,'COM'), per=createUser(db,'PER'), bro=createUser(db,'BRO'), bar=createUser(db,'BAR'), bar2=createUser(db,'BAR'), admin=createUser(db,'ADMIN');
    const extra=Array.from({length:5},()=>createUser(db,'COM'));
    const rows=[
      [com,'COM','Bổ sung vốn lưu động',3500000000,24,'Vốn lưu động','Thương mại','TP. Hồ Chí Minh',18500000000,'Bất động sản','Mở rộng nguồn hàng và bổ sung vốn lưu động cho chu kỳ kinh doanh mới. Doanh nghiệp hoạt động ổn định hơn 5 năm.'],
      [extra[0],'COM','Mở rộng nhà máy sản xuất',8000000000,60,'Đầu tư tài sản','Sản xuất','Bình Dương',42000000000,'Nhà xưởng','Đầu tư dây chuyền mới, nâng công suất sản xuất và đáp ứng đơn hàng xuất khẩu.'],
      [extra[1],'COM','Tài trợ đơn hàng xuất khẩu',5200000000,12,'Tài trợ thương mại','Xuất nhập khẩu','Hà Nội',31000000000,'Hàng tồn kho','Tài trợ nguyên vật liệu cho đơn hàng xuất khẩu đã ký, dòng tiền thu về theo từng đợt.'],
      [bro,'COM','Đầu tư đội xe vận tải',2400000000,36,'Đầu tư tài sản','Logistics','Đà Nẵng',12000000000,'Phương tiện','Đối tác môi giới đại diện doanh nghiệp bổ sung đội xe phục vụ tuyến vận chuyển mới.'],
      [extra[2],'COM','Phát triển chuỗi cửa hàng',1800000000,24,'Mở rộng kinh doanh','Bán lẻ','TP. Hồ Chí Minh',9500000000,'Bất động sản','Mở thêm hai điểm bán và nâng cấp hệ thống quản lý bán hàng.'],
      [per,'PER','Vay mua nhà ở',2200000000,180,'Mua nhà','Cá nhân','Hà Nội',720000000,'Bất động sản','Nhu cầu mua căn hộ để ở, thu nhập ổn định và có vốn tự có.'],
      [extra[3],'COM','Vốn mùa vụ nông sản',4200000000,12,'Vốn lưu động','Nông nghiệp','Đồng Nai',24000000000,'Hàng tồn kho','Thu mua và chế biến nông sản theo mùa vụ, đã có hợp đồng tiêu thụ.'],
      [extra[4],'COM','Nâng cấp cơ sở dịch vụ',950000000,36,'Mở rộng kinh doanh','Dịch vụ','Cần Thơ',6800000000,'Không có tài sản','Cải tạo cơ sở hoạt động và đầu tư thiết bị để mở rộng dịch vụ.']
    ];
    for(let i=0;i<rows.length;i++) {
      const [u,type,title,amount,term,purpose,industry,location,revenue,collateral,description]=rows[i];
      const loanId=id(); const created=new Date(Date.now()-i*86400000).toISOString();
      db.prepare('INSERT INTO loans VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)').run(loanId,u.id,u.alias,type,title,amount,term,purpose,industry,location,revenue,collateral,description,JSON.stringify({legalName:'Doanh nghiệp trải nghiệm',contact:'Dữ liệu mẫu',phone:'',email:'',taxCode:''}),i===0?'offers_received':'submitted',1,created,created);
      db.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?)').run(id(),loanId,u.id,'submitted','Hồ sơ đã được gửi lên nền tảng.',created);
      if(i===0) for(const [b,rate,days,fee] of [[bar,8.5,10,3500000],[bar2,9.2,7,2500000]]) {
        db.prepare('INSERT INTO proposals VALUES(?,?,?,?,?,?,?,?,?,?)').run(id(),loanId,b.id,rate,fee,'Phí xử lý hồ sơ công bố trong đề xuất',days,'Thẩm định tài sản và xác minh dòng tiền. Lãi suất tham khảo theo năm, quyết định cuối cùng thuộc ngân hàng.','published',now());
        db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?,?,?)').run(id(),loanId,b.id,'banker_deposit',1000000,'held','simulation',now());
      }
    }
    for(const [b,title,type,rate,max,term] of [[bar,'Vốn lưu động doanh nghiệp','COM',8.5,10000000000,36],[bar2,'Tài trợ đầu tư dài hạn','COM',9.2,20000000000,84],[bar,'Vay mua nhà linh hoạt','PER',7.9,5000000000,240]])
      db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?)').run(id(),b.id,title,type,rate,max,term,'Điều kiện phê duyệt tùy hồ sơ và chính sách ngân hàng tại thời điểm thẩm định.',now());
    notify(db,com.id,db.prepare('SELECT id FROM loans WHERE owner_id=?').get(com.id).id,'Bạn có 2 đề xuất tài trợ mới để so sánh.');
    audit(db,admin.id,null,'demo_initialized','Khởi tạo dữ liệu trải nghiệm, không có giao dịch tiền thật.');
  });
}
