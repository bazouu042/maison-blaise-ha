import type {
  Comestibilite,
  Confiance,
  NiveauComestibilite,
  NomMoteur,
  StatutConsensus,
} from './types';

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

export function niveauDepuisComestibilite(c: Comestibilite): NiveauComestibilite {
  switch (c) {
    case 'comestible_excellent':
    case 'comestible':
    case 'comestible_jeune':
      return 'ok';
    case 'non_comestible':
      return 'attention';
    case 'toxique':
    case 'mortel':
      return 'danger';
    case 'inconnu':
      return 'inconnu';
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

export const META_MOTEURS: Record<
  NomMoteur,
  { titre: string; icone: string; couleur: string; description: string }
> = {
  mistral: {
    titre: 'IA Mistral',
    icone: '🤖',
    couleur: '#c98a3d',
    description:
      'Mycologue IA (Mistral Medium 3.5) — fiche détaillée, avec questions complémentaires en cas de doute.',
  },
  inaturalist: {
    titre: 'IA iNaturalist',
    icone: '🔬',
    couleur: '#1e8e3e',
    description:
      'Vision par ordinateur iNaturalist — gratuit, sans clé. Souvent au niveau du genre. Compte iNaturalist (gratuit) pour soumettre l’observation et la faire valider par la communauté.',
  },
  kindwise: {
    titre: 'Expert Kindwise',
    icone: '🍄',
    couleur: '#7b5ea7',
    description:
      'Spécialiste champignons — comestibilité et sosies. Nécessite une clé API Kindwise (gratuite, dans les réglages).',
  },
};

export type CleCouleurTheme = 'success' | 'warning' | 'danger' | 'textMuted';

export function texteConsensus(statut: StatutConsensus): {
  titre: string;
  couleur: CleCouleurTheme;
} {
  switch (statut) {
    case 'convergent':
      return { titre: 'Identification convergente', couleur: 'success' };
    case 'genre':
      return { titre: 'Convergence au niveau du genre', couleur: 'warning' };
    case 'divergent':
      return { titre: 'Moteurs en désaccord', couleur: 'danger' };
    case 'unique':
      return { titre: 'Un seul moteur utilisé', couleur: 'textMuted' };
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
