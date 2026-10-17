import re, sys, os
FE = sys.argv[1] if len(sys.argv) > 1 else "/config/custom_components/meal_planner/frontend"

FR_PANEL = r'''{
      today: 'Aujourd\'hui',
      notPlanned: 'Non prévu',
      manageDishes: 'Gérer la liste des plats',
      downloadHistory: 'Historique en CSV',
      currentlyPlanned: 'Prévu ce jour',
      change: 'Changer',
      delete: 'Supprimer',
      moveSwap: '↔ Déplacer / échanger',
      moveTitle: 'Déplacer / échanger',
      moveHint: 'Choisis un jour cible : jour libre = déplacer, jour occupé = échanger.',
      moveCurrent: 'Ce jour',
      moveEmpty: 'libre',
      suggestionsLabel: 'Suggestions (les moins récemment cuisinés)',
      loadingSuggestions: 'Chargement des suggestions…',
      noMoreSuggestions: 'Plus de suggestions – utilisez la saisie libre.',
      lastCooked: 'Dernier :',
      neverCooked: 'Jamais cuisiné',
      accept: 'Prendre',
      acceptTitle: 'Planifier ce jour',
      notToday: 'Pas aujourd\'hui',
      notTodayTitle: 'Passer la suggestion (elle reviendra bientôt)',
      block: '2 semaines non',
      blockTitle: 'Ne pas proposer ce plat pendant 2 semaines',
      quickSelect: 'Sélection rapide',
      nothing: 'Pas de cuisson',
      eatingOut: 'Restaurant',
      order: 'Livraison',
      specialLabelPlaceholder: 'Où ? (facultatif)',
      surpriseMe: 'Surprenez-moi !',
      surpriseLoading: 'Chargement de la recette…',
      viewRecipe: 'Voir la recette →',
      ownEntry: 'Saisie libre',
      ownEntryPlaceholder: 'Nom du plat…',
      dishPickerPlaceholder: 'Choisir dans la liste…',
      addToListLabel: 'Ajouter à la liste des plats',
      addToList: 'à la liste',
      save: 'Enregistrer',
      type_dish: 'Cuisson',
      type_custom: 'Cuisson',
      type_eating_out: 'Restaurant',
      type_order: 'Livraison',
      type_nothing: 'Pas de cuisson',
      dishManagerTitle: 'Liste des plats',
      newDishPlaceholder: 'Nouveau plat…',
      add: '+ Ajouter',
      noDishes: 'Aucun plat pour l\'instant.',
      searchDishes: 'Rechercher un plat…',
      clearSearch: 'Effacer la recherche',
      searchCount: (n, total) => `${n} sur ${total} plats`,
      noSearchResults: 'Aucun plat ne correspond à la recherche.',
      renameDish: 'Renommer (photo et historique conservés)',
      renameNeedsRestart: 'Home Assistant doit encore être redémarré après la mise à jour.',
      deleteDish: 'Supprimer le plat',
      blockedUntil: 'Bloqué jusqu\'au :',
      unblock: 'Débloquer',
      tabList: 'Liste',
      tabBulk: 'Édition en bloc',
      addPhoto: 'Ajouter une photo',
      changePhoto: 'Changer la photo',
      removePhoto: 'Retirer la photo',
      photoAppliesTo: 'S\'applique à :',
      tabPlaces: 'Resto & livraisons',
      placesHint: 'Une photo s\'applique à chaque jour portant ce nom. La photo par défaut s\'affiche les jours sans nom ni photo propre.',
      placeDefault: 'sans nom',
      placeDefaultLong: 'Photo par défaut (sans nom)',
      placeDefaultHint: 'Pour les jours sans nom ni photo propre',
      lastVisit: 'Dernier :',
      notVisitedYet: 'Pas encore visité',
      placesNeedRestart: 'Home Assistant doit encore être redémarré après la mise à jour pour pouvoir définir des photos ici.',
      cropTitle: 'Choisis le cadrage',
      cropHint: 'Fais glisser le cadre pour le déplacer, les coins pour le redimensionner, molette ou pincement pour zoomer.',
      cropSquare: 'Carré',
      cropFree: 'Libre',
      cropRotateLeft: 'Pivoter à gauche',
      cropRotateRight: 'Pivoter à droite',
      cropSave: 'Recadrer & enregistrer',
      cropSaving: 'Enregistrement…',
      imageEncodeFailed: 'Impossible de traiter l\'image.',
      imageReadFailed: 'Ce fichier n\'est pas une image lisible.',
      bulkHint: 'Un plat par ligne. Les nouvelles lignes sont ajoutées, les lignes retirées sont supprimées. Historique et blocages conservés. Un nom modifié ici compte comme un nouveau plat et perd sa photo et ses statistiques. Pour renommer, utilise ✏️ dans la liste.',
      bulkPlaceholder: 'Spaghetti bolognaise\\nCurry de poulet\\n…',
      bulkSave: 'Enregistrer',
      cancel: 'Annuler',
      errorPrefix: 'Erreur : ',
      errorNoRecipes: 'Aucune recette trouvée',
      confirmDeleteAllDishes: 'Vraiment supprimer tous les plats ?',
      confirmDeleteDish: 'Vraiment supprimer ce plat ?',
      dishAlreadyExists: 'Ce plat existe déjà.',
      statistics: 'Statistiques',
      statsTitle: 'Statistiques de cuisine',
      statsColDish: 'Plat',
      statsColPlace: 'Où',
      statsColCount: 'Fréquence',
      statsColLast: 'Dernier',
      statsCooked: 'Cuisinés',
      statsEatingOut: 'Restaurants',
      statsOrdered: 'Livraisons',
      statsNoCooking: 'Pas de cuisson',
      statsTotalDays: 'Jours planifiés',
      statsNoData: 'Pas encore de données.',
      weekdays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      weekdaysLong: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
      months: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
      kwPrefix: 'S',
    }'''

