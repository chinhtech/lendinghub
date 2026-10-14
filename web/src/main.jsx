import React, { useEffect, useState, useId, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, ArrowLeft, Plus, Search, Bell, LayoutDashboard, Files, Handshake, Wallet, Settings, ChevronDown, ChevronRight, ShieldCheck, Building2, Users, UserRound, BriefcaseBusiness, SlidersHorizontal, MapPin, Clock, Check, CheckCircle2, X, Upload, FileText, Download, TrendingUp, Landmark, Menu, LogOut, CalendarDays, LockKeyhole, Activity, Info, LoaderCircle, AlertCircle } from 'lucide-react';
import { api, downloadDocument } from './api';
import { translate as tr, locale, useLanguage, setLanguage } from './i18n';
import './language.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './styles.css';
const cash = n => new Intl.NumberFormat(locale()).format(n || 0) + ' ₫';
const compact = n => n >= 1e9 ? `${(n / 1e9).toLocaleString(locale(), {
  maximumFractionDigits: 2
})} ${locale() === 'vi-VN' ? 'tỷ' : 'bn'}` : n >= 1e6 ? `${(n / 1e6).toLocaleString(locale(), {
  maximumFractionDigits: 1
})} ${locale() === 'vi-VN' ? 'triệu' : 'm'}` : cash(n);
const date = v => new Date(v).toLocaleDateString(locale());
const dateTime = v => new Date(v).toLocaleString(locale(), {
  dateStyle: 'short',
  timeStyle: 'short'
});
const roles = {
  COM: 'Doanh nghiệp',
  PER: 'Cá nhân',
  BRO: 'Đối tác môi giới',
  BAR: 'Đối tác ngân hàng',
  ADMIN: 'Quản trị viên'
};
const states = {
  submitted: 'Đang tìm đối tác',
  offers_received: 'Có đề xuất mới',
  selected: 'Đã chọn banker',
  in_review: 'Đang thẩm định',
  approved: 'Đã phê duyệt',
  appointment: 'Chờ ký hợp đồng',
  disbursed: 'Chờ xác nhận nhận vốn',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy'
};
const activeStates = ['selected', 'in_review', 'approved', 'appointment', 'disbursed'];
function LanguageSwitch() {
  const language = useLanguage();
  return <div className="language-switch" role="group" aria-label="Ngôn ngữ / Language">
    <button type="button" lang="vi" aria-label="Tiếng Việt" aria-pressed={language === 'vi'} onClick={() => setLanguage('vi')}>VI</button>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
  </div>;
}
function Badge({
  status
}) {
  return <span className={`badge ${status}`}><i />{tr(states[status] || status)}</span>;
}
function Field({
  label,
  children,
  hint
}) {
  const inputId = useId();
  return <div className="field"><label htmlFor={inputId}>{tr(label)}</label>{tr(React.cloneElement(children, {
      id: inputId
    }))}{hint && <small>{tr(hint)}</small>}</div>;
}
function Empty({
  title = 'Chưa có dữ liệu',
  description = 'Thông tin sẽ xuất hiện khi bạn thực hiện bước tiếp theo.'
}) {
  return <div className="empty"><Files size={30} /><h3>{tr(title)}</h3><p>{tr(description)}</p></div>;
}
function Modal({
  title,
  children,
  onClose,
  wide = false
}) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('button,input,select,textarea')?.focus();
    function trap(e) {
      if (e.key !== 'Tab' || Array.from(document.querySelectorAll('.modal')).at(-1) !== ref.current) return;
      const nodes = Array.from(ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')).filter(el => el.getClientRects().length);
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><section ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={tr(title)}><header className="modal-head"><h2>{tr(title)}</h2><LanguageSwitch /><button className="icon-button" onClick={onClose} aria-label={tr("Đóng")}><X size={20} /></button></header>{children}</section></div>;
}
function App() {
  useLanguage();
  const [users, setUsers] = useState([]),
    [user, setUser] = useState(null),
    [loans, setLoans] = useState([]),
    [products, setProducts] = useState([]),
    [notifications, setNotifications] = useState([]),
    [view, setView] = useState('overview'),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [location, setLocation] = useState('all'),
    [type, setType] = useState('all'),
    [sort, setSort] = useState('newest'),
    [showFilters, setShowFilters] = useState(false),
    [modal, setModal] = useState(null),
    [detail, setDetail] = useState(null),
    [tab, setTab] = useState('summary'),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [admin, setAdmin] = useState(null),
    [mobile, setMobile] = useState(false),
    [showNotifications, setShowNotifications] = useState(false);
  const isBank = user?.role === 'BAR',
    isAdmin = user?.role === 'ADMIN';
  const announce = t => {
    setToast(t);
    setTimeout(() => setToast(''), 4500);
  };
  async function refresh() {
    const [l, p, n] = await Promise.all([api('/loans'), api('/products'), api('/notifications')]);
    setLoans(l);
    setProducts(p);
    setNotifications(n);
    if (user?.role === 'ADMIN') setAdmin(await api('/admin'));
  }
  useEffect(() => {
    api('/demo/users').then(u => {
      setUsers(u);
      const selected = u.find(v => v.id === localStorage.getItem('lending-user')) || u.find(v => v.role === 'BAR');
      localStorage.setItem('lending-user', selected.id);
      setUser(selected);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError('');
    refresh().catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [user]);
  useEffect(() => {
    function key(e) {
      if (e.key === 'Escape') {
        if (modal) setModal(null);else if (detail) setDetail(null);else setShowNotifications(false);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [modal, detail]);
  async function action(fn, success) {
    setBusy(true);
    setError('');
    try {
      const result = await fn();
      await refresh();
      if (detail) {
        try {
          setDetail(await api(`/loans/${detail.id}`));
        } catch {
          setDetail(null);
        }
      }
      if (success) announce(success);
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  function switchUser(value) {
    const u = users.find(u => u.id === value);
    localStorage.setItem('lending-user', u.id);
    setUser(u);
    setDetail(null);
    setModal(null);
    setView('overview');
    setQuery('');
    setFilter('all');
    setShowNotifications(false);
  }
  async function openLoan(l) {
    setError('');
    try {
      setDetail(await api(`/loans/${l.id}`));
      setTab('summary');
    } catch (e) {
      setError(e.message);
    }
  }
  function navigate(v) {
    setView(v);
    setQuery('');
    setFilter('all');
    setMobile(false);
  }
  const visible = loans.filter(l => (filter === 'all' || (filter === 'active' ? activeStates.includes(l.status) : l.status === filter)) && (type === 'all' || l.borrower_type === type) && (location === 'all' || l.location === location) && `${l.title} ${l.alias} ${l.industry} ${l.location} ${tr(l.industry)} ${tr(l.location)}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'amount' ? b.amount - a.amount : new Date(b.created_at) - new Date(a.created_at));
  const total = loans.reduce((sum, l) => sum + l.amount, 0),
    active = loans.filter(l => activeStates.includes(l.status)).length;
  const nav = [['overview', LayoutDashboard, 'Tổng quan'], ['loans', Files, isBank ? 'Khám phá hồ sơ' : 'Hồ sơ của tôi'], ['offers', Handshake, isBank ? 'Đề xuất của tôi' : 'Đề xuất tài trợ'], ['progress', Activity, 'Tiến độ xử lý'], ['products', Landmark, 'Gói vay'], ['wallet', Wallet, 'Cọc & phí dịch vụ'], ...(isAdmin ? [['admin', Settings, 'Quản trị hệ thống']] : [])];
  return <div className="app-shell">
  <aside className={`sidebar ${mobile ? 'open' : ''}`}><a className="brand" href="#" onClick={e => {
        e.preventDefault();
        navigate('overview');
      }}><span className="brand-mark"><span /><span /><span /></span><span>Lending<span className="brand-light">Hub</span><small>{tr("KẾT NỐI VỐN · MỞ CƠ HỘI")}</small></span></a><div className="workspace-label">{tr("KHÔNG GIAN LÀM VIỆC")}</div><nav>{nav.map(([v, Icon, label]) => <button key={v} onClick={() => navigate(v)} className={view === v ? 'active' : ''}><Icon size={19} /><span>{tr(label)}</span>{v === 'loans' && <b aria-hidden="true">{tr(loans.length)}</b>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-help"><ShieldCheck size={26} /><h4>{tr("Kết nối có trách nhiệm")}</h4><p>{tr("Thông tin ẩn danh.")}<br />{tr("Điều kiện và chi phí minh bạch.")}</p><span>{tr("Đồng hành cùng doanh nghiệp ")}<ArrowUpRight size={14} /></span></div><div className="sidebar-profile"><div className="avatar">{user?.role === 'BAR' ? <Landmark size={20} /> : <UserRound size={20} />}</div><div><strong>{tr(user?.alias || 'Lending Hub')}</strong><small>{tr(roles[user?.role])}</small></div><span className="online-dot" /></div></div></aside>
  <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={() => setMobile(!mobile)} aria-label={tr("Mở menu")}><Menu size={22} /></button><span>{tr("Không gian làm việc")}</span><ChevronRight size={14} /><strong>{tr(nav.find(n => n[0] === view)?.[2])}</strong></div><div className="top-actions"><LanguageSwitch /><span className="demo-pill"><i />{tr("Bản trải nghiệm")}</span><div className="notification-wrap"><button className="icon-button" aria-label={tr("Thông báo")} onClick={() => setShowNotifications(!showNotifications)}><Bell size={20} />{notifications.some(n => !n.read) && <i className="notification-dot" />}</button>{showNotifications && <div className="notification-panel"><header><strong>{tr("Thông báo")}</strong><button onClick={() => action(() => api('/notifications/read', {
                  method: 'POST'
                })).catch(() => {})}>{tr("Đã đọc tất cả")}</button></header>{notifications.length ? notifications.map(n => <button className={!n.read ? 'unread' : ''} key={n.id} onClick={() => {
                const l = loans.find(l => l.id === n.loan_id);
                if (l) openLoan(l);
                setShowNotifications(false);
              }}><span>{tr(n.title)}</span><small>{tr(dateTime(n.created_at))}</small></button>) : <p>{tr("Chưa có thông báo.")}</p>}</div>}</div><div className="top-divider" /><div className="account-picker"><select aria-label={tr("Chọn tài khoản trải nghiệm")} value={user?.id || ''} onChange={e => switchUser(e.target.value)}>{users.map(u => <option key={u.id} value={u.id}>{tr(u.alias)}{tr(" · ")}{tr(roles[u.role])}</option>)}</select><ChevronDown size={14} /></div><button className="icon-button" aria-label={tr("Tạo tài khoản trải nghiệm")} onClick={() => setModal('account')}><Plus size={18} /></button></div></header>
  <main><div className="demo-notice"><Info size={15} /><span>{tr("Trải nghiệm quy trình với dữ liệu mẫu. Chữ ký, cọc và thanh toán được mô phỏng. Vui lòng không nhập thông tin hoặc tài liệu thật.")}</span></div>{error && <div className="error-banner" role="alert"><AlertCircle size={18} />{tr(error)}<button aria-label={tr("Đóng lỗi")} onClick={() => setError('')}><X size={16} /></button></div>}
  <div className="page-heading"><div><div className="eyebrow">{tr(isBank ? 'KẾT NỐI CƠ HỘI TÀI TRỢ' : isAdmin ? 'ĐIỀU HÀNH NỀN TẢNG' : 'HÀNH TRÌNH VỐN CỦA BẠN')}</div><h1>{tr(view === 'overview' ? 'Tổng quan' : nav.find(n => n[0] === view)?.[2])}</h1><p>{tr(isBank ? 'Khám phá hồ sơ phù hợp, kết nối nguồn vốn và cùng doanh nghiệp phát triển.' : isAdmin ? 'Theo dõi hồ sơ, đối tác và mọi hoạt động trên Lending Hub.' : 'Chuẩn bị hồ sơ một lần, tiếp cận nhiều đối tác và theo dõi từng bước.')}</p></div>{!isBank && !isAdmin ? <button className="button primary" onClick={() => setModal('loan')}><Plus size={18} />{tr("Tạo hồ sơ vay")}</button> : <div className="date-label"><CalendarDays size={17} />{tr(new Date().toLocaleDateString(locale(), {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }))}</div>}</div>
  {loading ? <div className="loading"><LoaderCircle className="spin" />{tr("Đang tải không gian làm việc…")}</div> : <>
  {view === 'overview' && <><div className="hero-card"><div className="hero-copy"><span className="hero-tag"><span />{tr("NỀN TẢNG KẾT NỐI TÀI TRỢ")}</span><h2>{isBank ? <>{tr("Nguồn vốn đúng nơi.")}<br />{tr("Cơ hội đúng thời điểm.")}</> : <>{tr("Một hồ sơ.")}<br />{tr("Nhiều cơ hội tiếp cận vốn.")}</>}</h2><p>{tr(isBank ? 'Những hồ sơ doanh nghiệp được chuẩn bị rõ ràng.\nBạn chọn cơ hội phù hợp, chúng tôi kết nối hành trình.' : 'So sánh đề xuất minh bạch và chủ động lựa chọn\nđối tác phù hợp với kế hoạch của bạn.')}</p><button onClick={() => navigate('loans')}> {tr(isBank ? 'Khám phá hồ sơ' : 'Xem hồ sơ của tôi')}<ArrowUpRight size={17} /></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-center"><span className="brand-mark"><span /><span /><span /></span></div><div className="art-chip chip-one"><Building2 size={17} />{tr("Doanh nghiệp")}</div><div className="art-chip chip-two"><Landmark size={17} />{tr("Đối tác ngân hàng")}</div><div className="art-note"><span><Check size={12} /></span>{tr("Kết nối minh bạch")}</div></div></div>
  <div className="stats-grid">{[[Files, 'Hồ sơ ' + (isBank ? 'khả dụng' : 'đã tạo'), loans.length, 'Hồ sơ trên không gian của bạn'], [Wallet, 'Tổng nhu cầu vốn', compact(total), 'Giá trị các hồ sơ hiện có'], [Handshake, isBank ? 'Đề xuất đã gửi' : 'Đề xuất nhận được', loans.reduce((s, l) => s + (isBank ? l.proposals.length : l.proposal_count), 0), 'Kết nối cùng đối tác'], [TrendingUp, 'Đang xử lý', active, 'Hồ sơ trong hành trình tài trợ']].map(([Icon, label, value, note], i) => <div className="stat" key={label}><div className="stat-top"><span>{tr(label)}</span><div className={`stat-icon tone-${i}`}><Icon size={18} /></div></div><strong>{tr(value)}</strong><small>{tr(note)}</small></div>)}</div></>}
  {['overview', 'loans'].includes(view) && <section className="panel loans-panel"><div className="section-head"><div><h2>{tr(view === 'overview' ? isBank ? 'Hồ sơ tìm kiếm tài trợ' : 'Hồ sơ của bạn' : isBank ? 'Khám phá hồ sơ' : 'Danh sách hồ sơ')}</h2><p>{tr(isBank ? 'Cơ hội kết nối từ doanh nghiệp và cá nhân trên nền tảng.' : 'Quản lý thông tin, đề xuất và tiến độ của từng hồ sơ.')}</p></div><span className="count-label">{tr(visible.length)}{tr(" hồ sơ")}</span></div><div className="list-tools"><div className="tabs">{[['all', 'Tất cả'], ['submitted', 'Mới đăng'], ['offers_received', 'Có đề xuất'], ['active', 'Đang xử lý']].map(([v, l]) => <button key={v} className={filter === v ? 'selected' : ''} onClick={() => setFilter(v)}>{tr(l)}{v === 'all' && <span>{tr(loans.length)}</span>}</button>)}</div><div className="search-filter"><div className="search-box"><Search size={17} /><input aria-label={tr("Tìm hồ sơ")} placeholder={tr("Tìm hồ sơ, ngành nghề…")} value={query} onChange={e => setQuery(e.target.value)} /></div><button className={`button small ${showFilters ? 'selected' : ''}`} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} />{tr("Bộ lọc")}</button></div></div>{showFilters && <div className="filters"><Field label={tr("Đối tượng")}><select value={type} onChange={e => setType(e.target.value)}><option value="all">{tr("Tất cả đối tượng")}</option><option value="COM">{tr("Doanh nghiệp")}</option><option value="PER">{tr("Cá nhân")}</option></select></Field><Field label={tr("Khu vực")}><select value={location} onChange={e => setLocation(e.target.value)}><option value="all">{tr("Tất cả khu vực")}</option>{[...new Set(loans.map(l => l.location))].map(v => <option key={v} value={v}>{tr(v)}</option>)}</select></Field><Field label={tr("Sắp xếp")}><select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">{tr("Mới nhất")}</option><option value="amount">{tr("Nhu cầu vốn cao nhất")}</option></select></Field><button className="text-button" onClick={() => {
                setLocation('all');
                setType('all');
                setSort('newest');
                setQuery('');
                setFilter('all');
              }}>{tr("Xóa bộ lọc")}</button></div>}
  {visible.length ? <div className="table-scroll"><table className="loan-table"><thead><tr><th>{tr("HỒ SƠ / NHU CẦU VỐN")}</th><th>{tr("SỐ TIỀN VAY")}</th><th>{tr("KỲ HẠN")}</th><th>{tr("TÀI SẢN BẢO ĐẢM")}</th><th>{tr("TRẠNG THÁI")}</th><th /></tr></thead><tbody>{visible.map(l => <tr key={l.id} onClick={() => openLoan(l)}><td><div className="loan-identity"><div className={`loan-icon ${l.borrower_type === 'PER' ? 'personal' : ''}`}>{l.borrower_type === 'COM' ? <Building2 size={20} /> : <UserRound size={20} />}</div><div><button className="loan-title" onClick={e => {
                            e.stopPropagation();
                            openLoan(l);
                          }}>{l.title}</button><div className="loan-meta"><span>{tr(l.alias)}</span><i /> {tr(l.industry)}<i /><MapPin size={11} />{tr(l.location)}</div></div></div></td><td><strong className="amount">{tr(compact(l.amount))}</strong><small className="muted">{tr("VNĐ")}</small></td><td>{tr(l.term)}{tr(" tháng")}</td><td><span className="collateral">{tr(l.collateral)}</span></td><td><Badge status={l.status} /></td><td><button className="arrow-button" aria-label={tr(`Xem ${l.title}`)}><ArrowUpRight size={18} /></button></td></tr>)}</tbody></table></div> : <Empty title={tr("Không có hồ sơ phù hợp")} description={tr("Thử thay đổi bộ lọc hoặc tạo hồ sơ đầu tiên của bạn.")} />}<div className="table-footer"><span>{tr("Hiển thị ")}{tr(visible.length)}{tr(" hồ sơ · Thông tin công khai đã được ẩn danh")}</span><span><LockKeyhole size={13} />{tr("Bảo vệ danh tính")}</span></div></section>}
  {view === 'overview' && <div className="bottom-grid"><section className="panel steps-panel"><div className="section-head"><h2>{tr("Hành trình tài trợ, rõ từng bước")}</h2><span className="soft-label">{tr("QUY TRÌNH")}</span></div><div className="mini-steps">{[['01', 'Chuẩn bị hồ sơ', 'Cung cấp nhu cầu và tài liệu'], ['02', 'Kết nối đối tác', 'So sánh đề xuất minh bạch'], ['03', 'Theo dõi xử lý', 'Cập nhật tiến độ xuyên suốt'], ['04', 'Nhận nguồn vốn', 'Xác nhận và hoàn tất hồ sơ']].map(([n, t, d]) => <div key={n}><span>{tr(n)}</span><strong>{tr(t)}</strong><small>{tr(d)}</small></div>)}</div></section><section className="insight-card"><div className="insight-icon"><ShieldCheck size={23} /></div><h3>{tr("Minh bạch từ đề xuất đầu tiên")}</h3><p>{tr("Lãi suất, phí và thời gian xử lý được công bố trước khi bạn lựa chọn đối tác.")}</p><button onClick={() => navigate('offers')}>{tr("Xem đề xuất tài trợ ")}<ArrowRight size={15} /></button></section></div>}
  {view === 'offers' && <section className="panel"><div className="section-head"><div><h2>{tr(isBank ? 'Các đề xuất đã gửi' : 'So sánh đề xuất tài trợ')}</h2><p>{tr("Lãi suất theo năm, phí cố định và thời gian xử lý được tách riêng.")}</p></div></div><div className="card-grid">{loans.flatMap(l => l.proposals.map(p => <OfferCard key={p.id} p={p} loan={l} onOpen={() => openLoan(l)} />))}</div>{!loans.some(l => l.proposals.length) && <Empty title={tr("Chưa có đề xuất")} description={tr(isBank ? 'Khám phá hồ sơ và gửi đề xuất tài trợ đầu tiên.' : 'Đề xuất của banker sẽ xuất hiện khi hồ sơ được quan tâm.')} />}</section>}
  {view === 'progress' && <section className="panel"><div className="section-head"><div><h2>{tr("Hồ sơ đang đồng hành")}</h2><p>{tr("Mỗi cập nhật đều có thời gian và người thực hiện.")}</p></div></div>{loans.filter(l => activeStates.includes(l.status) || l.status === 'completed' || l.status === 'cancelled').map(l => <button key={l.id} className="progress-row" onClick={() => openLoan(l)}><div className="loan-icon"><Activity size={20} /></div><div><strong>{l.title}</strong><small>{tr(l.alias)}{tr(" · ")}{tr(compact(l.amount))}{tr(" · ")}{tr(l.selected_banker_alias)}</small></div><Badge status={l.status} /><ChevronRight size={18} /></button>)}{!loans.some(l => activeStates.includes(l.status) || l.status === 'completed' || l.status === 'cancelled') && <Empty title={tr("Chưa có hồ sơ đang xử lý")} description={tr("Tiến độ xuất hiện sau khi khách hàng lựa chọn banker.")} />}</section>}
  {view === 'products' && <section className="panel"><div className="section-head"><div><h2>{tr("Giải pháp vốn từ đối tác")}</h2><p>{tr("Thông tin tham khảo. Phê duyệt và lãi suất cuối cùng tùy hồ sơ.")}</p></div>{isBank && <button className="button primary small" onClick={() => setModal('product')}><Plus size={16} />{tr("Thêm gói vay")}</button>}</div><div className="card-grid">{products.map(p => <article className="product-card" key={p.id}><div className="product-top"><div className="loan-icon"><Landmark size={24} /></div><span className="soft-label">{tr(p.borrower_type === 'COM' ? 'DOANH NGHIỆP' : 'CÁ NHÂN')}</span></div><small>{tr(p.banker_alias)}</small><h3>{p.title}</h3><div className="product-rate">{tr(p.rate)}%<span>{tr(" / năm · tham khảo")}</span></div><dl><div><dt>{tr("Hạn mức tối đa")}</dt><dd>{tr(compact(p.max_amount))}</dd></div><div><dt>{tr("Kỳ hạn tối đa")}</dt><dd>{tr(p.term)}{tr(" tháng")}</dd></div></dl><p>{p.description}</p>{!isBank && !isAdmin && <button className="button full" onClick={() => setModal('loan')}>{tr("Tạo hồ sơ phù hợp ")}<ArrowRight size={15} /></button>}</article>)}</div>{!products.length && <Empty />}</section>}
  {view === 'wallet' && <section className="panel"><div className="section-head"><div><h2>{tr("Cọc & phí dịch vụ")}</h2><p>{tr("Sổ theo dõi mô phỏng. Không có giao dịch tiền thật.")}</p></div><span className="soft-label">{tr("MÔ PHỎNG")}</span></div><WalletView user={user} loans={loans} admin={admin} /></section>}
  {view === 'admin' && admin && <AdminView data={admin} onLoan={openLoan} onResolve={entry => setModal({
            kind: 'resolve',
            entry
          })} />}
  </>}
  <footer className="page-footer"><span>{tr("© ")}{tr(new Date().getFullYear())} Lending Hub</span><span>{tr("Nền tảng kết nối · Ngân hàng quyết định cấp tín dụng")}</span><span>{tr("Minh bạch. Chủ động. Đồng hành.")}</span></footer></main></div>
  {toast && <div className="toast" role="status"><CheckCircle2 size={19} />{tr(toast)}</div>}
  {detail && <LoanDetail loan={detail} user={user} tab={tab} setTab={setTab} onClose={() => setDetail(null)} busy={busy} action={action} setModal={setModal} onError={setError} />}
  {modal && <WorkflowModal modal={modal} user={user} loan={detail} busy={busy} action={action} onClose={() => setModal(null)} onCreated={async l => {
      setModal(null);
      if (l) {
        await openLoan(l);
      }
    }} onAccount={u => {
      setUsers([...users, u]);
      localStorage.setItem('lending-user', u.id);
      setUser(u);
      setModal(null);
      setView('overview');
    }} />}
 </div>;
}
function OfferCard({
  p,
  loan,
  onOpen,
  onSelect
}) {
  return <article className={`offer-card ${p.status === 'selected' ? 'chosen' : ''}`}><div className="offer-top"><div className="avatar light"><Landmark size={18} /></div><strong>{tr(p.banker_alias)}</strong><span className="soft-label">{tr(p.status === 'selected' ? 'ĐÃ CHỌN' : p.status === 'not_selected' ? 'KHÔNG ĐƯỢC CHỌN' : 'ĐÃ CỌC · MÔ PHỎNG')}</span></div>{loan && <p className="offer-loan">{loan.title}</p>}<div className="offer-rate">{tr(p.rate)}%<span>{tr(" / năm")}</span></div><dl><div><dt>{tr("Phí cố định")}</dt><dd>{tr(cash(p.fee))}</dd></div><div><dt>{tr("Thời gian dự kiến")}</dt><dd>{tr(p.days)}{tr(" ngày")}</dd></div></dl><small>{p.fee_description}</small><div className="offer-conditions">{p.conditions}</div>{onSelect ? <button className="button primary full" onClick={onSelect}>{tr("Chọn đề xuất này ")}<ArrowRight size={16} /></button> : onOpen && <button className="button full" onClick={onOpen}>{tr("Xem hồ sơ ")}<ArrowRight size={16} /></button>}</article>;
}
function LoanDetail({
  loan: l,
  user,
  tab,
  setTab,
  onClose,
  busy,
  action,
  setModal,
  onError
}) {
  const owned = l.is_owner,
    assigned = l.selected_banker_alias === user.alias,
    canOffer = user.role === 'BAR' && ['submitted', 'offers_received'].includes(l.status) && !l.proposals.length;
  const call = (path, body, msg) => action(() => api(`/loans/${l.id}/${path}`, {
    method: 'POST',
    body
  }), msg).catch(() => {});
  return <Modal title={tr("Chi tiết hồ sơ")} onClose={onClose} wide><div className="detail-content"><div className="detail-title"><div><span className="eyebrow">{tr(l.alias)}{tr(" · ")}{tr(l.borrower_type === 'COM' ? 'DOANH NGHIỆP' : 'CÁ NHÂN')}{tr(user.role === 'BRO' ? ' · ĐẠI DIỆN' : '')}</span><h2>{l.title}</h2><p><MapPin size={14} />{tr(l.location)}<span>{tr("·")}</span>{tr(l.industry)}<span>{tr("·")}</span>{tr("Ngày gửi ")}{tr(date(l.created_at))}</p></div><Badge status={l.status} /></div><div className="detail-stats"><div><small>{tr("Nhu cầu vốn")}</small><strong>{tr(compact(l.amount))}</strong></div><div><small>{tr("Kỳ hạn")}</small><strong>{tr(l.term)}{tr(" tháng")}</strong></div><div><small>{tr("Doanh thu / thu nhập năm")}</small><strong>{tr(compact(l.revenue))}</strong></div><div><small>{tr("Tài sản bảo đảm")}</small><strong>{tr(l.collateral)}</strong></div></div><div className="tabs detail-tabs">{[['summary', 'Thông tin hồ sơ'], ['offers', `Đề xuất (${l.proposal_count})`], ['progress', 'Tiến độ & lịch hẹn'], ['documents', `Tài liệu (${l.document_count})`]].map(([v, label]) => <button key={v} onClick={() => setTab(v)} className={tab === v ? 'selected' : ''}>{tr(label)}</button>)}</div>
 {tab === 'summary' && <><div className="detail-columns"><section><h3>{tr("Nhu cầu & kế hoạch sử dụng vốn")}</h3><p className="body-copy">{l.description}</p><dl className="detail-dl"><div><dt>{tr("Mục đích vay")}</dt><dd>{tr(l.purpose)}</dd></div><div><dt>{tr("Đối tượng vay")}</dt><dd>{tr(roles[l.borrower_type])}</dd></div><div><dt>{tr("Số đề xuất")}</dt><dd>{tr(l.proposal_count)}{tr(" đề xuất")}</dd></div><div><dt>{tr("Banker đồng hành")}</dt><dd>{tr(l.selected_banker_alias || 'Chưa lựa chọn')}</dd></div></dl>{l.private_data ? <><h3>{tr("Thông tin được chia sẻ")}</h3><dl className="detail-dl">{Object.entries(l.private_data).map(([k, v]) => <div key={k}><dt>{tr({
                      legalName: 'Tên khách hàng',
                      contact: 'Người liên hệ',
                      phone: 'Điện thoại',
                      email: 'Email',
                      taxCode: 'Mã số thuế'
                    }[k])}</dt><dd>{v || tr('Chưa cung cấp')}</dd></div>)}</dl></> : <div className="privacy-note"><LockKeyhole size={20} /><p>{tr("Danh tính và tài liệu được giữ riêng tư. Banker được khách hàng lựa chọn mới được tiếp cận thông tin chia sẻ.")}</p></div>}</section><aside className="detail-aside"><ShieldCheck size={27} /><h3>{tr("Rõ điều kiện, đúng kỳ vọng")}</h3><p>{tr("Lãi suất là thông tin tham khảo. Quyết định tín dụng và hợp đồng giải ngân thuộc về ngân hàng.")}</p><hr /><small>{tr("PHÍ NỀN TẢNG THAM KHẢO")}</small><strong>{tr(cash(Math.round(l.amount * .005)))}</strong><p>{tr("0,5% số tiền hồ sơ, thanh toán khi hoàn tất trong bản mô phỏng. Điều khoản thực tế cần được chốt trước khi vận hành.")}</p></aside></div></>}
 {tab === 'offers' && <><div className="inline-note"><Info size={17} /><span>{tr("So sánh lãi suất, phí cố định, điều kiện và thời gian. Phí thẩm định dự kiến 2.000.000 ₫ và phí nền tảng được công bố riêng ở bước xác nhận. Không có khoản “phí ngoài” không được công bố.")}</span></div><div className="card-grid">{l.proposals.map(p => <OfferCard key={p.id} p={p} onSelect={owned && ['submitted', 'offers_received'].includes(l.status) ? () => setModal({
            kind: 'select',
            proposal: p
          }) : null} />)}</div>{!l.proposals.length && <Empty title={tr("Chưa có đề xuất tài trợ")} description={tr(user.role === 'BAR' ? 'Bạn có thể gửi đề xuất với các điều kiện phù hợp.' : 'Đề xuất sẽ xuất hiện khi banker quan tâm tới hồ sơ.')} />}</>}
 {tab === 'documents' && <><div className="inline-note"><LockKeyhole size={17} /><span>{tr("Chỉ tải tài liệu mẫu. PDF, JPG, PNG · tối đa 10 MB/tệp · 12 tệp/hồ sơ. Tài liệu không hiển thị công khai trên bảng hồ sơ.")}</span></div>{l.documents.map(d => <div className="document-row" key={d.id}><FileText size={22} /><div><strong>{d.name}</strong><small>{tr((d.size / 1024).toFixed(1))}{tr(" KB · ")}{tr(date(d.created_at))}</small></div><button className="button small" onClick={() => downloadDocument(d).catch(e => onError(e.message))}><Download size={15} />{tr("Tải xuống")}</button></div>)}{!l.documents.length && <Empty title={tr(l.private_data ? 'Chưa có tài liệu' : 'Tài liệu đang được bảo vệ')} description={tr(l.private_data ? 'Bạn có thể tải lên tài liệu mẫu cho hồ sơ.' : 'Khách hàng sẽ chia sẻ khi lựa chọn banker.')} />} {owned && ['submitted', 'offers_received', 'selected', 'in_review'].includes(l.status) && <label className="upload-zone"><Upload size={23} /><strong>{tr(busy ? 'Đang tải tài liệu…' : 'Chọn tài liệu mẫu để tải lên')}</strong><small>{tr("PDF, JPG hoặc PNG · tối đa 10 MB")}</small><input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy} onChange={e => {
            const f = e.target.files[0];
            if (!f) return;
            const form = new FormData();
            form.append('file', f);
            action(() => api(`/loans/${l.id}/documents`, {
              method: 'POST',
              body: form
            }), 'Đã tải tài liệu lên.').catch(() => {});
            e.target.value = '';
          }} /></label>}</>}
 {tab === 'progress' && <><div className="progress-summary"><div><small>{tr("ĐỐI TÁC ĐỒNG HÀNH")}</small><strong>{tr(l.selected_banker_alias || 'Chưa lựa chọn')}</strong></div><div><small>{tr("MỐC XỬ LÝ DỰ KIẾN")}</small><strong>{tr(l.due_at ? date(l.due_at) : 'Sau khi bắt đầu thẩm định')}</strong>{l.due_at && new Date(l.due_at) < new Date() && !['completed', 'cancelled'].includes(l.status) && <span className="overdue">{tr("Quá hạn · cần quản trị xem xét")}</span>}</div></div><div className="timeline">{l.progress.map((p, i) => <div className="timeline-item" key={p.id}><span className={`timeline-point ${i === l.progress.length - 1 ? 'latest' : ''}`}><Check size={12} /></span><div><strong>{tr(states[p.stage])}</strong><p>{p.note}</p><small>{tr(dateTime(p.created_at))}{tr(" · ")}{tr(p.actor_alias)}</small></div></div>)}</div>{l.appointment && <div className="appointment"><CalendarDays size={26} /><div><h3>{tr("Lịch ký hợp đồng giải ngân")}</h3><p>{tr(dateTime(l.appointment.scheduled_at))}{tr(" · ")}{tr(l.appointment.location)}</p><small>{l.appointment.note}</small><p>{tr(l.appointment.confirmed ? 'Khách hàng đã xác nhận lịch hẹn.' : 'Đang chờ khách hàng xác nhận.')}</p></div>{owned && !l.appointment.confirmed && <button className="button primary small" disabled={busy} onClick={() => call('confirm-appointment', {}, 'Đã xác nhận lịch hẹn.')}>{tr("Xác nhận lịch")}</button>}</div>}{l.contract && <div className="inline-note"><FileText size={20} /><span>{tr("Điều khoản phiên bản demo-1 đã được chấp thuận lúc ")}{tr(dateTime(l.contract.accepted_at))}{tr(". Chữ ký và hợp đồng đang ở chế độ mô phỏng.")}</span></div>}{l.status === 'completed' && <div className="completion"><CheckCircle2 size={32} /><h3>{tr("Hành trình tài trợ đã hoàn tất")}</h3><p>{tr("Đã xác nhận nhận vốn, ghi nhận phí dịch vụ và hoàn cọc trong sổ mô phỏng.")}</p></div>}</>}
 <div className="detail-actions"><div>{!['completed', 'cancelled', 'disbursed'].includes(l.status) && (owned || assigned) && <button className="text-button danger" disabled={busy} onClick={() => setModal('cancel')}>{tr("Hủy hồ sơ")}</button>}</div><div>{canOffer && <button className="button primary" onClick={() => setModal('proposal')}><Handshake size={18} />{tr("Gửi đề xuất tài trợ")}</button>}{owned && l.status === 'offers_received' && <button className="button primary" onClick={() => setTab('offers')}>{tr("So sánh & chọn đề xuất ")}<ArrowRight size={16} /></button>}{owned && l.status === 'selected' && <button className="button primary" onClick={() => setModal('activate')}>{tr("Xác nhận điều khoản & bắt đầu ")}<ArrowRight size={16} /></button>}{assigned && l.status === 'in_review' && <button className="button primary" onClick={() => setModal('progress')}>{tr("Cập nhật tiến độ ")}<Plus size={16} /></button>}{assigned && l.status === 'approved' && <button className="button primary" onClick={() => setModal('appointment')}><CalendarDays size={17} />{tr("Đặt lịch ký hợp đồng")}</button>}{assigned && l.status === 'appointment' && l.appointment?.confirmed && <button className="button primary" onClick={() => setModal('disburse')}>{tr("Báo đã giải ngân")}</button>}{owned && l.status === 'disbursed' && <button className="button primary" onClick={() => setModal('complete')}>{tr("Xác nhận nhận vốn & hoàn tất")}</button>}{l.status === 'completed' && <span className="soft-label">{tr("HỒ SƠ ĐÃ HOÀN TẤT")}</span>}</div></div></div></Modal>;
}
function FormInput({
  label,
  name,
  type = 'text',
  defaultValue,
  required = true,
  min,
  max,
  step,
  hint
}) {
  return <Field label={tr(label)} hint={tr(hint)}><input name={name} type={type} defaultValue={defaultValue} required={required} min={min} max={max} step={step} /></Field>;
}
function WorkflowModal({
  modal,
  user,
  loan,
  busy,
  action,
  onClose,
  onCreated,
  onAccount
}) {
  const kind = typeof modal === 'string' ? modal : modal.kind;
  const [localError, setLocalError] = useState('');
  const titles = {
    account: 'Tạo tài khoản trải nghiệm',
    loan: 'Tạo hồ sơ vay',
    proposal: 'Gửi đề xuất tài trợ',
    select: 'Xác nhận lựa chọn banker',
    activate: 'Điều khoản & bắt đầu xử lý',
    progress: 'Cập nhật tiến độ',
    appointment: 'Đặt lịch ký hợp đồng',
    disburse: 'Xác nhận báo giải ngân',
    complete: 'Xác nhận nhận vốn & hoàn tất',
    cancel: 'Hủy hồ sơ',
    product: 'Thêm gói vay',
    resolve: 'Xử lý cọc mô phỏng'
  };
  async function submit(e) {
    e.preventDefault();
    setLocalError('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    let path, body;
    const numeric = (...keys) => {
      for (const k of keys) d[k] = Number(d[k]);
    };
    try {
      if (kind === 'account') {
        const u = await action(() => api('/demo/users', {
          method: 'POST',
          body: {
            role: d.role
          }
        }), 'Đã tạo tài khoản trải nghiệm.');
        onAccount(u);
        return;
      }
      if (kind === 'loan') {
        numeric('amount', 'term', 'revenue');
        body = {
          borrower_type: user.role === 'BRO' ? d.borrower_type : user.role,
          title: d.title,
          amount: d.amount,
          term: d.term,
          purpose: d.purpose,
          industry: d.industry,
          location: d.location,
          revenue: d.revenue,
          collateral: d.collateral,
          description: d.description,
          consent: d.consent === 'on',
          private_data: {
            legalName: d.legalName,
            contact: d.contact,
            phone: d.phone,
            email: d.email,
            taxCode: d.taxCode
          }
        };
        const l = await action(() => api('/loans', {
          method: 'POST',
          body
        }), 'Đã tạo hồ sơ. Bạn có thể bổ sung tài liệu mẫu.');
        await onCreated(l);
        return;
      }
      if (kind === 'product') {
        numeric('rate', 'max_amount', 'term');
        await action(() => api('/products', {
          method: 'POST',
          body: d
        }), 'Đã thêm gói vay.');
        onClose();
        return;
      }
      if (kind === 'resolve') {
        await action(() => api(`/admin/ledger/${modal.entry.id}/resolve`, {
          method: 'POST',
          body: {
            outcome: d.outcome,
            reason: d.reason
          }
        }), 'Đã ghi nhận quyết định xử lý cọc mô phỏng.');
        onClose();
        return;
      }
      if (kind === 'proposal') {
        numeric('rate', 'fee', 'days');
        path = 'proposals';
        body = {
          ...d,
          simulate_deposit: d.simulate_deposit === 'on'
        };
      }
      if (kind === 'select') {
        path = 'select';
        body = {
          proposal_id: modal.proposal.id,
          consent: d.consent === 'on'
        };
      }
      if (kind === 'activate') {
        path = 'activate';
        body = {
          accept_terms: d.accept_terms === 'on',
          simulate_signature: true,
          simulate_deposit: true
        };
      }
      if (kind === 'progress') {
        path = 'progress';
        body = {
          stage: d.stage,
          note: d.note
        };
      }
      if (kind === 'appointment') {
        path = 'appointment';
        body = {
          scheduled_at: new Date(d.scheduled_at).toISOString(),
          location: d.location,
          note: d.note
        };
      }
      if (kind === 'disburse') {
        path = 'disburse';
        body = {
          confirm: d.confirm === 'on'
        };
      }
      if (kind === 'complete') {
        path = 'complete';
        body = {
          confirm_received: d.confirm_received === 'on',
          simulate_payment: true
        };
      }
      if (kind === 'cancel') {
        path = 'cancel';
        body = {
          reason: d.reason
        };
      }
      await action(() => api(`/loans/${loan.id}/${path}`, {
        method: 'POST',
        body
      }), 'Đã cập nhật hồ sơ.');
      onClose();
    } catch (e) {
      setLocalError(e.message);
    }
  }
  return <Modal title={tr(titles[kind])} onClose={onClose} wide={kind === 'loan'}><form className="workflow-form" onSubmit={submit}>{localError && <div className="error-banner" role="alert">{tr(localError)}</div>}
 {kind === 'account' && <><div className="inline-note"><Info size={18} /><span>{tr("Tạo danh tính mẫu để thử quy trình. Chưa có đăng nhập hoặc xác minh người dùng trong phiên bản này.")}</span></div><Field label={tr("Loại tài khoản")}><select name="role">{['COM', 'PER', 'BRO', 'BAR'].map(r => <option value={r} key={r}>{tr(r)}{tr(" — ")}{tr(roles[r])}</option>)}</select></Field><p className="muted">{tr("Alias được tạo ngẫu nhiên từ 1–9999, không trùng trong cùng loại tài khoản.")}</p></>}
 {kind === 'loan' && <><div className="inline-note"><ShieldCheck size={18} /><span>{tr("Chỉ nhập dữ liệu giả lập. Thông tin định danh sẽ không xuất hiện trên bảng hồ sơ công khai.")}</span></div><h3>{tr("01 · Nhu cầu tài trợ")}</h3><div className="form-grid">{user.role === 'BRO' && <Field label={tr("Đối tượng được đại diện")}><select name="borrower_type"><option value="COM">{tr("Doanh nghiệp")}</option><option value="PER">{tr("Cá nhân")}</option></select></Field>}<FormInput label={tr("Tên hồ sơ")} name="title" defaultValue="Bổ sung vốn kinh doanh mẫu" /><FormInput label={tr("Số tiền cần vay (VNĐ)")} name="amount" type="number" min="10000000" max="10000000000000" step="1000000" defaultValue="3000000000" /><FormInput label={tr("Kỳ hạn (tháng)")} name="term" type="number" min="1" max="360" defaultValue="24" /><Field label={tr("Mục đích vay")}><select name="purpose">{['Vốn lưu động', 'Đầu tư tài sản', 'Mở rộng kinh doanh', 'Tài trợ thương mại', 'Mua nhà', 'Tiêu dùng'].map(v => <option key={v} value={v}>{tr(v)}</option>)}</select></Field><Field label={tr("Ngành nghề")}><select name="industry">{['Thương mại', 'Sản xuất', 'Xuất nhập khẩu', 'Logistics', 'Bán lẻ', 'Nông nghiệp', 'Dịch vụ', 'Cá nhân'].map(v => <option key={v} value={v}>{tr(v)}</option>)}</select></Field><Field label={tr("Khu vực")}><select name="location">{['TP. Hồ Chí Minh', 'Hà Nội', 'Bình Dương', 'Đà Nẵng', 'Đồng Nai', 'Cần Thơ', 'Khác'].map(v => <option key={v} value={v}>{tr(v)}</option>)}</select></Field><FormInput label={tr("Doanh thu / thu nhập năm (VNĐ)")} name="revenue" type="number" min="0" max="10000000000000" defaultValue="15000000000" /><Field label={tr("Tài sản bảo đảm")}><select name="collateral">{['Bất động sản', 'Nhà xưởng', 'Hàng tồn kho', 'Phương tiện', 'Không có tài sản', 'Khác'].map(v => <option key={v} value={v}>{tr(v)}</option>)}</select></Field></div><Field label={tr("Kế hoạch sử dụng vốn")}><textarea name="description" required maxLength="4000" rows="3" defaultValue="Hồ sơ mẫu để trải nghiệm luồng kết nối và xử lý nhu cầu vốn trên Lending Hub." /></Field><h3>{tr("02 · Thông tin riêng tư")}</h3><div className="form-grid"><FormInput label={tr("Tên doanh nghiệp / khách hàng mẫu")} name="legalName" defaultValue="Công ty trải nghiệm Lending Hub" /><FormInput label={tr("Người liên hệ mẫu")} name="contact" defaultValue="Người dùng mẫu" /><FormInput label={tr("Điện thoại mẫu")} name="phone" defaultValue="0900000000" /><FormInput label={tr("Email mẫu")} name="email" type="email" defaultValue="demo@example.com" /><FormInput label={tr("Mã số thuế (nếu có)")} name="taxCode" required={false} hint={tr("Không nhập mã số thuế thật.")} /></div><div className="inline-note"><Upload size={18} /><span>{tr("Sau khi tạo hồ sơ, vào tab Tài liệu để bổ sung PDF hoặc ảnh mẫu. Bạn có thể đăng nhu cầu trước khi bổ sung tài liệu.")}</span></div><label className="checkbox"><input type="checkbox" name="consent" required /><span>{tr(user.role === 'BRO' ? 'Tôi xác nhận có sự đồng ý của khách hàng được đại diện và ' : 'Tôi ')}{tr("đồng ý chia sẻ thông tin với banker do tôi lựa chọn. Tôi chỉ sử dụng dữ liệu mẫu.")}</span></label></>}
 {kind === 'proposal' && <><p className="body-copy">{tr("Đề xuất cho ")}<strong>{tr(loan.alias)}</strong>{tr(" · ")}{loan.title}{tr(". Các chi phí cần ghi rõ trước khi khách hàng lựa chọn.")}</p><div className="form-grid"><FormInput label={tr("Lãi suất (% / năm)")} name="rate" type="number" min="0.1" max="60" step="0.1" defaultValue="8.5" /><FormInput label={tr("Thời gian xử lý (ngày)")} name="days" type="number" min="1" max="180" defaultValue="10" /><FormInput label={tr("Phí cố định công bố (VNĐ)")} name="fee" type="number" min="0" max="10000000000000" defaultValue="3000000" /><FormInput label={tr("Mô tả phí và bên thu")} name="fee_description" defaultValue="Phí xử lý hồ sơ theo đề xuất, cần xác minh với ngân hàng" /></div><Field label={tr("Điều kiện tài trợ")}><textarea name="conditions" rows="3" required maxLength="3000" defaultValue="Thẩm định tài sản bảo đảm, kiểm tra dòng tiền và phê duyệt theo chính sách ngân hàng." /></Field><div className="cost-box"><div><span>{tr("Cọc cam kết banker")}</span><strong>{tr("1.000.000 ₫")}</strong></div><small>{tr("Mô phỏng, không thu tiền. Banker không được chọn sẽ được hoàn cọc mô phỏng.")}</small></div><label className="checkbox"><input type="checkbox" name="simulate_deposit" required /><span>{tr("Tôi xác nhận điều kiện đã công bố và đồng ý tạo cọc mô phỏng để gửi đề xuất.")}</span></label></>}
 {kind === 'select' && <><OfferCard p={modal.proposal} /><div className="inline-note"><LockKeyhole size={18} /><span>{tr("Thông tin liên hệ và tài liệu hồ sơ sẽ được chia sẻ với ")}{tr(modal.proposal.banker_alias)}{tr(". Các đề xuất còn lại sẽ đóng và cọc mô phỏng của các banker đó được hoàn.")}</span></div><label className="checkbox"><input name="consent" type="checkbox" required /><span>{tr("Tôi đồng ý lựa chọn đối tác này và chia sẻ thông tin hồ sơ với banker đã chọn.")}</span></label></>}
 {kind === 'activate' && <><div className="inline-note"><Info size={18} /><span>{tr("Đây là bước chấp thuận mô phỏng, chưa phải chữ ký số hay hợp đồng điện tử có hiệu lực.")}</span></div><p>{tr("Đối tác đồng hành: ")}<strong>{tr(loan.selected_banker_alias)}</strong></p><div className="cost-box"><div><span>{tr("Cọc khách hàng mô phỏng")}</span><strong>{tr(cash(3000000))}</strong></div><div><span>{tr("Dự toán thẩm định tài sản")}</span><strong>{tr(cash(2000000))}</strong></div><div><span>{tr("Phí nền tảng khi hoàn tất (0,5%)")}</span><strong>{tr(cash(Math.round(loan.amount * .005)))}</strong></div><div><span>{tr("Phí banker công bố riêng")}</span><strong>{cash(loan.proposals.find(p => p.id === loan.selected_proposal_id)?.fee)}</strong></div></div><div className="terms-copy"><h3>{tr("Điều khoản trải nghiệm · demo-1")}</h3><p>{tr("Banker cập nhật tiến độ và xử lý trong thời gian đề xuất. Khách hàng phối hợp cung cấp tài liệu và xác nhận các mốc. Cọc được theo dõi trong sổ mô phỏng.")}</p><p>{tr("Nếu hủy giữa chừng hoặc chậm hạn, quản trị xem xét căn cứ trước khi quyết định xử lý cọc. Không tự động thu hay tịch thu tiền.")}</p><p>{tr("Dự toán thẩm định không được tự động khấu trừ trong bản này. Phí dịch vụ được ghi nhận riêng; cọc được hoàn toàn bộ theo mô phỏng khi hoàn tất. Quy tắc khấu trừ, thuế và khoản được phép thu cần chốt trong hợp đồng thực tế.")}</p><p>{tr("Lending Hub kết nối nhu cầu vốn. Ngân hàng quyết định cấp tín dụng và ký hợp đồng giải ngân trực tiếp.")}</p></div><label className="checkbox"><input name="accept_terms" type="checkbox" required /><span>{tr("Tôi đã đọc các điều khoản và đồng ý mô phỏng chữ ký, đặt cọc để bắt đầu quy trình.")}</span></label></>}
 {kind === 'progress' && <><Field label={tr("Mốc xử lý")}><select name="stage"><option value="in_review">{tr("Tiếp tục thẩm định")}</option><option value="approved">{tr("Đã phê duyệt · sẵn sàng đặt lịch ký")}</option></select></Field><Field label={tr("Nội dung cập nhật")}><textarea name="note" required rows="4" maxLength="3000" placeholder={tr("Nêu công việc đã hoàn thành, yêu cầu bổ sung và bước tiếp theo…")} /></Field></>}
 {kind === 'appointment' && <><FormInput label={tr("Thời gian hẹn (giờ trên thiết bị)")} name="scheduled_at" type="datetime-local" min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} /><FormInput label={tr("Địa điểm ký hợp đồng")} name="location" /><Field label={tr("Lưu ý cho khách hàng")}><textarea name="note" rows="3" maxLength="1000" placeholder={tr("Tài liệu cần mang theo, người liên hệ…")} /></Field></>}
 {kind === 'disburse' && <><div className="inline-note"><Info size={18} /><span>{tr("Chỉ cập nhật sau khi hoàn tất ký và giải ngân trong quy trình trải nghiệm. Khách hàng cần xác nhận đã nhận vốn trước khi đóng hồ sơ.")}</span></div><label className="checkbox"><input name="confirm" type="checkbox" required /><span>{tr("Tôi xác nhận đã hoàn tất giải ngân mô phỏng cho hồ sơ này.")}</span></label></>}
 {kind === 'complete' && <><p className="body-copy">{tr("Hồ sơ sẽ hoàn tất sau khi bạn xác nhận đã nhận vốn. Phí và hoàn cọc được ghi nhận trong sổ mô phỏng.")}</p><div className="cost-box"><div><span>{tr("Số tiền hồ sơ")}</span><strong>{tr(cash(loan.amount))}</strong></div><div><span>{tr("Phí dịch vụ nền tảng mô phỏng")}</span><strong>{tr(cash(Math.round(loan.amount * .005)))}</strong></div><div><span>{tr("Hoàn cọc khách hàng mô phỏng")}</span><strong>{tr(cash(3000000))}</strong></div></div><label className="checkbox"><input name="confirm_received" type="checkbox" required /><span>{tr("Tôi xác nhận đã nhận vốn trong quy trình trải nghiệm và đồng ý mô phỏng thanh toán phí dịch vụ.")}</span></label></>}
 {kind === 'cancel' && <><div className="inline-note warning"><AlertCircle size={18} /><span>{tr("Hồ sơ sẽ ngừng xử lý. Cọc đang giữ sẽ chuyển sang chờ quản trị xem xét. Không tự động mất cọc trong bản trải nghiệm.")}</span></div><Field label={tr("Lý do hủy")}><textarea name="reason" required rows="4" maxLength="1000" /></Field></>}
 {kind === 'product' && <><FormInput label={tr("Tên gói vay")} name="title" /><div className="form-grid"><Field label={tr("Đối tượng")}><select name="borrower_type"><option value="COM">{tr("Doanh nghiệp")}</option><option value="PER">{tr("Cá nhân")}</option></select></Field><FormInput label={tr("Lãi suất tham khảo (% / năm)")} name="rate" type="number" min="0.1" max="60" step="0.1" defaultValue="8.5" /><FormInput label={tr("Hạn mức tối đa (VNĐ)")} name="max_amount" type="number" min="10000000" max="10000000000000" defaultValue="10000000000" /><FormInput label={tr("Kỳ hạn tối đa (tháng)")} name="term" type="number" min="1" max="360" defaultValue="36" /></div><Field label={tr("Mô tả & điều kiện")}><textarea name="description" required rows="3" maxLength="2000" /></Field></>}
 {kind === 'resolve' && <><p>{tr("Cọc của ")}<strong>{tr(modal.entry.user_alias)}</strong>{tr(" · ")}{tr(cash(modal.entry.amount))}</p><Field label={tr("Quyết định mô phỏng")}><select name="outcome"><option value="refunded_simulated">{tr("Hoàn cọc mô phỏng")}</option><option value="forfeited_simulated">{tr("Mất cọc mô phỏng")}</option></select></Field><Field label={tr("Căn cứ quyết định")}><textarea name="reason" required maxLength="1000" rows="4" /></Field></>}
 <div className="form-actions"><button className="button" type="button" onClick={onClose}>{tr("Quay lại")}</button><button className={`button ${kind === 'cancel' ? 'danger-button' : 'primary'}`} type="submit" disabled={busy}>{busy ? <><LoaderCircle size={16} className="spin" />{tr("Đang xử lý…")}</> : tr({
            loan: 'Tạo hồ sơ',
            account: 'Tạo tài khoản mẫu',
            proposal: 'Gửi đề xuất & mô phỏng cọc',
            select: 'Xác nhận lựa chọn',
            activate: 'Chấp thuận & bắt đầu mô phỏng',
            cancel: 'Xác nhận hủy',
            complete: 'Xác nhận & hoàn tất'
          }[kind] || 'Xác nhận')}</button></div></form></Modal>;
}
const ledgerKind = {
  banker_deposit: 'Cọc banker',
  customer_deposit: 'Cọc khách hàng',
  service_fee: 'Phí dịch vụ'
};
const ledgerState = {
  held: 'Đang giữ · mô phỏng',
  refunded_simulated: 'Đã hoàn · mô phỏng',
  paid_simulated: 'Đã thanh toán · mô phỏng',
  review_required: 'Chờ xem xét',
  forfeited_simulated: 'Mất cọc · mô phỏng'
};
function LedgerTable({
  entries,
  onResolve
}) {
  return entries.length ? <div className="table-scroll"><table className="standard-table"><thead><tr><th>{tr("Thời gian")}</th><th>{tr("Tài khoản")}</th><th>{tr("Nội dung")}</th><th>{tr("Số tiền")}</th><th>{tr("Trạng thái")}</th>{onResolve && <th />}</tr></thead><tbody>{entries.map(e => <tr key={e.id}><td>{tr(dateTime(e.created_at))}</td><td><strong>{tr(e.user_alias)}</strong></td><td>{tr(ledgerKind[e.kind])}</td><td>{tr(cash(e.amount))}</td><td><span className={`ledger-state ${e.state}`}>{tr(ledgerState[e.state])}</span></td>{onResolve && <td>{e.state === 'review_required' && <button className="button small" onClick={() => onResolve(e)}>{tr("Xem xét")}</button>}</td>}</tr>)}</tbody></table></div> : <Empty title={tr("Chưa có bút toán")} description={tr("Các khoản cọc và phí mô phỏng sẽ hiển thị tại đây.")} />;
}
function WalletView({
  user,
  loans,
  admin
}) {
  const [entries, setEntries] = useState([]),
    [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    if (user.role === 'ADMIN') {
      setEntries(admin?.ledger || []);
      return;
    }
    Promise.all(loans.map(l => api(`/loans/${l.id}`))).then(data => {
      if (mounted) setEntries(data.flatMap(l => l.ledger).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }).catch(e => mounted && setError(e.message));
    return () => {
      mounted = false;
    };
  }, [user, loans, admin]);
  return <>{error && <div role="alert" className="error-banner">{tr(error)}</div>}<div className="wallet-totals"><div><span>{tr("Cọc đang giữ (mô phỏng)")}</span><strong>{cash(entries.filter(e => e.state === 'held').reduce((s, e) => s + e.amount, 0))}</strong></div><div><span>{tr("Cọc đã hoàn (mô phỏng)")}</span><strong>{cash(entries.filter(e => e.state === 'refunded_simulated').reduce((s, e) => s + e.amount, 0))}</strong></div></div><LedgerTable entries={entries} /></>;
}
function AdminView({
  data,
  onLoan,
  onResolve
}) {
  const [section, setSection] = useState('loans');
  return <section className="panel"><div className="section-head"><div><h2>{tr("Quản trị nền tảng")}</h2><p>{tr("Quyền quản trị được mở trong bản trải nghiệm. Không dùng cho dữ liệu thật.")}</p></div></div><div className="tabs admin-tabs">{[['loans', `Hồ sơ (${data.loans.length})`], ['users', `Tài khoản (${data.users.length})`], ['ledger', 'Sổ cọc & phí'], ['audit', 'Nhật ký hoạt động']].map(([v, t]) => <button key={v} className={section === v ? 'selected' : ''} onClick={() => setSection(v)}>{tr(t)}</button>)}</div>{section === 'loans' && data.loans.map(l => <button className="progress-row" key={l.id} onClick={() => onLoan(l)}><div><strong>{l.title}</strong><small>{tr(l.alias)}{tr(" · ")}{tr(compact(l.amount))}</small></div><Badge status={l.status} /><ChevronRight size={18} /></button>)}{section === 'users' && <div className="table-scroll"><table className="standard-table"><thead><tr><th>Alias</th><th>{tr("Vai trò")}</th><th>{tr("Ngày tạo")}</th><th>{tr("Chế độ")}</th></tr></thead><tbody>{data.users.map(u => <tr key={u.id}><td><strong>{tr(u.alias)}</strong></td><td>{tr(roles[u.role])}</td><td>{tr(dateTime(u.created_at))}</td><td>{tr("Trải nghiệm · chưa xác minh")}</td></tr>)}</tbody></table></div>}{section === 'ledger' && <LedgerTable entries={data.ledger} onResolve={onResolve} />} {section === 'audit' && <div className="audit-list">{data.audit.map(a => <div key={a.id}><span className="audit-icon"><Activity size={16} /></span><div><strong>{tr({
              loan_created: 'Tạo hồ sơ',
              document_uploaded: 'Tải tài liệu',
              product_created: 'Thêm gói vay',
              deposit_resolved: 'Xử lý cọc',
              appointment_confirmed: 'Xác nhận lịch',
              demo_initialized: 'Khởi tạo trải nghiệm'
            }[a.action] || states[a.action] || a.action)}</strong><p>{a.detail || tr('Thao tác đã được ghi nhận.')}</p><small>{tr(dateTime(a.created_at))}{tr(" · ")}{tr(a.actor_alias)}</small></div></div>)}</div>}</section>;
}
createRoot(document.getElementById('root')).render(<App />);
