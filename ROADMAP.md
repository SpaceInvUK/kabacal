# Kabacal — Roadmap / Status

App: `index.html` · Publicado: https://spaceinvuk.github.io/kabacal/ · Repo: `SpaceInvUK/kabacal`

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
