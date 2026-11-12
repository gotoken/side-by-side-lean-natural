# Taiyak

[English](../README.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [한국어](README.ko.md) · [Français](README.fr.md) · **Deutsch** · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

Ein Browser, der Lean-4-Quelltext in Deklarationen zerlegt und jede neben einer mathematischen Übersetzung in der gewählten natürlichen Sprache anzeigt. Er liest nur den Quelltext: Ein Lean-Build ist nicht nötig. Der Name kommt vom japanischen 対訳 (*taiyaku*), einem Text, der neben seiner Übersetzung steht.

**Webversion: <https://taiyak.pages.dev/>**

![Impl.lean aus der Demo, Lean und Übersetzung nebeneinander](screenshot.png)

## Funktionen

- Ein Lean-4-Repository über eine GitHub-URL (auch private Repositories), eine ZIP-Datei oder einen Ordner öffnen
- Lean-Code und Übersetzung Deklaration für Deklaration (`def`, `theorem`, `structure`, …) nebeneinander anzeigen. Übersetzt wird ins Japanische, Englische, Chinesische (vereinfacht oder traditionell), Koreanische, Französische, Deutsche, Spanische, Portugiesische oder Russische, oder in jede andere eingegebene Sprache
- Eine einzige Sprachwahl bestimmt Übersetzungen, Oberfläche, Glossar und die Erklärungen von „Claude fragen“. Die Oberflächentexte sind für die zehn genannten Sprachen eingebaut (sonst Englisch). Das Glossar ist auf Japanisch und Englisch eingebaut; für andere Sprachen übersetzt Claude es bei der ersten Auswahl der Sprache, und der Browser behält es (das angetippte Wort zuerst, der Rest im Hintergrund mit Fortschrittsanzeige). In den Einstellungen lässt sich die Oberflächensprache auch getrennt festlegen
- Beim ersten Besuch öffnet sich die Seite auf Japanisch, wenn der Browser Japanisch vor Englisch bevorzugt, sonst auf Englisch
- Beim Übersetzen werden Definitionen aus importierten Dateien, auf die die aktuelle Datei verweist, als Kontext mitgeschickt
- Ein Bezeichner zeigt beim Antippen eine Zusammenfassung seiner Definition und führt zu ihr. Symbole und Taktiken wie `∀`, `omega` und `rcases` bekommen eine kurze Erklärung
- Lange Beweise sind zunächst eingeklappt
- Übersetzungen werden im Browser gespeichert. Exportiert und im Repository eingecheckt, kann sie jeder, der es öffnet, ohne API-Schlüssel lesen
- Teilen-Links erzeugen, die eine bestimmte Datei oder Deklaration öffnen

## Verwendung

### Webversion (Cloudflare Pages)

Öffnen Sie <https://taiyak.pages.dev/>.

1. Eine GitHub-URL eingeben und „Öffnen“ drücken
2. Unter „Einstellungen“ einen Anthropic-API-Schlüssel eingeben (nötig zum Übersetzen). Bei einem privaten Repository zusätzlich ein GitHub-Token eingeben. „Token auf GitHub erstellen“ in den Einstellungen öffnet die Token-Seite von GitHub mit Lesezugriff (Contents: read) und 30 Tagen Gültigkeit bereits ausgefüllt: die gewünschten Repositories auswählen und erstellen
3. „Diese Datei übersetzen“ drücken oder „Übersetzen“ bei einem einzelnen Block

Ohne URL geöffnet, zeigt die Seite eine Demo: ein Lean-Modell von `rb_range_component_beg_len` (der Normalisierung von Bereichsargumenten) aus CRubys `range.c`, mit Spezifikation, den Eigenschaften P1–P4 und einem Modell der Korrektur. Sie stammt aus dem nicht öffentlichen Experiment-Repository des Autors, `gotoken/cruby-formalized-trial` @74e11c6. `Basic`, `Cases`, `Spec`, `Impl`, `Statements` und `Fixed` liegen mit englischer und japanischer Übersetzung bei; die übrigen Dateien lassen sich direkt übersetzen.

### claude.ai-Version

Wird `dist/claude-artifact.html` als claude.ai-Artefakt veröffentlicht, übersetzt jede betrachtende Person mit ihrem eigenen Claude-Konto (kein API-Schlüssel nötig). Seiten innerhalb von claude.ai können GitHub nicht erreichen; laden Sie das Repository daher über „Code → Download ZIP“ auf GitHub herunter und öffnen Sie es mit „ZIP öffnen“.

### Teilen-Links

Solange die Webversion ein Repository von GitHub zeigt, ist die URL in der Adressleiste ein Teilen-Link. Die Zeilennummern oben rechts an jedem Block (`L16–17` usw.) kopieren einen Link auf diese Deklaration.

| Parameter | Bedeutung |
|---|---|
| `repo` | `owner/repo` |
| `ref` | Branch, Tag oder Commit (ohne Angabe der Standard-Branch) |
| `path` | Zu öffnende Datei |
| `decl` | Name der Deklaration, zu der gescrollt wird (Blöcke ohne Namen in der Form `id=b12`) |
| `lang` | Übersetzungssprache |

Beispiel: <https://taiyak.pages.dev/?repo=Broyojo/python-formalization&path=lean/PyLean/RangeSlice/Length.lean&decl=slow_isLen&lang=Deutsch>

### Übersetzungen mit einem Repository ausliefern

1. Die gewünschten Dateien übersetzen
2. Über „Einstellungen“ → „Übersetzungen exportieren“ eine JSON-Datei erhalten (exportiert wird nur das geöffnete Repository)
3. Sie im Ziel-Repository als `.taiyak/de.json` einchecken (eine Datei pro Sprache; der Name ist frei)

Beim Öffnen eines Repositorys wird `.taiyak/*.json` automatisch geladen. Eine selbst erstellte Übersetzung desselben Blocks hat Vorrang. Übersetzungen werden über Sprache, Detailgrad und einen Hash aus Dateipfad und Blocktext zugeordnet; ändert sich der Code eines Blocks, wird seine alte Übersetzung nicht mehr verwendet.

## Schlüssel und Daten

- API-Schlüssel und GitHub-Token werden nur im Browser verwendet. In localStorage gespeichert werden sie nur, wenn Sie „In diesem Browser speichern“ wählen. Speichern Sie sie nicht auf gemeinsam genutzten Rechnern.
- Die Seite kommuniziert nur mit `api.github.com` und `api.anthropic.com`. In der Webversion erzwingt das die Content-Security-Policy in `public/_headers`, sodass der Browser Übertragungen an andere Ziele verweigert. Inline-Skripte sind zusätzlich per Hash festgelegt.
- Beim Übersetzen wird der Lean-Quelltext der Datei und der referenzierten Definitionen an Anthropic gesendet. Prüfen Sie vor dem Übersetzen privaten Codes die Richtlinien Ihrer Organisation.
- Verwenden Sie als GitHub-Token ein fine-grained personal access token: nur die nötigen Repositories auswählen, mit Contents: Read-only.

## Funktionsweise und Grenzen

- Die Zerlegung ist statisch: Sie betrachtet Schlüsselwörter auf oberster Ebene und ob Text in Kommentaren oder Zeichenketten steht. Lean wird nicht ausgeführt; Typinformationen, die Expansion von Notationen und Makros sowie Zwischenziele in Taktikbeweisen werden daher nicht genutzt.
- Der Kontext folgt Imports bis zu 3 Ebenen und 30 Dateien und sammelt Definitionen mit passendem Namen. Kurze Namen mit zu vielen Definitionen werden übersprungen.
- Die Übersetzungen stammen von einem LLM und können falsch sein. Lesen Sie sie mit dem Code im Blick.
- Deklarationen in `mutual`-Blöcken oder aus Makros werden womöglich nicht richtig zerlegt.

## Entwicklung

```sh
python3 tools/build.py             # erzeugt public/ und dist/ aus src/ und demo/
node --test "test/*.test.cjs"      # Tests für Zerlegung, Kontextsammlung und Antwortauswertung
python3 -m http.server -d public 8000
```

```
src/        template.html, core.js (Zerlegung und andere DOM-freie Teile), app.js (UI),
            i18n.js (Sprachen und Oberflächentexte), glossary.js (Symbolglossar)
demo/       Lean-Dateien der Demo, ihre englische und japanische Übersetzung, CRubys BSDL
vendor/     KaTeX, JSZip (MIT)
tools/      build.py, Quellen der Demo-Übersetzungen
test/       node:test-Tests
docs/       Übersetzungen dieser README, Screenshot
public/     Webversion (Build-Ergebnis; Cloudflare Pages liefert dieses Verzeichnis aus)
dist/       claude.ai-Version (Build-Ergebnis; eine einzige Datei)
```

Nach Änderungen an `src/` oder `demo/` `tools/build.py` ausführen und `public/` und `dist/` mit einchecken. Die CI prüft, dass das Build-Ergebnis zu den Quellen passt. Die gebauten Dateien liegen im Repository, damit das Ausgelieferte hier unverändert nachzulesen ist.

## Auf Cloudflare Pages bereitstellen

1. Im Cloudflare-Dashboard Workers & Pages → Create → Pages → Connect to Git wählen und dieses Repository angeben
2. Framework preset: None. Build command: leer. Build output directory: `public`
3. Nach dem Speichern wird jeder Push auf `main` bereitgestellt

Die Sicherheits-Header aus `public/_headers` werden mit ausgeliefert.

## Lizenz

- Das gesamte Repository, einschließlich der Lean-Dateien der Demo: BSD 2-Clause License (`LICENSE`)
- `Impl.lean` und `Fixed.lean` der Demo zitieren kurze Auszüge aus CRubys `range.c` (Copyright (C) 1993-2007 Yukihiro Matsumoto) und aus dem Patch in ruby/ruby#19824. CRuby darf unter der 2-Klausel-BSDL oder der Ruby License weitergegeben werden; die Auszüge werden unter der BSDL verwendet (`demo/CRuby-BSDL.txt`)
- `vendor/`: KaTeX und JSZip (beide MIT)

Einzelheiten siehe `NOTICE`.

Diese Datei ist eine Übersetzung von [README.md](../README.md) (Englisch). Bei Abweichungen gilt die englische Fassung.
