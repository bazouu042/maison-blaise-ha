import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { texteConsensus } from '../lib/labels';
import { nomsMoteurs } from '../lib/consensus';
import type { Consensus } from '../lib/types';
import { useAppTheme } from '../lib/theme';

interface Props {
  consensus: Consensus;
  hypothesesDivergentes?: { moteur: string; nom: string }[];
}

export function ConsensusBanner({ consensus, hypothesesDivergentes = [] }: Props) {
  const theme = useAppTheme();
  const { titre, couleur } = texteConsensus(consensus.statut);
  const couleurFond = theme[couleur];

  let corps: string;
  switch (consensus.statut) {
    case 'convergent':
      corps = `✅ Identification convergente : plusieurs moteurs proposent la même espèce — ${consensus.especeCommune}.`;
      break;
    case 'genre':
      corps = `⚠️ Convergence au niveau du genre uniquement (${consensus.genreCommun}). L’espèce exacte reste à confirmer.`;
      break;
    case 'divergent':
      corps = '⚠️ Identification incertaine : les moteurs divergent. Faites impérativement valider par un mycologue avant toute consommation.';
      break;
    case 'unique':
      corps = `ℹ️ Un seul moteur a répondu (${nomsMoteurs(consensus.moteursImpliques)}). Lancez d’autres moteurs pour comparer.`;
      break;
  }

  return (
    <View
      style={[
        styles.conteneur,
        {
          backgroundColor: couleurFond + '22',
          borderColor: couleurFond,
        },
      ]}
    >
      <Text style={[styles.titre, { color: couleurFond }]}>🤝 {titre}</Text>
      <Text style={[styles.corps, { color: theme.text }]}>{corps}</Text>
      {consensus.statut === 'divergent' && hypothesesDivergentes.length > 0 && (
        <View style={styles.listeHyp}>
          {hypothesesDivergentes.map((h, index) => (
            <Text key={index} style={[styles.hyp, { color: theme.textMuted }]}>
              • {h.moteur} : {h.nom}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    marginHorizontal: 16,
  },
  titre: {
    fontSize: 15,
    fontWeight: '800',
  },
  corps: {
    fontSize: 13,
    lineHeight: 18,
  },
  listeHyp: {
    marginTop: 4,
    gap: 2,
  },
  hyp: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
