import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { SafetyBanner } from '../components/SafetyBanner';
import { chargerCleApi } from '../lib/storage';
import { useEtatReseau } from '../lib/network';
import { useAppTheme } from '../lib/theme';

export default function AccueilScreen() {
  const theme = useAppTheme();
  const etatReseau = useEtatReseau();
  const [cleConfigured, setCleConfiguree] = useState<boolean | null>(null);

  const rafraichir = useCallback(async () => {
    const config = await chargerCleApi();
    setCleConfiguree(!!config?.cle);
  }, []);

  useFocusEffect(
    useCallback(() => {
      rafraichir();
    }, [rafraichir]),
  );

  const horsLigne = etatReseau === 'hors_ligne';

  return (
    <SafeAreaView style={[styles.fond, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.entete}>
          <Text style={styles.emoji}>🍄</Text>
          <Text style={[styles.titre, { color: theme.text }]}>Champi’Recon</Text>
          <Text style={[styles.sousTitre, { color: theme.textMuted }]}>
            Reconnaissance de champignons, même au fond des bois
          </Text>
        </View>

        <View
          style={[
            styles.bandeauReseau,
            { backgroundColor: horsLigne ? theme.warning + '25' : theme.success + '25' },
          ]}
        >
          <Text style={{ color: horsLigne ? theme.warning : theme.success, fontWeight: '600' }}>
            {horsLigne
              ? '📡 Hors ligne : prenez vos photos, l’analyse reprendra au retour du réseau.'
              : etatReseau === 'en_ligne'
                ? '📡 Connecté : l’analyse IA est disponible.'
                : '📡 Vérification du réseau…'}
          </Text>
        </View>

        {cleConfigured === false && (
          <View
            style={[styles.bandeauCle, { backgroundColor: theme.accent + '25', borderColor: theme.accent }]}
          >
            <Text style={[styles.texteCle, { color: theme.text }]}>
              Première étape : colle ta clé API Mistral dans les réglages pour activer l’analyse.
            </Text>
            <AppButton
              titre="Ouvrir les réglages"
              variante="secondaire"
              onPress={() => router.push('/settings')}
              style={styles.boutonCle}
            />
          </View>
        )}

        <AppButton
          titre="📷 Identifier un champignon"
          onPress={() => router.push('/identify')}
          style={styles.boutonPrincipal}
        />
        <AppButton
          titre="🕘 Mon historique"
          variante="secondaire"
          onPress={() => router.push('/history')}
        />
        <AppButton
          titre="⚙️ Réglages"
          variante="secondaire"
          onPress={() => router.push('/settings')}
        />

        <SafetyBanner />

        <Text style={[styles.pied, { color: theme.textMuted }]}>
          Fonctionne hors ligne : vos photos sont gardées et analysées dès le retour du réseau.
        </Text>
        <Text style={[styles.version, { color: theme.textMuted }]}>
          🍄 Champi’Recon v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: {
    padding: 24,
    paddingBottom: 48,
    gap: 14,
  },
  entete: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  emoji: { fontSize: 64 },
  titre: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  sousTitre: {
    fontSize: 15,
    marginTop: 4,
    textAlign: 'center',
  },
  bandeauReseau: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  bandeauCle: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
    gap: 10,
  },
  texteCle: {
    fontSize: 14,
    lineHeight: 19,
  },
  boutonCle: {
    alignSelf: 'flex-start',
  },
  boutonPrincipal: {
    marginTop: 12,
    paddingVertical: 18,
  },
  pied: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 16,
    lineHeight: 17,
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
    opacity: 0.7,
  },
});
