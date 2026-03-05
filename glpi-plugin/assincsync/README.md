# Assinc Sync (GLPI Plugin)

Plugin para GLPI que registra **ações automáticas (cron)** para:

- Fazer um **full sync** (sincronizar TODOS os computadores uma vez).
- Depois executar o **incremental** (enviar IDs alterados desde um cursor).

## O que ele faz

- Registra as ações automáticas:
  - `assincsync / full`: chama a Python API para sincronizar TODOS.
  - `assincsync / trigger`: incremental por cursor.

- Full sync:
  - `POST ${PY_API_URL}/api/webhook/glpi/trigger?async=false`
  - Header: `X-Glpi-Webhook-Token: <token>`

- Incremental:
  - Consulta `glpi_computers` usando cursor robusto: `(COALESCE(date_mod,date_creation), id)`.
  - Envia somente os IDs para a Python API:
    - `POST ${PY_API_URL}/api/webhook/glpi/push?async=false`
    - Header: `X-Glpi-Webhook-Token: <token>`

> Observação: este plugin envia apenas **IDs**. A sua aplicação continua consultando o GLPI via API REST para buscar detalhes/componentes e fazer upsert no banco local.

## Instalação

1. Copie a pasta `assincsync` para o servidor do GLPI em `glpi/plugins/assincsync`.
2. No GLPI: **Setup → Plugins**, instale e habilite **Assinc Sync**.
3. Abra a configuração do plugin e preencha:
   - URL base da Python API (ex.: `http://seu-servidor:8000`)
   - Webhook token (deve bater com `GLPI_WEBHOOK_TOKEN` no backend)
  - (opcional) Lookback inicial e tamanho do lote

## Configurar o backend

Na Python API, configure no `.env`:

```env
GLPI_WEBHOOK_TOKEN=um_segredo_grande
```

E use o endpoint:
- `POST /api/webhook/glpi/trigger?async=false` (full)
- `POST /api/webhook/glpi/push?async=false` (incremental)

## Agendamento

No GLPI: **Setup → Automatic actions**
- Procure por `assincsync` / `full` e `assincsync` / `trigger`
- Sugestão:
  - `full`: rodar manualmente (ou 1x por dia, se fizer sentido)
  - `trigger`: rodar a cada 5–60 minutos

## Validação rápida

- Em **Setup → Plugins → Assinc Sync**, use os botões:
  - **Sincronizar TODOS agora**
  - **Rodar incremental agora**

- Confira o retorno/log em **Setup → Automatic actions** (logs da task) ou nos logs do servidor web.
