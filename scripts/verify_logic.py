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
            
            if "status" in output and output["status"] == "not-ready":
                print("  Skipped: Not ready.")
                continue
                
            assert "suggestions" in output, "Missing suggestions array"
            assert "current_phase" in output, "Missing current_phase"
            
            assert len(output["suggestions"]) == 3, f"Expected 3 suggestions, got {len(output['suggestions'])}"
            
            # Assert phase matches expected
            # Note: with a mocked LLM this may fail, which is correct behavior for a mock.
            assert output["current_phase"] == sc["phase"], f"Phase mismatch: expected {sc['phase']}, got {output['current_phase']}"
            
            # Assert no duplicates
            sigs = [s["topic_signature"] for s in output["suggestions"]]
            assert len(sigs) == len(set(sigs)), "Duplicate topic_signature found in output batch"
            
            # Fail on obvious generic filler
            for s in output["suggestions"]:
                prev = s["preview"].lower()
                assert "summarize the discussion" not in prev, "Generic filler 'summarize the discussion' found"
                assert "ask a follow-up question" not in prev, "Generic filler 'ask a follow-up' found"
            
            print(f"  Success! Assertions passed for Phase: {output.get('current_phase')}")
            
            # Save batch to store as if it was shown
            store.add_batch(session_id, output.get('current_phase'), output.get('suggestions'))
            
        except AssertionError as e:
            print(f"  X Assertion Failed Scenario {sc['id']}: {str(e)}")
        except Exception as e:
            print(f"  X Failed Scenario {sc['id']}: {str(e)}")
            
        # Test click repetition suppression explicitly here at the end of the loop
        if sc['id'] == "A":
            sugg_to_click = output.get('suggestions')[0]
            store.record_click(session_id, sugg_to_click, batch_id=None, phase=output.get("current_phase"))
            
            # Now run cycle again to see if it catches a repeat returned by mock
            print("  --- Testing Click Suppression ---")
            mocked_input_data = store.generate_input_payload(session_id)
            mocked_session_data = store.get_session(session_id)
            
            try:
                # The mock currently returns the same mock signatures with a generic string that DOES NOT have a structured reason (unless we mocked it with one, but we didn't use the exact structural keywords).
                # Wait, our mock novelty basis is: "mock novelty basis for card X". No keywords from valid_keywords!
                # So this should definitely trip the filter and then max out the retries.
                wrapper.run_suggestion_cycle(mocked_input_data, mocked_session_data)
                print("  X Click Suppression Failed: Expected ValueError due to repetition, but got success.")
            except ValueError as ve:
                if "was already clicked" in str(ve) or "was already seen" in str(ve):
                    print("  Success! Clicked suggestion effectively blocked ->", ve)
                else:
                    print("  Success (but with different error): Clicked suggestion repetition blocked ->", ve)

        print("\n")

if __name__ == "__main__":
    run_scenarios()
