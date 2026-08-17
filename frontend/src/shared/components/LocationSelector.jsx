import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Globe, CheckCircle2, Link2, HelpCircle } from 'lucide-react';

const FALLBACK_BURUNDI_LOCATIONS = {
  "Bujumbura Mairie": {
    communes: ["Mukaza", "Ntahangwa", "Muha"],
    zones: {
      "Mukaza": ["Rohero", "Bwiza", "Buyenzi", "Nyakabiga"],
      "Ntahangwa": ["Ngagara", "Kinama", "Kamenge", "Gihosha"],
      "Muha": ["Kinindo", "Kanyosha"]
    },
    quartiers: {
      "Rohero": ["Rohero I", "Rohero II", "Centre-Ville"],
      "Bwiza": ["Bwiza I", "Bwiza II"],
      "Buyenzi": ["Buyenzi I", "Buyenzi II"],
      "Nyakabiga": ["Nyakabiga I", "Nyakabiga II"],
      "Ngagara": ["Ngagara Q1", "Ngagara Q2", "Ngagara Q3"],
      "Kinindo": ["Kinindo Sud", "Kinindo Ouest"],
      "Kanyosha": ["Musaga"]
    },
    avenues: {
      "Rohero I": ["Boulevard de l'Uprona", "Avenue de la Croix Rouge", "Avenue de la Mission"]
    }
  },
  "Gitega": {
    communes: ["Gitega"],
    zones: {
      "Gitega": ["Urban"]
    },
    quartiers: {
      "Urban": ["Centre-Ville", "Shatanya", "Nyamugari"]
    },
    avenues: {}
  }
};

