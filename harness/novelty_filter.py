class NoveltyFilter:
    def filter_and_check(self, output_suggestions: list, previous_batches: list) -> tuple:
        """
        output_suggestions: List of 3 output suggestion dictionaries.
        previous_batches: List of batch objects from the session context.
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
            
        # Deterministic check 3: Anti-repetition across previous batches
        # We enforce that if the topic_signature exactly matches a previous one, 
        # the model must provide a robust novelty_basis string.
        seen_topic_signatures = set()
        for batch in previous_batches:
            for past_s in batch.get("suggestions", []):
                seen_topic_signatures.add(past_s.get("topic_signature", ""))
                
        for s in output_suggestions:
            sig = s.get("topic_signature", "")
            if sig in seen_topic_signatures:
                novelty = s.get("novelty_basis", "")
                # If novelty_basis is too short, we assume it's an unjustified repeat.
                if len(novelty) < 15:
                   return False, (
                       f"Suggestion '{sig}' is a repeat, but novelty_basis '{novelty}' "
                       f"is too short (length {len(novelty)}) to justify it under anti-repetition rules."
                   )
                   
        return True, None
