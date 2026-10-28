export type Confiance = 'elevee' | 'moyenne' | 'faible';

export type Comestibilite =
  | 'comestible_excellent'
  | 'comestible'
  | 'comestible_jeune'
  | 'non_comestible'
  | 'toxique'
  | 'mortel'
  | 'inconnu';

export type NiveauComestibilite = 'ok' | 'attention' | 'danger' | 'inconnu';

export interface ReponseMycologue {
  nom_commun: string;
  nom_scientifique: string;
  confiance: Confiance;
  comestibilite: Comestibilite;
  description: string;
  habitat: string;
  saison: string;
  confusions: string[];
  questions_supplementaires: string[];
}

export interface PhotoCapture {
  uri: string;
  base64?: string;
}

export type StatutIdentification = 'en_attente' | 'analyse' | 'terminee' | 'erreur';

export type NomMoteur = 'mistral' | 'inaturalist' | 'kindwise';

export interface HypotheseMoteur {
  nomScientifique: string;
  nomCommun?: string;
  score: number;
  lien?: string;
  comestibilite?: string;
  pictoComestibilite?: string;
  niveauComestibilite?: NiveauComestibilite;
  sosies?: string[];
}

export interface ResultatMoteur {
  moteur: NomMoteur;
  succes: boolean;
  erreur?: string;
  hypotheses: HypotheseMoteur[];
  ficheMistral?: ReponseMycologue;
  note?: string;
}

export type StatutConsensus = 'convergent' | 'genre' | 'divergent' | 'unique';

export interface Consensus {
  statut: StatutConsensus;
  especeCommune?: string;
  genreCommun?: string;
  moteursImpliques: NomMoteur[];
}

export interface Identification {
  id: string;
  date: string;
  photos: string[];
  reponsesUtilisateur: Record<string, string>;
  moteurs: NomMoteur[];
  resultatsMoteurs?: ResultatMoteur[];
  consensus?: Consensus;
  resultat?: ReponseMycologue;
  statut: StatutIdentification;
  erreur?: string;
  latitude?: number;
  longitude?: number;
  enAttenteHorsLigne: boolean;
}

export interface CleApiStockee {
  cle: string;
  modele: string;
  cleKindwise?: string;
  inatAppId?: string;
  inatAppSecret?: string;
}
