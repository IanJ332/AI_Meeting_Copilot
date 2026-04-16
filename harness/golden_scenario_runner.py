import os
from .session_store import SessionStore
from .suggestion_wrapper import SuggestionWrapper

def run_scenarios():
    api_key = os.environ.get("GROQ_API_KEY", "")
    wrapper = SuggestionWrapper(api_key=api_key)
    
    print("=== TwinMind Golden Scenario Runner ===\n")
    
    scenarios = [
        {
            "id": "A",
            "phase": "early_exploration",
            "chunks": [
                "We want an AI note feature for customer calls.",
                "I’m not sure whether we should optimize for summary quality or action items.",
                "Our sales team only cares if follow-ups are accurate.",
                "Latency matters too, because reps won’t wait."
            ]
        },
        {
            "id": "B",
            "phase": "mid_discussion_tradeoff",
            "chunks": [
                "RAG is cheaper, but fine-tuning may be more consistent.",
                "We only have two weeks.",
                "Legal says we can’t send customer data to a new external vendor.",
                "So accuracy matters, but vendor risk may kill one option."
            ]
        },
        {
            "id": "C",
            "phase": "decision_next_steps",
            "chunks": [
                "Let’s ship the internal RAG version first.",
                "Okay, Priya can own the evaluation set.",
                "We still need a rollback plan.",
                "Can we commit to a pilot by the 15th?"
            ]
        }
    ]
    
    for sc in scenarios:
        print(f"--- Running Scenario {sc['id']}: {sc['phase']} ---")
        session_id = f"test_session_{sc['id']}"
        store = SessionStore()
        
        # Load transcript into session store
        for chunk in sc["chunks"]:
            store.add_transcript_chunk(session_id, chunk)
            
        # Generate input payload
        input_data = store.generate_input_payload(session_id)
        session_data = store.get_session(session_id)
        
        # Execute wrapper
        try:
            output = wrapper.run_suggestion_cycle(input_data, session_data)
            
            print(f"Success! Detected Phase: {output.get('current_phase')}")
            for i, sugg in enumerate(output.get('suggestions', [])):
                print(f"  Suggestion {i+1} [{sugg['type']}]:")
                print(f"    Preview: {sugg['preview']}")
                print(f"    Signature: {sugg['topic_signature']}")
            
            # Save batch to store as if it was shown
            store.add_batch(session_id, output.get('current_phase'), output.get('suggestions'))
            
        except Exception as e:
            print(f"X Failed Scenario {sc['id']}: {str(e)}")
            
        print("\n")

if __name__ == "__main__":
    run_scenarios()
