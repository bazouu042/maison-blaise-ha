import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { INATURALIST_VERROUILLE, TEXTE_INATURALIST_VERROUILLE, urlSite } from '../lib/inaturalist';
import { META_MOTEURS } from '../lib/labels';
import type { NomMoteur } from '../lib/types';
import { useAppTheme } from '../lib/theme';

interface Props {
  selectionnes: NomMoteur[];
  onChange: (moteurs: NomMoteur[]) => void;
}

const TOUS: NomMoteur[] = ['mistral', 'inaturalist', 'kindwise'];

export function SelecteurMoteurs({ selectionnes, onChange }: Props) {
  const theme = useAppTheme();

  function basculer(moteur: NomMoteur) {
    if (moteur === 'inaturalist' && INATURALIST_VERROUILLE) {
      Alert.alert('🔒 Bientôt disponible', TEXTE_INATURALIST_VERROUILLE, [
        { text: 'Fermer' },
        { text: 'Ouvrir iNaturalist', onPress: () => Linking.openURL(urlSite()) },
      ]);
      return;
    }
    if (selectionnes.includes(moteur)) {
      onChange(selectionnes.filter((m) => m !== moteur));
    } else {
      onChange([...selectionnes, moteur]);
    }
  }

  return (
    <View style={styles.conteneur}>
      <Text style={[styles.titre, { color: theme.text }]}>🧠 Moteurs d’identification</Text>
      <Text style={[styles.aide, { color: theme.textMuted }]}>
        Choisis un ou plusieurs moteurs. Tu pourras comparer leurs résultats côte à côte.
      </Text>
      {TOUS.map((moteur) => {
        const meta = META_MOTEURS[moteur];
        const actif = selectionnes.includes(moteur);
        const verrouille = moteur === 'inaturalist' && INATURALIST_VERROUILLE;
        return (
          <TouchableOpacity
            key={moteur}
            onPress={() => basculer(moteur)}
            style={[
              styles.carte,
              {
                backgroundColor: actif && !verrouille ? meta.couleur + '18' : theme.card,
                borderColor: actif && !verrouille ? meta.couleur : theme.border,
                opacity: verrouille ? 0.55 : 1,
              },
            ]}
            accessibilityRole={verrouille ? 'button' : 'checkbox'}
            accessibilityState={verrouille ? undefined : { checked: actif }}
            accessibilityLabel={verrouille ? `${meta.titre} — bientôt disponible` : undefined}
          >
            <View
              style={[
                styles.coche,
                { borderColor: actif && !verrouille ? meta.couleur : theme.border },
              ]}
            >
              {actif && !verrouille && (
                <View style={[styles.cocheInterieur, { backgroundColor: meta.couleur }]} />
              )}
              {verrouille && <Text style={styles.cadenas}>🔒</Text>}
            </View>
            <View style={styles.infos}>
              <Text style={[styles.nomMoteur, { color: theme.text }]}>
                {meta.icone} {meta.titre}
                {verrouille ? ' — Bientôt disponible 🔒' : ''}
              </Text>
              <Text style={[styles.description, { color: theme.textMuted }]}>
                {meta.description}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    gap: 8,
  },
  titre: {
    fontSize: 16,
    fontWeight: '700',
  },
  aide: {
    fontSize: 13,
    lineHeight: 18,
  },
  carte: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  coche: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cocheInterieur: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  cadenas: {
    fontSize: 11,
  },
  infos: {
    flex: 1,
    gap: 3,
  },
  nomMoteur: {
    fontSize: 15,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
});
