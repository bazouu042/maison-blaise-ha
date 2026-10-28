import { META_MOTEURS } from './labels';
import type { Consensus, NomMoteur, ResultatMoteur } from './types';

const MOTS_IGNORES = new Set(['var', 'subsp', 'f', 'forma', 'var.', 'subsp.', 'sensu', 'lato']);

function motsSignificatifs(nom: string): string[] {
  return nom
    .toLowerCase()
    .trim()
    .replace(/[.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((m) => m.length > 1 && !MOTS_IGNORES.has(m));
}

function cleEspece(nom: string): string {
  return motsSignificatifs(nom).slice(0, 2).join(' ');
}

function cleGenre(nom: string): string {
  return motsSignificatifs(nom)[0] ?? '';
}

function premierDoublon(valeurs: string[]): string | undefined {
  return valeurs.find((v, i) => v !== '' && valeurs.indexOf(v) !== i);
}

export function calculerConsensus(resultats: ResultatMoteur[]): Consensus {
  const actifs = resultats.filter((r) => r.succes && r.hypotheses.length > 0);
  const moteursImpliques = actifs.map((r) => r.moteur);

  if (actifs.length === 0) {
    return { statut: 'divergent', moteursImpliques: [] };
  }
  if (actifs.length === 1) {
    return { statut: 'unique', moteursImpliques };
  }

  const tops = actifs.map((r) => ({ moteur: r.moteur, hyp: r.hypotheses[0] }));

  const especes = tops.map((t) => cleEspece(t.hyp.nomScientifique));
  const especeCommune = premierDoublon(especes);
  if (especeCommune) {
    const concernes = tops.filter((t) => cleEspece(t.hyp.nomScientifique) === especeCommune);
    return {
      statut: 'convergent',
      especeCommune: concernes[0].hyp.nomScientifique,
      moteursImpliques: concernes.map((t) => t.moteur),
    };
  }

  const genres = tops.map((t) => cleGenre(t.hyp.nomScientifique));
  const genreCommun = premierDoublon(genres);
  if (genreCommun) {
    const concernes = tops.filter((t) => cleGenre(t.hyp.nomScientifique) === genreCommun);
    return {
      statut: 'genre',
      genreCommun: concernes[0].hyp.nomScientifique.split(' ')[0],
      moteursImpliques: concernes.map((t) => t.moteur),
    };
  }

  return { statut: 'divergent', moteursImpliques };
}

export function nomsMoteurs(moteurs: NomMoteur[]): string {
  return moteurs.map((m) => META_MOTEURS[m].titre).join(' + ');
}
