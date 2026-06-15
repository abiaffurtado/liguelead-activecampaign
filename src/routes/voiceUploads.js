// Gestao de audios de voz. Usado para popular o dropdown da acao "Ligacao"
// no App Studio e para subir novos audios. Credenciais vem nos headers.

import { liguelead, credsFromRequest } from '../lib/liguelead.js';

const uploadSchema = {
  body: {
    type: 'object',
    required: ['title', 'file_base64', 'filename'],
    properties: {
      title: { type: 'string', minLength: 1 },
      file_base64: { type: 'string', minLength: 1 },
      filename: { type: 'string', minLength: 1, pattern: '\\.(mp3|wav)$' },
    },
  },
};

export default async function voiceUploadRoutes(app) {
  // Lista de audios — o App Studio consome isto para montar o seletor dinamico.
  app.get('/voice-uploads', async (req) => {
    const creds = credsFromRequest(req.headers, req.body);
    const res = await liguelead.listVoiceUploads(creds);
    const items = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    return {
      options: items.map((a) => ({ value: a.id, label: a.title ?? `Audio #${a.id}` })),
      raw: items,
    };
  });

  app.get('/voice-uploads/:id', async (req) => {
    const creds = credsFromRequest(req.headers, req.body);
    const res = await liguelead.getVoiceUpload(creds, Number(req.params.id));
    return res.data;
  });

  // Upload de novo audio (MP3/WAV em base64; convertido para multipart no cliente).
  app.post('/voice-uploads', { schema: uploadSchema }, async (req, reply) => {
    const creds = credsFromRequest(req.headers, req.body);
    const res = await liguelead.uploadVoiceAudio(creds, req.body);
    return reply.code(201).send(res.data);
  });
}
