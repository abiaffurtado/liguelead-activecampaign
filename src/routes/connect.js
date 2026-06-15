// Endpoint de conexao — chamado pelo App Studio no passo "connect" e como
// `verify_url` do auth, para validar que o usuario informou um token.
//
// Observacao: a API LigueLead exige api-token E app-id em toda chamada, mas no
// momento do connect ainda nao temos o app-id (ele e escolhido por acao). Entao
// aqui validamos apenas a presenca do token e devolvemos uma descricao da conexao.

export default async function connectRoutes(app) {
  app.get('/connect', async (req, reply) => {
    const token = req.headers['x-liguelead-token'];
    if (!token) {
      return reply.code(401).send({ error: 'token_ausente' });
    }
    return {
      account: {
        id: 'liguelead',
        description: 'Conta LigueLead conectada',
      },
    };
  });
}
