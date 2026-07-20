# Kabacal — regras confirmadas

App: `index.html` (antigo `order-entry-beta.html`). URL: https://spaceinvuk.github.io/kabacal/

> Este arquivo é o LIVRO DE REGRAS confirmadas com o Ednei — decisões de negócio, append-only.
> Specs técnicas de interface ficam em `docs/` (CONTRACT-CAM, CONTRACT-DXF, PRICING); em conflito, ESTE arquivo ganha sobre o comportamento e os contracts ganham sobre o formato.
>
> **Índice:** Doors (Bottom part ABSOLUTO) · Panels (medidas · otimizador 8x4/10x4 · shakers/correntes · vertical · aberturas/sill/skirting · offset lines · DXF · preço · persistência/nomes · quote m²/cut list/panorama) · Nesting · Offcut (tamanho mínimo · forma/L · texto · chanfro · layers) · Flushback (geometria + templates + regra do binário INVERTIDO) · Templates por peça física (role) · Offset Depth/pockets.

## Doors — painéis internos: "Bottom part" é ABSOLUTO (confirmado 2026-07-15)

Em portas com 2+ painéis internos, o campo **Bottom part** (Right part quando a porta está deitada) é a **distância ABSOLUTA do fundo/início da peça até o topo da seção inferior — INCLUINDO o frame de baixo** (frame direito na horizontal). NÃO é a altura interna da abertura inferior.

- Exemplo canônico: porta 2000 de altura · frame 50 · mid rail 50 · 2 painéis · Bottom part 400 ⇒ seção inferior TOTAL = 400 (frame 50 + abertura 350) · mid rail 50 · abertura superior 1500 · frame de cima 50 · total 2000. "The lower panel is not 400 internal. It is 400 total from the bottom of the piece."
- Mudar o Bottom part redimensiona SOMENTE a abertura inferior + a abertura superior restante; frames laterais, frame de cima/baixo, mid rail e altura total NUNCA mudam. Vazio = divisão igual.
- Implementação: `cavsFor` subtrai o frame de baixo (`f.b`, ou `f.r` na horizontal) do valor antes do `panelSegs`; preflight avisa `bottom part ≤ frame`.
- Persistência (aditiva): o `.fastcnc` continua gravando em `panelSize` o valor INTERNO (compatível com o app de produção) e grava o ABSOLUTO no campo novo `kabBottomPart`; na importação, `kabBottomPart` vence; arquivo legado (só `panelSize` interno) converte para absoluto somando o frame — jobs antigos renderizam idêntico.
- Regressão: check.mjs E2E cenário (g) trava o caso 2000/50/50/400 (350+1500), o round-trip e o import legado.

### Midrails absolutos + Shape + hardware (2026-07-19, paridade de configurador)

- **Midrails** (`it.midrails=[{c,th}]`): centro de CADA rail medido do fundo da peça (da direita na horizontal — mesmo datum do Bottom part), espessura individual; lista não-vazia sobrepõe panels/midFrame/panelSize; aberturas = vãos entre frame e rails. Persistência aditiva `kabMidrails` (produção recebe panels=rails+1 como divisão igual). E2E cenário (h).
- **Shape** (`it.shape`, rake/splay) — **política v2, confirmada 2026-07-20 (supersede a v1 "abertura retangular")**: **o FRAME SEGUE O CONTORNO COMPLETO da porta**. A cavidade é o contorno com inset POR LADO (`shapeCavityPoly` → `polyInset`, cantos mitrados): um frame de 50 continua **50mm em todo o perímetro**, inclusive nas arestas inclinadas; frame irregular mantém a medida de cada lado (T80/R30/B60/L40 verificado). Preview e **DXF carregam a geometria verdadeira** (OUT + OFFSET_A/B–G como POLYLINE fechada inclinada). A perna mais alta SEMPRE define a altura (o editor re-sincroniza `it.h`). **O NC do Kabacal não corta NADA em porta shaped além da furação** (`tpOpRects` devolve vazio para qualquer layer) — todo corte que segue a forma sai do DXF no VCarve; aviso no Save NC e nos documentos ("SHAPED — OUT VIA VCARVE"). Inserts automáticos e glazing são pulados em porta shaped (precisam de peça inclinada — pendente). Porta shaped com multi-painel/midrails mantém o fallback retangular da v1. Persistência aditiva `kabShape` (w/h = bounding box). E2E cenários (i)+(j).
- **Glazing** (`it.glazed` aditivo, 2026-07-20): seção própria **Glazing** no editor é a dona de todos os controles (o card em Frame & Panels virou resumo). Construção (spec Joinery Supply): moldura de canto vivo · vidro entra pela FRENTE · rebaixo traseiro = **lip frontal 9mm → assento do vidro (4 ou 6mm) → assento do bead 9mm** · **bead de UMA peça** gerado, nested, precificado e exportado (um por abertura). O toggle é autoritativo: desligar remove a palavra GLASS do texto; **arquivos antigos com "GLASS" no texto continuam envidraçados** (compat). E2E cenário (k).
- **Moisture-resistant 25mm** (2026-07-20): `MDF Hidrofugo 25mm` **£80** (mesma família/naming do 18/22; passo +£10 de 22→25 igual ao resto do livro — **confirmar com o Ednei**) e `MR MDF 25mm` £85 (já existia). CNC 25mm = £120 pela faixa existente. Chaves ADITIVAS: todos os preços pré-existentes provados inalterados. E2E cenário (l).
- **Dobradiças**: catálogo `HINGE_MODELS` (Generic/Blum/Inserta/Hettich/Grass) = Ø cup + inset borda→centro (22.5 = valor legado, jobs antigos intocados) + depth do fabricante como DICA; **a op de furação continua exigindo profundidade explícita** (política de segurança mantida). `kabHingeModel` aditivo.
- **Presets DRAFT** (sufixo "(draft)"): linhas aproximadas para preview/planejamento; nenhum template casa com os nomes ⇒ **zero NC**; cada um vira estilo real pelo pipeline VCarve (.ToolpathTemplate + .nc de referência → template validado + golden).
- **Pocket depth por porta** (`kabRecessDepth`): dado no job apenas; NÃO dirige o NC até validação na máquina.

## Panels (modo Panels — confirmado 2026-07-07)

Modo separado do Doors (toggle Doors | Panels no header); estado próprio (`panelRooms`, localStorage `kab_panels`); os painéis NUNCA entram na lista de parts do Doors. O Quote é o ponto de encontro: seção "Wall panelling" própria + Doors subtotal + Panels subtotal + total combinado; serviços/spray/VAT aplicam UMA vez no job. **Job só-Doors tem que sair byte-idêntico** (panels.total=0 — invariante no check.mjs e provado vs HEAD).

### Junção V↔H "Wrap" — standard do room (confirmado 2026-07-19, DXF de referência do Ednei)

Onde um painel VERTICAL encosta num painel HORIZONTAL: no trecho lado a lado o vertical usa joint de **40** (40 + os 40 do vizinho leem como UM frame de 80); **onde não há vizinho** (acima do topo do horizontal), o painel vertical **ALARGA +40** e carrega o frame de **80** sozinho — o contorno "contorna" (wrap) o vizinho, e a **linha da cavidade fica RETA** (referência: `W:\Documents\Vcarve\Vertical + Horizontal joint.dxf` — OUT de 8 vértices, degrau de 40 no topo do vizinho). O horizontal mantém 40 constante no lado do joint.

- Opção **"V–H joint"** no Room Setup: **Wrap (standard, default ON)** | Straight 40 (`room.vhJoint='flat'` desliga; ausente = wrap; rooms legados ganham o standard).
- Modelo: peça = bbox largo + notch 40×(altura do vizinho) onde o vizinho senta → nesting/tier/cut list/m² veem o CORTE real (ex.: zone 1200 + wrap = corte 1280 → 10x5 flagged). Painted front = bbox − notches.
- Vizinho zone cobre a própria altura (full-height → sem wrap) · porta NUNCA wrap (allowance 175 vale) · parede-fim nunca · wrap pulado se o bbox passar do hard-max 2000.
- Sheet DXF e Wall Layout DXF: OUT = contorno escalonado real (notch de wrap não vira INSIDE). **NC próprio NÃO corta o OUT wrapped** (mesmo regime do SHAPED) — aviso no Save NC, corte via VCarve/DXF. Cavidades/pockets cortam normal.
- **A|B|C — cap alto sobre objeto/porta (confirmado 2026-07-20, supersede o "reverso por fileira")**: objeto (ou porta) com "Top panel: yes" FLANQUEADO por verticais → o cap B nasce com **largura = abertura + 40 por lado flanqueado**, base no topo da abertura e **topo = topo da vertical vizinha mais alta** ("B acompanha A e C"); A/C tocam B com 40 (lê 80) e **abaixo da base do B alargam +40 até a borda da abertura** (nunca por cima do objeto/vão), frame 80 sozinho. Overhang ±40 só nos lados flanqueados quando o cap sobe (lado sem vertical: cap termina na borda da abertura). Zone encostada NA linha da porta/objeto = notch sem crescimento sob o overhang (porta mantém o allowance 175). Sem vertical do lado → cap legado (1030, ±40).
- **Largura AUTO ao virar um painel pra vertical (confirmado 2026-07-20)**: respeita os frames e **casa os shakers com os horizontais** — maior nº inteiro de shakers (largura real do shaker da peça + frame, com as margens reais da peça: borda 80 / joint 40 / porta 175) que caiba em ≤**1200**; nunca nasce com 2000 (2000 é só limite de EDIÇÃO manual).

