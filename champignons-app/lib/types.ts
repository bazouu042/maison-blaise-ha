export type Confiance = 'elevee' | 'moyenne' | 'faible';

export type Comestibilite =
  | 'comestible_excellent'
  | 'comestible'
  | 'comestible_jeune'
  | 'non_comestible'
  | 'toxique'
  | 'mortel'
  | 'inconnu';

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

export interface Identification {
  id: string;
  date: string;
  photos: string[];
  reponsesUtilisateur: Record<string, string>;
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
}
