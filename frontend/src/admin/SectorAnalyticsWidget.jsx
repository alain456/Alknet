import React from 'react';
import { PieChart, TrendingUp, Lightbulb, AlertCircle, Building2, ChevronRight, Award } from 'lucide-react';

export default function SectorAnalyticsWidget({ businesses = [], categories = [] }) {
  const parentCategories = categories.filter(c => !c.parent);

  // Group businesses by parent sector name
  const sectorCounts = {};
  let totalBusinesses = businesses.length || 1;

  parentCategories.forEach(parent => {
    sectorCounts[parent.name] = 0;
  });

  businesses.forEach(bus => {
    const primaryName = bus.primary_category_name || bus.category_name;
    if (primaryName) {
      // Find parent or match name
      const foundCat = categories.find(c => c.name === primaryName);
      if (foundCat && foundCat.parent_name) {
        sectorCounts[foundCat.parent_name] = (sectorCounts[foundCat.parent_name] || 0) + 1;
      } else if (foundCat && !foundCat.parent) {
        sectorCounts[foundCat.name] = (sectorCounts[foundCat.name] || 0) + 1;
      } else if (sectorCounts[primaryName] !== undefined) {
        sectorCounts[primaryName] = (sectorCounts[primaryName] || 0) + 1;
      } else {
        // Fallback match
        const firstSector = parentCategories[0]?.name || 'Autres';
        sectorCounts[firstSector] = (sectorCounts[firstSector] || 0) + 1;
      }
    }
  });

  const sortedSectors = Object.entries(sectorCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalBusinesses) * 100)
    }))
    .sort((a, b) => b.count - a.count);

  const underRepresented = sortedSectors.filter(s => s.count <= 2);

  return (
    <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border dark:border-white/10 pb-3">
        <div className="flex items-center gap-2 text-green-900 dark:text-white font-bold text-base">
          <PieChart className="w-5 h-5 text-gold-600 dark:text-gold-400" />
          Widget Décisionnel & Performance par Secteur
        </div>
        <span className="text-xs text-ink-muted dark:text-green-100/60 font-medium">
          Total : {businesses.length} établissement(s)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Sector Percentage Progress Bars */}
        <div className="md:col-span-2 space-y-3">
          <div className="text-xs font-semibold text-ink-muted dark:text-green-100/70 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-green-700" /> Répartition des consultations & présence
          </div>

          <div className="space-y-2.5 max-h-52 overflow-y-auto pr-2">
            {sortedSectors.map((sector, idx) => (
              <div key={sector.name} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-ink dark:text-white">
                  <span>{sector.name}</span>
                  <span className="font-bold text-gold-700 dark:text-gold-400">{sector.percentage}% ({sector.count})</span>
                </div>
                <div className="w-full bg-paper dark:bg-black/30 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-700 to-gold-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(sector.percentage, 5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commercial Opportunities Alert Card */}
        <div className="bg-gold-500/10 dark:bg-gold-500/15 border border-gold-500/30 rounded-lg p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-xs text-gold-700 dark:text-gold-300 uppercase tracking-wider mb-2">
              <Lightbulb className="w-4 h-4 fill-gold-500 text-gold-600" /> Secteurs Sous-Représentés
            </div>
            
            {underRepresented.length > 0 ? (
              <div className="space-y-2 text-xs">
                <p className="text-ink-muted dark:text-green-100/80">
                  Potentiel de croissance élevé détecté pour l'équipe commerciale :
                </p>
                <div className="space-y-1">
                  {underRepresented.slice(0, 3).map((item) => (
                    <div key={item.name} className="flex items-center justify-between bg-surface/80 dark:bg-black/30 px-2.5 py-1.5 rounded border border-gold-500/20 text-ink dark:text-white font-medium">
                      <span>{item.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gold-500/20 text-gold-700 dark:text-gold-300">
                        {item.count} inscrit(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-muted dark:text-green-100/70">
                Excellente couverture géographique sur tous les secteurs d'activité !
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-gold-500/20 text-[11px] text-gold-800 dark:text-gold-200 font-semibold flex items-center justify-between">
            <span>💡 Opportunités de prospection B2B</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

      </div>
    </div>
  );
}