### Largura individual de painel + chapas 10x5/especial (confirmado 2026-07-18)

O usuário pode fixar a largura de PEÇAS FÍSICAS individualmente; as outras da mesma parede/trecho se reajustam — **"fixa as que eu setar, o resto divide igual"**. Frames respeitados (joints seguem 40/40) e o grid de shakers re-balanceia organicamente (alvo do room).

- **Horizontal (banda)**: pin em `wall.hColW[posição]` (aditivo), aplicado num post-pass após o slicer; painéis fixados 200..**3000** (cap 10x4); os demais do MESMO trecho contíguo dividem a sobra igualmente; sem pin = fatiamento intocado (byte-idêntico). Sobre-restrição → escala + warn.
- **Vertical (colunas de parede `dir:'v'`)**: pin em `wall.vColW[coluna]` (`pnVColLayout`); colunas fixadas 60..2000, flex divide igual, coluna extra se algum flex passaria de 2000.
- **Vertical zones (painel vertical embutido)**: largura da zone segue os MESMOS tiers; zones NUNCA se sobrepõem nem passam da parede — `pnZoneRects` sanitiza (empurra a invasora pra direita; sem espaço, encolhe ao vão; warn "auto-adjusted"). `pnWallSpans` e `pnZonePieces` usam o mesmo mapa.
- **Tiers de chapa vertical (largura da peça)**: ≤1206 = stock normal (8x4/10x4 pela altura) · **1207–1520 = 10x5** (3050×1525, precificada por área — `priceForSheet` já cobre) · **1521–2000 = CHAPA ESPECIAL encomendada** — só FLAG (chapa sob medida no nesting, preço real a definir) · **máx 2000** (hard cap; acima força mais colunas/clamp).
- **Trigger (>1206)**: warn âmbar no editor ("needs a 10x5 sheet" / "needs a SPECIAL-ORDER sheet"), linhas no resumo Wall Panels do Quote/PDF e linha âmbar no doc impresso (special: "confirm supply and price before production"). Mix de chapas mostra bucket "special order".
- **Shaker Columns**: o stepper reduz até **1** (shaker único largo permitido) — semeia do valor exibido, nunca fica preso no auto.
- Persistência aditiva: `vColW`/`hColW` no `.fastcnc` e no whitelist do plan-recompile. Regra antiga "colunas ≤1200" (2026-07-08) SUPERSEDida por estes tiers.

### Quote/PDF de Panels — m², cut list, panorama, sheet preview (confirmado 2026-07-15)

Quando o job tem Wall Panels, o Quote (tela) E o PDF ganham uma seção **"Wall Panels"**. Duas áreas em m² (o relatório explica a fórmula):
- **Panel material area** = `Σ(largura física × altura física de CADA peça) ÷ 1.000.000`. É o retângulo que se corta (bate com a peça do DXF/nesting). Respeita Panel On/Off, splits, vertical e gap/overlap por construção — soma as peças REAIS do `pnRoom` (`pnPieceArea.mat = w×h`); paredes sem painel (`noPanel`) não geram peça, logo não contam.
- **Painted front area (front only)** = a mesma soma MENOS os recortes de janela de cada peça (`piece.notches`) — só a FACE da frente, NUNCA dobrada para frente+verso (`pnPieceArea.painted = w×h − Σ notch`). Sem janela na peça, painted = material.
- **Toggles** no Quote (default ON quando há painéis): "Show Panels panoramic view" e "Show sheet preview" — controlam a tela E o PDF juntos (`pnQuotePano`/`pnQuoteSheets` + `setPnQuoteOpt`).
- **Panorama do Quote/PDF**: segue a ordem das paredes mas **ESCONDE paredes sem painel** (sem caixas vazias); a numeração mantém o índice REAL da parede (Wall 1, Wall 3…) — consistente com o cut list e o editor. Vale SÓ para o Quote/PDF: `pnPanoSvg(room,L,quote=true)`; o editor de Panels continua mostrando TODAS as paredes (comportamento intocado).
- **Cut list**: colunas Wall / Panel ID / Width / Height / Thick / Area m², com o nome existente (Wall 1, Wall 1A…), nunca renomeando por letra só.
- **Só display**: não muda pricing, DXF, NC nem geometria. Job só-Doors não ganha nada (`pnQuotePanelsExtra()` retorna `''`). Editor de Panels ganhou só um rodapé DISCRETO de m² sob o desenho (total do room + painted; ao focar uma parede, área da parede também). Goldens byte-idênticos (PANELS_18mm 10030, WALL_LAYOUT 3428); doors basket 300/60/360 + £75 intactos.

### Medidas de peça (números confirmados)

- Comprimento máximo da peça: `2400` em 8x4 · `3000` em 10x4. Dimensão transversal sempre `≤ 1206` (chapa 1220 com margens 7mm).
- Corte SÓ no centro de um frame entre dois shakers → cada lado fica com `frame/2` (80 ⇒ 40/40, nunca frame duplo).
- **Supersede** regras antigas do PANNELING_RULES_2026-05-20: "horizontal máx 2400" (agora 2400 é só o cap do 8x4; até 3000 fica inteiro em 10x4) e "merge ≤ 2400" (segue o cap da chapa escolhida). "Rows travadas em 2" também caiu: rows é stepper, default 2.

### Otimizador de chapas 8x4/10x4 (misto)

- Run ≤ 3000 = UMA peça (ex.: 2900 inteiro em 10x4; 2300 em 8x4).
- Run > 3000: candidatos com o MÍNIMO de joints, incluindo mistos (3500 → 1750+1750, 3000+500, 2400+1100 — todos 1 joint); escolha por: joints → custo real de chapas nested (MaxRects; peça pequena pode PEGAR CARONA na sobra de outra chapa do mesmo room+material) → desperdício → split mais equilibrado. Nunca hard-code "só 8x4"/"só 10x4".
- Pooling por room + material (regra antiga "sheets por Room" mantida). Controle por room: `Sheet use: Auto | 8x4 only`. 10x5/jumbo nunca entram no automático.
- Nesting Panels: peças >2400 em 10x4; menores tentam a sobra das 10x4 antes de abrir 8x4. Margem/gap 7mm.

### Shakers — run-first + paredes encadeadas

- O grid de shakers é calculado no RUN inteiro primeiro (alvo ≈350, min 150 / máx 700), depois é fatiado em peças — o matching entre peças vizinhas sai por construção.
- Paredes consecutivas com os lados que se tocam ambos `Joint` viram UMA corrente (run único): a emenda cai exatamente no centro de um frame (40/40) e o último shaker de uma parede = primeiro shaker da seguinte (células da emenda EXATAS; sobras vão para as células longe das emendas). Count override vale para a corrente inteira.
- Canto (`Corner`) = frame + espessura do material; paredes em canto NÃO continuam o grid, mas compartilham o alvo do room (edge shakers absorvem, regra antiga mantida). `Column` = mesma folga; `Door` = allowance 175.
- Override por painel físico (count/lados) mexe SÓ naquele painel; joints não se movem; botão Auto volta ao grid do run. Se um count pedido estourar o cap da chapa, o cap ganha (menor count que cabe).

### Vertical

- **Parede inteira vertical** (`wall.dir='v'`): colunas ≤1206 de largura (auto = teto(L/1206); override nunca abaixo do mínimo), altura padrão 3000 (= cap do 10x4). Rows: stepper, default 2; a fileira de baixo alinha com a linha do painel horizontal (hPanelH − frame).
- **Painel físico vertical em parede horizontal (mixed orientation, 2026-07-08)**: selecionar um painel e pôr Orientation = Vertical cria um `wall.vZones[{id,x,w,h,cols,rows}]` — um painel FÍSICO vertical de verdade (não só troca o estilo do shaker). Máx **1200 largura × 3000 altura**, chapa 10x4, em pé. No `pnWallSpans` a zona é uma PARADA DURA com joints 40/40 nos dois lados → a banda horizontal **auto-preenche** os vãos à esquerda/direita; os outros painéis continuam horizontais. Vários painéis verticais na mesma parede = OK. Grade da zona = mesma regra da parede vertical (colunas ≤1200, rows default 2, fileira de baixo alinhada). "Back to horizontal" remove a zona. Sem zonas = geometria byte-idêntica (goldens intactos). A troca de estilo de shaker por painel (`panelOv.dir`, motor de 83ebf1e) continua no motor mas saiu da UI de orientação — orientação agora é FÍSICA.

