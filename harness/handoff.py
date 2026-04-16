import datetime

class ClickHandoff:
    @staticmethod
    def create(suggestion: dict, session_data: dict) -> dict:
        """
        Minimal object required when a suggestion is clicked.
        Provides the detailed-answer engine what it needs: 
        the seed query, the context timestamps, and the suggestion id.
        """
        context_timestamps = [
            chunk["start_ts"] for chunk in session_data.get("transcript_recent", [])
        ]
        
        batch_id = "none_available"
        phase = session_data.get("current_phase", "unknown")
        
        for batch in session_data.get("previous_suggestion_batches", []):
            for s in batch.get("suggestions", []):
                if s.get("id") == suggestion.get("id"):
                    batch_id = batch.get("batch_id")
                    phase = batch.get("phase")
                    break
        
        return {
            "suggestion_id": suggestion.get("id"),
            "batch_id": batch_id,
            "preview": suggestion.get("preview"),
            "expand_seed": suggestion.get("expand_seed"),
            "based_on": suggestion.get("based_on", []),
            "phase": phase,
            "clicked_at": datetime.datetime.utcnow().isoformat() + "Z",
            "context_snapshot_timestamps": context_timestamps
        }
