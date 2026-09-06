import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { classifyLeadCategory, normalizeCategoryText } from '../src/lib/lead-category.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const categories = [
  { slug: 'drivers', name: 'Водители', plusKeywords: 'водител, категория c, категория е', minusKeywords: 'ищу работу' },
  { slug: 'cleaning', name: 'Уборка', plusKeywords: 'уборка, уборщица, клининг', minusKeywords: 'предлагаю услуги' },
  { slug: 'handyman', name: 'Мастер на час', plusKeywords: 'электрик, сантехник, ремонт', minusKeywords: 'обучение' },
];

test('локальный классификатор распределяет лиды по плюс-словам', () => {
  assert.equal(classifyLeadCategory('Требуется водитель категории C', categories).categorySlug, 'drivers');
  assert.equal(classifyLeadCategory('Нужна уборщица в офис', categories).categorySlug, 'cleaning');
  assert.equal(classifyLeadCategory('Нужен электрик для ремонта розетки', categories).categorySlug, 'handyman');
});

test('минус-слово запрещает соответствующую категорию', () => {
  const result = classifyLeadCategory('Ищу работу водителем категории C', categories);
  assert.equal(result.categorySlug, 'other');
  assert.equal(result.matched, false);
});

test('без плюс-совпадений лид явно относится к категории Другое', () => {
  const result = classifyLeadCategory('Требуется фотограф на мероприятие', categories);
  assert.deepEqual(result, { categorySlug: 'other', matched: false, score: 0, matchedKeywords: [] });
  assert.equal(classifyLeadCategory('Любое сообщение', [{ slug: 'empty', plusKeywords: '', minusKeywords: '' }]).matched, false);
});

test('нормализация учитывает регистр, ё и разделители', () => {
  assert.equal(normalizeCategoryText('  РЕМОНТ-Мебели, Ёлки!  '), 'ремонт мебели елки');
  assert.equal(
    classifyLeadCategory('ТРЕБУЕТСЯ УБОРЩИЦА-КЛИНИНГ', categories).categorySlug,
    'cleaning',
  );
});

test('при пересечении выбирается наиболее подтверждённая категория', () => {
  const result = classifyLeadCategory('Нужен электрик, небольшой ремонт', categories);
  assert.equal(result.categorySlug, 'handyman');
  assert.deepEqual(result.matchedKeywords.sort(), ['ремонт', 'электрик']);
});

test('режим Целевые требует реального совпадения с категорией', () => {
  const parser = read('src/services/max-parser.ts');
  const ai = read('src/services/ai.ts');
  assert.match(parser, /!parseAll && !processed\.categoryMatched/);
  assert.match(parser, /нет совпадений с активными категориями/);
  assert.match(ai, /category: categoryMatch\.categorySlug/);
  assert.match(ai, /categoryMatched: categoryMatch\.matched/);
});
