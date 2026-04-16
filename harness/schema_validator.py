import json
import os
from jsonschema import validate, ValidationError

# absolute paths or relative to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_SCHEMA_PATH = os.path.join(BASE_DIR, "contracts", "suggestion-input.schema.json")
OUTPUT_SCHEMA_PATH = os.path.join(BASE_DIR, "contracts", "suggestion-output.schema.json")

def load_schema(path: str) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

class HarnessValidator:
    def __init__(self):
        self.input_schema = load_schema(INPUT_SCHEMA_PATH)
        self.output_schema = load_schema(OUTPUT_SCHEMA_PATH)

    def validate_input(self, data: dict):
        try:
            validate(instance=data, schema=self.input_schema)
            return True, None
        except ValidationError as e:
            return False, str(e)

    def validate_output(self, data: dict):
        try:
            validate(instance=data, schema=self.output_schema)
            return True, None
        except ValidationError as e:
            return False, str(e)
