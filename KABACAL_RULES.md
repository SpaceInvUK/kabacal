# Kabacal — regras confirmadas

App: `index.html` (antigo `order-entry-beta.html`). URL: https://spaceinvuk.github.io/kabacal/

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
