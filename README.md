# Pont Chaban

PWA mono-page (mobile + desktop) qui affiche l'état du **pont Chaban-Delmas** (Bordeaux), une illustration animée du pont, le compte à rebours avant la prochaine fermeture et les fermetures à venir (calendrier mensuel + liste détaillée).

> Application indépendante, non officielle. L'état affiché est **déduit du planning officiel**, ce n'est pas une mesure en temps réel. Les créneaux restent sous réserve de confirmation de la Capitainerie du Grand Port Maritime de Bordeaux.

Application : https://chaban.fabien-rouget.fr/

## Source de données

Jeu de données [« Pont Chaban – Prévisions – Fermeture »](https://datahub.bordeaux-metropole.fr/explore/dataset/previsions_pont_chaban/information/) du DataHub de Bordeaux Métropole (Opendatasoft), sous **Licence Ouverte**. Ce sont les données affichées sur la [page officielle](https://sedeplacer.bordeaux-metropole.fr/previsions-fermetures-pont-chaban-delmas).

- Enregistrements : `/api/explore/v2.1/catalog/datasets/previsions_pont_chaban/records` (filtrés à partir d'hier, puis côté client : une fermeture de nuit a sa `date_passage` la veille de sa réouverture).
- Fraîcheur : `metas.default.data_processed` du jeu (périodicité hebdomadaire ; avertissement au-delà de 8 jours).
- Appels directs depuis le navigateur (CORS ouvert), sans backend ni clé.
- Toutes les heures sont des heures locales Europe/Paris ; le passage heure d'été/hiver est géré avec `Intl` (aucune addition naïve de 24 h).
- Hors ligne : dernières données en cache (`localStorage` + cache du service worker), avec la mention « Hors ligne – données du … ».

Aucun cookie, aucun traceur.

## Développement

```sh
npm install
npm run dev        # serveur de développement : http://localhost:5173/
npm test           # tests unitaires (Vitest)
npm run build      # typecheck + build dans dist/
npm run preview    # prévisualiser le build
npm run icons      # régénérer les icônes PNG (nécessite Playwright + Chromium)
```

Structure : `src/lib/time.ts` (dates Europe/Paris), `closures.ts` (fermetures et état du pont), `calendar.ts` (grille mensuelle), `api.ts` (récupération + cache), `main.ts` (interface).

## Déploiement

GitHub Actions (`.github/workflows/deploy.yml`) : tests, build puis déploiement sur GitHub Pages à chaque push sur `master` (ou `main`).
Prérequis : dans *Settings → Pages*, choisir **Source : GitHub Actions**. Le site est servi à la racine d'un domaine personnalisé (`base` de Vite : `/`). Avec l'URL de projet GitHub Pages (`/<utilisateur>/pont-chaban/`), il faudrait remettre `base`, `start_url`, `scope`, `id` et `navigateFallback` de `vite.config.ts` sur `/pont-chaban/`.

## Licence

Code sous licence [MIT](LICENSE). Données © Bordeaux Métropole, Licence Ouverte.
