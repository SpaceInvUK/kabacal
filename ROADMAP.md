# Kabacal — Roadmap / Status

App: `index.html` · Publicado: https://spaceinvuk.github.io/kabacal/ · Repo: `SpaceInvUK/kabacal`

## 2026-07-08 (g) — Construtor 2D Fase 2: matemática de canto por espessura, locks, keep-90°, arrastar aberturas, painel visível

Zonas guardadas: Panels geometry + save/load + **matemática que altera dimensão física do painel em cantos** (só para salas COM `plan`). Prova: **8 goldens byte-idênticos** (nenhum golden usa plan/canto) + testes executados novos travando a aritmética exata (22 e 18mm) até as peças. Sem golden binário novo: a aritmética de canto fica travada por asserts exatos em mm no check.mjs (mais forte que um DXF binário para verificar os números); o writer de DXF de painéis já é coberto pelo GOLDEN_PANELS.

- **Inferência de canto**: no nó compartilhado a parede MAIOR passa reto (through); a MENOR encosta (butt) — empate → a desenhada antes passa. Ponta livre = normal.
- **Encurtamento físico (dirigido pela espessura, nunca 22 fixo)**: ponta butt encurta a largura compilada `wall.w` pela espessura real do painel `pt` (=`plan.panelLayer.thickness`); butt nas duas pontas → −2·pt. U base 2000: pt22→1956, pt18→1964.
- **Allowance interno (cálculo separado)**: ponta butt usa a regra de lado `corner` → `pnSideMM` = `frame + cornerTh`, `cornerTh` = espessura do painel do plan (`pnRoomDefs`). frame80+pt22=102, +pt18=98. **Sala sem plan: `cornerTh===espessura do material` → pnSideMM byte-idêntico (goldens intactos).**
- **Locks de ponta** (`node.lock`): ponta travada não move; editar comprimento move a ponta livre (ou bloqueia com aviso se ambas travadas); arrastar nó travado é recusado com aviso. Salva no plan.
- **Keep 90° square** (`plan.keepSquare`, ON): editar comprimento / arrastar canto translada as pontas distantes dos vizinhos axis-aligned pelo mesmo delta (um salto) → vizinhos ortogonais continuam quadrados; pontas travadas ficam. Limite: um salto só.
- **Arrastar aberturas**: door/window/object arrastam ao longo da parede (offset snap 10mm, clamp); compila em `wall.openings`.
- **Painel mais visível**: parede cinza (estrutura) vs painel TEAL sólido com contorno forte + linha central clara, na frente (lado interno), com legenda. Não parece mais sombra da parede.
- **Explicação dinâmica** no inspector da parede: "measured 2000 → panel 1956 (panel 22 · frame 80) / Start: butts −22mm · allowance 102 / End: through".
- Fase 3 (deferido): objetos coluna/return completos, constraint solving multi-salto, escolha through/butt editável por canto.
- Fix de QA: `pnPlanSetPanelT` agora recompila (a espessura do painel dirige o corte de canto — antes só mudava o preview).

### Testado (g)

`node tools/check.mjs` ok (+ testes de canto: U 22→1956/18→1964, allowance 102/98, L butt 2978, largura chega às peças 1964, cornerTh fallback) ✓ · **8 goldens byte-idênticos** (NC ll/c, DXF standard/rich/panels, QUOTE_standard/rich/mixed) ✓ · U no builder: base 1956 (pt22)/1964 (pt18), allowance 102/98, laterais 3000 through ✓ · explicação "butts −22 · allowance 98" no inspector ✓ · lock: ambas travadas bloqueia + mantém 3000; A travada → cresce por B pra 3500 ✓ · keep-square: editar Wall1 4000→4600 mantém Wall2 vertical (c translada +600) ✓ · arrastar porta muda offset e compila ✓ · painel teal + parede cinza + legenda ✓ · save/load preserva locks/keepSquare/plan/openings ✓ · sala manual sem plan intacta, Doors intacto ✓ · console limpo ✓.

## 2026-07-08 (f) — Construtor 2D top-down de salas/paredes (Beta, Fase 1) que COMPILA nas paredes atuais

Aprovado pelo Ednei. SVG top-down (nada de 3D/Three.js — performance). O plano desenhado é a FONTE; `room.walls` é DERIVADO → o motor/quote/DXF atuais continuam iguais. Zona guardada: Panels geometry/save-load (aditivo). Prova: **8 goldens byte-idênticos** (nenhum golden usa `room.plan` → caminho antigo intacto).

- **Modelo (aditivo)**: `room.plan = {nodes[{id,x,y}], edges[{id,a,b,wallThickness,height}], openings[{id,edgeId,type,offset,width,height,bottom}], objects[…], panelLayer{thickness:22,side}}`, tudo em mm. `pnPlanCompile(room)` (PURO, dentro do PN_ENGINE, node-testado): 1 parede por edge (id `pe_<edgeId>`, largura = comprimento, altura = edge.height||3200), **preserva** dir/sides/skirt/notes/panelOv/vZones/openings-do-inspector por id ao recompilar; openings/objects do plano compilam em `wall.openings` (ids `plan_`). **Sem `plan` → walls intactas** (salas manuais e goldens idênticos).
- **Builder UI (`pnView='plan'`)**: entradas "▦ draw" (tab), "▦ Draw a room" (vazio), "▦ 2D Builder" (sala existente). Ferramentas Draw (arrastar cria parede 150mm, snap em cantos/ortho, comprimento arredonda 10mm, encadeia pelo endpoint) · Select (arrastar canto move as paredes que o compartilham; clicar parede edita comprimento/espessura/altura + add door/window/object) · Pan (roda = zoom sempre, ⤢ = fit). Parede desenhada como retângulo (150mm) + **camada de painel 22mm** em azul na frente (interior); cota de comprimento em mm, nome "Wall N", cantos visíveis. Door = folha + arco de abertura; Window = moldura + linha central; Object = retângulo tracejado — todos com rótulo de tamanho.
- **Compat**: pnView reseta pra 'wall' ao criar/selecionar sala manual (bug pego no QA: pnView='plan' vazava e carimbava um plano vazio numa sala manual). Save/load leva `plan` + walls derivadas; arquivos antigos sem plan carregam igual. Doors intacto.
- **Fase 2 (planejado)**: arrastar/editar openings direto no desenho, inferência de canto/coluna; **Fase 3**: preview 2.5D/3D opcional (só visual, nunca muda geometria de produção).
- check.mjs: `pnPlanCompile` exportado + testes (1 parede 3000×3200, 3 paredes conectadas 4000/3000/4000, preserva settings por id, opening compila, sem-plano = mesma ref).

### Testado (f)

