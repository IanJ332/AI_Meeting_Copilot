import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

def test_connection():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("API Key not found in environment.")
        return

    print("GROQ_API_KEY is found.")
    
    try:
        # According to standard Groq integration
        client = Groq(api_key=api_key)
        
        # Note: testing with valid temperature mapping to avoid `temperature=0` which Groq treats weirdly per docs
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "user", "content": "Explain the importance of prompt engineering in one sentence."}
            ],
            temperature=0.4
        )
        print("SUCCESS! Model responded:")
        print(response.choices[0].message.content)
    except Exception as e:
        print("API Call Failed!")
        print(str(e))

if __name__ == "__main__":
    test_connection()
