# Deploy em produção

O conector é um serviço HTTP stateless. **Não precisa de VPS nem AWS EC2** — uma PaaS
resolve com HTTPS automático e gestão de secrets. Comparativo:

| Plataforma | Esforço | Observação |
|---|---|---|
| **Render** (recomendado) | baixo | Blueprint `render.yaml` pronto · HTTPS auto · use plano **Starter** (~US$7/mês) p/ evitar cold start |
| Railway | baixo | deploy por Docker/Git, cobrança por uso |
| Fly.io | médio | bom p/ baixa latência global, requer `fly.toml` |
| AWS App Runner / Lightsail | médio | se você é obrigado a ficar na AWS, são as opções mais simples |
| VPS (DigitalOcean/Hetzner) ou EC2 | alto | você gerencia SO, TLS, PM2/systemd, updates — desnecessário aqui |

> ⚠️ **Cold start importa.** O free tier do Render "dorme" após inatividade; quando a
> ActiveCampaign chamar a ação, a primeira requisição pode estourar timeout. Para produção
> use um plano que mantém o serviço sempre ativo.

## Opção recomendada: Render via Blueprint

1. **Suba o projeto no GitHub** (veja abaixo).
2. No Render: **New → Blueprint** e aponte para o repositório. Ele lê o `render.yaml`.
3. Preencha os secrets — **todos opcionais** (não vão para o git):
   - `CONNECTOR_TOKEN` — só se quiser proteger o conector (ex.: `openssl rand -hex 32`).
   - `LIGUELEAD_BASE_URL` — só se a base mudar (default `https://api.liguelead.com.br/v1`).
   - `AC_API_URL` / `AC_API_TOKEN` — só se for usar disparo em massa por lista/tag do AC.

   > As credenciais da LigueLead (`api-token`/`app-id`) **não** vão aqui: são de cada
   > usuário, informadas na conexão do App Studio e enviadas em cada requisição.
4. Deploy. O Render entrega uma URL HTTPS tipo `https://liguelead-activecampaign.onrender.com`.
5. Teste: `curl https://SEU-APP.onrender.com/health` → `{"status":"ok"}`.
6. Use essa URL como `connectorBaseUrl` no App Studio.

### Subir no GitHub
```bash
cd ~/liguelead-activecampaign
git init && git add -A && git commit -m "Conector LigueLead x ActiveCampaign"
git branch -M main
git remote add origin git@github.com:SUA_CONTA/liguelead-activecampaign.git
git push -u origin main
```

## Deploy sem PaaS gerenciada (Docker em qualquer host)

A imagem é portável. Em qualquer servidor com Docker:
```bash
docker build -t liguelead-ac .
docker run -d --name liguelead-ac -p 3000:3000 \
  -e CONNECTOR_TOKEN=... \
  -e LIGUELEAD_API_KEY=... \
  -e LIGUELEAD_BASE_URL=https://api.liguelead.com.br \
  liguelead-ac
```
Nesse caso, **você** precisa pôr um HTTPS na frente (Caddy/Nginx + Let's Encrypt, ou o
load balancer do provedor). É por isso que a PaaS é mais simples.

## Checklist de produção

- [x] API LigueLead confirmada e validada ponta a ponta (base/paths/auth).
- [x] Multi-tenant: credenciais por usuário via headers (nada armazenado).
- [ ] Secrets só via env da plataforma, nunca commitados.
- [ ] HTTPS ativo (PaaS já entrega; em VPS, configure você).
- [ ] `/health` respondendo 200.
- [ ] (Recomendado p/ produção) plano sem cold start.
- [ ] (Opcional) `CONNECTOR_TOKEN` forte para proteção extra do conector.
- [ ] (Opcional) domínio próprio apontando para o serviço.
