
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { TriageResult, ESILevel } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, PCM_SAMPLE_RATE_INPUT, PCM_SAMPLE_RATE_OUTPUT } from '../utils/audioUtils';
import { MicOff, AlertCircle, CheckCircle, Activity, X, ClipboardList, Stethoscope, FileHeart, Save, MessageSquareWarning, User, Loader2 } from 'lucide-react';

interface LiveTriageSessionProps {
  onComplete: (result: TriageResult) => void;
  onCancel: () => void;
}

// System instruction for the triage bot with ISBAR technique
const TRIAGE_SYSTEM_INSTRUCTION = `
You are an advanced Emergency Triage AI Assistant.
Adopt the ISBAR (Identity, Situation, Background, Assessment, Recommendation) communication technique.

PROTOCOL:
1. **IDENTITY**: START by asking for the Patient's Name and Age.
2. **SITUATION**: Ask for the chief complaint.
3. **BACKGROUND**: Ask for relevant history and vitals.
4. **ASSESSMENT**: Ask discriminators to rule out red flags.
5. **RECOMMENDATION**: Converge on an ESI Level (1-5).

FINALIZATION:
When the user says "Finalize" or clicks the button:
1. **SPEAK** a concise summary of the assessment.
2. **IMMEDIATELY** output the JSON object below.
3. Do NOT add any text *after* the JSON.

JSON FORMAT:
{
  "patientName": "string",
  "triageLevel": number,
  "rationale": "string",
  "summary": "string",
  "recommendedResources": ["string"],
  "extractedVitals": { "hr": 0, "bpSystolic": 0, "bpDiastolic": 0, "o2": 0, "temp": 0, "rr": 0, "painScale": 0 }
}
`;

const getAcuityColor = (level: ESILevel) => {
  switch (level) {
    case ESILevel.LEVEL_1: return 'bg-red-600 border-red-700 text-white'; // Immediate
    case ESILevel.LEVEL_2: return 'bg-orange-500 border-orange-600 text-white'; // Emergent
    case ESILevel.LEVEL_3: return 'bg-yellow-400 border-yellow-500 text-slate-900'; // Urgent (Yellow)
    case ESILevel.LEVEL_4: return 'bg-green-600 border-green-700 text-white'; // Less Urgent (Green)
    case ESILevel.LEVEL_5: return 'bg-blue-500 border-blue-600 text-white'; // Non-Urgent (Blue)
    default: return 'bg-slate-500 text-white';
  }
};

