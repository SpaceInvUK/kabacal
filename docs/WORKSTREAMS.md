# Kabacal — Frentes de trabalho (workstreams)

Mapa para retomar QUALQUER frente em QUALQUER sessão (local no PCGu ou cloud no claude.ai).
As sessões não compartilham memória de conversa — **este repo é a única fonte de verdade**:
estado vivo em `STATUS.md`, história em `ROADMAP.md`, regras em `AGENTS.md`/`KABACAL_RULES.md`.

**Como retomar (Ednei):** abra uma sessão no environment Kabacal e cole a "abertura" da frente
desejada. O hook de SessionStart já força o protocolo (AGENTS → STATUS → pull → lock → check.mjs).
Regra de ouro: **UM escritor por vez entre local e cloud** — não abra duas sessões editando
`index.html` ao mesmo tempo; `.session.lock` + `git pull --rebase` existem para isso.

Abertura universal (serve para qualquer assunto):

> Lê docs/WORKSTREAMS.md e me diz o estado da frente «NOME». Depois propõe o próximo passo
> e espera meu ok antes de editar.

---

## 1 · Doors editor / Configurator (paridade JoinerySupply)

**Estado:** paridade completa shipped (midrails, glazing, shape rake/splay, Door Style em botões,
hinge catalog + HINGE_GUIDE, linhas finas, diagrama T/B/L/R). Ver STATUS "In flight" 2026-07-20/21.
**Pendências:** decisão sobre aplicar as fórmulas de preço da JoinerySupply (relatório entregue,
NADA aplicado); confirmar MDF Hidrofugo 25mm = £80; verificar direção do offset 9.5mm dos guias
de dobradiça no gabarito Blum real (guias NUNCA vão para o NC antes disso); pocket depth → NC só
com aprovação explícita; anéis do Flushback/cantos arredondados não seguem porta shaped.

> **Abertura:** Continua a frente Doors editor (WORKSTREAMS §1). Lista as pendências do STATUS
> e me pergunta qual atacar.

## 2 · Paneling (Wall Panels)

**Estado:** engine run-first + wrap V↔H rounds 1–2 + larguras individuais/chapas 10x5-special +
Quote/PDF shipped. Fase 2 (offcuts, panorâmica avançada) aberta.
**Pendências:** validação visual do Ednei nos DXFs reais (allowance 175 vs 80 no caso porta
flanqueada; alinhamento do cap objeto); preço REAL da chapa especial >1520mm (hoje placeholder).

> **Abertura:** Continua a frente Paneling (WORKSTREAMS §2). Estado no STATUS ("Panels: Wrap
> round 2" e anteriores); me mostra as validações pendentes antes de propor código.

## 3 · Toolpaths / CAM (Pegasus + Syntec) — ZONA GUARDADA

**Estado:** templates reais (Plain Shaker/Ogee/Flushback) validados vs VCarve; Syntec Tier 1
(pacote de produção .zip) e Tier 2 (comentários NC opt-in) shipped; goldens NC byte-exatos.
**Pendências:** **Risco 1 do STATUS = bug real na máquina**: OUT do Plain Shaker T1 corta as
passadas "de cabeça para baixo" (fino primeiro) — precisa do NC exato que rodou + sequência do
VCarve de referência; Tier 3 (ZPL/Zebra) e Tier 4 (tempo estimado); air-cut obrigatório para
template novo. Shaped OUT e panels wrapped NÃO cortam no NC (regime de segurança) até validação
VCarve. *Máquina/VCarve = só PCGu; sessão cloud prepara e deixa o passo físico anotado no STATUS.*

> **Abertura:** Continua a frente CAM/Toolpaths (WORKSTREAMS §3). Começa pelo Risco 1 do
> STATUS (OUT invertido do Plain Shaker); é zona guardada — evidência antes, goldens byte-exatos.

## 4 · SaaS / Cloud accounts (Supabase + Stripe)

**Estado:** Fases 1–3 LIVE dark (login magic-link, cloud jobs, Push/Pull settings) no projeto
hosted `rvmyalrtoblxmxciiovd`; Fase 4 (billing) preparada e E2E confirmado com cartão teste;
13/13 testes de isolamento. Canônico: `docs/SAAS.md` + `supabase/README.md`.
**Pendências:** SMTP próprio antes de qualquer convite beta; Stripe go-live (runbook + decisão
D5 de preços); Ednei fazer ⇧ Push settings uma vez do PCGu; migration `0004_orders_read.sql` +
enrolar o próprio uid em `app_admins` (SQL editor — humano). Segredos = SEMPRE colados pelo
Ednei no dashboard, nunca no repo/chat.

> **Abertura:** Continua a frente SaaS (WORKSTREAMS §4). Lê docs/SAAS.md §status e me lista o
> que depende de mim (SMTP/Stripe/SQL) vs o que tu podes fazer sozinho.

## 5 · Doors Online (site fastcnc.co.uk → produção)

**Estado:** Etapas 2+3 LIVE — engine headless (`tools/order-engine.mjs`), Edge Function
`order-intake` deployada (CI redeploya no push), E2E real Woo #4004 → 3 arquivos no Storage;
Online Orders tab no app (Etapas A+B). Plano: memória fastcnc-doors-online-v1 + docs no repo
cnc-calculator (`docs/FAST_CNC_DXF_TO_SHEETS.md` etc.).
**Pendências:** `RESEND_API_KEY` para e-mail services@ (Ednei cola no dashboard); gate da
migration 0004 (ver §4); Fase C = aprovar pedido → pasta ScanMode (depois da validação A/B);
porte para o site oficial (checklist no repo cnc-calculator, executável pelo Codex do LaptopEdnei).

> **Abertura:** Continua a frente Doors Online (WORKSTREAMS §5). Confirma o estado da
> order-intake e me diz o próximo passo da Fase C.

## 6 · WorkPlanner ↔ Kabacal (clone do Monday)

**Estado:** contrato de integração v1 commitado no repo **cnc-calculator** (Codex do Rodrigo
constrói o WorkPlanner); Reference = ID canônico; arquivos no Drive info@ por Reference.
Monday.com free plan TEM API — opção 1 aguarda board + `MONDAY_TOKEN` (colado como secret).

> **Abertura (no environment do cnc-calculator):** Continua a frente WorkPlanner (WORKSTREAMS
> §6 do repo kabacal). Lê o contrato v1 e me diz o que falta do meu lado.

## 7 · Infra cloud / ambiente

**Estado:** COMPLETO 2026-08-14 — environment claude.ai conectado aos repos `SpaceInvUK/kabacal`
e `SpaceInvUK/cnc-calculator`; protocolo viaja no repo (SessionStart hook); guia em `docs/CLOUD.md`.
O que fica físico (VCarve, Syntec, WP local) está listado lá.

---

**Manutenção deste arquivo:** ao fechar/abrir uma frente, atualize a seção correspondente na
mesma sessão que atualiza o STATUS.md (uma linha basta — o detalhe vive no STATUS/ROADMAP).
