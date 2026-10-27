import { analyserChampignon } from './mistral';
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
    const cleApi = await chargerCleApi();
    if (!cleApi || !cleApi.cle) {
      enCours = false;
      return;
    }
    const historique = await chargerHistorique();
    const enAttente = historique.filter(
      (item) => item.enAttenteHorsLigne && item.statut === 'en_attente',
    );
    for (const item of enAttente) {
      const enLigne = await verifierReseau();
      if (!enLigne) break;
      item.statut = 'analyse';
      item.enAttenteHorsLigne = false;
      await mettreAJourIdentification(item);
      try {
        const { resultat } = await analyserChampignon(
          cleApi.cle,
          cleApi.modele,
          item.photos.map((uri) => ({ uri })),
          item.reponsesUtilisateur,
        );
        item.resultat = resultat;
        item.statut = 'terminee';
      } catch (erreur) {
        item.statut = 'erreur';
        item.erreur = erreur instanceof Error ? erreur.message : String(erreur);
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
