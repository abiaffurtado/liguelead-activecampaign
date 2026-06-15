// Janela de discagem de voz da LigueLead: 08:00 a 21:44 (America/Sao_Paulo).
// Fora da janela a API NAO rejeita — ela enfileira para as 08:00. Aqui apenas
// calculamos o status para informar o usuario antes do disparo.

import { LIMITS } from '../config.js';

/**
 * Retorna os minutos desde a meia-noite no fuso America/Sao_Paulo.
 * Usa Intl para evitar dependencia de libs de timezone.
 * @param {Date} [date]
 */
export function saoPauloMinutesOfDay(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  const minute = Number(parts.find((p) => p.type === 'minute').value);
  return hour * 60 + minute;
}

/**
 * Status da janela de discagem no instante informado.
 * @param {Date} [date]
 * @returns {{ withinWindow: boolean, willQueue: boolean, nowSaoPaulo: string }}
 */
export function dialingWindowStatus(date = new Date()) {
  const minutes = saoPauloMinutesOfDay(date);
  const withinWindow =
    minutes >= LIMITS.VOICE_WINDOW_START_MIN && minutes <= LIMITS.VOICE_WINDOW_END_MIN;

  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');

  return {
    withinWindow,
    willQueue: !withinWindow, // sera enfileirado para as 08:00
    nowSaoPaulo: `${hh}:${mm}`,
  };
}
