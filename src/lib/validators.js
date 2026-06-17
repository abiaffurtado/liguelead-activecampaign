// Validacoes de regra de negocio que nao cabem no JSON Schema das rotas.

import { LIMITS } from '../config.js';

// Detecta URLs no corpo da mensagem. SMS Flash NAO pode conter URL (regra LigueLead).
const URL_REGEX = /\b((https?:\/\/)|(www\.)|([a-z0-9-]+\.(com|net|org|br|io|co|app|dev|info|biz|me)(\.[a-z]{2})?(\/|\b)))/i;

/**
 * @param {string} message
 * @returns {boolean}
 */
export function containsUrl(message) {
  return URL_REGEX.test(String(message));
}

/**
 * Valida um corpo de SMS Flash. Retorna lista de erros (vazia = ok).
 * @param {string} message
 */
export function validateFlashMessage(message) {
  const errors = [];
  if (containsUrl(message)) {
    errors.push('SMS Flash nao permite URLs no corpo da mensagem.');
  }
  if ([...String(message)].length > LIMITS.MAX_SMS_CHARS) {
    errors.push(`Mensagem excede ${LIMITS.MAX_SMS_CHARS} caracteres.`);
  }
  return errors;
}

// Formatos de audio aceitos pela LigueLead na voz (extensao -> MIME type).
// A API valida AMBOS: extensao do arquivo E Content-Type da parte multipart.
const AUDIO_MIME_BY_EXT = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

/**
 * Valida os parametros OPCIONAIS de retry de uma campanha de voz, antes de chamar
 * a API LigueLead (que rejeita com 422). So valida o que foi informado. Os campos
 * chegam como string (formulario do App Studio) ou number. Retorna lista de erros
 * (vazia = ok). Limites: tentativas 1-3, intervalo >= 5 min, horario HH:MM.
 * @param {{ retry_attempts?: any, retry_interval_min?: any, retry_end_time?: any }} [params]
 * @returns {string[]}
 */
export function validateVoiceRetry({ retry_attempts, retry_interval_min, retry_end_time } = {}) {
  const errors = [];

  if (retry_attempts != null && retry_attempts !== '') {
    const n = Number(retry_attempts);
    if (!Number.isInteger(n) || n < 1 || n > 3) {
      errors.push('Tentativas (retry_attempts) deve ser um inteiro entre 1 e 3.');
    }
  }

  if (retry_interval_min != null && retry_interval_min !== '') {
    const n = Number(retry_interval_min);
    if (!Number.isFinite(n) || n < 5) {
      errors.push('Intervalo entre tentativas (retry_interval_min) deve ser >= 5 minutos.');
    }
  }

  if (retry_end_time != null && retry_end_time !== '') {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(retry_end_time))) {
      errors.push('Horario limite (retry_end_time) deve estar no formato HH:MM (ex.: 21:00).');
    }
  }

  return errors;
}

/**
 * Resolve a extensao de um nome/URL de arquivo de audio e o MIME correspondente.
 * @param {string} nameOrUrl
 * @returns {{ ok: true, ext: string, mime: string } | { ok: false, ext: string }}
 */
export function resolveAudioType(nameOrUrl) {
  const clean = String(nameOrUrl).split('?')[0].split('#')[0];
  const ext = (clean.split('.').pop() || '').toLowerCase();
  const mime = AUDIO_MIME_BY_EXT[ext];
  if (!mime) return { ok: false, ext };
  return { ok: true, ext, mime };
}

/**
 * Divide um array em lotes de tamanho maximo (default: limite da LigueLead).
 * @template T
 * @param {T[]} arr
 * @param {number} [size]
 * @returns {T[][]}
 */
export function chunk(arr, size = LIMITS.MAX_PHONES_PER_CALL) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
