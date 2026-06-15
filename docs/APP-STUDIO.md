# App Studio — definição do app na ActiveCampaign

O App Studio é o portal self-service da ActiveCampaign onde se constrói, testa e publica
apps nativos. Para a LigueLead o app expõe **uma conexão** (credencial) e **três ações** que
aparecem no builder de automação. As ações chamam os endpoints deste backend conector.

> O App Studio usa um schema próprio (DSL/JSON) que evolui. O arquivo
> [`../app-studio/app.json`](../app-studio/app.json) é uma representação **ilustrativa** do
> mapeamento ação → endpoint. Ao montar no App Studio real, replique estes campos e URLs.

## Passo a passo

1. **Conta de desenvolvedor / App Studio.** Acesse o App Studio na sua conta AC
   (Settings → Developer / App Studio). Para publicar no marketplace é preciso ser parceiro
   de tecnologia, mas dá para desenvolver e testar na própria conta antes.
2. **Hospede o conector** (este repo) numa URL pública HTTPS. Anote a base URL.
3. **Crie a conexão (Connection).** Campo `apiKey` (a API key da LigueLead do cliente) e o
   `connectorToken`. O App Studio guarda isso e envia em cada chamada.
4. **Configure o header de auth** das requisições: `x-connector-token: {{connection.connectorToken}}`.
5. **Crie as 3 ações** (abaixo). Cada uma mapeia campos → corpo JSON → endpoint.
6. **Teste** com os logs ao vivo do App Studio, usando um contato real seu.
7. **Submeta para revisão** e publique.

## Conexão (preenchida por CADA usuário)

Como o app é multi-tenant, a conexão é onde cada usuário coloca as próprias credenciais.

| Campo | Tipo | Descrição |
|---|---|---|
| `apiToken` | secret | **API Token** da conta LigueLead (Integrations → API Token) |
| `appId` | secret | **App ID** da conta LigueLead |
| `connectorBaseUrl` | url | Base URL do backend conector (onde você fez deploy) |

Configure os headers que o App Studio envia em cada chamada:
```
x-liguelead-token: {{connection.apiToken}}
x-liguelead-app-id: {{connection.appId}}
```
O conector repassa essas credenciais para a LigueLead — nada fica armazenado no backend.

## Ações

### 1. LigueLead: Enviar SMS  → `POST {{connectorBaseUrl}}/actions/sms`
| Campo (UI) | Body | Origem |
|---|---|---|
| Mensagem | `message` | texto (suporta merge tags do AC) |
| Telefone | `phone` | campo de telefone do contato (`%PHONE%`) |
| Título | `title` | texto opcional |

### 2. LigueLead: Enviar SMS Flash  → `POST {{connectorBaseUrl}}/actions/sms-flash`
Mesmos campos da ação de SMS. O backend rejeita mensagens com URL (regra do Flash).

### 3. LigueLead: Enviar Ligação  → `POST {{connectorBaseUrl}}/actions/voice`
| Campo (UI) | Body | Origem |
|---|---|---|
| Áudio | `voice_upload_id` | **dropdown dinâmico** populado por `GET /voice-uploads` |
| Título | `title` | texto |
| Telefone | `phone` | campo de telefone do contato |

O dropdown de áudio consome `GET /voice-uploads`, que já retorna `{ options: [{value,label}] }`.

## Gatilhos

Os gatilhos são os **nativos do ActiveCampaign** (tag adicionada, contato entra na lista,
campo alterado, data, etc.). Não é preciso criar gatilho customizado: basta usar as ações
acima como passos dentro de qualquer automação.

## Disparo em massa

O App Studio é voltado a ações por contato. Para massa, use o **painel próprio** servido
pelo backend (`POST /bulk/send`) — seja como página dentro do app (se o App Studio permitir
páginas customizadas) ou como app web separado autenticado pelo `connectorToken`. Ele resolve
contatos por lista/tag do AC, por CSV ou por lista direta, e dispara em lotes de 10.000.
