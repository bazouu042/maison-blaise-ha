import { analyserAvecINaturalist } from './inaturalist';
import { analyserAvecKindwise } from './kindwise';
import { analyserAvecMistral } from './mistral';
import type { CleApiStockee, NomMoteur, PhotoCapture, ResultatMoteur } from './types';

export async function executerMoteur(
  moteur: NomMoteur,
  photos: PhotoCapture[],
  reponses: Record<string, string>,
  config: CleApiStockee | null,
  coords?: { latitude: number; longitude: number },
): Promise<ResultatMoteur> {
  try {
    switch (moteur) {
      case 'mistral':
        if (!config?.cle) {
          return {
            moteur,
            succes: false,
            erreur: 'Clé API Mistral manquante — renseigne-la dans les réglages.',
            hypotheses: [],
          };
        }
        return analyserAvecMistral(config.cle, config.modele, photos, reponses);
      case 'inaturalist':
        return analyserAvecINaturalist(photos);
      case 'kindwise':
        if (!config?.cleKindwise) {
          return {
            moteur,
            succes: false,
            erreur: 'Clé API Kindwise manquante — renseigne-la dans les réglages.',
            hypotheses: [],
          };
        }
        return analyserAvecKindwise(config.cleKindwise, photos, coords);
    }
  } catch (erreur) {
    return {
      moteur,
      succes: false,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
      hypotheses: [],
    };
  }
}

export async function executerMoteurs(
  moteurs: NomMoteur[],
  photos: PhotoCapture[],
  reponses: Record<string, string>,
  config: CleApiStockee | null,
  coords?: { latitude: number; longitude: number },
): Promise<ResultatMoteur[]> {
  return Promise.all(moteurs.map((m) => executerMoteur(m, photos, reponses, config, coords)));
}
