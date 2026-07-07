# Kabacal — Roadmap / Status

App: `index.html` · Publicado: https://spaceinvuk.github.io/kabacal/ · Repo: `SpaceInvUK/kabacal`

## 2026-07-07 (e) — Flushback: geometria da referência (DXF real) + insert corrigido + templates de fábrica

Fonte de verdade: `Flushback 18mm.dxf` (480×497, F65), `Flushback Insert 12mm.dxf` e os 2 `.ToolpathTemplate` do VCarve. Regra completa documentada em `KABACAL_RULES.md` ("Flushback"). **Goldens NC+DXF byte-idênticos** (job golden é só peça plana; nenhuma mudança de saída de máquina → cam-reviewer não exigido).

- **Porta flushback no DXF**: estrutura completa da referência, tudo **relativo ao frame** (escala com qualquer tamanho): `OUT` = contorno reto + cavidade r2.5 no frame · `OFFSET_A` = frame + frame−7 (banda do pocket 6.5) · `OUT_10MM` e `IN_22MM` = cavidade (ops próprias) · `POKET_INSERT` = frame−7 + frame−14 (banda do rebaixo 12.3) · `SHADOW` = frame−16 (linha shadow 2mm). Os "7, 7, 2" do user = 65→58→51→49 no exemplo. Linha A@0 do offset não duplica mais a cavidade. 4 layers novas no `DXF_LAYERS` (cores do arquivo real) + contrato no `check.mjs`.
- **Insert flushback**: overlay **13.95/lado** (+27.9; era 14 — medido: 377.9×394.9 p/ cavidade 350×367), contorno redondo r2.5, anéis internos a **6.9** e **11.95** (banda de pocket 5.5mm). **3 polylines exatas** — as duplicatas do arquivo de referência (cada linha ×2) não são recriadas. Trad intacto; **reeded mantém 14/lado** até chegar referência própria.
- **Preview/nesting**: porta mostra cavidade + anéis +7/+14 (âmbar) + shadow +16 (tracejado); insert com anéis 6.9/11.95 arredondados.
- **Templates de fábrica** (dos arquivos do user, ordem do arquivo, 1 passada full-depth em tudo): "18mm Flushback" (7 ops, **auto**) e "12mm Flushback Insert" (2 ops). Flushback expõe as layers novas no matcher → template casa **7/7** e o ⚡ Auto aplica; ops OUT viram toolpaths ativos, o resto entra desligado ("next op") preservando a ordem. Seed só quando `kab_tp_templates` não existe (lista limpa pelo user é respeitada).
- **Nota**: o texto do pedido citava insert ~"387.9×494.9" — o DXF mede **377.9×394.9** (dígitos trocados no texto; DXF = fonte de verdade, como pedido). Em aberto: confirmar no VCarve se a op "17mm +0.15" roda antes do "FINISH 18mm" (ordem do arquivo lista FINISH primeiro).

### Testado (e)
480×497 F65: insets por layer = 0 · 65 · 65+58 · 65 · 65 · 58+51 · 49, contagens por layer iguais à referência (OUT×2, OFFSET_A×2, OUT_10MM×1, IN_22MM×1, POKET_INSERT×2, SHADOW×1) ✓ · insert 377.9×394.9 MR MDF 12mm, **3 polylines**, anéis 6.9/11.95, bulges r2.5 ✓ · escala 1000×1000 F50 → 50 · 50+43 · 43+36 · 34 + insert 927.9² ✓ · partN=2 (porta+insert) ✓ · goldens ll/c/dxf **byte-idênticos** ✓ · template 18mm Flushback casa 7/7 no flushback, Apply cria as 7 ops na ordem (2 LIVE em OUT, 5 off) ✓ · preview com anéis âmbar+shadow e insert arredondado ✓ · `check.mjs` ok ✓ · console limpo ✓.

## 2026-07-07 (d) — Tool Database real (import do VCarve), persistência de CAM e motor de templates

Import do banco de ferramentas REAL da oficina (`FASTCNCTOOLS.vtdb` → xlsx extraído → app), com a UI no formato da planilha de referência. **Goldens NC/DXF byte-idênticos** (nenhuma mudança de saída de máquina; cam-reviewer não exigido pela regra).

- **Import Excel → biblioteca**: 116 ferramentas em 9 grupos (`tools/fastcnc-tools.json`), embutidas no app entre marcadores `/*TOOLDB_START*/…/*TOOLDB_END*/`. **Material do VCarve ignorado** (pedido do user); feeds normalizados pra **mm/min** (linhas m/min ×1000); Tool # da coluna da máquina. Pipeline pra updates futuros via Claude: `node tools/xlsx2tooldb.mjs <novo.xlsx>` → `node tools/embed-tooldb.mjs` (zero dependências, parser de xlsx em stdlib).
- **Standard Tools = grupo default**: a Tool Database abre nele (13 ferramentas numeradas T1–T12); rail à esquerda troca de grupo (Drills, V-bits, Form Tools, CMT, Ball Nose…). Tabela com as colunas da imagem: **T№ · Tool Name · Type · Ø · Angle · Flutes · Pass · Step · Step% · Spindle · Feed · Plunge · Group** — tudo editável inline, salvo automático; T№ editável **alimenta direto o T{n}/H{n} do NC** (provado: tdbSet num=3 → `T3M6`/`G43H3`).
- **Compat/segurança**: `t1` = "(1) 6mm CUTTER" mantém id + feeds validados no NC (F8000/P3000/S18000); **passDepth fica 6mm** (job de referência corta 18mm em 3×6) — o vtdb guarda **25** (passada única full-depth), preservado como `passDepthDb` + marcador ✱ na UI pra adoção deliberada. `t6` = V-Bit 90°. Biblioteca v1 do usuário migra (edits ganham por id; customs → "My Tools"); `.fastcnc` antigos seguem carregando (camTools merge preserva/atribui grupo).
- **Persistência (reclamação "settings temporários")**: `camJob` + `camPaths` agora persistem em `kab_camjob`/`kab_campaths` — fechar/reabrir o app mantém setup da máquina e a lista de toolpaths. `.fastcnc` continua mandando por job (e re-salva o estado ao carregar). Tool DB: botões **Save tools (.json) / Load tools (.json) / Reset to factory** (customs de My Tools sobrevivem ao reset).
- **Templates (preparação pedida)**: motor + storage (`kab_tp_templates`) + UI no painel Toolpaths (lista com badge AUTO, indicador N/M layers casando, Apply, Import/Export .json). Schema documentado no código: `{name, auto, ops:[{layer, kind, tool:{num|id|dia}, side, params}]}` — **a ordem vem 100% do template** (Kabacal não inventa sequência). Aplica na **seleção** (1 peça, várias, ou o job todo sem seleção); cada op só atinge peças que têm a layer; ops de tipos ainda não suportados (pocket/drill) entram **desligados** ("next op") mantendo a ordem; **⚡ Auto** escolhe o melhor template `auto:true` pelas layers presentes. Tool resolvida por id → nº → Ø (Standard Tools primeiro).
- `check.mjs`: tripwire novo — marcadores TOOLDB + `t1` presente.

### Testado (d)
Fresh: 116 tools/9 grupos, default Standard Tools (13), t1 F8000/P3000/S18000 pass 6 (db:25), drills T5/S4000 + T9/S8000 corretos ✓ · **goldens ll/c/dxf byte-idênticos** (8358/8402/4517) ✓ · migração v1→v2 (t1 editado ganha, t8 custom → My Tools, 117 total) ✓ · reload restaura camPaths+camJob (datum c, gap 25) ✓ · tdbSet T№=3 → NC `T3M6`+`G43H3`, revertido ✓ · template 2 ops aplicado na seleção: pocket OFFSET_A entra off ("next op"), profile OUT ativo com scope [0], ordem mantida ✓ · ⚡ Auto na peça sem shaker: aplica só o op OUT e reporta o skip ✓ · segs do path de template → NC header/footer ok ✓ · tpPickTool puxa passDepth ✓ · modal renderizado (screenshot + a11y snapshot) ✓ · `check.mjs` ok ✓ · console limpo ✓.

