import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { META_MOTEURS } from '../lib/labels';
import type { ResultatMoteur } from '../lib/types';
import { useAppTheme } from '../lib/theme';

interface Props {
  resultat: ResultatMoteur;
}

export function MoteurCard({ resultat }: Props) {
  const theme = useAppTheme();
  const meta = META_MOTEURS[resultat.moteur];

  return (
    <View style={[styles.carte, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.entete}>
        <Text style={[styles.titre, { color: theme.text }]}>
          {meta.icone} {meta.titre}
        </Text>
        <View
          style={[
            styles.pastille,
            { backgroundColor: resultat.succes ? theme.success + '25' : theme.danger + '25' },
          ]}
        >
          <Text
            style={{
              color: resultat.succes ? theme.success : theme.danger,
              fontSize: 11,
              fontWeight: '700',
            }}
          >
            {resultat.succes ? 'OK' : 'Échec'}
          </Text>
        </View>
      </View>

      {!resultat.succes && resultat.erreur && (
        <Text style={[styles.erreur, { color: theme.danger }]}>❌ {resultat.erreur}</Text>
      )}

      {resultat.succes && resultat.hypotheses.length === 0 && (
        <Text style={[styles.neutre, { color: theme.textMuted }]}>
          Aucune suggestion pour ce moteur.
        </Text>
      )}

      {resultat.hypotheses.map((hyp, index) => (
        <View key={index} style={[styles.hyp, { borderTopColor: theme.border }]}>
          <View style={styles.ligneHyp}>
            <Text style={[styles.nomScientifique, { color: theme.text }]} numberOfLines={1}>
              {index === 0 ? '★ ' : ''}
              {hyp.nomScientifique}
            </Text>
            <View style={[styles.badgeScore, { backgroundColor: meta.couleur + '25' }]}>
              <Text style={[styles.score, { color: meta.couleur }]}>{hyp.score} %</Text>
            </View>
          </View>
          {hyp.nomCommun ? (
            <Text style={[styles.nomCommun, { color: theme.textMuted }]}>{hyp.nomCommun}</Text>
          ) : null}
          {hyp.comestibilite ? (
            <Text
              style={{
                color:
                  hyp.niveauComestibilite === 'danger'
                    ? theme.danger
                    : hyp.niveauComestibilite === 'attention'
                      ? theme.warning
                      : hyp.niveauComestibilite === 'ok'
                        ? theme.success
                        : theme.textMuted,
                fontWeight: '600',
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {hyp.pictoComestibilite} {hyp.comestibilite}
            </Text>
          ) : null}
          {hyp.sosies && hyp.sosies.length > 0 ? (
            <Text style={[styles.sosies, { color: theme.textMuted }]}>
              ⚠️ Sosies possibles : {hyp.sosies.join(', ')}
            </Text>
          ) : null}
          {hyp.lien ? (
            <TouchableOpacity onPress={() => Linking.openURL(hyp.lien!)}>
              <Text style={[styles.lien, { color: theme.primaryLight }]}>🔗 Voir sur le web</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      {resultat.note ? (
        <Text style={[styles.note, { color: theme.textMuted }]}>{resultat.note}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titre: {
    fontSize: 16,
    fontWeight: '800',
  },
  pastille: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  erreur: {
    fontSize: 13,
    lineHeight: 18,
  },
  neutre: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  hyp: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 3,
  },
  ligneHyp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nomScientifique: {
    fontSize: 15,
    fontWeight: '700',
    fontStyle: 'italic',
    flex: 1,
  },
  badgeScore: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  score: {
    fontSize: 12,
    fontWeight: '800',
  },
  nomCommun: {
    fontSize: 13,
  },
  sosies: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  lien: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    borderTopWidth: 1,
    paddingTop: 8,
  },
});
