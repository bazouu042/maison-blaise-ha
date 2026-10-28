import type { Comestibilite, Confiance } from './types';

export const AVERTISSEMENT_SECURITE =
  "⚠️ Ne consomme jamais un champignon sur la seule base de cette application. Toute identification automatique doit être validée par un mycologue, un pharmacien formé ou une association mycologique avant consommation.";

export function labelComestibilite(c: Comestibilite): { texte: string; picto: string } {
  switch (c) {
    case 'comestible_excellent':
      return { texte: 'Comestible recherché', picto: '✅' };
    case 'comestible':
      return { texte: 'Comestible', picto: '✅' };
    case 'comestible_jeune':
      return { texte: 'Comestible (jeune, bien cuit)', picto: '✅' };
    case 'non_comestible':
      return { texte: 'Non comestible', picto: '⚠️' };
    case 'toxique':
      return { texte: 'Toxique — ne pas consommer', picto: '❌' };
    case 'mortel':
      return { texte: 'MORTEL — ne jamais consommer', picto: '☠️' };
    case 'inconnu':
      return { texte: 'Comestibilité inconnue — ne pas consommer', picto: '❓' };
  }
}

export function labelConfiance(c: Confiance): { texte: string; couleur: 'success' | 'warning' | 'danger' } {
  switch (c) {
    case 'elevee':
      return { texte: 'Confiance élevée', couleur: 'success' };
    case 'moyenne':
      return { texte: 'Confiance moyenne', couleur: 'warning' };
    case 'faible':
      return { texte: 'Confiance faible', couleur: 'danger' };
  }
}

export const QUESTIONS_HORS_LIGNE: string[] = [
  'Quelle est la forme du chapeau ? (convexe, plat, en cloche, mamelonné, en entonnoir...)',
  'Quelle est la couleur dominante du chapeau ?',
  'Que trouve-t-on sous le chapeau : des lames, des tubes (pores), des aiguillons ? Quelle couleur ?',
  'Le pied a-t-il un anneau (collerette) ? De quelle couleur est-il ?',
  'Quelle est la texture du pied (lisse, fibreux, écailleux, creux...) ?',
  'Y a-t-il une volve (sac) à la base du pied ?',
  'Quelle est l’odeur du champignon ? (farine, amande, anisée, désagréable, aucune...)',
  'Dans quel milieu pousse-t-il ? (forêt de feuillus, de conifères, prairie, sous quel arbre...)',
  'À quelle saison l’avez-vous trouvé ?',
  'La chair change-t-elle de couleur à la coupe ?',
  'Quelle est la couleur des spores ? (laissez le chapeau posé sur une feuille de papier blanc quelques heures)',
];
