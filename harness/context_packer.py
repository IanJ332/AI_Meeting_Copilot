import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class ContextPacker:
    def __init__(self):
        with open(os.path.join(BASE_DIR, "prompts", "suggestion-engine.md"), 'r', encoding='utf-8') as f:
            self.suggestion_prompt = f.read()
        with open(os.path.join(BASE_DIR, "prompts", "routing-engine.md"), 'r', encoding='utf-8') as f:
            self.routing_prompt = f.read()

    def pack_routing(self, input_data: dict) -> list:
        # Pass 1: Intent Classification
        messages = []
        # Prefix Block (Cacheable Static Part)
        historical = input_data.get("transcript_session_summary", "")
        if historical:
            messages.append({"role": "system", "content": f"[Full Historical Context]\\n{historical}"})
            
        # Instruction block
        messages.append({"role": "system", "content": self.routing_prompt})
        
        # User payload (Dynamic Part)
        recent_text = "\\n".join([f"{c['speaker']}: {c['text']}" for c in input_data.get("transcript_recent", [])])
        messages.append({"role": "user", "content": f"[Recent Transcript]\\n{recent_text}"})
        
        return messages

    def pack_suggestion(self, input_data: dict, routed_intents: list, settings: dict = None) -> list:
        # Pass 2: Exact generation based on Intent
        messages = []
        historical = input_data.get("transcript_session_summary", "")
        if historical:
            messages.append({"role": "system", "content": f"[Full Historical Context]\\n{historical}"})
            
        system_content = self.suggestion_prompt.replace("DYNAMIC_INTENT_ROUTING_TARGETS", ", ".join(routed_intents))
        
        live_prompt = (settings or {}).get("livePrompt")
        if live_prompt:
             system_content += f"\\n\\nUSER CUSTOM INSTRUCTION:\\n{live_prompt}"
             
        messages.append({"role": "system", "content": system_content})
        
        # Dynamic variable injecting contexts
        user_content = {
            "recent_transcript": [{"speaker": c["speaker"], "text": c["text"]} for c in input_data.get("transcript_recent", [])],
            "previous_batches": input_data.get("previous_suggestion_batches", [])
        }
        messages.append({"role": "user", "content": json.dumps(user_content, indent=2)})
        
        return messages

