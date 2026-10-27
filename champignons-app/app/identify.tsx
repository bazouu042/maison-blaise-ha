import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { AppButton } from '../components/AppButton';
import { PhotoThumb } from '../components/PhotoThumb';
import { SafetyBanner } from '../components/SafetyBanner';
import { QUESTIONS_HORS_LIGNE } from '../lib/labels';
import { analyserChampignon } from '../lib/mistral';
import { getEtatReseau, verifierReseau } from '../lib/network';
import {
  ajouterIdentification,
  chargerCleApi,
  mettreAJourIdentification,
} from '../lib/storage';
import { useAppTheme } from '../lib/theme';
import type { Identification, ReponseMycologue } from '../lib/types';

function nouvelId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function IdentifyScreen() {
  const theme = useAppTheme();
  const [photos, setPhotos] = useState<string[]>([]);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<string[]>([]);
  const [chargement, setChargement] = useState(false);
  const [etape, setEtape] = useState<'photos' | 'questions' | 'envoi'>('photos');
  const [avecGps, setAvecGps] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const photosPrises = useMemo(() => photos, [photos]);

  async function prendrePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission refusée', 'L’accès à la caméra est nécessaire pour photographier un champignon.');
      return;
    }
    const resultat = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });
    if (!resultat.canceled && resultat.assets[0]) {
      setPhotos((p) => [...p, resultat.assets[0].uri]);
    }
  }

  async function choisirGalerie() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission refusée', 'L’accès à la galerie est nécessaire pour importer une photo.');
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 8,
    });
    if (!resultat.canceled) {
      setPhotos((p) => [...p, ...resultat.assets.map((a) => a.uri)].slice(0, 8));
    }
  }

  async function activerGps() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'La localisation restera désactivée pour cette identification.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    setAvecGps(true);
  }

  async function lancerAnalyse(questionsRepondues: Record<string, string>, photosFinales: string[]) {
    setChargement(true);
    setEtape('envoi');
    const id = nouvelId();
    const identification: Identification = {
      id,
      date: new Date().toISOString(),
      photos: photosFinales,
      reponsesUtilisateur: questionsRepondues,
      statut: 'en_attente',
      enAttenteHorsLigne: false,
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
    };
    await ajouterIdentification(identification);

    const cleApi = await chargerCleApi();
    if (!cleApi?.cle) {
      Alert.alert(
        'Clé API manquante',
        'Colle ta clé API Mistral dans les réglages. En attendant, retrouve cette identification dans l’historique.',
        [{ text: 'OK' }, { text: 'Réglages', onPress: () => router.push('/settings') }],
      );
      setChargement(false);
      router.push('/history');
      return;
    }

    const enLigne = getEtatReseau() === 'en_ligne' ? true : await verifierReseau();
    if (!enLigne) {
      identification.enAttenteHorsLigne = true;
      await mettreAJourIdentification(identification);
      Alert.alert(
        '📡 Mode hors ligne',
        questionsRepondues && Object.keys(questionsRepondues).length > 0
          ? 'Pas de réseau : tes photos et tes réponses sont enregistrées. L’analyse reprendra automatiquement au retour du réseau.'
          : 'Pas de réseau : tes photos sont enregistrées. Tu peux aussi répondre au questionnaire du mycologue ci-dessous, puis l’analyse reprendra automatiquement au retour du réseau.',
      );
      if (Object.keys(questionsRepondues).length === 0) {
        setQuestions(QUESTIONS_HORS_LIGNE);
        setEtape('questions');
      } else {
        setChargement(false);
        router.push('/history');
      }
      return;
    }

    identification.statut = 'analyse';
    await mettreAJourIdentification(identification);
    try {
      const { resultat } = await analyserChampignon(
        cleApi.cle,
        cleApi.modele,
        photosFinales.map((uri) => ({ uri })),
        questionsRepondues,
      );
      identification.resultat = resultat;
      identification.statut = 'terminee';
      await mettreAJourIdentification(identification);
      if (
        (resultat.confiance === 'faible' || resultat.confiance === 'moyenne') &&
        resultat.questions_supplementaires.length > 0 &&
        Object.keys(questionsRepondues).length === 0
      ) {
        setQuestions(resultat.questions_supplementaires);
        setEtape('questions');
        setChargement(false);
        Alert.alert(
          '🔍 Photos insuffisantes',
          'L’IA hésite. Réponds à quelques questions pour affiner l’identification, ou consulte le résultat provisoire dans l’historique.',
          [{ text: 'Répondre aux questions' }, { text: 'Voir le résultat provisoire', onPress: () => router.push(`/result?id=${id}`) }],
        );
      } else {
        setChargement(false);
        router.push(`/result?id=${id}`);
      }
    } catch (erreur) {
      identification.statut = 'erreur';
      identification.erreur = erreur instanceof Error ? erreur.message : String(erreur);
      await mettreAJourIdentification(identification);
      setChargement(false);
      Alert.alert('Erreur d’analyse', identification.erreur);
      router.push('/history');
    }
  }

  function envoyerDepuisPhotos() {
    if (photosPrises.length === 0) {
      Alert.alert('Aucune photo', 'Ajoute au moins une photo du champignon.');
      return;
    }
    void lancerAnalyse({}, photosPrises);
  }

  function envoyerDepuisQuestions() {
    void lancerAnalyse(reponses, photosPrises);
  }

  const questionsAffichees = questions;

  return (
    <SafeAreaView style={[styles.fond, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={[styles.titre, { color: theme.text }]}>
          {etape === 'photos' ? '📷 Photographie le champignon' : '❓ Questions du mycologue'}
        </Text>
        <Text style={[styles.aide, { color: theme.textMuted }]}>
          {etape === 'photos'
            ? 'Prends plusieurs photos du même champignon : chapeau de dessus, dessous (lames), pied, et lieu de pousse. Jusqu’à 8 photos.'
            : 'L’IA a besoin d’infos complémentaires. Réponds à ces questions, puis relance l’analyse avec tes réponses.'}
        </Text>

        {etape === 'photos' && (
          <>
            <View style={styles.ligneBoutons}>
              <AppButton titre="📸 Appareil photo" onPress={prendrePhoto} style={styles.boutonMoitie} />
              <AppButton
                titre="🖼️ Galerie"
                variante="secondaire"
                onPress={choisirGalerie}
                style={styles.boutonMoitie}
              />
            </View>

            {photosPrises.length > 0 && (
              <View style={styles.grillePhotos}>
                {photosPrises.map((uri, index) => (
                  <PhotoThumb
                    key={uri + index}
                    uri={uri}
                    onSupprimer={() => setPhotos((p) => p.filter((_, i) => i !== index))}
                  />
                ))}
              </View>
            )}

            <AppButton
              titre={avecGps ? '📍 Lieu enregistré' : '📍 Ajouter le lieu (GPS)'}
              variante="secondaire"
              onPress={activerGps}
              desactive={avecGps}
            />
            {avecGps && coords && (
              <Text style={[styles.gps, { color: theme.textMuted }]}>
                Position : {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </Text>
            )}

            <AppButton
              titre={chargement ? 'Analyse en cours…' : '🍄 Lancer l’analyse IA'}
              onPress={envoyerDepuisPhotos}
              chargement={chargement}
              desactive={chargement}
              style={styles.boutonLancer}
            />
          </>
        )}

        {etape === 'questions' && (
          <>
            {photosPrises.length > 0 && (
              <View style={styles.grillePhotos}>
                {photosPrises.map((uri, index) => (
                  <PhotoThumb key={uri + index} uri={uri} taille={64} />
                ))}
              </View>
            )}
            {questionsAffichees.map((question, index) => (
              <View key={index} style={styles.blocQuestion}>
                <Text style={[styles.question, { color: theme.text }]}>
                  {index + 1}. {question}
                </Text>
                <TextInput
                  style={[
                    styles.champ,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Ta réponse…"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  value={reponses[question] ?? ''}
                  onChangeText={(texte) =>
                    setReponses((r) => ({ ...r, [question]: texte }))
                  }
                />
              </View>
            ))}
            <AppButton
              titre={chargement ? 'Nouvelle analyse…' : '🔄 Relancer l’analyse avec mes réponses'}
              onPress={envoyerDepuisQuestions}
              chargement={chargement}
              desactive={chargement}
              style={styles.boutonLancer}
            />
            <AppButton
              titre="Annuler et revenir à l’accueil"
              variante="secondaire"
              onPress={() => router.back()}
            />
          </>
        )}

        {etape === 'envoi' && chargement && (
          <View style={styles.blocChargement}>
            <Text style={[styles.texteChargement, { color: theme.textMuted }]}>
              🍄 Le mycologue IA examine tes photos… Cela peut prendre quelques secondes.
            </Text>
          </View>
        )}

        <SafetyBanner />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  contenu: {
    padding: 20,
    paddingBottom: 48,
    gap: 14,
  },
  titre: {
    fontSize: 22,
    fontWeight: '800',
  },
  aide: {
    fontSize: 14,
    lineHeight: 19,
  },
  ligneBoutons: {
    flexDirection: 'row',
    gap: 10,
  },
  boutonMoitie: {
    flex: 1,
  },
  grillePhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gps: {
    fontSize: 12,
    textAlign: 'center',
  },
  boutonLancer: {
    marginTop: 6,
    paddingVertical: 16,
  },
  blocQuestion: {
    gap: 6,
  },
  question: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  champ: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    minHeight: 44,
  },
  blocChargement: {
    paddingVertical: 24,
  },
  texteChargement: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
});
