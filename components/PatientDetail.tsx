
import React from 'react';
import { Patient, ESILevel } from '../types';
import { ArrowLeft, User, Heart, Activity, AlertTriangle, FileText } from 'lucide-react';

interface PatientDetailProps {
  patient: Patient;
  onBack: () => void;
}

const PatientDetail: React.FC<PatientDetailProps> = ({ patient, onBack }) => {
  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition">
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <div>
           <h1 className="text-xl font-bold text-slate-900">Patient Details</h1>
           <p className="text-sm text-slate-500">ID: {patient.id.slice(0, 8)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
        
        {/* Acuity Banner */}
        <div className={`p-6 rounded-2xl shadow-lg flex items-center justify-between
          ${patient.triageLevel === 1 ? 'bg-gradient-to-r from-red-600 to-red-500 text-white' :
            patient.triageLevel === 2 ? 'bg-gradient-to-r from-orange-500 to-orange-400 text-white' :
            patient.triageLevel === 3 ? 'bg-gradient-to-r from-yellow-400 to-yellow-300 text-slate-900' : // Yellow
            patient.triageLevel === 4 ? 'bg-gradient-to-r from-green-600 to-green-500 text-white' : // Green
            'bg-gradient-to-r from-blue-600 to-blue-500 text-white' // Blue
          }`}>
           <div>
              <p className="opacity-80 font-bold uppercase tracking-wider text-sm mb-1">ESI Acuity Level</p>
              <h2 className="text-4xl font-bold">{patient.triageLevel} - {
                 patient.triageLevel === 1 ? 'Resuscitation' : 
                 patient.triageLevel === 2 ? 'Emergent' : 
                 patient.triageLevel === 3 ? 'Urgent' : 
                 patient.triageLevel === 4 ? 'Less Urgent' : 'Non-Urgent'
              }</h2>
           </div>
           <Activity size={48} className="opacity-20" />
        </div>

        {/* Clinical Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <div className="flex items-center gap-2 mb-4">
                <User className="text-blue-600" size={20} />
                <h3 className="font-bold text-slate-800">Demographics</h3>
             </div>
             <div className="space-y-3">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                   <span className="text-slate-500">Age</span>
                   <span className="font-medium text-slate-900">{patient.age || 'Unknown'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                   <span className="text-slate-500">Gender</span>
                   <span className="font-medium text-slate-900">{patient.gender || 'Unknown'}</span>
                </div>
                <div className="flex justify-between pb-2">
                   <span className="text-slate-500">Arrival</span>
                   <span className="font-medium text-slate-900">{patient.arrivalTime.toLocaleTimeString()}</span>
                </div>
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <div className="flex items-center gap-2 mb-4">
                <Heart className="text-red-500" size={20} />
                <h3 className="font-bold text-slate-800">Vital Signs</h3>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                   <p className="text-xs text-slate-500 uppercase font-bold">Heart Rate</p>
                   <p className="text-xl font-mono font-bold text-slate-800">{patient.vitals?.hr || '--'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                   <p className="text-xs text-slate-500 uppercase font-bold">BP</p>
                   <p className="text-xl font-mono font-bold text-slate-800">{patient.vitals?.bpSystolic ? `${patient.vitals.bpSystolic}/${patient.vitals.bpDiastolic}` : '--/--'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                   <p className="text-xs text-slate-500 uppercase font-bold">O2 Sat</p>
                   <p className={`text-xl font-mono font-bold ${patient.vitals?.o2 && patient.vitals.o2 < 94 ? 'text-red-600' : 'text-slate-800'}`}>
                     {patient.vitals?.o2 || '--'}%
                   </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                   <p className="text-xs text-slate-500 uppercase font-bold">Pain (0-10)</p>
                   <p className="text-xl font-mono font-bold text-slate-800">{patient.vitals?.painScale ?? '--'}</p>
                </div>
             </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 mb-4">
              <FileText className="text-purple-600" size={20} />
              <h3 className="font-bold text-slate-800">Triage Assessment</h3>
           </div>
           <div className="prose prose-slate max-w-none">
             <h4 className="text-sm font-bold text-slate-500 uppercase">Chief Complaint</h4>
             <p className="text-lg font-medium text-slate-900 mb-4">{patient.chiefComplaint}</p>
             
             <h4 className="text-sm font-bold text-slate-500 uppercase">AI Rationale</h4>
             <p className="text-slate-700 bg-blue-50 p-4 rounded-lg border border-blue-100">
               {patient.rationale}
             </p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default PatientDetail;
