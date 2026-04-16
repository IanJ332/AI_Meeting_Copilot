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
        
    def record_click(self, session_id: str, suggestion: dict, batch_id: str = None, phase: str = None):
        session = self.get_session(session_id)
        session["clicked_suggestions"].append({
            "suggestion_id": suggestion.get("id"),
            "topic_signature": suggestion.get("topic_signature"),
            "preview": suggestion.get("preview"),
            "expand_seed": suggestion.get("expand_seed"),
            "based_on": suggestion.get("based_on", []),
            "phase": phase,
            "batch_id": batch_id,
            "clicked_at": datetime.datetime.utcnow().isoformat() + "Z"
        })
        
    def generate_input_payload(self, session_id: str, refresh_mode="auto", recent_window_seconds=30):
        session = self.get_session(session_id)
        
        now_dt = datetime.datetime.utcnow()
        recent = []
        old = []
        
        for chunk in session["transcript_recent"]:
            ts_str = chunk["end_ts"].replace("Z", "+00:00")
            try:
                chunk_time = datetime.datetime.fromisoformat(ts_str).replace(tzinfo=None)
                age = (now_dt - chunk_time).total_seconds()
                if age <= recent_window_seconds:
                    recent.append(chunk)
                else:
                    old.append(chunk)
            except Exception:
                recent.append(chunk)

        session["transcript_recent"] = recent
        session["transcript_old"].extend(old)
        
        summary = " ".join([c["text"] for c in session["transcript_old"]])

        return {
            "current_time": datetime.datetime.utcnow().isoformat() + "Z",
            "refresh_mode": refresh_mode,
            "recent_window_seconds": recent_window_seconds,
            "transcript_recent": recent,
            "transcript_session_summary": summary,
            "previous_suggestion_batches": session["previous_suggestion_batches"],
            "clicked_suggestions": [
                {
                    "suggestion_id": c["suggestion_id"], 
                    "clicked_at": c["clicked_at"]
                }
                for c in session["clicked_suggestions"]
            ],
            "full_transcript_available": True
        }
