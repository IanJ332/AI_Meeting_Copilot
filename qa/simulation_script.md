# TwinMind Live Simulation Script

Follow this script to test the end-to-end flow of the application. Paste each block into the "Mock Transcript" flow or speak it aloud if the mic is active.

## Part 1: Exploration Phase
**Action**: Start Mic. Enter blocks 1-2.
**Goal**: Verify "early_exploration" detection and clarifying questions.

**Block 1 (T+0s)**:
> "We're looking into adding a 'Shared Memory' feature to our AI notes. The problem is that current notes are isolated per call. We want the AI to remember things from last week's meeting."

**Block 2 (T+30s)**:
> "But if we share everything, there's a privacy risk. Does a manager see what the ICs said? We haven't decided on the permission model yet."

*Expected Suggestions*: 
1. `question` about permission models.
2. `insight` about cross-call memory tradeoffs.

---

## Part 2: The "Tradeoff" Pivot
**Action**: Enter Block 3.
**Goal**: Verify "mid_discussion_tradeoff" phase and diversity of card types.

**Block 3 (T+60s)**:
> "We only have 3 weeks until the MVP demo. Legal mentioned that global data residency might be an issue. If we store memory in the US, EU customers might block us."

*Expected Suggestions*:
1. `fact_check` or `insight` regarding data residency.
2. `question` about MVP scoping (3-week deadline).

---

## Part 3: The "Deep Dive" (Chat Integration)
**Action**: Click the most interesting suggestion from Part 2.
**Goal**: Verify the Right-Panel Chat expansion.

*Checklist*:
- Does the chat mention the 3-week deadline?
- Does it stay grounded in the "Data residency" issue?
- Click the "Expand" seed instruction to see if it follows the prompt.

---

## Part 4: Decision & Result
**Action**: Enter Block 4.
**Goal**: Verify "decision_next_steps" and anti-repetition.

**Block 4 (T+90s)**:
> "Okay, let's go with a US-only pilot for the MVP to avoid the EU residency blocker for now. Priya, can you own the security audit documentation?"

*Expected Suggestions*:
1. `summary` of the decision.
2. `next_step` regarding the security audit.
3. NO repetition of the initial "Shared Memory" exploration ideas.

---

## Part 5: Stress Test (The Circle-Back)
**Action**: Enter Block 5 manually.
**Goal**: Test if the model can handle repeating a topic IF the context changed.

**Block 5 (T+120s)**:
> "Wait, I just realized Priya is out on leave starting tomorrow. We need someone else to own that security audit."

*Expected Logic*:
- The "Security Audit" topic might reappear, but it MUST have a `novelty_basis` like "resolved" or "meaningfully new" (due to the new owner bottleneck).
