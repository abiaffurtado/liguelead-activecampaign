// Adaptador serverless para a Vercel.
//
// A Vercel executa funcoes (nao um servidor "sempre ligado"). Aqui montamos a
// instancia Fastify uma vez (reaproveitada entre invocacoes quentes) e
// encaminhamos cada requisicao para ela via `server.emit('request', ...)`.

import { buildServer } from '../src/server.js';

const app = buildServer();
const ready = app.ready();

export default async function handler(req, res) {
  await ready;
  app.server.emit('request', req, res);
}
