# LigueLead × ActiveCampaign

App nativo da **LigueLead** para a **ActiveCampaign**: dispara **SMS**, **SMS Flash** e
**Ligação (voz)** dentro de automações e gatilhos, e faz **disparo em massa** a partir de
listas/tags/segmentos do ActiveCampaign, upload de CSV ou lista direta de telefones.

Este repositório contém o **backend conector** (Node.js + Fastify) — o serviço que
recebe as chamadas das ações do App Studio e fala com a API da LigueLead. O app em si
(ações que aparecem no builder de automação) é definido no **App Studio** da ActiveCampaign
e aponta para os endpoints deste serviço. Veja [`docs/APP-STUDIO.md`](docs/APP-STUDIO.md).

## Por que existe um backend?

O App Studio é low-code: ele registra ações no builder e chama URLs externas, mas não faz
o trabalho pesado. Este conector cuida de:

- **Normalização de telefone BR** (`+55`, `55`, `11 dígitos` → formato canônico).
- **Regras da LigueLead**: SMS Flash sem URL, janela de discagem de voz (08:00–21:44 BRT),
  cálculo de créditos, limite de 10.000 telefones por chamada.
- **Lotes**: quebra grandes volumes em chamadas de até 10.000.
- **Disparo em massa** resolvendo contatos via API do ActiveCampaign ou CSV.

## Arquitetura (resumo)

```
ActiveCampaign (App Studio)            Backend conector (este repo)        API LigueLead
  Ação "Enviar SMS"        ── POST /actions/sms        ──┐
  Ação "Enviar SMS Flash"  ── POST /actions/sms-flash  ──┼─ valida / lote ─→ send_sms
  Ação "Enviar Ligação"    ── POST /actions/voice      ──┘                   send_voice_message
  Painel "Disparo em massa"── POST /bulk/send          ──── resolve AC/CSV ─→ send_sms / voice
  Seletor de áudio         ── GET  /voice-uploads      ──────────────────→ list_voice_uploads
```

Detalhes em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Rodando localmente

```bash
cp .env.example .env      # preencha LIGUELEAD_API_KEY e CONNECTOR_TOKEN
npm install
npm test                  # testes da lógica de domínio
npm run dev               # sobe em http://localhost:3000
```

Smoke test:

```bash
curl localhost:3000/health
curl -X POST localhost:3000/actions/sms \
  -H 'content-type: application/json' \
  -H 'x-connector-token: SEU_TOKEN' \
  -d '{"message":"Ola!","phone":"11999998888"}'
```

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/health` | health check (sem auth) |
| POST | `/actions/sms` | ação de automação — SMS por contato |
| POST | `/actions/sms-flash` | ação de automação — SMS Flash por contato |
| POST | `/actions/voice` | ação de automação — Ligação por contato |
| POST | `/bulk/send` | disparo em massa (lista AC / tag / CSV / phones[]) |
| GET | `/voice-uploads` | lista de áudios (popula o seletor da ação de voz) |
| POST | `/voice-uploads` | sobe novo áudio (MP3/WAV base64) |

Contratos completos em [`docs/API.md`](docs/API.md).

## Autenticação (multi-tenant)

Este é um app para **qualquer usuário** — cada um informa as próprias credenciais da
LigueLead. O fluxo de credenciais:

1. O usuário pega `api-token` e `app-id` em *areadocliente.liguelead.app.br → Integrations
   → API Token* e preenche na **conexão do app no App Studio**.
2. O App Studio envia essas credenciais ao conector em **cada chamada**, nos headers
   `x-liguelead-token` e `x-liguelead-app-id`.
3. O conector apenas **repassa** para a API LigueLead (headers `api-token` / `app-id`).
   Nenhuma credencial fica armazenada no conector.

Opcionalmente, defina `CONNECTOR_TOKEN` para exigir também o header `x-connector-token`
(proteção extra do conector em hospedagem privada).

## Status do projeto / próximos passos

- [x] Núcleo: normalização (sem DDI), créditos, janela de voz, validação de Flash, lotes
- [x] Ações por contato (automações/gatilhos)
- [x] Disparo em massa (AC list/tag, CSV, phones[]) com dry-run
- [x] Gestão de áudios de voz (upload multipart)
- [x] Testes da lógica de domínio
- [x] **API LigueLead confirmada** (base, paths, auth de 2 headers) e validada ponta a ponta
- [x] **Multi-tenant**: credenciais por usuário via headers
- [ ] Webhooks de status da LigueLead → writeback em campos do contato no AC
- [ ] Painel web de disparo em massa (UI)
- [ ] Definição final no App Studio + submissão ao marketplace
