// Health check — usado por load balancer / App Studio para verificar o servico.

export default async function healthRoutes(app) {
  app.get('/health', async () => ({ status: 'ok', service: 'liguelead-activecampaign' }));
}
