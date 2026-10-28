import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { SafetyBanner } from '../components/SafetyBanner';
import { chargerCleApi, sauverCleApi, supprimerCleApi } from '../lib/storage';
import { useAppTheme } from '../lib/theme';

const MODELES = ['mistral-medium-latest', 'mistral-large-latest', 'mistral-small-latest'];
const MODELE_PAR_DEFAUT = 'mistral-medium-latest';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const [cle, setCle] = useState('');
  const [modele, setModele] = useState(MODELE_PAR_DEFAUT);
  const [enregistre, setEnregistre] = useState(false);
  const [masque, setMasque] = useState(true);

  useEffect(() => {
    chargerCleApi().then((config) => {
      if (config) {
        setCle(config.cle);
        setModele(config.modele || MODELE_PAR_DEFAUT);
        setEnregistre(true);
      }
    });
  }, []);

  async function enregistrer() {
    if (!cle.trim()) {
      Alert.alert('Clé vide', 'Colle ta clé API Mistral (elle commence souvent par une longue chaîne de caractères).');
      return;
    }
    await sauverCleApi(cle.trim(), modele);
    setEnregistre(true);
    Alert.alert('✅ Enregistré', 'Ta clé API est stockée uniquement sur cet appareil.');
  }

  async function oublier() {
    Alert.alert('Oublier la clé', 'Supprimer la clé API de cet appareil ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await supprimerCleApi();
          setCle('');
          setEnregistre(false);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.fond, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={[styles.titre, { color: theme.text }]}>⚙️ Réglages</Text>

        <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.titreCarte, { color: theme.text }]}>🔑 Clé API Mistral</Text>
          <Text style={[styles.aide, { color: theme.textMuted }]}>
            Ta clé est stockée localement sur ton téléphone, jamais dans le code de l’application.
            Crée-la gratuitement (crédit offert) sur console.mistral.ai → « Clés API ».
          </Text>
          <TextInput
            style={[
              styles.champ,
              { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="Colle ta clé API ici…"
            placeholderTextColor={theme.textMuted}
            secureTextEntry={masque}
            autoCapitalize="none"
            autoCorrect={false}
            value={cle}
            onChangeText={setCle}
          />
          <View style={styles.ligneSwitch}>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>Afficher la clé</Text>
            <Switch value={!masque} onValueChange={(v) => setMasque(!v)} />
          </View>

          <Text style={[styles.aide, { color: theme.textMuted, marginTop: 8 }]}>
            Modèle de vision utilisé pour analyser les photos :
          </Text>
          {MODELES.map((m) => (
            <View key={m} style={styles.ligneModele}>
              <Text style={{ color: modele === m ? theme.primary : theme.textMuted, fontWeight: modele === m ? '700' : '400' }}>
                {m}
              </Text>
              <Switch value={modele === m} onValueChange={() => setModele(m)} />
            </View>
          ))}

          <AppButton titre="💾 Enregistrer la clé" onPress={enregistrer} style={styles.bouton} />
          {enregistre && (
            <AppButton titre="🗑️ Oublier la clé" variante="danger" onPress={oublier} />
          )}
        </View>

        <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.titreCarte, { color: theme.text }]}>ℹ️ À propos</Text>
          <Text style={[styles.aide, { color: theme.textMuted }]}>
            Champi’Recon — assistant d’identification de champignons. Chaque analyse de photos
            est envoyée à l’API Mistral (coût à l’usage, quelques centimes par analyse) et les
            résultats sont enregistrés uniquement sur cet appareil.
          </Text>
          <AppButton
            titre="Ouvrir console.mistral.ai"
            variante="secondaire"
            onPress={() => Linking.openURL('https://console.mistral.ai')}
          />
        </View>

        <SafetyBanner />

        <AppButton titre="← Retour" variante="secondaire" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
  },
  titre: {
    fontSize: 24,
    fontWeight: '800',
  },
  carte: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  titreCarte: {
    fontSize: 17,
    fontWeight: '700',
  },
  aide: {
    fontSize: 13,
    lineHeight: 18,
  },
  champ: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  ligneSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ligneModele: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bouton: {
    marginTop: 4,
  },
});