## 2026-07-07 (c) — Edição por instância (split de quantidade), barra flutuante com 1, Scribe + reorganização

Rodada de UX/edição a partir do teste do user (8 pedidos). Toca zonas guardadas (nesting = conservação de peças; DXF = layer nova) → **provado por goldens byte-idênticos + conservação de contagem**.

- **(1) Barra flutuante com 1 selecionado**: FAB aparece com `selSet.size >= 1` (antes ≥2). "Clear selection" agora **esvazia de fato** a seleção → a barra some (o inspector continua no `selItem`).
- **(2/3) Seleção de instância individual (qty > 1) + split no edit**: nova seleção a nível de **cópia física** (`selInst`, chaves `i_n`). No nesting, **Ctrl/Cmd+click** marca/desmarca uma cópia (clique simples = item inteiro, como antes). Editar **qualquer** campo com uma seleção parcial → `applyInstanceSplits()` **separa** as cópias marcadas num item próprio (qty = nº marcadas) e devolve as não-marcadas às configs antigas. Ex.: 600×400 qty3, marca 2, muda frame/material → **qty2 novo + qty1 antigo**. Funciona para material (`moveSelTo`), frame, W/H, grain, etc. — tudo passa por `render()` e o split é detectado por diff vs snapshot. Se **todas** as cópias estão marcadas, edita o item inteiro sem split.
- **(4) Clareza do grupo de quantidade**: cópias marcadas = realce forte; **irmãs não-marcadas do mesmo grupo** = contorno âmbar tracejado (`.npart.sib`, sutil); banner no inspector "**N de M cópias** … muda-as splitando as N". Peças de outros itens ficam neutras.
- **(5) Ordem dos campos de add-part**: **Material · Frame · Part Type · Width · Height · Qty · Text** — Frame saiu de perto de Width/Height (Part Type separa), evitando trocar o frame por engano ao digitar tamanho.
- **(6) Ordem das seções do editor**: Parts · Door Type · **Grain** · Offset · Hinges · Groove · **Scribe** · **Spray** (Grain sobe pra baixo de Door Type; Spray desce pra depois de Groove).
- **(7) Scroll próprio da barra de edição**: `#inspector` com `max-height:calc(100vh-20px)` + `overflow-y:auto` — abrir muitas seções não empurra mais nada pra fora do alcance; a área do desenho continua usável.
- **(8) Nova seção Scribe**: linha central única no meio do lado curto, correndo o comprimento todo (200×800 → linha em 100mm, full 800mm). Layer própria **SCRIBE** no preview (magenta) e no **DXF** (aditiva — só sai quando ligada; jobs sem scribe não mudam). É linha marcada/toolpath, não corte passante. `SCRIBE` fixada como contrato no `check.mjs`.

### Testado (c)
Split: qty3 marca 2 → setFrame → item(q1,frame50)+item(q2,frame80), **partN 3→3** ✓ · material via moveSelTo (1 de 3) → q2+q1, partN 3 ✓ · width/grain via `upd` também splitam, contagem conservada ✓ · todas marcadas → sem split (q intacto) ✓ · toggle Ctrl+click on/off ✓ · `partSelState` = sel/sib/'' (2 sel + 1 sib no nesting, item vizinho neutro) ✓ · FAB visível com 1, some no clear (inspector mantém item) ✓ · ordem das seções e dos campos conferida no DOM ✓ · sidebar scrollHeight 2608 > client 431, overflow auto ✓ · Scribe: preview magenta ✓, DXF layer+LINE com **comprimento 800** só quando ligada ✓ · **goldens NC(ll/c)+DXF byte-idênticos** (8358/8402/4517) ✓ · `check.mjs` ok ✓ · console limpo ✓.

## 2026-07-07 (b) — Seleção de linhas de corte no Toolpaths (canvas + zoom) + limpeza de nome

- **Linhas de corte clicáveis**: no canvas do Toolpaths, cada contorno OUT de peça é um vetor selecionável (clique = seleciona, **Ctrl+click adiciona**, cópias da mesma peça selecionam juntas); clicar no anel de kerf também seleciona; hover azul; chapa tem checkbox no card. **Área vazia da chapa (ou ⤢) abre o zoom próprio do Toolpaths** — pan/zoom (motor `setupZoomPanZoom` parametrizado), label "N line(s) selected", checkbox "Sheet for toolpaths" no cabeçalho, Esc/Close.
- **Sync com o form**: seleção feita no canvas/zoom atualiza ao vivo os snapshots do Profile aberto (`tpSyncSel`); form novo continua defaultando pro que está selecionado (chapas + linhas). Fluxo completo: zoom → marca a chapa → clica as linhas → Profile → tool → Calculate.
- **Nome "James" removido de TODAS as referências** do repo (8 no `index.html` incl. 2 strings de UI, ROADMAP, CLAUDE.md, cam-reviewer.md, golden README, check.mjs) → termos neutros ("arquivo de referência da máquina", "padrão de produção"). `grep James` = **0 ocorrências**.
- Nota: as fresas do Tool Database nunca tiveram o nome — só descrições de UI/comentários citavam o job de origem.

### Testado (b)
Canvas: 6 vetores clicáveis + checkbox de chapa ✓ · clique → selSet + realce (×qty) ✓ · zoom abre, Ctrl+click segunda linha → "2 line(s) selected", 6 realces ✓ · checkbox no zoom → selSheets ✓ · Profile default = seleção (items+sheets) ✓ · Esc fecha e re-renderiza ✓ · grep James = 0 ✓ · `check.mjs` ok ✓ · console limpo ✓.

## 2026-07-07 — Datum/orientação corrigidos + alvo do toolpath (chapa·peças·layer) + kerf real

Rodada guarded (CAM/NC) a partir do teste do user. `cam-reviewer` executado; golden diff mostrado antes do ship.

- **(1) Datum consertado — root cause: rotação de frame, não espelho.** Os dois sintomas (LL→LR e UL→LL) batem exatamente com 90°: o Kabacal nesta em **paisagem** (X=2440) e a Pegasus monta a chapa em **retrato** (X=1220 — Job Setup do VCarve e o arquivo de referência X≤1220). Novo **`camJob.orient`** (default **portrait**) + `tpXform` (x_m = 1220−y_c, y_m = x_c, rastreando o estado modal e re-emitindo os dois eixos — o post dedupa) + offsets de datum nas **dimensões orientadas**. **Prova (bbox por datum, retrato):** ll → X[4..1010] Y[4..610] positivos · lr → X negativo · c → ±610/±1220 exatos · ul → Y negativo · ur → ambos. As 5 posições caem nos 5 pontos físicos da chapa; landscape continua disponível no Job Setup. **Z nunca é tocado** pelo transform.
- **(2) Zoom seleciona a chapa**: checkbox "Sheet for toolpaths" no cabeçalho do zoom (chapas front; back não) → mesmo `selSheets` dos cards → vira o alvo do Profile.
- **(3) Peças no zoom → toolpath**: o fluxo de clique/Ctrl+click do Edit mode alimenta o escopo; **seleções explícitas viram o default do form** (toggles visíveis All/Selected — nunca assume o job inteiro em silêncio).
- **(4) Layer com nomes do DXF**: dropdown no Profile — **OUT** (contorno, ativo) + INSIDE/OFFSET_A–G/GROOVE/LED_CHANNEL/hinges listados como "next op" (viram ativos com Pocket/Drilling). Escopo agora é **chapa × peças × layer**; `tpSegsForSheet`/preview pulam chapas fora do escopo.
- **(5) Painel compacto**: `.tpf-row` (grid 2/3 col), inputs 100%/min-width:0, fontes menores — **zero overflow medido até em 360px forçado**.
- **(6) Kerf de verdade no preview**: banda com **largura exata da fresa** (Ø6mm → stroke 0.6un) centrada na linha de corte + linha central + anel tracejado da pele 0.4; outside/inside/on provados por geometria (0.4 < borda 0.7 < 1.0); tooltip "kerf Ø6mm · outside · 18mm · layer OUT".
- **Goldens regenerados** (rotação pura: 756 linhas X/Y trocadas por arquivo, Z/F/N/estrutura idênticos; DXF intacto). README com receita + status atualizados.

