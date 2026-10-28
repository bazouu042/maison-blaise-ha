import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Confiance } from '../lib/types';
import { labelConfiance } from '../lib/labels';
import { useAppTheme } from '../lib/theme';

interface Props {
  confiance: Confiance;
}

export function ConfidenceBadge({ confiance }: Props) {
  const theme = useAppTheme();
  const { texte, couleur } = labelConfiance(confiance);
  const couleurFond = theme[couleur];
  return (
    <View style={[styles.badge, { backgroundColor: couleurFond + '25' }]}>
      <View style={[styles.point, { backgroundColor: couleurFond }]} />
      <Text style={[styles.texte, { color: couleurFond }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  point: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  texte: {
    fontSize: 13,
    fontWeight: '700',
  },
});
