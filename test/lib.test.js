import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePhone, normalizePhoneList } from '../src/lib/phone.js';
import { creditsPerMessage, estimateSmsCampaign } from '../src/lib/credits.js';
import { containsUrl, validateFlashMessage, chunk } from '../src/lib/validators.js';
import { extractPhonesFromCsv } from '../src/lib/csv.js';
import { credsFromHeaders } from '../src/lib/liguelead.js';

test('normalizePhone aceita formatos BR e canoniza para local sem DDI', () => {
  assert.deepEqual(normalizePhone('11999998888'), { ok: true, phone: '11999998888' });
  assert.deepEqual(normalizePhone('5511999998888'), { ok: true, phone: '11999998888' });
  assert.deepEqual(normalizePhone('+55 (11) 99999-8888'), { ok: true, phone: '11999998888' });
  assert.deepEqual(normalizePhone('1133334444'), { ok: true, phone: '1133334444' }); // fixo 10 digitos
});

test('normalizePhone rejeita invalidos', () => {
  assert.equal(normalizePhone('123').ok, false);
  assert.equal(normalizePhone('11899998888').ok, false); // celular 11 digitos sem 9 inicial
  assert.equal(normalizePhone('0099999998888').ok, false); // DDD invalido
  assert.equal(normalizePhone('').ok, false);
});

test('normalizePhoneList deduplica e separa invalidos', () => {
  const { valid, invalid } = normalizePhoneList(['11999998888', '5511999998888', 'abc']);
  assert.deepEqual(valid, ['11999998888']); // dedup (com e sem DDI -> mesmo numero)
  assert.equal(invalid.length, 1);
});

test('creditsPerMessage segue a regra 160 + 152', () => {
  assert.equal(creditsPerMessage('a'.repeat(160)), 1);
  assert.equal(creditsPerMessage('a'.repeat(161)), 2);
  assert.equal(creditsPerMessage('a'.repeat(160 + 152)), 2);
  assert.equal(creditsPerMessage('a'.repeat(160 + 152 + 1)), 3);
  assert.equal(creditsPerMessage('a'.repeat(1600)), 11); // teto
});

test('estimateSmsCampaign multiplica por destinatarios', () => {
  const e = estimateSmsCampaign('oi', 100);
  assert.equal(e.creditsPerMessage, 1);
  assert.equal(e.totalCredits, 100);
});

test('containsUrl detecta links e validateFlashMessage bloqueia', () => {
  assert.equal(containsUrl('acesse https://liguelead.com.br'), true);
  assert.equal(containsUrl('acesse www.site.com'), true);
  assert.equal(containsUrl('promo no site liguelead.com.br hoje'), true);
  assert.equal(containsUrl('sua senha e 1234'), false);
  assert.ok(validateFlashMessage('veja em www.x.com').length > 0);
  assert.equal(validateFlashMessage('sem link aqui').length, 0);
});

test('chunk divide em lotes de 10000', () => {
  const arr = Array.from({ length: 25000 }, (_, i) => i);
  const c = chunk(arr);
  assert.equal(c.length, 3);
  assert.equal(c[0].length, 10000);
  assert.equal(c[2].length, 5000);
});

test('extractPhonesFromCsv le coluna telefone com separador ; e ,', () => {
  const csv1 = 'nome;telefone\nAna;11999998888\nBruno;11988887777';
  assert.deepEqual(extractPhonesFromCsv(csv1), ['11999998888', '11988887777']);
  const csv2 = 'phone,email\n11999998888,a@b.com';
  assert.deepEqual(extractPhonesFromCsv(csv2), ['11999998888']);
});

test('credsFromHeaders le api-token e app-id dos headers', () => {
  const creds = credsFromHeaders({ 'x-liguelead-token': 'tok', 'x-liguelead-app-id': 'app' });
  assert.deepEqual(creds, { apiToken: 'tok', appId: 'app' });
  assert.deepEqual(credsFromHeaders({}), { apiToken: '', appId: '' });
});
