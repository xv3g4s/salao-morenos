# Maquete do celular na página do Clube

A Home tem uma seção com a maquete do agendamento no celular (cartão escuro,
telefone com inclinação 3D no mouse, selos "Agenda por unidade" e "Mensalidade
única", a palavra MORENOS em prata). A página `/o-clube/` não tinha — ela é
montada pelo `PaginaMorenos`, que não conhecia esse tipo de seção.

Os três arquivos desta pasta são **recortes exatos** da `Home.dc.html`, e o
`fonte/build.py` os injeta no `PaginaMorenos` durante o build:

| arquivo | o que é | de onde veio |
| --- | --- | --- |
| `secao.html` | a seção inteira, como `sc-if` de um novo tipo `isMaquete` | `Home.dc.html`, seção `#clube` |
| `logica.js` | `cardRef`, `sheenRef`, `phoneRef` e `cineRef` | a classe da `Home.dc.html` |
| `keyframes.css` | as animações `cine*` | o `<style>` do `<helmet>` da Home |

O `id` virou `maquete` (na Home é `clube`) para não colidir com a âncora da
página do Clube.

**Se o design for reexportado** e essa seção mudar na Home, estes recortes ficam
velhos: atualize os três arquivos a partir da Home nova. Se as agulhas do
`build.py` não baterem, o build para e avisa — não publica desatualizado.

O certo, a médio prazo, é a maquete virar um componente do próprio design
(`ClubeMockup.dc.html`), usado pela Home e pelo Clube via `dc-import`. Aí esta
pasta desaparece.
