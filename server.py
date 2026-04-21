import os
import uuid
import logging
import json
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

# Global session store
store = SessionStore()

def generate_detailed_answer(handoff_obj, session_data, settings, api_key, chat_history=None, user_query=None):
    try:
        from groq import Groq
        if not api_key or not Groq:
            return None # Falls back to mock UI
            
        client = Groq(api_key=api_key)
        
        detail_prompt = settings.get("detailPrompt", "Expand the specific point...")
        
        # Build prompt context from transcript
        context_text = ""
        old_summary = " ".join([c["text"] for c in session_data.get("transcript_old", [])])
        if old_summary:
            context_text += f"Full conversation summary (older context):\\n{old_summary}\\n\\n"
            
        context_text += "Recent context (last 12 items):\\n"
        for chunk in session_data.get("transcript_recent", [])[-12:]:
            context_text += f"{chunk['speaker']}: {chunk['text']}\\n"
            
        if chat_history:
            context_text += "\\n--- PREVIOUS DASHBOARD CHAT LOG (Last 3) ---\\n"
            for msg in chat_history[-3:]:
                role_label = "ASSISTANT (You)" if msg.get("role") == "assistant" else "USER"
                content_snip = msg.get("content", "")
                context_text += f"{role_label}: {content_snip}\\n"
            context_text += "--------------------------------------\\n"
            
        if user_query:
            # DIRECT CHAT INPUT MODE
            dynamic_rule = "Answer the user question directly based on meeting transcript context."
            messages = [
                {"role": "system", "content": f"{detail_prompt}\n\n[CONTEXTUAL TRIGGER]: {dynamic_rule}\n\nCRITICAL ARCHITECTURAL COMMAND: You MUST keep this response ultra-concise. Use bullet points ONLY. Do not output markdown tables. Absolute maximum of 100 words.\n\n{context_text}"},
                {"role": "user", "content": user_query}
            ]
        else:
            # SUGGESTION CLICK MODE
            seed = handoff_obj.get("expand_seed", "")
            preview = handoff_obj.get("preview", "")
            suggestion_type = handoff_obj.get("type", "")

            dynamic_rule = ""
            if suggestion_type == "question":
                dynamic_rule = "Provide 3 actionable answers to this question."
            elif suggestion_type == "fact_check":
                dynamic_rule = "Provide evidence-based correction and cite logic."
            elif suggestion_type == "insight":
                dynamic_rule = "Expand on this idea into a strategic narrative."
            elif suggestion_type == "answer":
                dynamic_rule = "Provide the steps required to execute this answer."
            elif suggestion_type == "clarification":
                dynamic_rule = "Explain the term clearly for a beginner."
            elif suggestion_type == "summary":
                dynamic_rule = "Provide a tight bulleted summary of this conclusion."

            messages = [
                {"role": "system", "content": f"{detail_prompt}\n\n[CONTEXTUAL TRIGGER]: {dynamic_rule}\n\nCRITICAL ARCHITECTURAL COMMAND: You MUST keep this response ultra-concise. Use bullet points ONLY. Do not output markdown tables. Absolute maximum of 100 words.\n\n{context_text}"},
                {"role": "user", "content": f"Please expand on this suggestion preview: '{preview}'. Seed instruction: {seed}"}
            ]
        
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b", 
            temperature=0.7,
            messages=messages
        )
        return response.choices[0].message.content
        
    except Exception as e:
        app.logger.error(f"Error generating detailed answer: {e}")
        return None

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
    settings = data.get("settings", {})
    api_key = settings.get("groqApiKey") or os.environ.get("GROQ_API_KEY", "")
    
    # 1. generate payload
    refresh_mode = data.get("refresh_mode", "manual")
    input_data = store.generate_input_payload(session_id, refresh_mode=refresh_mode)
    session_data = store.get_session(session_id)
    
    # 2. Run wrapper
    wrapper = SuggestionWrapper(api_key=api_key)
    try:
        if (not api_key):
            # 1. GHOST CHECK: Only return mock suggestions if there is actual transcript content
            recent_text = "".join([t["text"] for t in input_data.get("transcript_recent", [])])
            if not recent_text:
                return jsonify({
                    "status": "not-ready",
                    "message": "Waiting for transcription to start...",
                    "suggestions": []
                })

            # 2. STABILITY FILTER: If the transcript hasn't changed, keep cards stable
            last_seen = session_data.get("last_mock_transcript_hash", "")
            current_hash = str(hash(recent_text))
            
            # In Mock Mode, we enforce strict stability if content hasn't changed
            if last_seen == current_hash:
                return jsonify({
                    "status": "stable",
                    "current_phase": "early_exploration",
                    "suggestions": session_data.get("last_mock_suggestions", []),
                    "is_mock": True
                })
            
            session_data["last_mock_transcript_hash"] = current_hash

            # 3. SCRIPTED SCENARIO: Cycle through a logical meeting flow
            # Mapping specific suggestions to transcript indices for 'hand-in-glove' demo
            scenario = [
                {
                    "text": "The main challenge for the Real-time AI Copilot right now is scaling to millions of users while maintaining low latency.",
                    "suggestions": [
                        {"id": "s1", "type": "question", "preview": "How do we handle API rate limits during peak usage?", "topic": "infrastructure"},
                        {"id": "s2", "type": "insight", "preview": "Latency over 2sec significantly drops user engagement.", "topic": "performance"},
                        {"id": "s3", "type": "fact_check", "preview": "Check API's burst capacity for Whisper-V3.", "topic": "scaling"}
                    ]
                },
                {
                    "text": "We need to ensure that the Live Suggestions are contextually varied—sometimes questions, sometimes fact-checks.",
                    "suggestions": [
                        {"id": "s4", "type": "insight", "preview": "Varied suggestion types increase CTR by 45%.", "topic": "UX"},
                        {"id": "s5", "type": "suggestion", "preview": "Consider adding a 'Contradiction' detector for fact-checks.", "topic": "product"},
                        {"id": "s6", "type": "question", "preview": "What is the prompt strategy for 'Decision' detection?", "topic": "AI"}
                    ]
                },
                {
                    "text": "Let's focus on the US-only pilot first before rolling out to EU regions due to GDPR complexities.",
                    "suggestions": [
                        {"id": "s7", "type": "fact_check", "preview": "EU data residency requires separate storage shards.", "topic": "legal"},
                        {"id": "s8", "type": "question", "preview": "When will the Frankfurt server shard be ready?", "topic": "deployment"},
                        {"id": "s9", "type": "insight", "preview": "GDPR compliance for voice-to-text has strict TTL limits.", "topic": "compliance"}
                    ]
                }
            ]
            
            # Map suggestions to the current mock_counter
            idx = (session_data.get("mock_counter", 1) - 1) % len(scenario)
            selected = scenario[idx]["suggestions"]
            
            # Add unique IDs so React sees 'newness'
            for s in selected:
                s["id"] = s["id"] + "-" + str(uuid.uuid4())[:4]

            session_data["last_mock_suggestions"] = selected
            
            output = {
                "status": "ready",
                "current_phase": "early_exploration",
                "suggestions": selected,
                "is_mock": True
            }
        else:
            output = wrapper.run_suggestion_cycle(input_data, session_data, settings=settings)
        
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
        app.logger.exception("Error generating suggestions")
        return jsonify({
            "error": str(e),
            "type": type(e).__name__,
            "details": "Server encountered an error while processing suggestions"
        }), 500

