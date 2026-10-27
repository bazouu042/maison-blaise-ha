import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../lib/theme';

interface Props {
  titre: string;
  onPress: () => void;
  variante?: 'primaire' | 'secondaire' | 'danger';
  icone?: string;
  desactive?: boolean;
  chargement?: boolean;
  style?: ViewStyle;
}

export function AppButton({
  titre,
  onPress,
  variante = 'primaire',
  icone,
  desactive = false,
  chargement = false,
  style,
}: Props) {
  const theme = useAppTheme();
  const actif = !desactive && !chargement;

  const couleurFond =
    variante === 'primaire' ? theme.primary : variante === 'danger' ? theme.danger : 'transparent';
  const couleurTexte =
    variante === 'primaire' || variante === 'danger' ? '#ffffff' : theme.primary;
  const couleurBordure = variante === 'secondaire' ? theme.primary : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!actif}
      style={[
        styles.bouton,
        {
          backgroundColor: couleurFond,
          borderColor: couleurBordure,
          opacity: actif ? 1 : 0.5,
        },
        style,
      ]}
      accessibilityRole="button"
    >
      {chargement ? (
        <ActivityIndicator color={couleurTexte} />
      ) : (
        <Text style={[styles.texte, { color: couleurTexte }]}>
          {icone ? `${icone}  ` : ''}
          {titre}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bouton: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  texte: {
    fontSize: 16,
    fontWeight: '700',
  },
});