`node tools/check.mjs` ok (+ testes do compilePlan) ✓ · **8 goldens byte-idênticos** (NC ll/c, DXF standard/rich/panels, QUOTE_standard/rich/mixed) ✓ · desenhar 3 paredes conectadas → compila 3 walls (pe_e1/2/3, 4000/3000/4000, h3200) que o motor consome (6 peças, "Room 1 Wall 1A") e o quote calcula (£1945/5 chapas) ✓ · SVG: 3 wall polys, 6 cantos, cotas 4000/3000mm, camada de painel azul, grid, nomes ✓ · add door → símbolo com arco de abertura + compila em wall.openings ✓ · editar comprimento 4600 move o nó ✓ · draw via mouseup real commita parede (2500mm) ✓ · save/load preserva plan(3 edges)+walls(3) e recompila ✓ · sala manual continua sem plan, 2 peças, e criar manual a partir do builder volta pra Wall view ✓ · console limpo ✓ · (screenshot do preview ainda trava no ambiente — verificação por eval/a11y).

## 2026-07-08 (e) — Quote notes (cliente) + PAINEL FÍSICO VERTICAL de verdade (mixed orientation via zones)

Dois itens confirmados pelo Ednei. O room/wall-builder 3D fica só como plano (resposta ao Ednei / STATUS). Zonas guardadas tocadas: **Panels geometry + DXF + nesting + quote** (por causa do painel vertical) e **print doc** (quote notes). Prova: **todos os 8 goldens byte-idênticos** (nenhum job de golden usa zone nem quoteNotes → caminho antigo intacto).

- **Quote notes (cliente)**: `project.quoteNotes` — textarea na aba Quote ("shown to the customer on the quote / PDF"); sai no PDF do cliente (`quoteNotes || notes`, fallback pro campo antigo). Notas internas de parede/painel continuam SÓ no editor de Panels, nunca no PDF do cliente. Persiste no `.fastcnc` (kabacal meta).
- **Painel físico vertical (a regra real, confirmada)**: selecionar um painel → Orientation = Vertical cria `wall.vZones[{id,x,w≤1200,h≤3000,cols,rows}]` = painel FÍSICO vertical em pé na chapa 10x4 (não só troca estilo de shaker). `pnWallSpans` trata a zona como parada dura 40/40 → a banda horizontal **auto-preenche** os vãos dos dois lados; outros painéis seguem horizontais; vários verticais na mesma parede OK. PANEL SETTINGS da zona: Width (≤1200) / Height (≤3000) / Columns / Rows editáveis + "Back to horizontal" remove. Nomeação/vn/pid (`vz{id}`), nesting, DXF (`PANELS_<esp>`), quote e save/load fluem por serem só mais uma peça. `panelOv.dir` (estilo de shaker, motor de 83ebf1e) fica no motor + teste, mas saiu da UI — orientação agora é FÍSICA.
- check.mjs: testes executados novos — zone 1200×3000 10x4 + joints 40/40 + banda dos dois lados + clamp 1600→1200/3500→3000 + `vZones:[]` == sem-zona (segurança byte-idêntica); notas do quote não mexem em geometria/preço (quote goldens idênticos).

### Testado (e)

`node tools/check.mjs` ok (+ testes de zone e quote-notes) ✓ · **8 goldens byte-idênticos**: NC ll/c, DXF standard/rich/panels, QUOTE_standard/rich/mixed — todos OK ✓ · quote note aparece no PDF, nota interna de parede NÃO aparece, precedência quoteNotes>notes, round-trip persiste ✓ · painel vertical: parede 5000 → seleciono painel B → vira 1200×3000 vertical 10x4 (joints 40/40, 6 células 2×3), A/C horizontais dos dois lados, seleção vai pra zona, inspector "VERTICAL PANEL (physical)" com Width/Height editáveis ✓ · editar largura→1000, DXF inclui "Wall 1B" (3 OUT), quote 3 chapas/3 peças, save/load preserva (w1000/h3000/dir v), 2 verticais na mesma parede, "back to horizontal" remove ✓ · console limpo ✓ · (screenshot do preview ainda trava no ambiente — verificação por eval/a11y).

Correções práticas do teste do Ednei (o 3D/wall-builder fica só como REVIEW de arquitetura, sem código — ver STATUS / resposta ao Ednei). Zona guardada tocada: **Panels geometry + DXF** (por causa do skirting mudar a cavidade) e **import**. Prova: todos os goldens byte-idênticos (nenhum override = caminho antigo intacto).

- **Skirting por parede**: `wall.skirt={mode:'custom',on,h}` sobrepõe o default do room; resolvido em `D.skirtFor(wi,pid)` (panel>wall>room). Inspector da parede: seção "Skirting (this wall)" com fonte (Room default | Custom) + Enabled + Height + badge do valor resolvido ("now: skirting 150mm · from THIS wall"). Guia tracejada do preview mostra "(wall)" quando é override. **Per-panel preparado** (`wall.panelSkirt[pid]`, mesma forma, sem UI).
- **Import do skirting corrigido**: o app antigo guarda skirting no bloco E por part/parede (`panelSkirtingEnabledForPart`/`HeightForPart`, part ganha; `305`→`225`). `pnImportLegacy` agora reproduz: room = default do bloco, e cada parede que difere ganha `wall.skirt`. Antes o skirting por parede era descartado.
- **Notas**: `wall.notes[]` (várias, add/edit/delete no WALL SETTINGS) + `wall.panelNotes[pid][]` (no PANEL SETTINGS). Não afetam geometria/preço; aditivas no `.fastcnc`.
- **Seleção wall×panel direta**: clicar o fundo da parede (`.pnbg`) seleciona a Parede (WALL SETTINGS); clicar um painel (`.pnk`) seleciona o Painel (PANEL SETTINGS). `pnPickWall` mantém o zoom; pan não dispara seleção.
- check.mjs: testes executados novos — skirting por parede (default 305; wall 150→230; off→80; parede sem override intacta) e notas não mudam geometria.
- **Orientação (nota de reconciliação)**: uma sessão paralela entregou orientação por painel via `panelOv.dir` (estilo de shaker: 1 fileira × grid) no commit 83ebf1e — NÃO é o "painel vira peça vertical 3000 física com auto-preenchimento" do pedido anterior. Minha tentativa vZones (conflitante, meio-feita) foi guardada no stash e NÃO usada. Item em aberto: confirmar com o Ednei qual comportamento de "Vertical" ele quer (ver resposta).

### Testado (d)

`node tools/check.mjs` ok (+ testes de skirting/notas executados) ✓ · **goldens byte-idênticos**: standard NC ll/c + DXF + QUOTE_standard, RICH DXF 18mm + QUOTE_rich (panels 0), **GOLDEN_PANELS_18mm.dxf** + QUOTE_mixed (£2390/£3665) — todos IDENTICAL ✓ · skirting por parede via UI: bandas 305/230/80 (default/150/off), override gravado, badge e guia "(wall)" corretos ✓ · import legacy: bloco Yes/220 + part 150 + part No + part 305→225 → room 220, overrides 150/off/225, bandas 300/230/80/305 ✓ · notas parede add/edit/delete + notas painel + round-trip `.fastcnc` preserva skirting e notas ✓ · seleção: fundo→WALL, painel→PANEL ✓ · doors-only £300/£360 panels 0 ✓ · console limpo ✓ · (screenshot do preview segue travando no ambiente — verificação por eval/a11y).