@app.route("/api/suggestions/click", methods=["POST"])
def click_suggestion():
    data = request.json
    session_id = data.get("session_id")
    suggestion = data.get("suggestion")
    settings = data.get("settings", {})
    api_key = settings.get("groqApiKey") or os.environ.get("GROQ_API_KEY", "")
    
    if not session_id or not suggestion:
        return jsonify({"error": "Missing session_id or suggestion"}), 400
        
    # Get session context to compute batch/phase
    session_data = store.get_session(session_id)
    
    # Delegate to click handoff object creation
    handoff_obj = ClickHandoff.create(suggestion, session_data)
    
    # Record click to block repetition
    store.record_click(session_id, suggestion, batch_id=handoff_obj.get("batch_id"), phase=handoff_obj.get("phase"))
    
    chat_history = data.get("chat_history", [])

    if not api_key:
        detail_text = f"### [MOCK DETAIL]: {suggestion.get('preview')}\n\nThis is a mock expansion of the selected suggestion. To see real AI insights, please add your Groq API Key in the Settings panel."
    else:
        # Generate detailed chat response via Real API
        detail_text = generate_detailed_answer(handoff_obj, session_data, settings, api_key, chat_history)
    
    # Return handoff object alongside detail completion
    return jsonify({
        "handoff": handoff_obj,
        "detail_response": detail_text
    })

