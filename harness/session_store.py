import datetime
import uuid

class SessionStore:
    def __init__(self):
        self.sessions = {}

    def get_session(self, session_id: str) -> dict:
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "session_id": session_id,
                "transcript_recent": [],
                "transcript_old": [],
                "previous_suggestion_batches": [],
                "clicked_suggestions": []
            }
        return self.sessions[session_id]

    def add_transcript_chunk(self, session_id: str, text: str, speaker: str="Speaker"):
        session = self.get_session(session_id)
        now_dt = datetime.datetime.utcnow()
        session["transcript_recent"].append({
            "chunk_id": str(uuid.uuid4()),
            "speaker": speaker,
            "start_ts": now_dt.isoformat() + "Z",
            "end_ts": now_dt.isoformat() + "Z",
            "text": text
        })
    
    def add_batch(self, session_id: str, phase: str, suggestions: list):
        session = self.get_session(session_id)
        # Store essential fields as per input schema
        batch = {
            "batch_id": str(uuid.uuid4()),
            "created_at": datetime.datetime.utcnow().isoformat() + "Z",
            "phase": phase,
            "suggestions": []
        }
        for s in suggestions:
            batch["suggestions"].append({
                "id": s.get("id"),
                "type": s.get("type"),
                "preview": s.get("preview"),
                "topic_signature": s.get("topic_signature"),
                "based_on": s.get("based_on", [])
            })
        session["previous_suggestion_batches"].append(batch)
        
    def record_click(self, session_id: str, suggestion_id: str):
        session = self.get_session(session_id)
        session["clicked_suggestions"].append({
            "suggestion_id": suggestion_id,
            "clicked_at": datetime.datetime.utcnow().isoformat() + "Z"
        })
        
    def generate_input_payload(self, session_id: str, refresh_mode="auto"):
        session = self.get_session(session_id)
        # Construct payload adhering to suggestion-input.schema.json
        # Handle cases where transcript_recent is empty (schema minItems=1)
        transcript = session["transcript_recent"]
        if not transcript:
            now = datetime.datetime.utcnow().isoformat() + "Z"
            transcript = [{
                "chunk_id": "dummy",
                "speaker": "System",
                "start_ts": now,
                "end_ts": now,
                "text": "..."
            }]
            
        return {
            "current_time": datetime.datetime.utcnow().isoformat() + "Z",
            "refresh_mode": refresh_mode,
            "recent_window_seconds": 30,
            "transcript_recent": transcript,
            "previous_suggestion_batches": session["previous_suggestion_batches"],
            "clicked_suggestions": session["clicked_suggestions"],
            "full_transcript_available": True
        }
