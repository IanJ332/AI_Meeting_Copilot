import datetime

class ClickHandoff:
    @staticmethod
    def create(suggestion: dict, session_data: dict) -> dict:
        """
        Minimal object required when a suggestion is clicked.
        Provides the detailed-answer engine what it needs: 
        the seed query, the context timestamps, and the suggestion id.
        """
        # Grab timestamps of recent transcript context
        context_timestamps = [
            chunk["start_ts"] for chunk in session_data.get("transcript_recent", [])
        ]
        
        return {
            "suggestion_id": suggestion.get("id"),
            "expand_seed": suggestion.get("expand_seed"),
            "clicked_at": datetime.datetime.utcnow().isoformat() + "Z",
            "context_snapshot_timestamps": context_timestamps
        }