@app.route("/api/chat/message", methods=["POST"])
def chat_message():
    data = request.json
    session_id = data.get("session_id")
    message = data.get("message")
    settings = data.get("settings", {})
    chat_history = data.get("chat_history", [])
    api_key = settings.get("groqApiKey") or os.environ.get("GROQ_API_KEY", "")

    if not session_id or not message:
        return jsonify({"error": "Missing session_id or message"}), 400

    session_data = store.get_session(session_id)

    if not api_key:
        # Context-aware mock response
        phrase_count = len(session_data.get("transcript_recent", []))
        response_text = f"### [MOCK CHAT RESPONSE]\n\nYou asked: \"{message}\"\n\nIn a real GPT-OSS session, I would consider the full transcript ({phrase_count} phrases today) and previous chat history to answer your question specifically. This feature allows free-form follow-ups on meeting details."
    else:
        # Real AI response using unified engine
        response_text = generate_detailed_answer(None, session_data, settings, api_key, chat_history, user_query=message)

    return jsonify({
        "response": response_text
    })

@app.route("/api/audio/transcribe", methods=["POST"])
def transcribe_audio():
    if "audio_data" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
        
    file = request.files["audio_data"]
    settings_str = request.form.get("settings", "{}")
    settings = json.loads(settings_str)
    api_key = settings.get("groqApiKey") or os.environ.get("GROQ_API_KEY", "")
    
    if not api_key:
        # SCENARIO-DRIVEN MOCKING: Return sequential phrases about scaling and privacy
        mock_phrases = [
            "The main challenge for our AI copilot right now is scaling to millions of users while maintaining low latency.",
            "We need to ensure that the Live Suggestions are contextually varied—sometimes questions, sometimes fact-checks.",
            "Let's focus on the US-only pilot first before rolling out to EU regions due to GDPR complexities.",
            "Wait, I just realized Priya is out starting tomorrow.",
            "We need someone else to own the security audit documentation."
        ]
        
        session_data = store.get_session(request.form.get("session_id", "default"))
        curr = session_data.get("mock_counter", 0)
        idx = curr % len(mock_phrases)
        text = f"[Mock]: {mock_phrases[idx]}"
        
        # Increment counter for next time
        session_data["mock_counter"] = curr + 1
        return jsonify({"text": text, "is_mock": True})

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        
        prompt_text = request.form.get("prompt", "")
        kwargs = {"model": "whisper-large-v3", "file": (file.filename, file.read())}
        if prompt_text:
             kwargs["prompt"] = prompt_text
             
        # Audio transcription explicitly using whisper-large-v3
        transcription = client.audio.transcriptions.create(**kwargs)
        return jsonify({"text": transcription.text})
    except Exception as e:
        app.logger.exception("Error processing audio transcription")
        return jsonify({"error": str(e)}), 500

