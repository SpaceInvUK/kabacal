# Kabacal — Roadmap / Status

App: `index.html` · Publicado: https://spaceinvuk.github.io/kabacal/ · Repo: `SpaceInvUK/kabacal`

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
