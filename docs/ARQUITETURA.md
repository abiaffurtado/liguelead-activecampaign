# Arquitetura

## Visão geral

```
┌────────────────────────────┐      ┌────────────────────────────┐      ┌──────────────┐
│      ActiveCampaign         │      │   Backend conector (Node)   │      │  API LigueLead│
│                             │      │                             │      │              │
│  Gatilhos nativos           │      │  Hook de auth (x-connector- │      │  send_sms    │
│  (tag, lista, campo, data)  │      │  token)                     │      │  send_voice  │
│        │                    │      │                             │      │  uploads     │
│        ▼                    │ HTTP │  /actions/sms               │ HTTP │              │
│  Ação "LigueLead: SMS"  ────┼─────▶│  /actions/sms-flash   ──────┼─────▶│              │
│  Ação "LigueLead: Flash"────┼─────▶│  /actions/voice             │      │              │
│  Ação "LigueLead: Ligação"──┼─────▶│  /bulk/send                 │      │              │
│                             │      │  /voice-uploads             │      │              │
│  Painel de massa  ──────────┼─────▶│                             │      │              │
└────────────────────────────┘      │   lib/: phone, credits,     │      └──────────────┘
        ▲                            │   validators, dialingWindow │
        │ API v3 (resolve contatos)  │   csv                       │
        └────────────────────────────┴─────────────────────────────┘
```

## Componentes

### 1. App no App Studio (ActiveCampaign)
Define a conexão (API key da LigueLead) e três **ações de automação**. Cada ação coleta
campos do contato/automação e faz um POST para o backend. Detalhes em `APP-STUDIO.md`.

### 2. Backend conector (este repositório)
- **`src/server.js`** — bootstrap do Fastify, hook de autenticação, error handler.
- **`src/config.js`** — toda a configuração via env + limites de negócio (`LIMITS`).
- **`src/lib/`** — lógica de domínio pura e testável:
  - `phone.js` — normalização/validação de telefone BR (canônico `55` + local).
  - `credits.js` — cálculo de créditos de SMS (160 + 152).
  - `dialingWindow.js` — janela de discagem de voz no fuso America/Sao_Paulo.
  - `validators.js` — bloqueio de URL no Flash, divisão em lotes.
  - `csv.js` — parser CSV sem dependências para o disparo em massa.
  - `liguelead.js` — cliente HTTP da API LigueLead (paths centralizados aqui).
- **`src/activecampaign/client.js`** — cliente da API v3 do AC (resolve telefones de lista/tag).
- **`src/routes/`** — endpoints (actions, bulk, voiceUploads, health).

### 3. API LigueLead
Recebe as campanhas. Contratos conhecidos (espelhados no cliente):

| Operação | Params | Limites |
|---|---|---|
| SMS / Flash | `message`, `phones[]`, `is_flash`, `title?`, `group_id?` | ≤10.000 telefones · Flash sem URL · 160 = 1 crédito, +152 = +1 (máx ~11) · async (202) |
| Voz | `title`, `voice_upload_id`, `phones[]`, `group_id?` | janela 08:00–21:44 BRT (fora disso enfileira) |
| Upload áudio | `title`, `file_base64`, `filename` | MP3/WAV, ≤50MB → retorna `voice_upload_id` |

## Decisões de design

- **Por contato vs. massa.** Automações do AC executam **um contato por vez**. As ações
  (`/actions/*`) enviam tipicamente 1 telefone. Para volume, o `/bulk/send` resolve a lista
  inteira de uma vez e quebra em lotes de 10.000 — muito mais rápido e econômico em créditos
  do que disparar a automação para milhares de contatos.
- **Telefone canônico.** Tudo é normalizado para `55` + DDD + assinante, removendo
  duplicados, antes de chamar a LigueLead. Inválidos são reportados, não descartados em silêncio.
- **Validações na borda certa.** Formato de telefone e tamanhos via JSON Schema (Ajv) nas
  rotas; regras de negócio (Flash sem URL, janela de voz, créditos) em `lib/`.
- **Idempotência da credencial.** O App Studio não entrega PII de quem instala o app; o
  vínculo da conta LigueLead é gerido pelo backend via `CONNECTOR_TOKEN` + `LIGUELEAD_API_KEY`.
  Para multi-tenant (vários clientes), evoluir para uma credencial por instalação (ver abaixo).

## API LigueLead (confirmada)

Base: `https://api.liguelead.com.br/v1` · Auth: headers `api-token` + `app-id`.

| Operação | Método/Path | Corpo |
|---|---|---|
| SMS / Flash | `POST /sms` | `{title?, message, phones[], is_flash}` → 202 `{data:{campaign_id}}` |
| Voz | `POST /voice` | `{title, voice_upload_id, phones[], retry_attempts?, retry_interval_min?, retry_end_time?}` |
| Upload áudio | `POST /voice/uploads` | **multipart/form-data**: `title` + `file` (binário) → 201 `{data:{id}}` |
| Listar áudios | `GET /voice/uploads` | — |
| Obter áudio | `GET /voice/uploads/:id` | — |

Telefones **sem DDI**. Doc: https://docs.liguelead.com.br/reference

## Multi-tenant

Resolvido: as credenciais (`api-token`/`app-id`) chegam por requisição nos headers
`x-liguelead-token` / `x-liguelead-app-id`, vindas da conexão que cada usuário preenche no
App Studio. O conector é **stateless** quanto a credenciais — não armazena nada.

## Pendências para produção

1. **Status assíncrono** — a LigueLead oferece webhooks (ver
   https://docs.liguelead.com.br/docs/how-to-receive-webhooks). Criar `/webhooks/liguelead`
   e escrever o status de volta em campos customizados do contato no AC.
2. **Painel de massa (UI)** — formulário web para upload de CSV / seleção de lista do AC.
3. **Rate limiting / retry** — backoff nos lotes e respeito ao rate limit da API v3 do AC
   (5 req/s por conta) e aos limites da LigueLead (ver `docs/api-limits`).
