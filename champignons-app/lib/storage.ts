import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CleApiStockee, Identification } from './types';

const CLE_API = '@champi/api';
const CLE_HISTORIQUE = '@champi/historique';

export async function chargerCleApi(): Promise<CleApiStockee | null> {
  const brut = await AsyncStorage.getItem(CLE_API);
  if (!brut) return null;
  try {
    return JSON.parse(brut) as CleApiStockee;
  } catch {
    return null;
  }
}

export async function sauverCleApi(
  cle: string,
  modele: string,
  cleKindwise?: string,
  inatAppId?: string,
  inatAppSecret?: string,
): Promise<void> {
  await AsyncStorage.setItem(
    CLE_API,
    JSON.stringify({ cle, modele, cleKindwise, inatAppId, inatAppSecret } satisfies CleApiStockee),
  );
}

export async function sauverCleKindwise(cleKindwise: string): Promise<void> {
  const config = (await chargerCleApi()) ?? { cle: '', modele: 'mistral-medium-latest' };
  await AsyncStorage.setItem(
    CLE_API,
    JSON.stringify({ ...config, cleKindwise } satisfies CleApiStockee),
  );
}

export async function sauverIdentifiantsINaturalist(
  inatAppId: string,
  inatAppSecret: string,
): Promise<void> {
  const config = (await chargerCleApi()) ?? { cle: '', modele: 'mistral-medium-latest' };
  await AsyncStorage.setItem(
    CLE_API,
    JSON.stringify({ ...config, inatAppId, inatAppSecret } satisfies CleApiStockee),
  );
}

export async function supprimerCleApi(): Promise<void> {
  await AsyncStorage.removeItem(CLE_API);
}

export async function chargerHistorique(): Promise<Identification[]> {
  const brut = await AsyncStorage.getItem(CLE_HISTORIQUE);
  if (!brut) return [];
  try {
    const parsed = JSON.parse(brut);
    return Array.isArray(parsed) ? (parsed as Identification[]) : [];
  } catch {
    return [];
  }
}

async function sauverHistorique(liste: Identification[]): Promise<void> {
  await AsyncStorage.setItem(CLE_HISTORIQUE, JSON.stringify(liste));
}

export async function ajouterIdentification(id: Identification): Promise<Identification[]> {
  const liste = await chargerHistorique();
  const nouvelle = [id, ...liste];
  await sauverHistorique(nouvelle);
  return nouvelle;
}

export async function mettreAJourIdentification(id: Identification): Promise<Identification[]> {
  const liste = await chargerHistorique();
  const nouvelle = liste.map((item) => (item.id === id.id ? id : item));
  await sauverHistorique(nouvelle);
  return nouvelle;
}

export async function supprimerIdentification(id: string): Promise<Identification[]> {
  const liste = await chargerHistorique();
  const nouvelle = liste.filter((item) => item.id !== id);
  await sauverHistorique(nouvelle);
  return nouvelle;
}

export async function viderHistorique(): Promise<void> {
  await sauverHistorique([]);
}
