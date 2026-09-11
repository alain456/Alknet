import React, { useState, useEffect } from 'react';
import { 
  MapPin, Plus, Edit, Trash2, RefreshCw, ChevronRight, ChevronDown, 
  Building, Layers, Search, CheckCircle, AlertCircle, Navigation, Map 
} from 'lucide-react';

export default function AdminLocationsPage() {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Expanded items state: sets of IDs
  const [expandedProvinces, setExpandedProvinces] = useState(new Set());
  const [expandedCommunes, setExpandedCommunes] = useState(new Set());
  const [expandedZones, setExpandedZones] = useState(new Set());
  const [expandedQuartiers, setExpandedQuartiers] = useState(new Set());

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [modalMode, setModalMode] = useState(null); // 'create-province', 'edit-province', 'create-commune', 'edit-commune', 'create-zone', 'edit-zone', 'create-quartier', 'edit-quartier', 'create-avenue', 'edit-avenue'
  const [selectedItem, setSelectedItem] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    province_id: '',
    commune_id: '',
    zone_id: '',
    quartier_id: '',
    name: '',
    code: '',
    is_active: true
  });

  const [actionMessage, setActionMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch complete tree
  const fetchLocationsTree = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/locations/tree/');
      if (response.ok) {
        const data = await response.json();
        setTreeData(data);

        // Auto expand first items by default
        if (data.length > 0) {
          setExpandedProvinces(new Set([data[0].id]));
          if (data[0].communes && data[0].communes.length > 0) {
            setExpandedCommunes(new Set([data[0].communes[0].id]));
            if (data[0].communes[0].zones && data[0].communes[0].zones.length > 0) {
              setExpandedZones(new Set([data[0].communes[0].zones[0].id]));
            }
          }
        }
      }
    } catch (err) {
      console.error("Erreur lors du chargement des localisations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocationsTree();
  }, []);

  // Toggle expansions
  const toggleProvince = (id) => {
    const next = new Set(expandedProvinces);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedProvinces(next);
  };

  const toggleCommune = (id) => {
    const next = new Set(expandedCommunes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCommunes(next);
  };

  const toggleZone = (id) => {
    const next = new Set(expandedZones);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedZones(next);
  };

  const toggleQuartier = (id) => {
    const next = new Set(expandedQuartiers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedQuartiers(next);
  };

  // Seed default data
  const handleSeedLocations = async () => {
    if (!window.confirm("Voulez-vous ré-initialiser la hiérarchie officielle du Burundi (Province -> Commune -> Zone -> Quartier -> Avenue) ?")) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/locations/seed/', { method: 'POST' });
      const data = await res.json();
      setActionMessage({ type: 'success', text: data.message });
      fetchLocationsTree();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Open modal
  const openModal = (mode, item = null, parentContext = {}) => {
    setModalMode(mode);
    setSelectedItem(item);

    const defaultProvinceId = parentContext.province_id || item?.province || treeData[0]?.id || '';
    const defaultCommuneId = parentContext.commune_id || item?.commune || '';
    const defaultZoneId = parentContext.zone_id || item?.zone || '';
    const defaultQuartierId = parentContext.quartier_id || item?.quartier || '';

    setFormData({
      province_id: defaultProvinceId,
      commune_id: defaultCommuneId,
      zone_id: defaultZoneId,
      quartier_id: defaultQuartierId,
      name: item?.name || '',
      code: item?.code || '',
      is_active: item?.is_active ?? true
    });
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedItem(null);
  };

  // Submit CRUD
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);

    let url = '';
    let method = selectedItem ? 'PUT' : 'POST';
    let bodyData = {};

    if (modalMode.includes('province')) {
      url = selectedItem ? `/api/v1/locations/provinces/${selectedItem.id}/` : `/api/v1/locations/provinces/`;
      bodyData = { name: formData.name, code: formData.code, is_active: formData.is_active };
    } else if (modalMode.includes('commune')) {
      if (!formData.province_id) {
        setActionMessage({ type: 'error', text: 'Veuillez sélectionner une province.' });
        setIsSubmitting(false);
        return;
      }
      url = selectedItem ? `/api/v1/locations/communes/${selectedItem.id}/` : `/api/v1/locations/communes/`;
      bodyData = { province: formData.province_id, name: formData.name, is_active: formData.is_active };
    } else if (modalMode.includes('zone')) {
      if (!formData.commune_id) {
        setActionMessage({ type: 'error', text: 'Veuillez sélectionner une commune.' });
        setIsSubmitting(false);
        return;
      }
      url = selectedItem ? `/api/v1/locations/zones/${selectedItem.id}/` : `/api/v1/locations/zones/`;
      bodyData = { commune: formData.commune_id, name: formData.name, is_active: formData.is_active };
    } else if (modalMode.includes('quartier')) {
      if (!formData.zone_id) {
        setActionMessage({ type: 'error', text: 'Veuillez sélectionner une zone.' });
        setIsSubmitting(false);
        return;
      }
      url = selectedItem ? `/api/v1/locations/quartiers/${selectedItem.id}/` : `/api/v1/locations/quartiers/`;
      bodyData = { zone: formData.zone_id, name: formData.name, is_active: formData.is_active };
    } else if (modalMode.includes('avenue')) {
      if (!formData.quartier_id) {
        setActionMessage({ type: 'error', text: 'Veuillez sélectionner un quartier.' });
        setIsSubmitting(false);
        return;
      }
      url = selectedItem ? `/api/v1/locations/avenues/${selectedItem.id}/` : `/api/v1/locations/avenues/`;
      bodyData = { quartier: formData.quartier_id, name: formData.name, is_active: formData.is_active };
    }

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      if (response.ok) {
        setActionMessage({ type: 'success', text: 'Enregistrement effectué avec succès !' });
        closeModal();
        fetchLocationsTree();
      } else {
        const errorData = await response.json();
        const readableMsg = typeof errorData === 'object' ? Object.entries(errorData).map(([k, v]) => `${k}: ${v}`).join(', ') : 'Erreur de validation';
        setActionMessage({ type: 'error', text: readableMsg });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async (type, id, name) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer "${name}" ?`)) return;

    let url = `/api/v1/locations/${type}s/${id}/`;
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        setActionMessage({ type: 'success', text: `"${name}" supprimé.` });
        fetchLocationsTree();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-7 h-7 text-green-700 dark:text-green-400" />
            Hiérarchie Administative à 5 Niveaux
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Structure officielle : <strong>Province ➔ Commune ➔ Zone ➔ Quartier/Colline ➔ Avenue/Rue (Optionnel)</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleSeedLocations}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-800 dark:text-gray-200 px-4 py-2.5 rounded-xl font-medium text-sm transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-green-600" />
            Seeder les Données
          </button>

          <button 
            onClick={() => openModal('create-province')}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Créer une Province
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
          actionMessage.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/40 text-green-800 dark:text-green-200 border border-green-200' 
            : 'bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs underline font-bold">Fermer</button>
        </div>
      )}

      {/* Search Filter */}
      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          type="text"
          placeholder="Filtrer une province, commune, zone, quartier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-green-700 outline-none text-gray-900 dark:text-white shadow-sm"
        />
      </div>

      {/* 5-Level Nested Interactive Accordion Tree */}
      {loading ? (
        <div className="py-20 text-center text-gray-500 font-medium animate-pulse">
          Chargement de la hiérarchie géographique du Burundi...
        </div>
      ) : (
        <div className="space-y-4">
          {treeData
            .filter(p => 
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (p.communes || []).some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            .map((province) => {
              const isProvExpanded = expandedProvinces.has(province.id);

              return (
                <div key={province.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition">
                  
                  {/* PROVINCE ROW */}
                  <div className="p-4 sm:p-5 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
                    <div 
                      onClick={() => toggleProvince(province.id)}
                      className="flex items-center gap-3 cursor-pointer select-none flex-1"
                    >
                      <button className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition">
                        {isProvExpanded ? <ChevronDown className="w-5 h-5 text-green-700" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      
                      <div className="w-9 h-9 rounded-xl bg-green-700/10 text-green-700 dark:text-green-400 flex items-center justify-center font-bold text-sm">
                        {province.code || province.name.substring(0, 3).toUpperCase()}
                      </div>

                      <div>
                        <h2 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                          {province.name}
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-semibold rounded-full">
                            {(province.communes || []).length} Communes
                          </span>
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openModal('create-commune', null, { province_id: province.id })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Commune
                      </button>

                      <button 
                        onClick={() => openModal('edit-province', province)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white transition cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => handleDelete('province', province.id, province.name)}
                        className="p-1.5 text-red-400 hover:text-red-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* COMMUNES LEVEL */}
                  {isProvExpanded && (
                    <div className="p-4 space-y-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800/60">
                      {(province.communes || []).length === 0 ? (
                        <div className="text-xs text-gray-400 py-3 pl-8 italic">Aucune commune configurée dans cette province.</div>
                      ) : (
                        (province.communes || []).map((commune) => {
                          const isComExpanded = expandedCommunes.has(commune.id);

                          return (
                            <div key={commune.id} className="ml-3 sm:ml-6 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50/30 dark:bg-gray-800/20">
                              
                              {/* COMMUNE ROW */}
                              <div className="p-3.5 flex items-center justify-between">
                                <div 
                                  onClick={() => toggleCommune(commune.id)}
                                  className="flex items-center gap-3 cursor-pointer select-none flex-1"
                                >
                                  <button className="p-1 rounded text-gray-400 hover:text-gray-700">
                                    {isComExpanded ? <ChevronDown className="w-4 h-4 text-green-600" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                  <Building className="w-4 h-4 text-green-600" />
                                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                                    {commune.name}
                                  </span>
                                  <span className="text-[11px] text-gray-400 font-medium">
                                    ({(commune.zones || []).length} zones)
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => openModal('create-zone', null, { commune_id: commune.id })}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-bold rounded-lg transition cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Zone
                                  </button>

                                  <button 
                                    onClick={() => openModal('edit-commune', commune, { province_id: province.id })}
                                    className="p-1 text-gray-400 hover:text-gray-700"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  <button 
                                    onClick={() => handleDelete('commune', commune.id, commune.name)}
                                    className="p-1 text-red-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* ZONES LEVEL */}
                              {isComExpanded && (
                                <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800/40 space-y-2">
                                  {(commune.zones || []).length === 0 ? (
                                    <div className="text-xs text-gray-400 pl-6 py-2 italic">Aucune zone enregistrée dans cette commune.</div>
                                  ) : (
                                    (commune.zones || []).map((zone) => {
                                      const isZoneExpanded = expandedZones.has(zone.id);

                                      return (
                                        <div key={zone.id} className="ml-4 border border-gray-100 dark:border-gray-800/80 rounded-lg p-2.5 bg-gray-50/50 dark:bg-gray-800/40">
                                          
                                          {/* ZONE ROW */}
                                          <div className="flex items-center justify-between">
                                            <div 
                                              onClick={() => toggleZone(zone.id)}
                                              className="flex items-center gap-2 cursor-pointer select-none flex-1"
                                            >
                                              <button className="p-0.5 text-gray-400">
                                                {isZoneExpanded ? <ChevronDown className="w-3.5 h-3.5 text-blue-600" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                              </button>
                                              <Layers className="w-3.5 h-3.5 text-blue-600" />
                                              <span className="font-semibold text-xs text-gray-900 dark:text-white">
                                                Zone {zone.name}
                                              </span>
                                              <span className="text-[10px] text-gray-400 font-mono">
                                                ({(zone.quartiers || []).length} quartiers)
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                              <button 
                                                onClick={() => openModal('create-quartier', null, { zone_id: zone.id })}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-gold-500/10 text-gold-700 dark:text-gold-400 hover:bg-gold-500/20 text-[11px] font-semibold rounded transition cursor-pointer"
                                              >
                                                <Plus className="w-3 h-3" />
                                                Quartier
                                              </button>

                                              <button 
                                                onClick={() => openModal('edit-zone', zone, { commune_id: commune.id })}
                                                className="p-1 text-gray-400 hover:text-gray-700"
                                              >
                                                <Edit className="w-3 h-3" />
                                              </button>

                                              <button 
                                                onClick={() => handleDelete('zone', zone.id, zone.name)}
                                                className="p-1 text-red-400 hover:text-red-600"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>

                                          {/* QUARTIERS LEVEL */}
                                          {isZoneExpanded && (
                                            <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50 pl-5 space-y-1.5">
                                              {(zone.quartiers || []).length === 0 ? (
                                                <div className="text-[11px] text-gray-400 italic">Aucun quartier dans cette zone.</div>
                                              ) : (
                                                (zone.quartiers || []).map((quartier) => {
                                                  const isQuartExpanded = expandedQuartiers.has(quartier.id);

                                                  return (
                                                    <div key={quartier.id} className="border border-gray-100 dark:border-gray-800 rounded-md p-2 bg-white dark:bg-gray-900">
                                                      
                                                      {/* QUARTIER ROW */}
                                                      <div className="flex items-center justify-between">
                                                        <div 
                                                          onClick={() => toggleQuartier(quartier.id)}
                                                          className="flex items-center gap-2 cursor-pointer select-none flex-1"
                                                        >
                                                          <button className="p-0.5 text-gray-400">
                                                            {isQuartExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gold-500" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                          </button>
                                                          <MapPin className="w-3.5 h-3.5 text-gold-500" />
                                                          <span className="font-medium text-xs text-gray-800 dark:text-gray-200">
                                                            {quartier.name}
                                                          </span>
                                                          {(quartier.avenues || []).length > 0 && (
                                                            <span className="text-[10px] text-gray-400 font-mono">
                                                              ({(quartier.avenues || []).length} avenues)
                                                            </span>
                                                          )}
                                                        </div>

                                                        <div className="flex items-center gap-1">
                                                          <button 
                                                            onClick={() => openModal('create-avenue', null, { quartier_id: quartier.id })}
                                                            className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-semibold rounded hover:bg-gray-200 transition cursor-pointer"
                                                          >
                                                            <Plus className="w-2.5 h-2.5" />
                                                            Avenue
                                                          </button>

                                                          <button 
                                                            onClick={() => openModal('edit-quartier', quartier, { zone_id: zone.id })}
                                                            className="p-0.5 text-gray-400 hover:text-gray-700"
                                                          >
                                                            <Edit className="w-3 h-3" />
                                                          </button>

                                                          <button 
                                                            onClick={() => handleDelete('quartier', quartier.id, quartier.name)}
                                                            className="p-0.5 text-red-400 hover:text-red-600"
                                                          >
                                                            <Trash2 className="w-3 h-3" />
                                                          </button>
                                                        </div>
                                                      </div>

                                                      {/* AVENUES LEVEL */}
                                                      {isQuartExpanded && (
                                                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 pl-4 space-y-1">
                                                          {(quartier.avenues || []).length === 0 ? (
                                                            <div className="text-[10px] text-gray-400 italic">Aucune avenue répertoriée (optionnel).</div>
                                                          ) : (
                                                            (quartier.avenues || []).map((av) => (
                                                              <div key={av.id} className="flex items-center justify-between text-xs py-0.5 text-gray-600 dark:text-gray-300">
                                                                <div className="flex items-center gap-1.5">
                                                                  <Navigation className="w-3 h-3 text-green-600" />
                                                                  <span className="text-[11px]">{av.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                  <button 
                                                                    onClick={() => openModal('edit-avenue', av, { quartier_id: quartier.id })}
                                                                    className="p-0.5 text-gray-400 hover:text-gray-700"
                                                                  >
                                                                    <Edit className="w-3 h-3" />
                                                                  </button>
                                                                  <button 
                                                                    onClick={() => handleDelete('avenue', av.id, av.name)}
                                                                    className="p-0.5 text-red-400 hover:text-red-600"
                                                                  >
                                                                    <Trash2 className="w-3 h-3" />
                                                                  </button>
                                                                </div>
                                                              </div>
                                                            ))
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* CRUD Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 dark:border-gray-800 space-y-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
              {selectedItem ? 'Modifier' : 'Ajouter'} {
                modalMode.includes('province') ? 'une Province' : 
                modalMode.includes('commune') ? 'une Commune' : 
                modalMode.includes('zone') ? 'une Zone' :
                modalMode.includes('quartier') ? 'un Quartier / Colline' : 'une Avenue / Rue'
              }
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Commune Form -> Select Province */}
              {modalMode.includes('commune') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Province *</label>
                  <select
                    required
                    value={formData.province_id}
                    onChange={(e) => setFormData({ ...formData, province_id: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none font-medium"
                  >
                    <option value="" disabled>-- Choisir une Province --</option>
                    {treeData.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Zone Form -> Select Commune */}
              {modalMode.includes('zone') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Commune *</label>
                  <select
                    required
                    value={formData.commune_id}
                    onChange={(e) => setFormData({ ...formData, commune_id: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none font-medium"
                  >
                    <option value="" disabled>-- Choisir une Commune --</option>
                    {treeData.flatMap(p => (p.communes || []).map(c => (
                      <option key={c.id} value={c.id}>{p.name} ➔ {c.name}</option>
                    )))}
                  </select>
                </div>
              )}

              {/* Quartier Form -> Select Zone */}
              {modalMode.includes('quartier') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Zone *</label>
                  <select
                    required
                    value={formData.zone_id}
                    onChange={(e) => setFormData({ ...formData, zone_id: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none font-medium"
                  >
                    <option value="" disabled>-- Choisir une Zone --</option>
                    {treeData.flatMap(p => (p.communes || []).flatMap(c => (c.zones || []).map(z => (
                      <option key={z.id} value={z.id}>{c.name} ➔ Zone {z.name}</option>
                    ))))}
                  </select>
                </div>
              )}

              {/* Avenue Form -> Select Quartier */}
              {modalMode.includes('avenue') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Quartier / Colline *</label>
                  <select
                    required
                    value={formData.quartier_id}
                    onChange={(e) => setFormData({ ...formData, quartier_id: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none font-medium"
                  >
                    <option value="" disabled>-- Choisir un Quartier --</option>
                    {treeData.flatMap(p => (p.communes || []).flatMap(c => (c.zones || []).flatMap(z => (z.quartiers || []).map(q => (
                      <option key={q.id} value={q.id}>{z.name} ➔ {q.name}</option>
                    )))))}
                  </select>
                </div>
              )}

              {/* Name Field */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Nom {modalMode.includes('avenue') ? 'de l\'Avenue / Rue' : 'Officiel'} *
                </label>
                <input 
                  type="text"
                  required
                  placeholder={
                    modalMode.includes('avenue') ? 'Ex: Boulevard de l\'Uprona, Avenue de la Croix Rouge...' :
                    modalMode.includes('quartier') ? 'Ex: Rohero I, Bwiza, Kinindo...' :
                    modalMode.includes('zone') ? 'Ex: Rohero, Bwiza, Ngagara...' :
                    modalMode.includes('commune') ? 'Ex: Mukaza, Ntahangwa...' : 'Ex: Bujumbura Mairie...'
                  }
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none"
                />
              </div>

              {/* Province Code */}
              {modalMode.includes('province') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Code Abrégé (Optionnel)</label>
                  <input 
                    type="text"
                    placeholder="Ex: BJM, GTG..."
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none"
                  />
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-green-700 hover:bg-green-800 text-white shadow-sm transition cursor-pointer"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
