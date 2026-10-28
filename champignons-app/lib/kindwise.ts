import type {
  HypotheseMoteur,
  NiveauComestibilite,
  PhotoCapture,
  ResultatMoteur,
} from './types';

const URL_API = 'https://mushroom.kindwise.com/api/v1/identification';
const NB_SUGGESTIONS = 5;

interface DetailsKindwise {
  common_names?: string[];
  gbif_id?: number;
  taxonomy?: { genus?: string };
  edibility?: string;
  edible?: string;
  comestibility?: string;
  look_alikes?: unknown;
  similar_species?: unknown;
  confusions?: unknown;
  [cle: string]: unknown;
}

interface SuggestionKindwise {
  id?: string;
  name?: string;
  probability?: number;
  details?: DetailsKindwise;
}

interface ReponseKindwise {
  result?: {
    is_mushroom?: { value?: boolean; probability?: number };
    classification?: { suggestions?: SuggestionKindwise[] };
  };
}

// Les 8 niveaux de comestibilité Kindwise, traduits pour l'interface.
const NIVEAUX: Record<
  string,
  { libelle: string; picto: string; niveau: NiveauComestibilite }
> = {
  edible: { libelle: 'Comestible', picto: '✅', niveau: 'ok' },
  edible_with_cautions: { libelle: 'Comestible avec précautions', picto: '✅', niveau: 'ok' },
  edible_when_cooked: { libelle: 'Comestible bien cuit', picto: '✅', niveau: 'ok' },
  inedible: { libelle: 'Non comestible', picto: '⚠️', niveau: 'attention' },
  toxic: { libelle: 'Toxique — ne pas consommer', picto: '❌', niveau: 'danger' },
  deadly: { libelle: 'MORTEL — ne jamais consommer', picto: '☠️', niveau: 'danger' },
  psychoactive: { libelle: 'Psychoactif — ne pas consommer', picto: '🌀', niveau: 'danger' },
  hallucinogenic: { libelle: 'Hallucinogène — ne pas consommer', picto: '🌀', niveau: 'danger' },
  medicinal: { libelle: 'Usage médicinal uniquement', picto: '💊', niveau: 'attention' },
  unknown: { libelle: 'Comestibilité inconnue — ne pas consommer', picto: '❓', niveau: 'inconnu' },
  unclassified: {
    libelle: 'Comestibilité inconnue — ne pas consommer',
    picto: '❓',
    niveau: 'inconnu',
  },
};

function normaliserCle(valeur: string): string {
  return valeur.toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function comestibiliteDepuisDetails(details?: DetailsKindwise) {
  if (!details) return undefined;
  const brut = details.edibility ?? details.edible ?? details.comestibility;
  if (typeof brut !== 'string' || !brut) return undefined;
  return NIVEAUX[normaliserCle(brut)] ?? NIVEAUX.unknown;
}

function sosiesDepuisDetails(details?: DetailsKindwise): string[] {
  if (!details) return [];
  const brut = details.look_alikes ?? details.similar_species ?? details.confusions;
  if (!Array.isArray(brut)) return [];
  return brut
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        return typeof obj.name === 'string' ? obj.name : undefined;
      }
      return undefined;
    })
    .filter((s): s is string => !!s);
}

export async function analyserAvecKindwise(
  cleApi: string,
  photos: PhotoCapture[],
  coords?: { latitude: number; longitude: number },
): Promise<ResultatMoteur> {
  if (photos.length === 0) {
    return {
      moteur: 'kindwise',
      succes: false,
      erreur: 'Aucune photo fournie.',
      hypotheses: [],
    };
  }
  try {
    const formData = new FormData();
    for (const photo of photos) {
      formData.append('images', {
        uri: photo.uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
    }
    if (coords) {
      formData.append('latitude', String(coords.latitude));
      formData.append('longitude', String(coords.longitude));
    }
    formData.append('similar_images', 'true');

    const reponse = await fetch(URL_API, {
      method: 'POST',
      headers: { 'Api-Key': cleApi, Accept: 'application/json' },
      body: formData,
    });

    if (!reponse.ok) {
      if (reponse.status === 401 || reponse.status === 403) {
        throw new Error(
          `Clé API Kindwise invalide (erreur ${reponse.status}). Vérifie-la dans les réglages.`,
        );
      }
      const corps = await reponse.text().catch(() => '');
      throw new Error(`Erreur Kindwise (${reponse.status}) : ${corps.slice(0, 200)}`);
    }

    const donnees = (await reponse.json()) as ReponseKindwise;
    const suggestions = donnees.result?.classification?.suggestions ?? [];

    const isMushroom = donnees.result?.is_mushroom;
    let note: string | undefined;
    if (isMushroom && isMushroom.value === false) {
      note = `Attention : Kindwise estime à ${Math.round((isMushroom.probability ?? 0) * 100)} % que la photo ne représente pas un champignon.`;
    }

    if (suggestions.length === 0) {
      return {
        moteur: 'kindwise',
        succes: true,
        hypotheses: [],
        note: note ?? 'Kindwise n’a proposé aucune espèce.',
      };
    }

    const hypotheses: HypotheseMoteur[] = suggestions.slice(0, NB_SUGGESTIONS).map((s) => {
      const comest = comestibiliteDepuisDetails(s.details);
      const gbif = s.details?.gbif_id;
      return {
        nomScientifique: s.name ?? 'Inconnu',
        nomCommun: s.details?.common_names?.[0],
        score: Math.round((s.probability ?? 0) * 100),
        lien: gbif ? `https://www.gbif.org/species/${gbif}` : undefined,
        comestibilite: comest?.libelle,
        pictoComestibilite: comest?.picto,
        niveauComestibilite: comest?.niveau,
        sosies: sosiesDepuisDetails(s.details),
      };
    });

    return { moteur: 'kindwise', succes: true, hypotheses, note };
  } catch (erreur) {
    return {
      moteur: 'kindwise',
      succes: false,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
      hypotheses: [],
    };
  }
}
