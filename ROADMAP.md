# Kabacal — Roadmap / Status

App: `index.html` · Publicado: https://spaceinvuk.github.io/kabacal/ · Repo: `SpaceInvUK/kabacal`

## 2026-07-15 (g) — SYNTEC Tier 2: comentários () opcionais no NC (header + por-operação) + regen dos goldens TPL

Segunda melhoria SYNTEC. **Toggle opt-in** no modal Save NC ("Add () production comments"). **Default OFF = o NC validado atual byte-idêntico** (goldens intocados). Quando ON, `ncPegasus(segs,meta)` emite comentários `()` **que NÃO consomem N-number** — a usinagem sai byte-idêntica com ou sem (só adiciona linhas `()`; provado: remover as linhas `()` do ON == OFF, os N-numbers são idênticos). ASCII, 1 linha, parênteses/acentos removidos. O `:1248` fica **intocado** (os comentários entram DEPOIS dele).

- **Header** (após `:1248`, antes do `G90`): JOB, NC_FILE, CLIENT, MATERIAL, THICKNESS, SHEET_SIZE, PARTS (lista as peças da chapa), DATUM G54, Z_ZERO, CREATED (`ncHeaderFor(f,ncFile)`). O NC corta a chapa inteira → PARTS lista as peças dela. EST_TIME chega no Tier 4.
- **Por operação**: uma linha antes de cada troca de ferramenta com o(s) nome(s) real(is) do toolpath — ex.: `(OP40 T1 S18000 6mm OUT 22mm + 6mm Offcut 22mm)` (segmentos merjados mostram os dois nomes). `tpSegsForSheet` passou a guardar `names` por segmento; `tpAirLift` preserva.
- Emitido por `tpDownloadNC` e `tpExportPackage` (pacote Tier 1) quando `camJob.ncComments`. **Air-cut obrigatório antes de produção** — o SYNTEC precisa aceitar `()` (parâmetro de máquina); o aviso está no modal.
- **Também: regen dos goldens `GOLDEN_TPL_S1/S2`** (fora do escopo do Tier 2, mas necessário): estavam **DEFASADOS desde o `a06702e`** — o fix de segurança do Fork no Flushback all-live (as layers não-mapeadas IN_22MM/POKET_INSERT/SHADOW cortavam o CONTORNO da porta; o fix passou a cortar a geometria real da cavidade). O Fork re-verificou só os goldens ll/c e deixou os TPL nos meus valores antigos (bugados). Regenerados pra bater com o código atual (mais seguro): **2788→3258 / 1174→1611**, minZ=0 (nada abaixo da mesa), sem Z negativo.

### Testado (g)
`node tools/check.mjs` verde ✓ · **OFF byte-idêntico**: 6 goldens NC OK (standard ll/c, Ogee, Plain Shaker intocados + TPL regenerados) ✓ · **strip-invariant** (ON sem as linhas `()` == OFF) provado em Plain Shaker E Flushback; N-numbers idênticos ON/OFF ✓ · `:1248` intacto (linha 2) ✓ · sanitizer: "José Ção (Bedroom)"→`(CLIENT Jose Cao Bedroom)`, "Panel Á"→"Panel A" ✓ · header + por-op corretos com nomes reais dos toolpaths ✓ · sem erros no console. Só `index.html` + docs + 2 goldens (TPL).

## 2026-07-15 (f) — SYNTEC Tier 1: pacote de produção por pedido (.zip com NCs + etiquetas + manifest)

Primeira das melhorias do fluxo **SYNTEC 60W-E** (análise do Ednei: os NCs hoje são "anônimos" — sem cliente/pedido/peça/rastreabilidade; o `:1248` é fixo, não é ID). Tier escolhido pra começar por ter **maior valor e ZERO risco de máquina** (não toca nos bytes do NC). Botão **"⤓ Production package (.zip)"** no modal de export de Toolpaths: gera **um .zip por pedido** onde o MESMO ID (`genOrderNumber` = INICIAIS-AAAAMMDD-SEQ) aparece na pasta, em TODO nome de NC, nas etiquetas e no manifest — pra o ScanMode/Workinglist e a rastreabilidade baterem.

- **Conteúdo**: `{ORDER}/` com todos os NCs por chapa (`{ORDER}_S{i}_{th}mm.nc`, saída **EXATA** do `ncPegasus`), `{ORDER}_labels.html` (reaproveita a impressão A4 de etiquetas — já com QR), e `{ORDER}_manifest.csv` (uma linha por peça: order, nc_file, sheet, material, espessura, tamanho da chapa, part_no, nome, W, H, role, uid).
- **Barcode do ScanMode = o nome do NC** (a máquina escaneia pra enfileirar a chapa); o `uid` por peça é pra rastreio da etiqueta. Nada disso precisa entrar no G-code (conforme a análise).
- `zipStore` inline (store-only, CRC32, ~20 linhas — **sem dependência**, mantém a regra single-file). Reaproveita `ncPegasus`/`tpSheets`/`collectLabelMapPages`/`a4LabelsPrintHtml`/`shortHash`. Próximos: Tier 2 (comentários `()` opt-in no NC + air-cut), Tier 3 (etiqueta ZPL Zebra), Tier 4 (tempo estimado).

### Testado (f)
`node tools/check.mjs` verde ✓ · **goldens byte-idênticos** (spot-check `PLAINSHAKER_S1_22mm` + `GOLDEN_S1_18mm` — `ncPegasus`/`tpSheets` intocados) ✓ · E2E: job 2 peças Plain Shaker 22mm → `tpExportPackage` capturado (monkeypatch no `dlBlob`), **o zip abre no `Expand-Archive`** (unzip real do Windows), contém `J-…/…_S1_22mm.nc` (5342, header `%`/`:1248`/`G90` + segmentos T12→T1→T2→T1) + `…_labels.html` (50478) + `…_manifest.csv` (282, 2 linhas de peça com o ID em todas as colunas) ✓ · sem erros no console. Só `index.html` (+50/−1). Zona guardada (CAM) sem mudança de bytes.

## 2026-07-15 (e) — Panels no Quote/PDF: m², cut list, panorama + sheet preview (toggles) + m² no editor

Pedido do Ednei: "improve Panels information in Quote tab and PDF quotation" — simples, sem redesenhar o sistema de quotation. Quando o job tem Wall Panels, o Quote (tela) e o PDF ganham uma seção **"Wall Panels"** limpa. Camada de DISPLAY apenas: não toca pricing/DXF/NC/geometria. Job só-Doors sai idêntico.

- **Duas áreas em m²** (helpers novos fora do PN_ENGINE): `pnPieceArea(p)` → `{mat: w×h, painted: w×h − Σ(notches de janela)}`; `pnQuoteAreas()` soma as peças REAIS do `pnRoom` por room (÷1e6). **Panel material area** = Σ(largura×altura físicas) — bate com o retângulo cortado no DXF/nesting, respeita On/Off, splits, vertical, gap/overlap por construção; parede `noPanel` não gera peça → não conta. **Painted front area (front only)** = mesma soma menos os recortes de janela, só a face da frente, nunca dobrada frente+verso.
- **Seção no Quote tab + PDF** (mesma função `pnQuotePanelsExtra()` nos dois): resumo (Total panels / Panel material area / Painted front area) + panorama (opcional) + sheet preview (opcional) + **cut list** (Wall / Panel ID / Width / Height / Thick / Area m², nome existente Wall 1/Wall 1A, sem renomear por letra). Vazio quando não há painéis → doors-only intocado.
- **Panorama de quotation** = reaproveita o `pnPanoSvg` com flag `quote`: segue a ordem das paredes mas **esconde as sem painel** (sem caixas em branco), compacto, sizing de impressão; numeração mantém o índice real da parede (Wall 1, Wall 3…), consistente com o cut list. **Só no Quote/PDF — o editor de Panels continua mostrando todas as paredes** (path `quote` falsy byte-idêntico ao antigo).
- **Toggles no Quote** (default ON quando há painéis): "Show Panels panoramic view" + "Show sheet preview" (`pnQuotePano`/`pnQuoteSheets` + `setPnQuoteOpt`) — controlam tela **e** PDF juntos.
- **m² no editor de Panels**: rodapé discreto no `.pn-status` sob o desenho — "Total panel area · Painted front area" do room; ao focar uma parede, "Wall panel area · Wall painted front area" também. Pequeno/`--muted`, em try/catch (nunca quebra o editor). Só isso muda no editor.
- **CSS**: `.qsec/.msum/.dwg-sheet/.dwg-cap/.q-sheetprev` escopados em `.quote` (tela) + `:root` com `--bg/--ink/--muted/--card/--line` na janela de impressão para os SVGs do panorama/sheet saírem com cor no PDF.

### Testado (e)
`node tools/check.mjs` verde (script inteiro parseia+roda; **golden NC datum-ll byte-idêntico** em runtime; basket 300/60/360 + 12 peças; MDF18 10x4 = £75). **Sandbox node dedicado 30/30**: (1) doors-only → `pnQuotePanelsExtra()===''` e `pnQuoteAreas()` tudo zero; (2) fórmula `pnPieceArea` (sem notch painted=material; notch 200×100 → 500000/480000); (3) room real 3 paredes (janela + parede `noPanel`) → peças nas paredes 1&2, parede OFF sem peça, `areas.mat===Σ(w×h)/1e6`, `areas.painted===Σ(w×h−notch)/1e6`, janela → painted < material; (4) panorama quote esconde a parede OFF mas o panorama do EDITOR mostra todas; room 100% OFF → "No panelled walls"; (5) cut list com Wall 1A e sem a parede OFF; (6) toggles ligam/desligam panorama e sheet preview de forma independente. **Goldens DXF regenerados das receitas e byte-idênticos**: `GOLDEN_PANELS_18mm.dxf` 10030 e `GOLDEN_WALL_LAYOUT.dxf` 3428. `git status`: só `index.html` mudou, nenhum golden tocado. Verificação 100% local (Node + leitura) — o browser do PC estava noutra máquina/rede; não precisou.

## 2026-07-16 (c) — Régua no zoom das peças + Grain abaixo de Hinges + preview com N painéis

- **📏 Ruler no zoom (pedido do Ednei)**: botão "Ruler: ON/OFF" no topo do zoom overlay — mesma UX da régua do paneling: clica dois pontos e mede em **mm**, com **snap** nas bordas/cantos da chapa, das peças e das ABERTURAS (cavidades — inclusive multi-painel, é pra isso que serve); crosshair ao vivo, valor numa etiqueta que mantém ~12px de leitura em qualquer nível de zoom, medida quase-reta trava no eixo (regra do paneling); **Esc sai da régua primeiro** (zoom continua aberto), segundo Esc fecha; trocar de chapa limpa a medida; pan/scroll continuam funcionando (arrastar = pan, clique parado = ponto). Funciona também nos BACK sheets. Implementação `zMeas*` espelhando `pnMeas*`; snap geo dos `sh.parts` + `placedCavs` guardados em `nestSvgs`.
- **Grain reordenado** no inspector: Dimensions · Door Type · Frame & Panels · Hinges · **Grain** · Groove · Scribe · Spray ("Grain é menos importante — abaixo de Hinges").
- **Preview do Frame & Panels com N painéis**: o thumbnail (offsetPreview) agora desenha as aberturas REAIS via `doorCavities` — 2 painéis mostram 2 aberturas com o mid rail visível, e as offset lines circulam CADA abertura (antes: uma cavidade única sempre). Tooltip por abertura ("opening 500×350").
- Testado (browser + `node tools/check.mjs` verde, goldens intactos): preview com 2 aberturas 500×1500/500×350; ordem das seções confirmada; zoom: botão presente, snap geo (16 pts), medição por eventos de ponteiro reais nos cantos da abertura → **350 mm** exatos com etiqueta desenhada; porta rotacionada mede certo (600/2000 nos eixos); Esc em duas etapas; console limpo.

## 2026-07-16 (b) — Editor de Doors reorganizado: Dimensions + Frame & Panels

Só organização/condicionais — zero mudança de geometria, preço, DXF, CAM, quantity ou persistência (goldens byte-idênticos).

- **Parts → Dimensions**: agora só Width, Height e Text (Quantity continua no stepper da linha da peça — não moveu nem duplicou). O editor duplicado de outer frame + rail + bottom part que aparecia ali em portas multi-painel foi embora.
- **Offset → Frame & Panels**, com os controles nesta ordem: **Frame** (editor existente, mesmo comportamento) → **Mid rail** → **Panels** (movido de Parts, sem duplicata) → **Bottom part**. Depois seguem preview, presets, FRONT offsets, BACKSIDE e reeded como antes. Referências de texto ("save presets in the Offset section") atualizadas.
- **Mid rail SEMPRE visível**: com 1 painel fica desabilitado (tooltip "needs 2+ panels"); com 2+ vira editável. **Bottom part** idem: desabilitado com 1 painel, disponível com 2+ (cálculo/semântica ABSOLUTA de 2026-07-15 intactos).
- **Group edit preservado**: Width/Height bloqueados em multi-seleção; Frame, Panels, Mid rail e Bottom part aplicam a todos os selecionados via propagateMulti (MULTI_FIELDS já os tinha); Text segue igual.
- Testado (browser + `node tools/check.mjs` verde): seções na ordem ("Dimensions"/"Frame & Panels"); Dimensions sem Panels; 1 controle Panels no inspector todo; 1 painel = mid+bottom disabled, 2 painéis = editáveis (50/400 exibidos); multi-seleção com primário correto propaga Panels/Mid/Bottom/Frame para todos (verificado item a item) e W/H ficam intactos; geometria pós-edição idêntica nos dois (upper 1395 / lower 455 @ frame 45, mid 60, bottom 500); console limpo; goldens byte-idênticos.

## 2026-07-16 — Quick material bar do Ednei: 5 favoritos fixos, 3 materiais novos, cores garantidas, favoritos no "click to change"

- **Barra de favoritos** agora é exatamente, nesta ordem: MDF Hidrofugo 18mm · MDF Hidrofugo 22mm · Veneered Chipboard 19mm · MR MDF 18mm · MR MDF 22mm. `FAVS_DEFAULT` trocado + reset one-time: `kab_favs` antigo é ignorado uma vez (novo `kab_favs_v='2'`, aditivo); quem re-personalizar depois volta a mandar.
- **Materiais novos no PRICES (aditivo)**: `MDF Hidrofugo` 18mm **£60** (= Hidrofugo Plus 18 £65 − £5, regra do Ednei) e 22mm **£70** (= 18 + £10); `Veneered Chipboard` ganhou **19mm £80** (= mesmo preço do 18). CNC: 19mm agora cobra como 18mm (85) — antes caía na faixa 120; nenhum material 19mm existia, então zero-delta em tudo que já existia.
- **Cores garantidas**: `MAT_COLOR_DEFAULTS` para os 5 do bar (azul/verde/âmbar/roxo/rosa — todas diferentes); escolha manual em Material colours continua vencendo.
- **"Click to change"** (mover peça de grupo) agora lista os favoritos do bar PRIMEIRO e depois os materiais em uso (antes: só os em uso).
- Testado (browser com storage limpo + `node tools/check.mjs` verde): chips na ordem certa com 5 cores distintas; preços 60/70/80 e Plus 18 intacto em 65; CNC 19mm=85; picker com favoritos+em-uso; qaMat com os novos; basket 300/60/360; £75; goldens byte-idênticos.

## 2026-07-15 (d) — URGENT FIX: "Bottom part" é ABSOLUTO desde o fundo da peça (inclui o frame)

Bug de interpretação: o `panelSize` era tratado como altura INTERNA da abertura inferior (semântica herdada do port do app antigo). Regra confirmada do Ednei: **Bottom part = distância absoluta do fundo/início da peça até o topo da seção inferior, INCLUINDO o frame de baixo** (frame direito na horizontal). Porta 2000 · frame 50 · mid 50 · Bottom part 400 ⇒ abertura inferior 350 + abertura superior 1500 (antes dava 400 + 1450 — errado). Mudança de output em DXF/toolpath/inserts é INTENCIONAL e só para portas multi-painel com Bottom part preenchido.

- **Fix**: `cavsFor` subtrai `f.b` (ou `f.r` deitada) do valor antes do `panelSegs` — preview, DXF, toolpaths e inserts herdam via `placedCavs` (rotação verificada por transposição). Label virou "Bottom part (mm)"/"Right part (mm)" com tooltip da regra; hint multi-painel reescrito; preflight novo `bottom part ≤ frame`.
- **Persistência aditiva**: `.fastcnc` grava `panelSize` INTERNO (compatível com o app de produção) + novo `kabBottomPart` ABSOLUTO; import prefere `kabBottomPart` e converte legado (interno + frame) — **jobs antigos renderizam idêntico** (verificado: arquivo legado 350 interno → 400 absoluto → mesma geometria).
- **Regra registrada** em `KABACAL_RULES.md` §Doors (novo).
- Testado: `node tools/check.mjs` verde com **E2E cenário (g) novo** (caso exato 2000/50/50/400: aberturas 1500+350, mid 50, frames intactos, 400→600 move só o split; save = 350 interno + kabBottomPart 400; round-trip restaura 400; import legado converte e renderiza idêntico); no browser (storage limpo): mesmo caso + inserts 524×1524/524×374 (seguem as aberturas), paisagem espelha da direita (400 da borda direita), DXF do job com rebates 1510/360 (aberturas+10, sem 1460/410 antigos), basket 300/60/360, £75, console limpo. Goldens byte-idênticos (não têm porta multi-painel com Bottom part).

## 2026-07-15 (c) — Gap×kerf, undo unificado + redo, Takeoff com preview, E2E no check.mjs

A fila do Ednei (mobile por último). Zona guardada intocada: goldens byte-idênticos (agora TAMBÉM verificados em runtime no próprio checker) e basket padrão 300/60/360 no E2E.

