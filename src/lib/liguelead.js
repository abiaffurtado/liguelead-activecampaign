// Cliente HTTP da API LigueLead (https://docs.liguelead.com.br/reference).
//
// MULTI-TENANT: as credenciais (api-token / app-id) sao por requisicao — cada
// usuario informa as suas na conexao do App Studio. Nenhum metodo usa credencial
// global; todos recebem `creds` como primeiro argumento.
//
// Autenticacao = headers `api-token` e `app-id`. Base URL ja inclui /v1.

import { config } from '../config.js';
import { resolveAudioType } from './validators.js';

const PATHS = {
  sendSms: '/sms',
  sendVoice: '/voice',
  uploadVoice: '/voice/uploads',
  listVoiceUploads: '/voice/uploads',
  getVoiceUpload: (id) => `/voice/uploads/${id}`,
};

/**
 * Extrai as credenciais LigueLead da requisicao.
 *
 * `api-token` SEMPRE vem no header `x-liguelead-token` (auth do App Studio, que
 * so envia 1 header). `app-id` vem no header `x-liguelead-app-id` (uso direto/curl)
 * OU no corpo como `app_id` — porque o App Studio nao consegue mandar um 2o header,
 * entao o app-id viaja no body do workflow.
 * @param {Record<string,any>} headers
 * @param {Record<string,any>} [body]
 * @returns {{ apiToken: string, appId: string }}
 */
export function credsFromRequest(headers = {}, body = {}) {
  return {
    apiToken: headers['x-liguelead-token'] || '',
    appId: headers['x-liguelead-app-id'] || body?.app_id || '',
  };
}

// Compat: versao antiga (so headers).
export const credsFromHeaders = (headers) => credsFromRequest(headers, {});

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
      voice_upload_id: Number(params.voice_upload_id),
      phones: params.phones,
    };
    // Os campos de retry chegam como string (formulario do App Studio) — coage.
    if (params.retry_attempts != null && params.retry_attempts !== '')
      body.retry_attempts = Number(params.retry_attempts);
    if (params.retry_interval_min != null && params.retry_interval_min !== '')
      body.retry_interval_min = Number(params.retry_interval_min);
    if (params.retry_end_time) body.retry_end_time = params.retry_end_time;
    return requestJson(creds, 'POST', PATHS.sendVoice, body);
  },

  /**
   * Baixa um audio de uma URL publica e sobe para a LigueLead (multipart).
   * Usado pelo fluxo do App Studio, que nao tem campo de upload de arquivo:
   * o usuario informa a URL e o conector faz o upload por tras.
   * @param {{apiToken,appId}} creds
   * @param {{ title: string, url: string }} params
   * @returns {Promise<{status:number,data:any}>} resposta do upload (contem o id)
   */
  async uploadVoiceFromUrl(creds, params) {
    const filename = (params.url.split('?')[0].split('/').pop() || 'audio.mp3');
    // Valida a extensao ANTES de baixar — evita download inutil e da erro amigavel.
    const type = resolveAudioType(filename);
    if (!type.ok) {
      throw Object.assign(
        new Error(`Formato de audio nao suportado (".${type.ext}"). Use .mp3 ou .wav.`),
        { statusCode: 422, code: 'audio_formato_invalido' },
      );
    }
    const resp = await fetch(params.url);
    if (!resp.ok) {
      throw Object.assign(new Error(`Falha ao baixar audio: ${params.url} -> ${resp.status}`), {
        statusCode: 422,
        code: 'audio_url_inacessivel',
      });
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    return this.uploadVoiceAudio(creds, {
      title: params.title,
      file_base64: buffer.toString('base64'),
      filename,
      contentType: type.mime,
    });
  },

  /**
   * POST /voice/uploads — multipart/form-data com `title` + `file` (binario).
   * Recebemos base64 (interface JSON amigavel) e convertemos para multipart aqui.
   * @param {{apiToken,appId}} creds
   * @param {{ title: string, file_base64: string, filename: string }} params
   */
  async uploadVoiceAudio(creds, params) {
    const buffer = Buffer.from(params.file_base64, 'base64');
    // A LigueLead valida o MIME type da parte do arquivo; sem isso o Blob vai como
    // application/octet-stream e a API rejeita (415). Deriva da extensao se preciso.
    const contentType =
      params.contentType || resolveAudioType(params.filename).mime || 'application/octet-stream';
    const form = new FormData();
    form.append('title', params.title);
    form.append('file', new Blob([buffer], { type: contentType }), params.filename);
    // Nao definimos Content-Type do request: o fetch monta o boundary do multipart.
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
