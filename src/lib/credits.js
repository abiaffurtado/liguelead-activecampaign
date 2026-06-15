// Calculo de creditos de SMS conforme regra da LigueLead:
//   ate 160 chars        => 1 credito
//   cada 152 chars extras => +1 credito
//   maximo ~11 creditos (1600 chars)

import { LIMITS } from '../config.js';

/**
 * Creditos consumidos por UMA mensagem (por destinatario).
 * @param {string} message
 * @returns {number}
 */
export function creditsPerMessage(message) {
  const len = [...String(message)].length; // conta por code points
  if (len <= LIMITS.SMS_FIRST_CREDIT_CHARS) return 1;
  const extra = len - LIMITS.SMS_FIRST_CREDIT_CHARS;
  const credits = 1 + Math.ceil(extra / LIMITS.SMS_EXTRA_CREDIT_CHARS);
  return Math.min(credits, LIMITS.MAX_SMS_CREDITS);
}

/**
 * Estimativa total de uma campanha de SMS.
 * @param {string} message
 * @param {number} recipientCount
 */
export function estimateSmsCampaign(message, recipientCount) {
  const perMessage = creditsPerMessage(message);
  return {
    chars: [...String(message)].length,
    creditsPerMessage: perMessage,
    recipients: recipientCount,
    totalCredits: perMessage * recipientCount,
  };
}
