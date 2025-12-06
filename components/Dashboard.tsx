import React, { useState } from 'react';
import { Patient, ESILevel } from '../types';
import { Clock, Activity, User, PieChart, BarChart3, Database, LogOut, CheckCircle, RefreshCw } from 'lucide-react';

interface DashboardProps {
  queue: Patient[];
  onNewTriage: () => void;
  onSelectPatient: (p: Patient) => void;
  onLogout: () => void;
}

const getAcuityColor = (level: ESILevel) => {
  switch (level) {
    case ESILevel.LEVEL_1: return 'bg-red-500 text-white border-red-600';
    case ESILevel.LEVEL_2: return 'bg-orange-500 text-white border-orange-600';
    case ESILevel.LEVEL_3: return 'bg-yellow-400 text-black border-yellow-500';
    case ESILevel.LEVEL_4: return 'bg-green-500 text-white border-green-600';
    case ESILevel.LEVEL_5: return 'bg-blue-500 text-white border-blue-600';
    default: return 'bg-slate-200 text-slate-800';
  }
};

const Dashboard: React.FC<DashboardProps> = ({ queue, onNewTriage, onSelectPatient, onLogout }) => {
  const [showStats, setShowStats] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const sortedQueue = [...queue].sort((a, b) => a.triageLevel - b.triageLevel);

  // 10. Feature: Analytics Dashboard Calculation
  const stats = {
      total: queue.length,
      avgWait: queue.length > 0 ? Math.round(queue.reduce((acc, p) => acc + (new Date().getTime() - p.arrivalTime.getTime()) / 60000, 0) / queue.length) : 0,
      levelCounts: [1,2,3,4,5].map(l => queue.filter(p => p.triageLevel === l).length),
      criticalCount: queue.filter(p => p.triageLevel <= 2).length
  };

  // 4. Feature: EHR/HIS Integration Mock
  const handleSync = () => {
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/20">
             <Activity className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">ED Triage Board</h1>
            <div className="flex items-center gap-2 mt-0.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-xs text-slate-500 font-medium">{queue.length} Active Patients</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={handleSync}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Sync to EHR"
            >
               {isSyncing ? <RefreshCw size={20} className="animate-spin" /> : <Database size={20} />}
            </button>
            <button 
                onClick={() => setShowStats(!showStats)}
                className={`p-2 rounded-lg transition ${showStats ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                title="Analytics"
            >
                <BarChart3 size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200 mx-1"></div>
            <button 
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Logout"
            >
                <LogOut size={20} />
            </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
          
        {/* Analytics Overlay */}
        {showStats && (
            <div className="absolute inset-x-0 top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 p-6 animate-in slide-in-from-top-4 shadow-lg">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <PieChart className="text-blue-500" size={20}/> Real-Time Department Analytics
                        </h2>
                        <button onClick={() => setShowStats(false)} className="text-sm text-blue-600 hover:underline">Close</button>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-xs text-slate-500 uppercase font-bold">Total Census</p>
                            <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-xs text-slate-500 uppercase font-bold">Avg Wait Time</p>
                            <p className="text-3xl font-bold text-slate-900">{stats.avgWait}<span className="text-sm font-normal text-slate-400 ml-1">min</span></p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                            <p className="text-xs text-red-500 uppercase font-bold">Critical (L1-L2)</p>
                            <p className="text-3xl font-bold text-red-700">{stats.criticalCount}</p>
                        </div>
                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-end">
                            <div className="flex items-end gap-1 h-12">
                                {stats.levelCounts.map((count, i) => (
                                    <div key={i} className="flex-1 bg-blue-200 rounded-t-sm relative group" style={{ height: `${Math.max(10, (count / (stats.total || 1)) * 100)}%`}}>
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-500">{count}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1 px-1">
                                <span>L1</span><span>L5</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="h-full overflow-y-auto p-6">
            {sortedQueue.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <User size={48} className="opacity-20 text-slate-900"/>
                </div>
                <p className="text-xl font-medium">No patients in queue</p>
                <p className="text-sm">Tap "New Triage" to begin assessment</p>
            </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                {sortedQueue.map(patient => (
                <div 
                    key={patient.id}
                    onClick={() => onSelectPatient(patient)}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 cursor-pointer hover:shadow-md transition group relative overflow-hidden"
                >
                    {/* Acuity Strip */}
                    <div className={`absolute top-0 left-0 w-2 h-full ${getAcuityColor(patient.triageLevel).split(' ')[0]}`}></div>
                    
                    <div className="pl-4">
                    <div className="flex justify-between items-start mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getAcuityColor(patient.triageLevel)}`}>
                        ESI {patient.triageLevel}
                        </span>
                        <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Clock size={12} />
                        {Math.floor((new Date().getTime() - patient.arrivalTime.getTime()) / 60000)}m
                        </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">
                        {patient.name || `Unknown`}
                    </h3>
                    <p className="text-slate-600 text-sm mb-3 line-clamp-2 min-h-[2.5em] font-medium">
                        {patient.chiefComplaint}
                    </p>
                    
                    {/* Truncated Rationale */}
                    <div className="bg-slate-50 p-2 rounded-lg mb-4">
                        <p className="text-xs text-slate-500 line-clamp-2 italic">
                        "{patient.rationale}"
                        </p>
                    </div>

                    {/* Vitals Mini Grid */}
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                        <div className="flex flex-col items-center">
                        <span className="uppercase text-[10px] font-bold text-slate-400">HR</span>
                        <span className="font-mono text-slate-700 font-bold">{patient.vitals?.hr || '--'}</span>
                        </div>
                        <div className="flex flex-col items-center">
                        <span className="uppercase text-[10px] font-bold text-slate-400">BP</span>
                        <span className="font-mono text-slate-700 font-bold">{patient.vitals?.bpSystolic ? `${patient.vitals.bpSystolic}/${patient.vitals.bpDiastolic}` : '--'}</span>
                        </div>
                        <div className="flex flex-col items-center">
                        <span className="uppercase text-[10px] font-bold text-slate-400">SpO2</span>
                        <span className={`font-mono font-bold ${patient.vitals?.o2 && patient.vitals.o2 < 95 ? 'text-red-500' : 'text-slate-700'}`}>
                            {patient.vitals?.o2 || '--'}%
                        </span>
                        </div>
                    </div>
                    </div>
                </div>
                ))}
            </div>
            )}
        </div>
      </main>

      {/* Floating Action Button */}
      <button 
          onClick={onNewTriage}
          className="absolute bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-blue-600/30 transition transform hover:scale-105 active:scale-95 flex items-center gap-2 z-30"
        >
          <Activity size={24} />
          <span>New Assessment</span>
      </button>

      {/* EHR Sync Toast Mock */}
      {isSyncing && (
          <div className="absolute bottom-6 left-6 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2 z-50">
              <RefreshCw className="animate-spin text-blue-400" size={18} />
              <div className="text-sm">
                  <p className="font-bold">Syncing with Hospital EHR...</p>
                  <p className="text-slate-400 text-xs">Pushing HL7 messages</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;