# Taiyak

[English](../README.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [한국어](README.ko.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Español** · [Português](README.pt.md) · [Русский](README.ru.md)

Un navegador que divide el código fuente de Lean 4 en declaraciones y muestra cada una junto a una traducción matemática en el idioma natural que elijas. Solo lee el código fuente: no hace falta compilar Lean. El nombre viene del japonés 対訳 (*taiyaku*), un texto presentado junto a su traducción.

**Versión web: <https://taiyak.pages.dev/>**

![Impl.lean de la demo, con el Lean y su traducción lado a lado](screenshot.png)

## Funciones

- Abrir un repositorio de Lean 4 desde una URL de GitHub (también repositorios privados), un archivo ZIP o una carpeta
- Mostrar el código Lean y su traducción lado a lado, declaración por declaración (`def`, `theorem`, `structure`, …). Traducir al japonés, inglés, chino (simplificado o tradicional), coreano, francés, alemán, español, portugués o ruso, o escribir cualquier otro idioma
- Una sola elección de idioma fija las traducciones, la interfaz, el glosario y las explicaciones de «Preguntar a Claude». Los textos de la interfaz vienen integrados para los diez idiomas anteriores (inglés en los demás casos). El glosario viene integrado en japonés e inglés; para otros idiomas, Claude lo traduce la primera vez que eliges el idioma y el navegador lo guarda (primero la palabra que tocaste, el resto sigue en segundo plano con un indicador de progreso). En los ajustes también se puede fijar por separado el idioma de la interfaz
- En la primera visita, la página se abre en japonés si el navegador prefiere el japonés al inglés, y en inglés en los demás casos
- Al traducir, se envían como contexto las definiciones de los archivos importados a las que hace referencia el archivo actual
- Al tocar un identificador se ve un resumen de su definición y se puede saltar a ella. Los símbolos y tácticas como `∀`, `omega` y `rcases` tienen una breve explicación
- Las demostraciones largas empiezan plegadas
- Las traducciones se guardan en el navegador. Si las exportas y las confirmas en el repositorio, cualquiera que lo abra puede leerlas sin clave de API
- Crear enlaces para compartir que abren un archivo o una declaración concretos

## Uso

### Versión web (Cloudflare Pages)

Abre <https://taiyak.pages.dev/>.

1. Escribe una URL de GitHub y pulsa «Abrir»
2. En «Ajustes», introduce una clave de API de Anthropic, OpenAI o Google (necesaria para traducir). Para un repositorio privado, introduce también un token de GitHub. «Crear un token en GitHub» en los ajustes abre la página de tokens de GitHub con acceso de solo lectura (Contents: read) y caducidad de 30 días ya rellenados: elige los repositorios que quieras leer y créalo
3. Pulsa «Traducir este archivo», o «Traducir» en un bloque concreto

Si se abre sin URL, la página muestra una demo: un modelo en Lean de `rb_range_component_beg_len` (la normalización de los argumentos de rango) del `range.c` de CRuby, con su especificación, las propiedades P1–P4 y un modelo de la corrección. Procede del repositorio de experimentos del autor, `gotoken/cruby-formalized-trial` @74e11c6, que no es público. `Basic`, `Cases`, `Spec`, `Impl`, `Statements` y `Fixed` incluyen traducciones al inglés y al japonés; los demás archivos se pueden traducir en el momento.

### Versión de claude.ai

Si publicas `dist/claude-artifact.html` como artefacto de claude.ai, cada persona que lo vea traduce con su propia cuenta de Claude (sin clave de API). Las páginas dentro de claude.ai no pueden conectarse a GitHub, así que descarga el repositorio con «Code → Download ZIP» en GitHub y cárgalo con «Abrir ZIP».

### Enlaces para compartir

Mientras la versión web muestra un repositorio de GitHub, la URL de la barra de direcciones es un enlace para compartir. Los números de línea de la esquina superior derecha de cada bloque (`L16–17`, etc.) copian un enlace a esa declaración.

| Parámetro | Significado |
|---|---|
| `repo` | `owner/repo` |
| `ref` | Rama, etiqueta o commit (la rama predeterminada si se omite) |
| `path` | Archivo que se abre |
| `decl` | Nombre de la declaración a la que desplazarse (los bloques sin nombre usan la forma `id=b12`) |
| `lang` | Idioma de traducción |

Ejemplo: <https://taiyak.pages.dev/?repo=Broyojo/python-formalization&path=lean/PyLean/RangeSlice/Length.lean&decl=slow_isLen&lang=Espa%C3%B1ol>

### Incluir las traducciones en un repositorio

1. Traduce los archivos que quieras
2. Usa «Ajustes» → «Exportar traducciones» para obtener un archivo JSON (solo se exporta el repositorio abierto)
3. Confírmalo en el repositorio de destino como `.taiyak/es.json` (un archivo por idioma; el nombre es libre)

Al abrir un repositorio se carga automáticamente `.taiyak/*.json`. Si tú mismo tradujiste el mismo bloque, tu traducción tiene prioridad. Las traducciones se emparejan por idioma, nivel de detalle y un hash de la ruta del archivo y del texto del bloque, de modo que cuando cambia el código de un bloque su traducción antigua deja de usarse.

## Claves y datos

- La clave de API y el token de GitHub solo se usan dentro del navegador. Se guardan en localStorage solo si eliges «Recordar en este navegador». No los guardes en un ordenador compartido.
- La página solo se comunica con `api.github.com`, `api.anthropic.com`, `api.openai.com` y `generativelanguage.googleapis.com`. En la versión web lo impone la Content-Security-Policy de `public/_headers`, así que el navegador rechaza cualquier envío a otro destino. Los scripts en línea también están fijados por hash.
- Al traducir se envía a la API elegida (Anthropic, OpenAI o Google) el código Lean del archivo y de las definiciones a las que hace referencia. Comprueba la política de tu organización antes de traducir código privado.
- Para el token de GitHub, usa un fine-grained personal access token: selecciona solo los repositorios necesarios, con Contents: Read-only.

## Funcionamiento y límites

- La división es estática: mira las palabras clave de nivel superior y si el texto está dentro de comentarios o cadenas. No se ejecuta Lean, así que no se usan la información de tipos, la expansión de notaciones y macros ni los objetivos intermedios de las demostraciones con tácticas.
- El contexto sigue los imports hasta 3 niveles y 30 archivos, y recoge las definiciones cuyo nombre coincide. Se omiten los nombres cortos con demasiadas definiciones.
- Las traducciones las hace un LLM y pueden contener errores. Léelas cotejándolas con el código.
- Las declaraciones dentro de bloques `mutual`, o generadas por macros, pueden no dividirse bien.

## Desarrollo

```sh
python3 tools/build.py             # genera public/ y dist/ a partir de src/ y demo/
node --test "test/*.test.cjs"      # pruebas de división, recogida de contexto y análisis de respuestas
python3 -m http.server -d public 8000
```

```
src/        template.html, core.js (división y otras partes sin DOM), app.js (UI),
            i18n.js (idiomas y textos de la interfaz), glossary.js (glosario de símbolos)
demo/       archivos Lean de la demo, sus traducciones al inglés y al japonés, BSDL de CRuby
vendor/     KaTeX, JSZip (MIT)
tools/      build.py, fuentes de las traducciones de la demo
test/       pruebas de node:test
docs/       traducciones de este README, captura de pantalla
public/     versión web (resultado de la compilación; Cloudflare Pages sirve este directorio)
dist/       versión de claude.ai (resultado de la compilación; un solo archivo)
```

Después de cambiar `src/` o `demo/`, ejecuta `tools/build.py` y confirma también `public/` y `dist/`. La CI comprueba que el resultado de la compilación coincide con las fuentes. Los archivos compilados se guardan en el repositorio para que lo que se sirve pueda leerse aquí tal cual.

## Desplegar en Cloudflare Pages

1. En el panel de Cloudflare, elige Workers & Pages → Create → Pages → Connect to Git y selecciona este repositorio
2. Framework preset: None. Build command: vacío. Build output directory: `public`
3. Una vez guardado, cada push a `main` se despliega

También se sirven las cabeceras de seguridad de `public/_headers`.

## Licencia

- Todo el repositorio, incluidos los archivos Lean de la demo: licencia BSD 2-Clause (`LICENSE`)
- `Impl.lean` y `Fixed.lean` de la demo citan breves fragmentos del `range.c` de CRuby (Copyright (C) 1993-2007 Yukihiro Matsumoto) y del parche de ruby/ruby#19824. CRuby puede redistribuirse bajo la BSDL de 2 cláusulas o la Ruby License; los fragmentos se usan bajo la BSDL (`demo/CRuby-BSDL.txt`)
- `vendor/`: KaTeX y JSZip (ambos MIT)

Consulta `NOTICE` para más detalles.

Este archivo es una traducción de [README.md](../README.md) (en inglés). Si difieren, prevalece la versión en inglés.
