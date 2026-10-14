import {test, expect} from '@playwright/test';

test('language persists, translates navigation and filters without changing stored values', async ({page}) => {
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.loan-title').first()).toBeVisible();
  const title=await page.locator('.loan-title').first().textContent();
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
  await expect(page.locator('.loan-title').first()).toHaveText(title);
  await expect(page.locator('.hero-copy')).toContainText('Capital in the right place.');
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await page.getByLabel('Location',{exact:true}).selectOption({label:'Hanoi'});
  await expect(page.getByLabel('Location',{exact:true})).toHaveValue('Hà Nội');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'English',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page).toHaveTitle(/Connecting capital/);
  await page.screenshot({path:'.data/screenshots/english-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Tiếng Việt',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tổng quan',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('switching language preserves a loan draft and submits canonical values',async({page,request})=>{
  const users=await(await request.get('/api/demo/users')).json();
  const customer=users.find(u=>u.role==='COM');
  await page.goto('/');
  await expect(page.locator('.loan-title').first()).toBeVisible();
  await page.getByLabel('Chọn tài khoản trải nghiệm').selectOption(customer.id);
  await expect(page.locator('.loading')).toHaveCount(0);
  await page.getByRole('button',{name:'Tạo hồ sơ vay',exact:true}).click();
  const dialog=page.getByRole('dialog');
  const title='Hồ sơ giữ nguyên — English draft';
  const description='Ghi chú riêng không tự dịch.';
  await dialog.getByLabel('Tên hồ sơ',{exact:true}).fill(title);
  await dialog.getByLabel('Kế hoạch sử dụng vốn').fill(description);
  await dialog.getByLabel('Ngành nghề',{exact:true}).selectOption('Sản xuất');
  await dialog.getByRole('button',{name:'English',exact:true}).click();
  await expect(dialog).toHaveAttribute('aria-label','Create loan application');
  await expect(dialog.getByLabel('Application title',{exact:true})).toHaveValue(title);
  await expect(dialog.getByLabel('Use of funds')).toHaveValue(description);
  await expect(dialog.getByLabel('Industry',{exact:true})).toHaveValue('Sản xuất');
  await expect(dialog.getByLabel('Industry',{exact:true}).locator('option:checked')).toHaveText('Manufacturing');
  await dialog.locator('input[name="consent"]').check();
  const posted=page.waitForRequest(r=>r.url().endsWith('/api/loans')&&r.method()==='POST');
  await dialog.getByRole('button',{name:'Create application',exact:true}).click();
  expect((await posted).postDataJSON()).toMatchObject({title,description,industry:'Sản xuất',purpose:'Vốn lưu động',location:'TP. Hồ Chí Minh'});
  await expect(page.getByRole('dialog',{name:'Application details'})).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading',{name:title,exact:true})).toBeVisible();
  await expect(page.getByRole('dialog').locator('.body-copy')).toHaveText(description);
});

test('English mobile navigation and language switch fit the viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('.loan-title').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:'.data/screenshots/english-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.locator('.sidebar nav').getByRole('button',{name:'Loan products',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Financing solutions from partners'})).toBeVisible();
  await page.getByRole('button',{name:'Tiếng Việt',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Giải pháp vốn từ đối tác'})).toBeVisible();
});
