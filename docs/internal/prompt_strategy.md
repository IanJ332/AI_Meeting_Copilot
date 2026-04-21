# TwinMind Prompt Engineering Strategy

This document outlines the architectural decisions and prompt strategies used to achieve high-quality, context-aware assistance in the TwinMind AI pipeline.

## 1. Multi-Pass Suggestion Pipeline

To ensure speed and semantic accuracy, we use a tiered architecture:

### Pass 1: Intent Classification (Routing Engine)
- **Model**: Groq Llama 3 / GPT-OSS 120B
- **Strategy**: Instead of asking one model to "find things to say," we first run a high-speed classification pass. 
- **Logic**: The Routing Engine analyzes the last 60 seconds of transcript and picks exactly 3 "Intents" (e.g., `fact_check`, `clarification`, `answer`). This constraints the downstream model to specific cognitive tasks, preventing generic conversational filler.

### Pass 2: Generation (Suggestion Engine)
- **Strategy**: The Suggestion Engine receives the 3 targeted intents and the transcript context.
- **Narrative Causality**: We use a custom constraint called **Narrative Causality**. If the transcript shows a sequence (e.g., "Priya is assigned task" -> "Priya is actually out"), the prompt forces the model to synthesize this chain into a single actionable insight ("Assign backup for Priya's task") rather than just transcribing the last state.

## 2. Dynamic Detail Expansion (On-Click)

- **Continuous Context**: When a user clicks a suggestion, the backend receives the full available transcript plus the **Dashboard Chat History**. 
- **Contextual Inversion**: We give the AI a "System Role" as a second brain. It is instructed to expand the specific seed instruction (the suggestion) while referencing the most recent 12 items of the transcript to ensure nothing it says contradicts the very latest live data.

## 3. Transcription Continuity (Whisper-v3)

- **Stitching**: Whisper-v3 is notoriously stateless. To prevent semantic drift during VAD pauses, we pass the **Tail End Prompt**. 
- **Prompt Truncation**: We provide the last 10 words of the previous transcript chunk as a hidden prompt to Whisper. This "tricks" the model into believing it is continuing an existing sentence, preserving punctuation and capitalization across audio slices.

## 4. Performance & Token Optimization

- **Aggressive Truncation**: To stay within the 8,000 TPM limit of the Groq free tier, we maintain a rolling buffer. 
- **Prioritization**: We prioritize the latest 12 chunks of raw transcript over older history. We found that in 90% of meeting scenarios, the last 2 minutes are the primary driver of actionable "immediate" value.
- **Brevity Enforcements**: All prompts include "CRITICAL ARCHITECTURAL COMMAND" strings that forbid markdown tables and enforce a 100-word limit, ensuring fast TBT (Time to First Token) and low token consumption.
