# Contratos dos endpoints

Base URL: o host onde o conector está hospedado.

**Credenciais LigueLead (obrigatórias, multi-tenant)** — toda chamada às rotas de envio leva
os headers:
```
x-liguelead-token: <api-token do usuário>
x-liguelead-app-id: <app-id do usuário>
```
Se faltar, o conector responde `401 credenciais_liguelead_ausentes`. Opcionalmente, se
`CONNECTOR_TOKEN` estiver configurado no conector, envie também `x-connector-token`.

Telefone aceito nos schemas: `+5511999998888`, `5511999998888` ou `11999998888`. Internamente
é normalizado para o **formato local sem DDI** (`11999998888`), como a LigueLead exige.

---

## GET /health
Sem autenticação. → `200 { "status": "ok", "service": "liguelead-activecampaign" }`

---

## POST /actions/sms  ·  POST /actions/sms-flash
Ação de automação por contato. `sms-flash` rejeita mensagens com URL.

**Body**
```json
{
  "message": "Olá {{contato.nome}}, sua fatura venceu.",
  "phone": "11999998888",
  "phones": ["11999998888"],
  "title": "Cobrança",
  "group_id": "opcional"
}
```
`phone` (singular) e/ou `phones[]` — pelo menos um telefone válido.

**Resposta 202**
```json
{
  "queued": true,
  "channel": "sms",
  "accepted": 1,
  "invalid": [],
  "estimate": { "chars": 38, "creditsPerMessage": 1, "recipients": 1, "totalCredits": 1 },
  "liguelead": { }
}
```

**Erros**: `400` (schema — telefone/tamanho inválido) · `422 flash_invalido` (URL no Flash) ·
`422 nenhum_telefone_valido`.

---

## POST /actions/voice
Ação de automação por contato — dispara ligação com áudio pré-enviado.

**Body**
```json
{
  "title": "Lembrete de consulta",
  "voice_upload_id": 123,
  "phone": "11999998888",
  "retry_attempts": 3,
  "retry_interval_min": 15,
  "retry_end_time": "21:00"
}
```
`retry_*` são opcionais (passados direto à LigueLead): tentativas 1–3, intervalo 5–180 min,
horário-limite `HH:MM` (08:00–21:45 BRT).

**Resposta 202**
```json
{
  "queued": true,
  "channel": "voice",
  "accepted": 1,
  "invalid": [],
  "dialingWindow": { "withinWindow": true, "willQueue": false, "nowSaoPaulo": "14:30" },
  "liguelead": { }
}
```
Fora da janela 08:00–21:44 (BRT): `willQueue: true` — a LigueLead enfileira para as 08:00.

---

## POST /bulk/send
Disparo em massa. Combina fontes: `phones[]`, `csv`, `source { listId | tagId }` (AC).

**Body**
```json
{
  "channel": "sms",                  // "sms" | "sms_flash" | "voice"
  "title": "Campanha Junho",
  "message": "Promoção!",            // sms / sms_flash
  "voice_upload_id": 123,            // voice
  "phones": ["11999998888"],
  "csv": "nome;telefone\nAna;11999998888",
  "csvColumn": "telefone",           // opcional; auto-detecta colunas comuns
  "source": { "listId": 7 },         // ou { "tagId": 12 }
  "group_id": "opcional",
  "dryRun": true                     // só calcula/normaliza, não envia
}
```

**Resposta (dryRun)** — prévia sem enviar:
```json
{
  "dryRun": true,
  "channel": "sms",
  "collected": 3,
  "valid": 1,
  "invalid": 1,
  "batches": 1,
  "invalidSample": [{ "input": "invalido", "reason": "sem digitos" }],
  "estimate": { "chars": 9, "creditsPerMessage": 1, "recipients": 1, "totalCredits": 1 }
}
```

**Resposta 202 (envio)** — inclui `results[]` com o status de cada lote (≤10.000 cada).

**Erros**: `422 nenhuma_fonte_de_telefones` · `422 message_obrigatoria` ·
`422 voice_upload_id_obrigatorio` · `422 flash_invalido`.

---

## GET /voice-uploads
Lista de áudios — formato pronto para dropdown do App Studio.
```json
{ "options": [{ "value": 123, "label": "Lembrete de consulta" }], "raw": [] }
```

## GET /voice-uploads/:id
Detalhes de um áudio.

## POST /voice-uploads
Sobe novo áudio. Body: `{ "title": "...", "file_base64": "...", "filename": "audio.mp3" }`
(MP3/WAV, ≤50MB). → `201` com o `voice_upload_id`.