### Aberturas / sill / skirting

- Door 900×2100 · Window 1200×1100 com bottom 900 · Object 2000×2000; X medido de L ou R; colisão é MOSTRADA (⚠), nunca move sozinho.
- Door/Object cortam a cobertura; Window é recorte + painel inferior separado sob a largura toda; sill de janela = setting do room (default 22). Cap panel acima de Door/Object (toggle), lados meio-frame; cap alto/largo demais vira colunas ≤1206.
- Skirting default 225 (linha guia tracejada só no preview; shaker inferior começa em skirting+frame). A linha-guia nunca vai pro DXF, mas a POSIÇÃO do shaker inferior (skirting+frame) muda a geometria da cavidade — logo entra no DXF como o começo da banda de baixo.
- **Skirting por parede (2026-07-08)**: cada parede pode sobrepor o default do room via `wall.skirt = {mode:'custom', on, h}`. Resolução no `D.skirtFor(wi[,pid])`: panel > wall > room. Sem override = default do room (layout byte-idêntico). O inspector da parede mostra a fonte (Room default | Custom) + o valor resolvido ("now: skirting 150mm · from THIS wall"). **Per-panel está PREPARADO** (`wall.panelSkirt[pid]`, mesma forma) mas sem UI ainda.
- **Import do skirting (2026-07-08)**: o CNC Calculator antigo guarda skirting no BLOCO (`panelSkirtingEnabled`/`panelSkirtingHeight`) E por PART/parede (mesmos campos no part), resolvendo com `panelSkirtingEnabledForPart`/`HeightForPart` (valor do part ganha, senão bloco); altura legada `305` = "225+80" e é normalizada pra 225. O `pnImportLegacy` reproduz isso: room = default do bloco; cada parede cujo part difere ganha `wall.skirt`. Não perde mais o skirting por parede.

### Notes (2026-07-08)

- Notas por parede: `wall.notes = []` (várias, texto livre; add/edit/delete no inspector quando a parede está selecionada). Per-painel: `wall.panelNotes[pid] = []` (aparece no PANEL SETTINGS). **Não afetam geometria nem preço** (invariante testado no check.mjs); viajam no `.fastcnc` dentro de `panelRooms`; arquivos antigos sem o campo carregam normal.
- **Notas do Quote (cliente, 2026-07-08)**: `project.quoteNotes` — editável na aba Quote (textarea "shown to the customer"), aparece no PDF do cliente (`buildQuoteHtml`, bloco Notes). Precedência: PDF mostra `quoteNotes || notes` (o "Notes / reference" da client bar segue como fallback pra arquivos antigos). As notas INTERNAS de parede/painel NUNCA vão pro PDF do cliente. Persiste via `kabacal` meta.

### Seleção wall × panel (2026-07-08)

- Clique no PAINEL (rect `.pnk`) → PANEL SETTINGS. Clique no FUNDO da parede (rect `.pnbg`) → WALL SETTINGS (skirting/notas/aberturas/tamanho/regras da parede). Direto do canvas, não só pela aba/tab. O clique no fundo mantém o zoom (`pnPickWall`, não reseta `pnVb`); arrastar (pan) não dispara seleção.

### Offset lines A–G

- Mesmo modelo do Doors ({en, mm, round}) no room, desenhadas dentro de CADA cavidade de shaker no preview e EXPORTADAS no DXF: linha ativa = retângulo recuado `mm` dentro de cada cavidade na layer `OFFSET_X` (round corners r2.5 como Doors); **sem nenhuma linha ativa, a própria cavidade sai em `OFFSET_A`** — exatamente a disciplina do Doors (linha ativa substitui a base).

### Offset presets (Profile) + import de DXF (Ogee — 2026-07-12)

- **Preset de offset** = um nome + as 7 linhas A–G + (opcional) uma **seção de moldura** guardada como polilinha normalizada. Registro global `profiles` (`kab_profiles`). Doors: dropdown "**Preset**" na aba Offsets + `it.offsetName`. Panels: dropdown "**Preset**" no acordeão Offsets, guardado em `pnProjOffsetName` (escopo Project) ou `room.offsetName` (escopo Room). Editar uma linha à mão volta o nome para `Custom`.
- **Built-ins de fábrica (2026-07-12)**: `None` · `Plain Shaker` (ex-"Shaker", renomeado) · `Ogee` (embutido com os valores medidos do DXF do Ednei + a seção 20.94×8mm — funciona sem importar nada). `All offsets` (só exemplo) foi REMOVIDO. Built-ins nunca são salvos no `kab_profiles`, não são deletáveis, e conjuntos externos (arquivo/settings antigos) são sanitizados: chaves legadas `Shaker`/`All offsets` descartadas (`extProfiles`), nomes legados em itens mapeados (`normPresetName`: Shaker→Plain Shaker, All offsets→Custom) — arquivo velho carrega igual.
- **⬆ Import DXF** (`importOffsetPreset` → `offsetPresetFromDxf`): lê um DXF com layers `OFFSET_A..OFFSET_G` (+ opcional `PROFILE`) e cria o preset. Regras de leitura, **confirmadas pelo Ednei**:
  - **`OFFSET_A` = a linha do FRAME = ZERO.** As demais (`OFFSET_B..G`) entram como o **espaçamento PARA DENTRO relativo a A** (média das 4 folgas dos bounding boxes de cada layer vs. A), **nunca** a distância `OUT→A`.
  - **`OUT` é ignorado e NUNCA muda.** O frame é a config da própria peça: Frame=70 ⇒ A começa 70mm para dentro do `OUT` (A com mm=0 já é a borda da cavidade, que já está dentro do frame). Não redimensionar/reinterpretar as linhas — respeitar o espaçamento do DXF.
  - `PROFILE` = a polilinha da seção da moldura, normalizada para origem local (guardada em `profiles[nome].profile = {pts,w,h}`).
- **Layer `PROFILE` no DXF** (cor 177, aditivo): desenhado **UMA vez por chapa** (canto superior-esquerdo, tamanho real) para cada preset com perfil usado naquela chapa — tanto Doors (`dxfForThickness`) quanto Panels (`pnDxfForThickness`), via `dxfSheetProfiles`. **Não é corte** — é a referência da seção para o toolpath de moldura (Ogee) no VCarve. O contorno da peça (`OUT`) e as linhas `OFFSET_*` seguem inalterados.
- O **mesmo nome** (`offsetName`) fica guardado para casar com o template de toolpath (abaixo).
- Persistência **aditiva** (nada renomeado): `kab_profiles` (presets, incl. `.profile`), `.fastcnc` → `kabacalQuote.profiles` + `panelProject.offsetName` + `room.offsetName`.
- **Ogee** (primeiro preset, lido do DXF do Ednei): A=0 / B=4.5 / C=6.5 / D=17.5 / E=23.5 / F=27 mm + seção 20.94×8mm (118 pts).

### Toolpath template "Ogee Moulding 22mm" (2026-07-12 — casado ao preset pelo NOME)

