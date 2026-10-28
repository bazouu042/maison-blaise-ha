import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AVERTISSEMENT_SECURITE } from '../lib/labels';
import { useAppTheme } from '../lib/theme';

export function SafetyBanner() {
  const theme = useAppTheme();
  return (
    <View style={[styles.conteneur, { backgroundColor: theme.danger + '22', borderColor: theme.danger }]}>
      <Text style={[styles.texte, { color: theme.danger }]}>{AVERTISSEMENT_SECURITE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  texte: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
