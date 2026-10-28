import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../components/AppButton';
import { SafetyBanner } from '../components/SafetyBanner';
import {
  chargerCleApi,
  sauverCleApi,
  sauverCleKindwise,
  sauverIdentifiantsINaturalist,
  supprimerCleApi,
} from '../lib/storage';
import { INATURALIST_VERROUILLE, TEXTE_INATURALIST_VERROUILLE } from '../lib/inaturalist';
import { useAppTheme } from '../lib/theme';

const MODELES = ['mistral-medium-latest', 'mistral-large-latest', 'mistral-small-latest'];
const MODELE_PAR_DEFAUT = 'mistral-medium-latest';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const [cle, setCle] = useState('');
  const [cleKindwise, setCleKindwise] = useState('');
  const [inatAppId, setInatAppId] = useState('');
  const [inatAppSecret, setInatAppSecret] = useState('');
  const [modele, setModele] = useState(MODELE_PAR_DEFAUT);
  const [enregistre, setEnregistre] = useState(false);
  const [masque, setMasque] = useState(true);
  const [masqueKindwise, setMasqueKindwise] = useState(true);

  useEffect(() => {
    chargerCleApi().then((config) => {
      if (config) {
        setCle(config.cle);
        setCleKindwise(config.cleKindwise ?? '');
        setInatAppId(config.inatAppId ?? '');
        setInatAppSecret(config.inatAppSecret ?? '');
        setModele(config.modele || MODELE_PAR_DEFAUT);
        setEnregistre(true);
      }
    });
  }, []);

  async function enregistrer() {
    if (!cle.trim()) {
      Alert.alert('Clé vide', 'Colle ta clé API Mistral (le moteur IA Mistral ne fonctionnera pas sans).');
      return;
    }
    await sauverCleApi(
      cle.trim(),
      modele,
      cleKindwise.trim() || undefined,
      inatAppId.trim() || undefined,
      inatAppSecret.trim() || undefined,
    );
    setEnregistre(true);
    Alert.alert('✅ Enregistré', 'Tes clés API sont stockées uniquement sur cet appareil.');
  }

  async function enregistrerKindwise() {
    if (!cleKindwise.trim()) {
      Alert.alert('Clé vide', 'Colle ta clé API Kindwise (le moteur Expert Kindwise ne fonctionnera pas sans).');
      return;
    }
    await sauverCleKindwise(cleKindwise.trim());
    Alert.alert('✅ Enregistré', 'Ta clé Kindwise est stockée uniquement sur cet appareil.');
  }

  async function enregistrerINaturalist() {
    if (!inatAppId.trim() || !inatAppSecret.trim()) {
      Alert.alert(
        'Identifiants incomplets',
        'Le moteur iNaturalist a besoin d’un app_id et d’un app_secret (application OAuth2 créée sur inaturalist.org).',
      );
      return;
    }
    await sauverIdentifiantsINaturalist(inatAppId.trim(), inatAppSecret.trim());
    Alert.alert('✅ Enregistré', 'Tes identifiants iNaturalist sont stockés uniquement sur cet appareil.');
  }

  async function oublier() {
    Alert.alert('Oublier les clés', 'Supprimer les clés API de cet appareil ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await supprimerCleApi();
          setCle('');
          setCleKindwise('');
          setInatAppId('');
          setInatAppSecret('');
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
          <Text style={[styles.titreCarte, { color: theme.text }]}>🔑 Clé API Mistral (moteur « IA Mistral »)</Text>
          <Text style={[styles.aide, { color: theme.textMuted }]}>
            Stockée localement sur ton téléphone, jamais dans le code de l’application.
            Crée-la gratuitement (crédits offerts) sur console.mistral.ai → « Clés API ».
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
            Modèle de vision utilisé par le moteur Mistral :
          </Text>
          {MODELES.map((m) => (
            <View key={m} style={styles.ligneModele}>
              <Text style={{ color: modele === m ? theme.primary : theme.textMuted, fontWeight: modele === m ? '700' : '400' }}>
                {m}
              </Text>
              <Switch value={modele === m} onValueChange={() => setModele(m)} />
            </View>
          ))}

          <AppButton titre="💾 Enregistrer la clé Mistral" onPress={enregistrer} style={styles.bouton} />
        </View>

        <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.titreCarte, { color: theme.text }]}>🍄 Clé API Kindwise (moteur « Expert Kindwise »)</Text>
          <Text style={[styles.aide, { color: theme.textMuted }]}>
            Le moteur iNaturalist fonctionne sans clé. Pour Kindwise (spécialiste champignons :
            comestibilité et sosies), crée une clé gratuite sur{' '}
            mushroom.kindwise.com → « API ». Les 100 premières identifications par mois sont
            gratuites. Le moteur Mistral ne l’utilise pas.
          </Text>
          <TextInput
            style={[
              styles.champ,
              { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="Colle ta clé Kindwise ici (optionnel)…"
            placeholderTextColor={theme.textMuted}
            secureTextEntry={masqueKindwise}
            autoCapitalize="none"
            autoCorrect={false}
            value={cleKindwise}
            onChangeText={setCleKindwise}
          />
          <View style={styles.ligneSwitch}>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>Afficher la clé</Text>
            <Switch value={!masqueKindwise} onValueChange={(v) => setMasqueKindwise(!v)} />
          </View>
          <AppButton titre="💾 Enregistrer la clé Kindwise" variante="secondaire" onPress={enregistrerKindwise} />
        </View>

        <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.titreCarte, { color: theme.text }]}>
            🔬 Identifiants iNaturalist (moteur « IA iNaturalist »)
            {INATURALIST_VERROUILLE ? ' — 🔒 bientôt disponible' : ''}
          </Text>
          <Text style={[styles.aide, { color: theme.textMuted }]}>
            {INATURALIST_VERROUILLE
              ? `${TEXTE_INATURALIST_VERROUILLE} Quand tu auras créé ton application OAuth2 sur inaturalist.org (réglages du compte → Applications), colle ici ton app_id et ton app_secret : le moteur se réveillera automatiquement.`
              : 'Identifiants OAuth2 de ton application iNaturalist (app_id / app_secret).'}
          </Text>
          <TextInput
            style={[
              styles.champ,
              { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="app_id iNaturalist…"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={inatAppId}
            onChangeText={setInatAppId}
          />
          <TextInput
            style={[
              styles.champ,
              { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="app_secret iNaturalist…"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={inatAppSecret}
            onChangeText={setInatAppSecret}
          />
          <AppButton
            titre="💾 Enregistrer les identifiants iNaturalist"
            variante="secondaire"
            onPress={enregistrerINaturalist}
          />
          <AppButton
            titre="🌿 Ouvrir inaturalist.org"
            variante="secondaire"
            onPress={() => Linking.openURL('https://www.inaturalist.org')}
          />
        </View>

        {enregistre && (
          <AppButton titre="🗑️ Oublier les clés API" variante="danger" onPress={oublier} />
        )}

        <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.titreCarte, { color: theme.text }]}>ℹ️ À propos</Text>
          <Text style={[styles.aide, { color: theme.textMuted }]}>
            Champi’Recon — assistant d’identification de champignons à 3 moteurs :
            IA Mistral (fiche mycologue), iNaturalist (vision communautaire, gratuit sans clé) et
            Kindwise (spécialiste champignons). Les résultats sont enregistrés uniquement sur cet
            appareil. Chaque analyse peut coûter quelques centimes selon le moteur.
          </Text>
          <AppButton
            titre="Ouvrir console.mistral.ai"
            variante="secondaire"
            onPress={() => Linking.openURL('https://console.mistral.ai')}
          />
          <AppButton
            titre="Obtenir une clé Kindwise (gratuit)"
            variante="secondaire"
            onPress={() => Linking.openURL('https://mushroom.kindwise.com/api')}
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