- **Guarda gap × kerf** (chip do cam-reviewer): no Save NC, cada chapa com 2+ peças compara o alcance do kerf dos perfis outside LIVE (Ø + allowance + last pass — ex.: rough do flushback = 7.15mm) com o gap de nesting da chapa; se excede, aviso vermelho com o gap mínimo sugerido ("Set Spacing/gap ≥ 7.2mm"). Warning-only; chapa de peça única não avisa.
- **Undo unificado + redo (fecha o #9)**: `appUndo`/`appRedo` roteiam por contexto — no Top View o menu Edit e o teclado usam a MESMA pilha do builder; `Ctrl+Y`/`Ctrl+Shift+Z` agora fazem **redo do builder** (`pnPlanRedo`, invalidado por ação nova, limpo em new/load); fora do builder, tudo vai pro histórico do app como antes.
- **Takeoff com preview linha a linha (fecha o #13)**: Add parts abre um modal onde CADA linha mostra como foi entendida (Qty × W × H + texto), tudo editável inline; linha ambígua é flagada ("⚠ 1 number(s) ignored"); linha não entendida entra desmarcada e é incluída ao digitar W/H; só o que está ✓ vira peça; o resto fica na caixa. Colar checklist continua direto (formato exato).
- **Parser fix pego pelo E2E**: `\d{1,2}` sem boundary fazia "100 x 600 x 400" virar **qty 40** (casava "40" dentro de "400") — `(?!\d)` adicionado; agora parseia 100×600 q1 com o 400 flagado no preview.
- **E2E comportamental no `check.mjs`** (pedido da auditoria): sandbox node executa o app INTEIRO (DOM/storage fakes + ids como globals implícitos) e assegura: boot vazio + número lazy (seq não consumida), basket padrão 300/60/360 c/ 12 peças, £75, **golden NC datum-ll regenerado byte-idêntico em runtime**, load transacional (arquivo rejeitado não toca em nada), reset completo + tool policy (biblioteca vence, tool nova adicionada, aviso), número gerado só no ensureOrderNumber (seq=1), contrato do parser do takeoff. Pulado no modo --hook (roda no check completo/CI).

### Testado (c)
`check.mjs` completo verde (incl. E2E novo) ✓ · preview: 4 linhas (ok / ambígua flagada / não entendida ✗ / qty2), confirm → 4 peças físicas e "lixo qualquer" fica na caixa ✓ · Ctrl+Y no Top View → "Nothing to redo in the builder" (roteado); appUndo em doors desfaz item ✓ · gap×kerf: 2 flushbacks → "kerf reaches 7.15… ≥ 7.2mm"; peça única → sem aviso ✓ · console limpo ✓.

## 2026-07-15 (b) — CAM: fix de segurança no all-live + Drilling de dobradiças + export Air-cut

Rodada "Pocket/Drill NC + air-cut" escolhida pelo Ednei. **Bug grave achado e corrigido**: o "Flushback all-live" de ontem cortava as layers não mapeadas (IN_22MM, POKET_INSERT, SHADOW, OFFSET_5MM) no **contorno da PEÇA** — o `tpOpRects` caía no fallback do part-rect, então "4mm In 18mm" recortava a borda da porta passante a 2mm pra dentro e o pocket do insert idem a 5.5mm. Goldens byte-idênticos (o refactor é contratual).

- **`tpOpRects` agora resolve a geometria real do flushback**: IN_22MM/OUT_10MM = anel(0) da cavidade · POKET_INSERT = banda anel(7)+anel(14) · SHADOW = anel(16) · OFFSET_5MM/IN no insert = anéis 6.9/11.95. **Bandas com lado por anel** (`rc.side`: anel externo inside + interno outside — nested reversal do VCarve, os dois kerfs caem DENTRO da banda). Layers desconhecidas cortam NADA (antes: contorno da peça); essas layers em peça não-flushback = NADA.
- **`tpPartMoves`**: sgn/dRough/dFinal por-rect (`rc.side||P.side`) — matemática idêntica sem rc.side.
- **Kind `drill` (copos de dobradiça)**: mergulho reto por centro (safeZ → XY → appZ → G1 no plunge feed → safeZ), centros = regra de produção do DXF/preview (inset 22.5 + hingePositions). **Profundidade OBRIGATÓRIA** (nunca assumida) — form manual "Drilling" (tool pré-seleciona a 1ª broca, hint com nº de furos no escopo, recusa sem depth); em template: op `{kind:'drill',layer:'hinges',params:{cutDepth:…}}` só entra live com depth explícita.
- **☁ Air-cut (destrava o P0)**: botão por chapa no Save NC — o MESMO arquivo com todo Z levantado +N mm (input, default 50, mín 10), sufixo `_AIRCUT+N`. X/Y/F/ordem/toolchanges/header/footer idênticos; `ncPegasus` intocado.
- **Fixes do cam-reviewer aplicados no mesmo commit**: Plain Shaker 18/22 ganharam `appliesTo.type:'flat'` (flushback+preset PS não recebe mais o stack redundante de 4 perfis OUT; flat+PS continua casando — testado nos 2 sentidos); form Drilling ganhou o aviso vermelho "exceeds material" (paridade com o Profile); o aviso de bed no Save NC só dispara pra drill quando a chapa tem peça com dobradiça.

### Testado (b)
Goldens ll/c byte-idênticos ✓ · rects pós-fix: cavidade 350×367@72 (In18/Insert-on), banda 364×381(out)+378×395(in), shadow 382×399@56, insert 364×381(in)/354×371(out) ✓ · NC 18mm Z∈[0,38] sem negativo ✓ · drill: recusa sem depth, 6 mergulhos Z5.000 (18−13) F3000, NC válido ✓ · air-cut: piso 5→55 (exatamente +50), XY byte-idênticos, header/footer ok ✓ · `check.mjs` ok ✓ · console limpo ✓ · cam-reviewer delta no commit.

## 2026-07-15 — Overflow do editor no DESKTOP (o "nem tudo aparece" do Ednei)

Follow-up do achado #11: mesmo no PC partes do editor estouravam o painel de ~313px. Auditoria programática (getBoundingClientRect em TODA a árvore do inspector/Toolpaths/Quote) achou **12 elementos vazando** — agora **0**.

- **Causa raiz**: `input[type=number]` tem largura intrínseca ~170px; `.ed-field{flex:1}` sem `min-width:0` não encolhe — o campo EMPURRA pra fora do painel (Width/Height +65px, linha Panels +169px). Fix global: `.acc-b/.insp-body .ed-field{min-width:0}` + inputs/selects `width:100%`.
- Linhas W/H/Panels e Internal rail/Bottom panel agora quebram (`flex-wrap` + min-width por campo) em vez de estourar.
- Card do Insert (Offset): o "nests on its own sheet · priced & machined" (+204px) virou linha própria (`flex-basis:100%`); selects com `max-width:100%`.
- Tree de templates (Toolpaths): badges longos ("⛔ needs 22mm material", "needs the Plain Shaker offset preset") eram CORTADOS pelo `max-width:90px` — agora quebram pra própria linha (`.tp-row{flex-wrap}` + `.sub2{overflow-wrap:anywhere}`), tudo legível.

### Testado
Auditoria de overflow: inspector CLEAN (era 12) · tpSide CLEAN (era 3) · quote CLEAN ✓ · flushback 2 painéis + backside custom + todas as seções abertas a 1280×800 ✓ · screenshot ✓ · `check.mjs` ok ✓ · console limpo ✓. (Mobile de verdade continua Fase 2 — isto cobre o desktop.)

## 2026-07-14 — Rodada de integridade (auditoria de 21 achados): load transacional, autosave, Tool DB protegida

Resposta à auditoria externa (P0/P1/P2). Zona guardada intocada em NC/preço: **goldens byte-idênticos** e baskets A/B **delta zero** (300/60/360 · 881/176/1057, contexto limpo).

- **Load `.fastcnc` TRANSACIONAL (#3)**: parse em staging; arquivo rejeitado não toca em NADA (job/toolpaths/serviços intactos — provado). **Reset completo no commit (#4)**: services/VAT/spray/machine/overrides/panelRooms/pnProj/históricos zeram antes de aplicar o arquivo — nada vaza do job anterior. **Panels-only restaura tudo (#5)**: kabacalQuote (serviços, VAT, camJob, camPaths) agora roda pros dois caminhos.
- **Cloud unlink (#2)**: `newProject()` e abrir arquivo local zeram `cloudJob` — "Update this cloud job" nunca mais sobrescreve o job errado. **Guard de concorrência (#19)**: update compara `updated_at` e pergunta antes de sobrescrever o que outra aba salvou; Archive não engole mais erro.
- **Tool DB protegida (#6)**: arquivo pode ADICIONAR tools desconhecidas (→ My Tools), mas conflito de id com valores diferentes = **biblioteca da máquina vence** + banner listando as divergências pra revisão. (Política invertível se preferir "arquivo vence".)
- **Autosave do job inteiro (#7)**: `kab_autosave` (payload buildFastCnc + vínculo cloud, debounce 800ms em todo captureHistory) restaurado no boot — Doors sobrevive ao reload como Panels/CAM já sobreviviam; número NÃO é regenerado. **Layout manual persiste (#8)**: `kabNest` aditivo no `.fastcnc` (placements arrastados/rotação + size/margin/gap por chapa + nestSize/custom) salvo e restaurado com keepPlacements.
- **Número lazy (#14)**: gerado só no 1º save/print/cloud-save (iniciais do cliente existem; reload não queima sequência). **Data local (#15)** (`localToday()` — BST não volta um dia). **Arquivos com número (#20)**: `<numero>.fastcnc.json` / `<numero>_18mm.dxf`.
- **Undo seguro (#9)**: Ctrl+Z/Y dentro de input/textarea = undo NATIVO do campo (app não intercepta); Esc fecha o modal genérico; `pnPlanHist` zera em new/load. **Preflight (#10)**: `frame ≥ part`, `rails don't fit` (painéis não cabem), `hinge off part` — bloqueiam export como os erros de tamanho.
- **Auto-template em toda entrada (#12)**: Quick Add e Takeoff/checklist chamam `tplAutoSyncItem` (Flushback via Quick Add ganha os 9 toolpaths na hora). **Takeoff sem perda silenciosa (#13)**: linhas não entendidas FICAM na caixa + status "X added · Y not understood".
- **Quote segue os campos do cliente (#16)**. **Reset pricing pede confirmação (#18)**. **Workshop Backup (#17)**: export ver 3 = pricing + materiais + empresa + presets + **Tool DB + templates de corte + camJob + doorTpl/offcutTpl**; cloud sync ganhou `kab_profiles`. **Banner NC (#1)**: aviso permanente no painel Toolpaths — "não validado em produção; dry-run em ar obrigatório".
- **Fase 2 (concordado, não incluído)**: mobile (redesign dedicado), a11y completa (modal ganhou role/aria/Esc/focus), preview linha-a-linha do Takeoff, sequência de número no servidor, redo do builder Panels, E2E.

### Testado
Arquivo inválido → job intacto (items/CAM/serviços) ✓ · load B pós-A: cloud null, services 0, VAT on, spray off, panels [] ✓ · tool conflito: t1 feed mantido + tz_new em grupo do arquivo + banner ✓ · panels-only: modo panels + services 2h + VAT off + camPaths + datum c restaurados ✓ · autosave: reload → items/client/número RT-001/cloud cj-77/margem 11/placement x+40 e rot round-trip ✓ · número vazio no boot, seq não consumida ✓ · preflight frame≥part / rails / flat puro limpo ✓ · takeoff: 3 peças + linha ruim na caixa ✓ · Quick Add flush → 9 toolpaths auto ✓ · Ctrl+Z em input não dispara undo do app ✓ · baskets A/B delta zero + £75 ✓ · goldens ll/c/dxf byte-idênticos ✓ · console limpo ✓.

## 2026-07-13 (yy) — CAM: Flushback tudo-ligado + novo template Plain Shaker (22mm + gêmeo 18mm automático)

Dois pedidos do Ednei:

1. **Flushback tudo ligado por padrão** — `tpl_flush18`/`tpl_flushins12` ganharam `allLive:true`; `tplApply` força `live=true` em toda op que tenha geometria (as ops de insert-pocket/recess/shadow não entram mais OFF; ops sem geometria seguem sem emitir nada). Goldens regenerados: `GOLDEN_TPL_S1_18mm.nc` **1525→2788** (agora **T1→T4→T2→T1**), `GOLDEN_TPL_S2_12mm.nc` **661→1174**.
2. **Novo esquema Plain Shaker** (convertido do `22mm Plain Shaker.ToolpathTemplate` + validado vs `22mm Plain Shaker.nc`) — gated no preset **Plain Shaker** (usa só OFFSET_A), recesso shaker **6mm**. 5 ops na ordem de corte (árvore binária revertida): ① pocket **T12 50.8 skim** 1 nível 6mm → ② **T1 6mm** acabamento de parede → ③ **T2 2mm** acabamento fino (3/6) → ④ **OUT T1 6mm** rebaixo (2.5/5/6 a **+0.4**) → ⑤ **OUT T1** offcut PASSANTE. Auto-aplica ao escolher o preset (as 5 ops LIVE, via a lógica normal — OFFSET_A/OUT). **Desafio 18mm resolvido**: `tpl_plainshaker18` = idêntico, só o offcut passa a 18 (o recesso continua 6mm — profundidade do shaker independe da chapa). Novos goldens `GOLDEN_PLAINSHAKER_S1_{22,18}mm.nc` (2570). Tools por id+num+dia (`t12skim508`/`t1`/2mm `v27b53e74`).

### Testado (yy)
`node tools/check.mjs` verde ✓ · **18 goldens**: 12 byte-idênticos, 2 TPL regenerados (all-live), 2 Plain Shaker novos — todos determinísticos (regen == disco, cache-busted) ✓ · **NC Plain Shaker 22mm bate ESTRUTURALMENTE com o de referência**: ferramentas **T12→T1→T2→T1**, rpm **12000/18000/16000/18000**, feeds **9000/8000/3000**, profundidades pocket→16 / T1→16 / T2→19,16 / OUT→19.5,17,16,0 ✓ · 18mm: recesso floor **Z12** (6mm de 18), offcut **Z0** (passante 18) ✓ · **segurança: min Z = 0 nos 4 NCs** (nada corta abaixo da mesa) ✓ · auto-apply: preset Plain Shaker → 5 ops LIVE (22 e 18); Flushback → **7 ops todas LIVE** (era 3/4) ✓ · sem erros no console. Só `index.html` + docs + 4 goldens. **Air-cut obrigatório antes de material real** (esquema novo — o offcut passa a chapa inteira num passe).

## 2026-07-13 (xx) — CAM: auto-aplicar o template de corte ao escolher door type/preset + Ogee 6mm 11.8→11.5

Dois pedidos do Ednei no CAM:

1. **Auto-apply na seleção** — os templates (Flushback, Ogee) SEMPRE estiveram lá e o auto-apply já existia (botão ⚡ Auto na aba Toolpaths); o que faltava era **disparar isso ao escolher o door type / preset NAS DOORS**, pra "o corte já ficar pronto". Novo `tplAutoSyncItem(i)`: quando o tipo/preset/espessura de uma peça muda e ela passa a bater 100% num template `auto`, o corte é montado sozinho. **Idempotente + auto-limpa**: nunca duplica um template já aplicado (manual OU auto) e remove só o SEU grupo auto (`grp.fromSel`) quando o match some (preset volta pra None, troca de tipo/espessura). `tplApply` ganhou `idsOverride`+`fromSel` (assinatura aditiva — chamadas antigas inalteradas); apply **item-scoped NÃO toca em salas de painéis** (painéis têm gatilho próprio). Ligado em `applyProfile` (preset) e `upd` (type/mat). Chip verde **"⚡ Cut ready: &lt;template&gt; · N/N ops live"** no editor de doors. Toolpaths manuais nunca são tocados.
2. **Ogee 6mm 11.8→11.5** — o op "6mm Pocket Finish" (T1) cortava a **11.8**, 0.3mm mais fundo que o pocket (11.5). Corrigido pra **11.5** (= fundo do pocket). Goldens Ogee regenerados: door **4 linhas** + panels **6 linhas**, todas `Z10.200`→`Z10.500`, tamanho idêntico (38555 / 57795).

### Testado (xx)
`node tools/check.mjs` verde ✓ · **16 goldens**: 14 byte-idênticos (auto-apply não perturba nada — toda receita zera `camPaths` antes do apply explícito, provado), 2 Ogee regenerados com diff **cirúrgico** (só a profundidade do pocket-finish; disco confirmado 0× Z10.200, 8×/12× Z10.500) ✓ · auto-apply E2E: Ogee preset → **5 ops LIVE**, re-selecionar **não duplica**, → None **remove**, → Ogee de novo re-aplica; flush type → **tpl_flush18 + tpl_flushins12 (7+2)**, trocar tipo remove; guarda contra duplicar grupo manual ✓ · **door auto-sync com sala Ogee presente = 5 ops, 0 de painel** (escopo door-only) ✓ · manual full apply ainda cobre painéis (5+5) ✓ · chip "Cut ready" montado no DOM real, sem erros no console ✓. Só `index.html` + docs + 2 goldens. Air-cut continua obrigatório antes de material real.

## 2026-07-13 (ww) — Nesting: peça maior que a chapa padrão sobe de tamanho sozinha (+ frame TBLR+MR no chip da peça)

Ednei abriu "James Frame DOORS + TOP Window.fastcnc" (do Drive) — o nesting saiu **uma bagunça**. Causa-raiz: o nesting agrupava por MATERIAL só e usava UMA chapa por material (`sheetMeta` = `sheetSizeOv || matSizeDef || nestSize`), ignorando o tamanho de chapa atribuído por peça. As molduras de janela (2463/2762/2850mm de comprimento) são MAIORES que uma 8x4 (2440mm), então não cabiam em nenhuma orientação e caíam no canto da chapa (fallback "oversize → keep"), estourando pra fora — **6 chapas, 5 com uma peça pra fora**.

Fix (zona guardada NEST_ENGINE, com evidência): `autoPack` agora agrupa as peças de cada material pela chapa que ELAS PRECISAM — a padrão quando cabe, senão a menor chapa que serve (novo `fitSheetSize`) — e nesta cada grupo no seu tamanho. **Job uniforme = UM grupo na chapa padrão (`szOv=null`) = byte-idêntico ao anterior.** `materialize`/`buildSheetGroups` gravam e honram o tamanho auto-escolhido na placement (override manual de tamanho ainda vence), então o layout continua certo após interação manual. **Resultado no James: 6→3 chapas, 0 overflow, 0 overlap, 10/10 peças** — pequenas na 8x4, molduras na 10x4 (exatamente o que ele tinha atribuído). Pricing é por-chapa (`priceForSheet(mat,s.sz)`), então tamanhos mistos já cotam certo (`uniform:false`).

Extra pedido: `frameLabel` (chip debaixo do tamanho na lista de peças) agora mostra **T B L R** (era T R B L) + **MR** (mid rail) pra portas multi-painel — ex. "frame T92 B295 L70 R70 · MR92".

### Testado (ww)
`node tools/check.mjs` verde + **novo teste de nesting** (peça 295×2850 sobe pra 10x4, não some, cabe dentro; peça que cabe mantém a padrão) ✓ · **goldens byte-idênticos** (GOLDEN_18mm.dxf 4517, GOLDEN_S1_18mm_datum-ll.nc 8358, GOLDEN_RICH_18mm.dxf 10893, QUOTE_standard 940, QUOTE_rich 2205 — job uniforme inalterado) ✓ · **James**: overflow 5→0, overlap 0, **10/10 peças**, **6→3 chapas** (8x4×1 + 10x4×2), quote `uniform:false` ✓ · path de placements (após `materialize`, = interação manual) também **0 overflow**, tamanhos mantidos ✓ · chip **T B L R + MR** conferido nas 7 peças ✓ · sem erros no console ✓. `index.html` + `tools/check.mjs` + docs.

## 2026-07-13 (vv) — Campos do frame (T/B/L/R) rótulados e maiores (Offset + Parts)

Ednei: os campos do frame — na seção *Offset* e no editor multi-painel (*Parts*) — estavam apertados/bagunçados, difícil ver onde digitar e onde clicar. Causa: o `.frame-ctl` inline usava inputs de **44px** precedidos por letrinhas minúsculas t/b/l/r que embolavam com `flex-wrap`. Trocado por um editor **compartilhado** `frameEditor(i,it,withApply)` que renderiza campos `.ed-field` rótulados **Top / Bottom / Left / Right** (ou "Frame · all sides" quando *link* ligado), do mesmo estilo de Width/Height, dentro de um `.frame-ed` (linha limpa, 4 campos de ~66×31px, gap 8px, toggle "link all sides" em linha própria; botão apply-to-all preservado na Offset). Usado nos DOIS lugares → consistente e sem duplicação de markup. Só UI, mesmos setters (`setFrame`/`setFrameSide`/`toggleFrameLink`) → geometria/DXF inalterados.

### Testado (vv)
`node tools/check.mjs` verde ✓ · **goldens byte-idênticos** (GOLDEN_18mm.dxf 4517, QUOTE_standard.json 940) ✓ · DOM real: 2 editores montados (Parts+Offset), 4 campos rótulados **66×31px numa única linha**, posições 28/102/176/250, gaps 8px, **sem sobreposição**, "link all sides" numa linha abaixo, cabendo no inspector de 328px ✓ · linked = 1 campo "Frame · all sides"; unlinked = Top/Bottom/Left/Right ✓ · sem erros no console ✓. Screenshots seguem travando no ambiente (verificado por medição no DOM). Só `index.html` + ROADMAP.

## 2026-07-13 (uu) — Editor multi-painel de portas: frame externo + rail interno + painel juntos num só lugar

Pedido do Ednei: no editor de portas com 2+ painéis, controlar separadamente (1) o frame externo, (2) o rail interno entre painéis, (3) o tamanho dos painéis — e que mexer no rail ou redimensionar o painel de baixo **não** altere os valores de frame/rail já editados; altura do painel medida a partir de **baixo** da peça.

**Descoberta (testado ANTES de mexer)**: o modelo JÁ fazia tudo isso. `frame:{t,r,b,l}` (frame externo por lado, com link/unlink), `midFrame` (rail interno, independente, `''` = igual ao topo), `panelSize` (opening de baixo em retrato, `''` = divide igual). `panelSegs`/`cavsFor` já são **referenciados por baixo**: subi a altura da porta 2000→2200 → painel de baixo ficou fixo em 700 e o de cima absorveu; com frame b=305 o opening de baixo encosta exatamente no frame de baixo (y+h = 2000−305). DXF == preview (`placedCavs`==`doorCavities`). O problema era só de **descoberta**: os controles estavam espalhados — frame na seção *Offset*, rail+painel na seção *Part*.

**Mudança (só UI — Ednei escolheu "consolidar num editor só")**: `secParts`, para portas multi-painel, mostra tudo junto — heading **Outer frame** com os 4 lados T/B/L/R (ou single quando *link*), **Internal rail (mm)** e **Bottom/Right panel (mm)** com a nota *measured from the bottom*. Reusa os setters existentes (`setFrame`/`setFrameSide`/`setMidFrame`/`setPanelSize`) → **zero mudança de geometria**. Porta de 1 painel inalterada (frame segue só na Offset). O `it.frame` aqui é o MESMO editado na Offset (sincronizado pelo `render()`). Código morto `tabPart` não tocado. **Gaps honestos não pedidos agora**: 3+ painéis só permitem dimensionar o de baixo (os do meio dividem igual); rail único entre todos os pares.

### Testado (uu)
`node tools/check.mjs` verde ✓ · **goldens byte-idênticos** (GOLDEN_18mm.dxf 4517, GOLDEN_S1_18mm_datum-ll.nc 8358, QUOTE_standard.json 940 — mudança é UI pura) ✓ · editor montado no DOM real (`#inspector`): Outer frame + T/B/L/R + Internal rail + Bottom panel + nota "from bottom" ✓ · editar frame de baixo 305→350 mantém **rail=100 e painel=500 intactos**, só `b` muda, e o opening de baixo passa a encostar em 2000−350=1650 ✓ · *link* toggle colapsa pro single (comportamento antigo preservado) ✓ · porta de 1 painel NÃO mostra o bloco de frame ✓ · sem erros no console ✓. Screenshots seguem travando no ambiente (verificado por DOM + saída da função). Só `index.html` + docs.

## 2026-07-13 (tt) — Revisão Paneling: offsets no Room Front View + inversão esquerda/direita em peça rotacionada

Revisão pedida pelo Ednei ("não é 100% certo, investiga e testa direito antes de assumir o bug"). Dois problemas, **ambos confirmados por teste numérico + E2E ANTES de mexer**:

- **Issue 2 (inversão L/R — o grave)**: a transform de rotação do `pnCellRects` era `{x:H0−y−h, y:W0−x−w}` — mapa de ponto (x,y)→(H0−y, W0−x), Jacobiano det **−1 = REFLEXÃO** (espelho na anti-diagonal). Numa peça de painel que o nesting **rotaciona** (comprovadamente acontece — ex. "Room 2 Wall 1A/B/C" rot=90), isso **trocava esquerda↔direita**: peça com frame lado-porta 175 e lado-vizinho 40 saía no DXF com os lados invertidos (margens upright L175/R40/B305/T80 → rotação CW correta = L305/R80, mas o código dava **L80/R305**). Doors NÃO tinha o bug (o par transpose+y-flip do `placedCavs` já é det +1 — control confirmado byte-idêntico no `GOLDEN_OGEE_S1_22mm.nc`, uma porta com 4 painéis rotacionados). Fix: **um termo** — `x:H0−r.y−r.h` → `x:r.y` — vira rotação 90° CW própria (det +1), idêntica à convenção das portas. Não-rotacionadas inalteradas.
- **Issue 1 (offsets no Room Front View)**: `pnPanoSvg` desenhava só o contorno das células, sem as linhas de offset (A–G) — sumiam ao ver a sala inteira. Adicionado o MESMO loop de inset por célula do `pnWallSvg` (usa `pnLinesFor(room)`, geometria real, não patch cosmético). Room view agora mostra os mesmos offsets do Wall view / DXF.

### Testado (tt)
`node tools/check.mjs` verde ✓ · **prova numérica** do espelho: 3 células quirais A→B→C dão orientação CCW upright; o `tf` antigo inverte pra CW (det −1), o novo preserva (det +1) ✓ · **E2E no app real**: peça assimétrica real (porta à esquerda → L175/R40) rot=90 agora **L305/R80** = rotação CW esperada (`fixedMatchesRotation`) ✓ · nesting DE FATO rotaciona peças de painel (reachability) ✓ · Doors control byte-idêntico (não tinha bug) ✓ · Room view: **0 traços de offset ANTES, 6 = igual ao Wall view DEPOIS** ✓ · **goldens**: 14/15 byte-idênticos; **só `GOLDEN_PANELS_18mm.dxf` mudou** (10038→10030) e a diff é EXCLUSIVAMENTE 60 coords Y em `OFFSET_A` das 4 peças rotacionadas (0 mudanças em OUT/SHEET/INSIDE/qualquer X) — assinatura exata da correção do espelho; golden regenerado no mesmo commit ✓. Só `index.html` + docs + golden. Air-cut continua obrigatório antes de material real.

## 2026-07-13 (ss) — Hardening dos toolpaths de painéis: stale-tracking + golden do NC

Fecha as duas pendências do bridge Panels→CAM (qq). **Stale-tracking (segurança)**: paths de painéis agora guardam `pp.pnSigs` (assinatura de conteúdo por sheet — `tpPanelsSig`: espessura + preset + linhas de offset + dims e células de cada peça). Editar a sala (mudar um offset, redimensionar parede, trocar preset) ou apagá-la faz a assinatura diferir → o path fica **STALE** (badge âmbar + "Remove stale", igual aos Doors) e **corta NADA** naquela sheet (`tpPathParts` faz uma checagem barata por-sheet com o `f` atual, sem re-nesting). Doors `pp.sig` intocado. **Golden do NC de painéis**: `GOLDEN_OGEE_PANELS_S1_22mm.nc` (57795 bytes) capturado por receita determinística (sala 22mm Ogee, parede 2600×3000 → 1 sheet/1 peça/6 células → template).

### Testado (ss)
`node tools/check.mjs` verde ✓ · E2E no app: fresh apply = **0 stale**, NC completo (5 segmentos T12/T1/T6/T11/T1, 579 cut-moves); editar offset D 17.5→12 → **5 paths STALE**, NC da sheet cai pra header/footer (**0 cut-moves**); re-aplicar regenera; apagar a sala → 10 stale, 0 panels sheets, sem crash ✓ · **isolação Doors intacta**: golden TPL das portas byte-idêntico com salas presentes; path escopado a portas corta 0 peças em sheet de painel ✓ · **15/15 goldens antigos byte-idênticos** + **golden novo `GOLDEN_OGEE_PANELS_S1_22mm.nc`** provado por DUAS vias (base64 do app decodificado em node = mesmo hash 2402723342/57795; e determinístico em 2 runs) ✓. Só `index.html` + docs + golden novo. Air-cut continua obrigatório antes de material real.

## 2026-07-13 (rr) — Bugfix urgente Doors: Enter duplo, qty 0, peça sumida, Ogee flat em peça rotacionada, ordem do frame

Ednei mandou `Issues James.fastcnc.json` (portas 300×2093/2040/1996 com frame assimétrico + Ogee). 6 bugs, todas de causa-raiz identificada e corrigida:

- **#5/#4 (raiz)** — cavidade/offset saíam **flat em peças rotacionadas** no nesting. `drawPart` (preview do app), `dxfForThickness` (DXF) e `tpOpRects` (CAM) chamavam `cavsFor(p.w,p.h,frame)` com as dimensões JÁ rotacionadas + frame lógico → cavidade negativa (300−92−305) → vazia. Novo helper **`placedCavs(p)`**: calcula a cavidade em dims LÓGICAS (top/bottom = altura, left/right = largura) e só depois transpõe pra placement rotacionado. Um único ponto, usado nos 4 lugares (app+DXF+CAM+preview de toolpaths) → app e DXF **sempre iguais**. 300×1050 @35mm (não rotaciona) inalterada.
- **#1 Enter adiciona 2** — havia DOIS handlers de Enter nos campos qaW/qaH/qaQ/qaText (o `onkeydown="qaEnter"` de cada campo **e** o keydown global). Removido o bloco do global; `qaEnter` cobre todos os campos (adicionado a qaMat/qaFrame). Um Enter = 1 peça.
- **#2 qty 0** — clamp `>=1` em 3 pontos: `mkItem` (add/programático), `loadFastCnc` (import — `num(0,1)` retornava 0), e `genParts` (rede de segurança final). Input `min="1"` + `onchange` clamp.
- **#3 "peça 6 não aparece"** — era CONSEQUÊNCIA do #2: a 5ª peça do arquivo tinha `quantity:0` → genParts gerava 0 partes → sumia. Com o clamp, aparece (5/5 nestadas).
- **#6 ordem do frame** — editor de 4 lados reordenado `[t,r,b,l]` → **[t,b,l,r]** (Top, Bottom, Left, Right).
- **#7 DXF == visual** — garantido pelo `placedCavs` compartilhado.

### Testado (rr)
`node tools/check.mjs` verde ✓ · **arquivo do Ednei carregado via `loadFastCnc`**: 5 itens, frames importados certos (top herda 92, bottom 305), qty da ex-0 = **1**, **5/5 peças nestadas em 2 chapas**, DXF com **30 polylines OFFSET** (6 linhas × 5 peças, layers A–F) — **não-flat** ✓ · peça rotacionada 300×2093: placed rot=90 (2093×300), `placedCavs`=1696×160 (antes vazio), 7 rects na peça na tela (OUT+6) ✓ · Enter único = **1** add (era 2), qty preservada 2 ✓ · qty 0 digitada → adiciona 1 com q=1 ✓ · 300×1050 @35mm rot=0, cav 160×945 (regressão OK) ✓ · ordem do frame **T,B,L,R** ✓ · **15/15 goldens byte-idênticos** (nenhum job golden tem porta com frame+linhas rotacionada → `placedCavs` idêntico ao antigo pra não-rotacionadas) ✓. Screenshots impossíveis (painel do browser travando no SVG pesado) — verificado por DOM+DXF. Só `index.html` + docs.

## 2026-07-12 (qq) — Panels → CAM bridge (Ogee nos wall panels)

Bloco 3: chapas de painéis agora são chapas de toolpath. `tpPanelsSheets()` mapeia cada chapa nested (por sala) com as peças carregando **células de shaker** (local y-down), linhas de offset da sala e nome do preset; `tpOpRects` resolve OFFSET_A..G nas células (`p.cells`); preview (`partCavs`) idem. **Regra de segurança**: chapa de painéis só corta paths EXPLICITAMENTE escopados a ela (`tpPathParts` guard) — paths legados/manuais/de portas nunca alcançam painéis. `tplApply` ganhou o ramo `tplApplyPanels`: salas com espessura+preset compatíveis recebem as 5 ops "— Panels" (sheet-scoped, mesmo GRUPO, sem sig — mudou a sala, re-aplica o grupo). `tplBlockReason` considera painéis (template disponível com zero portas). Chapas de portas SEMPRE primeiro no `tpSheets()` (receitas golden indexam [0]/[1] — contratual).

### Testado (qq)
check.mjs verde ✓ · E2E app real (limpo): sala 22mm + preset Ogee (room scope), 1 parede 2600 → 1 chapa painéis (peça com 6 células) → template DISPONÍVEL com zero portas → apply = 5 ops "— Panels" ON, 1 grupo → NC da chapa: **T12/S12000→T1/S18000→T6/S16000→T11/S15000→T1/S18000**, níveis Z 16.25/10.5/10.2/12.5/0 ✓ · gating negativo (sala 18mm → bloqueado) ✓ · **isolação provada**: path escopado a portas corta 0 peças em chapa de painéis (`pnGuard`) E golden TPL das portas **byte-idêntico com salas presentes** (`T18withRooms`) ✓ · **15/15 goldens byte-idênticos** (14 antigos + OGEE) ✓ · screenshot: chapa "MDF 22mm · Ogee Room" com 6 células (pocket pintado/anéis/banda) ✓. Pendências honestas: golden binário do NC de painéis (receita determinística a capturar) e stale-tracking dos paths de painéis.

## 2026-07-12 (pp) — Grupos de toolpath + preview fiel (linhas DXF reais, cores por ferramenta, pocket pintado)

Blocos 1+2 do pedido do Ednei. **Grupos**: cada `tplApply` vira um GRUPO (`pp.grp` aditivo — id/tpl/nome "#2" no reapply); lista agrupada com cabeçalho colorido (checkbox liga/desliga o grupo inteiro, contagem, lixeira apaga o grupo com confirm), membros indentados na cor do grupo; caminhos manuais viram "Manual toolpaths" (visual antigo preservado quando não há grupos). **Preview fiel** (`tpSheetSvg`): peça-alvo destacada na COR DO GRUPO do toolpath selecionado; cada peça mostra as linhas de offset REAIS (inset por cavidade, cores `OFFCOL` por layer) + a seção `PROFILE` no canto da chapa (tamanho real, igual ao DXF); toolpaths desenhados com **uma cor fixa por FERRAMENTA** (`tpToolCol`: T1 azul/T6 âmbar/T11 roxo/T12 verde) usando a geometria REAL (`tpOpRects`): pocket = área PINTADA + anel de contorno, sweep = banda rails→fora na largura da seção, anéis de offset no inset verdadeiro; branches legados (flushback OFFSET_A/POKET_INSERT/SHADOW/OFFSET_5MM) intactos; paths STALE não desenham.

### Testado (pp)
check.mjs verde ✓ · app real (limpo): 2 applies → 2 grupos com cores distintas ("Ogee Moulding 22mm"/"#2") ✓ toggle de grupo (g2 off → NC com 5 segmentos e **byte-idêntico ao GOLDEN_OGEE** — grupos não alteram NC) ✓ delete de grupo 10→5 ✓ SVG contém: highlight na cor do grupo, linhas verdadeiras (B 4.5/D 17.5/F 27), curva PROFILE, pocket `fill-opacity`, banda evenodd do sweep ✓ · screenshots da lista agrupada e do zoom (pockets verdes pintados, anéis âmbar do V, banda roxa do sweep) ✓ · goldens NC/DXF não tocados (mudança é UI/SVG).

## 2026-07-12 (oo) — Correções de exatidão VCarve no Ogee toolpath + bug real de ferramenta

Ednei rodou o template no app dele ("Ogee Kabacal.nc") e mandou o par de referência ("Ogee Vcarve.nc", job 600×400). A comparação expôs **1 bug grave + 3 divergências**, todas corrigidas:

- **BUG ferramenta errada em produção**: o `kab_tooldb` SALVO dele era anterior às ferramentas novas → fallback por número pegou "T12" de 2mm @S5000 e "T11" de 6mm @S18000 (pocket saiu com anel 444 em vez de 395.2). Fix duplo: **boot semeia** ids de fábrica faltantes na biblioteca salva (aditivo, edições do usuário por id vencem) + `tplResolveTool` tenta **num+dia** antes de num-só. Provado no app: db despojado → reload → ferramentas voltam, NC com S12000/S15000 corretos.
- **OUT padrão VCarve**: desbastes `10.5/21` com folga **+0.4** + passe FINAL exato a 22 **com ramp** (novo `rampLast`; `cutDepth` explícito vence o `depthList`). Anéis 606.8 rough + 606 exato = referência.
- **Pocket regra de linhas VCarve**: penúltima linha em `borda − passo/2`; serpentina **inverte a cada nível**.
- **V-bit ordem VCarve**: entra no **meio-direito**, ramp descendo a lateral, **horário**, quinas BR→BL→TL→TR, recover do ramp.
- Correção conceitual do Ednei registrada: ball 5mm = **MOULDING** (só `OFFSET_E`+`PROFILE`); 50.8 = **POCKET**.

### Testado (oo)
check.mjs verde ✓ · harness node vs "Ogee Vcarve.nc" (600×400): boundary 395.2 ✓ última linha borda−12.7 ✓ quinas V 465.0 com entrada meio-direita descendo (CW) ✓ OUT rough 3.6–610.4 + final 4–610 ✓ níveis 11.5/1/0 ✓ · **14/14 goldens antigos byte-idênticos** (caminho legado intacto — lastPass/anchor sem mudança quando os params novos não são usados) ✓ · **GOLDEN_OGEE_S1_22mm.nc regenerado (38246→38555)** e provado por DUAS vias independentes byte-idênticas (engine extraído em node vs app real, hash igual; peça nesta ROTACIONADA no 8x4) ✓ · seeding provado no app (localStorage sem os ids → reload → presentes + persistidos) ✓. **PENDENTE (próxima sessão, pedido do Ednei): UI de grupos de toolpath (on/off por grupo, delete em massa, cor por grupo/ferramenta), preview com linhas DXF reais + pocket pintado, e Panels CAM.** Air-cut continua obrigatório antes de material real.

## 2026-07-12 (nn) — Nome do preset no badge da PART (lista Doors)

Pedido do Ednei: quando a peça usa um preset de offset de verdade, o **nome do preset assume o badge** da linha na lista de parts — porta Flat com preset Ogee mostra "**Ogee**" (Flat vai pro tooltip: "Flat · preset Ogee"); ícone e cor continuam do tipo físico. `None`/`Custom` seguem mostrando o tipo. Helper `itemDispName` usado só no badge da linha (UI pura — genParts/DXF/NC/quote intocados).

### Testado (nn)
`check.mjs` verde ✓ · app real: 3 linhas → "Flat" (sem preset), "**Ogee**" (Flat+Ogee, tooltip certo), "**Plain Shaker**" (Traditional+preset) — screenshot ✓ · smoke de goldens pós-mudança: GOLDEN_18mm + QUOTE_standard + **GOLDEN_OGEE_S1_22mm** byte-idênticos ✓. Só `index.html`.

## 2026-07-12 (mm) — Toolpath template "Ogee Moulding 22mm" (pocket raster + sweep 3D + gating por preset)

Parte 2 do sistema Ogee: o template de toolpath casado ao preset pelo NOME, convertido do `Ogee Moulding 22mm.ToolpathTemplate` + validado contra o `Ogee Moulding 22mm.nc` de referência do VCarve. Decisões do Ednei: **T11=ball 5mm / T12=50.8 skim** (NC é a verdade, não o nome no template), **visível-mas-bloqueado** com motivo, **construir já + air-cut antes de cortar**, e **Panels também** (CAM de Panels não existe → próxima etapa grande; feito Doors primeiro porque a referência É uma peça com 4 cavidades).

- **Engine (CAM markers, tudo aditivo)**: `tpOpRects` (OUT/legado = contorno da peça; `OFFSET_A..G` = cavidades inset pela linha — a matemática do DXF writer); profile ganhou `depthList`, overrides `feed`/`plunge`, `vbit{deg}` (raio efetivo = prof·tan(θ/2)) e `cornerSharpen` (`emitSharpLap` com ramp+recover); **`kind:'pocket'`** (ramp vai-e-volta + serpentina 50% + anel de contorno por nível) e **`kind:'sweep'`** (anéis para fora dos rails, Z = seção PROFILE com projeção da ponta esférica, passo por arco 0.75, lift G0 0.75 entre anéis — igual ao NC de referência; exceção documentada no CONTRACT-CAM).
- **Gating genérico**: `appliesTo.offsetName` em `tplRoleLayers` + `tplBlockReason` (linha do template cinza + ⛔ motivo + Apply desabilitado). Ops em OFFSET_* só ficam LIVE quando a peça alvo tem a linha ativa (flushback continua exatamente como era — pockets off por default).
- **Ferramentas**: `t11ball5` (S15000 F10000/5000) e `t12skim508` (S12000 F9000/3000, passDepth 5.75, stepover 25.4) adicionadas ao bloco TOOLDB de fábrica (pipeline xlsx precisa readicioná-las se regenerar).
- **Template `tpl_ogee22`** (auto): ①50.8 pocket 5.75/11.5 → ②T1 anel 11.8 → ③T6 V 9.5 corner-sharpen → ④T11 sweep Ogee → ⑤OUT 10.5/21/22 — feeds pinados ao NC de referência (V-bit F9000 sobrepõe o F4000 do db).

### Testado (mm)
`node tools/check.mjs` verde (harness CAM legado intacto) ✓ · **14/14 goldens byte-idênticos** re-regenerados pelas receitas oficiais (incl. os 2 NC de template que exercitam tplApply) ✓ · **validação numérica vs o NC de referência** (harness node com o engine real + cavsFor + peça sintética cavidade 635×354.5): anéis F/E/D = 581×300.5 / 588×307.5 / 600×319.5, boundary pocket 530.2, anel T1 575.0, corner-sharpen alcança 600.0 na quina a Z22, sweep Zfirst 16.035 / Zmin 14.009 / Zmax 21.999 / Zlast 17.622 / largura 629.88, OUT 11.5/1/0 — tudo igual à referência ✓ · **E2E no app real** (contexto limpo): porta 735×1720 22mm Ogee 4 cavidades → `tplApply('tpl_ogee22')` = 5 ops LIVE → NC com segmentos T12/S12000 → T1/S18000 → T6/S16000 → T11/S15000 → T1/S18000, feeds {3000,5000,8000,9000,10000}, F4000 do db ausente (override venceu), Z floor 0 só no OUT ✓ · **gating provado**: 18mm → "needs 22mm material"; sem preset → "needs the Ogee offset preset"; 22mm+Ogee → disponível ✓ · **golden novo `GOLDEN_OGEE_S1_22mm.nc`** (38246 bytes CRLF) capturado com receita determinística ✓. **NÃO cortado em material real — air-cut obrigatório antes (risco 1).** Panels CAM = próxima etapa.

## 2026-07-12 (ll) — Preset polish: Ogee de fábrica + "Plain Shaker" + label "Preset" + botões

Refinamento pedido pelo Ednei em cima do *kk*: a UI agora diz "**Preset**" (não "Profile"), o **Ogee é built-in de fábrica** (A0/B4.5/C6.5/D17.5/E23.5/F27 + seção 20.94×8mm/118pts embutida — funciona sem importar), "Shaker" virou "**Plain Shaker**" e "All offsets" (só exemplo) foi **removido**. Save/Import viraram botões (`btn ghost tiny` no Doors, `pn-mini` no Panels); chips de preset não mostram ✕ nos de fábrica.

- **Compatibilidade de legado** (persistência aditiva intacta): `extProfiles` sanitiza conjuntos externos (arquivo `.fastcnc`/settings antigos) descartando as chaves legadas `Shaker`/`All offsets` e nunca deixando arquivo sobrescrever preset de fábrica; `normPresetName` mapeia nomes em itens (Shaker→Plain Shaker, All offsets→Custom) no `mkItem` e no takeoff. Arquivo velho carrega igual.
- Built-ins (`BUILTIN_PRESETS`) nunca salvos no `kab_profiles` e não deletáveis (`delProfile` guard).

### Testado (ll)
`node tools/check.mjs` verde ✓ · **14/14 goldens regenerados pelas receitas oficiais em contexto limpo e byte-idênticos** (G18 + RICH×4 + PANELS + WALL_LAYOUT + NC ll/c + TPL×2 + QUOTE std/rich/mixed) ✓ · app real (fresh, localStorage limpo): lista = None/Plain Shaker/Ogee; **Ogee de fábrica aplicado num item → DXF com OFFSET_A..F + PROFILE 1 polilinha/118 vértices SEM import** ✓ · sanitização provada no app: `extProfiles({Shaker,All offsets,Keep Me}) → {Keep Me}`; `normPresetName` Shaker→Plain Shaker/All offsets→Custom ✓ · built-ins fora do `kab_profiles` (`{}`) e `delProfile('Ogee')` bloqueado ✓ · UI verificada com screenshot: Doors "Preset: Ogee" + chip OGEE + linhas 0/4.5/6.5/17.5/23.5/27 ON; Panels "Offsets · PROJECT · OGEE · 6 ON" + botão ⬆ Import DXF ✓. Só `index.html` + docs.

## 2026-07-12 (kk) — Offset presets por import de DXF (Ogee) + layer PROFILE por chapa

Sistema de **preset de offset** escolhível na área Offsets, para **Doors e Panels**, com import de DXF (a parte de toolpath vem depois, casada pelo mesmo nome). Aproveita o registro `profiles` que já existia no Doors (dropdown "Profile", `applyProfile`, `it.offsetName`) e estende para os Panels.

- **⬆ Import DXF** (`offsetPresetFromDxf`): lê `OFFSET_A..OFFSET_G` (+ `PROFILE`) de um DXF e cria um preset nomeado. **`OFFSET_A` = frame = ZERO**; B..G = espaçamento **para dentro relativo a A** (média das 4 folgas dos bboxes), **nunca** a distância `OUT→A`; **`OUT` ignorado, nunca muda** (Frame=70 ⇒ A começa 70mm para dentro do OUT — o frame é a config da peça). `PROFILE` = polilinha da seção normalizada.
- **Layer `PROFILE`** (cor 177, aditivo em `DXF_LAYERS`): a seção da moldura é desenhada **UMA vez por chapa** (canto sup-esq, tamanho real, `dxfSheetProfiles`) em Doors (`dxfForThickness`) e Panels (`pnDxfForThickness`), só quando o preset usado tem perfil. Referência do toolpath de moldura, não corte. `OUT`/`OFFSET_*` inalterados.
- **Panels**: novo dropdown "Profile" + ⬆ Import no acordeão Offsets; nome guardado em `pnProjOffsetName` (Project) / `room.offsetName` (Room). Editar linha à mão volta para `Custom`.
- **Persistência aditiva** (nada renomeado): `kab_profiles` (com `.profile`), `.fastcnc` `kabacalQuote.profiles` + `panelProject.offsetName` + `room.offsetName`.
- **Ogee** (preset lido do DXF do Ednei): A0/B4.5/C6.5/D17.5/E23.5/F27 mm + seção 20.94×8mm (118 pts).

### Testado (kk)
`node tools/check.mjs` verde (compila + invariantes + PN engine) ✓ · **pós-push: TODOS os 13 goldens regenerados pelas receitas oficiais (tests/golden/README.md, contexto limpo) e byte-comparados IDÊNTICOS** — GOLDEN_18mm + RICH_{18,12,9,3}mm + PANELS_18mm + WALL_LAYOUT (DXF), datum-ll/c + TPL_S1/S2 (NC), QUOTE_standard/rich/mixed (invariantes exatos: £360 · £797/panels 0 · £3665/panels 2390) ✓ · **site AO VIVO verificado** (spaceinvuk.github.io/kabacal serve `offsetPresetFromDxf`/`dxfSheetProfiles`/`pnApplyProfile`/`importOffsetPreset` + `PROFILE:177`) ✓ · CI check + Pages deploy ✓ · derivação rodada nos DXF REAIS do Ednei (Node + no app, resultado idêntico): `A0 B4.5 C6.5 D17.5 E23.5 F27`, perfil `20.94×8mm/118pts` ✓ · **export Doors real** (via app): DXF 22mm com `OFFSET_A..F` + layer `PROFILE`(177) + **1 polilinha/118 vértices por chapa** + label "OGEE PROFILE" ✓ · **export Panels real**: `PANELS_18mm` com `OFFSET_A..F` + `PROFILE` + **2 polilinhas/236 vértices (1 por chapa, 2 chapas)** + `panelProject.offsetName=Ogee` ✓ · UI: dropdown "Profile" com Ogee selecionado + ⬆ Import DXF (Doors) e acordeão "Offsets · PROJECT · OGEE · 6 ON" (Panels) ✓. Só `index.html` + docs mudaram. Revisão de zona guardada: mudança aditiva (layer novo, nada renomeado), goldens byte-idênticos.

## 2026-07-12 (jj) — Fase 4 CONFIRMADA pelo Ednei (assinou/pagou/cancelou) + e-mails do Stripe ligados

Ednei rodou o loop 4242 ele mesmo: **assinou (Starter) → pagamento aceito → plano mudou → cancelou** — cadeia inteira validada em modo teste (app→função→Checkout→webhook→`accounts.plan/status`→portal). Cliente Stripe da assinatura = `edneilacerda@gmail.com` (ele logado como ele mesmo; a função mapeia o e-mail certo).

- **Pergunta dele: "não recebi e-mail nenhum"** → esperado, por DOIS motivos: (1) os toggles de e-mail do Stripe vêm desligados — liguei via o Chrome dele: Customer emails → "Successful payments"; Billing → Subscriptions and emails → "upcoming renewals" + "card payments fail". (2) **Modo TEST/sandbox do Stripe não entrega e-mails de cliente para caixas reais** (recibos/faturas só no painel) — então mesmo configurado, o Gmail só recebe em modo LIVE. Em produção, os assinantes passam a receber recibo + avisos de renovação/falha.
- **Recibo do pagamento já feito**: tentei reenviar pelo cliente `cus_Us5G72…`, mas o painel do Stripe entrou em erro nas páginas de detalhe (aviso "browser incompatível" com o navegador automatizado + incidente). Ficou para o Ednei (2 cliques no cliente → Invoices → Send) OU simplesmente não é necessário — o comportamento está correto.
- **Confirmação de marca Kabacal** (e-mail "você está no plano X" nosso, não recibo Stripe) = webhook + SMTP próprio, MESMA dependência dos magic-links de login (adiada junto).
- Repo: só docs (SAAS.md §Phase 4 live E2E, STATUS, ROADMAP). Nenhum código tocado; `check.mjs` verde. Nenhum pagamento executado nem segredo lido pelo agente.

### Testado (jj)
Loop de pagamento confirmado pelo Ednei (assinar/cobrar/cancelar) ✓ · cliente da assinatura = edneilacerda@gmail.com (função mapeia e-mail certo) ✓ · toggles de e-mail do Stripe ligados (Customer emails + Subscriptions) ✓ · reenvio de recibo bloqueado por erro do painel Stripe (não-crítico) · sem mudança de código.

## 2026-07-12 (ii) — Fase 4 PROVADA: chave corrigida → checkout Stripe real (HTTP 200 + página de assinatura)

Ednei recolou a Secret key da conta certa ("Colei"). Verificação definitiva sem depender do painel (que seguiu degradado — editores SQL/funções não hidratam, "Deploy status unavailable"):

- **Teste limpo**: numa 2ª conta do iso-a SEM linha de billing (`61dfa7da…`), `create-checkout-session` → **HTTP 200 + `https://checkout.stripe.com/c/pay/cs_test_…`**. Dirigi a URL no browser: página **"Subscribe to Kabacal Starter · £15.00 per month"**, e-mail `iso-a@…` pré-preenchido, método cartão. **Prova de que a chave nova está correta e toda a cadeia funciona** (app → função → Stripe).
- **Parei no clique de pagamento DE PROPÓSITO**: completar assinatura/pagamento (mesmo em teste, cartão 4242) é ação do humano — a própria Stripe mostra o attestation "I am an AI agent acting on behalf of someone else". Fica para o Ednei o clique final "Pay and subscribe"; depois o webhook vira o plano→starter e o portal cancela→beta.
- **Causa raiz confirmada do 500 anterior**: contas com resíduo (`billing_customers` órfão da chave errada — iso-a `cus_UrrZ`, iso-b `cus_Urt4`) quebram na função ATUAL (sem self-heal), porque ela reusa um customer que a chave nova não vê. **Conta nova não tem esse resíduo e passa direto.** Ou seja: usuários novos da beta já funcionam hoje; só as 2 contas de teste sujas precisam do patch.
- **Pendente (não bloqueia usuário novo)**: redeploy do patch self-heal `404b9f7` (bloqueado a sessão inteira pela UI de Edge Functions degradada) + limpar as 2 linhas órfãs (SQL editor fora; ou o self-heal as substitui). Tentativa de limpar via SQL escopado às 2 contas de teste: editor não hidratou; delete sem WHERE foi (corretamente) barrado pelo classificador.

### Testado (ii)
`create-checkout-session` na conta limpa = **200 + checkout URL válida** ✓ · página Stripe renderiza produto/preço/e-mail certos ✓ · função na conta COM resíduo ainda 500 (esperado até o redeploy) ✓ · flag OFF prístino, £180, goldens intactos, `check.mjs` verde ✓ · **nenhum pagamento executado e nenhum segredo lido/digitado pelo agente** ✓.

## 2026-07-11 (hh) — Fase 4 E2E: bloqueado por chave Stripe de conta errada + patch self-heal (redeploy pendente)

Rodada de teste do checkout 4242 (via app publicado + curl). Diagnóstico e correções:

- **Sintoma**: `create-checkout-session` → HTTP 500. Logs da função (antes da queda do painel): `Error: No such price: 'price_1Ts5JO...'`. Mas o `billing_customers` ganhou linhas novas (iso-a `cus_UrrZ...`, iso-b `cus_Urt4...`) → **a chave cria customers, logo é válida; só não enxerga os preços** = a `STRIPE_SECRET_KEY` salva é de OUTRA conta/sandbox Stripe, não a `acct_1Ts5DyJw3B6LYHCv` onde estão os 3 produtos + webhook. (Confirmado: página de produtos e de API keys ambas nesse acct, test mode.)
- **Ação do Ednei (única)**: recopiar a Secret key da conta certa (Developers → API keys de `acct_1Ts5DyJw3B6LYHCv`, começa `sk_test_51Ts5Dy…`) para o secret `STRIPE_SECRET_KEY` no Supabase.
- **Patch self-heal** (`404b9f7`, redeploy pendente): `create-checkout-session` verifica `stripe.customers.retrieve` no customer mapeado e **recria** se a chave atual não o vê (mata o resíduo órfão da troca de chave, em vez de 500 eterno); `create-portal-session` devolve 404 claro no mesmo caso. Precisa de redeploy — a UI de Edge Functions do Supabase ficou degradada durante a sessão (editores SQL/funções não carregavam; "Deploy status unavailable"), então o redeploy fica para quando ela voltar (ou `npx supabase functions deploy`).
- **Resíduo**: linhas de teste órfãs em `billing_customers` (iso-a/iso-b) — inofensivas, o self-heal as substitui; ou apagar via SQL depois.

### Testado (hh)
Botões de Upgrade aparecem e disparam a chamada (app publicado) ✓ · preflight CORS da função = 200 com `Access-Control-Allow-Origin` da origem do Pages ✓ · **checkout ainda 500 (No such price) — PENDENTE**: precisa da chave da conta certa + redeploy do patch · flag OFF prístino, £180, goldens intactos, `check.mjs` verde ✓ · nenhum segredo lido/digitado pelo agente ✓.

## 2026-07-11 (gg) — Fase 4: botões de Upgrade no modal ☁ (checkout/portal Stripe TEST)

Ednei colou os 4 secrets ("Salvei") → app ganhou o lado cliente do billing, tudo atrás do opt-in e só para OWNER:

- `CLOUD_DEFAULTS.plans` (3 price ids de teste, públicos por natureza; valores placeholder até D5); no estágio account do modal: plano `beta` → **"Upgrade — TEST mode, no real charges"** com Starter/Workshop/Pro; plano pago → **"Manage subscription…"** (portal). `cloudBilling(action,priceId)` chama as Edge Functions com o JWT da sessão (`apikey` + `Authorization`), redireciona para a URL do Stripe; erro vira `.cloud-msg`.
- Retorno do checkout: `?cloud=on&billing=success|cancelled` → o bloco de URL guarda `kab_billing_msg` (sessionStorage) antes do `replaceState`; no boot o modal abre com a mensagem e, no success, refaz `cloudFetchAccount` após 4s (webhook já terá virado o plano).
- Limitação anotada: o CORS das funções está preso à origem do Pages → botões de billing só funcionam no app publicado (dev local precisaria de allowlist de origem — não feito de propósito).

### Testado (gg)
`check.mjs` verde ✓ · com iso-a (owner, beta) o modal mostra os 3 botões + rótulo TEST mode ✓ · flag OFF prístino após limpeza (sem chip, sem supabase-js, £180) ✓ · goldens intactos ✓ · **E2E do cartão 4242 roda no app publicado logo após este deploy — resultados no addendum abaixo/STATUS**.

## 2026-07-11 (ff) — Fase 4 em MODO TESTE: Stripe sandbox configurado + 3 Edge Functions DEPLOYADAS

Ednei criou a conta Stripe e pediu para continuar do onboarding ("describe your business") → orientado a PULAR a ativação (é KYC para dinheiro real; sandbox funciona sem, e banco/documentos são sempre dele). Configurado via o Chrome logado dele:

- **Stripe sandbox** (`acct_1Ts5DyJw3B6LYHCv`): 3 produtos recurring GBP com valores placeholder de teste (D5 continua aberto — troca a qualquer momento): Starter £15 `price_1Ts5JOJw3B6LYHCvwvQk10OC` · Workshop £29 `price_1Ts5KXJw3B6LYHCvpAatHUPA` · Pro £59 `price_1Ts5L6Jw3B6LYHCvrfNPZnhQ`; webhook `kabacal-webhook` (`we_1Ts5TUJw3B6LYHCvgSrXSNXt`) → função supabase, 5 eventos, payload Snapshot; **signing secret nunca revelado ao agente**.
- **Supabase**: as 3 Edge Functions do repo **deployadas** pelo editor do painel (monaco.setValue byte-igual ao repo antes de cada deploy): `stripe-webhook` (JWT OFF — assinatura Stripe é a auth) · `create-checkout-session` · `create-portal-session` (JWT ON).
- **Política respeitada**: o classificador de permissões bloqueou escrita no secret-store até para valores não-sensíveis → os **4 secrets** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICES`, `APP_URL`) ficam TODOS com o Ednei — tabela pronta em `supabase/README.md` §Phase 4.
- Falta (nesta ordem): Ednei cola os 4 secrets → agente liga botões de Upgrade no modal ☁ + E2E com cartão 4242 (checkout→webhook→plan muda→portal cancela→plan volta).

### Testado (ff)
Produtos/preços conferidos nas páginas do Stripe (nome+valor+recurring monthly+Active, price ids capturados da URL) ✓ · webhook criado com 5 eventos (URL do wizard) e endpoint apontando à função ✓ · 3 funções aparecem deployadas nos Settings de cada uma; toggle JWT do webhook salvo OFF ("Successfully updated edge function") ✓ · nenhum secret/credencial digitado ou lido pelo agente ✓ · repo: só docs (nenhum código tocado nesta rodada; `check.mjs` verde no commit).

## 2026-07-11 (ee) — SaaS Fase 4 PREPARADA: tabelas de billing + Edge Functions Stripe + app respeita suspensão

"Pode começar a fase 4 até onde dá" → feito tudo que não precisa da conta Stripe do Ednei (que é grátis: sem mensalidade, só taxa por transação ~1.5%+20p UK; modo teste grátis para sempre).

- **Migration `0002_billing.sql` APLICADA no projeto hospedado** ("Success. No rows returned"): `billing_customers` (conta ↔ customer Stripe) + `billing_subscriptions` (espelho das subscriptions com `plan` resolvido, `raw` para auditoria). RLS deny-by-default: membros LEEM as próprias linhas, **nenhum grant de escrita para clientes — o webhook (service role) é o ÚNICO escritor** dessas tabelas e de `accounts.plan/status`.
- **3 Edge Functions completas em `supabase/functions/`** (Deno, npm:stripe@16, prontas para deploy — SÓ faltam os secrets do Ednei): `stripe-webhook` (assinatura verificada, `verify_jwt=false` no config.toml; checkout.completed + subscription created/updated/deleted; deriva plan/status: active/trialing→plano, unpaid→suspended, canceled→volta a beta, past_due→graça) · `create-checkout-session` (só OWNER, allowlist de preços via secret `STRIPE_PRICES`, CORS preso à origem do app) · `create-portal-session` (só OWNER, gerir/cancelar).
- **App (dark)**: `status='suspended'` → banner vermelho no modal ☁ + `cloudSaveJob`/`cloudPushSettings` bloqueados com mensagem; **leitura continua** (loja suspensa sempre consegue tirar os dados). Linha "Billing: Beta — free while the beta runs".
- **Testes de isolamento estendidos para 13** (`T10` cliente não escreve billing · `T11` B não lê billing de A · `T12` anónimo nada) — **13/13 verdes contra o hospedado**. Runbook de go-live (~30 min, modo teste) em `supabase/README.md`; D5 (valores dos planos) continua aberto.

### Testado (ee)
`check.mjs` verde ✓ · 0002 aplicada via SQL editor (monaco.setValue byte-igual, "Success. No rows returned") ✓ · **isolamento 13/13 vs hospedado** ✓ · enforcement no app (preview + projeto real, suspensão simulada em memória): banner aparece, Save/Push bloqueados com a mensagem, `cloudListJobs` continua funcionando, estado ativo mostra "Beta — free" sem banner ✓ · flag OFF prístino (£180) ✓ · goldens intactos ✓ · Stripe NÃO tocado (sem conta, sem secrets, sem deploy — por desenho).

## 2026-07-11 (dd) — SaaS Fase 3: configurações do workshop na conta (⇧ Push / ⇩ Pull) + contador de orçamento merge

"Segue!" do Ednei → Fase 3 atrás do mesmo opt-in `kab_cloud`. Resolve na prática o risco nº 3 do STATUS (config de negócio presa num perfil de navegador): a partir de agora um ⇧ Push guarda tudo na conta, e qualquer outro dispositivo ⇩ Pull.

- **Secção "Workshop settings" no modal ☁** (logado, com workshop): ⇧ **Push settings to cloud** / ⇩ **Pull settings from cloud**, ambos com confirmação DENTRO do modal (sem `confirm()` nativo); linha de estado mostra a data da cópia na nuvem (`cloudSettingsMeta`, buscada no login).
- **Fidelidade por strings brutas**: `CLOUD_SYNC_KEYS` = `kab_prices, kab_pricecfg, kab_custom_mats, kab_company, kab_tooldb, kab_doorTpl, kab_offcutTpl, kab_tp_templates` — as strings do localStorage viajam como estão em `account_settings.settings.keys`; o ÚNICO parser continua sendo os leitores tolerantes do boot (cópias na nuvem herdam o load-forever). Chave ausente na nuvem = removida localmente (espelho fiel). Device-only para sempre: theme/mode/favs/cores/camjob/campaths.
- **Pull = escrever chaves → `kab_seq` merge para CIMA (nunca regride; RPC atómico adiado até contas com 2º membro) → `location.reload()`** — o job na tela (e o vínculo `cloudJob`) atravessa o reload via stash em sessionStorage (`kab_pull_job`/`kab_pull_cloudjob`), com aviso "settings pulled" no modal depois do boot. Job grande demais para o stash aborta o Pull com instrução de salvar em arquivo primeiro.
- Update-first + insert-fallback no `account_settings` (upsert do PostgREST tocaria `account_id` sem grant). Corrigido de passagem no ARCHITECTURE.md: as chaves reais dos templates DXF são `kab_doorTpl`/`kab_offcutTpl` (o doc dizia `kab_door`/`kab_offcut`).

### Testado (dd)
`check.mjs` verde ✓ · E2E contra o projeto hospedado (Iso Shop A): marcadores (`company="Push Test Co"`, `kab_prices={"mat:TestMat":123}`, `kab_seq=7`) → ⇧ Push ok (meta atualizada) → divergência local (company "Changed Locally", prices removido, seq 3) + job "Carry Me" 1 item na tela → ⇩ Pull → reload → **company e prices restaurados da nuvem, seq foi para o MAIOR (7→8 pelo boot normal do genOrderNumber, comportamento pré-existente), job intacto (1 item, "Carry Me"), modal aberto com "Workshop settings pulled from the cloud", stash limpo** ✓ · flag OFF prístino após limpeza (sem chip/modal/supabase-js, company default, £180) ✓ · goldens intactos ✓.

## 2026-07-11 (cc) — SaaS Fase 2: jobs na nuvem (☁ save/update/open/archive) + página de login na frente do app

Ednei validou o magic link no app publicado ("o teste funcionou") e aprovou a Fase 2, pedindo uma "página antes da principal" para o login. Tudo continua atrás do opt-in `kab_cloud` — sem opt-in o app é byte-idêntico.

- **Welcome gate** (a "página antes"): com cloud ligado e ninguém logado, o modal de sign-in abre NA FRENTE do app no boot (1× por sessão de aba, `sessionStorage kab_cloud_welcome`); botão **"Continue without account"** pula — local-first preservado; logado nunca vê. Landing page real fica para a fase pública.
- **Jobs na nuvem no modal ☁** (estágio account): input de nome (default `cliente — nº ordem`), **☁ Save to cloud** (insert) vs **Update this cloud job** (mesmo row; `cloudJob` guarda o job de nuvem carregado nesta aba, limpo no sign-out) + **Save as a new cloud job**; **Open from cloud…** lista os não-arquivados (recentes primeiro, 50), clique carrega via `loadFastCnc` (leitor tolerante — rows antigos carregam para sempre); 🗑 por linha = **Archive** (soft delete; a UI nunca oferece DELETE). `job_json` = payload `buildFastCnc()` EXATO — compatibilidade `.fastcnc` intacta.
- **Bug achado E ficado pelo E2E**: `cloudOpenJob` fechava o modal sem liberar `cloudUI.busy` → todos os botões cloud seguintes ficavam mudos. Fix: libera busy antes do `cloudClose()`.
- `CLOUD_PHASE` 1→2; textos do modal atualizados (sem "arrives in Phase 2"). Docs: SAAS.md (§Phase 2 status + tabela de fases), ARCHITECTURE.md (linha Cloud), STATUS.md.

### Testado (cc)
`check.mjs` verde (3×) ✓ · E2E contra o projeto hospedado (tenant de teste Iso Shop A): save (insert) → +1 porta → **update reusa o MESMO row** (lista não duplica) → wipe da tela → **open restaura** (2 itens, cliente "Teste Cloud E2E", £180) → save-as-new cria id NOVO → lista 3 → archive → lista 2 e o arquivado some ✓ · welcome gate: abre sozinho deslogado, "Continue without account" fecha, **não** aparece logado nem 2× na mesma aba ✓ · sessão sobrevive a reload (login persistente) ✓ · busy liberado após open (regressão do bug) ✓ · flag OFF prístino: sem chip/modal/supabase-js, `kab_cloud` null, basket £180 ✓ · goldens intactos ✓.

## 2026-07-11 (bb) — Opt-in do cloud por URL: `?cloud=on` / `?cloud=off` (sem DevTools)

O Ednei esbarrou no aviso anti-self-XSS do Chrome ao colar o `localStorage.setItem` no Console — fricção inaceitável para beta users. Agora `?cloud=on` liga o device (grava `kab_cloud.enabled=true` e limpa a URL via `replaceState`), `?cloud=off` desliga (remove só o bit `enabled`, preserva overrides url/anonKey; remove a chave se ficar vazia). **Só o bit `enabled` é togglável por URL — url/anonKey continuam localStorage-only** (um link malicioso nunca pode apontar o app para outro backend). Bloco da flag no topo do script; nada guardado tocado.

### Testado (bb)
`check.mjs` verde ✓ · `?cloud=on` → chip ☁, `kab_cloud={"enabled":true}`, URL limpa ✓ · `?cloud=off` com override custom → chip some, `enabled` removido, `{"url":…}` preservado ✓ · default sem opt-in intacto (sem chip, £180) ✓ · repetido no app publicado após o deploy ✓.

## 2026-07-11 (aa) — SaaS Fase 1 AO VIVO (dark): projeto Supabase hospedado + 10/10 testes de isolamento + E2E real

Ednei criou o projeto (`rvmyalrtoblxmxciiovd`, org Kabacal LTD, eu-central-1) e pediu "faz o resto" → configurei via a sessão logada do Chrome dele: **migration 0001 aplicada** no SQL editor (colada via `monaco.setValue` — digitação por teclado corrompia com autocomplete, ex. `authenticated`→`authentication_method`; valor final byte-idêntico verificado antes do Run, "Success. No rows returned"); **signups DESLIGADOS** (invite-only); Site URL = Pages + redirects localhost 8123/8125; **3 users criados** (edneilacerda@gmail.com para o Ednei + fixtures iso-a/b@kabacal.test); chave **publishable** copiada (a secret ficou mascarada — nunca saiu do painel).

- **`tools/saas-isolation-test.mjs` contra o projeto REAL: 10/10 verdes** (sanity + T1–T9) usando os users pré-criados (modo sem service key): B não lê/escreve nada de A (conta/jobs/settings), colunas travadas (sem self-upgrade de plan, sem mover job de conta), DELETE de conta falha, anônimo vê nada.
- **App**: `CLOUD_DEFAULTS` (URL + publishable key, públicos por design) embutidos em `cloudCfg()` → o opt-in do device virou só `kab_cloud={"enabled":true}`; texto do modal ajustado para "link-first" (o mailer embutido usa template fixo SÓ com link — sem `{{ .Token }}`; o campo de código fica como secundário, já pronto para quando houver SMTP próprio).
- **E2E dentro do app** (preview + projeto real): chip ☁ Sign in → login real (user de teste, JWT verdadeiro) → `onAuthStateChange` → chip vira **"☁ Iso Shop A …"**, modal mostra e-mail/workshop/plan `beta`/role owner (leitura via RLS `account_members`) → Sign out volta a "Sign in"; OTP para e-mail desconhecido recusado **"Signups not allowed for this instance"** (invite-only provado no app).
- **Limite documentado (bloqueia convites, não o Ednei)**: mailer embutido entrega SÓ para membros da org e não edita template → **SMTP próprio (Resend grátis / caixa fastcnc) é o único pré-requisito antes de convidar betas**. `supabase/README.md` + `docs/SAAS.md` §Phase 1 atualizados; fixtures iso-* descartáveis documentadas.

### Testado (aa)
`check.mjs` verde (2×) ✓ · isolamento hospedado 10/10 ✓ (saída completa no chat; script re-rodável) · E2E: login/conta/plan/role/sign-out no app contra o projeto real ✓ · invite-only no app ("Signups not allowed") ✓ · **flag OFF re-verificado após embutir defaults**: sem chip, sem supabase-js, sem request, basket £180, `kab_cloud` null ✓ · goldens intactos ✓ · migration = "Success. No rows returned" + SQL do editor byte-igual ao repo ✓.

## 2026-07-11 (z) — SaaS Fase 1 DARK: login opcional completo, invisível sem opt-in (`kab_cloud`)

D1–D4 respondidos pelo Ednei (magic-link only · manter preços embutidos · sync total de negócio na Fase 3 · repo público) → `CLOUD_PHASE` 0→1 e o fluxo de sign-in inteiro entrou em `index.html`, mas **só renderiza quando o device seta `kab_cloud`** — sem opt-in o app é indistinguível do anterior (sem chip, sem DOM extra, sem NENHUM request novo). Zonas guardadas: nenhuma tocada.

- **Código** (+~175 linhas: CSS `.cloud-*` + bloco JS antes do boot + `cloudBoot()`): supabase-js `@2.45.4` lazy via CDN (padrão `loadTesseract`; sessão fica na chave própria `sb-<ref>-auth-token`, não `kab_*`); chip ☁ no `.appicons`; modal com estágios e-mail → código de 6 dígitos (`signInWithOtp` + `verifyOtp` — o e-mail serve link E código, padrão Notion/Slack) → conta (workshop/plan/sign-out) ou "Create your workshop" no primeiro login (insert em `accounts` SEM `.select()` — o RETURNING não enxerga a linha antes do trigger de membership; busca via `account_members` depois). Erros sempre no `.cloud-msg`, nunca travam o busy.
- **`tools/saas-isolation-test.mjs` (novo)**: os 9 testes de isolamento automatizados, zero deps — local (lê `supabase status`) ou hospedado (env vars); service key SÓ para criar os 2 users descartáveis, todos os checks com JWT de user. `supabase init` commitado (`config.toml`); README do supabase ganhou o runbook do script.
- **Bloqueio registrado**: Docker Desktop desta máquina nunca completou a primeira execução (WSL sem distro → engine 500) — stack local não sobe até o Ednei concluir o wizard uma vez; os testes de isolamento rodam contra o projeto hospedado ANTES de qualquer convite (obrigatório de qualquer forma).
- Docs: `docs/SAAS.md` (§Decisions D1–D4 + §Phase 1 status), `docs/ARCHITECTURE.md` (state registry, chave `sb-*`, Cloud tier), `AGENTS.md` (âncoras Cloud no mapa), `STATUS.md`.

### Testado (z)
`node tools/check.mjs` verde (3×) ✓ · **flag OFF byte-idêntico em comportamento**: sem `#cloudChip`, sem modal, `window.supabase` NÃO carregado (zero request ao CDN), quick-add 600×400 q2 → **£180 inc VAT**, console limpo, `kab_cloud` null ✓ · goldens não tocados (`git status tests/golden/` vazio) ✓ · **flag ON (config falsa 127.0.0.1:59999)**: chip "☁ Sign in" aparece, modal abre no estágio e-mail, Send → supabase-js carrega do CDN e o erro de rede vira `.cloud-msg` vermelho ("Failed to fetch"), busy liberado, estágio preservado ✓ · `{enabled:true}` sem url/key → card "not configured" ✓ · remover `kab_cloud` + `cloudChip()` → chip removido do DOM ✓ · **NÃO testado ainda (bloqueado pelo Docker/projeto hospedado): OTP E2E real e os 9 testes de isolamento** — ambos obrigatórios no projeto hospedado antes de convidar alguém.

## 2026-07-11 (y) — SaaS Fase 0: fundação (docs + schema Supabase + flag inerte) — SEM login, SEM mudança de comportamento

Pedido do Ednei: plano faseado para SaaS (login, contas/empresas, jobs na cloud, settings por conta, Stripe depois, beta privada 3–5 users) implementando SÓ o passo mais seguro. Zonas guardadas: NENHUMA tocada (pricing/DXF/CAM/nesting intactos; goldens intactos por construção). `index.html` ganhou só um bloco de flag no topo do script (+8 linhas, inerte).

- **`docs/SAAS.md` (novo, canónico)**: local-first para sempre (motores/`.fastcnc`/localStorage ficam primários; cloud = camada aditiva de sync/identidade); fases 0–5 com gates (1 login opcional magic-link → 2 jobs cloud → 3 settings por conta → 4 Stripe via Edge Functions → 5 público); modelo de dados; plano RLS; política de segredos (GitHub Pages nunca guarda segredos — service role/Stripe só em Edge Functions); auditoria do que o app público expõe hoje (PRICES, £75, fórmula 25/139/20, rates, toolDb) + o que migra para `account_settings` na Fase 3; plano Stripe futuro (tabelas billing_* + webhooks); plano da beta privada; decisões D1–D5 para o Ednei.
- **`supabase/migrations/0001_saas_foundation.sql` (draft, nada aplicado)**: `accounts` / `account_members` (owner por trigger) / `jobs` (`job_json` = payload `.fastcnc` exato) / `account_settings` (1 jsonb espelhando as chaves `kab_*` de negócio). RLS deny-by-default: anon revogado, policies só `authenticated` via `is_account_member/owner` (security definer, search_path fixo), grants por coluna (`plan`/`status` = só billing; `account_id` de jobs imutável — sem mudança cross-tenant).
- **`supabase/README.md`**: runbook de aplicação (CLI local com Docker primeiro, hosted depois), checklist da beta (signups DESLIGADOS, invite-only) e **9 testes de isolamento** obrigatórios antes de qualquer user real. `supabase/.env.example` só com placeholders; `.gitignore` agora bloqueia `.env*`.
- **Flag `kab_cloud` (18ª chave `kab_*`, aditiva)**: `CLOUD_PHASE=0` + `cloudCfg()`/`cloudEnabled()` no topo do script — gate duplo (fase no código E opt-in no device), hoje inerte por construção; login NÃO implementado de propósito (Fase 1 espera D1–D4). `AGENTS.md` (reading order), `docs/ARCHITECTURE.md` (chave nova + linha no state registry + secção Cloud tier) e `STATUS.md` (riscos 3/4 apontam para o plano, decision log, Next #4) atualizados.

### Testado (y)
`node tools/check.mjs` verde (2×: após edit e no fim) ✓ · boot local (preview 8125) sem erros de consola ✓ · `CLOUD_PHASE===0`, `cloudEnabled()===false`, `kab_cloud` ausente por defeito e NADA escrito no boot ✓ · gate duplo: `kab_cloud={enabled:true}` no device → `cloudEnabled()` continua `false` na fase 0 ✓ (chave removida depois) · workflow local intacto: quick-add 600×400 q2 → quote **£180 inc VAT** no chip vivo ✓ · round-trip Save/Load JSON (`buildFastCnc`→`loadFastCnc`): 1 bloco, item restaurado, quote £180 igual ✓ · goldens não tocados (`git status tests/golden/` vazio) ✓ · diff de `index.html` = só o bloco da flag (+8) ✓.

## 2026-07-11 (x) — UX round pedido pelo Ednei: topo legível + Doors "digita e vê o preço" (UI only, 1 commit reversível)

Rodada CTO/Arquiteto focada em facilidade de uso (Doors + topo; Panels ficou de fora DE PROPÓSITO — as rodadas *q*–*w* de outra sessão já cobriram o inspector/labels/openings do Panels; colidir seria retrabalho). Reversão: `git revert` deste commit desfaz o pacote inteiro.

- **Topo legível** (queixa explícita): os botões-glifo ✚ ⤒ ⤓ viraram botões com **ícone SVG + rótulo** — ✚ New · ⤒ Open · ⤓ Save · ⬇ DXF (o `decorateMenus` agora injeta ícone Lucide + label nos 4, em vez de substituir Open/Save por ícone mudo) + separador visual antes do toggle Doors|Panels + tooltips completos + fundo `var(--card)` (consertando o branco fixo no dark).
- **Doors — digitar tamanho ficou instantâneo**: **Enter** em Width/Height/Qty/Text adiciona a peça e devolve o foco na Width já selecionada (`qaEnter`) — 700 ⇥ 500 ⇥ 2 ⏎ e a próxima já pode ser digitada. A linha rápida (Material/Frame/Type/W/H/Qty) subiu pro TOPO do card; o Smart Takeoff desceu com o rótulo "…or paste a whole list / photo:".
- **Preço vivo no Order entry** (antes só existia na aba Quote): chip azul no cabeçalho do card — `£180 inc VAT` — atualiza a cada `render()`, clica → Quote, tooltip mostra "includes Wall Panelling £X" quando houver, e respeita Hide values (`£ •••`). (`updateOrderTotal` no fecho do render.)
- **Lista vazia orienta**: "📐 Type a size above and press Enter — 600 × 400 is already filled in" + dica da lista/foto e do chip de preço.

### Testado (x)
Header: 4 botões com svg+label + hsep (DOM) ✓ screenshot conferido ✓ · Enter adiciona 700×500 q2 e foca Width ✓ · chip £0→£180 vivo ✓ · Hide values → "£ •••" ✓ · title menciona Panels quando há rooms ✓ · empty-state ✓ · **goldens byte-idênticos: QUOTE_standard + NC ll + DXF 18mm** ✓ · `check.mjs` ok ✓ · console limpo ✓.

## 2026-07-11 (w) — Área de desenho FIXA (só o inspector faz scroll) + Openings dentro de Wall

**Só UI/CSS.** Zonas tocadas: layout do inspector dos Panels (`.pn-insp` CSS), Wall/Openings UI (Front + Top). NÃO tocado: geometria, motor, DXF/quote/nesting, layers, `.fastcnc`. **Goldens byte-idênticos** (browser: `GOLDEN_WALL_LAYOUT` 3428=3428, `GOLDEN_PANELS_18mm` 10038=10038); `check.mjs` verde; git só `index.html`; basket doors intacto (£300 doors / £3228 total).

- **1. Área visual fixa**: o inspector (`.pn-insp`) crescia com os accordions abertos (max-height `calc(100vh−20px)` ≈ 835) muito acima da área de desenho (`.pn-canvas` = `calc(100vh−282px)`); em ecrãs de portátil isso empurrava a página e a zona de desenho + toolbar desapareciam para cima. Reproduzido: a 650px de viewport o inspector ficava 616px vs canvas 368px → layout 616 → overflow 100px → o canvas movia-se. **Fix**: `.pn-insp` passa a `height:calc(100vh−282px);min-height:340px;max-height:calc(100vh−282px)` — PINADO à altura da área de desenho, nunca mais alto; só o inspector faz scroll interno (os botões de categoria `.pn-itabs` continuam sticky no topo do inspector). Verificado: layout = 368 = canvas, inspector com scroll interno, canvas/toolbar não se movem.
- **2. Openings dentro de Wall**: removida a categoria de topo `Openings`. Categorias agora: **Room / Wall / Panel / Corners / Export**. Dentro de **Wall**: Wall Setup / Wall ends / Panel on-off / Skirting / **Openings** / Notes. A secção Openings (editor da abertura selecionada + lista + adicionar Door/Window/Object) foi extraída para helpers `pnFrontOpeningsAcc(room,wall,L)` e `pnPlanOpeningsAcc(room,idx)` e colocada no separador Wall dos DOIS inspectores. Selecionar/adicionar uma abertura foca o separador Wall e abre o accordion Openings (`pnSelOpening`/`pnAddOpening`/clique no `.pno`/plan-op → `pnTab='wall'` + `pnAccOpen.o_sel`). Funcionalidade de aberturas inalterada (mover/editar/apagar; ficheiros antigos carregam na mesma — os dados vivem em `wall.openings`/`plan.openings`).

**Testado (browser local):** viewport 650px simulado → inspector nunca mais alto que o canvas (368=368), scroll só no inspector, canvas fixo; separadores de topo = Room/Wall/Panel/Corners/Export (sem Openings) no Front E no Top; Wall tem accordion Openings em ambas as vistas; adicionar Door/Window/Object a partir de Wall (3 aberturas, fica no Wall, editor "Selected — …" abre); editar (largura 777) e apagar OK; clique numa abertura no desenho foca Wall; goldens byte-idênticos; doors £3228; sem erros de consola; `node tools/check.mjs` verde.

## 2026-07-11 (v) — Inspector dos Panels em ACCORDION (estilo Doors) + scope de offsets + lados de painel Gap/Overlap

Ronda grande: UI + motor (opt-in) + persistência aditiva. Zonas tocadas: Panels UI/inspector, `PN_ENGINE` (overrides por painel + flag de conflito no compile), persistência (`kab_panels.proj`, `doc.panelProject`, `room.linesScope` — tudo ADITIVO), Front/Top view (visual de overlap). NÃO tocado: preços/quote, NC, nesting, layers DXF, campos `.fastcnc` existentes. `check.mjs` verde com testes novos; **goldens byte-idênticos** (browser, estado limpo: `GOLDEN_WALL_LAYOUT` 3428=3428, `GOLDEN_PANELS_18mm` 10038=10038 — recipes do README continuam a reproduzir byte-a-byte; basket doors-only £300/£360 intacto).

- **1. Accordion estilo Doors nas 6 categorias** (Room/Wall/Panel/Corners/Openings/Export mantêm-se como botões): dentro de cada categoria o conteúdo usa o MESMO padrão do inspector dos Doors (`.acc/.acc-h/.acc-t/.acc-hint/.acc-c/.acc-b` partilhados — estrutura/comportamento, sem copiar tipografia): secções colapsáveis com cabeçalho, **chip de estado** e seta ▸/▾; estado por-sessão em `pnAccOpen`; helper `pnAcc(id,título,chip,corpo,default)`. Secções inativas ficam compactas.
- **2. Bug do auto-scroll nos offsets CORRIGIDO** (reproduzido primeiro no LIVE: scroll 863→0 ao ligar/desligar ou escrever mm). Causa: `renderPanels()` reconstrói `root.innerHTML` → o scroll do `.pn-insp` resetava. Fix: captura scrollTop + campo focado (por índice de input, com selection) antes do rebuild e repõe depois (`focus({preventScroll:true})`). Local: 670→670 nas duas ações.
- **3. Offsets com scope Projeto vs Sala**: `pnProjLines` (A–G partilhadas) + `room.linesScope` `'project'|'room'`. Segmented "Scope: Project | Room only" no accordion Offsets. Project = default para todas as salas em scope project (editar muda todas); Room only = set próprio da sala. Legacy sem `linesScope`: qualquer linha ativa ⇒ 'room' (ficheiros antigos byte-idênticos), senão 'project'. Persistência aditiva: `kab_panels.proj.lines` + `.fastcnc doc.panelProject.lines`. Front view + Sheet DXF + Wall Layout DXF leem via `pnLinesFor(room)`.
- **4. Categoria Room reorganizada**: **Project Standards** (Thickness, frame, shaker target, match corner shakers, door allowance, alturas H/V + botão "↧ Apply standards to all rooms") / **Room Setup** (nome, sheet use, duplicar/apagar) / **Skirting & Sill** / **Offsets** / **Pricing (per sheet)** em ÚLTIMO. **Material → Thickness (12/18/22mm apenas)**: define a espessura no `room.mat` (família mantida; preços/DXF-grouping seguem) e, em salas desenhadas, sincroniza `plan.panelLayer.thickness` → o gap/overlap de canto segue a MESMA espessura. (A secção "Panel thickness" saiu de Corners — sem duplicação.)
- **5. Wall**: Wall Setup (largura/altura/direção/apagar) + **Wall ends (corners)** (Auto/Through/Butt/Overlap por extremo — mudaram de Corners para aqui, são da parede) + Panel on/off + Skirting (this wall) + Wall notes. **Lados de painel SAÍRAM do Wall.**
- **6. Panel**: Selected panel (editor por-painel com **Left/Right side: normal/joint/corner/column/door + GAP (−th) + OVERLAP (+th)**) / **Panel skirting** (NOVO UI: `wall.panelSkirt[pid]`, resolver painel > parede > sala — só o bottom desse painel move) / Panel notes / Shakers (whole run) / **Panel sides (this wall)** (sideL/R da parede, movidos para cá). Motor: `gap` encurta o lado do painel pela espessura REAL, `overlap` estende (pt = `plan.panelLayer.thickness` ou espessura do material — nunca 22 fixo); a grelha re-flui na nova largura; margem do lado gap/overlap = frame normal; `p.sheet` recalculado; nesting/quote seguem (opt-in).
- **7. Corners** = só comportamento global: gap priority, flip do lado do painel, match corner shakers + secção "How corners work". Zero controlos duplicados.
- **8. Visual do overlap mais claro**: Front view desenha a extensão como BANDA preenchida tracejada (roxa) sobre a altura toda + label a negrito "overlap +N"; parede e painel continuam separados no fundo ("Wall width: 1000 · Panel width: 1022/1044"). Top view mantém a banda a passar o nó + tag por canto.
- **9. Conflito de overlap (permitido, nunca bloqueado, visível a VERMELHO)**: (a) por-painel — peças ajustadas que invadem outra peça na mesma parede: ambas `p.conflict`, interseção pintada a vermelho + label "overlap conflict" + warning com mm; (b) por-canto — `pnPlanCompile` marca `cornerInfo.l/r.conflict` quando o extremo overlap encontra um vizinho through/overlap (butt/free = limpo); Front (banda vermelha "⚠ conflict +22"), Top (tag vermelha) e warning. Só ovPhys/overlap são verificados → layouts existentes (banda+lower de janela etc.) nunca são flagados.

**Testado (browser local + reprodução no live):** scroll live 863→0 (bug) vs local 670→670 (fix), foco preservado; Room = 5 accordions na ordem pedida (Pricing último) em AMBAS as vistas; Thickness só 12/18/22 e Material removido do Room; scope: sala nova = project, ligar B em project → `pnProjLines`, mudar para Room → set independente; Wall sem sides + com Wall ends; Panel com 7 opções de lado por-painel; overlap sideR: peça 2724→2742 (+18 = th real), conflito flag+warn+retângulo vermelho+label; panel skirt 400 → bottom 480 só nessa peça (outra mantém 305), src 'panel'; sala plan: 1000→1022 (um extremo)/1044 (dois), "Wall width: 1000 · Panel width: 1044", conflito vs vizinho through (⚠ vermelho top+front+warn) e limpo com vizinho butt (roxo); Doors OK (£300 doors + £2390 panels + VAT = £3228 exato); `node tools/check.mjs` ok (testes novos: gap/overlap 18 E 22, sem-override sem flags, conflito entre peças + warn, panel skirt por-célula, flag de conflito no compile 1022/limpo/false); goldens byte-idênticos como acima; sem erros de consola.

## 2026-07-10 (u) — Limpeza da UI dos Panels: labels legíveis + tabs no estilo Doors

**Só UI/CSS/SVG.** Zonas tocadas: Panels UI (status line, `pnWallSvg` Front view, `pnPanoSvg` panorama, CSS `.pn-itabs`/`.pn-itab`). NÃO tocado: `pnWallLayoutDxf`, `pnDxfForThickness`, NC, quote, motor PN. **Goldens byte-idênticos** (browser: `GOLDEN_WALL_LAYOUT` 3428=3428 e `GOLDEN_PANELS_18mm` 10038=10038 comparados = iguais); `git status` só `index.html`; `check.mjs` verde. Sem `/pricing-impact` (nenhum output de quote muda).

- **1. Removido "Prices are in the Quote tab"** da barra de estado do builder (`renderPanels`). Preços continuam escondidos das vistas de edição — só a mensagem saiu.
- **2. Labels da panorâmica (`pnPanoSvg`) já não sobrepõem**: a 2ª linha por parede era `wall X · height 3200 · panel Y · click to open` (longa → colidia em paredes estreitas). Agora `wall X[ · panel Y]` — sem `height` (repetido em todas as paredes) nem `click to open` (ruído). "Wall N" continua a negrito por cima. Reproduzido no `James Test` / Ensuite 2 (6 paredes).
- **3. Labels de baixo da Wall view (`pnWallSvg`) sem repetição**: era `wall X · panel Y` (topo) + `Panel width: Y` (baixo) + o número do segmento — o tamanho do painel aparecia 2–3×. Agora UMA linha limpa: **`Wall width: {medida}   ·   Panel width: {físico}`** (o "Wall width" a negrito/ink; só mostra "Panel width" quando difere por gap de canto/overlap). O número por-painel só aparece quando o run está realmente dividido (não repete o painel único).
- **4. Dimensão da janela deixou de aparecer em baixo**: os bordos das aberturas já não entram na cadeia de cotas → o segmento `1200` da janela (Wall 4) desapareceu; a janela mantém o seu label `1200 × 1100` dentro dela.
- **5. Letras dos painéis mais visíveis**: a letra (`Wall 1A`…) passa a `<tspan>` a **negrito 800 + cor ink** (Front view font 10→11; panorama 8.5→9), mantendo o tamanho a muted — legível sem dominar. (A letra no Wall Layout DXF não mudou → golden intacto.)
- **6. Tabs dos Panels no estilo dos botões de edição dos Doors**: `.pn-itab` passou a botão preenchido (`var(--input)`), borda 1.5px, texto `var(--ink)` legível, cantos 8px, hover como o `.tp-op`; selecionado a azul claro; barra com fundo `var(--head)` e separadores `--line-strong`. Consistente com o accordion/`.tp-op` dos Doors, sem mudar o significado das tabs.

**Testado (browser, `James Test` só leitura — ficheiro do Drive NÃO alterado):** status sem texto de preço; panorâmica Ensuite 2 sem `height`/`click to open` (linhas curtas, sem overlap); Wall 4 (janela) → sem `1200` em baixo, `Wall width: 1902 · Panel width: 1858`, letra `A` a peso 800/ink; Wall 2 (gap) → `Wall width: 1000 · Panel width: 978` (sem repetição); 6 tabs preenchidas/legíveis, ativa a azul; sem erros de consola; `node tools/check.mjs` → `kabacal check ok`; DXF goldens byte-idênticos.

## 2026-07-10 (t) — Wall Layout DXF com mais detalhe + panorâmica compacta + frame da porta na preview

Três correções pedidas. **Zonas protegidas tocadas:** DXF export (`pnWallLayoutDxf` — golden `GOLDEN_WALL_LAYOUT`). NÃO tocado: `pnDxfForThickness`/`buildDxfByThickness` (Sheet DXF), NC, quote, motor PN. `check.mjs` verde. Prova de goldens: `GOLDEN_PANELS_18mm` byte-comparado no browser = **idêntico**; os restantes 7 sheet/NC/quote goldens inalterados (git); só `GOLDEN_WALL_LAYOUT` mudou (23 linhas, **todas numéricas** = posições da Wall 2 pela nova folga), regenerado no mesmo commit.

- **Bug 3 — frame da porta desaparecia com offsets diferentes por lado (só PREVIEW)**: `offsetPreview` só desenhava o retângulo exterior + as linhas de offset ativas — **nunca o próprio frame/cavidade**. Uma porta com frame por-lado (ex. Baixo 305) e sem linha de offset ativa aparecia como um retângulo liso. Reproduzido no caso exato (≈1900 alt, L70/R70/T70/B305): a matemática (`cavityOf`/`cavsFor`) estava correta (cavidade 460×1525) e o DXF já saía certo — era **só rendering**. Fix: a preview desenha SEMPRE a cavidade/frame (tinta no exterior + cavidade branca tracejada), consciente de lados diferentes (o rodapé de 305 mostra uma banda inferior mais funda). Sem alteração de output/preço/golden.
- **Bug 1 — Wall Layout DXF demasiado simplificado**: já desenhava parede/painéis/labels/tamanhos/gaps de canto/cavidades shaker, mas **não as linhas de offset/pocket** adicionadas ao room. Agora, para cada cavidade, insere as linhas A–G ativas (`room.lines`, exatamente como o Sheet DXF `pnDxfForThickness`) → **offsets/pockets adicionados depois aparecem no Wall Layout DXF**. Verificado: com A+B ativas o DXF ganha camada `OFFSET_B` (31 grupos); sem offsets, cai para `OFFSET_A` (cavidade), como antes. Também: label **"overlap +N"** nos extremos com overlap; o Sheet DXF (corte) fica inalterado.
- **Bug 2 — panorâmica com espaço a mais entre paredes**: DXF `GAP 250→110` e `ROOMGAP 700→300`; panorama visual (`pnPanoSvg`) `gap 420→160` (redução de ~62%, bem mais de metade). Ordem mantida (Wall 1, 2, 3…). Para os labels não colidirem com a folga apertada, a fonte do label da parede no DXF encolhe para caber na largura da parede (paredes largas continuam a 60).

**Testado (browser, porta 8125):**
- Bug 3: preview do caso exato (L70/R70/T70/B305, ≈1900) — antes: 1 retângulo (sem frame). Depois: exterior + cavidade tracejada com banda inferior mais funda (305) e laterais/topo 70. Par e ímpar dos lados desenham; a peça física/DXF não mudam.
- Bug 1: room com `room.lines` A(0)+B(30) → `pnWallLayoutDxf` inclui `OFFSET_A`+`OFFSET_B`; sem linhas → só `OFFSET_A`.
- Bug 2: `pnPanoSvg` gap=160 (era 420); Wall Layout DXF Wall 2 a x=2710..4310 (era 2850..4450). Sem sobreposição de paredes/labels.
- `GOLDEN_WALL_LAYOUT` regenerado (3428 bytes, LF, sem CRLF) via recipe do README; diff = só posições. `GOLDEN_PANELS_18mm` idêntico. `node tools/check.mjs` → `kabacal check ok`. Sem impacto de preço (nenhum output de quote mudou).

## 2026-07-10 (s) — Bug do painel VERTICAL colado a uma porta (folga da porta ignorada)

Ficheiro real do Drive **JamesTEST.fastcnc.json** ("James Test SNC"), sala **Ensuite 3 · Wall 2**. Engine (`pnZonePieces`, dentro do `PN_ENGINE`). Os 8 goldens de chapa + `GOLDEN_WALL_LAYOUT` **byte-idênticos** (nenhum golden tem zona colada a porta); `check.mjs` verde com novo teste. Sem impacto no preço (tamanho físico da peça inalterado → nesting idêntico).

- **Reproduzido no ficheiro real** (não num caso em branco): Wall 2 = 1620, porta 820 à esquerda (x=0) + **painel vertical** (`vZones` z34) colado à direita [820,1620]. A PORTA parte a banda corretamente em TODAS as vistas (Front/Top/panorama/DXF/nesting) — nenhum painel atravessa a abertura. **O defeito**: o lado do painel vertical virado para a porta usava a folga de junta **40mm** (`'joint'`) em vez da **folga de porta 147mm** (`doorAllow`) que um painel HORIZONTAL recebe ali. O shaker do painel vertical começava a 860 (só 40mm da porta) e **invadia a zona de folga da porta** [820,967].
- **Causa**: `pnZonePieces` decidia o `lRule`/`rRule` da zona só por estar (ou não) na EXTREMIDADE da parede (`'joint'` para qualquer bordo interior) — nunca olhava para uma porta adjacente. Diferente do `pnWallSpans`, que já aplica `'door'→doorAllow` aos vãos horizontais depois de uma porta.
- **Correção** (mínima, 4 linhas): a zona passa a olhar o que ENCOSTA a cada bordo (helper `abut`): extremidade da parede → `wall.sideL/R`; **porta → `doorAllow`**; objeto → frame normal; outro painel a meio → `joint`. Espelha exatamente o `pnWallSpans`. O retângulo FÍSICO da zona não muda (continua [820,1620], 800×1300) — só a cavidade/shaker interior recua para respeitar a folga da porta.
- **Rendering vs geometria**: era **bug de geometria gerada** (as `cells` do painel, que alimentam Front view, Sheet DXF `OFFSET_A` e Wall Layout DXF), não só rendering. Agora o shaker começa a 967 (147 = doorAllow), igual a um painel horizontal ao lado da mesma porta.

**Testado:**
- Ficheiro real carregado do Drive (via `loadFastCnc`), Ensuite 3 / Wall 2. Antes: lado-porta = `joint` 40mm, shaker a x=860 (40 da porta). Depois: lado-porta = `door` 147mm, shaker a x=967 (147 da porta). Peça física 800×1300 inalterada.
- Sem regressões: Wall 5 (porta + painel horizontal) mantém lado-porta `door` 147; Ensuite 2 Wall 6 mantém `door` 175; zona a meio de parede (sem porta) mantém 40/40. Nenhuma peça sobrepõe uma porta em nenhuma parede.
- Front view: cadeia de cotas 820 (porta) + 800 (painel); shaker desenhado com 147 de folga. Top view: porta continua a partir a banda em [820,1620]. Nesting/Wall-Layout: peças idênticas (1300×800 / 800×1300) — sem painel "demasiado longo".
- `node tools/check.mjs` → `kabacal check ok` (novo teste "door-adjacent vertical zone" + teste de não-regressão da zona a meio de parede). Goldens byte-idênticos.

## 2026-07-10 (r) — Inspector dos Panels organizado em separadores (tabs)

Só UI/rendering — o bloco `PN_ENGINE` NÃO foi tocado. Os 8 goldens de chapa + `GOLDEN_WALL_LAYOUT` byte-idênticos; `check.mjs` verde (sem alterar testes).

- **6 separadores, IGUAIS no Front (elevação) e no Top (construtor 2D)**: **Room / Wall / Panel / Corners / Openings / Export**. Estado `pnTab`; `pnInspTabs(head, tabs)` desenha a barra + o separador ativo; só aparecem separadores com conteúdo. Selecionar parede/painel/abertura foca automaticamente o separador certo. **Nenhuma opção foi removida** — cada controlo da antiga lista longa está agora sob exatamente um separador.
- **Room** = defaults do room (material, frame, alvo shaker, door allowance, alturas, rodapé/sill, chapas, preços, linhas de offset A–G, duplicar/apagar room). **Wall** = tamanho da parede + painel on/off + lados + rodapé desta parede + notas + apagar parede (+ ajuda do construtor + comprimento/espessura/altura/travas no Top). **Panel** = shakers do run / grelha vertical + override por-painel + notas do painel (quando um painel físico está selecionado). **Corners** = extremo **Auto/Through/Butt/Overlap** por lado + prioridade do gap (curta/longa/winding) + virar lado do painel + espessura do painel + match corner shakers. **Openings** = editor porta/janela/objeto + lista + adicionar. **Export** = Sheet DXF + Wall Layout DXF (todas as salas + só esta sala).
- **Helpers partilhados**: `pnWallPanelSections` passa a devolver **partes nomeadas** `{onoff,panel,sides,skirt,notes}`; `pnCornerTabHtml(room,wi)` monta o separador Corners a partir de qualquer vista; `pnSetWallEnd(wi,which,val)` define `endA/endB` a partir do Front OU do Top (o Front não tem `pnPlanSel`, resolve a edge pelo id da parede). O controlo Overlap por-extremo agora também está acessível no Front, não só no Top.

**Testado (browser, junction W:\…\Kabacal ↔ C:\…\Documents\CNC App, porta 8125):**
- Reload sem erros de consola (antes e depois de mexer nos separadores).
- Top view, sala em L (2 paredes): barra com os 6 separadores; Wall ativo por defeito.
- Conteúdo por separador confirmado no DOM: Corners = "Wall 1 ends" (Start=Auto/Overlap num extremo livre, End=Auto/Through/Butt/Overlap num canto) + "Corner gap priority" + "Panel side" + "Panel thickness" + "Corner shakers"; Panel = "Shakers (whole run)"; Room = "Room defaults"; Openings = "Openings on this wall"; Export = "Export DXF"; Wall = Builder + geometria + Panel layer + Wall sides + Skirting + Wall notes + apagar.
- Front view mostra os **mesmos 6 separadores**.
- **Overlap end-to-end (no separador Corners)**: pt22, 1 extremo → measured 2000 / painel 2022 (+22); pt18, 1 extremo → 2018 (+18); pt18, 2 extremos → 2036 (+36 = 2×18); repor (auto) → 2000/2000. Texto do inspector: "measured 2000mm → panel 2022mm (panel 22mm · frame 80) … End — Overlap: panel EXTENDS +22mm past the wall end". Confirma: usa a espessura REAL (não 22 fixo) e a medida da parede fica SEPARADA do painel físico.
- `node tools/check.mjs` → `kabacal check ok`.

## 2026-07-10 (q) — Opção manual "Overlap" no canto/extremo da parede

Engine de canto (só salas de PLANO) + rendering. Default (sem overlap) → GOLDEN_PANELS byte-idêntico; check.mjs verde (+ teste overlap 22/18).

- **Overlap = o painel ESTENDE-SE `pt` para além do fim da parede** (canto externo/return), o oposto do butt (que encurta). Novo valor no controlo por-extremo: **Start/End: Auto / Through / Butt / Overlap** (Overlap disponível também num extremo livre). `endInfo.extend=pt`, `shorten=-pt` → `wmm=measured+pt` por extremo. Usa a espessura REAL: 22 → +22 por lado (1000→1044); 18 → +18 (1000→1036). Comprimento medido da parede NÃO muda.
- **Label parede ≠ painel** em todo o lado: tab, front view, panorama, inspector e Wall Layout DXF mostram a MEDIDA da parede (1000), e o painel físico (1044) aparece à parte. Marcador roxo "overlap +22" no Top view e no Front view; o painel desenha-se a passar para além do fim da parede.
- Corrigido também o cálculo `measured` (era `Math.max(w,measured)` → mostrava o painel maior no overlap; agora prefere `wall.measured`). Regras: Butt encurta `pt` · Overlap estende `pt` · Through = frame+pt · Normal = frame normal.

## 2026-07-10 (p) — Comprimento digitado exato + prioridade do gap no canto (curta/longa)

Rendering/edição do plan + inferência de canto (só salas de PLANO). GOLDEN_PANELS byte-idêntico; check.mjs verde (+ teste longgap).

- **Comprimento digitado é EXATO (item 4)**: ao escrever o comprimento da parede no inspector, já NÃO arredonda a 10 mm — 886 fica 886 (e 1234 fica 1234). `pnPlanShift(...,exact)` salta o `pnR10`; arrastar/desenhar continua a snap a 10 mm. Propaga a tudo (label, front view, top view, Wall Layout DXF) porque a fonte é o coord do nó → `eLen` (arredonda só a 1 mm). Provado no browser: 886→886, 1234→1234.
- **Prioridade do gap no canto (item 5)**: novo controlo "Corner gap priority: Shorter wall / Longer wall / Winding". `plan.cornerMode='longgap'` inverte a inferência — a parede MAIS LONGA encosta/leva o gap, a mais curta passa. Default = 'auto' (mais curta leva o gap, byte-idêntico). Só muda o tamanho físico do painel/gap; comprimento medido inalterado; override manual por canto (endA/endB) continua a mandar; regra through=frame+pt / butt=frame normal+gap mantida. Provado: 2000/1000/2000 default → gap na de 1000 (956); longgap → gap nas de 2000 (1978), a de 1000 passa inteira.

## 2026-07-10 (o) — Spec de janelas: implementados os itens sem conflito (default + aviso)

Análise do spec de janelas/objects/painéis-mistos do Ednei. Implementado só o que NÃO conflita com regras confirmadas/goldens (default de posição + aviso). Geometria/engine grande (degrau lateral da janela, degrau H/V, painéis acima/abaixo de Object, fusão de horizontais) fica para confirmação — perguntas enviadas no chat. GOLDEN_PANELS byte-idêntico, check.mjs verde.

- **Auto-posição da janela nova**: fica depois da porta (+ `doorAllow` de folga); se não couber, antes da porta; senão centrada; sempre dentro da parede (`pnAutoWindowX` no front + lógica igual no plan). Só muda o DEFAULT de uma janela nova (o golden fixa `ow.x` → inalterado).
- **Aviso de colisão com folga de frame**: `pnOpCollisions(wall,gap)` — duas aberturas a menos de um frame agora avisam (⚠), não só quando se sobrepõem. Só afeta o aviso, não a geometria.
- **Painel ABAIXO de um Object elevado** (Ednei confirmou "modelo completo"): Object com `Bottom > 2×frame` cria um painel horizontal do piso à base do Object (largura do Object, juntas nos lados), espelhando o painel inferior da janela; a banda já parte no Object → preenche o vazio por baixo. Object no piso → sem inferior; folga < 2×frame → sem tira inútil. Cap por cima mantém-se. Golden-safe (nenhum golden tem Object elevado). Teste no check.mjs. **Falta (confirmado, mas preciso de 1 detalhe de junta antes de cortar material): degrau lateral da janela + degrau H/V — pergunta no chat.**
- **Confirmado já OK no engine atual** (sem mudança): painel único inteiro por baixo da janela baixa (não é dividido, mesmo largo); Bottom=0 → sem painel inferior; Bottom≥H painel → sem inferior; X limitado a [0, W−largura]; consistência preview=peças=nesting=DXF (fonte única `pieces`); vertical ≤1200 + auto-split; painel inferior/cap sempre horizontal.

## 2026-07-10 (n) — Painéis sempre dentro da sala, label parede≠painel, Wall Layout DXF horizontal

Zona guardada: rendering do top view (`pnPlanEdgeFrame`), labels, Wall Layout DXF. Sheet DXF/quote/engine **inalterados** → GOLDEN_PANELS byte-idêntico, check.mjs verde. Só o `GOLDEN_WALL_LAYOUT.dxf` muda (de propósito, item 3): 3501→3428, regenerado.

- **Painéis num lado CONSISTENTE (item 1)**: o lado interior (`sInt`) passa a ser decidido por **traversal + winding** — `pnPlanChain` traça as paredes numa cadeia ordenada e cada painel fica no mesmo lado rotacional da travessia (sinal pela área shoelace). Substitui o produto-escalar com o centróide (falhava em salas não-convexas) E o point-in-polygon ingénuo (a cadeia ABERTA, ao fechar-se implicitamente, auto-intersecta → painéis alternam dentro/fora = o bug da "escada"). Sala fechada simples → interior verdadeiro (todos dentro, provado na U); cadeia aberta (escada) → uma face coerente. Fallback centróide em junções T/X. Override: **`plan.flipInside`** ("⇄ Flip panel side") vira a sala toda de uma vez. Provado: U de 8 paredes → antigo 3 FORA / novo 0; escada de 5 paredes → antigo alternava, novo TODOS consistentes (mesmo lado); retângulo cw/ccw/misto → todos dentro; flip inverte a sala inteira e mantém consistente.
- **Label parede ≠ painel (item 2)**: a parede mantém o comprimento medido; só o painel encurta. Tabs/panorama/inspector do front agora mostram o **tamanho medido da parede** (Wall 2 = 600×3200, não 578) e o painel (578) aparece à parte como "panel …". `Math.max(w, measured)` = parede; `w` = painel físico.
- **Wall Layout DXF HORIZONTAL/panorâmico (item 3)**: paredes lado-a-lado ESQUERDA→DIREITA na ordem da app (antes empilhadas na vertical). Label da parede = medida da parede, labels dos painéis = tamanho físico. Sheet DXF inalterado.

Testado (n): U concava → old 3 fora / new 0; retângulo cw/ccw/misto todos dentro; flipInside inverte sInt; wall tab "Wall 2 · 600×3200" (não 578); wall2 measured 600 / panel 578; Wall Layout DXF Wall 1 x=0..2600 / Wall 2 x=2850..4450 (horizontal), labels "wall 2600 x 3200" + "panel 800 x 1030"; GOLDEN_WALL_LAYOUT byte-idêntico ao novo (3428); GOLDEN_PANELS byte-idêntico; check.mjs verde.

## 2026-07-10 (m) — Top view: labels legíveis em cantos com muitas paredes curtas

Só **rendering do top view** (`pnPlanSvg`) — sem engine/DXF/quote. GOLDEN_PANELS + GOLDEN_WALL_LAYOUT byte-idênticos; check.mjs verde.

- **Font por parede**: nome + medida + label de abertura agora escalam ao COMPRIMENTO da própria parede (`wfs = max(fs·0.2, min(fs, L·0.17))`) em vez de um tamanho global gigante. Paredes normais/longas ficam iguais (100% do fs); paredes curtas/em cluster ganham labels pequenos que cabem. Offsets também reduzidos.
- **Tags de canto (through / butt −N) só na parede SELECIONADA** — antes eram 2 por canto em todas as paredes e empilhavam-se. Sem seleção o desenho fica limpo; seleciona uma parede para ler os cantos (o inspector também lista). O gap do butt continua visível na própria geometria.
- **Nós (bola + cadeado) escalam ao menor comprimento de parede que toca o nó** — clusters densos ganham marcadores pequenos, paredes longas mantêm o tamanho normal.

Testado (m): staircase de 9 paredes (216–2320mm) → sobreposições de labels 10+ → **1** (só a parede de 216mm); sala normal 4200×3000 → labels a 100% (inalterada); selecionar parede curta mostra 2 tags legíveis; GOLDEN_PANELS/WALL_LAYOUT byte-idênticos; check.mjs verde; console limpo.

## 2026-07-10 (l) — Regra de canto confirmada, janela, shaker no canto (L/U), Wall Layout DXF

Zona guardada: **engine de corners + janela + shaker grid + DXF**. Corner rule só afeta salas de PLANO (não-plano + 8 goldens de chapa byte-idênticos, 7 comparados no browser). Janela: fix real + novo default; golden `GOLDEN_PANELS` mantém-se byte-idêntico (recipe fixa `ow.bottom=900`). cornerMatch default OFF = byte-idêntico. Novo golden `GOLDEN_WALL_LAYOUT.dxf` (3501). check.mjs: novos testes (corner rule U+L+exemplo 2000/1000/2000 a 22 e 18; cornerMatch OFF/ON; janela sem overlap).

- **Regra de canto CONFIRMADA (item 1)** — invertida para o que o Ednei confirmou: **Through = frame + espessura do painel**; **Butt = frame normal + GAP físico (= espessura)**. A parede fica no comprimento medido; só o painel do lado butt encurta. Ex.: frame 80 + pt 22 → through **102**, butt **80** + gap **22**. Parede 2 de 2000/1000/2000: medida 1000, painel **956**, frame 80 nos dois lados, gap 22 em cada ponta. (Era o contrário desde 2026-07-08; agora corrigido.) `cornerInfo.{l,r}` agora tem `{cond,shorten,gap,allowance}`.
- **Janela (item 6)** — bug real corrigido: só se cria painel INFERIOR quando a base da janela está DENTRO da banda (`60 < bottom < bandH`). Se `bottom >= bandH` (janela no topo/acima da banda) a banda fica inteira e NÃO se cria painel inferior — antes um painel inferior de altura total sobrepunha a banda não-entalhada ("painéis por cima de painéis"). **Novo default da janela = altura do painel** (topo da banda) → nunca corta a banda. Testado: default/no-chão/dentro/acima = 0 overlaps.
- **Shaker consistente no canto L/U (item 5)** — `room.cornerMatch` (opt-in, default OFF = byte-idêntico). `pnRunGrid(run,D,count,endW)`: com `endW>0` fixa os shakers das PONTAS de cada run à largura partilhada (target da sala) e os do meio flexibilizam → o último shaker de uma parede == o primeiro da adjacente mesmo num canto L/U (runs separadas). Testado: OFF 363/386, ON 350/350 nas duas paredes. Runs `joint` encadeadas continuam a igualar o seam. Igualdade total ao virar 90° continua adiada (runs são lineares) — isto fixa a célula da ponta, que é o canto visível.
- **Wall Layout DXF (item 7)** — 2º tipo de DXF, SEPARADO do Sheet DXF: `pnWallLayoutDxf` desenha as paredes empilhadas na ordem da app (Parede 1 em cima), cada uma no contorno medido completo com os painéis dentro, gaps de canto e labels (Wall N / Wall NA…). Camadas `WALL`/`WALL_GAP` (novas, aditivas) + `OUT`/`OFFSET_A`/`INSIDE`/`text`; sem `SHEET`/`PART_NUMBER`. Botões `⬇ Sheet DXF` (corte, como antes) e `⬇ Wall DXF` (layout visual). Golden novo.

Testado (l): check.mjs verde (+corner rule/cornerMatch/janela) · exemplo 2000/1000/2000 → Wall2 956(22)/964(18), frame 80, gap 22/18, through 102/98 · janela default bottom=1030, 0 overlaps em todos os casos · cornerMatch OFF 363/386 vs ON 350/350 · Wall Layout DXF: labels "Wall 1  2600 x 3200"/"Wall 2  1600 x 3200", painéis "Wall 1A/1B/2A", camadas WALL/OUT, sem SHEET, byte-idêntico ao golden (3501) · 7 goldens de chapa byte-idênticos · toolbar Sheet DXF+Wall DXF, cornerMatch toggle · console limpo · screenshot front view Wall 2 (956, butt −22).

## 2026-07-09 (k) — 2D Builder: simplificar controlos, settings no Top view, painel on/off, winding

Zona guardada: **engine (noPanel skip + winding)** — mas ambos default-off → produção inalterada; **7 goldens comparados byte-a-byte = idênticos** (2 NC, GOLDEN_18mm.dxf, GOLDEN_PANELS_18mm.dxf, QUOTE_standard/rich/mixed). Resto = UI/interação do builder. Testes novos no check.mjs (noPanel = 0 peças; winding auto=`tt,bb,tt,bb` idêntico + modo winding difere e é 1-through-1-butt por canto).

- **Controlos simplificados (item 1)**: removidos os toggles visíveis **Mode**, **Keep 90°** e a ferramenta **Pan**. Ficam Draw/Select na toolbar; botão do meio = pan, roda = zoom, Delete apaga, Ctrl+Z desfaz. Keep-square fica ON automático (interno).
- **Settings no Top view (item 2)**: o inspector do Top view mostra as mesmas regras do Front view via `pnWallPanelSections` — Painel on/off, Shakers (ou grelha vertical), lados da parede, rodapé, notas — + bloco **Room defaults** (material, frame, shaker target, door allowance, alturas de painel, rodapé). Já não é preciso ir ao Front view para configurar.
- **Painel ON/OFF por parede (item 6)**: desligar tira o painel do quote/DXF/nesting mas mantém a parede no desenho. Flag em `edge.noPanel` (plan) → `wall.noPanel` no compile → capturado pelo undo granular + save/load. Top view mostra "· no panel". Default off → goldens idênticos.
- **Sem preços nas vistas do builder (item 3)**: a barra de status mostra só sala · parede · nº de painéis. Totais só na aba **Quote** — clientes não veem £ interno a desenhar.
- **Winding / direção de desenho (item 4)**: `pnPlanCompile` calcula o **winding** (shoelace da cadeia de edges) e guarda em `cornerInfo.winding`. `plan.cornerMode` = **auto** (default, parede maior passa = comportamento atual, byte-idêntico) | **winding** (opt-in: a parede que CHEGA passa, a que SAI encosta, invertido no anti-horário → returns/columns consistentes). Ordem/direção de desenho preservadas; override manual por canto continua a mandar. ⚠️ **A confirmar (Ednei)**: qual painel fica com o comprimento total no caso anti-horário (a descrição do item 4 é o inverso da regra confirmada de frame+pt) → por isso winding é opt-in, não default.
- **Nomes de canto (item 5)**: **Through corner** vs **Butt corner** consistentes no Top view, Front view e inspector (mantido do round j).
- **Hit targets (item 7)**: prioridade endpoint/lock → abertura → parede → vazio. Raio do endpoint agora ~24px de ecrã (era ~140px, roubava cliques de parede perto dos cantos); snap de desenho fica ~40px. Círculos dos nós continuam subtis.
- **Adicionar várias aberturas (item 8)**: `pnPlanAddOpening` resolve a parede a partir do edge OU da abertura selecionada, e o inspector da abertura tem +Door/+Window/+Object → depois de mover uma porta dá para continuar a adicionar sem re-selecionar a parede.
- **Clearance menos alto (item 9)**: marca do front view agora ~40–90px (≈12% da altura, junto à base), proporcional ao board, não uma barra alta; tick do top view cinge-se à profundidade do painel.
- **Porta/janela (item 11)**: porta quebra o band (2 segmentos), janela fica cutout limpo (1 band) — preservado.

Testado (k): check.mjs verde (+ testes noPanel/winding) · Top view sem Mode/Keep90, toolbar sem Pan · Top view mostra Panel on/off + Shakers + Wall sides + Skirting + Room defaults + Corner rule · status "Prices are in the Quote tab" (sem £) · painel OFF em e2 → 0 peças, total 6→5, `edge.noPanel` salvo, undo repõe 1 peça · winding: auto `tt,bb,tt,bb` / modo winding `tb,tb,tb,tb` (1-through-1-butt) · hit: clicar polígono da parede → seleciona edge, clicar no canto → agarra nó · add door→mover→add window→add door→add object todos funcionam (2 portas+1 janela+1 objeto) · porta 2 / janela 1 band · console limpo · 7 goldens byte-idênticos.

## 2026-07-09 (j) — Refinamento pós-teste do 2D Builder / Panels (11 itens)

Zona guardada tocada: só **rendering do top view + front view + measure + interações do builder (undo/delete/pan)**. NÃO tocou engine/DXF/quote/NC → **goldens byte-idênticos** (7 comparados byte-a-byte no browser: 2 NC, GOLDEN_18mm.dxf, GOLDEN_PANELS_18mm.dxf, QUOTE_standard/rich/mixed — todos idênticos; os restantes saem dos mesmos writers já provados).

- **Join externo em ângulos não-90° (top view)**: parede agora faz **miter** no canto (interseção das faces externas — `pnPlanMiterOut`). Vizinhos partilham exatamente a aresta nó→miter → sem sobreposição (fim das manchas escuras de opacidade dupla) e sem gap, em qualquer ângulo. Ponta livre / junção 3+ = ponta quadrada no nó. Parede mais suave para o painel teal dominar. Resolve itens 9 e 10 (parede contínua, não retângulos empilhados).
- **Nomes de canto** (item 2): **Through corner** (tag "through" teal, corre completo) vs **Butt corner** (tag "butt −N" vermelho, para curto). No top view (tags no desenho) e no inspector. ⚠️ O utilizador descreveu a lógica ao contrário da regra confirmada/golden (through=frame+pt vs butt=normal) — **não invertido sem confirmar** (mudaria layout das células + GOLDEN_PANELS). A ver no relatório.
- **Clearance subtil (front view)** (item 1): marca curta na base + label `butt −N`, já não uma faixa vermelha por toda a altura da parede.
- **Consistência de shaker no canto** (item 3): o engine **já faz** — `pnRoomRuns` encadeia paredes horizontais ligadas por `joint` numa run só, e `pnRunGrid` força a célula do seam igual dos dois lados (último shaker de uma parede = primeiro da seguinte). Preservado. Não aplica através de canto `corner`/butt nem horizontal↔vertical (runs separadas) — coordenar isso = risco a contagens/goldens, adiado.
- **Measure**: label **acima** da linha (offset perpendicular, item 4); snap às **extremidades da parede inteira** além das bordas do painel encurtado (item 5) — dá para medir parede toda E painel curto no canto.
- **Botão do meio = pan**, nunca desenha (item 6); **Delete** apaga parede/abertura selecionada se não bloqueada, senão avisa (item 7); **Ctrl+Z granular** no builder (uma ação de cada vez, isolado do undo dos doors — não desfaz o projeto todo) (item 8).
- **Porta/janela** (item 11): porta quebra o band do painel (2 segmentos), janela fica cutout limpo (1 band) — preservado com o refactor do miter.

Testado (j): check.mjs verde · miter partilha ponto exato (2 paredes @ n2 → (4041,100) idêntico) · junção 3-edge cai para quadrado · top view sem "clr" antigo, com "through"×N e "butt −22"×2 · front view sem faixa vermelha full-height, com "butt −22" + snap wx0/wx1/borda-painel presentes · measure label 16px acima na horizontal / ao lado na vertical · undo granular (door→len→lock desfaz 1 a 1) · Delete: parede solta apaga, parede com canto bloqueado avisa, abertura apaga · MMB→pan/LMB→draw/RMB→nada · porta 2 segmentos / janela 1 · 7 goldens byte-idênticos · console sem erros · screenshot: sala retângulo fechado com cantos contínuos + porta a quebrar o band.

## 2026-07-08 (i) — Correções pós-teste: janela sobreposta, Measure, locks duplicados, quebra de porta, clearance no front, join externo

Bugs achados no teste. Zona guardada: **engine (janela)** muda saída → `GOLDEN_PANELS_18mm.dxf` regenerado (10036→10038, motivo abaixo); os outros 7 goldens byte-idênticos. Resto = rendering/interação (top/front view).

- **Janela sobrepondo painéis (engine)**: quando há painel inferior (window bottom>60), o notch do band agora vai até o CHÃO na coluna da janela (antes só o retângulo da janela → o band cobria 0..bottom por cima do painel inferior = a sobreposição). Corrige a bagunça de painéis empilhados. **Único golden afetado**: GOLDEN_PANELS (a receita tem uma janela) — regenerado + verificado byte-a-byte; QUOTE_mixed inalterado (mesma contagem de chapas/peças).
- **Largura de painel vertical**: já clampava em 1200 (zona vertical) — verificado (2218→1200, sobra refila; parede mantém medida). Travado por teste no check.mjs.
- **Measure seguia o mouse errado**: `pnSnap` usava rect manual, mas o SVG do front view é letterboxed (preserveAspectRatio="meet") → offset/lag. Agora usa `getScreenCTM().inverse()` (exato com zoom/pan).
- **Locks duplicados no canto**: os endpoints eram desenhados por aresta → 2 no nó compartilhado. Agora desenhados UMA vez por nó único (1 cadeado por canto).
- **Endpoint dot muito forte**: agora bem transparente (fill-opacity 0.18); cadeado pequeno ao lado; clique alterna, arrastar move.
- **Porta quebra a linha do painel (top view)**: a faixa de painel teal é segmentada em volta de portas/objetos (janela continua como recorte).
- **Parede cheia + clearance no front view (item 7)**: o front view desenha a parede no comprimento MEDIDO e recua o painel pela clearance, com faixa "clr N" (não parece parede menor).
- **Cores do front view (item 8)**: removida a sombra 2.5D pesada (a "sopa de retângulos"); faixa de canto suavizada (slate 0.22).
- **Join externo fechado (item 9)**: a parede se estende T no canto conectado → cantos externos fecham (sem retângulos abertos).
- **Through/butt no top view (item 10)**: painel through vai até o canto; butt recua (clearance visível); dot transparente não esconde mais.
- **Labels de vista (item 11)**: "▦ Top view" e "✓ Front view".

### Testado (i)

`node tools/check.mjs` ok (+ testes novos: clamp vertical 1200, janela notch até o chão sem overlap) ✓ · **7 goldens byte-idênticos; GOLDEN_PANELS regenerado (10038) e verificado byte-a-byte vs saída ao vivo; QUOTE_mixed inalterado** ✓ · janela: notch y0=0 h1030, lower top 900 dentro do notch → sem overlap ✓ · locks: 4 glifos = 4 nós (dedup) ✓ · porta: 4 segmentos teal (M dividido) ✓ · front view: "wall 2000 mm" + "panel 1956 mm" + 2 faixas clr, sem sombra pesada ✓ · vertical clamp 2218→1200 ✓ · console limpo ✓ · Doors + sala manual intactos.

## 2026-07-08 (h) — Construtor 2D: usabilidade + visual de canto (só rendering/interação; geometria compilada intacta)

Ajustes do teste do Ednei. Zona guardada: só rendering do plan + interação do builder + `PN_WALL_T` (visual). Geometria compilada, DXF, quote, nesting **não mudam** para salas sem `plan`; through/butt default `auto` mantém a inferência. **8 goldens byte-idênticos.**

1. **Espessura de parede default 100mm** (`PN_WALL_T`, só builder; era 150). Plans existentes mantêm o `edge.wallThickness` salvo.
2. **Referência = face interna**: a linha dos nós é a face INTERNA (onde o painel encaixa). A parede sai pra FORA; o painel fica dentro. Acaba o "painel dentro da parede / retângulos cruzando".
3. **Corner clearance** (nome do vão de canto): a parede fica no comprimento MEDIDO cheio; o painel recua pelo encurtamento físico (tick `clr N`). Parede 1000 + butt 22 → parede 1000 cheia, painel para 22 antes. Não parece parede menor.
4. **Lock por clique**: sumiu o círculo vermelho; cadeado aberto/fechado pequeno ao lado de cada ponta; **clicar a ponta = trava/destrava**, **arrastar = move (se destravada)**.
5. **Keep 90° mais calmo**: arrastar canto move SÓ o nó pego (ortho-align suave nos eixos dos vizinhos, sem empurrar vizinho, sem grudar em outro nó → some o "parede presa"). A translação quadrada de um salto agora só no edit numérico de comprimento, e EXCLUI a âncora da aresta editada (o comprimento muda de fato — bug corrigido).
6. **Through/butt editável**: `edge.endA/endB` = auto|through|butt por canto, no inspector; a clearance vai pra parede que encosta. Default auto = inferência (maior passa reto).
7. **Preview de desenho** = faixa com a espessura da parede (cinza, contorno teal) + comprimento ao vivo — igual à parede final, sem barra azul.
8. **Junção/painel** ficam limpos pela referência de face interna (itens 2/3).

### Testado (h)

`node tools/check.mjs` ok ✓ · **8 goldens byte-idênticos** ✓ · parede nova = 100mm ✓ · ghost = faixa de parede sem azul, com comprimento ✓ · U: base 1956 (@22), legenda "wall 100mm", "clr 22", painel teal ✓ · lock: clique alterna on/off ✓ · through override: forçar Start=through → shortenL 0, base 1978; auto → 1956 ✓ · **keep-90 corrigido**: editar e1 4000→4600 mantém âncora `a`, move `b`→4600 e translada `c`→4600 (e2 continua vertical) ✓ · save/load preserva lock + endA/endB ✓ · sala manual + Doors intactos ✓ · console limpo ✓.

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
