// Cliente HTTP da API LigueLead (https://docs.liguelead.com.br/reference).
//
// MULTI-TENANT: as credenciais (api-token / app-id) sao por requisicao — cada
// usuario informa as suas na conexao do App Studio. Nenhum metodo usa credencial
// global; todos recebem `creds` como primeiro argumento.
//
// Autenticacao = headers `api-token` e `app-id`. Base URL ja inclui /v1.

import { config } from '../config.js';

const PATHS = {
  sendSms: '/sms',
  sendVoice: '/voice',
  uploadVoice: '/voice/uploads',
  listVoiceUploads: '/voice/uploads',
  getVoiceUpload: (id) => `/voice/uploads/${id}`,
};

/**
 * Extrai as credenciais LigueLead dos headers da requisicao.
 * O App Studio envia `x-liguelead-token` e `x-liguelead-app-id` a partir
 * dos campos da conexao preenchidos pelo usuario.
 * @param {Record<string,any>} headers
 * @returns {{ apiToken: string, appId: string }}
 */
export function credsFromHeaders(headers) {
  return {
    apiToken: headers['x-liguelead-token'] || '',
    appId: headers['x-liguelead-app-id'] || '',
  };
}

function authHeaders(creds) {
  if (!creds?.apiToken || !creds?.appId) {
    throw Object.assign(
      new Error('Credenciais LigueLead ausentes: informe api-token e app-id.'),
      { statusCode: 401, code: 'credenciais_liguelead_ausentes' },
    );
  }
  return { 'api-token': creds.apiToken, 'app-id': creds.appId };
}

async function handle(res, method, path) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`LigueLead ${method} ${path} -> ${res.status}`);
    err.statusCode = res.status;
    err.code = 'erro_liguelead';
    err.payload = data;
    throw err;
  }
  return { status: res.status, data };
}

async function requestJson(creds, method, path, body) {
  const res = await fetch(`${config.liguelead.baseUrl}${path}`, {
    method,
    headers: {
      ...authHeaders(creds),
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handle(res, method, path);
}

export const liguelead = {
  /**
   * POST /sms — SMS ou SMS Flash. Async (202). phones SEM DDI.
   * @param {{apiToken,appId}} creds
   * @param {{ title?: string, message: string, phones: string[], is_flash?: boolean }} params
   */
  sendSms(creds, params) {
    const body = { message: params.message, phones: params.phones, is_flash: Boolean(params.is_flash) };
    if (params.title) body.title = params.title;
    return requestJson(creds, 'POST', PATHS.sendSms, body);
  },

  /**
   * POST /voice — campanha de voz. Requer voice_upload_id.
   * @param {{apiToken,appId}} creds
   * @param {{ title: string, voice_upload_id: number, phones: string[],
   *   retry_attempts?: number, retry_interval_min?: number, retry_end_time?: string }} params
   */
  sendVoiceMessage(creds, params) {
    const body = {
      title: params.title,
      voice_upload_id: params.voice_upload_id,
      phones: params.phones,
    };
    if (params.retry_attempts != null) body.retry_attempts = params.retry_attempts;
    if (params.retry_interval_min != null) body.retry_interval_min = params.retry_interval_min;
    if (params.retry_end_time) body.retry_end_time = params.retry_end_time;
    return requestJson(creds, 'POST', PATHS.sendVoice, body);
  },

  /**
   * POST /voice/uploads — multipart/form-data com `title` + `file` (binario).
   * Recebemos base64 (interface JSON amigavel) e convertemos para multipart aqui.
   * @param {{apiToken,appId}} creds
   * @param {{ title: string, file_base64: string, filename: string }} params
   */
  async uploadVoiceAudio(creds, params) {
    const buffer = Buffer.from(params.file_base64, 'base64');
    const form = new FormData();
    form.append('title', params.title);
    form.append('file', new Blob([buffer]), params.filename);
    // Nao definimos Content-Type: o fetch monta o boundary do multipart.
    const res = await fetch(`${config.liguelead.baseUrl}${PATHS.uploadVoice}`, {
      method: 'POST',
      headers: { ...authHeaders(creds), Accept: 'application/json' },
      body: form,
    });
    return handle(res, 'POST', PATHS.uploadVoice);
  },

  /** GET /voice/uploads */
  listVoiceUploads(creds) {
    return requestJson(creds, 'GET', PATHS.listVoiceUploads);
  },

  /** GET /voice/uploads/:id */
  getVoiceUpload(creds, id) {
    return requestJson(creds, 'GET', PATHS.getVoiceUpload(id));
  },
};
