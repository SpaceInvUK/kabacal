# Kabacal — Roadmap / Status

App: `index.html` · Publicado: https://spaceinvuk.github.io/kabacal/ · Repo: `SpaceInvUK/kabacal`

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
