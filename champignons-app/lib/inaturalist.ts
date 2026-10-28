import type { HypotheseMoteur, PhotoCapture, ResultatMoteur } from './types';

const URL_API = 'https://api.inaturalist.org/v1/computervision/score_image';
const NB_SUGGESTIONS = 5;

interface TaxonINat {
  id: number;
  name: string;
  rank?: string;
  preferred_common_name?: string | null;
  wikipedia_url?: string | null;
}

interface ResultatINat {
  score?: number;
  taxon?: TaxonINat;
}

export async function analyserAvecINaturalist(
  photos: PhotoCapture[],
): Promise<ResultatMoteur> {
  if (photos.length === 0) {
    return {
      moteur: 'inaturalist',
      succes: false,
      erreur: 'Aucune photo fournie.',
      hypotheses: [],
    };
  }
  try {
    // L'API iNaturalist n'accepte qu'une image par requête : on envoie la première photo.
    const formData = new FormData();
    formData.append('image', {
      uri: photos[0].uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    const reponse = await fetch(URL_API, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });

    if (!reponse.ok) {
      throw new Error(`Erreur iNaturalist (${reponse.status})`);
    }

    const donnees = (await reponse.json()) as { results?: ResultatINat[] };
    const resultats = (donnees.results ?? []).filter(
      (r): r is ResultatINat & { taxon: TaxonINat } => !!r.taxon?.name,
    );

    if (resultats.length === 0) {
      return {
        moteur: 'inaturalist',
        succes: true,
        hypotheses: [],
        note: 'iNaturalist n’a proposé aucun taxon pour cette photo.',
      };
    }

    const hypotheses: HypotheseMoteur[] = resultats.slice(0, NB_SUGGESTIONS).map((r) => ({
      nomScientifique: r.taxon.name,
      nomCommun: r.taxon.preferred_common_name ?? undefined,
      score: Math.round((r.score ?? 0) * 100),
      lien: r.taxon.wikipedia_url ?? `https://www.inaturalist.org/taxa/${r.taxon.id}`,
    }));

    return {
      moteur: 'inaturalist',
      succes: true,
      hypotheses,
      note: 'Analyse basée sur la 1ʳᵉ photo uniquement. L’identification est souvent au niveau du genre. Crée un compte iNaturalist (gratuit) pour soumettre l’observation et la faire valider par la communauté.',
    };
  } catch (erreur) {
    return {
      moteur: 'inaturalist',
      succes: false,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
      hypotheses: [],
    };
  }
}
