import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPT_PATH = os.path.join(BASE_DIR, "prompts", "suggestion-engine.md")

class ContextPacker:
    def __init__(self):
        with open(PROMPT_PATH, 'r', encoding='utf-8') as f:
            self.system_prompt = f.read()

    def pack(self, input_data: dict) -> list:
        """
        Takes the input state dict and packs it into the format
        expected by the chat API (e.g., Groq / OpenAI messages).
        """
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": json.dumps(input_data, indent=2)}
        ]
