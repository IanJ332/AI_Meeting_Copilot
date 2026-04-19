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

const API_BASE = "http://127.0.0.1:5000/api";

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [exportState, setExportState] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const isRefreshing = useRef(false);
  
  // Settings
  const [mockCadenceSeconds, setMockCadenceSeconds] = useState(30);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('twinmind_settings');
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
    localStorage.setItem('twinmind_settings', JSON.stringify(settings));
  }, [settings]);

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

  // Mock Mic Loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (micActive && sessionId) {
      const mockPhrases = [
        "We want an AI note feature for customer calls.",
        "I'm not sure if we should optimize for summary quality or action items.",
        "Our sales team only cares if follow-ups are accurate.",
        "Latency matters too, because reps won't wait.",
        "RAG is cheaper, but fine-tuning may be more consistent.",
        "Legal says we can't send customer data to a new external vendor."
      ];
      let i = transcript.length;
      
      interval = setInterval(() => {
        const text = mockPhrases[i % mockPhrases.length];
        i++;
        
        fetch(`${API_BASE}/transcript`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, text })
        }).then(() => {
          setTranscript(prev => [...prev, {
            text, speaker: "User", chunk_id: Math.random().toString(), start_ts: new Date().toISOString(), end_ts: new Date().toISOString()
          }]);
        });
      }, mockCadenceSeconds * 1000); 
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [micActive, sessionId, mockCadenceSeconds, transcript.length]);

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
    setExportState(null);
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
         throw new Error(`API Error ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("Suggestions API response:", data);
      
      if (data.error) {
        setRefreshError(data.error);
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
    
    // Add to chat immediately
    setChat(prev => [...prev, { 
      role: 'user', 
      content: suggestion.preview,
      timestamp: new Date().toISOString(),
      suggestionType: suggestion.type
    }]);
    
    try {
      const res = await fetch(`${API_BASE}/suggestions/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, suggestion, settings })
      });
      const data = await res.json();
      
      const handoffObj = data.handoff || data; // Fallback mapping in case backend returns raw
      let expansionContent = data.detail_response;
      
      // Right-panel mock grounding fallback
      if (!expansionContent) {
        expansionContent = `
**Phase Detected:** ${handoffObj.phase}
**Grounding Cues:** ${handoffObj.based_on?.join(" | ") || "Recent context"}

*System detail-generation executed based on seed*: 
> "${handoffObj.expand_seed}"

This response represents what the real detail-engine will generate once Phase E connects the API up.
        `;
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

  const exportSession = () => {
    try {
      const exportData = {
        session_id: sessionId,
        exported_at: new Date().toISOString(),
        settings_snapshot: settings,
        transcript,
        rendered_batches: batches,
        chat_history: chat
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `twinmind-mock-session-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportState("Success");
    } catch(err) {
      console.error(err);
      setExportState("Failed");
    }
  };

  return (
    <>
      <div className="app-container">
        {/* LEFT COLUMN: Transcript */}
        <div className="column">
          <div className="column-header">
            <span>Live Transcript</span>
            <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
              {micActive && <span className="blinking-dot"></span>}
              <button className={micActive ? 'danger' : 'primary'} onClick={() => setMicActive(!micActive)}>
                {micActive ? 'Stop Mic' : 'Start Mic (Mock)'}
              </button>
            </div>
          </div>
          <div className="column-body">
            {transcript.length === 0 && <div className="placeholder-text">Transcript will stream here when mic is active...</div>}
            {transcript.map(t => (
              <div className="transcript-line" key={t.chunk_id}>
                <span className="timestamp">{new Date(t.start_ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                <span className="speaker">{t.speaker}:</span>
                <span>{t.text}</span>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
          <div style={{padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem', color: '#9aa0a6'}}>
            Mock Cadence logic: chunk every {mockCadenceSeconds}s
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
                    <div className="suggestion-type">{s.type.replace('_', ' ')}</div>
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
              <button onClick={exportSession}>⬇ Export Mock</button>
            </div>
          </div>
          {exportState && (
            <div style={{padding: '0.5rem 1.5rem', background: exportState==='Success'?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)', fontSize: '0.8rem', color: '#fff', textAlign: 'center'}}>
              Export {exportState}
            </div>
          )}
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
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content column">
            <div className="column-header" style={{height: 'auto', padding: '1rem 1.5rem'}}>
              <span>TwinMind Settings (Shell)</span>
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