- Template de fábrica `tpl_ogee22`, convertido do `Ogee Moulding 22mm.ToolpathTemplate` do Ednei (árvore invertida, regra padrão) e validado contra o NC de referência `Ogee Moulding 22mm.nc`.
- **Gating (confirmado)**: só vale para **espessura 22mm** (material indiferente) **E** peças com o preset de offset **`Ogee`** (`appliesTo:{th:22, offsetName:'Ogee'}`). Fora disso o template aparece **visível mas bloqueado** com o motivo ("needs 22mm material" / "needs the Ogee offset preset"). O gating é genérico — preset novo = nova entrada de dados.
- **Seções (correção do Ednei 2026-07-12)**: a op da **ball nose 5mm é MOULDING** — e pré-seleciona SOMENTE `OFFSET_E` (rails) + `PROFILE` (seção), nunca os outros offsets; a op do **50.8 é POCKET** (clearing), não faz parte da moldura.
- **Ordem real de corte (5 ops por peça, cavidade a cavidade)**: ① POCKET `OFFSET_F` raster T12 50.8 skim (níveis 5.75/11.5, stepover 25.4, serpentina INVERTE a cada nível, penúltima linha em borda−passo/2, S12000 F9000) → ② `OFFSET_F` anel de acabamento T1 6mm a **11.5** (S18000 F8000; = fundo do pocket, não 0.3 mais fundo — Ednei 2026-07-13) → ③ `OFFSET_D` V-bit 90° a 9.5 **na linha** (raio efetivo = profundidade), **entra no MEIO-DIREITO, roda HORÁRIO**, corner sharpen BR→BL→TL→TR (T6 S16000 F9000) → ④ MOULDING **sweep Ogee** T11 ball 5mm (rails `OFFSET_E` + seção `PROFILE`, compensação da esfera, passo 0.75, S15000 F10000) → ⑤ `OUT` T1: **desbastes 10.5/21 com folga +0.4** + **passe FINAL exato a 22 com ramp** (padrão VCarve, validado nos dois NCs de referência).
- **Ferramentas da máquina (Ednei confirmou 2026-07-12)**: T11 = ball nose 5mm, T12 = 50.8 skimming (o nome interno do template VCarve chamava a ball de "TOOL 12" — o NC pós-processado é a verdade). A/B/C não são usinadas por este template (desenho/limite).
- **NUNCA cortar material real sem o protocolo de air-cut** (STATUS risco 1): o NC do Kabacal inteiro ainda não cortou madeira; este template adiciona op 3D nova. Air-cut + sobra antes de produção.
- Golden: `GOLDEN_OGEE_S1_22mm.nc` (receita em tests/golden/README.md).
- **Panels (2026-07-12)**: a ponte Panels→CAM existe — sala com espessura 22 + preset Ogee faz o template aplicar às chapas de painéis (ops "— Panels", escopadas por chapa, células de shaker como cavidades). Chapas de painéis SÓ cortam paths explicitamente escopados a elas (jobs de portas byte-idênticos, provado). Sem stale-tracking nos paths de painéis: mudou a sala → apague o grupo e re-aplique. Golden binário do NC de painéis ainda pendente (engine é o mesmo já golden-ado; validação E2E registrada no ROADMAP qq).

### DXF dos painéis (confirmado/entregue 2026-07-07)

- Botão DXF do header (modo Panels) e botão ⬇ DXF do canvas exportam `PANELS_<espessura>.dxf` (um arquivo por espessura, rooms juntos).
- Mesma disciplina do writer do Doors: doc portrait com chapas empilhadas (gap 250), `SHEET` + caption dentro da chapa ("SHEET n PANELS <room> <material> <esp>"), `OUT` = contorno da peça, cavidades/linhas como acima, `INSIDE` = recortes de janela (corte passante), `PART_NUMBER` no canto reservado + texto tamanho/nome ajustado (mesmas métricas do Doors), margens/gap de 7mm herdados do nesting; peças rotacionadas no nesting têm as cavidades transformadas junto.
- Toolpaths/CAM dos painéis = Fase 2.

### Preço dos painéis (regra do panneling, confirmada 2026-07-07)

- Por room: **material £/chapa** (campo vazio = price book pelo tamanho real de cada chapa, ex. MDF 18: 55 em 8x4 / 75 em 10x4) + **CNC serviço £/chapa** (default **£330** — a taxa de panelling do app antigo). Total do room = Σ material + CNC×chapas. Editáveis no inspector do Room.
- Import legacy traz `materialCost`/`cncServiceCost` do bloco antigo. Job só-Doors continua byte-idêntico (invariante testado).

### Persistência / nomes

- `.fastcnc` ganha o campo ADITIVO `panelRooms` (arquivos antigos seguem carregando, inclusive saves da Fase 1 sem os campos novos de preço); quotes antigos do app de panneling (`calcMode:'panel'`) importam para rooms automaticamente (`empty`→Object).
- **Nomes (regra 2026-07-07, supersede o P1/P2V)**: `Wall 3A / 3B / 3C` — letra por parede em ordem VISUAL (esquerda→direita, baixo→cima), prefixo do nome do room; iguais no viewer/inspector/DXF/quote. `vn` = sequência visual do room inteiro → **PART_NUMBER do DXF segue a ordem visual**, não a ordem de leitura da chapa. Vertical não leva mais sufixo no nome (a direção fica visível no viewer/inspector).

### 2D room builder (Beta, 2026-07-08)

- Top-down SVG plan (`pnView='plan'`) to draw a room from above; entry: "▦ draw" room tab / "▦ Draw a room" empty-state / "▦ 2D Builder" button on an existing room. Everything in **mm**.
- **Draw** tool: click-drag-release makes a wall; endpoints SNAP to existing corners (connect/chain) and to ortho; length rounds to 10mm. **Select** tool: drag a corner (moves every wall sharing it) or click a wall to edit length/thickness/height + add openings. **Pan** tool: drag; wheel always zooms; ⤢ fits. Same zoom/pan feel as the rest of Panels.
- Defaults: **wall thickness 150mm**, **panel layer 22mm** (drawn in blue in front of each wall on the room-interior side; `plan.panelLayer.thickness` is configurable — 18/12/9 later, not hard-coded).
- Doors/windows/objects: proper top-down symbols (door = leaf + swing arc; window = frame + centre line; object = dashed rect), attached to a wall at an offset, with width/height; they compile into `wall.openings` so the existing engine nests/quotes/DXFs them.
- **The plan compiles into real Panels walls** (`pnPlanCompile`, see ARCHITECTURE) — the walls then behave EXACTLY like manually-created walls (shakers, skirting, orientation/zones, openings, quote, DXF). The builder feeds the engine; it does not replace it. 2.5D/3D stays a later optional preview (no Three.js now; SVG keeps performance intact — draw only on state change).
- Limitation (Phase 1): editing one wall's length moves the shared corner, so a connected neighbour re-angles (expected graph behaviour); drag corners to true up. Openings drawn in the builder live on `plan`; openings added in the Wall inspector live on the wall — both survive recompile (plan ones carry `plan_` ids).

### 2D builder Phase 2 (2026-07-08) — corners, locks, keep-square, dragging

