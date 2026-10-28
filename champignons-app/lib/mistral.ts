import * as FileSystem from 'expo-file-system/legacy';
import type { PhotoCapture, ReponseMycologue } from './types';

const URL_API = 'https://api.mistral.ai/v1/chat/completions';
const MODELE_PAR_DEFAUT = 'mistral-medium-latest';

// Les modèles Pixtral ont été retirés de l'API Mistral (shutdown le 31 mai 2026).
// Si un ancien réglage contient encore un pixtral, on retombe sur le modèle par défaut.
function normaliserModele(modele: string): string {
  if (!modele || modele.startsWith('pixtral')) return MODELE_PAR_DEFAUT;
  return modele;
}

export const PROMPT_SYSTEME_MYCOLOGUE = `Tu es un mycologue expert francophone, spécialisé dans l'identification des champignons européens. On te fournit une ou plusieurs photos d'un même champignon (chapeau, dessous du chapeau, pied, environnement) et éventuellement les réponses de l'observateur à des questions complémentaires.

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balises markdown.
- Ne donne jamais de conseil de consommation. Indique la comestibilité comme information encyclopédique uniquement.
- Si les photos sont insuffisantes ou ambiguës, mets "confiance" à "faible" et remplis "questions_supplementaires" avec 3 à 6 questions précises à poser à l'utilisateur pour affiner l'identification.
- Sois prudent : en cas de doute entre espèces proches, privilégie "confiance": "faible" ou "moyenne" et liste les confusions possibles.
- Rédige tous les textes en français.

FORMAT JSON ATTENDU (strictement respecté) :
{
  "nom_commun": "Nom commun français",
  "nom_scientifique": "Nom scientifique (latin)",
  "confiance": "elevee" | "moyenne" | "faible",
  "comestibilite": "comestible_excellent" | "comestible" | "comestible_jeune" | "non_comestible" | "toxique" | "mortel" | "inconnu",
  "description": "Description détaillée en 3 à 5 phrases (chapeau, lames/tubes, pied, chair, odeur)",
  "habitat": "Milieu de vie typique",
  "saison": "Saison de fructification",
  "confusions": ["Espèce ressemblante 1 (et pourquoi)", "Espèce ressemblante 2"],
  "questions_supplementaires": ["Question 1 ?", "Question 2 ?"]
}

Si tu ne peux vraiment pas proposer d'identification, mets nom_commun à "Identification incertaine", nom_scientifique à "", confiance à "faible" et pose des questions.`;

async function imageVersBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  return base64;
}

function extraireJson(texte: string): string {
  let t = texte.trim();
  const debut = t.indexOf('{');
  const fin = t.lastIndexOf('}');
  if (debut !== -1 && fin !== -1 && fin > debut) {
    t = t.slice(debut, fin + 1);
  }
  return t;
}

export function parserReponseMycologue(texte: string): ReponseMycologue {
  const json = extraireJson(texte);
  const brut = JSON.parse(json) as Partial<ReponseMycologue>;

  const confianceValide = ['elevee', 'moyenne', 'faible'];
  const comestibilitesValides = [
    'comestible_excellent',
    'comestible',
    'comestible_jeune',
    'non_comestible',
    'toxique',
    'mortel',
    'inconnu',
  ];

  return {
    nom_commun: typeof brut.nom_commun === 'string' && brut.nom_commun ? brut.nom_commun : 'Identification incertaine',
    nom_scientifique: typeof brut.nom_scientifique === 'string' ? brut.nom_scientifique : '',
    confiance: confianceValide.includes(brut.confiance as string)
      ? (brut.confiance as ReponseMycologue['confiance'])
      : 'faible',
    comestibilite: comestibilitesValides.includes(brut.comestibilite as string)
      ? (brut.comestibilite as ReponseMycologue['comestibilite'])
      : 'inconnu',
    description: typeof brut.description === 'string' ? brut.description : '',
    habitat: typeof brut.habitat === 'string' ? brut.habitat : '',
    saison: typeof brut.saison === 'string' ? brut.saison : '',
    confusions: Array.isArray(brut.confusions)
      ? brut.confusions.filter((c): c is string => typeof c === 'string')
      : [],
    questions_supplementaires: Array.isArray(brut.questions_supplementaires)
      ? brut.questions_supplementaires.filter((q): q is string => typeof q === 'string')
      : [],
  };
}

export interface ResultatAnalyse {
  resultat: ReponseMycologue;
}

export async function analyserChampignon(
  cleApi: string,
  modele: string,
  photos: PhotoCapture[],
  reponsesUtilisateur: Record<string, string>,
): Promise<ResultatAnalyse> {
  if (photos.length === 0) {
    throw new Error('Aucune photo fournie.');
  }

  const contenuImages = [];
  for (const photo of photos) {
    const base64 = photo.base64 ?? (await imageVersBase64(photo.uri));
    contenuImages.push({
      type: 'image_url' as const,
      image_url: { url: `data:image/jpeg;base64,${base64}` },
    });
  }

  let texteUtilisateur =
    'Photos du champignon à identifier (plusieurs angles du même spécimen).';
  const reponses = Object.entries(reponsesUtilisateur);
  if (reponses.length > 0) {
    texteUtilisateur += '\n\nRéponses de l’observateur aux questions complémentaires :\n';
    for (const [question, reponse] of reponses) {
      texteUtilisateur += `- ${question} → ${reponse}\n`;
    }
    texteUtilisateur += '\nTiens compte de ces réponses pour affiner ton identification.';
  }

  const reponse = await fetch(URL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cleApi}`,
    },
    body: JSON.stringify({
      model: normaliserModele(modele),
      messages: [
        { role: 'system', content: PROMPT_SYSTEME_MYCOLOGUE },
        {
          role: 'user',
          content: [
            { type: 'text' as const, text: texteUtilisateur },
            ...contenuImages,
          ],
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!reponse.ok) {
    const corps = await reponse.text().catch(() => '');
    if (reponse.status === 401) {
      throw new Error('Clé API Mistral invalide (erreur 401). Vérifie-la dans les réglages.');
    }
    throw new Error(`Erreur API Mistral (${reponse.status}) : ${corps.slice(0, 200)}`);
  }

  const donnees = (await reponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const texte = donnees.choices?.[0]?.message?.content;
  if (!texte) {
    throw new Error('Réponse vide de l’API Mistral.');
  }

  try {
    return { resultat: parserReponseMycologue(texte) };
  } catch {
    throw new Error('La réponse de l’IA n’a pas pu être interprétée (JSON invalide).');
  }
}
