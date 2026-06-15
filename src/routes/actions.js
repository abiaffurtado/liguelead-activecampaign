// Acoes por contato — sao estes endpoints que as ACOES do App Studio chamam
// dentro de automacoes e gatilhos. O AC envia 1 contato por vez; por isso
// cada chamada normalmente carrega 1 telefone, mas aceitamos array para reuso.
//
// As credenciais LigueLead (api-token / app-id) vem nos headers da requisicao,
// preenchidas por cada usuario na conexao do App Studio (multi-tenant).

import { normalizePhoneList } from '../lib/phone.js';
import { estimateSmsCampaign } from '../lib/credits.js';
import { validateFlashMessage } from '../lib/validators.js';
import { dialingWindowStatus } from '../lib/dialingWindow.js';
import { liguelead, credsFromHeaders } from '../lib/liguelead.js';

const phoneItem = {
  type: 'string',
  pattern: '^(\\+55\\d{10,11}|55\\d{10,11}|\\d{10,11})$',
};

const smsSchema = {
  body: {
    type: 'object',
    required: ['message', 'phone'],
    properties: {
      message: { type: 'string', minLength: 1, maxLength: 1600 },
      phone: phoneItem,
      phones: { type: 'array', items: phoneItem, minItems: 1, maxItems: 10000 },
      title: { type: 'string' },
    },
  },
};

const voiceSchema = {
  body: {
    type: 'object',
    required: ['title', 'voice_upload_id', 'phone'],
    properties: {
      title: { type: 'string', minLength: 1 },
      voice_upload_id: { type: 'integer', exclusiveMinimum: 0 },
      phone: phoneItem,
      phones: { type: 'array', items: phoneItem, minItems: 1, maxItems: 10000 },
      retry_attempts: { type: 'integer', minimum: 1, maximum: 3 },
      retry_interval_min: { type: 'integer', minimum: 5, maximum: 180 },
      retry_end_time: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
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
    const creds = credsFromHeaders(req.headers);
    const { valid, invalid } = normalizePhoneList(collectPhones(req.body));
    if (valid.length === 0) {
      return reply.code(422).send({ error: 'nenhum_telefone_valido', invalid });
    }

    const window = dialingWindowStatus();
    const result = await liguelead.sendVoiceMessage(creds, {
      title: req.body.title,
      voice_upload_id: req.body.voice_upload_id,
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
      dialingWindow: window,
      liguelead: result.data,
    });
  });
}

async function handleSms(req, reply, { isFlash }) {
  const creds = credsFromHeaders(req.headers);
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
