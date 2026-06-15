// Cliente da API v3 do ActiveCampaign — usado APENAS pelo disparo em massa,
// para resolver os telefones de uma lista, tag ou segmento.
//
// Doc: https://developers.activecampaign.com/reference

import { config } from '../config.js';

function ensureConfigured() {
  if (!config.activecampaign.apiUrl || !config.activecampaign.apiToken) {
    throw Object.assign(
      new Error('ActiveCampaign nao configurado (AC_API_URL / AC_API_TOKEN).'),
      { statusCode: 500 },
    );
  }
}

async function acGet(path, query = {}) {
  ensureConfigured();
  const url = new URL(`${config.activecampaign.apiUrl}/api/3${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { 'Api-Token': config.activecampaign.apiToken, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`ActiveCampaign GET ${path} -> ${res.status}`);
    err.statusCode = res.status;
    err.payload = await res.text();
    throw err;
  }
  return res.json();
}

/**
 * Itera todos os contatos de uma lista ou tag, paginando de 100 em 100,
 * e retorna os telefones (campo `phone`) nao vazios.
 *
 * @param {{ listId?: string|number, tagId?: string|number }} opts
 * @returns {Promise<string[]>}
 */
export async function fetchContactsPhones({ listId, tagId } = {}) {
  const phones = [];
  const limit = 100;
  let offset = 0;

  // ActiveCampaign filtra contatos por lista via `listid` e por tag via `tagid`.
  const baseQuery = {};
  if (listId) baseQuery.listid = listId;
  if (tagId) baseQuery.tagid = tagId;

  // Loop de paginacao. `meta.total` indica o total para sabermos quando parar.
  // Limite de seguranca para nao varrer infinitamente.
  for (let guard = 0; guard < 100000; guard++) {
    const page = await acGet('/contacts', { ...baseQuery, limit, offset });
    const contacts = page.contacts || [];
    for (const c of contacts) {
      if (c.phone) phones.push(c.phone);
    }
    offset += limit;
    const total = Number(page.meta?.total ?? 0);
    if (contacts.length === 0 || offset >= total) break;
  }

  return phones;
}
