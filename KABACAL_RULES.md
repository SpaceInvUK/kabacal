# Kabacal — regras confirmadas

App: `index.html` (antigo `order-entry-beta.html`). URL: https://spaceinvuk.github.io/kabacal/

## Panels (modo Panels — confirmado 2026-07-07)

Modo separado do Doors (toggle Doors | Panels no header); estado próprio (`panelRooms`, localStorage `kab_panels`); os painéis NUNCA entram na lista de parts do Doors. O Quote é o ponto de encontro: seção "Wall panelling" própria + Doors subtotal + Panels subtotal + total combinado; serviços/spray/VAT aplicam UMA vez no job. **Job só-Doors tem que sair byte-idêntico** (panels.total=0 — invariante no check.mjs e provado vs HEAD).

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

- Colunas ≤1206 de largura (auto = teto(L/1206); override nunca abaixo do mínimo), altura padrão 3000 (= cap do 10x4). Rows: stepper, default 2; a fileira de baixo alinha com a linha do painel horizontal (hPanelH − frame).

### Aberturas / sill / skirting

- Door 900×2100 · Window 1200×1100 com bottom 900 · Object 2000×2000; X medido de L ou R; colisão é MOSTRADA (⚠), nunca move sozinho.
- Door/Object cortam a cobertura; Window é recorte + painel inferior separado sob a largura toda; sill de janela = setting do room (default 22). Cap panel acima de Door/Object (toggle), lados meio-frame; cap alto/largo demais vira colunas ≤1206.
- Skirting default 225 (linha guia tracejada só no preview; shaker inferior começa em skirting+frame). Nunca vai para nesting/DXF.

### Offset lines A–G

- Mesmo modelo do Doors ({en, mm, round}) no room, desenhadas dentro de CADA cavidade de shaker no preview e EXPORTADAS no DXF: linha ativa = retângulo recuado `mm` dentro de cada cavidade na layer `OFFSET_X` (round corners r2.5 como Doors); **sem nenhuma linha ativa, a própria cavidade sai em `OFFSET_A`** — exatamente a disciplina do Doors (linha ativa substitui a base).

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

| Layer | Anéis (d a partir da cavidade) | Operação (do template, ordem do arquivo) |
|---|---|---|
| `OUT` | contorno externo (reto) + anel(0) | 1. "6mm OUT/IN FINISH" — T1 Ø6, Profile Outside, 18mm, 1 passada, last pass 1.0, ramp 100 · 7. "6mm OUT/IN Frame 17mm" — T1, Outside, 17mm, allowance 0.15, last pass 1.0 |
| `SHADOW` | anel(16) | 2. "2mm Shadow" — T2 Ø2, Inside, 2mm |
| `IN_22MM` | anel(0) | 3. "4mm In 18mm" — T4 Ø4, Inside, 18mm · 4. "4mm Insert 12mm" — T4, **On**, 12.3mm, last pass 1.0 |
| `POKET_INSERT` | anel(7) + anel(14) | 5. "4mm pocket Insert 12.3mm" — T4, Inside, 12.3mm, last pass 1.0 (banda do rebaixo) |
| `OFFSET_A` | anel(0) + anel(7) | 6. "6mm Pocket Frame 6.5mm" — T1, Inside, 6.5mm (banda do pocket da face) |
| `OUT_10MM` | anel(0) | (linha presente na referência; op não incluída nos templates enviados) |

No exemplo (F=65): insets 65 · 65+58 · 65 · 65 · 58+51 · 49 — os passos "7, 7, 2" do Ednei (65→58→51→49).
As repetições da MESMA geometria em layers diferentes são INTENCIONAIS (cada layer alimenta uma op).
**Pergunta em aberto**: a ordem acima é a ordem do ARQUIVO; a op 7 (17mm, +0.15) parece desbaste que
rodaria ANTES da op 1 (FINISH 18mm) — confirmar a ordem real na lista do VCarve antes de gerar NC disso.

### Insert (12mm MR MDF)

- Tamanho = cavidade + **13.95/lado** (=+27.9 total; ex.: cavidade 350×367 → insert **377.9×394.9**). Antes era 14/lado; o 0.05/lado é folga de encaixe no rebaixo de 12.3mm.
- Contorno redondo r2.5 + **2 anéis internos** a **6.9** e **11.95** do contorno (banda de pocket 5.5mm). **3 polylines no total** — o DXF de referência tinha cada linha DUPLICADA (contorno ×2, anéis ×2); as duplicatas NÃO são recriadas.
- Template do insert: 1. "6mm Out Insert 12mm" — T1, Outside, 12mm (layer ref `OUT_INSERT_15MM` ≙ `OUT` do insert no Kabacal) · 2. "4mm Pocket 5.5mm" — T4, Inside, 5.5mm (layer ref `OFFSET_5MM` ≙ `IN` do insert).
- Trad continua overlay 12/lado e anéis 7/14 retos; **reeded continua 14/lado** até vir um arquivo de referência reeded.

## Offset Depth — pockets (confirmado 2026-07-07, protótipo Kabacal 3D)

- Cada offset line (A–G) ganha um campo `depth` (mm). `depth > 0` = pocket/recesso a partir daquela linha.
- **Banda**: se existe outra linha ativa mais para dentro, o pocket é a banda entre a linha X e a PRÓXIMA linha para dentro — para exatamente nessa fronteira, nunca corta além dela. (Ex.: 22mm, frame 50, B na frame com depth 5, C 7mm depois ⇒ banda B→C com 7mm de largura × 5mm de profundidade.)
- **Área completa (default confirmado com Ednei)**: se a linha com depth NÃO tem nenhuma linha ativa dentro dela, o pocket é a ÁREA TODA dentro dessa linha — coincide com o significado da layer `Pocket` (cavidade de porta trad).
- Depth ≥ espessura é clampado (espessura − 0.5mm; em front+back, metade − 0.5mm) com aviso; bandas de largura zero são inválidas.
- A fonte de verdade é o array de operations derivado (`opsFor()` no protótipo): profile / line / pocket / drill. DXF/true-path futuros consomem as mesmas operations, nunca a malha 3D.
