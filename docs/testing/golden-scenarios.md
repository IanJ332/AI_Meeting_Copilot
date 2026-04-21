# Golden Scenarios for Real-time AI Copilot Live Suggestions

This file defines fixed transcript scenarios for evaluating the live suggestion engine.

Purpose:
- test timing quality
- test diversity of the 3 suggestions
- test preview usefulness before click
- test recency prioritization
- test anti-repetition behavior

These scenarios should be used as stable evaluation cases whenever the suggestion prompt or context strategy changes.

---

## Scenario A — Early Exploration

### Transcript excerpt
- "We want an AI note feature for customer calls."
- "I’m not sure whether we should optimize for summary quality or action items."
- "Our sales team only cares if follow-ups are accurate."
- "Latency matters too, because reps won’t wait."

### Expected conversation phase
`early_exploration`

### What good suggestions should roughly look like

1. **Question**
   - "Ask whether the primary success metric is follow-up accuracy or summary completeness; that changes the product decision."

2. **Insight**
   - "If reps won’t wait, prioritize fast action-item extraction over richer long-form notes in the first version."

3. **Summary / framing**
   - "The live tension is speed vs note quality; align on which user pain matters most before discussing implementation."

### Bad suggestions
- "Summarize the discussion."
- "Ask a follow-up question."
- "Consider next steps for implementation."

### Why the good suggestions are timely
They are grounded in the newest uncertainty: success metric, latency, and first-version tradeoff. They help immediately before click and steer the next turn of the conversation.

---

## Scenario B — Mid Discussion / Tradeoff

### Transcript excerpt
- "RAG is cheaper, but fine-tuning may be more consistent."
- "We only have two weeks."
- "Legal says we can’t send customer data to a new external vendor."
- "So accuracy matters, but vendor risk may kill one option."

### Expected conversation phase
`mid_discussion_tradeoff`

### What good suggestions should roughly look like

1. **Insight / tradeoff**
   - "The real decision is not just cost vs quality; legal/vendor constraints may eliminate options before accuracy is compared."

2. **Clarification / answer**
   - "With a two-week deadline, ask whether an internal-only RAG baseline is acceptable as a lower-risk interim path."

3. **Question**
   - "Ask legal whether the restriction is 'no new vendor' or 'no external processing at all'; that distinction changes the architecture choice."

### Bad suggestions
- "RAG and fine-tuning are both useful approaches."
- "The team is discussing tradeoffs."
- "Ask which approach is better."

### Why the good suggestions are timely
They respond to the newest blocking information: timeline and legal constraint. They are complementary rather than repetitive.

---

## Scenario C — Decision / Next Steps

### Transcript excerpt
- "Let’s ship the internal RAG version first."
- "Okay, Priya can own the evaluation set."
- "We still need a rollback plan."
- "Can we commit to a pilot by the 15th?"

### Expected conversation phase
`decision_next_steps`

### What good suggestions should roughly look like

1. **Summary**
   - "The likely decision is an internal RAG pilot first, with evaluation set ownership assigned to Priya."

2. **Question / next step**
   - "Ask whether the pilot date on the 15th is blocked by evaluation readiness or rollback-plan completion."

3. **Risk / insight**
   - "Flag that rollout criteria and rollback triggers should be defined before the pilot date is locked."

### Bad suggestions
- "Brainstorm more solution ideas."
- "Compare RAG vs fine-tuning."
- "Ask who will take notes."

### Why the good suggestions are timely
The conversation has moved from option comparison to execution. The right cards now are decision summary, unblocker, and execution risk.

---

# Evaluation Checklist

Use this checklist when reviewing model output against these scenarios.

## Hard compliance
- Output contains exactly 3 suggestions
- Suggestions are based primarily on recent transcript
- Suggestions are useful before click
- Suggestions are not unjustifiably repetitive
- Suggestions fit the current conversation phase

## Quality checks
- Specific, not generic
- Complementary, not 3 variants of the same idea
- Grounded in transcript cues
- Actionable in the next turn of the conversation
- Trustworthy and not overclaiming

---

# Failure Modes to Watch

1. Generic meeting-assistant filler
2. Three cards that say the same thing in different words
3. Stale-context resurrection
4. Preview that only teases and gives no value before click
5. Uncontrolled repetition across batches
6. Phase blindness

---

# Usage Notes

- Run these scenarios whenever the suggestion prompt changes.
- Keep these scenarios stable so prompt iterations can be compared consistently.
- Add future scenarios only when they represent genuinely new meeting patterns.