- **PANEL SETTINGS por painel** (itens 1–7): clicar num painel abre o card "PANEL SETTINGS — {nome}" com **Status AUTO/CUSTOM** (chip âmbar), **Width** read-only com explicação ("from joints" — largura é do otimizador/juntas, muda via wall), **Height editável** (clamp EXPLÍCITO no limite da chapa: nota "height clamped to 1206mm", nunca silencioso), **Orientation H/V POR PAINEL** (misturar horizontal e vertical na MESMA parede funciona — grade interna), **Columns/Rows** steppers, **Frame por painel** (grade interna; bordas de junta continuam 40/40), sides L/R, **↺ Reset to AUTO**. Wall & Room ficam nas seções abaixo (estrutura empilhada no inspector direito — mais segura que split left/right no canvas zero-scroll; separação clara mantida).
- **Engine** (`PN_ENGINE`, mesmo seam de overrides pós-slice): `panelOv[pid]` ganhou `h`/`dir`/`cols`/`rows`/`frame` — juntas/fatias NUNCA movem; caminho legado (count em painel v) preserva bandas originais; **sem override = caminho binário intocado** (golden PANELS byte-idêntico ✓). Persistência aditiva (panelOv já viaja no kab_panels/.fastcnc — round-trip provado). **Testes novos executados no check.mjs**: h=800 ✓, dir v 3×2=6 células/2 bandas ✓, vizinhos byte-intocados ✓, clamp com nota ✓.
- **Insert MDF 12mm explicado** (item 8, sem mudança de comportamento): é o INSERT auto-gerado que preenche a cavidade (flush = cavidade+13,95/lado, 12mm, MR MDF por regra do Ednei; NÃO é glass — glass o substitui); peça física real: nesta em chapa própria, conta no partN, sai no DXF da espessura, alvo dos toolpaths role insert, entra no preço. Card do Offset agora se explica (título "Insert (auto piece — fills the cavity)" + tooltip completo + "priced & machined").
- **Chapas não somem mais** (item 9 — causa: o filtro de ontem removia o card da chapa não marcada, impossibilitando marcar a 2ª): não-marcadas viram **header compacto com o checkbox** ("tick to preview"); Sheet 1, Sheet 2 ou AMBAS sempre a 1 clique.
- **Ops de template claras** (item 10): sufixo "(next op)" → **"(off — from template)"**; tag **OFF** cinza na árvore com tooltip ("ordem do template preservada — marque quando for cortar; OFF não gera NC"); alert do Auto agora diz "N LIVE, M loaded OFF" + explicação.
- **Simulate que se entende** (itens 11–12): **strip das chapas reais** do item no topo (mini-canvas do próprio renderer, com kerf/layers), **chip "NOW: op k/n — T# Ømm · side · depth · layer"**, e **fallback GENÉRICO** para peça sem template (perfil OUT com kerf real + aviso claro) — acabou o "retângulo marrom mudo".

### Testado (c)
Panel: h 900 só no painel do meio (vizinhos intactos, mixed ✓), v 3×2=6 células ✓, card+CUSTOM+width-hint no DOM (a11y snapshot conferido — screenshot tool travou de novo) ✓ · clamp 9999→1206 c/ nota ✓ · reset ✓ · kab_panels persiste ✓ · round-trip .fastcnc c/ override ✓ · toolpaths: 2 cards/2 checkboxes com 1 marcada (colapsada mantém checkbox) ✓ · OFF naming+tag ✓ · Simulate: strip Sheet 1/2 + NOW T1 Ø6mm + step ✓ · flat → GENERIC profile ✓ · **goldens ×4 byte-idênticos (NC ll · DXF · QUOTE_standard · PANELS)** ✓ · check.mjs ok c/ testes novos ✓ · console limpo ✓.

## 2026-07-08 (b) — Previews que se entendem: layers reais no Toolpaths, filtro por chapa, contexto no Simulate, cotas do Panels embaixo, H⇄V acessível (itens 5–7, 9–11)

- **Toolpaths desenha a GEOMETRIA da layer** (item 5): ops internas deixaram de ser anéis errados em volta do retângulo — `OFFSET_A` = banda cavidade→+7 (fill even-odd translúcido + 2 contornos), `POKET_INSERT` = banda 7→14, `SHADOW` = anel kerf na cavidade+16, `IN_22MM`/`OUT_10MM`/`IN` = a linha da cavidade com kerf real, insert `OFFSET_5MM` = banda 6.9→11.95 da borda — tudo **por abertura** (`doorCavities`, rot via transposição do mrEmit) e por `role`. `OUT` mantém kerf+skin+centreline. Peças nunca mais ficam "retângulo em branco": cavidades desenhadas tracejadas mesmo sem toolpath.
- **Canvas segue as chapas SELECIONADAS** (item 7): tick numa chapa → só ela aparece (chip "Showing N selected · Show all"); borda esquerda + dot na cor do material (`Edit → Material Colors`) ligam chapa↔material; cores por toolpath mantidas (pedido: manter a ideia das layers).
- **Simulate com contexto de chapa** (item 6, parcial-honesto): header novo "🛠 480×497 — body → Sheet 1 (MDF…) · insert → Sheet 2 (MR MDF 12mm) · kerf REAL". A rota por chapa com kerf real vive no canvas/zoom do Toolpaths; sim 3D de remoção segue fase futura (já anotado no rodapé do modal).
- **Panels: cotas embaixo** (itens 9+10): corrente de dimensões movida pro RODAPÉ da parede (início → juntas de painel → bordas de abertura → fim, com as LARGURAS de cada painel), "Wall width" também embaixo; texto de tamanho no CENTRO dos painéis removido — altura fica sutil no canto ("1030h"); altura da parede continua na direita. Viewer mais limpo, T reduzido 50→26.
- **Orientação H⇄V acessível** (item 11): o engine SEMPRE funcionou (2600 h→1 peça 2600×1030; v→3 colunas 867×3000) — o controle é que só aparecia com a Wall selecionada. Agora: botão **⇄ Horizontal/Vertical** na toolbar do Panels (age na parede selecionada) + linha "Wall direction" também no painel de PEÇA. Layout/nesting/quote/DXF seguem (mesmo `wall.dir` de sempre; PN_ENGINE intocado).

### Testado (b)
pnWallSvg: chain embaixo c/ larguras (1700/900 na parede com porta), "Wall width: 2600mm" no rodapé, centro limpo, "…h" no canto, screenshot ✓ · dir h→v→3 colunas 867×3000 e volta ✓ · toggle ⇄ na toolbar + Direction no painel de peça ✓ · tpSheetSvg: bands even-odd ×2, tooltips por layer (OFFSET_A/POKET_INSERT/SHADOW) na geometria da CAVIDADE, cavidades tracejadas ✓ · filtro: 2 chapas→1 selecionada + chip + stripes ✓ · Simulate header "body → Sheet 1 · insert → Sheet 2" ✓ · **goldens byte-idênticos (NC ll + NC c + DXF + QUOTE_standard)** ✓ · `check.mjs` ok ✓ · console limpo ✓ · screenshots Toolpaths + Panels conferidos.

