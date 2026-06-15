// Disparo em massa. Diferente das acoes por contato (1 a 1 na automacao),
// aqui resolvemos MUITOS telefones de uma vez e enviamos em lotes de ate
// 10.000 por chamada (limite da LigueLead).
//
// Fontes de telefones (combinaveis):
//   • phones[]                  -> lista direta
//   • csv (string)              -> upload de planilha
//   • source { listId | tagId } -> contatos de uma lista/tag do ActiveCampaign
//
// Credenciais LigueLead vem nos headers (multi-tenant).

import { normalizePhoneList } from '../lib/phone.js';
import { estimateSmsCampaign } from '../lib/credits.js';
import { validateFlashMessage, chunk } from '../lib/validators.js';
import { dialingWindowStatus } from '../lib/dialingWindow.js';
import { extractPhonesFromCsv } from '../lib/csv.js';
import { liguelead, credsFromRequest } from '../lib/liguelead.js';
import { fetchContactsPhones } from '../activecampaign/client.js';

const bulkSchema = {
  body: {
    type: 'object',
    required: ['channel'],
    properties: {
      channel: { type: 'string', enum: ['sms', 'sms_flash', 'voice'] },
      title: { type: 'string' },

      message: { type: 'string', maxLength: 1600 }, // sms / sms_flash
      voice_upload_id: { type: 'integer', exclusiveMinimum: 0 }, // voice
      retry_attempts: { type: 'integer', minimum: 1, maximum: 3 },
      retry_interval_min: { type: 'integer', minimum: 5, maximum: 180 },
      retry_end_time: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },

      phones: { type: 'array', items: { type: 'string' }, maxItems: 100000 },
      csv: { type: 'string' },
      csvColumn: { type: 'string' },
      source: {
        type: 'object',
        properties: {
          listId: { type: ['string', 'integer'] },
          tagId: { type: ['string', 'integer'] },
        },
      },

      dryRun: { type: 'boolean', default: false },
    },
  },
};

export default async function bulkRoutes(app) {
  app.post('/bulk/send', { schema: bulkSchema }, async (req, reply) => {
    const body = req.body;
    const creds = credsFromRequest(req.headers, req.body);

    // 1) Validacao de conteudo conforme canal.
    if (body.channel === 'voice') {
      if (!body.voice_upload_id) return reply.code(422).send({ error: 'voice_upload_id_obrigatorio' });
      if (!body.title) return reply.code(422).send({ error: 'title_obrigatorio_para_voz' });
    } else {
      if (!body.message) return reply.code(422).send({ error: 'message_obrigatoria' });
      if (body.channel === 'sms_flash') {
        const errors = validateFlashMessage(body.message);
        if (errors.length) return reply.code(422).send({ error: 'flash_invalido', detalhes: errors });
      }
    }

    // 2) Coleta de telefones de todas as fontes.
    const raw = [];
    if (Array.isArray(body.phones)) raw.push(...body.phones);
    if (body.csv) raw.push(...extractPhonesFromCsv(body.csv, body.csvColumn));
    if (body.source && (body.source.listId || body.source.tagId)) {
      raw.push(...(await fetchContactsPhones(body.source)));
    }
    if (raw.length === 0) return reply.code(422).send({ error: 'nenhuma_fonte_de_telefones' });

    // 3) Normaliza, deduplica, separa invalidos.
    const { valid, invalid } = normalizePhoneList(raw);
    if (valid.length === 0) {
      return reply.code(422).send({ error: 'nenhum_telefone_valido', invalidSample: invalid.slice(0, 20) });
    }

    const batches = chunk(valid);
    const summary = {
      channel: body.channel,
      collected: raw.length,
      valid: valid.length,
      invalid: invalid.length,
      batches: batches.length,
      invalidSample: invalid.slice(0, 20),
    };
    if (body.channel !== 'voice') summary.estimate = estimateSmsCampaign(body.message, valid.length);
    else summary.dialingWindow = dialingWindowStatus();

    // 4) Dry run: devolve o resumo sem enviar.
    if (body.dryRun) return reply.send({ dryRun: true, ...summary });

    // 5) Envio em lotes.
    const results = [];
    for (let i = 0; i < batches.length; i++) {
      const phones = batches[i];
      try {
        let res;
        if (body.channel === 'voice') {
          res = await liguelead.sendVoiceMessage(creds, {
            title: body.title,
            voice_upload_id: body.voice_upload_id,
            phones,
            retry_attempts: body.retry_attempts,
            retry_interval_min: body.retry_interval_min,
            retry_end_time: body.retry_end_time,
          });
        } else {
          res = await liguelead.sendSms(creds, {
            message: body.message,
            phones,
            is_flash: body.channel === 'sms_flash',
            title: body.title,
          });
        }
        results.push({ batch: i + 1, size: phones.length, status: res.status, data: res.data });
      } catch (err) {
        req.log.error({ err }, `falha no lote ${i + 1}`);
        results.push({ batch: i + 1, size: phones.length, error: err.message, payload: err.payload });
      }
    }

    return reply.code(202).send({ queued: true, ...summary, results });
  });
}
