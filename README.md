# Real-time AI Meeting Copilot 🧠🚀

A professional-grade, high-fidelity AI companion designed to revolutionize real-time meeting collaboration. By leveraging sub-second transcription and adaptive LLM reasoning, this copilot provides contextually aware suggestions, fact-checks, and an interactive chat dashboard to help you stay ahead during complex technical discussions.

![Stack](https://img.shields.io/badge/stack-Flask%20%7C%20Vite%20%7C%20Cloud%20API-purple.svg)

---

## 🛠 Engineering Highlights

This project was built with a focus on low-latency performance, context-aware reasoning, and production-ready code quality.

### 🧠 Prompt Engineering & Reasoning
- **Dual-Pass Routing**: Implements an intent classification layer (Pass 1) followed by a targeted generation layer (Pass 2). This isolates "what info is needed" from "how to phrase it," ensuring high fidelity and low hallucination.
- **Sliding Context Windows**: Backend logic manages two tiers of memory: a "Recent Window" (30s) for immediate reaction and a "Session Summary" for historical continuity.
- **Externalized Logic**: All core system prompts are decoupled into standalone markdown files (`prompts/`), allowing for version-controlled tuning and rapid iteration without modifying core Python logic.

### 🏗 Full-stack & Audio Engineering
- **Adaptive VAD (Voice Activity Detection)**: Implements custom client-side audio analysis to detect speech vs. silence, dynamically adjusting flush intervals (1.5s for snappy demos, 4.5s for natural conversation).
- **Audio Overlap Deduplication**: A specialized `SessionStore` logic handles overlapping transcription artifacts from sliding windows, preventing "double-word" hallucinations in the AI input.
- **Strict Schema Validation**: All AI outputs are validated against a JSON-Schema (`contracts/`) to ensure the frontend always receives stable, renderable data packets.

### 💎 Code Quality
- **Modular Architecture**: Clean separation of concerns between transcription processing (`server.py`), context packaging (`context_packer.py`), and novelty filtering (`novelty_filter.py`).
- **Zero-Placeholder Policy**: Every icon, mock dialogue, and sample data point is carefully curated for a "Museum-Grade" demonstration experience.

---

## ✨ Core Features

- **🔴 Live Transcript**: Powered by `whisper-large-v3` with sub-second feedback via adaptive audio chunking.
- **💡 Smart Suggestion Batches**: Context-analysis every 30s that generates actionable insights, fact-checks, and clarifying questions using `openai/gpt-oss-120b`.
- **💬 Detailed Chat Dashboard**: An interactive panel to expand on AI suggestions or ask free-form follow-up questions using the full meeting context.
- **📂 Professional Export**: One-click export of transcripts, suggestions, and chat history into a structured **JSON** format.
- **🎭 Simulation Mode**: A sophisticated simulation engine for demonstration purposes, triggering choreographed meeting scenarios without requiring an active API key.

---

## 🚀 Quick Start (Local Setup)

### Option 1: Docker (Recommended)
```bash
docker-compose up
```
Open [http://localhost:5173](http://localhost:5173) to view the app.

### Option 2: Manual Setup
**Backend:**
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py
```
**Frontend:**
```bash
cd frontend && npm install && npm run dev
```

---

## ⚙️ Configuration

The system supports a **Hybrid Configuration Model**:
1.  **Static (.env)**: Pre-configure API keys and environment variables in the root directory.
2.  **Dynamic (UI Shell)**: The application features a built-in **Settings Panel** (⚙️ button) to update API keys and prompt parameters at runtime without restarting the server.

---

## ✅ Quality Assurance
Run the logical validation suite to verify phase detection and novelty filtering:
```bash
python -m scripts.verify_logic
```

Detailed test rubrics and simulation scripts can be found in `docs/testing/`.