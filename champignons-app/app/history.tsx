import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { PhotoThumb } from '../components/PhotoThumb';
import { SafetyBanner } from '../components/SafetyBanner';
import { labelComestibilite, labelConfiance } from '../lib/labels';
import { chargerHistorique, viderHistorique } from '../lib/storage';
import { useAppTheme } from '../lib/theme';
import type { Identification } from '../lib/types';

function badgeStatut(item: Identification, theme: ReturnType<typeof useAppTheme>) {
  switch (item.statut) {
    case 'en_attente':
      return {
        texte: item.enAttenteHorsLigne ? '📡 En attente (hors ligne)' : '⏳ En attente',
        couleur: theme.warning,
      };
    case 'analyse':
      return { texte: '🔄 Analyse en cours', couleur: theme.primary };
    case 'erreur':
      return { texte: '❌ Erreur', couleur: theme.danger };
    case 'terminee':
      return { texte: '✅ Terminée', couleur: theme.success };
  }
}

export default function HistoryScreen() {
  const theme = useAppTheme();
  const [liste, setListe] = useState<Identification[]>([]);

  const rafraichir = useCallback(async () => {
    setListe(await chargerHistorique());
  }, []);

  useFocusEffect(
    useCallback(() => {
      rafraichir();
    }, [rafraichir]),
  );

  function vider() {
    Alert.alert('Vider l’historique', 'Supprimer définitivement toutes les identifications ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Tout supprimer',
        style: 'destructive',
        onPress: async () => {
          await viderHistorique();
          setListe([]);
        },
      },
    ]);
  }

  const enAttente = liste.filter((i) => i.statut === 'en_attente').length;

  return (
    <SafeAreaView style={[styles.fond, { backgroundColor: theme.background }]} edges={['top']}>
      <FlatList
        data={liste}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contenu}
        ListHeaderComponent={
          <>
            <Text style={[styles.titre, { color: theme.text }]}>🕘 Mon historique</Text>
            <Text style={[styles.sousTitre, { color: theme.textMuted }]}>
              {liste.length === 0
                ? 'Aucune identification pour l’instant. Photographie ton premier champignon !'
                : `${liste.length} identification(s) enregistrée(s) sur cet appareil.`}
              {enAttente > 0 ? ` ${enAttente} en attente de réseau.` : ''}
            </Text>
            {liste.length > 0 && (
              <View style={styles.ligneBoutons}>
                <AppButton
                  titre="📷 Nouvelle identification"
                  onPress={() => router.push('/identify')}
                  style={styles.boutonMoitie}
                />
                <AppButton
                  titre="🗑️ Tout vider"
                  variante="danger"
                  onPress={vider}
                  style={styles.boutonMoitie}
                />
              </View>
            )}
          </>
        }
        ListFooterComponent={<SafetyBanner />}
        renderItem={({ item }) => {
          const statut = badgeStatut(item, theme);
          const resultat = item.resultat;
          return (
            <TouchableOpacity
              style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/result?id=${item.id}`)}
              accessibilityRole="button"
            >
              <View style={styles.ligneCarte}>
                {item.photos[0] ? (
                  <PhotoThumb uri={item.photos[0]} taille={64} />
                ) : (
                  <View
                    style={[
                      styles.placeholderPhoto,
                      { backgroundColor: theme.chipBg, width: 64, height: 64, borderRadius: 12 },
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>🍄</Text>
                  </View>
                )}
                <View style={styles.infosCarte}>
                  <Text style={[styles.nom, { color: theme.text }]} numberOfLines={1}>
                    {resultat?.nom_commun ?? 'Identification en cours'}
                  </Text>
                  {resultat?.nom_scientifique ? (
                    <Text
                      style={[styles.scientifique, { color: theme.textMuted }]}
                      numberOfLines={1}
                    >
                      {resultat.nom_scientifique}
                    </Text>
                  ) : null}
                  <Text style={[styles.date, { color: theme.textMuted }]}>
                    {new Date(item.date).toLocaleString('fr-FR')}
                    {item.latitude != null ? ' · 📍' : ''}
                    {item.photos.length > 1 ? ` · ${item.photos.length} photos` : ''}
                  </Text>
                  <View style={styles.ligneBadges}>
                    <View style={[styles.badge, { backgroundColor: statut.couleur + '25' }]}>
                      <Text style={[styles.texteBadge, { color: statut.couleur }]}>{statut.texte}</Text>
                    </View>
                    {resultat && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: theme[labelConfiance(resultat.confiance).couleur] + '25' },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: theme[labelConfiance(resultat.confiance).couleur],
                          }}
                        >
                          {labelConfiance(resultat.confiance).texte}
                        </Text>
                      </View>
                    )}
                    {resultat && (
                      <View style={[styles.badge, { backgroundColor: theme.chipBg }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.text }}>
                          {labelComestibilite(resultat.comestibilite).picto}{' '}
                          {labelComestibilite(resultat.comestibilite).texte}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: {
    padding: 20,
    paddingBottom: 48,
    gap: 12,
  },
  titre: {
    fontSize: 24,
    fontWeight: '800',
  },
  sousTitre: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 6,
  },
  ligneBoutons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  boutonMoitie: {
    flex: 1,
  },
  carte: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  ligneCarte: {
    flexDirection: 'row',
    gap: 12,
  },
  placeholderPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infosCarte: {
    flex: 1,
    gap: 3,
  },
  nom: {
    fontSize: 16,
    fontWeight: '700',
  },
  scientifique: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  date: {
    fontSize: 12,
  },
  ligneBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  texteBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
});
