import { useState, useEffect, useRef } from 'react';

// Types matched to our python output
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
}

const API_BASE = "http://127.0.0.1:5000/api";

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize session
  useEffect(() => {
    fetch(`${API_BASE}/session/start`, { method: "POST" })
      .then(res => res.json())
      .then(data => setSessionId(data.session_id))
      .catch(err => console.error("Could not init session:", err));
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

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
      let i = 0;
      
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
      }, 4000); 
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [micActive, sessionId]);

  const handleRefresh = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/suggestions/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (data.status === "not-ready") {
        console.log("Harness not ready:", data.message);
      } else if (data.suggestions) {
         setBatches(prev => [{ phase: data.current_phase, suggestions: data.suggestions, timestamp: new Date().toLocaleTimeString() }, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    if (!sessionId) return;
    
    // Add to chat immediately
    setChat(prev => [...prev, { role: 'user', content: `[Clicked Suggestion]: ${suggestion.preview}` }]);
    
    try {
      const res = await fetch(`${API_BASE}/suggestions/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, suggestion })
      });
      const handoffObj = await res.json();
      
      // Mock detailed answer expanding on the seed via Right Rail
      setTimeout(() => {
         setChat(prev => [...prev, { 
           role: 'assistant', 
           content: `Here is the expanded answer to your clicked suggestion based on the seed: "${handoffObj.expand_seed}". (This is a mock expansion.)` 
         }]);
      }, 800);
      
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-container">
      {/* LEFT COLUMN: Transcript */}
      <div className="column">
        <div className="column-header">
          <span>Live Transcript</span>
          <button 
            className={micActive ? 'danger' : 'primary'} 
            onClick={() => setMicActive(!micActive)}
          >
            {micActive ? 'Stop Mic' : 'Start Mic (Mock)'}
          </button>
        </div>
        <div className="column-body">
          {transcript.length === 0 && <div style={{opacity: 0.5, textAlign: 'center', marginTop: '2rem'}}>Transcript will stream here when mic is active...</div>}
          {transcript.map(t => (
            <div className="transcript-line" key={t.chunk_id}>
              <span className="timestamp">{new Date(t.start_ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
              <span className="speaker">{t.speaker}:</span>
              <span>{t.text}</span>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* MIDDLE COLUMN: Suggestions */}
      <div className="column">
        <div className="column-header">
          <span>Live Suggestions</span>
          <button className="primary" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? 'Thinking...' : 'Refresh'}
          </button>
        </div>
        <div className="column-body">
          {batches.length === 0 && <div style={{opacity: 0.5, textAlign: 'center', marginTop: '2rem'}}>Click Refresh to generate suggestions based on recent context...</div>}
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
        </div>
        <div className="column-body">
          {chat.length === 0 && <div style={{opacity: 0.5, textAlign: 'center', marginTop: '2rem'}}>Click any suggestion to expand its details here.</div>}
          {chat.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <strong style={{color: msg.role === 'user' ? '#a78bfa' : '#34d399', display: 'block', marginBottom: '0.4rem'}}>
                {msg.role === 'user' ? 'You' : 'TwinMind Copilot'}
              </strong>
              <div>{msg.content}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>
    </div>
  );
}

export default App;
