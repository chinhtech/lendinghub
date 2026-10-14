import {useSyncExternalStore} from 'react';
import en from './locales/en.json';

const key = 'lending-language';
let language = 'vi';
try { language = localStorage.getItem(key) === 'en' ? 'en' : 'vi'; } catch {}
const listeners = new Set();
export const locale = () => language === 'en' ? 'en-GB' : 'vi-VN';
export function translate(value) {
  if (language !== 'en' || typeof value !== 'string') return value;
  const source = value.trim();
  let result = Object.hasOwn(en, source) ? en[source] : undefined;
  if (!result) {
    const count = source.match(/^(Đề xuất|Tài liệu|Hồ sơ|Tài khoản) \((\d+)\)$/);
    if (count) result = `${en[count[1]]} (${count[2]})`;
    if (source.startsWith('Xem ')) result = `View ${source.slice(4)}`;
    const notification = source.match(/^(BAR-\d+) đã gửi đề xuất tài trợ\.$/);
    if (notification) result = `${notification[1]} has sent a financing proposal.`;
    if (source.includes(' Kiểm tra: ')) result = source.split(' Kiểm tra: ').map(translate).join(' Check: ');
  }
  return result ? value.replace(source, result) : value;
}
function updateDocument() {
  document.documentElement.lang = language;
  document.title = language === 'en' ? 'Lending Hub | Connecting capital, opening opportunities' : 'Lending Hub | Kết nối vốn, mở cơ hội';
  document.querySelector('meta[name="description"]')?.setAttribute('content', language === 'en'
    ? 'Connect businesses and individuals with banking partners. Compare financing proposals and track your loan application with Lending Hub.'
    : 'Kết nối doanh nghiệp và cá nhân với đối tác ngân hàng. So sánh đề xuất tài trợ và theo dõi hồ sơ vay trên Lending Hub.');
}
export function setLanguage(next) {
  if (!['vi', 'en'].includes(next)) return;
  language = next;
  try { localStorage.setItem(key, next); } catch {}
  updateDocument();
  listeners.forEach(listener => listener());
}
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export function useLanguage() { return useSyncExternalStore(subscribe, () => language); }
updateDocument();
window.addEventListener('storage', event => {
  if (event.key === key) {
    language = event.newValue === 'en' ? 'en' : 'vi';
    updateDocument();
    listeners.forEach(listener => listener());
  }
});
