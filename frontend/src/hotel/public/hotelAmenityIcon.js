import {
  Wifi, Car, Waves, Coffee, Utensils, Wind, Tv, Dumbbell,
  Sparkles, ConciergeBell, Shield, Baby, PawPrint, CigaretteOff,
} from 'lucide-react';

/** Associe un libellé d'équipement à une icône (parcours client). */
export function amenityIcon(label) {
  const s = String(label || '').toLowerCase();
  if (/wi-?fi|internet|réseau|reseau/.test(s)) return Wifi;
  if (/park|voiture|parking/.test(s)) return Car;
  if (/piscine|pool|bain/.test(s)) return Waves;
  if (/petit.?d[eé]j|breakfast|caf[eé]/.test(s)) return Coffee;
  if (/restau|dining|cuisine|bar/.test(s)) return Utensils;
  if (/clim|ac|air.?cond|ventil/.test(s)) return Wind;
  if (/tv|t[eé]l[eé]/.test(s)) return Tv;
  if (/sport|gym|fitness/.test(s)) return Dumbbell;
  if (/spa|wellness|massage|sauna/.test(s)) return Sparkles;
  if (/concierge|room.?service|r[eé]cept/.test(s)) return ConciergeBell;
  if (/s[eé]cur|coffre|safe/.test(s)) return Shield;
  if (/enfant|famille|baby|kids/.test(s)) return Baby;
  if (/animal|pet|chien|chat/.test(s)) return PawPrint;
  if (/non.?fum|smoke/.test(s)) return CigaretteOff;
  return Sparkles;
}
