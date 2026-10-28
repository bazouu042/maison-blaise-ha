import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useAppTheme } from '../lib/theme';

interface Props {
  uri: string;
  onSupprimer?: () => void;
  taille?: number;
}

export function PhotoThumb({ uri, onSupprimer, taille = 84 }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[styles.conteneur, { width: taille, height: taille, borderColor: theme.border }]}>
      <Image source={{ uri }} style={styles.image} contentFit="cover" transition={150} />
      {onSupprimer && (
        <TouchableOpacity
          style={[styles.boutonSupprimer, { backgroundColor: theme.danger }]}
          onPress={onSupprimer}
          accessibilityLabel="Supprimer cette photo"
        >
          <Text style={styles.croix}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  boutonSupprimer: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  croix: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});