export default function LocationSelector({ 
  province = 'Bujumbura Mairie', 
  commune = '', 
  zone = '',
  quartier = '', 
  avenue = '',
  address = '', 
  latitude = '', 
  longitude = '', 
  onChange 
}) {
  const [locationsData, setLocationsData] = useState(FALLBACK_BURUNDI_LOCATIONS);
  const [loading, setLoading] = useState(true);

  // Smart Extractor Input
  const [pastedMapLink, setPastedMapLink] = useState('');
  const [extractSuccess, setExtractSuccess] = useState(false);

  useEffect(() => {
    const fetchTree = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/locations/tree/');
        if (response.ok) {
          const tree = await response.json();
          if (tree && tree.length > 0) {
            const formatted = {};
            tree.forEach(p => {
              const communes = [];
              const zonesMap = {};
              const quartiersMap = {};
              const avenuesMap = {};

              (p.communes || []).forEach(c => {
                communes.push(c.name);
                zonesMap[c.name] = (c.zones || []).map(z => z.name);

                (c.zones || []).forEach(z => {
                  quartiersMap[z.name] = (z.quartiers || []).map(q => q.name);

                  (z.quartiers || []).forEach(q => {
                    if (q.avenues && q.avenues.length > 0) {
                      avenuesMap[q.name] = q.avenues.map(av => av.name);
                    }
                  });
                });
              });

              formatted[p.name] = {
                communes,
                zones: zonesMap,
                quartiers: quartiersMap,
                avenues: avenuesMap
              };
            });
            setLocationsData(formatted);
          }
        }
      } catch (err) {
        console.warn("Utilisation de la localisation fallback:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, []);

  // Auto-sync missing defaults if empty
  useEffect(() => {
    if (!loading && locationsData[province]) {
      const pData = locationsData[province];
      const validCommunes = pData.communes || [];
      const activeCommune = commune || validCommunes[0] || '';
      
      const validZones = (pData.zones && pData.zones[activeCommune]) || [];
      const activeZone = zone || validZones[0] || '';
      
      const validQuartiers = (pData.quartiers && pData.quartiers[activeZone]) || [];
      const activeQuartier = quartier || validQuartiers[0] || '';

      if (activeCommune !== commune || activeZone !== zone || activeQuartier !== quartier) {
        onChange({
          province,
          commune: activeCommune,
          zone: activeZone,
          quartier: activeQuartier,
          avenue,
          address,
          latitude,
          longitude
        });
      }
    }
  }, [locationsData, province, commune, zone, quartier, loading]);

  const provincesList = Object.keys(locationsData);
  const currentProvinceData = locationsData[province] || { communes: [], zones: {}, quartiers: {}, avenues: {} };
  const communesList = currentProvinceData.communes || [];
  const zonesList = (currentProvinceData.zones && currentProvinceData.zones[commune]) || [];
  const quartiersList = (currentProvinceData.quartiers && currentProvinceData.quartiers[zone]) || [];
  const avenuesList = (currentProvinceData.avenues && currentProvinceData.avenues[quartier]) || [];

  const handleProvinceChange = (e) => {
    const newProv = e.target.value;
    const defaultCommune = locationsData[newProv]?.communes[0] || '';
    const defaultZone = locationsData[newProv]?.zones[defaultCommune]?.[0] || '';
    const defaultQuartier = locationsData[newProv]?.quartiers[defaultZone]?.[0] || '';

    onChange({
      province: newProv,
      commune: defaultCommune,
      zone: defaultZone,
      quartier: defaultQuartier,
      avenue: '',
      address,
      latitude,
      longitude
    });
  };

  const handleCommuneChange = (e) => {
    const newCommune = e.target.value;
    const defaultZone = currentProvinceData.zones[newCommune]?.[0] || '';
    const defaultQuartier = currentProvinceData.quartiers[defaultZone]?.[0] || '';

    onChange({
      province,
      commune: newCommune,
      zone: defaultZone,
      quartier: defaultQuartier,
      avenue: '',
      address,
      latitude,
      longitude
    });
  };

  const handleZoneChange = (e) => {
    const newZone = e.target.value;
    const defaultQuartier = currentProvinceData.quartiers[newZone]?.[0] || '';

    onChange({
      province,
      commune,
      zone: newZone,
      quartier: defaultQuartier,
      avenue: '',
      address,
      latitude,
      longitude
    });
  };

  const handleQuartierChange = (e) => {
    const newQuartier = e.target.value;
    onChange({
      province,
      commune,
      zone,
      quartier: newQuartier,
      avenue: '',
      address,
      latitude,
      longitude
    });
  };

  const handleGPSDetect = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          province,
          commune,
          zone,
          quartier,
          avenue,
          address,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        });
      },
      (err) => {
        alert("Impossible d'obtenir la position GPS automatique. Vous pouvez coller le lien Google Maps ci-dessous.");
      }
    );
  };

  const handleGoogleMapsOpen = () => {
    const query = encodeURIComponent(`${avenue ? avenue + ', ' : ''}${quartier ? quartier + ', ' : ''}${zone ? zone + ', ' : ''}${commune ? commune + ', ' : ''}${province}, Burundi`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  // Smart Extractor logic: extracts coordinates from pasted URL or string
  const handleSmartPaste = (text) => {
    setPastedMapLink(text);
    if (!text) return;

    // Pattern 1: URL format like https://www.google.com/maps/place/.../@-3.3791592,29.3746811,17z...
    const urlMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    // Pattern 2: Direct coordinates like -3.3791592, 29.3746811 or -3.3791592 29.3746811
    const coordMatch = text.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);

    let foundLat = null;
    let foundLng = null;

    if (urlMatch) {
      foundLat = urlMatch[1];
      foundLng = urlMatch[2];
    } else if (coordMatch) {
      foundLat = coordMatch[1];
      foundLng = coordMatch[2];
    }

    if (foundLat && foundLng) {
      onChange({
        province,
        commune,
        zone,
        quartier,
        avenue,
        address,
        latitude: foundLat,
        longitude: foundLng
      });
      setExtractSuccess(true);
      setTimeout(() => setExtractSuccess(false), 4000);
    }
  };

  return (
    <div className="space-y-4 bg-paper/60 dark:bg-black/20 p-4 border border-border dark:border-white/10 rounded-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 dark:border-white/10 pb-3 gap-2">
        <label className="text-xs font-bold text-green-900 dark:text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-gold-600" /> Localisation de l'entreprise (Obligatoire) *
        </label>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoogleMapsOpen}
            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            title="Ouvrir Google Maps"
          >
            <Globe className="w-3.5 h-3.5" /> Ouvrir Google Maps
          </button>

          <button
            type="button"
            onClick={handleGPSDetect}
            className="text-[11px] font-semibold text-green-700 dark:text-gold-300 hover:underline flex items-center gap-1 cursor-pointer"
            title="Capturer automatiquement votre position GPS par votre appareil"
          >
            <Navigation className="w-3.5 h-3.5 text-gold-600" /> Capturer GPS
          </button>
        </div>
      </div>

      {/* Level 1, 2, 3: Province -> Commune -> Zone */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Province */}
        <div>
          <label className="block text-[11px] font-semibold text-ink-muted dark:text-green-100/70 mb-1">1. Province *</label>
          <select
            required
            value={province}
            onChange={handleProvinceChange}
            className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
          >
            {provincesList.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Commune */}
        <div>
          <label className="block text-[11px] font-semibold text-ink-muted dark:text-green-100/70 mb-1">2. Commune *</label>
          {communesList.length > 0 ? (
            <select
              required
              value={commune}
              onChange={handleCommuneChange}
              className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
            >
              <option value="" disabled>-- Sélectionner --</option>
              {communesList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Ex: Mukaza"
              value={commune}
              onChange={(e) => onChange({ province, commune: e.target.value, zone, quartier, avenue, address, latitude, longitude })}
              className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
            />
          )}
        </div>

        {/* Zone */}
        <div>
          <label className="block text-[11px] font-semibold text-ink-muted dark:text-green-100/70 mb-1">3. Zone *</label>
          {zonesList.length > 0 ? (
            <select
              required
              value={zone}
              onChange={handleZoneChange}
              className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
            >
              <option value="" disabled>-- Sélectionner --</option>
              {zonesList.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Ex: Rohero"
              value={zone}
              onChange={(e) => onChange({ province, commune, zone: e.target.value, quartier, avenue, address, latitude, longitude })}
              className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
            />
          )}
        </div>
      </div>

      {/* Level 4, 5: Quartier -> Avenue (Optionnel) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Quartier / Colline */}
        <div>
          <label className="block text-[11px] font-semibold text-ink-muted dark:text-green-100/70 mb-1">4. Quartier / Colline *</label>
          {quartiersList.length > 0 ? (
            <select
              required
              value={quartier}
              onChange={handleQuartierChange}
              className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
            >
              <option value="" disabled>-- Sélectionner --</option>
              {quartiersList.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Ex: Rohero I"
              value={quartier}
              onChange={(e) => onChange({ province, commune, zone, quartier: e.target.value, avenue, address, latitude, longitude })}
              className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
            />
          )}
        </div>

        {/* Avenue / Rue (Optionnel) */}
        <div>
          <label className="block text-[11px] font-semibold text-ink-muted dark:text-green-100/70 mb-1">
            5. Avenue / Rue <span className="text-[10px] text-green-600 dark:text-gold-400 font-normal">(Optionnel)</span>
          </label>
          {avenuesList.length > 0 ? (
            <select
              value={avenue}
              onChange={(e) => onChange({ province, commune, zone, quartier, avenue: e.target.value, address, latitude, longitude })}
              className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
            >
              <option value="">-- Choisir une avenue ou saisir ci-dessous --</option>
              {avenuesList.map((av) => (
                <option key={av} value={av}>{av}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="Ex: Boulevard de l'Uprona"
              value={avenue}
              onChange={(e) => onChange({ province, commune, zone, quartier, avenue: e.target.value, address, latitude, longitude })}
              className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
            />
          )}
        </div>
      </div>

      {/* Adresse Précise */}
      <div>
        <label className="block text-[11px] font-semibold text-ink-muted dark:text-green-100/70 mb-1">Détails d'Adresse / N° Porte</label>
        <input
          type="text"
          placeholder="Ex: Immeuble Ruhara, 2ème Étage, Porte B"
          value={address}
          onChange={(e) => onChange({ province, commune, zone, quartier, avenue, address: e.target.value, latitude, longitude })}
          className="w-full px-3 py-2 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none focus:border-green-700 font-medium"
        />
      </div>

      {/* Smart Extractor: Coller Lien Google Maps ou Coordonnées */}
      <div className="bg-blue-50/70 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Extraction Intelligente Google Maps
          </label>

          {extractSuccess && (
            <span className="text-[10px] font-semibold text-green-700 dark:text-green-300 flex items-center gap-1 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Coordonnées GPS capturées !
            </span>
          )}
        </div>

        <input
          type="text"
          placeholder="Collez ici l'URL complète Google Maps ou les coordonnées (ex: https://www.google.com/maps/.../@-3.3791592,29.3746811...)"
          value={pastedMapLink}
          onChange={(e) => handleSmartPaste(e.target.value)}
          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-black/40 border border-blue-200 dark:border-blue-800 rounded-md text-ink dark:text-white outline-none focus:ring-1 focus:ring-blue-500 font-mono"
        />
        <p className="text-[10px] text-blue-700/80 dark:text-blue-300/70 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 shrink-0" />
          Astuce : Copiez l'adresse web (URL) depuis Google Maps et collez-la ci-dessus. La latitude et la longitude s'extraient instantanément !
        </p>
      </div>

      {/* Coordonnées GPS (Latitude / Longitude) */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40 dark:border-white/5">
        <div>
          <label className="block text-[10px] font-semibold text-ink-faint dark:text-green-100/50 mb-0.5">Latitude (GPS)</label>
          <input
            type="text"
            placeholder="Ex: -3.379159"
            value={latitude}
            onChange={(e) => onChange({ province, commune, zone, quartier, avenue, address, latitude: e.target.value, longitude })}
            className="w-full px-2.5 py-1.5 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-ink-faint dark:text-green-100/50 mb-0.5">Longitude (GPS)</label>
          <input
            type="text"
            placeholder="Ex: 29.374681"
            value={longitude}
            onChange={(e) => onChange({ province, commune, zone, quartier, avenue, address, latitude, longitude: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs bg-surface dark:bg-black/30 border border-border dark:border-white/10 rounded-md text-ink dark:text-white focus:outline-none font-mono"
          />
        </div>
      </div>
    </div>
  );
}
