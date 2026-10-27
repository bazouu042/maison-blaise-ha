import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { PhotoThumb } from '../components/PhotoThumb';
import { SafetyBanner } from '../components/SafetyBanner';
import { labelComestibilite } from '../lib/labels';
import { chargerHistorique, supprimerIdentification } from '../lib/storage';
import { useAppTheme } from '../lib/theme';
import type { Identification } from '../lib/types';

export default function ResultScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [identification, setIdentification] = useState<Identification | null>(null);

  const rafraichir = useCallback(async () => {
    const liste = await chargerHistorique();
    setIdentification(liste.find((item) => item.id === id) ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      rafraichir();
    }, [rafraichir]),
  );

  if (!identification) {
    return (
      <SafeAreaView style={[styles.fond, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.centre}>
          <Text style={{ color: theme.textMuted }}>Identification introuvable.</Text>
          <AppButton titre="Retour" onPress={() => router.push('/history')} />
        </View>
      </SafeAreaView>
    );
  }

  const resultat = identification.resultat;
  const date = new Date(identification.date).toLocaleString('fr-FR');

  async function supprimer() {
    Alert.alert('Supprimer', 'Supprimer cette identification de l’historique ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await supprimerIdentification(String(id));
          router.push('/history');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.fond, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={[styles.titre, { color: theme.text }]}>🍄 Fiche d’identification</Text>
        <Text style={[styles.date, { color: theme.textMuted }]}>{date}</Text>

        {identification.photos.length > 0 && (
          <View style={styles.grillePhotos}>
            {identification.photos.map((uri, index) => (
              <PhotoThumb key={uri + index} uri={uri} taille={96} />
            ))}
          </View>
        )}

        {identification.latitude != null && identification.longitude != null && (
          <Text style={[styles.gps, { color: theme.textMuted }]}>
            📍 {identification.latitude.toFixed(5)}, {identification.longitude.toFixed(5)}
          </Text>
        )}

        {identification.statut === 'en_attente' && (
          <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>⏳ En attente</Text>
            <Text style={{ color: theme.textMuted, marginTop: 6, lineHeight: 19 }}>
              {identification.enAttenteHorsLigne
                ? '📡 Hors ligne : l’analyse reprendra automatiquement au retour du réseau.'
                : 'Analyse en cours…'}
            </Text>
          </View>
        )}

        {identification.statut === 'erreur' && (
          <View style={[styles.carte, { backgroundColor: theme.danger + '18', borderColor: theme.danger }]}>
            <Text style={{ color: theme.danger, fontWeight: '700' }}>❌ Erreur d’analyse</Text>
            <Text style={{ color: theme.textMuted, marginTop: 6, lineHeight: 19 }}>
              {identification.erreur ?? 'Une erreur est survenue.'}
            </Text>
          </View>
        )}

        {resultat && (
          <>
            <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.nomCommun, { color: theme.text }]}>{resultat.nom_commun}</Text>
              <Text style={[styles.nomScientifique, { color: theme.textMuted }]}>
                {resultat.nom_scientifique}
              </Text>
              <View style={styles.ligneBadges}>
                <ConfidenceBadge confiance={resultat.confiance} />
              </View>
              <View
                style={[
                  styles.badgeComestibilite,
                  {
                    backgroundColor:
                      resultat.comestibilite === 'mortel' || resultat.comestibilite === 'toxique'
                        ? theme.danger + '25'
                        : resultat.comestibilite.startsWith('comestible')
                          ? theme.success + '25'
                          : theme.warning + '25',
                  },
                ]}
              >
                <Text style={{ fontSize: 16 }}>
                  {labelComestibilite(resultat.comestibilite).picto}
                </Text>
                <Text
                  style={{
                    fontWeight: '700',
                    color:
                      resultat.comestibilite === 'mortel' || resultat.comestibilite === 'toxique'
                        ? theme.danger
                        : theme.text,
                    flex: 1,
                  }}
                >
                  {labelComestibilite(resultat.comestibilite).texte}
                </Text>
              </View>
            </View>

            {resultat.description ? (
              <SectionCarte theme={theme} titre="📝 Description" texte={resultat.description} />
            ) : null}
            {resultat.habitat ? (
              <SectionCarte theme={theme} titre="🌲 Habitat" texte={resultat.habitat} />
            ) : null}
            {resultat.saison ? (
              <SectionCarte theme={theme} titre="🍂 Saison" texte={resultat.saison} />
            ) : null}

            {resultat.confusions.length > 0 && (
              <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.titreCarte, { color: theme.text }]}>
                  ⚠️ Confusions possibles
                </Text>
                {resultat.confusions.map((confusion, index) => (
                  <Text key={index} style={[styles.puce, { color: theme.textMuted }]}>
                    • {confusion}
                  </Text>
                ))}
              </View>
            )}

            {resultat.questions_supplementaires.length > 0 && (
              <View style={[styles.carte, { backgroundColor: theme.accent + '18', borderColor: theme.accent }]}>
                <Text style={[styles.titreCarte, { color: theme.text }]}>
                  ❓ Pour affiner l’identification
                </Text>
                {resultat.questions_supplementaires.map((question, index) => (
                  <Text key={index} style={[styles.puce, { color: theme.textMuted }]}>
                    {index + 1}. {question}
                  </Text>
                ))}
                <AppButton
                  titre="Reprendre une photo et répondre"
                  variante="secondaire"
                  onPress={() => router.push('/identify')}
                  style={styles.boutonCarte}
                />
              </View>
            )}
          </>
        )}

        <SafetyBanner />

        <AppButton titre="🗑️ Supprimer cette identification" variante="danger" onPress={supprimer} />
        <AppButton titre="← Retour à l’historique" variante="secondaire" onPress={() => router.push('/history')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCarte({
  theme,
  titre,
  texte,
}: {
  theme: ReturnType<typeof useAppTheme>;
  titre: string;
  texte: string;
}) {
  return (
    <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.titreCarte, { color: theme.text }]}>{titre}</Text>
      <Text style={[styles.texteCarte, { color: theme.textMuted }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: {
    padding: 20,
    paddingBottom: 48,
    gap: 14,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  titre: {
    fontSize: 22,
    fontWeight: '800',
  },
  date: {
    fontSize: 13,
  },
  grillePhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gps: {
    fontSize: 12,
  },
  carte: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  nomCommun: {
    fontSize: 24,
    fontWeight: '800',
  },
  nomScientifique: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  ligneBadges: {
    marginTop: 2,
  },
  badgeComestibilite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  titreCarte: {
    fontSize: 16,
    fontWeight: '700',
  },
  texteCarte: {
    fontSize: 14,
    lineHeight: 20,
  },
  puce: {
    fontSize: 14,
    lineHeight: 20,
  },
  boutonCarte: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
});
