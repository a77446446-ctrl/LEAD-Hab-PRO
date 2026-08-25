import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ADMIN_MAX_IDS является единственным источником административной роли', () => {
  const adminConfig = read('src/lib/auth/admin-config.ts');
  const authRoute = read('src/app/api/auth/max/route.ts');
  const currentUser = read('src/lib/auth/current-user.ts');

  assert.match(adminConfig, /process\.env\.ADMIN_MAX_IDS/);
  assert.match(authRoute, /role: configuredAdmin \? 'ADMIN' : 'USER'/);
  assert.doesNotMatch(authRoute, /\.\.\.\(configuredAdmin \?/);
  assert.match(currentUser, /if \(!isConfiguredAdminMaxId\(user\.maxId\)\)/);
  assert.match(currentUser, /role: isConfiguredAdminMaxId\(user\.maxId\) \? 'admin' : 'user'/);
});

test('профиль скрыт и закрыт для обычного пользователя', () => {
  const navigation = read('src/components/ui/BottomNav.tsx');
  const middleware = read('src/middleware.ts');
  const profile = read('src/app/(dashboard)/profile/page.tsx');

  assert.match(navigation, /role === 'admin' \? \[\.\.\.userNavItems, adminProfileItem\] : userNavItems/);
  assert.match(middleware, /pathname === '\/profile'/);
  assert.match(profile, /user\.role !== 'admin'/);
  assert.doesNotMatch(profile, /LegalAcceptanceCard/);
});

test('обычный пользователь принимает документы до доступа к приложению, администратор освобождён', () => {
  const consentPage = read('src/app/(auth)/consent/page.tsx');
  const login = read('src/app/(auth)/login/page.tsx');
  const dashboardLayout = read('src/app/(dashboard)/layout.tsx');
  const legalApi = read('src/app/api/legal/acceptance/route.ts');
  const legal = read('src/lib/legal.ts');

  assert.match(consentPage, /LegalAcceptanceCard onAccepted/);
  assert.match(consentPage, /Не принимать и выйти/);
  assert.match(login, /destinationAfterLegal/);
  assert.match(login, /\/consent\?next=/);
  assert.match(dashboardLayout, /profile\.role === 'user'/);
  assert.match(dashboardLayout, /api\/legal\/acceptance/);
  assert.match(legalApi, /adminExemption/);
  assert.match(legal, /if \(isConfiguredAdminMaxId\(user\.maxId\)\) return true/);
});

test('платёж возвращает пользователя в подписки, а не в закрытый профиль', () => {
  const env = read('.env.example');
  const yookassa = read('src/services/yookassa.ts');
  assert.match(env, /YOOKASSA_RETURN_URL="https:\/\/example\.ru\/subscriptions"/);
  assert.match(yookassa, /NEXT_PUBLIC_APP_URL \|\| ''}\/(?:subscriptions)/);
  assert.doesNotMatch(yookassa, /NEXT_PUBLIC_APP_URL \|\| ''}\/profile/);
});
