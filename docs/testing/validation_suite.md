# TwinMind Prompt Engineering Validation Suite

Use this suite to audit the "roundedness" of the prompt engineering before final submission. These tests specifically target the logical edge cases in the suggestion and chat engines.

---

## 1. Logic & Anti-Repetition Rubric

| Test Case | Scenario | Desired Behavior | Failed Behavior |
| :--- | :--- | :--- | :--- |
| **Recency Bias** | User talks about "Cost" for 2 mins, then mentions "Urgent Security Risk" in last 10s. | At least 2 out of 3 cards MUST focus on the latest security cue. | Cards still focus primarily on cost/budget. |
| **Novelty - Reproach** | Suggestion A was shown. User ignores it and continues. | Suggestion A should NOT reappear unless a "Material Change" keyword appears in `novelty_basis`. | Identical Suggestion A reappears in the next batch. |
| **Novelty - Recovery** | Suggestion A was shown. User then adds a major new constraint relating to A. | Suggestion A reappears but with a NEW angle and a clear `novelty_basis` like "new constraint". | Repetition fails or occurs without a valid basis explanation. |
| **Diversity check** | Mid-discussion phase. | A mix of `tradeoff`, `fact_check`, and `question`. | 3 variations of "How should we proceed?". |

---

## 2. Chat Expansion (Right Panel) Audit

| Metric | Pass Criteria | Verification Method |
| :--- | :--- | :--- |
| **Grounding** | 100% of claims cite transcript cues. | Cross-reference chat output with the "Live Transcript" column. |
| **Contextual Awareness** | Chat response correctly references older context (from `transcript_old`). | Ask a follow-up in the simulation that requires "remembering" a previous decision. |
| **Instruction Following** | `expand_seed` from selection is strictly followed. | Check if the chat response actually answers the specific intent defined in the card. |

---

## 3. UX & Consistency Flags

- [ ] **Phase Alignment**: Does the `current_phase` label correctly transition from `early_exploration` to `decision_next_steps` as the conversation matures?
- [ ] **Preview Utility**: Read the 3 cards. Can you act on them WITHOUT clicking them? (Value-before-click).
- [ ] **Latency**: Does the "manual refresh" feel snappy? (Goal: < 2s for suggestions).

---

## 4. Prompt Tuning Tips (How to Fix Failures)

- **Too Generic?** Update `suggestion-engine.md` to increase the penalty for "filler" phrases like "Discuss next steps".
- **Repeating too much?** Strengthen the `STEP 5 — ANTI-REPETITION` instructions in the prompt.
- **Ignoring context?** Check `harness/context_packer.py` to ensure the `system_prompt` is being appended correctly.
