#!/usr/bin/env bash
# Frontend FRANCAIS du Meal Planner - a lancer DANS la VM Home Assistant
set -e
RAW="https://raw.githubusercontent.com/bazouu042/maison-blaise-ha/main/meal-planner-fr"
FE="/config/custom_components/meal_planner/frontend"

echo "1/4 Conteneur Home Assistant..."
HA=$(docker ps --format '{{.Names}}' | grep -iE 'home.?assistant' | head -1)
[ -z "$HA" ] && { echo "ERREUR: conteneur HA introuvable"; exit 1; }
echo "   Trouve : $HA"

echo "2/4 Frontend Meal Planner present ?"
docker exec "$HA" test -f "$FE/index.html" || { echo "ERREUR: frontend introuvable"; exit 1; }

echo "3/4 Sauvegarde (*.avant-fr) puis patch en francais..."
docker exec "$HA" sh -c "test -f $FE/index.html.avant-fr || cp $FE/index.html $FE/index.html.avant-fr"
docker exec "$HA" sh -c "test -f $FE/meal-planner-card.js.avant-fr || cp $FE/meal-planner-card.js $FE/meal-planner-card.js.avant-fr"
curl -sL "$RAW/patch_fr.py" | docker exec -i "$HA" python3 - "$FE"

echo "4/4 Redemarrage de Home Assistant (1-2 min)..."
docker restart "$HA" >/dev/null
echo ""
echo "C EST FAIT ! Recharge la page (Ctrl+F5) et ouvre Meal Planner :)"