## 2026-07-08 (a) — New Project + materiais ocultáveis + settings persistentes + fab bar no lugar + toolpaths STALE (itens 0–4, 8 do pedido de workflow)

Decisão Architect+CTO (item 0): New Project SOZINHO não cura orçamento errado — o mal é INCLUSÃO SILENCIOSA de Panels persistidos. Entregue em 3 peças: reset explícito + visibilidade no Quote + limpeza explícita.

- **✚ New Project** (botão no header): confirma → oferece salvar `.fastcnc` → limpa o JOB (Doors, Panels+`kab_panels`, toolpaths+seq, seleções, serviços/spray/machine, overrides por chapa, undo, meta do projeto → número novo) e abre em Doors. **Mantém** settings globais: price book/overrides, custom+hidden mats, rates, empresa, toolDb, templates, favs, tema, `camJob`.
- **Banner âmbar no Quote** quando Panels entra no total ("INCLUDES Wall Panelling — N rooms · £X") com "Review panels" e "Remove from this quote…" (confirmado); **🗑 Clear all** também na toolbar do Panels (`pnClearAllRooms`).
- **Materiais ocultáveis** (item 1): built-ins não podem ser apagados (carregam regras de produção) mas ganham 🚫 **Hide** — somem de TODOS os pickers (order entry, quick mats, group picker) mas `PRICES`/regras/jobs antigos continuam funcionando (mat em uso continua aparecendo no próprio seletor). Seção "Hidden materials" com ↩ restore no Price Settings. Chave nova `kab_hidden_mats`; custom mats seguem com ✕ delete.
- **Settings persistem de verdade** (item 2): presets de offset (`profiles`) agora têm chave própria `kab_profiles` (boot-load, save em new/saveAs/del/import/load-job); `importSettings` grava TUDO no localStorage (incl. hiddenMats) — carregou uma vez, fica. Export vira `ver:2` com `hiddenMats`.
- **Fab bar só no contexto certo** (item 3): a barra flutuante de seleção só aparece em Doors + Order entry (`renderSelBar` gate + hook no `setView`). Some no Quote/Toolpaths/Panels.
- **Toolpaths com ciclo de vida** (item 4): todo path com escopo ganha `sig` (assinatura dos itens de origem em `tpCalc`/`tplApply`); `tpPathParts` (CAM_ENGINE, filtro-só-filtra §7 do contract) corta **NADA** se a assinatura mudou — deletar/redimensionar/split da peça de origem nunca mais retarget silencioso (fecha o risco #2 do STATUS pela metade boa). Árvore mostra **STALE** âmbar + "Remove stale" (`tpClearStale`); `loadFastCnc` agora SEMPRE zera `camPaths` antes de restaurar os do arquivo (arquivo sem cam = árvore limpa).

### Testado (a) — browser + goldens
hide Marine Ply 12mm → some do picker, £120 intacto, persiste no reload, item em uso continua selecionável ✓ · profile `MyTest` sobrevive reload ✓ · fab: order✓ quote✗ volta✓ · flushback+template → del(0) → **7 STALE, 0 moves na chapa** (nada corta a peça errada), banner na árvore ✓ · `loadFastCnc({blocks:[]})` → árvore vazia ✓ · panels £810 → banner no Quote ✓ → clear → 0 rooms/`[]`/panels.total 0 ✓ · New Project limpa job (items/rooms/cam/services), Doors/order, número novo, MANTÉM hidden+profiles ✓ · **goldens byte-idênticos: QUOTE_standard + NC ll + DXF 18mm** ✓ · `tools/check.mjs` ok (engines executados) ✓ · console limpo ✓.

## 2026-07-07 (n) — Fases 3+4: contracts em docs/ + engines testáveis em node (6 comentários no app, zero comportamento)

Sistema de handoff completo pra qualquer modelo + preparação modular.

- **Fase 3 — a verdade saiu do `.claude/`**: `docs/CONTRACT-CAM.md` (máquina/portrait/tpXform, formato NC, padrão de corte, checklist de segurança — promovido do cam-reviewer), `docs/CONTRACT-DXF.md` (tabela completa das 26 layers com cores + consumidores/gadgets + convenções), `docs/PRICING.md` (os 6 mecanismos em ordem de resolução, fórmula do site com proveniência do estudo 2026-07-01, regras que sobrevivem a qualquer refactor, gap dos baskets anotado), `docs/ARCHITECTURE.md` (registro de estado por grupo, 17 chaves kab_*, schema do .fastcnc — CAM fica DENTRO de kabacalQuote —, mapa de split futuro, convenção de versionamento). Os 3 subagents viraram WRAPPERS finos apontando pros docs (apagar `.claude/` não perde conhecimento). `KABACAL_RULES.md` ganhou índice + nota de precedência. AGENTS.md: ordem de leitura aponta pros docs novos.
- **Fase 4 — engines com markers + testes EXECUTADOS no check.mjs** (padrão PN_ENGINE): `NEST_ENGINE` (mrOverlap→packInto), `OFFCUT_ENGINE` (OFFCUT_NOTCH→offcutForSheet), `CAM_ENGINE` (ringPts→ncPegasus). **Diff do index.html = exatamente 6 linhas de comentário, 0 remoções.** Testes novos (~80 asserts): nesting = conservação de 12 peças/2 chapas/margens/sem overlap/packInto; offcut = a TABELA NORMATIVA do rules (350x600✓ 250x700✗ …), contorno em L (8 segmentos/700mm, junta interna removida), cross corner-only (T e containment rejeitados); CAM = âncora ll (4,210) CCW, escada 12/6/0 com piso Z0 exato, rapids nunca abaixo de Z23, plunge F3000 primeiro, dims portrait 1220×2440, datum centre (610,1220), tpXform (7,7)→(1213,7), post sintético (header/toolchange G53Z0+T2M06/spindles/footer M05M30+CRLF).
- **Decisão registrada**: envelopes {v,data} nas 17 chaves localStorage foram deliberadamente ADIADOS (valor ~zero até precisar de migração real; risco alto de typo em 17 call sites densos) — convenção de versionamento documentada no ARCHITECTURE; .fastcnc já tem `version` e tooldb `ver:2`.
- Plano modelo-independente COMPLETO (Fases 1–4): qualquer modelo entra pelo AGENTS.md → STATUS.md → doc da área; verdade executável no check.mjs/goldens/examples; gate git-level no pre-commit.

### Testado (n)
`node tools/check.mjs` ok (PN + NEST + OFFCUT + CAM engines executados) ✓ · diff do index.html = só os 6 markers (git diff -U0 conferido) ✓ · **golden self-check no browser com os markers**: NC ll byte-igual, DXF 18mm byte-igual, QUOTE_standard byte-igual, partN 12 ✓ · console limpo ✓ · teste do L do offcut corrigido durante o desenvolvimento (8 segmentos de grade, não 6 arestas lógicas — perímetro 700 confere) ✓ · hook pre-commit exigiu esta entrada do ROADMAP (dogfood) ✓.

## 2026-07-07 (m) — Fase 2: goldens ricos + examples + docs/TESTING.md + pre-commit hook (app intocado)

Rede de regressão expandida — `index.html` sem NENHUMA mudança (só docs/tooling/goldens).

- **Goldens novos** (13 arquivos em `tests/golden/`, byte-exatos, receitas completas no README):
  - **Job rico** (5 portas: flushback 480×497 F65 c/ hinges+spray · trad 2 painéis c/ groove+LED · reeded · flat q2 c/ linha B + verso custom A-only + scribe · trad Glass c/ beading + serviços 1/0.5/1h): `GOLDEN_RICH_{18,12,9,3}mm.dxf` — cobre SHADOW/POKET_INSERT/IN_22MM/OUT_10MM/GROOVE/LED_CHANNEL/OFFSET_A+B/SCRIBE/REEDED/BEADING/INSIDE/hinges/back-sheet/OFFCUT(+TEXT), 11 parts, 4 chapas, quote 664/133/797.
  - **NC de toolchange real**: templates de fábrica do flushback aplicados (`tplApply` ×2, Shadow ligado) → `GOLDEN_TPL_S1_18mm.nc` com **3 segmentos T1→T2→T1** (rough 17 → shadow → FINISH 18) + `GOLDEN_TPL_S2_12mm.nc` (contorno do insert — prova do filtro `role`).
  - **Panels**: 2 rooms / 3 paredes (2 encadeadas c/ emenda 40/40 + 1 vertical), Door + Window → `GOLDEN_PANELS_18mm.dxf` (INSIDE da janela, caps, PART_NUMBER em ordem visual; ids `pnNew*` PINADOS — `Date.now()` embutido quebraria o determinismo). Quote panels 2390 / 6 chapas.
  - **Quote snapshots**: `QUOTE_standard.json` (basket A 300/60/360) · `QUOTE_rich.json` (panels.total=0 — invariante doors-only) · `QUOTE_mixed.json` (total 3665).
  - Goldens ll/c existentes **re-verificados byte-a-byte** contra o código atual na captura ✓.
- **`examples/`**: `standard-job` · `rich-doors-and-panels` · `panels-only` (.fastcnc.json, gerados pelo próprio `buildFastCnc`) + `sample-takeoff.txt`. **Round-trip provado**: load frio do mixed reproduz o QUOTE_mixed exato (partN 11, 3665, panels 2390, svc 98, spray 54, 2 rooms) ✓. Persistência CAM confirmada DENTRO de `kabacalQuote` (camJob/camPaths/camTools — roadmap (b) correto).
- **`docs/TESTING.md`**: procedimento de verificação 100% modelo-neutro (node+git+browser console): invariantes runtime, baskets, truque do golden self-check via fetch, round-trip de save/load, gadget VCarve (manual), tabela evidência-por-zona. Lacuna anotada: baskets ainda não cobrem formula mode/overrides/custom mats.
- **`.githooks/pre-commit`** + `check.mjs --pre-commit` (git-aware): index.html staged sem ROADMAP.md = **bloqueia**; funções guardadas no diff staged sem goldens staged = **aviso alto**. Ativação por clone: `git config core.hooksPath .githooks` (funciona pra qualquer modelo/humano — git-level, não Claude-level).
- `.gitattributes` ampliado (goldens `-text` incluindo .json; examples LF) · AGENTS.md/STATUS.md atualizados.

### Testado (m)
`node tools/check.mjs` ok · `--pre-commit` com stage real (docs+goldens, sem index.html) passa · hook dispara no commit desta entrega (hooksPath configurado antes) · round-trip PASS ✓ · goldens gerados 2× idênticos (DXF rico, PANELS, NCs) ✓ · ids pinados: nenhum `pr_g|pw_g|po_g` vaza no DXF ✓ · tamanhos conferidos no disco = strings do browser ✓ · git diff do index.html vazio ✓.

## 2026-07-07 (l) — Docs modelo-independentes Fase 1: AGENTS.md + STATUS.md (app intocado em comportamento)

Preparação para qualquer modelo de IA (Claude, Codex, GPT…) continuar o projeto sem depender de memória de conversa.

- **`AGENTS.md`** (novo, raiz): ponto de entrada padrão cross-tool — o que é o Kabacal, 10 regras de ferro, tabela de zonas guardadas com evidência exigida, mapa completo por família de função (agora inclui `pn*`/`tpl*`/`tdb*`/Price Settings — o mapa do CLAUDE.md estava desatualizado), protocolo de sessão (pull → `.session.lock` → commits pequenos → push), comandos e ordem de leitura por tarefa.
- **`STATUS.md`** (novo, raiz): "onde estamos" mutável — 5 riscos abertos ranqueados (air-cut pendente; scope staleness a verificar; config de preços só no localStorage; repo/app públicos; push=live), decision log (Doors default; edging adiado; não fatiar o arquivo até gatilho; proveniência da fórmula do site 2026-07-01), próximos 3 passos. ROADMAP continua sendo o histórico append-only.
- **`CLAUDE.md` enxugado**: vira ponteiro para AGENTS.md (`@AGENTS.md`) + extras só-Claude (skills, subagents, preview). Regra explícita: repo ganha de memória de conversa.
- **Comentário-cabeçalho no `index.html`** (14 linhas, sem mudança de comportamento): qualquer modelo que abrir o arquivo vê as regras antes de editar (markers são infra, check obrigatório, zonas guardadas).
- `.gitignore` + `.session.lock` (lock de escritor por sessão, só local). Migração de memória→repo: pin do passDepth do t1 já estava documentado no `xlsx2tooldb.mjs` (nada a fazer); fatos de máquina seguem no cam-reviewer até a Fase 3 (`docs/CONTRACT-CAM.md`).
- Fases 2–3 planejadas (goldens extra, `docs/TESTING/ARCHITECTURE/CONTRACT-*/PRICING`, `examples/`, `.githooks/pre-commit`) — listadas no STATUS.md.

### Testado (l)
`node tools/check.mjs` ok (comentário HTML não afeta contagem de script nem invariantes) · goldens intocados (mudança é só docs + comentário) · `git diff` do index.html = só o bloco de comentário no `<head>` · lock criado e removido no fim da sessão.

Rodada grande do Ednei (12 itens; edging deliberadamente FORA). Pricing é zona guardada → **prova de delta zero**: baskets A (padrão 300/60/360) e B (trad+flush+reeded+F+B+serviços+spray = 881/176/1057, linhas por material idênticas) batem byte a byte com o baseline capturado ANTES dos edits; £75 (MDF 18 10x4) intacto; goldens NC+DXF byte-idênticos (writer refatorado p/ cavidades).

- **Doors é o default**: `kab_mode` não é mais restaurado no boot — o app SEMPRE abre em Doors (Panels continua a 1 clique). Provado com `kab_mode=panels` gravado.
- **Painéis internos da porta** (port de `computeCavitiesWithFrames`/`panelSegmentSizes` do app antigo): `panels` (1–8, divide no eixo LONGO), `midFrame` (travessa central, ≠ frame externo; vazio = frame) e `panelSize` (painel de BAIXO no retrato / direita no deitado; vazio = divisão igual — regra exata do app antigo). UI na seção Parts com hint das aberturas. Preview + DXF desenham offsets/estrutura POR CAVIDADE (flat, trad, flush — anéis flushback por abertura —, glass); **inserts/beading: um POR abertura** (trad 2 painéis → 2 inserts; partN conta certo). `.fastcnc` round-trip: `panels`/`panelSize`/`frameMiddle` (campos do app de produção). Pocket/reed minutes por Σ cavidades (idêntico p/ 1 painel).
- **Backside offsets independentes**: Offset ganhou **BACKSIDE = Off | Same as front | Custom offsets** — no custom o verso tem o PRÓPRIO editor A–G (ex.: frente A0+B10+C20, verso só A50). Back sheet (preview + DXF) usa as linhas do verso; `.fastcnc` aditivo `kabBackMode`/`kabBackLines`; minutos de pocket por FACE ativa (produção idêntica: same=×2 como antes).
- **Price Settings completo** (`openPricing` reescrito): método de preço **Production/sheet | Website formula** (por porta: fixo £25 + £139/m², mín £20 — defaults do estudo 2026-07-01, TUDO editável, `kab_pricecfg`); livro de materiais inteiro editável (override £/8x4 + CNC, ↺ volta ao livro) + **materiais custom** (nome/espessura/preço — `kab_custom_mats`, entram em toda parte); rates £/h editáveis (design/cutting/assembly/machine, defaults 35/25/50/250 agora de verdade ligados ao calcQuote); dados da empresa do PDF; **Save/Load settings (.json)** num arquivo só (overrides+customs+favs+método+fórmula+empresa+presets de offset). Fórmula troca SÓ o subtotal de portas — serviços/spray/Panels/VAT intactos; quote view e PDF mostram a tabela por porta no modo fórmula.
- **PDF do cliente**: cabeçalho no estilo do calculador antigo — logo centralizado (URL editável, fallback textual offline) + bloco da empresa + caixas QUOTE NUMBER/DATE/PREPARED FOR/CONTACT. Corpo/conteúdo preservado.
- **Fase 2 (combinado)**: edging (fora por ordem do user); tamanhos arbitrários por painel (hoje: baixo + iguais); minutos de usinagem do verso por área própria; renomear materiais built-in (regras de produção); DB de preços.

### Testado (k)
Doors default com kab_mode=panels ✓ · baskets A/B delta ZERO + £75 ✓ · goldens byte-idênticos ✓ · painéis: 600×1000 F50 rail60 → 2×500×420 @y50/530; bottom 300 → 540/300; 3 iguais 266.67 rail50; 1 painel ≡ legado ✓ · trad 2 painéis → 2 inserts 524×444, partN 3 ✓ · preview 2 anéis/porta + DXF OFFSET_A ×2 ✓ · flush 2 painéis → SHADOW×2, POKET×4 ✓ · verso: frente A0/B10/C20 + verso A50 → back sheet só A50 (preview+DXF) ✓ · fórmula: 108/porta (25+139×0.6), edita p/ 120, persiste, volta a production limpo ✓ · custom mat £99 ✓ · settings export shape ✓ · PDF logo+empresa+fallback+meta ✓ · UI Parts/Offset ✓ · console limpo ✓ · screenshot ✓.

## 2026-07-07 (j) — Ordem real dos templates confirmada: o binário do VCarve guarda INVERTIDO

Ednei confirmou: o rough 17mm roda ANTES do FINISH 18mm — e o `.ToolpathTemplate` lista o FINISH primeiro, logo o binário (mcTemplateTree) guarda a árvore **de trás pra frente**. Regra de conversão registrada em `KABACAL_RULES.md`: **sempre inverter a ordem do binário** ao converter templates futuros.

- Os dois templates de fábrica virados pra ordem real de corte (que bate com a lógica de produção — pockets com a peça presa, passante no fim): **corpo** = rough 17mm (LIVE) → Pocket Frame 6.5 → pocket Insert 12.3 → Insert 12.3 on → In 18 → Shadow → **FINISH 18mm (LIVE, liberta a peça por último)**; **insert** = Pocket 5.5 → contorno 12mm (LIVE, por último). Boot refresh por id atualiza quem já tinha os templates.
- NC comprovado: no segmento T1 da chapa 18mm, os laps do rough (piso Z1.000) saem ANTES dos do FINISH (piso Z0.000), um único `T1M6`. Goldens byte-idênticos (mudança só de dados). cam-reviewer (delta sobre o veredito SAFE anterior): a inversão não muda nenhuma conclusão de segurança — cada op abre com retract a safeZ e os pisos não mudam.

### Testado (j)
Ops de fábrica na ordem nova (7 corpo + 2 insert) ✓ · Auto → 9 paths na ordem real (rough 1º LIVE, FINISH 7º LIVE, contorno do insert 9º LIVE) ✓ · NC 18mm: Z1.000 (rough) antes de Z0.000 (finish), 1 toolchange ✓ · chapa 12mm intocada (T1 insert) ✓ · Simulate passo 1 = rough 17mm ✓ · goldens ll/c/dxf byte-idênticos ✓ · `check.mjs` ok ✓ · console limpo ✓.

## 2026-07-07 (i) — Templates por peça física (corpo 18mm × insert 12mm) + Simulate 2.5D

Clarificação do Ednei: uma porta Flushback tem DUAS peças físicas com templates próprios. Zona guardada (CAM: `tpPathParts`) → **cam-reviewer executado no diff: veredito SAFE** (31/31; goldens regenerados byte-idênticos no sandbox dele; provou que o `role` é obrigatório — sem ele o op do corpo cortaria a chapa 12mm até Z−6).

- **Schema v2**: `appliesTo:{part:'body'|'insert', type, th}` em cada template. Fábrica renomeada: **"Flushback 18mm Frame/Body"** (7 ops) e **"Flushback 12mm Insert"** (2 ops), ambos auto; entradas de fábrica se atualizam por id no boot (customs/exclusões do user respeitados).
- **Motor com `params.role`** (`tpPathParts`): `insert` corta só peças insert, `body` só corpos; ausente = tudo (toolpaths antigos intocados — goldens byte-idênticos). Necessário porque scope por item não separa corpo/insert (`3_0` vs `3_0_i` colidem no parseInt).
- **Matching por papel físico**: corpo casa por tipo+espessura do material; insert via `insertSpecFor` (kind+insTh). Layers do insert = nomes VCarve (`OUT_INSERT_15MM`→`OUT`+role ao aplicar, `refLayer` guarda o original; `OFFSET_5MM` fica staged).
- **⚡ Auto aplica TODOS os templates auto com match completo**: Flushback selecionado → **9 toolpaths na ordem dos arquivos** (7 corpo: FINISH 18mm LIVE, 5 staged, rough 17mm LIVE · 2 insert: contorno 12mm LIVE, pocket 5.5 staged). NC real: chapa 18mm corta só o corpo (Z 38..0), chapa 12mm só o insert (Z 32..0, fundo exato no bed).
- **▶ Simulate (preview 2.5D)**: player passo-a-passo por peça (abas 18mm Frame/Body · 12mm Insert): vista de topo com remoção de material codificada por profundidade (bandas preenchidas, furo passante tracejado, kerf na largura real da fresa), lista de ops na ordem com T#/Ø/lado/profundidade + barra de profundidade, clique num op pula pro passo. Simulação 3D volumétrica = fase futura (anotado na UI).
- **Fix do cam-reviewer**: aviso "cuts into the bed" no Save NC agora só dispara quando o toolpath corta AQUELA chapa (antes acusava falso na chapa do insert); aviso de perfis duplicados ganha nota sobre par desbaste+acabamento de template.

### Testado (i)
Auto no Flushback 480×497 F65 → 2 templates, 9 paths na ordem, roles certos ✓ · chapa 18mm: só body (2 ops OUT), chapa 12mm: só INSERT, headers/footers NC ok, Z nunca negativo ✓ · goldens ll/c/dxf **byte-idênticos** (runtime + sandbox independente do reviewer) ✓ · Simulate: corpo 7 passos (Op k/7), insert 2 passos com banda evenodd, navegação ◀▶/click ✓ · aviso falso do bed eliminado, nota do par 17/18 presente ✓ · `check.mjs` ok (incl. tripwires Panels) ✓ · console limpo ✓ · cam-reviewer SAFE; dry-run em ar recomendado antes do primeiro job real de template (padrão novo de passada única full-depth).

## 2026-07-07 (h) — Panels rodada 3: cotas no viewer, nomes "Wall 3A", DXF por room em ordem visual, ferramenta de medir com snap, 2.5D leve

Melhorias de leitura do layout pedidas pelo Ednei (15 itens).

- **Cotas no viewer (wall view)**: "Wall width: 7200mm" no topo; **corrente de cotas** parede-início → bordas de cada abertura → parede-fim (mesma geometria `pnOpRect` que o DXF usa — valores idênticos); tamanho de cada abertura ("Door" + "900 × 2100") com **símbolos simples** (porta = folha+maçaneta, janela = cruz, objeto = diagonal); tamanho de CADA painel no centro (já existia, mantido); **sem tamanhos de shaker** (pedido). Labels sutis (9–9.5px muted) e somem quando não cabem (segmento <30px, painel pequeno, abertura pequena).
- **Panorâmica**: cada painel mostra "letra · L × A" quando cabe (só a letra quando apertado); aberturas mostram o tamanho; sub-label da parede virou "width 3600 · height 3200 · click to open".
- **Nomes**: `Wall 3A / 3B / 3C` por parede em ordem visual (esquerda→direita), com prefixo do room — iguais no viewer (letra no painel), inspector (nome completo), DXF (texto + labels) e quote. Substitui o `P1/P2V` (regra antiga superseded — sufixo V só como info visual). Overrides por painel continuam válidos (chave pid não mudou).
- **DXF por Room em ordem visual**: botão discreto "⬇ Export <room> DXF" embaixo da panorâmica exporta SÓ o room selecionado (`PANELS_<room>_<esp>.dxf`); **PART_NUMBER segue a ordem visual do layout** (Wall 1A=1, 1B=2…), não a ordem de leitura da chapa — vale também para o export geral. Mesmo builder da parede → mesmas layers/geometria (OUT, OFFSET_A/linhas A–G, INSIDE, SHEET, PART_NUMBER, text) — nada simplificado.
- **Ferramenta de medir** (📏 na wall view, Esc sai): clique 2 pontos; **snap** em cantos e arestas de parede/painéis/cavidades/linhas de offset/aberturas/skirting (a MESMA geometria exportada → valores batem com o DXF); eixo dominante vira medida reta (largura/altura), diagonal quando claramente diagonal; crosshair + anel de snap + label discreto; arrastar continua sendo pan.
- **2.5D leve**: sombra deslocada nos painéis + bisel interno nas cavidades (vetor puro, sem filtros). Primeira passada — dá pra evoluir se o Ednei quiser mais profundidade.
- check.mjs: assertivas novas de nome (`Wall 1A`/`Wall 2A`) e sequência visual `vn`.

### Testado (h)

`node tools/check.mjs` ok ✓ · parede sem abertura = sem corrente, só "Wall width: 2300mm" ✓ · porta / janela / porta+janela: corrente com 6 ticks e vãos 800/2800/1500 idênticos ao `pnOpRect` do DXF ✓ · símbolos porta (maçaneta) e janela (cruz) presentes ✓ · parede 7200 → 3 painéis "Room 1 Wall 4A/4B/4C" ✓ · vn 1..10 sequencial ✓ · inspector mostra "Room 1 Wall 1A" ✓ · **DXF do room: 10 PART_NUMBER = 10 painéis, números exatamente 1..10 na ordem visual, "Wall 4A" no texto, layers OUT/OFFSET_A/INSIDE/SHEET/PART_NUMBER** ✓ · medir: clique 3 unidades fora do canto puxa exato pro canto (Δ0/0) e dois cantos a 7200mm medem 7200 ✓ · labels de painel na panorâmica + tamanhos de abertura ✓ · sombras/bisel 2.5D presentes ✓ · save da rodada 2 recarrega (4 paredes) e quote funciona (£2.735) ✓ · só-Doors £300/£360, panels zerado ✓ · **goldens NC ll/c + DXF byte-idênticos** ✓ · console limpo ✓.

## 2026-07-07 (g) — Panels rodada 2 (teste do Ednei): DXF dos painéis, panorâmica, zero-scroll, preço do panneling

Seis pedidos urgentes do teste real. **DXF era o bloqueador de produção** — entregue com a disciplina do Doors.

- **DXF dos painéis**: `PANELS_<espessura>.dxf` por espessura (botão DXF do header em modo Panels + ⬇ DXF no canvas). Writer espelha o do Doors: doc portrait, `SHEET`+caption dentro da chapa, `OUT` contorno, **cavidades de shaker em `OFFSET_A`** (sem linhas ativas) ou **linhas A–G ativas** recuadas `mm` em cada cavidade (round r2.5), `INSIDE` = recorte de janela, `PART_NUMBER` + texto tamanho/nome com as mesmas métricas, margens/gap 7mm do nesting, cavidades transformadas quando a peça rotaciona no nesting.
- **Panorâmica**: clicar a tab do Room mostra TODAS as paredes lado a lado (peças/cavidades/aberturas resumidas, "click to open"); clicar uma parede abre a vista normal.
- **Zero-scroll + zoom/pan**: canvas com altura fixa `100vh−282px` (SVG "meet" dentro), sem scroll de página; **roda do mouse = zoom no cursor, arrastar = pan**, botões + − ⤢ (fit); vista Sheets rola dentro do próprio canvas. Arrastar não dispara clique (supressão 250ms).
- **Preço do panneling**: por room, material £/chapa (vazio = price book por tamanho de chapa) + **CNC £330/chapa default** (taxa do app antigo), editáveis no inspector; import legacy traz materialCost/cncServiceCost do bloco. Substitui o "CNC de porta + % pocketing" da Fase 1 (era o motivo dos valores não baterem).
- **Overrides redesenham na hora**: QUALQUER override de painel (lados OU count) reflui as células imediatamente (h e v); Auto volta ao grid do run. (Era o bug: mudar só o lado não refluía.)
- **Tamanhos nos painéis**: label sutil "L × A" no centro de cada peça (muted, some em peça pequena).
- check.mjs: presença do writer DXF + nome `PANELS_` + default £330.

### Testado (g)

`node tools/check.mjs` ok ✓ · **goldens NC ll/c + DXF do Doors byte-idênticos** (IDENTICAL ×3 na comparação binária) ✓ · quote só-Doors nos valores provados (£300/£360, panels zerado) ✓ · **DXF Panels verificado por conteúdo**: 6 OUT = 6 peças, 6 SHEET = 6 chapas, 34 OFFSET_B = 34 cavidades com linha B ativa E 34 OFFSET_A com linhas desligadas (disciplina Doors nos dois sentidos), 2 INSIDE = 2 recortes de janela, PART_NUMBER ×6, tabela de layers só com as usadas, borda mínima 7mm, shell HEADER→EOF válido ✓ · panorâmica renderiza as paredes e o clique abre a parede ✓ · zero-scroll em 1440×900 (doc 900 = viewport; canvas 618px) ✓ · zoom muda o viewBox e ⤢ restaura ✓ · override de lado `corner` reflui células (recuo 80→98 = frame+espessura exatos) ✓ · labels "2600 × 1030" nas peças ✓ · preço: 6 chapas → material book £430 / CNC £1.980 / total £2.410; com material £70 → £2.400 ✓ · save da Fase 1 SEM os campos novos carrega e precifica com defaults (330/book) ✓ · import legacy traz 70/330 do bloco ✓ · console limpo ✓ · screenshot do preview segue travando (limitação do ambiente de captura; verificação via eval/a11y).

## 2026-07-07 (f) — Kabacal Panels Fase 1: modo Panels completo (rooms → walls → painéis shaker)

Modo **Panels** dentro do Kabacal (o botão "Panelling ↗" que abria o app antigo virou o toggle **Doors | Panels**). Workflow separado do Doors, preço junto no Quote. Regras confirmadas com o Ednei em 2026-07-07 (plano + 2 rodadas de correção) — agora em `KABACAL_RULES.md` seção "Panels".

- **UI**: tabs de Rooms → tabs de Walls → canvas SVG da parede (peças, cavidades shaker, joints 40/40 em âmbar, emendas de corrente, aberturas, linha guia do skirting, offset lines coloridas) + **inspector à direita** (Room: material/frame/alvo/skirting/sill/alturas/sheet pref/offset lines A–G · Wall: tamanho/direção/stepper de shakers/colunas×rows/lados/aberturas · Opening: campos + colisão ⚠ · Panel: override count/lados + Auto). Subview **Sheets** (nesting read-only por room). Status: Panels £ · Doors £ · Job £ ex VAT.
- **Motor (run-first)**: grid de shakers no run inteiro → fatia nos centros de frame (40/40 por construção); **correntes entre paredes** (Joint|Joint) com células da emenda exatas; **otimizador misto 8x4/10x4** (caps 2400/3000; joints → custo nested real → desperdício → equilíbrio; peça pequena pega carona na sobra de 10x4 antes de abrir 8x4); vertical = colunas ≤1206 × rows (default 2, fileira de baixo alinhada em hPanelH−frame); aberturas com cap/lower panels, sill 22, skirting 225 guia; overrides por painel físico. Motor puro entre marcadores `/*PN_ENGINE_START*/…/*PN_ENGINE_END*/` — o check.mjs EXECUTA o bloco.
- **Quote**: `calcQuote()` ganhou a seção `panels` (chapas × material + CNC/chapa + pocketing por área como Doors); tela e PDF mostram "Wall panelling" + Doors subtotal + Panels subtotal + total combinado; **job só-Doors byte-idêntico** (provado abaixo).
- **Persistência**: `.fastcnc` ganha `panelRooms` (aditivo); import automático de quotes antigos `calcMode:'panel'` (walls/direção/aberturas, `empty`→Object); localStorage `kab_panels` + `kab_mode`; undo/redo cobre `panelRooms`.
- **check.mjs**: tripwires comportamentais novos — corrente 40/40 + shakers da emenda iguais, 2900→1 peça 10x4 / 2300→8x4, run 6500 com caps + matching em todo joint, `8x4 only` ≤2400, vertical ≤1206/10x4, marcadores + `panelRooms` + `kab_panels`.
- Fase 2 (planejada): DXF dos painéis (layers OFFSET_A–G etc.), envio ao Toolpaths/CAM, offcuts/edição manual do nesting dos painéis, vista panorâmica, back-side pocketing.
- Nota de processo: durante o build uma sessão paralela commitou o Flushback (4e2c8fd) — o working tree foi verificado como HEAD + só adições dos Panels (diff sem remoções de código alheio, goldens e quote comparados contra o HEAD novo).

### Testado (f)

`node tools/check.mjs` ok (incl. tripwires novos executando o motor) ✓ · **goldens NC ll/c + DXF byte-idênticos vs HEAD 4e2c8fd** (comparação binária no browser: IDENTICAL ×3, tamanhos 8358/8402/4517) ✓ · **quote só-Doors idêntico vs HEAD** (mesmo seed golden nos dois builds, JSON igual, sub £300/total £360) ✓ · `priceForSheet('MDF 18mm','10x4')===75` ✓ · console limpo no boot e no uso ✓ · parede default 5200 → **2×2600 em 10x4 (1 joint)** e não 3×8x4 ✓ · corrente 2600+3000 (Joint|Joint): 1 run, emenda 40/40, shakers da emenda 347.4/347.4 ✓ · door+window: painel inferior da janela + notch; door sem cap na banda 1030 ✓ · parede vertical 4000 → 4 colunas de 1000 (10x4, células 2×2) ✓ · nesting room: 5×10x4+3×8x4, material £540 ✓ · quote Panels £1.356 (540 + 680×1.2 pocket) e tela/PDF com as duas seções + subtotais ✓ · `.fastcnc` round-trip (1 room/3 walls) ✓ · import legacy `calcMode:'panel'` (2 walls, `empty`→Object, muda pro modo Panels sozinho) ✓ · undo/redo devolve wall deletada ✓ · colisão de 2 doors sobrepostas mostrada (⚠, nada se move) ✓ · override por painel: count 2 → 4 células (2×2), lados preservados, Auto volta ✓ · workspace inteiro verificado por a11y snapshot (tabs, canvas, inspector completo, status £) — screenshot do preview travou por limitação do ambiente de captura, não do app (página respondendo, console limpo).

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
