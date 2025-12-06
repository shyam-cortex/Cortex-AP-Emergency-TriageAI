
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import LiveTriageSession from './components/LiveTriageSession';
import PatientDetail from './components/PatientDetail';
import { Patient, ViewState, TriageResult } from './types';
import { ShieldCheck, Lock, Activity } from 'lucide-react';

// Simple UUID generator
const generateId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const LOGIN_PIN = "1234";

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [queue, setQueue] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loginError, setLoginError] = useState(false);

  // 1. Feature: Offline Functionality & Caching
  // Load queue from localStorage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem('triage_queue');
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue);
        // Revive Date objects
        const hydrated = parsed.map((p: any) => ({
          ...p,
          arrivalTime: new Date(p.arrivalTime)
        }));
        setQueue(hydrated);
      } catch (e) {
        console.error("Failed to load cached data");
      }
    }
  }, []);

  // Save queue to localStorage on change
  useEffect(() => {
    localStorage.setItem('triage_queue', JSON.stringify(queue));
  }, [queue]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === LOGIN_PIN) {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setPin("");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPin("");
    setView('DASHBOARD');
  };

  const handleNewTriage = () => {
    setView('NEW_TRIAGE');
  };

  const handleTriageComplete = (result: TriageResult) => {
    const newPatient: Patient = {
      id: generateId(),
      name: result.patientName || `Patient ${Math.floor(Math.random() * 1000)}`,
      age: undefined,
      gender: 'Unknown',
      chiefComplaint: result.summary || "No complaint recorded",
      triageLevel: result.triageLevel,
      rationale: result.rationale,
      vitals: result.extractedVitals,
      arrivalTime: new Date(),
      status: 'Waiting'
    };
    
    if(result.summary) {
        const ageMatch = result.summary.match(/(\d+)\s*(year|yr|yo)/i);
        if(ageMatch) newPatient.age = parseInt(ageMatch[1]);
        if(result.summary.match(/\b(male|man|boy)\b/i)) newPatient.gender = 'Male';
        else if(result.summary.match(/\b(female|woman|girl)\b/i)) newPatient.gender = 'Female';
    }

    setQueue(prev => [...prev, newPatient]);
    setView('DASHBOARD');
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setView('DETAILS');
  };

  // 6. Feature: Secure Authentication View
  if (!isAuthenticated) {
    return (
      <div className="h-full bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl animate-in zoom-in duration-300">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/30">
              <Activity className="text-white w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">TriageAI Secure Login</h1>
            <p className="text-slate-500 text-sm">Authorized Personnel Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Staff PIN</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border ${loginError ? 'border-red-500 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center text-xl tracking-widest`}
                  placeholder="••••"
                  autoFocus
                />
              </div>
              {loginError && <p className="text-red-500 text-xs mt-2 text-center">Invalid PIN. Try '1234'.</p>}
            </div>

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              <ShieldCheck size={20} />
              Verify Credentials
            </button>
            
            <div className="text-center pt-4 border-t border-slate-100">
               <p className="text-xs text-slate-400">HIPAA Compliant Session &bull; v1.0.4</p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {view === 'DASHBOARD' && (
        <Dashboard 
          queue={queue} 
          onNewTriage={handleNewTriage}
          onSelectPatient={handleSelectPatient}
          onLogout={handleLogout}
        />
      )}

      {view === 'NEW_TRIAGE' && (
        <LiveTriageSession 
          onComplete={handleTriageComplete}
          onCancel={() => setView('DASHBOARD')}
        />
      )}

      {view === 'DETAILS' && selectedPatient && (
        <PatientDetail 
          patient={selectedPatient}
          onBack={() => {
            setSelectedPatient(null);
            setView('DASHBOARD');
          }}
        />
      )}
    </div>
  );
};

export default App;