- **Corner inference**: at a shared node the LONGER wall passes THROUGH; the SHORTER one BUTTS into it (tie → earlier-drawn passes through). A free end (no shared node) stays normal. (Draw-direction/`winding` mode can override this — see Phase-2 winding note.)
- **Corner gap priority (2026-07-10):** `plan.cornerMode` = `auto` (default — longer wall through / shorter butts = gap on the SHORTER wall) | `longgap` (longer wall butts = gap on the LONGER wall) | `winding` (draw direction). UI "Corner gap priority: Shorter / Longer / Winding". Only moves which panel butts/gets the gap; measured length unchanged; per-corner `endA/endB` still overrides.
- **Overlap corner/end (2026-07-10):** a manual per-end value `edge.endA/endB = 'overlap'` (Start/End control: Auto/Through/Butt/Overlap, and Overlap is allowed on a free end) makes the panel **extend past the wall end by the panel thickness** `pt` (the opposite of butt's shortening) — for external/return corners. `cornerInfo.{l,r}.extend = pt`; `shorten = −pt` → `wall.w = measured (+pt per overlap end)`. Uses the ACTUAL `pt` (18 → +18, 22 → +22). **Wall measured length never changes**; only the physical panel grows. Labels everywhere show wall = measured, panel = physical; purple "overlap +N" marker in top + front views. Butt = −pt (gap) · Overlap = +pt (extend) · Through = frame+pt · Normal = frame.
- **Typed wall lengths are EXACT (2026-07-10):** editing a wall's length numerically is NOT rounded to 10 mm (886 stays 886) — `pnPlanShift(...,exact)` skips `pnR10`. Only dragging/drawing snaps to 10 mm. Everything (labels, front/top view, Wall Layout DXF) follows because size = node coords → `eLen` (1 mm).
- **CONFIRMED corner rule (2026-07-10 — Ednei):** `THROUGH side = frame + panel thickness` · `BUTT side = normal frame + a physical corner GAP (= panel thickness)`. The wall keeps its **full measured length**; only the BUTT panel is physically shortened by `pt` (the gap the through panel passes into). This is the REVERSE of the 2026-07-08 engine, which put the allowance on the butt side — flipped after Ednei confirmed. *Worked example:* frame 80, pt 22 → through allowance **102**, butt frame **80** + gap **22**. Wall 2 of a 2000/1000/2000 run: measured 1000, panel **956**, normal 80 frame both ends, 22 gap each end.
- **Physical panel shortening (thickness-driven, NEVER hard-coded 22)**: a butting end shortens that wall's compiled panel run by the actual panel thickness `pt` (= `plan.panelLayer.thickness`). Butting both ends → −2·pt. Example (U base, measured 2000): pt22 → 1956, pt18 → 1964. Reduces the compiled `wall.w` so panels never overlap at corners.
- **Internal allowance (separate calc)**: the `corner` side rule → `pnSideMM` returns `frame + cornerTh` (`cornerTh` = plan panel thickness; `pnRoomDefs`). As of 2026-07-10 this rule is on the **THROUGH** end (`sideL/R = cA/cB === 'through' ? 'corner' : 'normal'`); the butt end keeps `normal` (frame only). `cornerInfo.{l,r}` now carry `{cond, shorten, gap, allowance}` — gap = pt on butt, allowance = frame+pt on through. For NON-plan rooms nothing sets `through`, so pnSideMM is byte-identical (goldens safe).
- **Endpoint locks**: `node.lock` — a locked corner can't move; length edits move the free end (or are blocked with a message if both ends locked); dragging a locked node is refused with a message. Saved in `plan`.
- **Keep 90° square** (`plan.keepSquare`, default ON): editing a length / dragging a corner also translates the far ends of directly-connected axis-aligned neighbours by the same delta (one hop) so orthogonal neighbours stay square. Locked far ends are left (that neighbour re-angles). Limitation: one-hop only — closed loops / multi-bend chains may need a manual node tidy.
- **Drag openings**: door/window/object drag along their wall (offset snaps 10mm, clamped); width/height/bottom/offset also numeric; compiles to `wall.openings`.
- **Panel layer visibility**: wall = neutral grey structure; panel = distinct SOLID TEAL band + bold outline + light centre line, in front on the interior side, with a legend. Clearly not a wall shadow.
- **Explainability + naming** (item 4/5): the inspector shows, per end, "Start — **Butt corner**: NORMAL frame 80mm, panel shortened 22mm (corner gap 22mm for the through panel) / End — **Through corner**: full length, frame + panel = 102mm allowance". **Through corner** = passes through, gets frame+pt. **Butt corner** = stops short (normal frame). **Corner gap** = the physical missing space on the butt side (= pt). Never label both sides just "corner".
- Deferred to Phase 3: full column/return objects, multi-hop constraint solving.

### 2D builder usability pass (2026-07-08)

- **Default wall thickness now 100mm** (`PN_WALL_T`, 2D-builder only; was 150). Existing plans keep their stored `edge.wallThickness`.
- **Inside-face reference**: the drawn node line = the wall's INSIDE face (where the panel is fitted). The wall thickness extrudes OUTWARD only; the panel sits on the inside going in by `pt`. This kills the "panel inside the wall / rectangles crossing" look — panel clearly on the interior, wall solid to the exterior.
- **Corner clearance** (the agreed name for the corner gap): the wall stays FULL measured length; the panel band is inset by the physical shortening (labelled **`butt −N`** at that corner). So a 1000mm wall with a 22mm butt shows a full 1000 wall and a panel stopping 22 short — not a shorter wall.
- **Endpoint lock UI**: no more red circle. Small open/closed padlock glyph beside each endpoint; **click an endpoint = toggle lock**, **drag = move (if unlocked)**. Locked endpoints can't move (message on attempt).
- **Keep 90° is calmer**: dragging a corner moves ONLY the grabbed node (soft ortho-align to neighbours' axes, no neighbour shift, never snaps onto another node → no "trapped wall"). The one-hop square translation now applies only to a numeric Length edit, and it EXCLUDES the edited edge's anchor (so the length actually changes).
- **Through/butt editable**: `edge.endA`/`edge.endB` = `auto` (inference) | `through` | `butt`, per corner, from the wall inspector. The clearance moves to whichever wall butts. Default `auto` = longer-through inference (unchanged; goldens safe).
- Draw preview is a wall-thickness band (grey, teal outline) + live length — matches the final wall, not a blue bar.

### 2D builder refinement pass (2026-07-09)

- **Continuous mitred walls (top view)**: the wall body is drawn inside-face-as-reference (nodes at u=0..L) and extruded OUTWARD by `T`; at a corner shared by exactly two walls the OUTER corner is **mitred** to the neighbour's outer face (`pnPlanMiterOut` = intersection of the two outward faces). Mitred neighbours share the node→miter edge exactly, so they tile with **no overlap** (no dark double-opacity patch) and no gap, at ANY angle — 90° stays square, irregular angles read continuous. Free ends / 3+ junctions get a square end at the node. Wall fill softened to keep the teal panel the dominant layer. Top-view rendering only — no geometry/DXF/quote change.
- **Corner naming (top + front view)**: a **Through corner** (teal "through" tag) runs full length; a **Butt corner** (red "butt −N" tag) stops short by the clearance. Confirmed engine rule (unchanged): the butting end carries the corner allowance `frame + pt` and the physical shortening `−pt`; the through end stays normal frame. *(Open question raised 2026-07-09: the user's restatement had the through panel taking frame+pt and the butt keeping normal frame — the REVERSE of the shipped/golden-locked rule. Not flipped without confirmation; would change panel cell layout + GOLDEN_PANELS if changed.)*
- **Corner clearance mark is subtle (front view)**: a short dashed marker at the panel edge near the base + a thin tie across the gap + a `butt −N` label — NOT a full-height red band up the wall.
- **Cross-corner shaker consistency (already in the engine — preserved)**: `pnRoomRuns` chains horizontal walls joined at a `joint` side into ONE run; `pnRunGrid` lays a single uniform-target grid across the whole run and forces the cells touching a wall seam to be EXACTLY equal, i.e. **last shaker of one wall = first shaker of the next**. This only spans walls chained via `joint` sides; across a `corner`/butt joint or a horizontal↔vertical transition each wall is its own run (independent grid). Matching across those would need cross-run target coordination — deferred (risk to sheet counts/goldens).
- **Measure**: the value label sits OFF the measured line (perpendicular offset, biased up; steps aside for vertical), and Measure snaps to the FULL WALL extremities as well as the inset panel edges — so both the whole wall and the shortened panel are measurable at a corner.
- **Builder controls**: **middle-mouse drag = pan** (never draws; left = draw/select, wheel = zoom); **Delete** removes the selected wall/opening/object if unlocked (a wall with a locked corner is protected with a message); **Ctrl+Z = granular builder undo** (one action at a time — draw, place, move, lock, delete, field edit — isolated from the doors-scope undo so it never rolls back the whole project).

### Inspector organised into tabs (2026-07-10)

- **The right-hand Panels inspector is a 6-tab structure, IDENTICAL in Front (elevation) and Top (2D builder) view**: **Room / Wall / Panel / Corners / Openings / Export**. State = `pnTab` (global); `pnInspTabs(headHtml, tabs)` renders the bar + active tab; only tabs with content show. Selecting a wall/panel/opening auto-focuses the matching tab (`pnSelWall`→wall, `pnSelPiece`→panel, `pnSelOpening`/plan-op→openings, `pnSelRoom`→room). **No setting was removed** — every control from the old flat list lives under exactly one tab. Rule for future work: keep both views on the same tab set; add new panel settings to an existing tab, don't reintroduce a flat scroll.
- **Tab contents**: **Room** = room defaults (material, frame, shaker target, door allowance, heights, skirting/sill, sheets, pricing, offset lines A–G, duplicate/delete room — Front; a defaults subset in Top). **Wall** = wall/geometry size + panel on/off + wall sides + skirting (this wall) + wall notes + delete wall (+ the builder help + length/thickness/height/endpoint-locks in Top). **Panel** = whole-run shakers / vertical grid, plus the per-panel override + panel notes when a physical panel is selected (Front). **Corners** = per-end **Auto/Through/Butt/Overlap** join, corner-gap priority (shorter/longer/winding), panel side flip, panel thickness, match-corner-shakers (plan rooms only; a non-plan wall shows a "use the 2D builder" hint). **Openings** = door/window/object editor + list + add. **Export** = Sheet DXF + Wall Layout DXF (all-rooms + this-room), mirroring the toolbar.
- **Shared helpers**: `pnWallPanelSections` now returns **named parts** `{onoff, panel, sides, skirt, notes}` (was one concatenated string) so callers place each part under the right tab; `pnCornerTabHtml(room, wi)` builds the whole Corners tab from either view; `pnSetWallEnd(wi, which, val)` sets a plan wall's `endA/endB` from EITHER view (Front has no `pnPlanSel`, so it resolves the edge from the wall id). UI-only round — the `PN_ENGINE` block is untouched, all 8 sheet goldens + `GOLDEN_WALL_LAYOUT` byte-identical, `check.mjs` green.

- **A vertical panel (zone) beside a door takes the DOOR ALLOWANCE, not a joint (2026-07-10 fix)**: `pnZonePieces` sets each zone side by what ABUTS it — the wall edge → `wall.sideL/R`; a **door → `doorAllow`** (like a horizontal span after a door); an object → normal frame; another panel mid-wall → `joint` (frame/2). Previously a mid-wall zone edge was ALWAYS `joint` (40mm), so a vertical panel butting a door only left 40mm and its shakers ran into the door's clearance (`doorAllow`, e.g. 147mm). The zone's PHYSICAL rectangle is unchanged (it still starts at the door edge, same width → nesting/price unchanged); only the internal cavity recedes, so a vertical panel now matches a horizontal panel beside the same door. The door itself already breaks the band correctly in every view (`pnWallSpans`, top-view band, DXF) — this was purely the zone-side allowance. Repro: `JamesTEST.fastcnc` / Ensuite 3 / Wall 2.

### Window / Object / mixed-panel spec — CONFIRMED decisions, pending implementation (2026-07-10)

Ednei's full spec compared to the engine. **Shipped (non-conflicting):** window auto-position (after a door + `doorAllow`, else before, else centre); frame-gap collision warning (`pnOpCollisions(wall,gap)`); **panel BELOW an elevated Object** (`Object Bottom > 2×frame` → floor-to-base horizontal panel, joint sides — mirrors the window lower panel; band already splits at the object; on-floor/too-small-gap → none). **Already correct, left as-is:** single whole lower panel under a low window (never split, even wide); `Bottom=0`→none; `Bottom≥bandH`→none; window X clamped `[0,W−w]`; one `pieces` source ⇒ preview=nesting=DXF consistent; vertical ≤1200 + auto-split; lower/cap always horizontal.

**CONFIRMED but NOT yet built (each regenerates GOLDEN_PANELS; irregular CNC geometry → build carefully + regen golden + tests):**
1. **Window side-panel step = TYPE A (irregular contour).** A low window (`0 < Bottom < bandH`) splits the band into SEPARATE left/right side panels. At the step line `Bottom + Sill` (Sill default 22) the side panel's window edge steps: **above** = full width to the window jamb; **below** = recessed ½ frame. The lower panel is **widened ½ frame on each applicable side** so there is no gap (Ednei chose A over "lower = exact window width"). Sill does not change window size nor lower-panel height. Result must be an irregular stepped piece, not a rectangle crossing the window.
2. **Mixed H↔V step = TYPE A.** Where a vertical panel meets a horizontal one, the vertical steps at `H Panel H`: full width above, recessed ½ frame on the H side below; a single joint (½+½), no overlap/gap/double frame; floor-aligned (verticals grow upward). V↔V adjacent = straight joint (no step). Special panels (under window/object) stay horizontal, never convertible to vertical.
3. **Merge equivalent adjacent HORIZONTAL panels** into one physical piece when equivalent (same height/frame/rules, no opening between) and within the horizontal width limit. Never merge H with V. Changes piece counts/nesting.

### Panels-inside detection + wall≠panel labels + horizontal Wall Layout DXF (2026-07-10)

- **Panels sit on ONE consistent face**, whatever direction the walls were drawn (item 1). The interior side (`sInt` in `pnPlanEdgeFrame`) is decided by **traversal + winding**: `pnPlanChain` traces the walls into one ordered chain, then every panel goes on the same rotational side of the traversal (sign from the chain's shoelace area). This beats both the old centroid dot-product (failed on **non-convex** rooms — centroid in the notch flipped panels outside) AND a naive point-in-polygon (an OPEN chain's implicit closure self-intersects → adjacent panels flip in/out, the "staircase" bug). For a **closed simple room** it equals the true interior (all inside, verified on U); for an **open run** it gives a coherent single face. Falls back to the centroid for T/X-junctions / disconnected graphs. Manual override: **`plan.flipInside`** (button "⇄ Flip panel side") flips the whole room's panel side in one click — the sanctioned way to pick which face on an ambiguous open run. Pure top-view rendering — no engine/DXF/quote/goldens change.
- **Wall size ≠ panel size in labels** (item 2): the wall keeps its FULL measured length; only the panel is shortened by the corner gap. Wall tabs / panorama / front-inspector now show the **measured wall size** (e.g. Wall 2 = 600×3200), and the panel size (578) is shown separately as "panel …". Rule: never print the shortened panel length where a WALL size is expected. `Math.max(wall.w, wall.measured)` = the wall size; `wall.w` = the physical panel.
- **Wall Layout DXF is HORIZONTAL/panoramic** (item 3): walls placed LEFT→RIGHT in app order (was stacked vertically). Wall label = measured wall size, panel labels = physical panel size. Golden `GOLDEN_WALL_LAYOUT.dxf` regenerated (3501→3428). Sheet DXF unchanged.
- **Wall Layout DXF detail + compact spacing (2026-07-10)**: `pnWallLayoutDxf` now insets the room's enabled offset/pocket lines (`room.lines` A–G) inside EACH shaker cavity, exactly like the Sheet DXF (`pnDxfForThickness`) — so **offsets/pockets added to a room export in the Wall Layout DXF too** (no lines → the cavity draws on `OFFSET_A`, unchanged). Overlap ends get an `overlap +N` text. Panoramic gaps cut well over half — Wall Layout DXF `GAP 250→110`, `ROOMGAP 700→300`; the on-screen panorama `pnPanoSvg` `gap 420→160`. To keep labels from colliding at the tighter gap, the DXF wall-label font shrinks to fit within its wall (wide walls stay 60). This is the **only** golden that moves (`GOLDEN_WALL_LAYOUT`, positions only); the Sheet DXF / NC / quote goldens stay byte-identical.
- **Offset preview draws the frame (2026-07-10)**: the Doors Offset-tab preview (`offsetPreview`) always draws the frame/cavity rectangle (uneven-aware), not only the offset lines — a per-side frame (e.g. bottom 305) is no longer invisible when no offset line is enabled. Preview-only: the cavity math (`cavityOf`/`cavsFor`) and the DXF were already correct for uneven frames.
- **Panels accordion inspector (2026-07-11)**: inside each category the content uses the DOORS accordion pattern (shared `.acc*` classes — structure/behaviour, not typography): collapsible sections with header + status chip + ▸/▾, session state in `pnAccOpen`, helper `pnAcc(id,title,chip,body,dflt)`. **Top-level categories = Room / Wall / Panel / Corners / Export** (Openings folded into Wall — see below). **Room** = Project Standards / Room Setup / Skirting & Sill / Offsets / **Pricing LAST**. **Wall** = Wall Setup / Wall ends (the per-end Auto/Through/Butt/Overlap — they belong to the wall) / Panel on-off / Skirting / **Openings** / Notes — **no panel side rules in Wall**. **Panel** = Selected panel (per-panel sides incl. Gap/Overlap) / Panel skirting / Panel notes / Shakers / Panel sides (this wall). **Corners** = global only (gap priority, flip, corner-shaker match, help) — nothing duplicated.
- **Openings live in the Wall category (2026-07-11)**: there is NO top-level Openings tab. The opening editor + list + add (Door/Window/Object) render inside the Wall tab via `pnFrontOpeningsAcc(room,wall,L)` (Front) and `pnPlanOpeningsAcc(room,idx)` (Top). Selecting/adding an opening (`pnSelOpening`, `pnAddOpening`, a `.pno` click, or a plan-op select) sets `pnTab='wall'` and opens `pnAccOpen.o_sel`/`o_list`. Opening data + behaviour are unchanged (`wall.openings` / `plan.openings`; move/edit/delete; old files load the same).
- **Panels inspector height is pinned to the drawing area (2026-07-11)**: `.pn-insp` uses `height:calc(100vh − 282px);min-height:340px;max-height:calc(100vh − 282px)` — the SAME band as `.pn-canvas` — so a long accordion inspector can never grow taller than the fixed view and push the page. The drawing area + the view toolbar stay put; only the inspector scrolls internally (its `.pn-itabs` category bar stays sticky at the top). Any future inspector work must keep the inspector height matched to the canvas.
- **Thickness selector (2026-07-11)**: Room → Project Standards shows **Thickness (12/18/22mm only)** instead of a Material select. It swaps the `NNmm` in `room.mat` (family kept → pricing + DXF grouping follow) AND syncs `plan.panelLayer.thickness` on drawn rooms, so the corner gap/overlap always uses the same real thickness. "Apply standards to all rooms" copies thickness/frame/target/cornerMatch/doorAllow/panel heights to every room.
- **Offset scope Project vs Room (2026-07-11)**: `pnProjLines` (shared A–G set) + `room.linesScope` `'project'|'room'`. Project scope = the shared set (editing changes every project-scope room); Room only = the room's own `room.lines`. Legacy rooms without `linesScope`: any enabled room line ⇒ `'room'` (old files render byte-identical), else `'project'`. New rooms default `'project'`. Persistence is ADDITIVE (`kab_panels.proj.lines`, `.fastcnc doc.panelProject.lines`). All readers (front view, Sheet DXF, Wall Layout DXF) go through `pnLinesFor(room)`.
- **Panel-side GAP / OVERLAP (2026-07-11, engine — opt-in)**: a per-panel side override (`panelOv[pid].sideL/R`) may be `'gap'` (edge pulled back by the panel thickness) or `'overlap'` (edge extended past its boundary by the panel thickness). pt = `plan.panelLayer.thickness`, else the material thickness — **never a hard-coded 22**. The piece's grid re-flows over the new physical width; the gap/overlap side keeps a NORMAL frame margin; `p.sheet` recomputed; nesting/quote/DXF follow the new size. No override → byte-identical.
- **Overlap conflicts are ALLOWED but RED (2026-07-11)**: (a) same-wall — an adjusted (`ovPhys`) piece intersecting another flags BOTH `p.conflict`, paints the intersection red with an "overlap conflict" label and raises a warning with the mm; only ovPhys pieces are checked, so window band+lower pairs are never false-flagged. (b) corner — `pnPlanCompile` sets `cornerInfo.l/r.conflict` when an overlap end meets a neighbour whose panel does NOT butt (through/overlap occupy the corner; butt/free = clean). Front view fills the extension band red ("⚠ conflict +N"), Top view tags red, and pnLayoutRoom warns. Never blocks the user.
- **Per-panel skirting UI (2026-07-11)**: `wall.panelSkirt[pid] = {mode:'custom',on,h}` now editable (Panel tab → Panel skirting). Resolver order stays panel > wall > room (`skirtFor(wi,pid)`); only that panel's bottom margin/grid moves. Wall skirting (whole wall) stays in the Wall tab.
- **Offset auto-scroll fix (2026-07-11)**: `renderPanels()` preserves the inspector's `scrollTop` AND the focused field (input index + selection, `focus({preventScroll:true})`) across the innerHTML rebuild — toggling/typing offsets no longer jumps the panel. Any future full-rebuild render must keep this capture/restore.
- **Panels label hygiene + tabs (2026-07-10, UI/SVG/CSS only — goldens byte-identical)**: (a) the builder status line shows only room · wall · panel count — **no "Prices are in the Quote tab" text** (prices stay hidden regardless). (b) `pnPanoSvg` per-wall 2nd line = `wall X[ · panel Y]` only — **no repeated `height` and no `click to open`** (long lines were overlapping on narrow walls). (c) `pnWallSvg` bottom summary is ONE line **`Wall width: {measured} · Panel width: {physical}`** (Panel width only shown when it differs from the wall by a corner gap/overlap); the per-panel width number is drawn only when the run is split, so the panel size is never repeated; **opening edges are NOT added to the bottom dimension chain** (a window keeps its own `W × H` label, no duplicate width at the bottom). (d) panel letters (`Wall 1A`…) render the letter as a bold-800 ink `<tspan>` in Front + panorama (readable, not dominant) — the Wall Layout **DXF** letter is unchanged. (e) `.pn-itab` tabs are styled like the Doors editing buttons (`.tp-op`/`.acc`): filled `var(--input)`, 1.5px border, `var(--ink)` text, hover, clear blue `.on`. None of this touches the DXF/NC/quote writers.

### Corner rule confirmed + window fix + shaker match + Wall Layout DXF (2026-07-10)

- **Corner rule flipped to the confirmed spec** (see "CONFIRMED corner rule" above): through = frame+pt, butt = normal frame + pt gap. Plan rooms only (non-plan rooms + all 8 sheet goldens byte-identical). Locked by `check.mjs` (U + L + the 2000/1000/2000 example, pt 22 & 18).
- **Window overlap fixed properly** (item 6): a **lower panel** under a window is created ONLY when the sill sits INSIDE the band (`60 < bottom < bandH`). At/above the band top (`bottom >= bandH`) the band is left whole and NO lower panel is made — previously a full-height lower panel overlapped the un-notched band ("panels on top of panels"). **New window default `bottom = hPanelH`** (panel-band top) so a fresh window never cuts the band. `GOLDEN_PANELS` recipe pins `ow.bottom = 900` to stay byte-identical.
- **Cross-corner shaker match** (`room.cornerMatch`, item 5, **opt-in, default OFF = byte-identical**): `pnRunGrid(run, D, count, endW)` — when `endW>0` the run's CORNER-adjacent shakers are pinned to `endW` (the room target) and the middle shakers flex, so the last shaker on one wall == the first on the adjacent wall even across an L/U corner (separate runs, not a chained seam). Straight `joint`-chained runs still equalise seam cells as before. True whole-run seam-equality across a 90° turn is still not modelled (runs are linear) — this pins the END cells, which is the visible corner. Explicit `wall.shakerCount` still applies within the pinned grid.
- **Two DXF export types** (item 7): **Sheet DXF** (`pnDxfForThickness`/`pnBuildDxfByThickness`, `⬇ Sheet DXF`) = pieces nested on sheets FOR CUTTING — unchanged, existing layers/goldens. **Wall Layout DXF** (`pnWallLayoutDxf`, `⬇ Wall DXF`) = a SEPARATE non-cutting export: walls stacked in app order (Wall 1 on top), each full measured outline with its panels inside, corner gaps + labels (Wall N / Wall NA…). Layers `WALL`/`WALL_GAP` (new, additive to `DXF_LAYERS`) + reused `OUT`/`OFFSET_A`/`INSIDE`/`text`; NO `SHEET`/`PART_NUMBER`. Golden `GOLDEN_WALL_LAYOUT.dxf` (3501). Never mix the two.

### 2D builder settings + panel-on-off + winding (2026-07-09)

- **Simplified builder controls**: the visible toggles **Mode**, **Keep 90° square** and the **Pan** tool are removed. Draw/Select are the two toolbar buttons; middle-mouse pans, wheel zooms, Delete deletes, Ctrl+Z undoes. Keep-square stays **ON automatically** (internal — `pnKeepSquare` still defaults true; `plan.keepSquare` still honoured if a saved plan set it off).
- **Wall/panel settings in Top view**: the Top-view inspector now shows the same panel rules as Front view via the shared `pnWallPanelSections(room,wi,L)` — Panel on/off, Shakers (or Vertical grid), Wall sides, Skirting, Wall notes — plus a **Room defaults** block (material, frame, shaker target, door allowance, panel heights, skirting). Selecting a wall in Top view sets `pnSel.wall` so those setters target it. No need to switch to Front view to configure panels.
- **Panel ON/OFF per wall (`edge.noPanel` for plan rooms, `wall.noPanel` for non-plan)**: turning a wall's panel Off keeps the wall in the drawing but produces **zero pieces** → excluded from quote / DXF / nesting (`pnLayoutRoom` + `pnRoomRuns` skip `w.noPanel`). For a plan room the flag lives on the plan EDGE so it is captured by the granular undo snapshot and by save/load; `pnPlanCompile` derives `wall.noPanel` from `edge.noPanel`. Default off → every existing room + all 8 goldens byte-identical. Top view shows "· no panel" on the wall; the teal band is hidden.
- **No prices in builder/editing views**: the Panels builder status bar shows only the room · wall · panel count (was "Panels £ · Doors £ · Job £"). Totals live in the **Quote tab** only — clients never see internal £ while drawing. Price CONFIG inputs still exist under Room settings.
- **Corner winding (draw-direction) awareness — foundation**: `pnPlanCompile` computes room **winding** (shoelace over the ordered edge chain; SVG y-down → sum>0 = clockwise) and records it on `cornerInfo.winding`. `plan.cornerMode` = **`auto`** (default — longer wall through, byte-identical, current behaviour) | **`winding`** (opt-in — at a clean two-wall corner the ARRIVING wall passes through and the LEAVING wall butts, flipped for anticlockwise, so the lapping rotates consistently around the room = the return/column case). Wall draw order + each edge's a→b direction are preserved in the plan model. The per-corner manual override `edge.endA`/`endB` (`auto|through|butt`) always wins. **Deferred / needs Ednei's confirmation**: which exact panel reaches full length in the ACW case (the item-4 description differs from the confirmed frame-allowance rule) — `winding` is therefore opt-in, not the default.
- **Selection hit priority (Top view)**: endpoint/lock → opening/object → wall → empty. Endpoint hit radius is now a TIGHT ~24 screen-px (was ~140px, which stole wall clicks near corners); draw-snap stays looser (~40px). Endpoint dots stay subtle/transparent.
- **Add multiple openings**: `pnPlanAddOpening` resolves the target wall from either an edge OR the currently-selected opening's edge, and the opening inspector has +Door/+Window/+Object — so after moving a door you can keep adding without re-selecting the wall.

## Nesting

- Margem externa da sheet: `7mm`. Espacamento entre pecas: `7mm`.
- Tentar o menor numero de chapas possivel (MaxRects, varias ordenacoes, mantem o de menos chapas).
- Pecas estreitas (lado menor `< 120mm`) tendem ao MIOLO da chapa e as maiores para as bordas, para a peca nao perder base e balancar no corte. E so um criterio de desempate (melhor esforco): nunca aumenta o numero de chapas.

## Offcut — tamanho minimo

Util so se: `(lado menor >= 350 E lado maior >= 500)` OU `(lado menor >= 120 E lado maior >= 1500)`.

Exemplos: `350x600` sim, `250x700` nao, `124x900` nao, `120x1600` sim, `190x1060` nao, `256x1586` sim, `211x1625` sim, `503x435` sim.

## Offcut — forma e L-shape

- O offcut e um retangulo, ou no maximo um `L` de DOIS retangulos que se SOBREPOEM no canto. Nunca `C` nem `E`.
- A peca principal e o maior retangulo vazio que passa sozinho no tamanho minimo. O `L` so aparece quando existe um segundo retangulo, tambem util, que se sobrepoe a principal num canto (uniao em `L`, nunca `+`/`T`/retangulo maior).

## Offcut — texto

- Texto = a palavra `OFFCUT` + o tamanho, sem flechas/linhas de cota.
- No `L`, os dois retangulos sao MAXIMOS e se sobrepoem no canto compartilhado, entao os dois tamanhos sao escritos por inteiro com barra: `2020 x 150 / 750 x 350` (o `350` ja inclui a lateral `150` da outra peca). Retangulo simples leva so `OFFCUT` + `L x A`.
- O texto fica no layer separado `OFFCUT_TEXT` (nunca no mesmo layer `OFFCUT` da geometria), para o contorno poder ser processado sem o texto junto.

## Offcut — chanfro de identificacao (3mm)

- Cada offcut leva um chanfro de `3mm` a `45 graus` para identificar visualmente que e um offcut (preview e DXF). NAO altera o tamanho real informado.
- O contorno do offcut e uma linha ABERTA (os lados que coincidem com a borda da sheet desaparecem). O chanfro tem que ficar SOBRE a linha desenhada, no canto mais externo dela — nunca na quina fisica da chapa (senao ficaria solto / cortando fora da chapa). Quando o offcut tem so uma linha desenhada, o chanfro vai naquela linha. O chanfro (diagonal) sempre aparece.

## DXF — layers usados pelo offcut

- `OFFCUT` — contorno (linhas) + chanfro.
- `OFFCUT_TEXT` — palavra `OFFCUT` + tamanho.

## Flushback — geometria + toolpaths de referência (confirmado 2026-07-07)

Fonte de verdade: `Flushback 18mm.dxf` (porta 480×497, frame 65) + `Flushback Insert 12mm.dxf` +
os `.ToolpathTemplate` do VCarve ("18mm Flushback", "12mm Flushback Insert"). Regra: a estrutura é
**relativa ao frame** — muda o tamanho da peça, o padrão continua o mesmo a partir do frame.

### Porta (todas as linhas com canto redondo r2.5; CAVIDADE = inset do frame; anel(d) = cavidade expandida d mm)

| Ordem | Operação (ordem REAL de corte — confirmada 2026-07-07) | Layer | Anéis (d a partir da cavidade) |
|---|---|---|---|
| 1 | "6mm OUT/IN Frame 17mm" — T1 Ø6, Profile Outside, **17mm**, allowance 0.15, last pass 1.0, ramp 100 (desbaste: deixa 1mm de piso + 0.15 de parede) | `OUT` | contorno externo (reto) + anel(0) |
| 2 | "6mm Pocket Frame 6.5mm" — T1, Inside, 6.5mm (banda do pocket da face) | `OFFSET_A` | anel(0) + anel(7) |
| 3 | "4mm pocket Insert 12.3mm" — T4 Ø4, Inside, 12.3mm, last pass 1.0 (banda do rebaixo) | `POKET_INSERT` | anel(7) + anel(14) |
| 4 | "4mm Insert 12mm" — T4, **On**, 12.3mm, last pass 1.0 | `IN_22MM` | anel(0) |
| 5 | "4mm In 18mm" — T4, Inside, 18mm (cavidade passante) | `IN_22MM` | anel(0) |
| 6 | "2mm Shadow" — T2 Ø2, Inside, 2mm | `SHADOW` | anel(16) |
| 7 | "6mm OUT/IN FINISH" — T1, Outside, **18mm**, 1 passada, last pass 1.0, ramp 100 (liberta a peça POR ÚLTIMO) | `OUT` | contorno externo (reto) + anel(0) |

(`OUT_10MM` = anel(0) presente na referência; op não incluída nos templates enviados.)
**Regra de conversão descoberta**: o binário `.ToolpathTemplate` (mcTemplateTree) guarda os toolpaths
**INVERTIDOS** em relação à lista do VCarve — Ednei confirmou que o rough 17mm roda ANTES do FINISH 18mm,
e o arquivo lista o FINISH primeiro. Sempre INVERTER a ordem do binário ao converter (vale para o insert
também: pocket 5.5 primeiro, contorno 12mm por último). A ordem invertida bate com a lógica de produção:
pockets/rebaixos com a peça presa na chapa, cortes passantes no final.
No exemplo (F=65): insets 65 · 65+58 · 65 · 65 · 58+51 · 49 — os passos "7, 7, 2" do Ednei (65→58→51→49).
As repetições da MESMA geometria em layers diferentes são INTENCIONAIS (cada layer alimenta uma op).

### Insert (12mm MR MDF)

- Tamanho = cavidade + **13.95/lado** (=+27.9 total; ex.: cavidade 350×367 → insert **377.9×394.9**). Antes era 14/lado; o 0.05/lado é folga de encaixe no rebaixo de 12.3mm.
- Contorno redondo r2.5 + **2 anéis internos** a **6.9** e **11.95** do contorno (banda de pocket 5.5mm). **3 polylines no total** — o DXF de referência tinha cada linha DUPLICADA (contorno ×2, anéis ×2); as duplicatas NÃO são recriadas.
- Template do insert (ordem real, binário invertido): 1. "4mm Pocket 5.5mm" — T4, Inside, 5.5mm (layer ref `OFFSET_5MM` ≙ `IN` do insert) · 2. "6mm Out Insert 12mm" — T1, Outside, 12mm (layer ref `OUT_INSERT_15MM` ≙ `OUT` do insert; corta a peça livre por último).
- Trad continua overlay 12/lado e anéis 7/14 retos; **reeded continua 14/lado** até vir um arquivo de referência reeded.

### Templates por peça física (schema v2, confirmado 2026-07-07)

- Todo template declara o alvo físico: `appliesTo:{part:'body'|'insert', type:'flush'|…, th:18|12}`. **Uma porta Flushback recebe DOIS templates**: "Flushback 18mm Frame/Body" (7 ops) no corpo e "Flushback 12mm Insert" (2 ops) no insert — o ⚡ Auto aplica TODOS os templates auto que casarem por completo, cada um com escopo e `role` próprios.
- Motor: `params.role` em `tpPathParts` filtra por peça física (`insert` = só peças insert; `body` = só corpos; ausente = tudo, comportamento antigo). É filtro puro — cam-reviewer 2026-07-07 provou que é **obrigatório**: sem role, o op do corpo (18mm) cortaria a chapa do insert (12mm) até Z−6 no spoilboard (as chaves `3_0`/`3_0_i` colidem no parseInt do scope).
- Layers cortáveis hoje: contorno (`OUT` no corpo; `OUT_INSERT_15MM`→`OUT`+role no insert). Demais ops entram DESLIGADOS ("next op") preservando a ordem do arquivo — a ordem NUNCA é reordenada sem regra explícita. Par desbaste+acabamento no OUT (17mm+18mm) é intencional (aviso de duplicado ganha nota).
- Preview: **▶ Simulate** = player 2.5D passo-a-passo (vista de topo, remoção por profundidade codificada em cor, banda/furo/kerf na largura real da fresa, abas corpo/insert, medidor de profundidade por op). Simulação 3D real = fase futura.
- Ao converter futuros `.ToolpathTemplate`: mapear nome/appliesTo/ops{name, layer, kind, tool{num,dia}, side, params{cutDepth, passes, lastPass, allowance, ramp}} — 1 op por toolpath do arquivo, **na ordem INVERTIDA do binário** (o mcTemplateTree guarda a lista de trás pra frente — confirmado com o Ednei 2026-07-07 pelo par 17mm/18mm).

## Offset Depth — pockets (confirmado 2026-07-07, protótipo Kabacal 3D)

- Cada offset line (A–G) ganha um campo `depth` (mm). `depth > 0` = pocket/recesso a partir daquela linha.
- **Banda**: se existe outra linha ativa mais para dentro, o pocket é a banda entre a linha X e a PRÓXIMA linha para dentro — para exatamente nessa fronteira, nunca corta além dela. (Ex.: 22mm, frame 50, B na frame com depth 5, C 7mm depois ⇒ banda B→C com 7mm de largura × 5mm de profundidade.)
- **Área completa (default confirmado com Ednei)**: se a linha com depth NÃO tem nenhuma linha ativa dentro dela, o pocket é a ÁREA TODA dentro dessa linha — coincide com o significado da layer `Pocket` (cavidade de porta trad).
- Depth ≥ espessura é clampado (espessura − 0.5mm; em front+back, metade − 0.5mm) com aviso; bandas de largura zero são inválidas.
- A fonte de verdade é o array de operations derivado (`opsFor()` no protótipo): profile / line / pocket / drill. DXF/true-path futuros consomem as mesmas operations, nunca a malha 3D.