FR_CARD = r'''{
    weekdays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    notPlanned: 'Non prévu',
    eatingOut: 'Restaurant',
    order: 'Livraison',
    nothing: 'Pas de cuisson',
    today: 'Aujourd\'hui',
    tomorrow: 'Demain',
    inDays: n => `dans ${n} jours`,
    nothingUpcoming: 'Rien de prévu pour l\'instant',
  }'''

def remplacer(contenu, entete_re, bloc_fr, marqueur):
    m = re.search(entete_re, contenu)
    if not m:
        sys.exit("ERREUR: bloc " + marqueur + " introuvable (deja traduit ?)")
    start = contenu.find("{", m.end() - 1)
    depth, i, ins = 0, start, None
    while i < len(contenu):
        c = contenu[i]
        if ins:
            if c == "\\":
                i += 2
                continue
            if c == ins:
                ins = None
        else:
            if c in ("'", '"', "`"):
                ins = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    break
        i += 1
    ancien = contenu[start:i+1]
    if marqueur not in ancien:
        sys.exit("ERREUR: bloc " + marqueur + " inattendu")
    return contenu[:start] + bloc_fr + contenu[i+1:]

p1 = os.path.join(FE, "index.html")
html = open(p1, encoding="utf-8").read()
if "Aujourd" in html:
    print("Panel deja en francais, rien a faire")
else:
    html = remplacer(html, r"const STRINGS_EN\s*=\s*", FR_PANEL, "Today")
    open(p1, "w", encoding="utf-8").write(html)
    print("Panel francise OK")

p2 = os.path.join(FE, "meal-planner-card.js")
js = open(p2, encoding="utf-8").read()
if "Non prevu" in js or "Non pr\u00e9vu" in js:
    print("Carte deja en francais, rien a faire")
else:
    js = remplacer(js, r"\ben\s*:\s*\{", FR_CARD, "notPlanned")
    open(p2, "w", encoding="utf-8").write(js)
    print("Carte dashboard francisee OK")