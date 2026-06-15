// Acoes por contato — sao estes endpoints que os WORKFLOWS do App Studio
// (type: "automations") chamam dentro de automacoes e gatilhos.
//
// Contrato com o App Studio:
//   - api-token: header `x-liguelead-token` (auth do App Studio).
//   - app_id:    no CORPO (o App Studio nao consegue mandar 2o header).
//   - phone:     string crua do contato (ex.: "(11) 99999-8888") — normalizada aqui.

import { normalizePhoneList } from '../lib/phone.js';
import { estimateSmsCampaign } from '../lib/credits.js';
import { validateFlashMessage } from '../lib/validators.js';
import { dialingWindowStatus } from '../lib/dialingWindow.js';
import { liguelead, credsFromRequest } from '../lib/liguelead.js';

// phone vem como string livre (dados do contato no AC podem ter formatacao).
const phoneStr = { type: 'string', minLength: 8 };

const smsSchema = {
  body: {
    type: 'object',
    required: ['message', 'phone'],
    properties: {
      message: { type: 'string', minLength: 1, maxLength: 1600 },
      phone: phoneStr,
      phones: { type: 'array', items: phoneStr, minItems: 1, maxItems: 10000 },
      title: { type: 'string' },
      app_id: { type: 'string' },
    },
  },
};

const voiceSchema = {
  body: {
    type: 'object',
    required: ['title', 'phone'],
    properties: {
      title: { type: 'string', minLength: 1 },
      phone: phoneStr,
      phones: { type: 'array', items: phoneStr, minItems: 1, maxItems: 10000 },
      app_id: { type: 'string' },
      // Informe voice_upload_id (audio ja enviado) OU audio_url (sera enviado aqui).
      voice_upload_id: { type: ['integer', 'string'] },
      audio_url: { type: 'string' },
      // Retry chegam como string do formulario do App Studio.
      retry_attempts: { type: ['integer', 'string'] },
      retry_interval_min: { type: ['integer', 'string'] },
      retry_end_time: { type: 'string' },
    },
  },
};

function collectPhones(body) {
  const list = [];
  if (body.phone) list.push(body.phone);
  if (Array.isArray(body.phones)) list.push(...body.phones);
  return list;
}

export default async function actionRoutes(app) {
  app.post('/actions/sms', { schema: smsSchema }, async (req, reply) =>
    handleSms(req, reply, { isFlash: false }),
  );

  app.post('/actions/sms-flash', { schema: smsSchema }, async (req, reply) =>
    handleSms(req, reply, { isFlash: true }),
  );

  app.post('/actions/voice', { schema: voiceSchema }, async (req, reply) => {
    const creds = credsFromRequest(req.headers, req.body);
    const { valid, invalid } = normalizePhoneList(collectPhones(req.body));
    if (valid.length === 0) {
      return reply.code(422).send({ error: 'nenhum_telefone_valido', invalid });
    }

    // Resolve o audio: usa voice_upload_id se vier, senao sobe a audio_url.
    let voiceUploadId = req.body.voice_upload_id;
    if (!voiceUploadId && req.body.audio_url) {
      const up = await liguelead.uploadVoiceFromUrl(creds, {
        title: req.body.title,
        url: req.body.audio_url,
      });
      voiceUploadId = up.data?.data?.id ?? up.data?.id;
    }
    if (!voiceUploadId) {
      return reply.code(422).send({
        error: 'audio_obrigatorio',
        message: 'Informe voice_upload_id ou audio_url.',
      });
    }

    const window = dialingWindowStatus();
    const result = await liguelead.sendVoiceMessage(creds, {
      title: req.body.title,
      voice_upload_id: voiceUploadId,
      phones: valid,
      retry_attempts: req.body.retry_attempts,
      retry_interval_min: req.body.retry_interval_min,
      retry_end_time: req.body.retry_end_time,
    });

    return reply.code(202).send({
      queued: true,
      channel: 'voice',
      accepted: valid.length,
      invalid,
      voice_upload_id: voiceUploadId,
      dialingWindow: window,
      liguelead: result.data,
    });
  });
}

async function handleSms(req, reply, { isFlash }) {
  const creds = credsFromRequest(req.headers, req.body);
  const { valid, invalid } = normalizePhoneList(collectPhones(req.body));
  if (valid.length === 0) {
    return reply.code(422).send({ error: 'nenhum_telefone_valido', invalid });
  }

  if (isFlash) {
    const errors = validateFlashMessage(req.body.message);
    if (errors.length) {
      return reply.code(422).send({ error: 'flash_invalido', detalhes: errors });
    }
  }

  const estimate = estimateSmsCampaign(req.body.message, valid.length);
  const result = await liguelead.sendSms(creds, {
    message: req.body.message,
    phones: valid,
    is_flash: isFlash,
    title: req.body.title,
  });

  return reply.code(202).send({
    queued: true,
    channel: isFlash ? 'sms_flash' : 'sms',
    accepted: valid.length,
    invalid,
    estimate,
    liguelead: result.data,
  });
}
