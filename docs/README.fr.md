# side-by-side-lean-natural

[English](../README.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-Hant.md) · [한국어](README.ko.md) · **Français** · [Deutsch](README.de.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

Un navigateur qui découpe un source Lean 4 en déclarations et affiche chacune à côté d'une traduction mathématique dans la langue naturelle de votre choix. Il se contente de lire le source : aucune compilation Lean n'est nécessaire.

**Version web : <https://side-by-side-lean-natural.pages.dev/>**

![Impl.lean de la démo, avec le Lean et sa traduction côte à côte](screenshot.png)

## Fonctionnalités

- Ouvrir un dépôt Lean 4 depuis une URL GitHub (dépôts privés compris), un fichier ZIP ou un dossier
- Afficher côte à côte le code Lean et sa traduction, déclaration par déclaration (`def`, `theorem`, `structure`, …). Traduire en japonais, anglais, chinois (simplifié ou traditionnel), coréen, français, allemand, espagnol, portugais ou russe, ou saisir n'importe quelle autre langue
- Un seul choix de langue règle les traductions, l'interface, le glossaire et les explications de « Demander à Claude ». Les textes de l'interface sont intégrés pour les dix langues ci-dessus (anglais sinon). Le glossaire est intégré en japonais et en anglais ; pour les autres langues, Claude le traduit la première fois que vous choisissez la langue et le navigateur le conserve (le mot touché passe en premier, le reste continue en arrière-plan avec un indicateur de progression). Les réglages permettent aussi de fixer la langue de l'interface séparément
- À la première visite, la page s'ouvre en japonais si votre navigateur préfère le japonais à l'anglais, et en anglais sinon
- Lors de la traduction, les définitions des fichiers importés auxquelles le fichier courant fait référence sont envoyées comme contexte
- Toucher un identifiant affiche un résumé de sa définition et permet d'y aller. Les symboles et tactiques comme `∀`, `omega` et `rcases` ont une courte explication
- Les longues preuves sont repliées au départ
- Les traductions sont conservées dans le navigateur. Exportez-les et validez-les dans le dépôt : quiconque l'ouvre peut les lire sans clé API
- Créer des liens de partage qui ouvrent un fichier ou une déclaration précise

## Utilisation

### Version web (Cloudflare Pages)

Ouvrez <https://side-by-side-lean-natural.pages.dev/>.

1. Saisissez une URL GitHub et appuyez sur « Ouvrir »
2. Dans « Réglages », saisissez une clé API Anthropic (nécessaire pour traduire). Pour un dépôt privé, saisissez aussi un jeton GitHub. « Créer un jeton sur GitHub » dans les réglages ouvre la page de création de jeton de GitHub avec l'accès en lecture seule (Contents: read) et une expiration de 30 jours déjà remplis : choisissez les dépôts à lire et créez-le
3. Appuyez sur « Traduire ce fichier », ou sur « Traduire » pour un seul bloc

Ouverte sans URL, la page affiche une démo : un modèle Lean de `rb_range_component_beg_len` (la normalisation des arguments de plage) du fichier `range.c` de CRuby, avec sa spécification, les propriétés P1–P4 et un modèle du correctif. Elle provient du dépôt d'expérimentation de l'auteur, `gotoken/cruby-formalized-trial` @74e11c6, qui n'est pas public. `Basic`, `Cases`, `Spec`, `Impl`, `Statements` et `Fixed` sont fournis avec des traductions anglaise et japonaise ; les autres fichiers peuvent être traduits sur place.

### Version claude.ai

Publiez `dist/claude-artifact.html` comme artefact claude.ai : chaque lecteur traduit alors avec son propre compte Claude (pas de clé API). Les pages hébergées dans claude.ai ne peuvent pas joindre GitHub ; téléchargez donc le dépôt avec « Code → Download ZIP » sur GitHub et chargez-le avec « Ouvrir un ZIP ».

### Liens de partage

Quand la version web affiche un dépôt GitHub, l'URL de la barre d'adresse est un lien de partage. Les numéros de ligne en haut à droite de chaque bloc (`L16–17`, etc.) copient un lien vers cette déclaration.

| Paramètre | Signification |
|---|---|
| `repo` | `owner/repo` |
| `ref` | Branche, étiquette ou commit (branche par défaut si absent) |
| `path` | Fichier à ouvrir |
| `decl` | Nom de la déclaration à afficher (les blocs sans nom utilisent la forme `id=b12`) |
| `lang` | Langue de traduction |

Exemple : <https://side-by-side-lean-natural.pages.dev/?repo=Broyojo/python-formalization&path=lean/PyLean/RangeSlice/Length.lean&decl=slow_isLen&lang=Fran%C3%A7ais>

### Livrer les traductions avec un dépôt

1. Traduisez les fichiers voulus
2. Utilisez « Réglages » → « Exporter les traductions » pour obtenir un fichier JSON (seul le dépôt ouvert est exporté)
3. Validez-le dans le dépôt cible sous `.lean-taiyaku/fr.json` (un fichier par langue ; le nom est libre)

À l'ouverture d'un dépôt, `.lean-taiyaku/*.json` est chargé automatiquement. Une traduction que vous avez faite vous-même pour le même bloc a la priorité. Les traductions sont appariées par langue, niveau de détail et empreinte du chemin du fichier et du texte du bloc : quand le code d'un bloc change, son ancienne traduction n'est plus utilisée.

## Clés et données

- La clé API et le jeton GitHub ne sont utilisés que dans le navigateur. Ils ne sont enregistrés dans localStorage que si vous choisissez « Mémoriser dans ce navigateur ». Ne les enregistrez pas sur un ordinateur partagé.
- La page ne communique qu'avec `api.github.com` et `api.anthropic.com`. Dans la version web, la Content-Security-Policy de `public/_headers` l'impose : le navigateur refuse tout envoi ailleurs. Les scripts en ligne sont aussi fixés par empreinte.
- La traduction envoie à Anthropic le source Lean du fichier et des définitions auxquelles il fait référence. Vérifiez la politique de votre organisation avant de traduire du code privé.
- Pour le jeton GitHub, utilisez un fine-grained personal access token : ne sélectionnez que les dépôts nécessaires, avec Contents: Read-only.

## Fonctionnement et limites

- Le découpage est statique : il regarde les mots-clés de premier niveau et si le texte se trouve dans un commentaire ou une chaîne. Lean n'est pas exécuté ; les informations de type, l'expansion des notations et des macros, et les buts intermédiaires des preuves par tactiques ne sont donc pas utilisés.
- Le contexte suit les imports sur 3 niveaux et 30 fichiers au plus, et recueille les définitions dont le nom correspond. Les noms courts qui ont trop de définitions sont ignorés.
- Les traductions viennent d'un LLM et peuvent être fausses. Lisez-les en regard du code.
- Les déclarations à l'intérieur de blocs `mutual`, ou générées par des macros, peuvent être mal découpées.

## Développement

```sh
python3 tools/build.py             # construit public/ et dist/ à partir de src/ et demo/
node --test "test/*.test.cjs"      # tests du découpage, de la collecte du contexte et de l'analyse des réponses
python3 -m http.server -d public 8000
```

```
src/        template.html, core.js (découpage et autres parties sans DOM), app.js (UI),
            i18n.js (langues et textes de l'interface), glossary.js (glossaire des symboles)
demo/       fichiers Lean de la démo, leurs traductions anglaise et japonaise, BSDL de CRuby
vendor/     KaTeX, JSZip (MIT)
tools/      build.py, sources des traductions de la démo
test/       tests node:test
docs/       traductions de ce README, capture d'écran
public/     version web (résultat de la construction ; Cloudflare Pages sert ce dossier)
dist/       version claude.ai (résultat de la construction ; un seul fichier)
```

Après une modification de `src/` ou `demo/`, lancez `tools/build.py` et validez aussi `public/` et `dist/`. La CI vérifie que le résultat de la construction correspond aux sources. Les fichiers construits sont conservés dans le dépôt pour que ce qui est servi puisse y être lu tel quel.

## Déployer sur Cloudflare Pages

1. Dans le tableau de bord Cloudflare, choisissez Workers & Pages → Create → Pages → Connect to Git, puis ce dépôt
2. Framework preset : None. Build command : vide. Build output directory : `public`
3. Une fois enregistré, chaque push sur `main` est déployé

Les en-têtes de sécurité de `public/_headers` sont servis eux aussi.

## Licence

- L'ensemble du dépôt, y compris les fichiers Lean de la démo : licence BSD 2-Clause (`LICENSE`)
- Les fichiers `Impl.lean` et `Fixed.lean` de la démo citent de courts extraits du `range.c` de CRuby (Copyright (C) 1993-2007 Yukihiro Matsumoto) et du correctif de ruby/ruby#19824. CRuby peut être redistribué sous la BSDL à 2 clauses ou la Ruby License ; les extraits sont utilisés sous la BSDL (`demo/CRuby-BSDL.txt`)
- `vendor/` : KaTeX et JSZip (tous deux MIT)

Voir `NOTICE` pour le détail.

Ce fichier est une traduction de [README.md](../README.md) (en anglais). En cas de divergence, la version anglaise fait foi.
