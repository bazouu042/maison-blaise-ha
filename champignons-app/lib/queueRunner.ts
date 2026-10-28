import { calculerConsensus } from './consensus';
import { executerMoteurs } from './moteurs';
import { verifierReseau, onChangementReseau } from './network';
import {
  chargerCleApi,
  chargerHistorique,
  mettreAJourIdentification,
} from './storage';

let enCours = false;
let relanceProgrammee = false;

async function traiterFile() {
  if (enCours) return;
  enCours = true;
  try {
    const config = await chargerCleApi();
    const cleMistralRequise = false; // iNaturalist fonctionne sans aucune clé
    void cleMistralRequise;
    const historique = await chargerHistorique();
    const enAttente = historique.filter(
      (item) => item.enAttenteHorsLigne && item.statut === 'en_attente',
    );
    for (const item of enAttente) {
      // Les anciennes entrées (avant multi-moteurs) n'ont pas le champ moteurs.
      const moteurs = item.moteurs ?? ['mistral'];
      const enLigne = await verifierReseau();
      if (!enLigne) break;
      item.statut = 'analyse';
      item.enAttenteHorsLigne = false;
      await mettreAJourIdentification(item);
      const resultatsMoteurs = await executerMoteurs(
        moteurs,
        item.photos.map((uri) => ({ uri })),
        item.reponsesUtilisateur,
        config,
        item.latitude != null && item.longitude != null
          ? { latitude: item.latitude, longitude: item.longitude }
          : undefined,
      );
      item.resultatsMoteurs = resultatsMoteurs;
      item.consensus = calculerConsensus(resultatsMoteurs);
      const mistral = resultatsMoteurs.find((r) => r.moteur === 'mistral');
      if (mistral?.ficheMistral) {
        item.resultat = mistral.ficheMistral;
      }
      const auMoinsUnSucces = resultatsMoteurs.some((r) => r.succes);
      if (auMoinsUnSucces) {
        item.statut = 'terminee';
        item.erreur = undefined;
      } else {
        item.statut = 'erreur';
        item.erreur = resultatsMoteurs
          .map((r) => `${r.moteur} : ${r.erreur ?? 'échec'}`)
          .join('\n');
        item.enAttenteHorsLigne = true;
      }
      await mettreAJourIdentification(item);
    }
  } finally {
    enCours = false;
  }
}

function programmerRelance() {
  if (relanceProgrammee) return;
  relanceProgrammee = true;
  setTimeout(() => {
    relanceProgrammee = false;
    void traiterFile();
  }, 1500);
}

let initialise = false;

export function demarrerFileHorsLigne(): void {
  if (initialise) return;
  initialise = true;
  onChangementReseau((etat) => {
    if (etat === 'en_ligne') programmerRelance();
  });
  setInterval(() => {
    void verifierReseau().then((enLigne) => {
      if (enLigne) programmerRelance();
    });
  }, 30000);
  programmerRelance();
}
