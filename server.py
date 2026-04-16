import os
import uuid
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from harness.session_store import SessionStore

# Load environment variables from .env file
load_dotenv()

from harness.suggestion_wrapper import SuggestionWrapper
from harness.handoff import ClickHandoff

app = Flask(__name__)
# Enable CORS for all routes so our Vite frontend can call it
CORS(app)

# Global session store and wrapper (mock API key used unless environment provides it)
store = SessionStore()
wrapper = SuggestionWrapper(api_key=os.environ.get("GROQ_API_KEY", ""))

@app.route("/api/session/start", methods=["POST"])
def start_session():
    # Return a new session ID
    session_id = str(uuid.uuid4())
    return jsonify({"session_id": session_id})

@app.route("/api/transcript", methods=["POST"])
def add_transcript():
    data = request.json
    session_id = data.get("session_id")
    text = data.get("text")
    if not session_id or not text:
        return jsonify({"error": "Missing session_id or text"}), 400
        
    store.add_transcript_chunk(session_id, text, speaker="User")
    return jsonify({"status": "success"})

@app.route("/api/suggestions/refresh", methods=["POST"])
def refresh_suggestions():
    data = request.json
    session_id = data.get("session_id")
    
    # 1. generate payload
    refresh_mode = data.get("refresh_mode", "manual")
    input_data = store.generate_input_payload(session_id, refresh_mode=refresh_mode)
    session_data = store.get_session(session_id)
    
    # 2. Run wrapper
    try:
        output = wrapper.run_suggestion_cycle(input_data, session_data)
        
        # If not ready, return early
        if output.get("status") == "not-ready":
             return jsonify({
                 "status": "not-ready",
                 "message": output.get("message"),
                 "suggestions": []
             })
             
        # Add batch to store
        store.add_batch(session_id, output.get('current_phase', "unknown"), output.get('suggestions', []))
        
        return jsonify(output)
    except Exception as e:
        app.logger.error(f"Error generating suggestions: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/suggestions/click", methods=["POST"])
def click_suggestion():
    data = request.json
    session_id = data.get("session_id")
    suggestion = data.get("suggestion")
    
    if not session_id or not suggestion:
        return jsonify({"error": "Missing session_id or suggestion"}), 400
        
    # Get session context to compute batch/phase
    session_data = store.get_session(session_id)
    
    # Delegate to click handoff object creation
    handoff_obj = ClickHandoff.create(suggestion, session_data)
    
    # Record click to block repetition
    store.record_click(session_id, suggestion, batch_id=handoff_obj.get("batch_id"), phase=handoff_obj.get("phase"))
    
    # Return handoff object which frontend can use to start chat
    return jsonify(handoff_obj)

if __name__ == "__main__":
    app.run(port=5000, debug=True)
