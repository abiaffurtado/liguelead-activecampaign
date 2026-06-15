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