const LiveTriageSession: React.FC<LiveTriageSessionProps> = ({ onComplete, onCancel }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [aiProgress, setAiProgress] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Editable Name State
  const [editedName, setEditedName] = useState("");

  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Playback Refs
  const nextStartTimeRef = useRef<number>(0);
  const responseStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // UI Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Gemini Session Ref
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const connectingRef = useRef(false);
  const currentModelResponseRef = useRef<string>('');
  const currentUserInputRef = useRef<string>('');

  const cleanupAudio = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputAnalyserRef.current) {
      inputAnalyserRef.current.disconnect();
      inputAnalyserRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (inputContextRef.current) {
      if (inputContextRef.current.state !== 'closed') {
        inputContextRef.current.close();
      }
      inputContextRef.current = null;
    }
    if (audioContextRef.current) {
       if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    // Stop all playing sources
    sourcesRef.current.forEach(src => {
      try { src.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
  }, []);

  const visualize = () => {
    // 1. User Audio Visualization
    if (canvasRef.current && inputAnalyserRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const analyser = inputAnalyserRef.current;
      
      if (ctx) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Styling
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        // Draw centered bars
        const barsToDraw = 20; // Reduce detail for cleaner UI
        const step = Math.floor(bufferLength / barsToDraw);

        for (let i = 0; i < barsToDraw; i++) {
          const value = dataArray[i * step];
          barHeight = (value / 255) * canvas.height;

          ctx.fillStyle = `rgb(${Math.round(59)}, ${Math.round(130)}, ${Math.round(246)})`; // Blue-500
          
          // Draw rounded bars centered vertically
          const y = (canvas.height - barHeight) / 2;
          
          // Draw
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth - 2, barHeight, 4);
          ctx.fill();

          x += barWidth;
        }
      }
    }

    // 2. AI Playback Progress Logic
    if (audioContextRef.current) {
      const now = audioContextRef.current.currentTime;
      const end = nextStartTimeRef.current;
      const start = responseStartTimeRef.current;
      
      // If playhead is within the scheduled window
      if (now < end && end > start) {
        setIsAiSpeaking(true);
        const duration = end - start;
        const progress = duration > 0 ? (now - start) / duration : 0;
        setAiProgress(Math.min(100, Math.max(0, progress * 100)));
      } else {
        // If we reached the end or haven't started
        if (isAiSpeaking && now >= end) {
             setIsAiSpeaking(false);
             setAiProgress(0);
        }
      }
    }

    rafIdRef.current = requestAnimationFrame(visualize);
  };

  const connect = async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;

    try {
      cleanupAudio(); // Ensure clean slate
      setError(null);

      if (!process.env.API_KEY) {
        throw new Error("API Key missing");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Setup Audio Contexts
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE_INPUT });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE_OUTPUT });
      
      // Request Mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1,
        sampleRate: PCM_SAMPLE_RATE_INPUT,
      }});
      streamRef.current = stream;

      // Connect to Gemini
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: TRIAGE_SYSTEM_INSTRUCTION,
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {}, 
          outputAudioTranscription: {}, 
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connection Opened');
            setIsConnected(true);
            setIsRecording(true);
            setupAudioProcessing(stream);
            visualize();
          },
          onmessage: handleMessage,
          onclose: () => {
            console.log('Gemini Live Connection Closed');
            setIsConnected(false);
            setIsRecording(false);
            connectingRef.current = false;
          },
          onerror: (err) => {
            console.error('Gemini Live Error', err);
            if (connectingRef.current || isConnected) {
                setError("Connection error. Please check your network and try again.");
                setIsConnected(false);
            }
            connectingRef.current = false;
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      await sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to initialize triage session.");
      connectingRef.current = false;
      setIsConnected(false);
    }
  };

  const setupAudioProcessing = (stream: MediaStream) => {
    if (!inputContextRef.current) return;
    
    const source = inputContextRef.current.createMediaStreamSource(stream);
    
    // Insert Analyser
    const analyser = inputContextRef.current.createAnalyser();
    analyser.fftSize = 64; // Low resolution for simple visualizer
    source.connect(analyser);
    inputAnalyserRef.current = analyser;

    // Buffer size 4096 is standard for this sample rate to balance latency and performance
    const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      if (!sessionPromiseRef.current) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      sessionPromiseRef.current.then(session => {
        try {
            session.sendRealtimeInput({ media: pcmBlob });
        } catch (e) {
            console.debug("Error sending input", e);
        }
      }).catch(() => {
          // Ignore errors from the promise if the session failed to start
      });
    };

    // Chain: Source -> Analyser -> Processor -> Destination
    analyser.connect(processor);
    processor.connect(inputContextRef.current.destination);
    
    sourceRef.current = source;
    processorRef.current = processor;
  };

  // Robust JSON Extraction: Counts braces to handle trailing text
  const extractJSON = (text: string): TriageResult | null => {
      let startIndex = text.indexOf('{');
      if (startIndex === -1) return null;

      let braceCount = 0;
      let endIndex = -1;
      
      for (let i = startIndex; i < text.length; i++) {
          if (text[i] === '{') braceCount++;
          else if (text[i] === '}') braceCount--;

          if (braceCount === 0) {
              endIndex = i;
              break;
          }
      }

      if (endIndex !== -1) {
          const jsonStr = text.substring(startIndex, endIndex + 1);
          try {
              return JSON.parse(jsonStr) as TriageResult;
          } catch (e) {
              console.warn("Extracted JSON failed validation", e);
              return null;
          }
      }
      return null;
  };

  const handleMessage = async (message: LiveServerMessage) => {
    // 1. Handle Transcriptions
    if (message.serverContent?.inputTranscription) {
      currentUserInputRef.current += message.serverContent.inputTranscription.text;
    }
    if (message.serverContent?.outputTranscription) {
      currentModelResponseRef.current += message.serverContent.outputTranscription.text;
    }

    if (message.serverContent?.turnComplete) {
      if (currentUserInputRef.current) {
        setTranscript(prev => [...prev, { role: 'user', text: currentUserInputRef.current }]);
        currentUserInputRef.current = '';
      }
      
      if (currentModelResponseRef.current) {
        const text = currentModelResponseRef.current.trim();
        setTranscript(prev => [...prev, { role: 'model', text: text }]);
        
        // Attempt to extract JSON from the text
        const result = extractJSON(text);
        
        if (result) {
            console.log("Parsed Triage Result:", result);
            setTriageResult(result);
            setIsFinalizing(false);
            if (result.patientName && result.patientName !== 'Unknown' && result.patientName !== 'string') {
                setEditedName(result.patientName);
            }
        } else if (isFinalizing) {
             // If we expected JSON but didn't get it
             console.warn("Expected JSON but found none.");
             setShowToast("Parsing incomplete. Please try 'Finalize' again.");
             setTimeout(() => setShowToast(null), 3000);
             setIsFinalizing(false);
        }
        currentModelResponseRef.current = '';
      }
    }

    // 2. Handle Audio Output
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && audioContextRef.current) {
      try {
        const ctx = audioContextRef.current;
        const now = ctx.currentTime;
        
        if (nextStartTimeRef.current < now) {
            nextStartTimeRef.current = now;
            responseStartTimeRef.current = now;
        }

        const audioBuffer = await decodeAudioData(
            base64ToUint8Array(audioData),
            ctx,
            PCM_SAMPLE_RATE_OUTPUT
        );
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        source.addEventListener('ended', () => {
          sourcesRef.current.delete(source);
        });
        
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        sourcesRef.current.add(source);
      } catch (err) {
        console.error("Audio decode error", err);
      }
    }

    // 3. Handle Interruptions
    if (message.serverContent?.interrupted) {
      sourcesRef.current.forEach(src => src.stop());
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
      responseStartTimeRef.current = 0;
      currentModelResponseRef.current = '';
      setIsAiSpeaking(false);
      setAiProgress(0);
    }
  };

  const triggerFinalize = () => {
      // Since SDK doesn't support sending text commands in this version for Live sessions easily,
      // we prompt the user to use the voice command which is part of the system instruction.
      setIsFinalizing(true);
      setShowToast("Please say: 'Finalize Assessment'");
      
      // Auto-hide prompt
      setTimeout(() => setShowToast(null), 4000);

      // Safety timeout: If no result comes back in 15 seconds, reset button
      setTimeout(() => {
          setIsFinalizing(prev => {
              if (prev && !triageResult) return false;
              return prev;
          });
      }, 15000);
  };

  const confirmResult = () => {
    if (triageResult) {
      onComplete({
          ...triageResult,
          patientName: editedName || triageResult.patientName
      });
    }
  };

  const resumeSession = () => {
    setTriageResult(null);
  };

  useEffect(() => {
    connect();
    
    return () => {
       sessionPromiseRef.current?.then(session => session.close()).catch(() => {});
       cleanupAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        
        {/* Toast Notification */}
        {showToast && (
             <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
                 {isFinalizing ? <Loader2 size={20} className="animate-spin text-blue-400" /> : <MessageSquareWarning size={20} className="text-yellow-400" />}
                 {showToast}
             </div>
        )}

        {/* Header */}
        <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
             <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
             <h2 className="text-xl font-bold">Live ISBAR Triage</h2>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-blue-700 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        {/* Triage Result Overlay */}
        {triageResult ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 animate-in slide-in-from-bottom duration-500">
             <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center p-4 bg-white rounded-full shadow-lg mb-4">
                  <CheckCircle size={48} className="text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Assessment Finalized</h2>
                <p className="text-slate-500">Please review the findings below</p>
             </div>

             {/* Patient Name Input */}
             <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                 <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                     <User size={24} />
                 </div>
                 <div className="flex-1">
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Patient Name</label>
                     <input 
                        type="text" 
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Enter Patient Name"
                        className="w-full text-lg font-bold text-slate-900 border-none p-0 focus:ring-0 placeholder:text-slate-300"
                     />
                 </div>
             </div>

             <div className={`p-6 rounded-xl border-l-8 shadow-sm mb-6 ${getAcuityColor(triageResult.triageLevel)}`}>
               <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider opacity-90">Recommended Acuity</h3>
                    <div className="text-4xl font-extrabold mt-1">
                      ESI Level {triageResult.triageLevel}
                    </div>
                  </div>
                  <Activity size={40} className="opacity-25" />
               </div>
             </div>

             <div className="space-y-4">
               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                 <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-2">
                   <ClipboardList size={18} className="text-blue-500" />
                   Rationale
                 </h4>
                 <p className="text-slate-600 leading-relaxed">{triageResult.rationale}</p>
               </div>

               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                 <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                   <Stethoscope size={18} className="text-blue-500" />
                   Recommended Next Steps
                 </h4>
                 <div className="flex flex-wrap gap-2">
                   {triageResult.recommendedResources.map((res, i) => (
                     <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                       {res}
                     </span>
                   ))}
                   {triageResult.recommendedResources.length === 0 && (
                     <span className="text-slate-400 italic text-sm">No specific resources recommended.</span>
                   )}
                 </div>
               </div>

                {triageResult.extractedVitals && (
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                     <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                       <FileHeart size={18} className="text-red-500" />
                       Recorded Vitals
                     </h4>
                     <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-slate-50 p-2 rounded">
                          <div className="text-xs text-slate-400 font-bold">HR</div>
                          <div className="font-mono font-bold text-slate-700">{triageResult.extractedVitals.hr || '-'}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded">
                          <div className="text-xs text-slate-400 font-bold">BP</div>
                          <div className="font-mono font-bold text-slate-700">
                             {triageResult.extractedVitals.bpSystolic ? `${triageResult.extractedVitals.bpSystolic}/${triageResult.extractedVitals.bpDiastolic}` : '-'}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded">
                          <div className="text-xs text-slate-400 font-bold">O2</div>
                          <div className="font-mono font-bold text-slate-700">{triageResult.extractedVitals.o2 || '-'}%</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded">
                          <div className="text-xs text-slate-400 font-bold">Pain</div>
                          <div className="font-mono font-bold text-slate-700">{triageResult.extractedVitals.painScale || '-'}</div>
                        </div>
                     </div>
                  </div>
                )}
             </div>
          </div>
        ) : (
          /* Live Chat Area */
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50 relative">
            {error && (
              <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

            {transcript.length === 0 && !error && (
              <div className="text-center text-slate-400 mt-16">
                 <Activity size={48} className="mx-auto mb-4 text-blue-500 animate-pulse" />
                 <h3 className="text-xl font-bold text-slate-700 mb-2">Triage Assistant Ready</h3>
                 <p className="text-lg text-slate-600 max-w-md mx-auto mb-8">
                   Start by saying: <span className="font-bold text-blue-600">"This is patient [Name] with..."</span>
                 </p>
                 
                 <div className="flex justify-center gap-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                       <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                          <User size={20} />
                       </div>
                       Identity
                    </div>
                    <div className="w-8 h-px bg-slate-300 mt-5"></div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                          <ClipboardList size={20} />
                      </div>
                      Situation
                    </div>
                    <div className="w-8 h-px bg-slate-300 mt-5"></div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                          <FileHeart size={20} />
                      </div>
                      Background
                    </div>
                 </div>
              </div>
            )}

            {transcript.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-100 text-blue-900 rounded-tr-none' 
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                }`}>
                  <p className="font-semibold text-xs mb-1 opacity-70 uppercase tracking-wider">
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </p>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Controls */}
        <div className="p-6 bg-white border-t border-slate-100 shrink-0 relative">
           {/* AI Progress Bar */}
           {isAiSpeaking && (
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
                <div 
                  className="h-full bg-blue-500 transition-all duration-100 ease-linear"
                  style={{ width: `${aiProgress}%` }}
                ></div>
              </div>
           )}

           {triageResult ? (
              <div className="flex gap-3 animate-in slide-in-from-bottom duration-300">
                 <button 
                   onClick={resumeSession}
                   className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition"
                 >
                   Resume / Edit
                 </button>
                 <button 
                   onClick={confirmResult}
                   className="flex-[2] py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                 >
                   <Save size={20} />
                   Confirm & Add to Queue
                 </button>
              </div>
           ) : (
             <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                   {/* Audio Visualizer Canvas */}
                   <div className="relative w-12 h-12 flex items-center justify-center bg-slate-100 rounded-full overflow-hidden">
                       <canvas 
                         ref={canvasRef} 
                         width={48} 
                         height={48} 
                         className="absolute inset-0 w-full h-full"
                       />
                       {!isRecording && <MicOff size={20} className="text-slate-400 relative z-10" />}
                   </div>
                   
                   <div className="text-sm">
                      <div className="font-bold text-slate-700">
                         {isRecording ? "Listening..." : "Muted"}
                      </div>
                      <div className="text-xs text-slate-400">
                         {isAiSpeaking ? "AI Speaking" : "Waiting for input"}
                      </div>
                   </div>
                </div>

                <div className="flex gap-3">
                  <button 
                     onClick={onCancel}
                     className="px-6 py-2 rounded-full border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition"
                   >
                    Cancel
                  </button>
                  <button 
                    onClick={triggerFinalize}
                    disabled={isFinalizing}
                    className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold shadow-lg transition transform active:scale-95 ${
                        isFinalizing 
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-500/25'
                    }`}
                  >
                    {isFinalizing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                    {isFinalizing ? 'Finalizing...' : 'Finalize'}
                  </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default LiveTriageSession;
