import React from 'react';
import { User, Star, Video, Clock, ChevronRight } from 'lucide-react';

export default function DoctorCard({ doctor, onBook }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-5 flex flex-col sm:flex-row gap-5">
      {/* Doctor Avatar */}
      <div className="w-20 h-20 rounded-full bg-teal-50 flex items-center justify-center shrink-0 border-2 border-teal-100 overflow-hidden">
        {doctor.avatar ? (
          <img src={doctor.avatar} alt={doctor.name} className="w-full h-full object-cover" />
        ) : (
          <User className="text-teal-600 w-8 h-8" />
        )}
      </div>

      <div className="flex-1">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2">
          <div>
            <h4 className="font-bold text-gray-900 text-lg">Dr. {doctor.name}</h4>
            <p className="text-teal-600 font-medium text-sm">{doctor.specialty}</p>
          </div>
          <div className="flex items-center text-sm text-gray-500 mt-2 sm:mt-0">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 mr-1" />
            <span className="font-medium text-gray-700">{doctor.rating || 'Nouveau'}</span>
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{doctor.bio}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {doctor.isAvailableForTelemedicine && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded border border-blue-100 flex items-center gap-1">
              <Video className="w-3 h-3" /> Téléconsultation
            </span>
          )}
          <span className="px-2 py-1 bg-gray-50 text-gray-700 text-xs font-semibold rounded border border-gray-200 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Dispo: Aujourd'hui
          </span>
          <span className="px-2 py-1 bg-gray-50 text-gray-700 text-xs font-semibold rounded border border-gray-200">
            Frais: {doctor.fee ? `${doctor.fee} FBU` : 'Sur demande'}
          </span>
        </div>

        <button 
          onClick={() => onBook(doctor)}
          className="w-full sm:w-auto px-4 py-2 bg-white border border-teal-600 text-teal-600 hover:bg-teal-50 font-medium rounded-lg transition flex items-center justify-center gap-2 text-sm"
        >
          Prendre Rendez-vous <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
