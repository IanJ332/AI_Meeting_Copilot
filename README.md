# Real-time AI Meeting Copilot 🧠

A web app that listens to live audio from the user's microphone and continuously surfaces 3 useful, context-aware suggestions based on what is being said. Clicking a suggestion opens a detailed answer in an interactive chat panel. The system also generates an **AI-powered Intelligence Report** at export time, extracting key decisions, action items, and a draft follow-up email.

**Models**: `whisper-large-v3` (transcription) · `openai/gpt-oss-120b` (suggestions & chat) — via Groq API.

---

## Links

You are able to use with Grop API here [AI Meeting Copilot](https://ai-meeting-copilot-six.vercel.app/).

---

## 🚀 Quick Start

### Option 1: Docker
```bash
git clone <repo-url>
cd <repo-folder>
docker-compose up
```
Open [http://localhost:5173](http://localhost:5173). Paste your Groq API key in ⚙️ Settings.

### Option 2: Manual
```bash
# Backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

---

## 🏗 Architecture Overview

```
├── server.py                    # Flask API server (transcription, suggestions, chat, report)
├── harness/
│   ├── suggestion_wrapper.py    # Two-pass LLM orchestrator (routing → generation)
│   ├── context_packer.py        # Builds LLM message arrays with sliding context windows
│   ├── session_store.py         # In-memory session state with overlap deduplication
│   ├── novelty_filter.py        # Anti-repetition filter for suggestion batches
│   ├── schema_validator.py      # JSON-Schema validation against contracts/
│   └── handoff.py               # Click → chat context bridge
├── prompts/                     # All system prompts (externalized, version-controllable)
│   ├── suggestion-engine.md     # Core suggestion generation prompt
│   ├── routing-engine.md        # Intent classification prompt
│   ├── report-engine.md         # Intelligence report generation prompt
│   └── chat-engine.md           # Chat expansion prompt
├── contracts/                   # JSON-Schema for input/output validation
├── frontend/src/
│   └── App.tsx                  # Single-file React app (transcript, suggestions, chat)
└── docs/testing/                # Audit rubrics and simulation scripts
```

---

## 🧠 Prompt Strategy & Tradeoffs

### Dual-Pass Routing Architecture
Rather than asking a single LLM call to "figure out what to suggest," the system uses **two sequential passes**:

1. **Pass 1 — Intent Classification** (`routing-engine.md`): A fast, low-temperature call that classifies the transcript into exactly 3 intent types (e.g., `fact_check`, `question`, `insight`). This acts as a lightweight "router" that decides *what kind* of help is needed.

2. **Pass 2 — Targeted Generation** (`suggestion-engine.md`): A separate call that receives the routed intents and generates exactly 3 suggestion cards, one per intent. By constraining the generation to pre-classified intents, hallucination drops significantly and card diversity is guaranteed.

**Why two passes instead of one?** A single-pass approach often produces 3 variations of the same type (e.g., three generic questions). The routing layer forces diversity by design. The latency cost (~200ms extra) is justified by the quality gain.

### Context Window Management
The system manages two tiers of transcript memory:

| Tier | Content | Purpose |
|------|---------|---------|
| **Recent Window** (configurable, default 30s) | Last ~30 seconds of raw transcript chunks | Drives suggestion relevance — "what was just said" |
| **Session Summary** | All older transcript concatenated | Provides historical continuity — prevents suggesting things already resolved |

Both tiers are passed as separate system messages to leverage Groq's KV-cache prefix alignment: the historical context (which rarely changes) remains cacheable, while only the recent window rotates.

### Anti-Repetition Strategy
Three layers prevent stale suggestions:

1. **Topic Signature Deduplication**: Each suggestion carries a `topic_signature` slug. The `novelty_filter.py` rejects any batch where a signature matches a previously shown batch.
2. **Click Suppression**: Clicked suggestions are recorded in the session store. If the same topic reappears, it must carry a valid `novelty_basis` keyword (e.g., "new constraint", "resolved") to pass the filter.
3. **LLM Self-Repair**: If validation fails, a repair instruction is appended and the LLM retries once before falling back to a graceful mock response.

### Prompt Externalization
All system prompts live in `prompts/` as standalone Markdown files. This means:
- Prompts can be tuned without touching Python code.
- Prompt changes are tracked in git history.
- The Settings panel allows runtime override of prompt text for rapid experimentation.

### Routing Intent Types
The router classifies the transcript into exactly 3 of the following intent types per batch, ensuring the generation step produces a contextually diverse mix:

| Type | Trigger Condition |
|------|------------------|
| `fact_check` | Someone cited a statistic, year, or absolute claim |
| `clarification` | An acronym, jargon, or ambiguous term appeared without explanation |
| `answer` | A concrete question was asked but not yet answered |
| `insight` | A hidden correlation, trend, or conflict can be extracted |
| `summary` | A complex topic is clearly concluding |
| `tradeoff` | Two or more competing options are being evaluated without a winner |
| `next_step` | A task or commitment was explicitly assigned to a person |

### Response Brevity Enforcement
A critical design goal is that every AI response must be **scannable in under 5 seconds** during a live meeting. Early versions suffered from verbose outputs that made responses unreadable mid-conversation.

This is solved with a **dual-layer enforcement system** that cannot be bypassed:

**Layer 1 — Structural Prompt Formula** (instruction-level):
```
Max 5 bullets. Each bullet: max 20 words. No headers. No tables. Under 100 words total.
```
This replaces the vague prior instruction (`"Absolute maximum of 100 words"`). Providing an explicit structural formula (`5 × 20 words`) gives the model a mathematical constraint rather than an advisory suggestion, eliminating most verbosity.

**Layer 2 — API Hard Ceiling** (`max_tokens=200`):
Every chat completion call sets `max_tokens=200` (~130–150 English words). This is enforced by the **Groq API server**, not the model — making it physically impossible to exceed regardless of prompt compliance. The ceiling is set slightly above the prompt target to prevent mid-sentence truncation.

**Why not per-type word limits?** Per-type relaxation (e.g., `insight=200 words`) would have made the most verbose card types *longer* and created an inconsistent UX. The problem was weak enforcement, not the limit itself.

---

## ⚙️ Configuration

The system supports **two configuration methods**:

### 1. Runtime UI (Settings Panel)
Click ⚙️ Settings in the app to configure:
- **Groq API Key** — paste your key here (never hardcoded)
- **Live Suggestion Prompt** — editable system prompt for suggestion generation
- **Detail Answer Prompt** — editable system prompt for click-expansion
- **Chat Prompt** — editable system prompt for free-form questions
- **Context Window (Live)** — seconds of recent transcript for suggestions (default: 30s)
- **Context Window (Chat)** — seconds of context for detailed answers (default: 180s)

All settings persist in `localStorage` across page refreshes.

### 2. Environment Variables (.env)
```env
GROQ_API_KEY=gsk_your_key_here
PORT=5000
```

---

## 📂 Export & Intelligence Report

Clicking **"Export Session"** triggers a two-phase process:

1. **Phase 1 — AI Intelligence Report**: The full transcript, suggestion history, and chat log are sent to `openai/gpt-oss-120b` which generates a structured meeting memory containing:
   - **Key Decisions** made during the meeting
   - **Action Items** with owner names and deadlines
   - **Important Facts** cited in the discussion
   - **Bullet-Point Summary** of the conversation
   - **Open Questions** that remain unresolved
   - **Meeting Sentiment** assessment
   - **Follow-up Email Draft** ready to copy-paste

2. **Phase 2 — Bundle**: The intelligence report is packaged alongside the raw transcript, all suggestion batches (with timestamps), and the full chat history into a single **JSON** file.

> **Security**: The exported JSON automatically **redacts the API key** from the settings snapshot (`groqApiKey: '[REDACTED]'`), ensuring credentials are never written to disk.

If the report API fails, the export degrades gracefully — raw data is still downloaded with `intelligence_report: null`.

---

## 🎭 Simulation Mode

When no API key is configured, the system enters **Simulation Mode**:
- A scripted meeting scenario plays automatically (scaling, GDPR, task assignment)
- Choreographed pacing: 1s transcript delay → 1.5s "AI thinking" delay
- Suggestion cards are pre-mapped to transcript content for a coherent demo
- The intelligence report generates a realistic mock with sample action items

This allows evaluators to experience the full UI flow without consuming API credits.

---

## 🏗 Full-Stack Engineering Details

### Audio Capture & Chunking
- **Adaptive VAD (Voice Activity Detection)**: Custom client-side `AnalyserNode` monitors audio RMS levels in real-time. Speech triggers recording; silence triggers flush.
- **Dual Flush Strategy**: Silence-based (4.5s pause) OR time-based (28s max), whichever comes first, ensuring natural sentence boundaries without infinite buffering.
- **Whisper Context Priming**: The last 10 words of the previous transcript are passed as a `prompt` parameter to Whisper, improving punctuation and reducing hallucination at chunk boundaries.
- **Hallucination Filtering**: Common Whisper artifacts ("Thank you", "Yeah", "You") are filtered client-side before they pollute the suggestion engine.

### Error Handling & Resilience
- **Strict → Best-Effort Fallback**: The suggestion engine first attempts `json_schema` strict mode. If the model returns a 400 (schema incompatibility), it falls back to `json_object` mode automatically.
- **LLM Self-Repair Loop**: On validation failure, a repair instruction is appended and the LLM retries once before engaging the mock fallback.
- **Rate Limit Awareness**: 401 and 429 errors surface user-friendly alerts with specific guidance (check key vs. wait and retry).
- **Export Resilience**: Intelligence report generation failure doesn't block the raw data export.

### Click Feedback
When a suggestion card is clicked, immediate visual feedback is applied before the API responds:
- The **clicked card** dims to 55% opacity with a `wait` cursor.
- All **other cards** dim to 85% opacity with a `default` cursor.
- Concurrent clicks are blocked until the current expansion completes.
- State clears automatically whether the request succeeds or fails.

### Audio Overlap Deduplication
Whisper's 30s window can produce overlapping content when chunks are flushed at natural speech boundaries. The `SessionStore` maintains a sliding window of recent transcript texts and rejects exact duplicates, preventing the LLM from seeing "The quick quick brown fox."

---

## ✅ Quality Assurance

### Automated
```bash
python scripts/verify_logic.py
```
Validates phase detection, schema compliance, and anti-repetition across 3 golden scenarios.

### Manual Audit
See `docs/testing/` for:
- `voice_audit_session.md` — A spoken script to test live with mic
- `validation_suite.md` — Rubric for recency bias, novelty recovery, diversity
- `report_intelligence_audit.md` — Checklist for intelligence report grounding

---

## 📋 Requirement Compliance Matrix

| Requirement | Status | Implementation |
|---|---|---|
| Start/stop mic | ✅ | Toggle button with blinking indicator |
| Transcript chunks ~30s | ✅ | Adaptive VAD with 4.5s silence / 28s max flush |
| Auto-scroll transcript | ✅ | `useRef` + `scrollIntoView` on update |
| Auto-refresh suggestions ~30s | ✅ | Configurable interval with Auto-Refresh toggle |
| Manual refresh button | ✅ | "Manual Refresh" button in suggestions column |
| Exactly 3 suggestions per batch | ✅ | Schema-enforced via `contracts/` + prompt instruction |
| New batch at top, older below | ✅ | `batches` array prepends new, renders with dividers |
| Tappable cards with useful preview | ✅ | Cards show type badge + preview text; click expands |
| Mixed suggestion types by context | ✅ | Dual-pass routing ensures type diversity per batch |
| Click → detailed answer in chat | ✅ | `handleSuggestionClick` → `/api/suggestions/click` |
| Users can type questions | ✅ | Chat input bar with `/api/chat/message` endpoint |
| One continuous chat per session | ✅ | In-memory, no persistence across reload |
| Export (transcript + suggestions + chat + timestamps) | ✅ | JSON export with all data + intelligence report |
| Groq API: whisper-large-v3 + gpt-oss-120b | ✅ | Hardcoded model strings in `server.py` |
| Settings: API key field | ✅ | Settings panel with runtime key input |
| Settings: Editable prompts + context windows | ✅ | Live, Detail, and Chat prompts + 2 context windows |
| Deployed public URL | ✅ | Ready for Vercel (frontend) + Render (backend) |
