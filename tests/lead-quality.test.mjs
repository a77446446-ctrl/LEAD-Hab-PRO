import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildLeadTitle } from '../src/lib/lead-title.ts';
import { hasActionableLeadContact } from '../src/lib/redact-contact.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('заголовок выбирает смысловую фразу и не обрывает слова', () => {
  assert.equal(
    buildLeadTitle('РАБОТА МОСКВА 🟢 ТРЕБУЕТСЯ КОМПЛЕКТОВЩИК НА ТЁПЛЫЙ СКЛАД\nСклад отапливаемый'),
    'ТРЕБУЕТСЯ КОМПЛЕКТОВЩИК НА ТЁПЛЫЙ СКЛАД',
  );
  const projectTitle = buildLeadTitle('ПРОЕКТ «СЕВЕРНЫЙ РУБЕЖ» СПЕЦИАЛЬНАЯ ПРОГРАММА ПОДГОТОВКИ РЕЗЕРВНОГО КОРПУСА');
  assert.doesNotMatch(projectTitle, /\.{3}|…/);
  assert.doesNotMatch(projectTitle, /\bПОДГ$/i);
});

test('оборванный заголовок ИИ заменяется заголовком из исходного текста', () => {
  const title = buildLeadTitle(
    'Требуется бригада монолитчиков на устройство фундамента объёмом 800 кубов',
    'Требуется бригада монолитчиков на устройство фунда...',
  );
  assert.equal(title, 'Требуется бригада монолитчиков на устройство фундамента объёмом 800 кубов');
});

test('призыв написать в личку без адреса не считается контактом', () => {
  assert.equal(hasActionableLeadContact('Свяжитесь со мной, пишите в личные сообщения'), false);
  assert.equal(hasActionableLeadContact('Пишите в ЛС Ивану и добавляйте в контакты'), false);
  assert.equal(hasActionableLeadContact('Телефон +7 999 123-45-67'), true);
  assert.equal(hasActionableLeadContact('Профиль https://max.ru/example'), true);
  assert.equal(hasActionableLeadContact('Пишите @master'), true);
  assert.equal(hasActionableLeadContact('Почта master@example.ru'), true);
});

test('контакт обязателен при сохранении, выдаче и отправке лида', () => {
  const parser = read('src/services/max-parser.ts');
  const outbox = read('src/services/bot-outbox.ts');
  const leadsApi = read('src/app/api/leads/route.ts');

  assert.match(parser, /if \(!hasActionableLeadContact\(cleaned\)\)/);
  assert.doesNotMatch(parser, /!parseAll\s*&&\s*extractContactInfo/);
  assert.match(outbox, /throw new LeadContactRequiredError/);
  assert.match(outbox, /delivery\.kind\.startsWith\('LEAD_TEASER'\)[\s\S]*hasActionableLeadContact/);
  assert.match(leadsApi, /\.filter\(\(lead\)[\s\S]*hasActionableLeadContact/);
});
