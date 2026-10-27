# 🍄 Champi'Recon — Reconnaissance de champignons (Android, hors ligne)

Application Android en **React Native / Expo (TypeScript, Expo Router)** qui identifie les
champignons à partir de photos, via l'**API Mistral** (modèle de vision `pixtral-large-latest`).

## ⚠️ Sécurité

> **Ne consomme jamais un champignon sur la seule base de cette application.** Toute
> identification automatique doit être validée par un mycologue, un pharmacien formé ou une
> association mycologique. Cet avertissement est affiché en permanence dans l'application.

## Fonctionnalités

- 📷 Photo (caméra) ou import galerie, **jusqu'à 8 photos** par champignon
- 🤖 Analyse IA (API Mistral) : nom commun FR + nom scientifique, confiance, comestibilité,
  description, habitat, saison, confusions possibles
- ❓ **Questions complémentaires** quand les photos sont insuffisantes (les réponses sont
  renvoyées à l'IA pour une seconde analyse)
- 📡 **Mode hors ligne** : détection du réseau, photos mises en file d'attente, questionnaire
  du mycologue proposé, **reprise automatique de l'analyse au retour du réseau**
- 🕘 Historique local complet (AsyncStorage) avec photos, date, GPS, résultat
- 📍 Géolocalisation optionnelle de la trouvaille
- 🔑 Clé API Mistral saisie dans l'app (stockée localement, jamais dans le code)
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
4. Dans l'app : **Réglages → colle ta clé API Mistral → Enregistrer**.
5. **Identifier un champignon** → prends des photos → lance l'analyse.

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
│   ├── identify.tsx     # capture photos + questions complémentaires + envoi IA
│   ├── result.tsx       # fiche résultat (comestibilité, confusions, avertissement)
│   ├── history.tsx      # historique local
│   └── settings.tsx     # clé API Mistral + modèle
├── components/          # AppButton, PhotoThumb, ConfidenceBadge, SafetyBanner
├── lib/
│   ├── types.ts         # types Identification, ReponseMycologue…
│   ├── theme.ts         # thème clair/sombre
│   ├── labels.ts        # avertissement sécurité, libellés, questionnaire hors ligne
│   ├── mistral.ts       # prompt système mycologue + appel API + parsing JSON robuste
│   ├── storage.ts       # AsyncStorage (clé API + historique)
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
- [ ] L'avertissement « Ne consomme jamais… » est visible sur chaque écran
- [ ] Mode avion → photo → « en attente (hors ligne) » → désactive le mode avion →
      l'analyse se termine toute seule dans l'historique
- [ ] Historique : les anciennes identifications apparaissent avec photo et date
