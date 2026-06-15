// Configuracao central — le tudo de variaveis de ambiente (.env).
// Mantemos um unico ponto de leitura de env para facilitar testes e deploy.

function required(name, value) {
  if (!value) {
    // Nao derruba o processo aqui: alguns recursos (ex: massa via AC) sao
    // opcionais. Quem usa cada credencial valida na hora.
    return undefined;
  }
  return value;
}

export const config = {
  server: {
    port: Number(process.env.PORT || 3000),
    host: process.env.HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // Token OPCIONAL de protecao do conector. Se definido, todas as rotas (exceto
  // /health) exigem o header `x-connector-token`. Como o app e multi-tenant e
  // cada chamada ja carrega as credenciais LigueLead do usuario, este token e
  // opcional — util quando voce hospeda o conector de forma privada.
  connectorToken: process.env.CONNECTOR_TOKEN || '',

  liguelead: {
    // A base ja inclui o /v1. As credenciais (api-token / app-id) NAO ficam aqui:
    // sao enviadas por requisicao, pois cada usuario tem as suas (multi-tenant).
    baseUrl: (process.env.LIGUELEAD_BASE_URL || 'https://api.liguelead.com.br/v1').replace(/\/$/, ''),
  },

  activecampaign: {
    apiUrl: required('AC_API_URL', process.env.AC_API_URL),
    apiToken: required('AC_API_TOKEN', process.env.AC_API_TOKEN),
  },
};

// Limites de negocio da LigueLead (espelham os contratos da API).
export const LIMITS = {
  MAX_PHONES_PER_CALL: 10000,
  MAX_SMS_CHARS: 1600,
  SMS_FIRST_CREDIT_CHARS: 160,
  SMS_EXTRA_CREDIT_CHARS: 152,
  MAX_SMS_CREDITS: 11,
  // Janela de discagem de voz (America/Sao_Paulo).
  VOICE_WINDOW_START_MIN: 8 * 60, // 08:00
  VOICE_WINDOW_END_MIN: 21 * 60 + 44, // 21:44
};
