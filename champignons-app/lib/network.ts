import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type EtatReseau = 'en_ligne' | 'hors_ligne' | 'inconnu';

let etatCourant: EtatReseau = 'inconnu';
const abonnes = new Set<(etat: EtatReseau) => void>();

function notifier(etat: EtatReseau) {
  etatCourant = etat;
  abonnes.forEach((fn) => fn(etat));
}

export function getEtatReseau(): EtatReseau {
  return etatCourant;
}

export function onChangementReseau(fn: (etat: EtatReseau) => void): () => void {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

export function useEtatReseau(): EtatReseau {
  const [etat, setEtat] = useState<EtatReseau>(etatCourant);
  useEffect(() => onChangementReseau(setEtat), []);
  return etat;
}

export async function verifierReseau(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
  try {
    const reponse = await fetch('https://api.mistral.ai/v1/models', {
      method: 'HEAD',
    });
    const enLigne = reponse.ok || reponse.status === 401 || reponse.status === 403;
    notifier(enLigne ? 'en_ligne' : 'hors_ligne');
    return enLigne;
  } catch {
    notifier('hors_ligne');
    return false;
  }
}
