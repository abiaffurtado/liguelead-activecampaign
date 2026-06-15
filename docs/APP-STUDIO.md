# App Studio — app nativo da LigueLead na ActiveCampaign

> **Arquivo para colar no editor:** [`../app-studio/activeCampaign.json`](../app-studio/activeCampaign.json)

Confirmado (a partir do app antigo da LigueLead que funcionava): o App Studio **cria sim
ações de automação**, via `workflows` com `"type": "automations"`. Cada workflow vira um
bloco no construtor de automação.

## Por que o app passa pelo conector (e não chama a LigueLead direto)

Três limites do App Studio v2 (confirmados na doc):
1. O **auth envia só 1 header** — e a API nova exige dois (`api-token` **e** `app-id`).
2. O comando **`!http` não aceita headers customizados** (só `method`/`path`/`body`).
3. **Não existe campo de upload de arquivo** (só `text`, `textarea`, `dropdown`, `multiselect`).

Por isso o `base_url` aponta para o **conector** (Vercel), que:
- recebe o `api-token` no header `x-liguelead-token` (auth do App Studio);
- recebe o `app_id` no **corpo** de cada ação (campo do formulário);
- remonta os dois headers e chama a API nova da LigueLead;
- para voz, **baixa a URL do áudio e faz o upload** para a LigueLead (`/voice/uploads`),
  já que não há campo de upload de arquivo no App Studio.

## Estrutura do `activeCampaign.json`

- **`api.base_url`** = `https://liguelead-activecampaign.vercel.app`
- **`auth` (token-auth)**: `header_key` = `x-liguelead-token`, campo `token` (o API Token do
  usuário); `verify_url` = `/connect`.
- **`workflows`** (`type: automations`):
  - `send-a-sms` → `POST /actions/sms`
  - `send-a-sms-flash` → `POST /actions/sms-flash`
  - `send-a-voice` → `POST /actions/voice`
  - Cada um tem `connect` (valida via `/connect`), `select` (formulário do passo) e
    `data_pipeline` (pega `phone` do contato e faz o POST no conector).

### Campos do formulário (o que o usuário preenche no passo da automação)
- **SMS / Flash**: `app_id`, `title`, `message`.
- **Voz**: `app_id`, `title`, `audio_url`, e opcionais `retry_attempts`,
  `retry_interval_min`, `retry_end_time`.

> O `app_id` é por conta e pode variar (segmenta o uso) — por isso é um campo do passo, e
> não da conexão. Cada automação pode usar um `app_id` diferente.

## Passo a passo

1. **App Studio → Build a New App** (já feito: "LigueLead Oficial").
2. **Start Building** → cole o conteúdo de `app-studio/activeCampaign.json` no editor e **Save**.
   O validador "Valerie" aponta erros no painel da direita.
3. **Conecte**: ao usar uma ação numa automação, o App Studio pedirá o **API Token** (campo do
   auth). O usuário cola o token da LigueLead.
4. **Teste** numa automação: gatilho (ex.: tag adicionada) → ação `[LigueLead] - Envia um SMS`,
   preenchendo `app_id`, título e mensagem. Adicione a tag a um contato seu com telefone real.

## Limitação conhecida — upload de áudio
O App Studio não tem campo de upload de arquivo. O áudio é informado por **URL pública**
(MP3/WAV) e o conector faz o upload para a LigueLead automaticamente. Se for necessário um
seletor de arquivo de verdade, isso não é suportado pela plataforma — seria preciso um fluxo
fora do App Studio (ex.: subir pela área do cliente da LigueLead).
