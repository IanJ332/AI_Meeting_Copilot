import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

// Interfaces
interface TranscriptItem {
  text: string;
  speaker: string;
  start_ts: string;
  end_ts: string;
  chunk_id: string;
}

interface Suggestion {
  id: string;
  type: string;
  preview: string;
  topic_signature: string;
  expand_seed?: string;
}

interface Batch {
  phase: string;
  suggestions: Suggestion[];
  timestamp: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  details?: any;
  suggestionType?: string;
}

// Use environment variable for API location, fallback to localhost for development
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000/api";

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const isRefreshing = useRef(false);
  
  // Settings
  const [mockCadenceSeconds, setMockCadenceSeconds] = useState(30);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('copilot_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    return {
      groqApiKey: '', 
      livePrompt: 'Extract actionable suggestions...',
      detailPrompt: 'Expand the specific point...',
      chatPrompt: 'You are a helpful copilot...',
      liveContextWindow: 30,
      detailContextWindow: 180
    };
  });

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('copilot_settings', JSON.stringify(settings));
  }, [settings]);

  // 5. Scripted Simulation Engine (Mock Mode Auto-Playback)
  useEffect(() => {
    let simulationInterval: ReturnType<typeof setInterval>;
    
    if (micActive && !settings.groqApiKey && sessionId) {
      console.log("Simulation Engine: Active (Playback mode)");
      simulationInterval = setInterval(() => {
        // Trigger a 'Synthetic Pulse' that calls the transcribe endpoint
        const formData = new FormData();
        formData.append("session_id", sessionId);
        formData.append("settings", JSON.stringify(settings));
        // Empty blob just to satisfy the multipart requirement, backend ignores it in mock mode
        formData.append("audio_data", new Blob([], { type: 'audio/wav' }), "simulation.wav");

        fetch(`${API_BASE}/audio/transcribe`, {
          method: "POST",
          body: formData
        })
        .then(res => res.json())
        .then(data => {
          if (data.text) {
            const text = data.text;
            
            // CORE SYNC: Notify backend of the new transcript line so the suggestion engine can 'hear' it
            fetch(`${API_BASE}/transcript`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: sessionId, text: text })
            });

            // Use the choreographed pacing logic for UI rendering
            setTimeout(() => {
              setTranscript(prev => [...prev, {
                text, speaker: "User", chunk_id: Math.random().toString(), start_ts: new Date().toISOString(), end_ts: new Date().toISOString()
              }]);
              
              setTimeout(() => {
                handleRefresh("auto");
              }, 1500);
            }, 1000);
          }
        });
      }, 7000); // Pulse every 7 seconds for a comfortable demo pace
    }

    return () => {
      if (simulationInterval) clearInterval(simulationInterval);
    };
  }, [micActive, settings.groqApiKey, sessionId, settings]); 

  // Auto-scroll logic for Transcript and Chat
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize session
  useEffect(() => {
    fetch(`${API_BASE}/session/start`, { method: "POST" })
      .then(res => res.json())
      .then(data => setSessionId(data.session_id))
      .catch(err => console.error("Could not init session:", err));
  }, []);

  // Auto-scrolls
  useEffect(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [transcript]);
  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [chat]);

  // Real Mic Loop via MediaRecorder, Whisper API, and Voice Activity Detection (VAD)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTranscriptRef = useRef<string>("");

  useEffect(() => {
    let animationFrameId: number;
    
    // VAD State
    let isSpeaking = false;
    let silenceStart: number | null = null;
    let lastFlushTime = Date.now();
    // Adaptive VAD Timing: Snappy (1.5s) for Mock demo, Intelligent (4.5s) for Real AI
    const SILENCE_THRESHOLD = 10; 
    const SILENCE_DURATION_MS = !settings.groqApiKey ? 1500 : 4500;
    const MAX_CHUNK_MS = 28000;

    if (micActive && sessionId) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioContext;
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);

          const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = mediaRecorder;
          
          let audioChunks: Blob[] = [];
          
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
          };

          mediaRecorder.onstop = () => {
            if (audioChunks.length > 0) {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              audioChunks = [];
              const formData = new FormData();
              formData.append("audio_data", audioBlob, "chunk.webm");
              formData.append("settings", JSON.stringify(settings));
              if (lastTranscriptRef.current) {
                  // Keep only the last 10 words to give Whisper context for punctuation, 
                  // but prevent it from hallucinating the end of the sentence (e.g. "business trip")
                  const words = lastTranscriptRef.current.split(' ');
                  const trailingContext = words.slice(-10).join(' ');
                  formData.append("prompt", trailingContext);
              }

              fetch(`${API_BASE}/audio/transcribe`, {
                method: "POST",
                body: formData
              })
              .then(res => res.json())
              .then(data => {
                if (data.error) {
                  console.error("Transcription Error:", data.error);
                  if (data.error.includes("401") || data.error.includes("API Key")) {
                    alert("⚠️ Authentication Error: Your Groq API Key is invalid or expired. Please check Settings.");
                  } else if (data.error.includes("429")) {
                    alert("⚠️ Rate Limit: Groq API is throttled. Please wait a moment.");
                  }
                  return;
                }
                
                if (data.text && data.text.trim()) {
                  const text = data.text.trim();
                  
                  // Filter out Whisper V3 silence hallucination artifacts
                  const stripped = text.toLowerCase().replace(/[^a-z]/g, '');
                  const isHallucination = ['you', 'thankyou', 'thanks', 'yeah', 'yes'].includes(stripped);
                  
                  if (!isHallucination) {
                    // REAL AI MODE: Sync and fire suggestions for real voice input
                    // Note: Mock Mode is now handled exclusively by the Scripted Simulation Engine loop
                    if (settings.groqApiKey) {
                      setTranscript(prev => {
                        const lastLine = (prev[prev.length - 1]?.text || "").trim();
                        if (lastLine && (text.includes(lastLine) || lastLine.includes(text) || text === lastLine)) {
                          return prev;
                        }

                        fetch(`${API_BASE}/transcript`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ session_id: sessionId, text: text })
                        });
                        
                        handleRefresh("auto");

                        return [...prev, {
                          text, speaker: "User", chunk_id: Math.random().toString(), start_ts: new Date().toISOString(), end_ts: new Date().toISOString()
                        }];
                      });
                    }
                    lastTranscriptRef.current = text;
                  }
                }
              })
              .catch(err => {
                console.error("Audio upload failed", err);
                // Only alert on critical network/auth issues, not every chunk retry
                if (micActive) alert("⚠️ Critical Connection Error: Could not reach the AI server.");
              });
            }
          };

          mediaRecorder.start();
          isSpeaking = false;
          silenceStart = Date.now();
          lastFlushTime = Date.now();

          const triggerFlush = () => {
             if (mediaRecorder.state === "recording") {
               mediaRecorder.stop();
               mediaRecorder.start();
             }
             isSpeaking = false;
             silenceStart = Date.now();
             lastFlushTime = Date.now();
          };

          const detectAudio = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const rms = Math.sqrt(sum / bufferLength);
            const now = Date.now();

            if (rms > SILENCE_THRESHOLD) {
                isSpeaking = true;
                silenceStart = null;
            } else {
                if (silenceStart === null) silenceStart = now;
            }

            // Flush Condition 1: Pause detected after speaking
            if (isSpeaking && silenceStart && (now - silenceStart > SILENCE_DURATION_MS)) {
                // Avoid tiny fraction chunks
                if (now - lastFlushTime > 2000) {
                   triggerFlush();
                } else {
                   silenceStart = now; 
                }
            }
            // Flush Condition 2: Max time exceeded
            else if (now - lastFlushTime > MAX_CHUNK_MS) {
                triggerFlush();
            }

            animationFrameId = requestAnimationFrame(detectAudio);
          };
          
          detectAudio();

        }).catch(err => {
            console.error("Mic access denied", err);
            setMicActive(false);
        });
    } else {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close().catch(() => {});
        }
    }
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
      }
    };
  }, [micActive, sessionId]);

  // Auto-refresh loop
  useEffect(() => {
    let autoInterval: ReturnType<typeof setInterval>;
    if (autoRefresh && micActive && sessionId) {
      autoInterval = setInterval(() => {
        handleRefresh("auto");
      }, mockCadenceSeconds * 1000);
    }
    return () => {
      if (autoInterval) clearInterval(autoInterval);
    };
  }, [autoRefresh, micActive, sessionId, mockCadenceSeconds]);

  const handleRefresh = async (mode: "auto" | "manual" = "manual") => {
    if (!sessionId || isRefreshing.current) return;
    
    isRefreshing.current = true;
    setIsLoading(true);
    setRefreshError(null);
    
    try {
      const res = await fetch(`${API_BASE}/suggestions/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          session_id: sessionId,
          refresh_mode: mode,
          settings: settings
        })
      });
      
      if (!res.ok) {
         const errData = await res.json().catch(() => ({}));
         const errMsg = errData.error || `API Error ${res.status}`;
         if (res.status === 401) alert("⚠️ Authentication Error: Invalid Groq API Key. Please check your Settings.");
         else if (res.status === 429) alert("⚠️ Rate Limit: Groq API is throttled. Fallback data might be displayed.");
         throw new Error(errMsg);
      }
      
      const data = await res.json();
      console.log("Suggestions API response:", data);
      
      if (data.error) {
        setRefreshError(data.error);
        if (data.error.includes("401")) alert("⚠️ API Key Error: Your key was rejected by Groq.");
        console.error("Refresh error:", data.error);
      } else if (data.status === "not-ready") {
        console.log("Harness not ready:", data.message);
      } else if (data.suggestions) {
         setRefreshError(null);
         setBatches(prev => [{ phase: data.current_phase, suggestions: data.suggestions, timestamp: new Date().toLocaleTimeString() }, ...prev]);
      } else {
         throw new Error("Invalid response schema: missing suggestions array");
      }
    } catch (err: any) {
      setRefreshError(err.message || JSON.stringify(err));
      console.error("Frontend caught error:", err);
    } finally {
      setIsLoading(false);
      isRefreshing.current = false;
    }
  };

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    if (!sessionId) return;
    
    const newUserMsg = { 
      role: 'user', 
      content: suggestion.preview,
      timestamp: new Date().toISOString(),
      suggestionType: suggestion.type
    };
    
    // Add to chat immediately
    setChat(prev => [...prev, newUserMsg as any]);
    
    const currentChatSnapshot = [...chat, newUserMsg];
    
    try {
      const res = await fetch(`${API_BASE}/suggestions/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, suggestion, settings, chat_history: currentChatSnapshot })
      });
      
      if (!res.ok) {
         const errData = await res.json().catch(() => ({}));
         if (res.status === 401) alert("⚠️ Authentication Error: Your Groq API Key is invalid.");
         else alert("⚠️ Expansion Failed: " + (errData.error || "Connection issue"));
         return;
      }

      const data = await res.json();
      
      const handoffObj = data.handoff || data;
      let expansionContent = data.detail_response;
      
      if (!expansionContent) {
        expansionContent = "### ⚠ Rate Limit / Connection Timeout\n\nI encountered a challenge while generating the detailed response. This is usually due to the Token-Per-Minute (TPM) limits on the free Groq API. Please wait 5-10 seconds and click the card again to retry.";
      }

      setChat(prev => [...prev, { 
        role: 'assistant', 
        content: expansionContent, 
        timestamp: new Date().toISOString(),
        details: handoffObj 
      }]);
      
    } catch (err) {
      console.error(err);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const exportSession = async () => {
    if (!sessionId) return;
    setIsExporting(true);

    try {
      // Phase 1: Request AI Intelligence Report from backend
      let intelligenceReport = null;
      try {
        const reportRes = await fetch(`${API_BASE}/session/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            settings: settings,
            chat_history: chat
          })
        });
        if (reportRes.ok) {
          const reportData = await reportRes.json();
          intelligenceReport = reportData.report;
        }
      } catch (reportErr) {
        console.warn("Intelligence report generation failed, exporting raw data only:", reportErr);
      }

      // Phase 2: Bundle everything into the final export package
      const exportData = {
        session_id: sessionId,
        exported_at: new Date().toISOString(),
        // AI-Generated Intelligence Report (the "memory" layer)
        intelligence_report: intelligenceReport,
        // Raw Session Data
        transcript,
        rendered_batches: batches,
        chat_history: chat,
        settings_snapshot: settings
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meeting-session-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) {
      console.error("Export failed", err);
      alert("Failed to export session data.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !sessionId) return;

    const message = userInput.trim();
    setUserInput("");

    // Optimistic Update
    const userMsg: ChatMessage = { role: 'user', content: message, timestamp: new Date().toISOString() };
    setChat(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: message,
          chat_history: chat,
          settings: settings
        })
      });

      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();
      
      setChat(prev => [...prev, {
        role: 'assistant',
        content: data.response || "No response received",
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChat(prev => [...prev, {
        role: 'assistant',
        content: "⚠️ I encountered an error while processing your request.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="app-container">
        {/* LEFT COLUMN: Transcript */}
        <div className="column">
          <div className="column-header">
            <span style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
              Live Transcript
              {!settings.groqApiKey && (
                <span className="badge" style={{background: '#f59e0b', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.4rem'}}>SIMULATION MODE</span>
              )}
            </span>
            <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
              {micActive && <span className="blinking-dot"></span>}
              <button className={micActive ? 'danger' : 'primary'} onClick={() => setMicActive(!micActive)}>
                {micActive ? 'Stop Mic' : 'Start Mic'}
              </button>
            </div>
          </div>
          <div className="column-body">
            {transcript.length === 0 && <div className="placeholder-text">Transcript will stream here when mic is active...</div>}
            {transcript.slice(-500).map(t => (
              <div className="transcript-line" key={t.chunk_id}>
                <span className="timestamp">{new Date(t.start_ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                <span className="speaker">{t.speaker}:</span>
                <span>{t.text}</span>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
          <div style={{padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem', color: '#9aa0a6'}}>
            Whisper V3 Processing Cadence: Smart VAD (4.5s Pause / 28s Max)
          </div>
        </div>

        {/* MIDDLE COLUMN: Suggestions */}
        <div className="column">
          <div className="column-header">
            <span style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
              Live Suggestions 
              {autoRefresh && <span className="badge">Auto-Refresh ON</span>}
            </span>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button 
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{borderColor: autoRefresh ? '#10b981' : undefined, color: autoRefresh ? '#10b981' : undefined}}
              >
                {autoRefresh ? `Auto (${mockCadenceSeconds}s)` : 'Enable Auto'}
              </button>
              <button className="primary" onClick={() => handleRefresh("manual")} disabled={isLoading}>
                {isLoading ? 'Thinking...' : 'Manual Refresh'}
              </button>
            </div>
          </div>
          {refreshError && (
            <div style={{padding: '0.5rem 1.5rem', background: 'rgba(239,68,68,0.1)', fontSize: '0.8rem', color: '#fca5a5', borderBottom: '1px solid rgba(239,68,68,0.2)'}}>
              ⚠ {refreshError}
            </div>
          )}
          <div className="column-body">
            {batches.length === 0 && <div className="placeholder-text">{transcript.length === 0 ? "Not ready. Add transcript first." : "Click Refresh to generate suggestions based on recent context..."}</div>}
            {batches.map((batch, idx) => (
              <div key={idx} style={{marginBottom: '1rem'}}>
                {idx !== 0 && (
                  <div className="batch-divider">
                    <span>Older ({batch.timestamp})</span>
                  </div>
                )}
                {batch.suggestions.map(s => (
                  <div 
                    key={s.id} 
                    className="suggestion-card"
                    onClick={() => handleSuggestionClick(s)}
                    style={{ marginBottom: '1rem' }}
                  >
                    <div className={`suggestion-type type-${s.type}`}>{s.type.replace('_', ' ')}</div>
                    <div className="suggestion-preview">{s.preview}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Chat */}
        <div className="column">
          <div className="column-header">
            <span>Detailed Chat Dashboard</span>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button onClick={() => setShowSettings(true)}>⚙️ Settings</button>
              <button className="primary" onClick={exportSession} disabled={isExporting} style={{background: '#10b981', borderColor: '#10b981'}}>
                {isExporting ? '⏳ Generating Report...' : '⬇ Export Session'}
              </button>
            </div>
          </div>
          <div className="column-body">
            {chat.length === 0 && <div className="placeholder-text">Click any suggestion to expand its details here.</div>}
            {chat.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                <strong className={`chat-role ${msg.role}`}>
                  {msg.role === 'user' ? (msg.suggestionType ? `YOU · ${msg.suggestionType.replace('_', ' ').toUpperCase()}` : 'YOU') : 'ASSISTANT'}
                </strong>
                <div className="markdown-body" style={{marginTop: '0.5rem'}}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div style={{padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)'}}>
            <form onSubmit={handleChatSubmit} style={{display: 'flex', gap: '0.5rem'}}>
              <input 
                type="text" 
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                placeholder="Ask me anything contextually..."
                className="settings-input"
                style={{margin: 0, borderRadius: '8px'}}
              />
              <button 
                type="submit" 
                className="primary" 
                disabled={!userInput.trim() || isLoading}
                style={{whiteSpace: 'nowrap'}}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content column">
            <div className="column-header" style={{height: 'auto', padding: '1rem 1.5rem'}}>
              <span>Copilot Settings</span>
              <button className="danger" onClick={() => setShowSettings(false)}>X</button>
            </div>
            <div className="column-body">
               <label>Groq API Key (.env or runtime)</label>
               <input 
                 className="settings-input" 
                 type="text" 
                 value={settings.groqApiKey} 
                 onChange={e => setSettings({...settings, groqApiKey: e.target.value})} 
               />
               
               <label>Mock Transcript Cadence (Seconds)</label>
               <input 
                 className="settings-input" 
                 type="number" 
                 value={mockCadenceSeconds} 
                 onChange={e => setMockCadenceSeconds(Number(e.target.value))} 
               />

               <label>Live Suggestion Prompt</label>
               <textarea 
                 className="settings-input"
                 rows={3}
                 value={settings.livePrompt}
                 onChange={e => setSettings({...settings, livePrompt: e.target.value})}
               />

               <label>Detail Answer Prompt</label>
               <textarea 
                 className="settings-input"
                 rows={2}
                 value={settings.detailPrompt}
                 onChange={e => setSettings({...settings, detailPrompt: e.target.value})}
               />

               <label>Chat Prompt (Free-form Questions)</label>
               <textarea 
                 className="settings-input"
                 rows={2}
                 value={settings.chatPrompt}
                 onChange={e => setSettings({...settings, chatPrompt: e.target.value})}
               />

               <div style={{display:'flex', gap:'1rem'}}>
                 <div style={{flex:1}}>
                   <label>Context Window (Live, secs)</label>
                   <input className="settings-input" type="number" value={settings.liveContextWindow} onChange={e => setSettings({...settings, liveContextWindow: Number(e.target.value)})} />
                 </div>
                 <div style={{flex:1}}>
                   <label>Context Window (Chat, secs)</label>
                   <input className="settings-input" type="number" value={settings.detailContextWindow} onChange={e => setSettings({...settings, detailContextWindow: Number(e.target.value)})} />
                 </div>
               </div>

               <div style={{textAlign: 'right', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem'}}>
                  <span style={{marginRight: '1rem', color: '#10b981', fontSize: '0.85rem'}}>⚙️ Shell state saved locally</span>
                  <button className="primary" onClick={() => setShowSettings(false)}>Done</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
