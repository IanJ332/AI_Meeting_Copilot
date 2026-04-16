class NoveltyFilter:
    def filter_and_check(self, output_suggestions: list, session_data: dict) -> tuple:
        """
        output_suggestions: List of 3 output suggestion dictionaries.
        session_data: The session state object.
        Returns: (is_valid: bool, error_message: str | None)
        """
        # Deterministic check 1: Exact 3 suggestions
        if len(output_suggestions) != 3:
            return False, f"Expected exactly 3 suggestions, got {len(output_suggestions)}"
            
        # Deterministic check 2: Check mutual uniqueness within the new batch
        signatures = set()
        for idx, s in enumerate(output_suggestions):
            sig = s.get("topic_signature", "")
            if sig in signatures:
                return False, f"Duplicate topic_signature '{sig}' within the new batch."
            signatures.add(sig)
            
        previous_batches = session_data.get("previous_suggestion_batches", [])
        clicked_suggestions = {c["suggestion_id"] for c in session_data.get("clicked_suggestions", [])}
        
        seen_topic_signatures = set()
        for batch in previous_batches:
            for past_s in batch.get("suggestions", []):
                seen_topic_signatures.add(past_s.get("topic_signature", ""))
                # If they already clicked this suggestion idea, blocking it completely might be safe,
                # but minimally we track it by signature.

        valid_keywords = [
            "new explicit question", 
            "new constraint", 
            "shifted phase", 
            "invalidated", 
            "resolved", 
            "meaningfully new"
        ]
                
        for s in output_suggestions:
            sig = s.get("topic_signature", "")
            if sig in seen_topic_signatures:
                novelty = s.get("novelty_basis", "").lower()
                
                # Must provide structured material-change reason based on prompt rules
                has_structured_reason = any(kw in novelty for kw in valid_keywords)
                
                if not has_structured_reason:
                   return False, (
                       f"Suggestion '{sig}' is a repeat, but novelty_basis '{novelty}' "
                       f"does not contain a structured material-change reason."
                   )
                   
                   
        return True, None
