// Ponto de entrada do conector LigueLead <> ActiveCampaign.

import Fastify from 'fastify';
import { config } from './config.js';
import healthRoutes from './routes/health.js';
import connectRoutes from './routes/connect.js';
import actionRoutes from './routes/actions.js';
import bulkRoutes from './routes/bulk.js';
import voiceUploadRoutes from './routes/voiceUploads.js';

export function buildServer() {
  const app = Fastify({
    logger: { level: config.server.logLevel },
    bodyLimit: 75 * 1024 * 1024, // 75MB: comporta audio base64 (max 50MB) + folga
  });

  // ── Protecao opcional do conector ───────────────────────────
  // Como o app e multi-tenant (cada chamada carrega as credenciais LigueLead
  // do usuario), o token do conector e OPCIONAL. Se CONNECTOR_TOKEN estiver
  // definido, exigimos o header `x-connector-token` em todas as rotas exceto
  // /health — util para hospedagem privada.
  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/health' || req.method === 'OPTIONS') return;
    if (config.connectorToken && req.headers['x-connector-token'] !== config.connectorToken) {
      return reply.code(401).send({ error: 'nao_autorizado' });
    }
  });

  // ── Tratamento de erros ─────────────────────────────────────
  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err, payload: err.payload }, 'erro na requisicao');
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    reply.code(status).send({
      error: err.code || 'erro_interno',
      message: err.message,
      detalhes: err.payload,
    });
  });

  app.register(healthRoutes);
  app.register(connectRoutes);
  app.register(actionRoutes);
  app.register(bulkRoutes);
  app.register(voiceUploadRoutes);

  return app;
}

// Inicia apenas quando executado diretamente (permite import em testes).
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = buildServer();
  app.listen({ port: config.server.port, host: config.server.host }, (err, address) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    app.log.info(`conector LigueLead<>ActiveCampaign ouvindo em ${address}`);
  });
}
