import type { PhotoCapture, ResultatMoteur } from './types';

// ---------------------------------------------------------------------------
// MOTEUR INATURALIST — 🔒 BIENTÔT DISPONIBLE
//
// L'API Computer Vision d'iNaturalist exige désormais un token OAuth2
// d'application officielle. Conditions d'obtention (côté iNaturalist) :
//   - compte vieux d'au moins 2 mois
//   - au moins 10 « identifications améliorantes » par mois
// Le code ci-dessous est prêt : il ne manque que les identifiants OAuth2
// (app_id / app_secret), à renseigner dans Réglages quand ils seront obtenus.
// ---------------------------------------------------------------------------

const URL_API = 'https://api.inaturalist.org/v1/computervision/score_image';
const URL_SITE = 'https://www.inaturalist.org';
const NB_SUGGESTIONS = 5;

interface IdentifiantsOAuth {
  appId: string;
  appSecret: string;
}

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

export const INATURALIST_VERROUILLE = true;

export const TEXTE_INATURALIST_VERROUILLE =
  "L'accès à l'IA iNaturalist se débloquera dans quelques mois (compte requis de 2 mois + activité d'identification). En attendant, tu peux soumettre tes observations manuellement sur inaturalist.org pour recevoir une validation humaine gratuite.";

export function estConfigure(identifiants?: IdentifiantsOAuth | null): boolean {
  return !INATURALIST_VERROUILLE && !!identifiants?.appId && !!identifiants?.appSecret;
}

export function urlSite(): string {
  return URL_SITE;
}

// Étape 1 (future) : obtenir un token OAuth2 « client credentials ».
async function obtenirToken(identifiants: IdentifiantsOAuth): Promise<string> {
  const corps = new URLSearchParams({
    client_id: identifiants.appId,
    client_secret: identifiants.appSecret,
    grant_type: 'client_credentials',
  });
  const reponse = await fetch('https://www.inaturalist.org/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corps.toString(),
  });
  if (!reponse.ok) {
    throw new Error(`Échec de l'authentification iNaturalist (${reponse.status})`);
  }
  const donnees = (await reponse.json()) as { access_token?: string };
  if (!donnees.access_token) {
    throw new Error('Token iNaturalist absent dans la réponse.');
  }
  return donnees.access_token;
}

// Moteur complet, prêt à être réactivé quand INATURALIST_VERROUILLE passera à false
// et que les identifiants OAuth2 seront renseignés dans les réglages.
export async function analyserAvecINaturalist(
  photos: PhotoCapture[],
  identifiants?: IdentifiantsOAuth | null,
): Promise<ResultatMoteur> {
  if (INATURALIST_VERROUILLE || !estConfigure(identifiants)) {
    return {
      moteur: 'inaturalist',
      succes: false,
      erreur: 'Moteur verrouillé — bientôt disponible (voir Réglages).',
      hypotheses: [],
    };
  }
  if (photos.length === 0) {
    return {
      moteur: 'inaturalist',
      succes: false,
      erreur: 'Aucune photo fournie.',
      hypotheses: [],
    };
  }
  try {
    const token = await obtenirToken(identifiants!);

    // L'API iNaturalist n'accepte qu'une image par requête : on envoie la première photo.
    const formData = new FormData();
    formData.append('image', {
      uri: photos[0].uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    const reponse = await fetch(URL_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
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

    const hypotheses = resultats.slice(0, NB_SUGGESTIONS).map((r) => ({
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
