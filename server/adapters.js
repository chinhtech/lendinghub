// Replace through these interfaces when verified providers and legal terms are ready.
export const demoPayments = {
  mode: 'simulation',
  deposit(db, {loanId,userId,kind,amount,id,now}) {
    db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?,?,?)').run(id(),loanId,userId,kind,amount,'held','simulation',now());
  },
  settle(db,loanId) { db.prepare("UPDATE ledger SET state='refunded_simulated' WHERE loan_id=? AND state='held'").run(loanId); }
};
export const demoSigning = {
  mode:'simulation',
  accept(db,{id,loanId,terms,now}) {db.prepare('INSERT INTO contracts VALUES(?,?,?,?,?)').run(id(),loanId,JSON.stringify(terms),now(),'simulation');}
};
export function resolveIdentity(db, request) {
  return db.prepare('SELECT * FROM users WHERE id=?').get(request.header('x-demo-user') || '');
}