@app.route("/api/session/report", methods=["POST"])
def generate_session_report():
    """
    Intelligence Report Generator.
    Called on-demand when the user clicks 'Export'. Aggregates the full session
    context (transcript + suggestions + chat) and asks the LLM to produce a
    structured meeting intelligence report.
    """
    data = request.json
    session_id = data.get("session_id")
    settings = data.get("settings", {})
    api_key = settings.get("groqApiKey") or os.environ.get("GROQ_API_KEY", "")

    if not session_id:
        return jsonify({"error": "Missing session_id"}), 400

    session_data = store.get_session(session_id)

    # Assemble full transcript text
    all_chunks = session_data.get("transcript_old", []) + session_data.get("transcript_recent", [])
    full_transcript = "\n".join([f"{c['speaker']}: {c['text']}" for c in all_chunks])

    # Assemble suggestion history
    suggestion_history = ""
    for batch in session_data.get("previous_suggestion_batches", []):
        suggestion_history += f"\n[Batch - Phase: {batch.get('phase', 'unknown')}]\n"
        for s in batch.get("suggestions", []):
            suggestion_history += f"  - [{s.get('type')}] {s.get('preview')}\n"

    # Assemble chat history from request payload
    chat_history_items = data.get("chat_history", [])
    chat_text = ""
    for msg in chat_history_items:
        role = "USER" if msg.get("role") == "user" else "ASSISTANT"
        chat_text += f"{role}: {msg.get('content', '')}\n"

    if not api_key:
        # Mock intelligence report for keyless demo
        mock_report = {
            "key_decisions": [
                "Proceed with US-only pilot to avoid EU data residency blockers",
                "Prioritize latency optimization over feature breadth for MVP"
            ],
            "action_items": [
                {"owner": "Priya", "task": "Own security audit documentation", "deadline": "Before the 15th"},
                {"owner": "Engineering Lead", "task": "Evaluate API burst capacity for Whisper-V3", "deadline": None}
            ],
            "important_facts": [
                "Latency over 2 seconds significantly drops user engagement",
                "EU data residency requires separate storage shards under GDPR"
            ],
            "bullet_summary": [
                "Team discussed scaling the AI copilot to millions of users while maintaining sub-2s latency.",
                "Live suggestion variety (questions, fact-checks, insights) increases click-through rate by 45%.",
                "GDPR compliance for voice-to-text has strict TTL limits, prompting a US-first strategy.",
                "Security audit ownership was assigned; a rollback plan is still needed."
            ],
            "open_questions": [
                "When will the Frankfurt server shard be ready for EU expansion?",
                "What is the prompt strategy for 'Decision' phase detection?"
            ],
            "meeting_sentiment": "Collaborative and forward-looking, with clear consensus on a phased rollout strategy.",
            "follow_up_email_draft": "Hi Team,\n\nThank you for the productive discussion today. Here is a quick recap:\n\n- We will proceed with a US-only pilot for the MVP to sidestep EU data residency complexity.\n- Priya will own the security audit documentation (target: before the 15th).\n- Engineering will evaluate API burst capacity to ensure sub-2s latency at scale.\n- Open item: Frankfurt shard timeline for Phase 2 EU rollout.\n\nPlease flag any concerns by EOD Friday.\n\nBest regards"
        }
        return jsonify({"report": mock_report, "is_mock": True})

    try:
        from groq import Groq
        client = Groq(api_key=api_key)

        # Load the externalized report prompt
        report_prompt_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts", "report-engine.md")
        with open(report_prompt_path, "r", encoding="utf-8") as f:
            report_system_prompt = f.read()

        # Construct the user message with all session context
        user_content = f"""[FULL MEETING TRANSCRIPT]
{full_transcript if full_transcript else '(No transcript recorded)'}

[AI SUGGESTION BATCHES GENERATED DURING SESSION]
{suggestion_history if suggestion_history else '(No suggestions generated)'}

[CHAT HISTORY BETWEEN USER AND AI COPILOT]
{chat_text if chat_text else '(No chat messages)'}"""

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": report_system_prompt},
                {"role": "user", "content": user_content}
            ]
        )

        raw_text = response.choices[0].message.content.strip()

        # Parse the JSON response
        try:
            report_json = json.loads(raw_text)
        except json.JSONDecodeError:
            # Attempt to extract JSON from potential markdown fences
            start = raw_text.find('{')
            end = raw_text.rfind('}')
            if start != -1 and end != -1:
                report_json = json.loads(raw_text[start:end+1])
            else:
                report_json = {"error": "Failed to parse AI report", "raw": raw_text}

        return jsonify({"report": report_json, "is_mock": False})

    except Exception as e:
        app.logger.exception("Error generating session report")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