### Testado
bbox dos 5 datums × 2 orientações ✓ · zoom→chapa (checkbox persiste) ✓ · zoom→2 peças → form default Selected(1 chapa)/(2 peças) → chapa 2 gera 0 segs ✓ · layer OUT armazenado ✓ · overflow 0 em 360px ✓ · kerf 0.60 + centerline + skin, 3 lados geométricos ✓ · minZ=0.000, sem Z negativo ✓ · `tools/check.mjs` ok ✓ · console limpo ✓ · veredito do cam-reviewer no commit.

## 2026-07-06 (d) — Validação vs VCarve real + fixes (pass depth da fresa, aviso de duplicados)

O user gerou o mesmo job nos dois ("Vcarve Test.nc" vs "Kabacal Test.nc") e pediu comparação, com foco em **até onde a máquina fura**.

- **✅ Profundidade CORRETA no Kabacal**: os dois arquivos terminam **exatamente em Z0.000** (mesa), nunca abaixo; topo do material Z18; zero Z negativo no arquivo inteiro. Compensação de raio idêntica (X4.000 final nos dois). Alturas: Kabacal até mais conservador (lift Z38 entre peças vs VCarve atravessando a 23.08).
- **A diferença real**: o arquivo Kabacal tinha **2 toolpaths marcados** cortando as mesmas peças (Profile 1: 3×6mm + Profile 2: **18×1mm** — o default de 1mm da spec) → 1217 linhas vs 89 do VCarve (2×9mm, sem skin). Não era bug de geometria — era default ruim + os dois ✓ na árvore.
- **Fix 1 — pass depth vem da FRESA** (comportamento VCarve): `tpDefaults(tool)` usa `tool.passDepth` (T1→6mm→3 passes; fallback 6); **trocar de fresa no Select puxa o pass depth dela** (passes recalculam). Adeus arquivos de 18 passadas por acidente.
- **Fix 2 — aviso de corte duplicado**: o Save NC detecta **2+ profiles marcados com escopo sobreposto** e mostra banner vermelho ("cut the same parts — untick the extra ones"); cada chapa agora lista os **nomes** dos toolpaths incluídos.
- **Goldens regenerados** (regra da zona guardada): NC caiu ~5× (40279→8388 · 40509→8438; DXF intacto 4517). README atualizado com o novo status (comparado vs VCarve real; falta só o dry-run físico).

### Testado (d)
passDepth default 6 (T1) → 3 passes [12/6/0] ✓ · pick T8→4 / T1→6 ✓ · minZ=0.000, sem Z negativo, arquivo 177 linhas (era 762) ✓ · banner de duplicados + nomes por chapa no modal ✓ · goldens determinísticos byte-exatos (CRLF conferido) ✓ · `tools/check.mjs` ok ✓ · sem erros no console ✓.

## 2026-07-06 (c) — Golden files de CAM/DXF + cam-reviewer atualizado pras Fases 1–3

Rede de regressão pro output de máquina (o app em si não mudou — `index.html` intocado).

