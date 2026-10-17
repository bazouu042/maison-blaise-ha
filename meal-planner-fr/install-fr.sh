#!/usr/bin/env bash
# Frontend FRANCAIS du Meal Planner
# Compatible : Home Assistant OS (VM), Supervised, ou HA sous Docker
set -e
RAW="https://raw.githubusercontent.com/bazouu042/maison-blaise-ha/main/meal-planner-fr"

patch_awk() {
  file="$1"; start="$2"; frfile="$3"; marker="$4"
  awk -v start="$start" -v frfile="$frfile" -v marker="$marker" '
    function countb(s,  t, o, c) { t = s; o = gsub(/{/, "{", t); t = s; c = gsub(/}/, "}", t); return o - c }
    BEGIN { state = 0; depth = 0; n = 0 }
    state == 0 {
      if (match($0, start)) {
        prefix = substr($0, 1, RSTART + RLENGTH - 1)
        rest = substr($0, RSTART + RLENGTH)
        delete buf; n = 0; buf[++n] = rest; depth = countb(rest)
        state = 1
        next
      }
      print; next
    }
    state == 1 {
      buf[++n] = $0
      depth += countb($0)
      if (depth <= 0 && buf[1] != "") {
        has = 0
        for (i = 1; i <= n; i++) if (index(buf[i], marker) > 0) { has = 1; break }
        print prefix
        if (has) {
          while ((getline line < frfile) > 0) print line
          close(frfile)
          cl = buf[n]; t = cl; sub(/^.*}/, "", t); print t
        } else {
          for (i = 1; i <= n; i++) print buf[i]
        }
        state = 0
      }
      next
    }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}

echo "1/5 Detection de l installation..."

# ---- Cas 1 : HA sous Docker ----
if command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
  HA=$(docker ps --format '{{.Names}}' | grep -iE 'home.?assistant' | head -1)
  if [ -n "$HA" ]; then
    echo "   Conteneur Docker : $HA"
    FE=/config/custom_components/meal_planner/frontend
    docker exec "$HA" test -f "$FE/index.html" || { echo "ERREUR: frontend introuvable"; exit 1; }
    docker exec "$HA" sh -c "test -f $FE/index.html.avant-fr || cp $FE/index.html $FE/index.html.avant-fr"
    docker exec "$HA" sh -c "test -f $FE/meal-planner-card.js.avant-fr || cp $FE/meal-planner-card.js $FE/meal-planner-card.js.avant-fr"
    echo "   Patch..."
    curl -sL "$RAW/patch_fr.py" | docker exec -i "$HA" python3 - "$FE"
    echo "   Redemarrage..."
    docker restart "$HA" >/dev/null
    echo ""
    echo "C EST FAIT ! Ctrl+F5 puis Meal Planner :)"
    exit 0
  fi
fi

# ---- Cas 2 : Home Assistant OS ou Supervised ----
CFG=""
[ -d /mnt/data/supervisor/homeassistant ] && CFG=/mnt/data/supervisor/homeassistant
[ -z "$CFG" ] && [ -d /usr/share/hassio/homeassistant ] && CFG=/usr/share/hassio/homeassistant
if [ -n "$CFG" ]; then
  echo "   Home Assistant OS / Supervised detecte : $CFG"
  FE="$CFG/custom_components/meal_planner/frontend"
  [ -f "$FE/index.html" ] || { echo "ERREUR: $FE introuvable"; exit 1; }
  echo "   Sauvegarde (*.avant-fr)..."
  [ -f "$FE/index.html.avant-fr" ] || cp "$FE/index.html" "$FE/index.html.avant-fr"
  [ -f "$FE/meal-planner-card.js.avant-fr" ] || cp "$FE/meal-planner-card.js" "$FE/meal-planner-card.js.avant-fr"
  if command -v python3 >/dev/null 2>&1; then
    echo "   Patch via python3..."
    curl -sL "$RAW/patch_fr.py" -o /tmp/patch_fr.py
    python3 /tmp/patch_fr.py "$FE"
  else
    echo "   python3 absent : methode awk..."
    curl -sL "$RAW/fr_panel.txt" -o /tmp/fr_panel.txt
    curl -sL "$RAW/fr_card.txt" -o /tmp/fr_card.txt
    patch_awk "$FE/index.html" 'const STRINGS_EN[ ]*=[ ]*' /tmp/fr_panel.txt "Today"
    patch_awk "$FE/meal-planner-card.js" '(^|[^A-Za-z0-9_])en[ ]*:[ ]*' /tmp/fr_card.txt "notPlanned"
    grep -q "Aujourd" "$FE/index.html" || { echo "ERREUR: patch awk a echoue"; exit 1; }
  fi
  echo "   Redemarrage de Home Assistant (1-2 min)..."
  command -v ha >/dev/null 2>&1 && ha core restart
  echo ""
  echo "C EST FAIT ! Ctrl+F5 puis Meal Planner :)"
  exit 0
fi

echo "ERREUR: environnement non reconnu. Previens le chat avec une capture."
exit 1
