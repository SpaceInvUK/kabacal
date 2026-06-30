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
