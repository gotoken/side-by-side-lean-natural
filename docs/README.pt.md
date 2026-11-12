# Taiyak

[English](../README.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Português** · [Русский](README.ru.md)

Um navegador que divide o código-fonte Lean 4 em declarações e mostra cada uma ao lado de uma tradução matemática no idioma natural que você escolher. Ele só lê o código-fonte: não é preciso compilar o Lean. O nome vem do japonês 対訳 (*taiyaku*), um texto apresentado lado a lado com a sua tradução.

**Versão web: <https://taiyak.pages.dev/>**

![Impl.lean da demonstração, com o Lean e a tradução lado a lado](screenshot.png)

## Recursos

- Abrir um repositório Lean 4 a partir de uma URL do GitHub (inclusive repositórios privados), de um arquivo ZIP ou de uma pasta
- Mostrar o código Lean e a tradução lado a lado, declaração por declaração (`def`, `theorem`, `structure`, …). Traduzir para japonês, inglês, chinês (simplificado ou tradicional), coreano, francês, alemão, espanhol, português ou russo, ou digitar qualquer outro idioma
- Uma única escolha de idioma define as traduções, a interface, o glossário e as explicações de "Perguntar ao Claude". Os textos da interface estão embutidos para os dez idiomas acima (inglês nos demais casos). O glossário está embutido em japonês e inglês; para outros idiomas, o Claude o traduz na primeira vez que você escolhe o idioma e o navegador o guarda (a palavra tocada vem primeiro, o resto continua em segundo plano com um indicador de progresso). Nas configurações também é possível fixar o idioma da interface separadamente
- Na primeira visita, a página abre em japonês se o navegador preferir japonês a inglês, e em inglês nos demais casos
- Ao traduzir, as definições de arquivos importados às quais o arquivo atual faz referência são enviadas como contexto
- Tocar num identificador mostra um resumo da definição e permite ir até ela. Símbolos e táticas como `∀`, `omega` e `rcases` têm uma explicação curta
- Provas longas começam recolhidas
- As traduções ficam guardadas no navegador. Exporte-as e faça commit no repositório, e qualquer pessoa que o abrir poderá lê-las sem chave de API
- Criar links de compartilhamento que abrem um arquivo ou uma declaração específicos

## Uso

### Versão web (Cloudflare Pages)

Abra <https://taiyak.pages.dev/>.

1. Digite uma URL do GitHub e pressione "Abrir"
2. Em "Configurações", informe uma chave de API da Anthropic, da OpenAI ou do Google (necessária para traduzir). Para um repositório privado, informe também um token do GitHub. "Criar um token no GitHub" nas configurações abre a página de tokens do GitHub com acesso somente leitura (Contents: read) e validade de 30 dias já preenchidos: escolha os repositórios que quer ler e crie o token
3. Pressione "Traduzir este arquivo", ou "Traduzir" em um bloco específico

Aberta sem URL, a página mostra uma demonstração: um modelo em Lean de `rb_range_component_beg_len` (a normalização de argumentos de intervalo) do `range.c` do CRuby, com sua especificação, as propriedades P1–P4 e um modelo da correção. Ela vem do repositório de experimentos do autor, `gotoken/cruby-formalized-trial` @74e11c6, que não é público. `Basic`, `Cases`, `Spec`, `Impl`, `Statements` e `Fixed` vêm com traduções para inglês e japonês; os demais arquivos podem ser traduzidos na hora.

### Versão claude.ai

Publique `dist/claude-artifact.html` como um artefato do claude.ai, e cada pessoa que o visualizar traduz com a própria conta do Claude (sem chave de API). Páginas dentro do claude.ai não conseguem acessar o GitHub; por isso, baixe o repositório com "Code → Download ZIP" no GitHub e carregue-o com "Abrir ZIP".

### Links de compartilhamento

Enquanto a versão web mostra um repositório do GitHub, a URL na barra de endereços é um link de compartilhamento. Os números de linha no canto superior direito de cada bloco (`L16–17` etc.) copiam um link para aquela declaração.

| Parâmetro | Significado |
|---|---|
| `repo` | `owner/repo` |
| `ref` | Branch, tag ou commit (o branch padrão se omitido) |
| `path` | Arquivo a abrir |
| `decl` | Nome da declaração até a qual rolar (blocos sem nome usam a forma `id=b12`) |
| `lang` | Idioma da tradução |

Exemplo: <https://taiyak.pages.dev/?repo=Broyojo/python-formalization&path=lean/PyLean/RangeSlice/Length.lean&decl=slow_isLen&lang=Portugu%C3%AAs>

### Incluir as traduções em um repositório

1. Traduza os arquivos desejados
2. Use "Configurações" → "Exportar traduções" para obter um arquivo JSON (só o repositório aberto é exportado)
3. Faça commit dele no repositório de destino como `.taiyak/pt.json` (um arquivo por idioma; o nome é livre)

Ao abrir um repositório, `.taiyak/*.json` é carregado automaticamente. Uma tradução feita por você para o mesmo bloco tem prioridade. As traduções são associadas por idioma, nível de detalhe e um hash do caminho do arquivo e do texto do bloco; assim, quando o código de um bloco muda, a tradução antiga deixa de ser usada.

## Chaves e dados

- A chave de API e o token do GitHub são usados apenas dentro do navegador. Só são salvos no localStorage se você escolher "Lembrar neste navegador". Não os salve em computadores compartilhados.
- A página se comunica apenas com `api.github.com`, `api.anthropic.com`, `api.openai.com` e `generativelanguage.googleapis.com`. Na versão web, a Content-Security-Policy em `public/_headers` impõe isso, e o navegador recusa enviar qualquer coisa para outro destino. Os scripts embutidos também são fixados por hash.
- Ao traduzir, o código Lean do arquivo e das definições às quais ele faz referência é enviado à API escolhida (Anthropic, OpenAI ou Google). Verifique a política da sua organização antes de traduzir código privado.
- Para o token do GitHub, use um fine-grained personal access token: selecione apenas os repositórios necessários, com Contents: Read-only.

## Como funciona e limitações

- A divisão é estática: considera as palavras-chave de nível superior e se o texto está dentro de comentários ou strings. O Lean não é executado; portanto, informações de tipo, expansão de notações e macros e os objetivos intermediários de provas por táticas não são usados.
- O contexto segue os imports até 3 níveis e 30 arquivos, e reúne as definições cujo nome coincide. Nomes curtos com definições demais são ignorados.
- As traduções são feitas por um LLM e podem conter erros. Leia-as confrontando com o código.
- Declarações dentro de blocos `mutual`, ou geradas por macros, podem não ser divididas corretamente.

## Desenvolvimento

```sh
python3 tools/build.py             # gera public/ e dist/ a partir de src/ e demo/
node --test "test/*.test.cjs"      # testes de divisão, coleta de contexto e análise de respostas
python3 -m http.server -d public 8000
```

```
src/        template.html, core.js (divisão e outras partes sem DOM), app.js (UI),
            i18n.js (idiomas e textos da interface), glossary.js (glossário de símbolos)
demo/       arquivos Lean da demonstração, suas traduções para inglês e japonês, BSDL do CRuby
vendor/     KaTeX, JSZip (MIT)
tools/      build.py, fontes das traduções da demonstração
test/       testes node:test
docs/       traduções deste README, captura de tela
public/     versão web (resultado do build; o Cloudflare Pages serve este diretório)
dist/       versão claude.ai (resultado do build; um único arquivo)
```

Depois de alterar `src/` ou `demo/`, execute `tools/build.py` e faça commit também de `public/` e `dist/`. A CI verifica se o resultado do build corresponde às fontes. Os arquivos gerados ficam no repositório para que o que é servido possa ser lido aqui exatamente como está.

## Implantar no Cloudflare Pages

1. No painel da Cloudflare, escolha Workers & Pages → Create → Pages → Connect to Git e selecione este repositório
2. Framework preset: None. Build command: vazio. Build output directory: `public`
3. Depois de salvar, cada push para `main` é implantado

Os cabeçalhos de segurança de `public/_headers` também são servidos.

## Licença

- Todo o repositório, incluindo os arquivos Lean da demonstração: licença BSD 2-Clause (`LICENSE`)
- `Impl.lean` e `Fixed.lean` da demonstração citam trechos curtos do `range.c` do CRuby (Copyright (C) 1993-2007 Yukihiro Matsumoto) e do patch de ruby/ruby#19824. O CRuby pode ser redistribuído sob a BSDL de 2 cláusulas ou a Ruby License; os trechos são usados sob a BSDL (`demo/CRuby-BSDL.txt`)
- `vendor/`: KaTeX e JSZip (ambos MIT)

Consulte `NOTICE` para mais detalhes.

Este arquivo é uma tradução de [README.md](../README.md) (em inglês). Em caso de divergência, prevalece a versão em inglês.
