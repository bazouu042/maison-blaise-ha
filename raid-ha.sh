#!/bin/bash
# Etat du RAID md0 -> Home Assistant (cree les entites via API)
# v3 (08/11/2026) : montage reel du RAID lu dans /proc/mounts (findmnt absent de ZimaOS)
TOKEN=$(cat /DATA/.ha-token 2>/dev/null)
[ -z "$TOKEN" ] && exit 0
HA="http://192.168.1.187:8123"
MD=$(cat /proc/mdstat)
ETAT=$(echo "$MD" | grep -oE '\[[U_]+\]' | head -1)
[ -z "$ETAT" ] && ETAT="[?]"
if echo "$ETAT" | grep -q '_'; then SANTE=off; else SANTE=on; fi
# Point de montage REEL du RAID : /dev/md0 dans /proc/mounts (source de verite du noyau)
MNT=$(awk '$1=="/dev/md0"{print $2; exit}' /proc/mounts)
if [ -n "$MNT" ] && df "$MNT" >/dev/null 2>&1; then
  L=$(df -BG --output=avail "$MNT" 2>/dev/null | tail -1 | tr -dc '0-9')
  P=$(df -P "$MNT" 2>/dev/null | tail -1 | awk '{print $5}' | tr -dc '0-9')
else
  MNT=""
  L=0
  P=0
fi
[ -z "$L" ] && L=0
[ -z "$P" ] && P=0
post() { curl -s -m 10 -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$HA/api/states/$1" >/dev/null 2>&1; }
post binary_sensor.raid_md0_sante "{\"state\":\"$SANTE\",\"attributes\":{\"friendly_name\":\"Raid md0 sain\",\"icon\":\"mdi:nas\",\"point_montage\":\"$MNT\",\"disques\":\"$ETAT\"}}"
post sensor.raid_md0_disques "{\"state\":\"$ETAT\",\"attributes\":{\"friendly_name\":\"Raid md0 disques\",\"icon\":\"mdi:harddisk\"}}"
post sensor.stockage_raid_libre "{\"state\":\"$L\",\"attributes\":{\"friendly_name\":\"Stockage raid libre\",\"unit_of_measurement\":\"Go\",\"state_class\":\"measurement\",\"icon\":\"mdi:harddisk-plus\",\"point_montage\":\"$MNT\"}}"
post sensor.stockage_raid_utilisation "{\"state\":\"$P\",\"attributes\":{\"friendly_name\":\"Stockage raid utilise\",\"unit_of_measurement\":\"%\",\"state_class\":\"measurement\",\"icon\":\"mdi:chart-donut\",\"point_montage\":\"$MNT\"}}"
