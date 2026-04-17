import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPT_PATH = os.path.join(BASE_DIR, "prompts", "suggestion-engine.md")

class ContextPacker:
    def __init__(self):
        with open(PROMPT_PATH, 'r', encoding='utf-8') as f:
            self.system_prompt = f.read()

    def pack(self, input_data: dict, settings: dict = None) -> list:
        """
        Takes the input state dict and packs it into the format
        expected by the chat API (e.g., Groq / OpenAI messages).
        """
        system_content = self.system_prompt
        live_prompt = (settings or {}).get("livePrompt")
        if live_prompt:
             system_content += f"\\n\\nUSER CUSTOM INSTRUCTION:\\n{live_prompt}"

        return [
            {"role": "system", "content": system_content},
            {"role": "user", "content": json.dumps(input_data, indent=2)}
        ]