- **`tests/golden/`**: job padrão (12 peças: 600×400×6 · 715×495×2 · 300×300×4, defaults de fresh-load) → **.NC da chapa 1** com datum lower-left E datum centre (coords negativas), + **DXF 18mm**. Byte-exatos (CRLF preservado via `.gitattributes -text`), determinísticos (gerado 2× idêntico ✓). Receita completa de regeneração no `tests/golden/README.md`.
- **Caveat honesto**: golden = estado CONHECIDO no commit `9582af0`, ainda não validado na máquina — vira "known good" depois do dry-run vs VCarve (próximo passo do roadmap).
- **`/verify-kabacal`** ganhou o passo de golden-diff (`git diff --no-index`); API do passo de toolpaths atualizada pra `camPaths`/`tpDefaults`/`tpSegsForSheet`/`ncPegasus(segs)`.
- **`cam-reviewer` reescrito** pras Fases 1–3: contrato de toolchange (G53Z0 + T#M06 + reset modal Z/F), padrão de produção (lastPass 0.4 separada, ramp 100mm re-coberta, tabs off default), datum só em X/Y (nunca Z), merge de segs da mesma fresa, checklist novo.
- `CLAUDE.md`: mapa CAM atualizado (toolDb/camJob/camPaths, ring*, emit*, tp*), zona guardada 3 aponta pros goldens; `/deploy-kabacal` escaneia os nomes novos.

### Testado (c)
Job padrão determinístico (NC e DXF gerados 2× → idênticos) ✓ · partN 12, 2 chapas 8x4 ✓ · NC head `%/:1248/G90/…T1M6` e tail `…G55X0Y0/M05M30` + CRLF final (hex conferido no disco) ✓ · datum centre tem X e Y negativos ✓ · tamanhos 40279/40509/4517 bytes = strings do browser ✓ · `priceForSheet('MDF 18mm','10x4')===75` ✓ · `tools/check.mjs` ok ✓.

Infraestrutura de desenvolvimento (não muda o app em si — `index.html` intocado).

- **`CLAUDE.md`**: mapa do app por função, zonas guardadas (pricing / DXF / .NC / nesting / docs de impressão) com evidência before/after obrigatória, regras de segurança (nunca commitar com check falhando, nunca force-push, `.fastcnc` retro-compatível, chaves `kab_*`), workflow do dia-a-dia e regras de trabalho paralelo (1 escritor por vez — arquivo único).
- **`tools/check.mjs`** (zero dependências): compila o `<script>` inline + tripwires de produção — `PRICES`/`calcQuote` únicos, VAT 20%, MDF 18mm 10x4 = £75, layers DXF (`OFFCUT`, `OFFCUT_TEXT`, `GROOVE`…), header/footer do post Syntec (`:1248`, `G53Z0`, `M05M30`, CRLF). Modo `--hook` pronto pra PostToolUse.
- **Subagents** (`.claude/agents/`): `pricing-guard`, `dxf-nesting-reviewer`, `cam-reviewer` — revisores read-only das zonas guardadas, com checklist e veredito.
- **Skills** (`.claude/skills/`): `/verify-kabacal` (smoke test no browser com job padrão + invariantes runtime), `/pricing-impact` (tabela before/after HEAD vs working tree), `/deploy-kabacal` (gate → commit → push → confere Pages).
- **CI**: `.github/workflows/check.yml` roda o checker a cada push (alarme pós-push; Pages continua publicando direto do main).
- `.claude/launch.json` (server de preview na 8123) · `.gitignore` + README atualizados.

### Testado
`node tools/check.mjs` → ok no estado atual · modo `--hook` ignora outros arquivos e roda no index.html · app não foi alterado (git diff do index.html vazio).

## 2026-07-06 (b) — CAM Fases 1–3: painel estilo VCarve (Job Setup · Tool Database · Profile completo)

A aba **Toolpaths** virou o painel do VCarve que o user pediu (copiado dos screenshots + vídeo dele):

- **Layout**: canvas de chapas à esquerda + **painel fixo à direita** — Material Setup (Set…, thickness, gap, Home Z, **XY Datum de 5 pontos** com bolinha vermelha) → **Toolpath Operations** (só os 4: Profile · Pocket · Drilling · Moulding) → 6 botões (Tool Database, Load/Save Toolpath template, Preview, Summary, **Save NC**) → **árvore de toolpaths** (checkbox, cor, "Profile 1 [1]" com T№ entre colchetes, filtro por espessura 18/12/9mm, ▲▼, editar/apagar, "No Toolpaths Created Yet").
- **Job Setup**: Z Zero (**Machine Bed default** / Material Surface), XY Datum 5 posições (default lower-left), rapid gap + approach editáveis, resumo das chapas por espessura.
- **Tool Database**: CRUD persistente (`kab_tooldb`) com **seed real** — T1 6mm F8000/F3000 S18000 · T6 V-bit 90° · T8 ball 8mm · T12 pocket. Select/Edit no form, merge por id ao carregar `.fastcnc`.
- **Profile Toolpath** (form copiado do vídeo, com os defaults de produção): Start/Cut Depth (**auto = espessura da chapa**, editável, aviso "exceeds thickness"), Tool Select/Edit, **Pass depth 1mm + passes auto**, Machine Vectors **Outside/Inside/On**, Allowance 0, **Separate Last Pass ON 0.4mm** (passes com pele + passada final exata — padrão do arquivo de referência), **Add Depth**, **Tabs** (off default, como na produção — vácuo), **Ramp smooth 100mm ON**, **Order** (Narrow first default · Selection · L→R · B→T), **Start At** (seletor de 8 pontos), escopo explícito **All parts / Selection**, Name.
- **Motor**: anel CCW de 8 pontos (bate com o sentido do arquivo de referência), rampa diagonal com **F modal** (`G1Z18F3000` → `G1X..Z..` → `F8000` — 1:1 com o arquivo real), re-cobertura do trecho rampado, tabs com lift/cross/drop por distância de perímetro, passada final com plunge vertical (padrão de produção).
- **NC multi-tool**: `ncPegasus(segs)` com **TOOLCHANGE** do `.pp` (`G53Z0/T#M06/G90G54/G43H#/G0X0Y0S#M3`), merge de paths consecutivos da mesma fresa, **datum transform** (ll/lr/c/ul/ur), 1 arquivo por chapa `JOB_S#_18mm.nc`.
- **Preview 2D** no canvas: anéis coloridos por toolpath (tracejado = passe com pele), **números de ordem**, ponto de início; **Summary** (comprimento + tempo por toolpath e total); **Save NC** com aviso de Z-zero/datum e warning de corte no bed.
- Persistência no `.fastcnc` (`camJob`/`camPaths`/`camTools`) + hook no `render()`.

### Testado (b)
Painel: 4 ops + 6 botões + árvore vazia "No Toolpaths Created Yet" + filtro All/18/12/9mm ✓ · defaults do form = vídeo (outside, lastPass 0.4, ramp 100, narrow, pass 1mm, cut auto) ✓ · Calculate → "Profile 1 [1]" na árvore, 24 anéis + 12 números + 12 dots no canvas ✓ · NC: header/footer de referência, CRLF, rampa diagonal F modal, pele 0.4 (X 3.6 vs 4.0), 3 plunges verticais Z0 (last pass), toolchange T6+S16000, datum centre → coords negativas ✓ · persistência camPaths/camTools/camJob ✓ · `tools/check.mjs` ok ✓ · sem erros no console ✓. (Screenshot tool travou — verificação por DOM.)

## 2026-07-05 — CAM Fase 1a: aba Toolpaths → corte de perfil → .NC Pegasus/Syntec 🎉

Kabacal deixou de ser só CAD — agora **gera código de máquina**.

- **Aba "Toolpaths" (beta)** nova view: gera o **corte de perfil** de cada peça e exporta o **`.NC`** que a Syntec lê. Por chapa: preview + "Download .NC".
- **Post-processor Pegasus (Syntec)** portado do `.pp` do VCarve e **validado byte-a-byte** contra o `.nc de referência da máquina` (header `% :1248 G90 N30…`, coords modais X/Y/Z só quando mudam, arcos I/J, footer `G53Z0…M05M30`, N de 10 em 10).
- **Geometria**: contorno externo com **compensação de raio** (retângulo da peça ± raio da fresa), origem no canto inferior-esquerdo com **Y pra cima** (flip do sheet), passes em Z iguais (≤ stepdown), **tabs** distribuídas (lift→atravessa→desce), plunge/corte separados.
- **Seed com dados reais** (do `.NC`/projeto): T1 = **End Mill 6mm**, S**18000**, corte **F8000**, plunge **F3000**, stepdown 6mm. Z: topo = espessura, seguro +20, aproximação +5, mesa = 0 (aviso de **Z-zero na mesa** + botão pra alternar pro topo do material).
- Máquina confirmada na base do VCarve: **Pegasus 1530 · OPUS CNC · Syntec**. (2ª máquina Fabertec/Parkingm2 usa arcos **R** — post plugável depois.)

### Testado
Header/footer batem 100% com o arquivo real ✓ · offset = peça ± raio, Y invertido certo (peça 7,7,600×1000 em chapa 1220 → start 4,210 / topo-dir 610,1216) ✓ · passes 13.45/8.9/4.35/-0.2 iguais ✓ · tabs só no passe passante (3 peças × 4 = 12 lifts) ✓ · plunge F3000 / corte F8000 ✓ · 5 chapas com preview + download ✓ · `.NC` termina em M05M30 ✓ · sem erros no console ✓ · screenshot conferido.

### Próximo
Comparar o `.NC` do Kabacal com o do VCarve pra mesma peça (dry-run) · depois pockets (shaker), grooves, LED e furação (o app já desenha) · lead-in/rampa · diâmetro exato da fresa de pocket (T12).

## 2026-07-04 (i) — Hinges: meio agora também é ajustável à mão (nudge)

O user pediu pra poder ajustar as hinges do meio individualmente também, mantendo o auto.

- **Híbrido**: as hinges do meio auto-espaçam entre primeira e última **por padrão**, mas cada uma pode ser **nudgeada** (digitando o valor) e fica onde foi posta. Editar uma **ponta** ainda **re-espalha** todo o meio uniformemente.
- `hingePositions` volta a **respeitar** posições salvas (custom) as-is; `hingeSetPos`: ponta → re-espalha o meio; meio → move só aquela (clampada entre as pontas, mantém as outras). Auto/Count = default uniforme.
- **UI**: todos os inputs **editáveis** de novo (meio não fica mais disabled). Tooltip explica: ponta re-espalha, meio nudgeia só ela. Resumo atualizado.

### Testado (i)
auto5 [100,300,500,700,900] · nudge meio (Hinge 3→420, Hinge 4→760) move só elas → [100,300,420,760,900] · editar última (690) re-espalha → [100,248,395,543,690] · editar primeira (150) → [150,285,420,555,690] · 4 inputs todos editáveis · sem erros no console. ✓

## 2026-07-04 (h) — Hinges: modelo primeira+última, meio sempre redistribui

Esclarecimento do user: o padrão de dobradiças é definido pela **primeira e última** hinge; as do **meio são SEMPRE distribuídas uniformemente** entre elas. Editar uma ponta **redistribui** o meio.

- **`hingePositions` reescrito**: as posições do meio são **sempre derivadas** de `first`/`last` (centro-a-centro), nunca dos valores salvos. Então mexer na Hinge 1 ou na última re-espalha o meio automaticamente. Também resolve `count:'auto'` (corrigia um bug latente onde a lista mostrava 1 hinge no modo auto).
- **Editar ponta redistribui**: `hingeSetPos` grava a ponta editada e re-deriva o meio. Ex. (span 1000): 5 hinges `[100,300,500,700,900]` → mudar a última pra **690** → `[100,248,395,543,690]`; mudar a 1ª pra **150** → `[150,285,420,555,690]`.
- **Trocar count preserva as pontas**: `setHingeCount` mantém `first`/`last` e re-espalha (3→`[150,420,690]`, volta 5→`[150,285,420,555,690]`).
- **UI**: só **primeira e última** são editáveis; as do meio ficam **read-only** (cinza, "auto · evenly spaced") com tooltip explicando. Labels: `Hinge 1 · first · 100mm from top/left`, `Hinge N · last · 100mm from bottom/right`. Botão "Reset to symmetric".
- **Consistente em tudo**: lista do inspetor, desenho na chapa e DXF usam as mesmas posições derivadas.

### Testado (h)
auto→[100,500,900] (span 1000, corrige bug do 1); editar última→meio redistribui; editar primeira→idem; count preserva pontas; meio disabled / pontas editáveis; draw == UI == DXF; sem erros no console. ✓

## 2026-07-04 (g) — Auto-nest congelado no Edit mode + grain refeito + hinges corrigidos

- **(1) Sem auto-nesting enquanto Edit mode ON.** Editar o tamanho de uma peça re-nestava tudo e a peça "fugia". Agora entrar no Edit mode faz `materialize()` (congela o layout) e o `render()` **não re-nesta** enquanto `zoomEdit` está ligado — a peça editada fica no lugar e selecionada. Sair do Edit mode libera o re-nest. Botão **Re-nest** no cabeçalho do zoom pra repack manual quando quiser.
- **(2) Grain refeito.** Saiu o laranja/amarelo denso; agora é **tom neutro taupe** (`#9c9284`/`#8b8272`) + **poucas faixas largas e suaves** (7 streaks, opacidade ~0.03–0.05), sem hairlines. Lê como material sutil, não compete com groove (roxo), não fica "busy". Chapa branca nos 2 temas.
- **(3/6) Hinges re-distribuem certo.** Mudar a contagem agora **limpa o custom** e re-espalha uniforme (centro-a-centro): 3→[100,500,900], 4→[100,367,633,900], 5→[100,300,500,700,900]. Externas na distância das pontas, do meio uniformes.
- **(4) Labels claros.** Cada hinge diz o que é, na orientação real da peça: `Hinge 1 — 100mm from top/left`, `Hinge N — 100mm from bottom/right`, meio = `centred between Hinge 1 & 3` (3) ou `evenly spaced between Hinge 1 & Hinge N` (4+). Nota: posições são os **centros**.
- **(5) Edição individual sempre visível.** N hinges = N controles, cada um editável; Count/From ends sempre à mão; "Add hinge" e "Reset to even spacing".

### Testado (g)
Edit mode: editar largura não move a peça (`stayedPut`), sair re-nesta ✓ · grain neutro/sutil light+dark (screenshots) ✓ · hinges 2/3/4/5 uniformes + custom limpo ao trocar count ✓ · labels 3 e 4 hinges corretos e orientados ✓ · 4 inputs pra 4 hinges ✓ · sem erros no console ✓.

## 2026-07-04 (f) — Zoom Edit mode: painel à esquerda + seleção de peças dentro do zoom

Correção do feedback: no zoom Edit mode o painel foi pro lado errado e as peças não selecionavam.

- **Painel de edição à esquerda** do zoom (drawer reordenado; `#zoomInsp` antes do canvas). A chapa ampliada continua visível à direita.
- **Clicar numa peça dentro do zoom seleciona** (Edit mode ON): o layer de pan/zoom capturava o clique, então a seleção nunca disparava. Agora o `pointerup` distingue **clique de arraste** (limiar 3px) e, sendo clique, faz `elementFromPoint` → `.npart` → `sel(i,ev)`. `nestClick` ignora eventos vindos de dentro do `#zoomInner` (sem duplo-handling).
- **Ctrl/Cmd+click** adiciona à seleção (multi); peças selecionadas ficam **realçadas** no zoom; o painel edita **todas** as selecionadas juntas.
- **Sync total** com o app normal: seleção no zoom reflete na lista/nesting e **persiste** ao fechar o zoom (é o `selSet`/`selItem` global). Funciona com toque (celular).

### Testado (f)
Painel à esquerda (x=32 vs canvas x=380) ✓ · clique seleciona (item 0, painel mostra 1000×600) ✓ · Ctrl+click → 2 peças, ambas realçadas ✓ · editar setting compartilhado muda as 2 ✓ · lista principal mostra 2 selecionadas durante e depois de fechar o zoom ✓ · sem erros no console ✓ · screenshot conferido (peça "Hinge" realçada azul, painel à esquerda).

## 2026-07-04 (e) — Edit mode dentro do zoom (parte 2) — pedido grande COMPLETO

- **(2) Edit mode no zoom**: botão **"Edit mode: ON/OFF"** no cabeçalho do zoom. Ligado, abre um **drawer lateral** dentro do zoom com o **mesmo acordeão de 9 seções** (Parts · Door Type · Offset · Hinges · Spray · Grain · Groove · Nesting · Sheet Size), ligado ao **mesmo estado** — dá pra editar a peça/chapa selecionada **sem sair do zoom**.
- Edições no drawer atualizam **ao vivo** o próprio drawer **e** a chapa ampliada (o `renderInspector` espelha o HTML no `#zoomInsp`; o `renderNest` dá refresh no SVG do zoom após qualquer edição). O zoom continua aberto.
- Setas ←/→ **não** trocam de chapa enquanto você digita num campo do drawer (guardado por `tagName`); Esc ainda fecha.

### Testado (e)
Drawer escondido com Edit off, visível com Edit on ✓ · 9 seções no drawer ✓ · editar grain pelo drawer → hint "Longest side" + textura aparece na chapa ampliada ao vivo, zoom não fecha ✓ · layout lado a lado (canvas + drawer 340px) ✓ · sem erros no console ✓.

**Pedido grande (13 pontos) 100% entregue** nas levas (c)+(d)+(e): sheets realistas, status por seção, groove 100mm, "Sheet Size", edit no zoom, seleção de chapas, tamanho/nesting nas selecionadas, safe-repack, default por material/custom.

## 2026-07-04 (d) — Seleção de chapas + Sheet Size/Nesting só nas selecionadas (partes 6, 7, 8, 9, 10)

- **(6) Seleção de chapas** (independente da seleção de peças): checkbox no header de cada sheet-card + realce azul (outline + ring). Estado `selSheets` (chaves `mat#idx`), com poda automática quando a estrutura muda. Back-sheets não têm checkbox.
- **(7) Sheet Size nas selecionadas** + **default por material**. Com chapas selecionadas, a seção **Sheet Size** muda só elas; sem seleção, é o default do job. Ao mudar as selecionadas, o material ganha um **default** (`matSizeDef[mat]`) → chapas **novas** desse material seguem; **as existentes não-selecionadas NÃO mudam** (são "pinadas" no tamanho atual antes de aplicar o default). Ex.1 (só sheet 1 muda) ✓, Ex.2 (as 3 juntas) ✓, Ex.3 (default do material) ✓.
- **(8) Nesting (margem/gap) nas selecionadas**: mesma mecânica; sem seleção = job inteiro.
- **(9) Nunca perde peça / nada de chapa fantasma**: mudar tamanho **re-packa** a chapa; o que não couber vai pra chapas **adicionadas** do mesmo material (tamanho = default do material) com **aviso claro** (banner "N extra sheet added…"). Total de peças conferido = constante em todos os testes.
- **(10) Custom pra job novo**: sem chapa selecionada, Sheet Size → Custom (W×H) vira o tamanho do job; com seleção, vira o default do material. `matSizeDef` **persiste no `.fastcnc`**.
- **Bug de raiz corrigido**: `render()` zerava `placements` sempre que `sheetSizeOv` mudava (re-nestava tudo e juntava peças). Novo flag `keepPlacements` preserva o layout nas operações por-chapa. O **dropdown de tamanho no header** também passou a isolar (antes re-nestava o material todo).

### Testado (d)
Ex.1 só sheet 0→10x5, sheets 1/2 intactas ✓ · Ex.2 as 3→10x4 ✓ · overflow: chapa custom 1250² → 1 peça transborda pra chapa nova + aviso, 12 peças mantidas ✓ · margem por-chapa (sheet0=20, sheet1=7) ✓ · checkbox/realce/hint "N sheet(s)" ✓ · clear ✓ · sem erros no console ✓. Falta a parte 2 (Edit mode no zoom) — próxima.

## 2026-07-04 (c) — Sheets realistas + status por seção + groove 100mm + "Sheet Size"

Primeira leva do pedido grande de nesting/sheets (partes 1, 3, 4, 5). As partes 2, 6–10 (edit no zoom, seleção de chapas, tamanho/nesting só nas selecionadas, tamanho custom pra job novo) estão desenhadas e vêm na próxima leva — a lógica está descrita no fim desta entrada.

- **(1) Grain do sheet mais realista.** A textura antiga eram linhas onduladas (`q`-curves, âmbar, opacidade 0.28) que pareciam corte/groove — pior ainda com grooves de 100mm. Agora é **um wash quente sutil + fibras finas quase retas** (marrom quente `#9c6b34`, opacidade ~0.05, ondulação < 0.4un), densas e de baixo contraste: lê como **material de fundo**, não como corte. Determinístico. Grooves continuam **roxo saturado** por cima (inconfundível). Chapa continua branca (papel) nos 2 temas → legível no dark.
- **(3) Status compacto por seção** (mesma ideia do "whole job"): cada header do acordeão mostra um resumo do que está selecionado — Parts `1000×600`, Door Type `Flat`, Offset `Shaker`/`Frame 50`, Hinges `Top · 100mm`, Grain `Off`/`Longest side`, Groove `Vertical · 100mm`, Sheet Size `8x4`. Off = **sem chip** (não polui). Multi-seleção só mostra valor se **todas** as peças concordam (senão em branco = misto).
- **(4) Groove default = 100mm** (era 10mm) em `grooveOf`/`ensureGroove`/`setGrooveSpacing`.
- **(5) "Sheet Layout" → "Sheet Size".** Diferença: **Sheet Size** = dimensão da chapa (8x4, custom…); **Nesting** = como as peças encaixam (margem, gap). São coisas distintas, então as duas seções continuam — só renomeei pra ficar claro.

### Testado (c)
groove default 100 (helper + na peça) ✓ · grain: wash+fibras, sem `q`-scallop, 50 paths, wash só nas chapas com grão ✓ · status chips: Parts/Door Type/Offset/Hinges/Grain/Groove/Sheet Size corretos, Spray/Groove off = vazio ✓ · grain on→`Longest side`, groove on→`Vertical · 100mm` ✓ · multi misto→vazio, multi Parts→`2 parts` ✓ · sem erros no console ✓ · screenshots light+dark (preview normal e zoom) conferidos ✓.

### Próxima leva — lógica proposta (partes 2, 6–10)
- **Seleção de chapas**: checkbox no header de cada sheet-card (espelha o checkbox de grupo/peça), estado `selSheets` separado da seleção de peças; chapas selecionadas ganham realce.
- **Sheet Size / Nesting nas selecionadas**: se há chapas selecionadas, a seção age só nelas (via `sheetSizeOv` que já existe por-chapa); se nenhuma selecionada, cai pro default do job. **Não recria chapas**: se o novo tamanho não comporta as peças, avisa/re-packa com segurança, nunca perde peça.
- **Custom size pra job novo (parte 10)**: um "default sheet size" por material/job (inclui custom) aplicado a chapas novas; chapas existentes selecionadas ainda mudam individualmente. (A confirmar com o user antes de codar.)
- **Edit mode no zoom (parte 2)**: painel de acordeão sobreposto dentro do zoom, ligado ao mesmo estado.

## 2026-07-04 (b) — Ajustes: parts no dark + alinhamento do menu View

- **Parts/groups mantêm a distinção visual no dark** (pedido do user). Antes o item usava `cor+'10'` (wash 6%), que sobre o fundo escuro sumia e os itens ficavam "flat". Agora, **no dark** o item usa **base opaca (card) + tinta de material ~15%** (`linear-gradient(cor26,cor26), var(--card)`), mantendo a **barra lateral colorida de 4px** e a legibilidade. **No light nada muda** (continua o wash 6% sobre branco que o user gosta). Cores ajustadas pro escuro, não copiadas. Os **group bars** já eram cor sólida vívida (ok nos 2 temas).
- `applyTheme()` agora **re-renderiza** ao trocar de tema, pra tinta dos itens ser recalculada na hora (antes só atualizava no próximo render).
- **Menu View — ícone duplicado + desalinhamento corrigidos**: "Hide values" recebia um ícone (eye) **injetado por cima** do checkbox ☐ → dois ícones lado a lado. Agora os toggles usam `.dchk` (slot fixo de 15px, igual ao ícone) e o injetor **pula itens com `.dchk`**. Resultado: em todos os itens do menu o texto começa no mesmo x (medido: leads de 15px, borda direita idêntica em x=208).

### Testado (b)
Menu View: "Hide values" sem ícone duplo (hasIcon=false, hasChk=true), "DXF Templates" mantém ícone, texto alinhado (15px / x=208) ✓ · item no dark = gradiente 15% sobre card #161d27 + borda 4px da cor do material ✓ · item no light inalterado (rgba .063 sobre branco) ✓ · toggle re-renderiza ✓ · sem erros no console ✓. (Screenshot da ferramenta travou de novo nesta sessão — verificado por DOM/computed styles.)

## 2026-07-04 — Dark mode + mais contraste no acordeão

- **Mais contraste entre as seções do painel** (a queixa: "muito claro, quase não vejo onde estou"). Cada header do acordeão agora é uma **barra cinza** com **divisória mais forte** (`--line-strong` #cbd5e1); a seção **aberta** ganha **tinta azul + acento de 3px na borda esquerda + título/seta em azul**. Dá pra ver exatamente onde cada seção começa e termina.
- **Dark mode** (toggle em **View → Dark mode**, com ☐/☑). Tema por **variáveis CSS**: `:root` ganhou vars semânticas (`--surface --chip --input --head --head-open --line-strong --blue-border --shadow`) e um bloco `body.dark` que as inverte + regras direcionadas pras superfícies hardcoded (topbar, menus, cards, itens, inputs/selects via blanket, matbar/client-bar/nest, chips, botões, abas, editor, zoom).
- **Persistência**: a escolha fica no `localStorage` (`kab_theme`) e é **restaurada no load** (não vai no `.fastcnc` — é preferência de UI, não do job).
- As **chapas do nesting continuam brancas** (papel) no dark — padrão "UI escura, tela clara", mais legível pras peças/labels; o color-coding por material dos itens continua funcionando (borda + wash da cor).

### Testado
Toggle aplica classe + glyph + localStorage + inverte `--bg/--ink` ✓ · 9 seções renderizam nos 2 temas ✓ · contraste header fechado/aberto/divisória medido (light #eaeff6 / #dbe9ff / #cbd5e1; dark escuro equivalente) ✓ · topbar/card/inputs/matbar/client-bar escurecem no dark ✓ · texto legível (ink claro) ✓ · sem erros no console ✓ · screenshots dos 2 temas conferidos ✓.

## 2026-07-03 (d) — Painel de edição vertical (acordeão) + Groove/LED + zoom-nav

- **Painel esquerdo virou acordeão vertical** (adeus tabs horizontais): seções colapsáveis, uma embaixo da outra, na ordem exata — **Parts · Door Type · Offset · Hinges · Spray · Grain · Groove · Nesting · Sheet Layout**. Cada header abre/fecha; lembra o que está aberto.
- **Door Type**: os 4 botões de tipo (Flat/Traditional/Flushback/Reeded — nomes mantidos; "Rabbeted" = Reeded) + **presets salvos como chips clicáveis**.
- **"Door set" renomeado para "Offset"**.
- **Grain** virou seção própria (Off · ↔ Longest · ↕ Shortest), fora de Parts.
- **Presets de frame+offset**: o ＋ Save agora guarda **frame + linhas + pocket side**; aparecem em Door Type e Offset; **persistem no `.fastcnc`** (`kabacalQuote.profiles`); dá pra apagar (✕).
- **Nesting** (margem/gap) e **Sheet Layout** (tamanho da chapa + custom) **movidos pro painel esquerdo** (tag "whole job", sempre disponíveis mesmo sem peça selecionada); o card do meio saiu.
- **Groove (novo)**: liga/desliga, direção Horizontal/Vertical, **spacing-alvo (default 10mm)** que encaixa nas bordas — `n=round(L/t)` vãos, primeira e última linha tocam as bordas (ex.: 500/105 → 6 linhas de 100mm). Desenha na chapa (roxo) e no DXF (layer **GROOVE**).
- **LED Channel** dentro do Groove: um **retângulo** de largura editável (**default 4mm**) começando na posição escolhida, atravessando a peça inteira na direção do groove (preview âmbar + DXF layer **LED_CHANNEL**).
- **Zoom — navegação entre chapas**: **◀ ▶** no cabeçalho + **← →** do teclado + **Esc** pra fechar, com contador "n / total" e fit automático a cada troca.

### Testado (22 checagens)
Ordem das 9 seções ✓ · tabs antigas e card de chapa fora ✓ · groove 500/105 = [0,100,200,300,400,500] ✓ · linhas roxas + retângulo LED no preview ✓ · DXF GROOVE + LED_CHANNEL ✓ · preset vira chip no Door Type ✓ · zoom next/prev/setas/Esc ✓ · save→load restaura groove e preset ✓ · sem erros no console ✓.

### Pendente
Groove/LED não entram no preço (via Extra processes por enquanto); groove pensado pra painel flat (funciona em qualquer tipo, mas cruza o frame em portas).

## 2026-07-03 (c) — Glass / Beading (portado da produção)

- **Porta de vidro**: a palavra **GLASS** no texto da peça (atalho: digitar só `G` vira `Glass`) transforma a porta com frame (Traditional/Flushback/Reeded) em **glass frame** — **não gera insert**; gera uma **peça de beading** (moldura) em bloco fino.
- **Receita (verificada na fonte)**: beading = cavidade + **19.85mm** por lado · espessura **3mm** (default) ou 6mm, mesmo material da porta · fit gap **0.15mm** (guia = 20.0mm) · **round corners ON** por default. Texto: "Glass Beading 19.85mm".
- **DXF**: porta de vidro = só 3 linhas — OUT + **INSIDE** (cavidade) + **BEADING** (rebate a 20mm, arredondado 2.5 quando round); peça de beading = OUT arredondado + INSIDE (abertura do vidro) + BEADING 0.15mm FORA do contorno (folga de corte). Layers em MAIÚSCULAS, como manda a regra; sai um arquivo DXF `3mm` próprio.
- **Editável por item** no Door set (card GLASS): size, espessura 3/6, fit gap, round corners; persiste no `.fastcnc` (`kabBeading`) e propaga no multi-edit.
- Checklist ganha linhas `Beading` (o parse de volta pula — regeneram do texto Glass); preview mostra INSIDE azul + guia âmbar na porta e a moldura na chapa fina; preços 3mm adicionados (MDF 15 / MR MDF 25).

### Testado (12 checagens)
g→Glass ✓ · insert some ✓ · beading cavidade+39.7 e guia 20.0 exatos ✓ · nesta no grupo 3mm ✓ · DXF 18mm com INSIDE/BEADING + arquivo 3mm ✓ · checklist/parse ✓ · card GLASS ✓ · sem erros no console ✓.

## 2026-07-03 (b) — Persistência do orçamento, woodgrain, preço por chapa

- **`.fastcnc` agora carrega o lado do orçamento** (`kabacalQuote`): horas de serviços, machining por material (Extra/Time/Disc%), spray add-ons, VAT on/off, board margin e overrides de preço por chapa. Salvar → reabrir → orçamento igual. Undo (Ctrl+Z) também restaura esse estado. Arquivos antigos continuam abrindo.
- **Override de preço por chapa individual** (regra da produção): chip `£55 · CNC £85` no header de cada chapa; clicar pede Material £ e CNC £ só daquela chapa (vazio = auto; igual ao auto = não grava). Chip fica âmbar com ✱ quando tem override. Vale no resumo, no Quote e no PDF. Overrides limpam sozinhos quando o conjunto de peças muda (o nesting reflui) e sobrevivem a save/load.
- **Textura woodgrain** nas chapas que contêm peça com grain travado (regra da produção) — linhas horizontais sutis, some quando não há grain.

### Testado
5 chips renderizando · override {99/70} muda totais + marca ✱ + entra no calcQuote ✓ · doc salva kabacalQuote completo e load restaura services/spray/VAT/overrides ✓ · woodgrain presente só com grain ✓ · sem erros no console ✓.

## 2026-07-03 — Layout v3: Order Entry × Quote separados

- **Duas vistas de verdade** (troca por tabs, sem modal): **Order entry** (padrão) só para peças; **Quote** (ex-"Calculate", renomeado) com: faixa do cliente (Client/Phone/Email/Order#/Date/Notes), card Material pricing + Pricing settings, card Order summary e o corpo do orçamento (tabela por material, serviços, spray, VAT, totais, Print/Save PDF, Cut list). Se houver peça inválida, a vista Quote mostra banner em vez de alert.
- **Smart Takeoff embutido** no topo do Order entry (abaixo de "New order"): textarea compacto que cresce ao focar, aceita colar texto/checklist e **arrastar .dxf/.txt/imagem** (OCR), botões Add parts + 📷 OCR. **Tab Takeoff removida** (decisão do Ednei); o modal antigo foi apagado.
- **Linha de add**: Frame afastado do Width/Height com divisor visual — `Material · Part Type · Frame ┃ Width · Height · Qty · Text`.
- **Removidos**: legenda de tipos (Flat/Traditional/…), botão duplicar da linha (qty +/− cobre), links "→ group/all" do painel (a edição segue a SELEÇÃO: 1 ou várias via multi-edit), card **Offset profiles** da topstrip (o seletor Profile + ＋ Save dentro do Door set CONTINUA — nada de produção quebrou; funções ficam dormentes com guarda), label "Quick material:" e link 🎨 Material colours da barra (segue em Edit → Material colours…).
- **Doors/Panelling** subiram pro topbar ao lado do DXF; **Doors é o default** (Panelling abre o app externo).
- **Lixeira no header do grupo** (barra colorida, extremo direito): confirma citando linhas E peças ("Delete the group \"X\" and its 3 lines (5 parts)?"), não recolhe o grupo ao clicar, Ctrl+Z desfaz.

### Testado (22 checagens ao vivo)
Vista inicial Order/Quote ✓ · tabs novas ✓ · cliente/pricing/summary dentro da Quote ✓ · quote renderiza tabela+totais+botões ✓ · takeoff inline adiciona (2×500×300 → qty 2) ✓ · legenda/label/link/duplicar/group-all fora ✓ · divisor no add ✓ · mode no topbar ✓ · lixeira de grupo: cancela mantém, confirma apaga, mensagem cita contagens ✓ · profiles do Door set intactos ✓ · sem erros no console ✓.

## 2026-07-02 (c) — Painel de edição v2, Back Sheets, hinges individuais, inserts editáveis

Commits: `ff87189` (fase 1) · `9496d77` (fase 2) · `0d8fe4a` (fase 3) · fase 4 no commit desta entrada.

- **Part type** (ex-"Shaker type"): seletor fixo de 4 botões-ícone no topo do painel (Flat · Traditional · Flushback · Reeded — sem o prefixo "Insert"); checklists antigos com os nomes velhos ainda importam.
- **Painel limpo**: Material virou chip colorido clicável (abre o picker de grupo); Quantity só na lista; "Rigid (grain)" virou **Grain** com 3 estados: Off · **Longest side** · **Shortest side** ('short' deita o lado curto ao longo da chapa; nunca gira no nesting/DXF). `.fastcnc` ganha `grainAxis`; checklist escreve/lê `long|short`.
- **Tab "Door set"** (ex "Frame & offset") com cartão do **insert gerado editável**: material (default MR MDF — regra do Ednei; produção herda o material da porta) e espessura com override por item (`insOv`, persiste no `.fastcnc` como `kabInsOv`), reset volta pra receita.
- **Receita dos inserts VERIFICADA na fonte da produção**: Traditional → 9mm (porta 18) / 12mm (22), overlay 12/lado (=+24); Flushback/Reeded → 12/15mm, overlay 14/lado (=+28); tamanho = cavidade + overlay. Kabacal batia; agora documentado no código.
- **Back Sheets**: Pocket Front+Back gera cartão **BACK SHEET** vermelho pareado logo abaixo da chapa da frente (espelhado em X, frame L/R trocado, sem hinges, marca d'água BACK, "machining only, no material charged"); fora da contagem/preço; toggle em **View → Show back sheets**; DXF exporta a folha extra "SHEET N BACK — MACHINING ONLY" mantendo os part numbers da frente.
- **Hinges individuais**: modo Auto (side/count/offset) + **Customize positions** → lista editável por dobradiça (mm da ponta, remover, "+ Add hinge" no maior vão, "Back to auto"); diagrama, preview, DXF e checklist (`side @[p1;p2;…]`) acompanham; posições persistem no `.fastcnc` (`kabHingeCustom`) e voltam pelo Smart Takeoff.
- **Spray**: conferido, sem mudanças (já tinha lados + perfil + preço).

### Testado
Grain long/short no packer e checklist ✓ · painel sem Material/Qty, 4 botões de tipo, chip, tabs novos ✓ · back card pareado, contagem/preço intactos, espelho X, DXF BACK, toggle ✓ · hinges: auto [100,500,900] → set/add/del → DXF/checklist/parse ✓ · receita insert + override Birch Ply 12mm nesta no grupo certo + reset ✓ · sem erros no console ✓.

### Pendências conhecidas (comparação com a produção)
Hinge top/bottom · shapes sloped/loft · Beading/Glass (G+Enter) · templates DXF como tipos reais · woodgrain na sheet · override de preço por sheet individual · posições custom de hinge em peça rotacionada usam o lado longo como referência (validar num job real).

## 2026-07-02 (b) — Regras de preço da produção + visual "app final" + OCR + Spray labels

### Feito

- **Banner "VISUAL MOCKUP" removido** — o app é tratado como utilizável.
- **Regras de preço (paridade com o CNC Calculator):**
  - Preço exato especial: `MDF`/`Standard MDF` 18mm em sheet `10x4` = **£75** (outros tamanhos seguem escala por área).
  - CNC por família: Birch/plywood `≤12mm=65 · 15/18mm=95 · 24mm=100`; MDF `18/22mm=85`, `≤12=65`, `15=95`, `25/30=120`.
  - **Spray agora entra na quote**: perfis £/m² da produção (End Panels 50 · Plastic Edge 45 · Shaker 65 · Cock Bead 75 · V Groove 55 · Profiled 75 · Profiled+CB 85 · Fluted 140), área por regra (flat sem frame = face + 4 bordas×espessura; framed/shaker = 10 lados + insert frente+verso), add-ons (Additional Squares +10%, High Gloss £100/m², Gun Gloss £50/m², Extra Prep editável). Perfil escolhido por peça no tab Spray. Spray não entra na base do desconto por grupo. Aparece no Calculate e no PDF.
  - Já existiam e continuam: pocket/reeded por área (1m²=12min, rampa 10→20/40%), drilling +5% (hinges ligam), extra +10% cada, time £250/h·sheet, desconto %, serviços 35/25/50, VAT 20%.
- **Grupos com cor viva**: header da lista agora é uma barra SÓLIDA na cor do material (texto branco); linhas com borda 4px + fundo tingido. Cores personalizáveis em Edit → Material colours….
- **Ícones SVG profissionais** (embutidos, sem dependência): menus File/Edit/View/Print/Checklist, botões do topo, ações da lista (editar/duplicar/apagar/separar), FAB e satélites, toolbar do nesting, modal do checklist.
- **OCR no Smart Takeoff**: soltar/escolher uma imagem lê o texto com tesseract.js (carregado do CDN só quando usado); o texto cai no textarea pra revisar e "Add parts". Sem internet → mensagem de erro clara.
- **Print Spray Labels** no menu Print (depois de A4 Labels): layout da produção (400×300, setas nos lados marcados, QR com `SF<lados>`), só imprime com spray ligado e lados marcados.

### Testado

- £75 exato (10x4 MDF 18mm) ✓ · Birch 24=100 / MDF 18=85 / Birch Ply 12=65 ✓
- Spray: peça 1000×600 com pocket = 1.308 m² → £85 Shaker, entra no subtotal e no PDF ✓
- 20 ícones nos menus + 27 na lista + FAB ✓ · header de grupo sólido (rgb vivo) ✓ · banner ausente ✓
- Menu Print: Save PDF → Labels Map → CNC → A4 → Spray → Cut list ✓ · gate do spray (sem lados = não imprime) ✓ · sem erros no console ✓

### Pendente

- `sprayAddons`/perfis não persistem no `.fastcnc` ainda (sessão só).
- OCR: qualidade depende da foto; testar com listas reais do usuário.
- Validar visual das barras/ícones com o usuário (screenshot tool do preview instável nesta sessão).

## 2026-07-02 — Checklist + Print menu (adaptados do CNC Calculator)

Commit: `78e3e80` (feature) — referência usada: `Cnc Calculator UI Test.html` (somente leitura; nenhum arquivo do CNC Calculator foi alterado).

### O que foi copiado/adaptado

- **Checklist → Create Checklist**: TSV rico (1 linha por peça física) com
  `Part, Qty, Width, Height, Thickness, Material, Type, Sheet, Text, Frame, Offset, Hinges, Grain, Copy`
  + cabeçalho (cliente, order, data, total de peças, total de sheets). Botões: Copy, Download `.txt`,
  Download `.fastcnc-checklist.json` (payload pro app de QR/checklist, com `qrPayload` por peça — mesmo
  modelo uid/matchKey da produção, `type:'fastcnc-checklist'`).
- **Smart Takeoff lê o checklist de volta**: colar o texto do checklist no Takeoff recria as peças
  (agrega linhas iguais em qty; recupera material, tipo de porta, frame, hinges, perfil de offset e grain).
  Linhas `Insert` são puladas de propósito — os inserts regeneram sozinhos a partir do tipo de porta.
- **Menu Print** (ordem exata): `Save PDF` → `Print Labels Map` → `Print CNC Labels` → `Print A4 Labels`
  → (separador) → `Cut list`.
- **Motor de labels portado da produção**: encoder QR (versão 4, EC L, mask 0), payload QR compacto (≤72 bytes),
  CNC label 40×30 mm (SVG, texto auto-ajustável, QR opcional que some quando rouba espaço), Labels Map
  (A4 paisagem, nesting real, número global no canto, QR perto do número, texto horizontal/vertical pelo
  lado maior da peça), A4 Labels (grade uniforme legível, máx. ~1/4 de página por label).
- **Números globais**: os part numbers das labels/checklist são os MESMOS `pnum` do preview de nesting e do DXF.

### O que funciona / foi testado (na amostra de 9 itens + 3 inserts = 12 peças)

- Create Checklist abre o modal com o TSV completo (inclui thickness `18mm`, material, tipo, frame `50`,
  offset `Shaker`, hinges `auto auto @100`) ✓
- Round-trip: checklist → colar no Smart Takeoff → **9 itens de volta, tipos de porta preservados
  (flat/trad/flush/reeded), nesting regenera as mesmas 12 peças** ✓
- Save PDF (janela de quote com Print/Save as PDF) gera HTML válido ✓
- Print Labels Map: 5 páginas (1 por sheet), sem `undefined`/`NaN`, QRs presentes ✓
- Print CNC Labels: 12 labels 40×30 com QR ✓
- Print A4 Labels: grade por sheet com QR ✓
- Ordem do menu Print correta ✓ · Sem erros no console ✓

### Intencionalmente NÃO incluído (por pedido)

- Print Label Tests · Print Spray Labels · Panels Only (nenhum aparece no menu)
- View e Edit: sem mudanças
- Track B / Supabase / Stripe / login / assinaturas / banco / analytics / legal / SaaS: não tocado

### Pendente para depois

- Spray Labels (quando o spray tiver lados marcados no Kabacal)
- Label Tests (calibração de impressora) e tamanho/rotação de label configuráveis (hoje fixo 40×30, 0°, 0.92)
- Logo FAST CNC bitmap nas labels (produção usa; Kabacal usa texto `www.fastcnc.co.uk`)
- Master QR do job (o `.json` do checklist já cobre o app de QR; o QR master desenhado na tela fica pra depois)
- Impressão real em papel/etiquetadora — validar tamanhos com o hardware
- FSC: hoje só detecta `FSC` no nome do material

### Backlog anterior (continua)

- Offcut: validar com job real (sheets 6/7/11/12/13), chanfro em L na quina, "juntar melhor" no dia a dia
- Peças finas (<120 mm) no miolo: versão forte se o desempate leve não bastar
- Toolpaths (aba `soon`)
