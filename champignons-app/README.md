# 🍄 Champi'Recon — Reconnaissance de champignons (Android, hors ligne)

Application Android en **React Native / Expo (TypeScript, Expo Router)** qui identifie les
champignons à partir de photos, avec **3 moteurs d'identification** au choix, comparés côte à côte :

1. **🤖 IA Mistral** (`mistral-medium-latest`, Mistral Medium 3.5) — fiche mycologue détaillée,
   questions complémentaires en cas de doute. Clé API Mistral requise.
2. **🔬 IA iNaturalist** — 🔒 **bientôt disponible**. L'API Computer Vision d'iNaturalist exige
   désormais un token OAuth2 d'application officielle (compte de 2 mois + 10 identifications
   améliorantes/mois). Le code du moteur est prêt dans `lib/inaturalist.ts` et les champs
   `app_id` / `app_secret` sont dans les réglages : l'activation future sera minimale.
   En attendant, soumets tes observations manuellement sur inaturalist.org pour une validation
   humaine gratuite.
3. **🍄 Expert Kindwise** — spécialiste champignons (candidats, comestibilité, sosies).
   Clé API Kindwise requise (100 identifications/mois gratuites).

Un **bandeau de consensus** compare les moteurs : convergence sur une espèce ✅, convergence
au niveau du genre ⚠️, ou désaccord ⚠️ (avec les hypothèses affichées).

## ⚠️ Sécurité

> **Ne consomme jamais un champignon sur la seule base de cette application.** Toute
> identification automatique doit être validée par un mycologue, un pharmacien formé ou une
> association mycologique. Cet avertissement est affiché en permanence dans l'application.

## Fonctionnalités

- 📷 Photo (caméra) ou import galerie, **jusqu'à 8 photos** par champignon
- 🧠 **3 moteurs au choix** (sélection multiple, résultats côte à côte) :
  IA Mistral (fiche mycologue), Kindwise (spécialiste) actifs ; iNaturalist 🔒 bientôt disponible
- 🤝 **Bandeau de consensus** : convergent ✅ / genre ⚠️ / divergent ⚠️ avec les hypothèses
- ❓ **Questions complémentaires** quand les photos sont insuffisantes (les réponses sont
  renvoyées à l'IA pour une seconde analyse)
- 📡 **Mode hors ligne** : détection du réseau, photos mises en file d'attente, questionnaire
  du mycologue proposé, **reprise automatique de l'analyse au retour du réseau**
- 🕘 Historique local complet (AsyncStorage) avec photos, date, GPS, résultat
- 📍 Géolocalisation optionnelle de la trouvaille
- 🔑 Clés API Mistral + Kindwise saisies dans l'app (stockées localement, jamais dans le code) ; champs app_id/app_secret iNaturalist préparés pour plus tard
- 🌗 Mode sombre automatique, thème nature (vert forêt / beige), interface 100 % française

## 1. Prérequis

- Un ordinateur avec **Node.js 20+** (ici Node 22) et npm
- Un téléphone Android avec l'application **Expo Go** (gratuite, Play Store)
- Un compte gratuit sur [console.mistral.ai](https://console.mistral.ai) pour créer une clé API
  (crédits offerts à l'inscription ; chaque analyse coûte quelques centimes)

## 2. Installation (ordinateur)

```bash
cd champignons-app
npm install
npm start          # lance le serveur Expo (QR code dans le terminal)
```

## 3. Test sur le téléphone (Expo Go)

1. Installe **Expo Go** sur ton Android (Play Store).
2. Assure-toi que **l'ordinateur et le téléphone sont sur le même Wi-Fi**.
3. Ouvre Expo Go et scanne le **QR code** affiché dans le terminal.
4. Dans l'app : **Réglages → colle ta clé API Mistral → Enregistrer** (et la clé Kindwise si tu veux le moteur spécialiste). Le moteur iNaturalist est grisé « Bientôt disponible 🔒 » en attendant un compte OAuth2.
5. **Identifier un champignon** → prends des photos → **choisis un ou plusieurs moteurs** → lance l'analyse.
6. Compare les résultats **côte à côte** et lis le **bandeau de consensus**.

## 4. Générer l'APK (installation définitive)

```bash
npm install -g eas-cli
eas login                 # compte Expo gratuit
eas build:configure
eas build --platform android --profile preview   # produit un APK téléchargeable
```

Télécharge l'APK depuis le lien fourni, puis sur le téléphone :
**Paramètres → Sécurité → Autoriser les installations depuis cette source**, puis ouvre l'APK.

## Arborescence

```
champignons-app/
├── app/
│   ├── _layout.tsx      # layout racine (Stack, file hors ligne démarrée ici)
│   ├── index.tsx        # accueil
│   ├── identify.tsx     # capture photos + sélection des moteurs + questions + envoi
│   ├── result.tsx       # résultats par moteur + consensus + fiche mycologue
│   ├── history.tsx      # historique local
│   └── settings.tsx     # clés API Mistral + Kindwise + modèle
├── components/          # AppButton, PhotoThumb, ConfidenceBadge, SafetyBanner,
│   │                    # SelecteurMoteurs, MoteurCard, ConsensusBanner
├── lib/
│   ├── types.ts         # types Identification, ReponseMycologue, ResultatMoteur, Consensus…
│   ├── theme.ts         # thème clair/sombre
│   ├── labels.ts        # avertissement sécurité, libellés, métadonnées des 3 moteurs
│   ├── mistral.ts       # moteur 1 : prompt système mycologue + appel API + parsing JSON
│   ├── inaturalist.ts   # moteur 2 : API iNaturalist — code prêt, 🔒 verrouillé en attendant OAuth2 (app_id/app_secret dans Réglages)
│   ├── kindwise.ts      # moteur 3 : API Kindwise (spécialiste champignons)
│   ├── moteurs.ts       # orchestrateur : moteurs en parallèle, erreurs isolées
│   ├── consensus.ts     # comparaison des hypothèses (espèce / genre / divergence)
│   ├── storage.ts       # AsyncStorage (clés API + historique)
│   ├── network.ts       # détection du réseau
│   └── queueRunner.ts   # file d'attente : relance auto des analyses au retour du réseau
├── assets/              # icône, splash (générés)
├── app.json             # config Expo + permissions (caméra, GPS)
├── eas.json             # profils de build APK
└── package.json
```

## Vérification

```bash
npm run typecheck        # tsc --noEmit : aucune erreur TypeScript
```

## Checklist de vérification

- [ ] `npm install` se termine sans erreur
- [ ] `npm run typecheck` affiche aucune erreur
- [ ] `npm start` affiche un QR code
- [ ] Expo Go ouvre l'app sur le téléphone (même Wi-Fi)
- [ ] La clé API est enregistrée dans Réglages
- [ ] Une photo de champignon → analyse → fiche avec nom FR + nom scientifique
- [ ] Mistral + Kindwise cochés → 2 cartes de résultats + bandeau de consensus
- [ ] iNaturalist grisé « Bientôt disponible 🔒 » → appui → encart explicatif + bouton « Ouvrir iNaturalist »
- [ ] Mode avion → file d'attente → reprise auto au retour du réseau
- [ ] Clé Kindwise absente → seul Kindwise échoue, les autres moteurs continuent
- [ ] L'avertissement « Ne consomme jamais… » est visible sur chaque écran
- [ ] Mode avion → photo → « en attente (hors ligne) » → désactive le mode avion →
      l'analyse se termine toute seule dans l'historique
- [ ] Historique : les anciennes identifications apparaissent avec photo et date
