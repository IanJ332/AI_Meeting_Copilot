# TwinMind: Real-time AI Meeting Copilot 🧠🚀

TwinMind is a professional-grade, high-fidelity AI companion designed to revolutionize real-time meeting collaboration. By leveraging cutting-edge LLMs and sub-second transcription, TwinMind provides contextually aware suggestions, fact-checks, and an interactive chat dashboard to help you stay ahead during complex technical discussions.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Stack](https://img.shields.io/badge/stack-Flask%20%7C%20Vite%20%7C%20Groq-purple.svg)

---

## ✨ Key Features

- **🔴 Live Transcript**: Sub-second voice-to-text powered by **Groq Whisper-V3** with adaptive VAD (Voice Activity Detection).
- **💡 Smart Suggestion Batches**: Automatic context-analysis every 30s that generates actionable insights, fact-checks, and clarifying questions.
- **💬 Detailed Chat Dashboard**: A specialized panel to expand on AI suggestions or ask free-form follow-up questions using the full meeting context.
- **🎭 Museum-Grade Demo Mode**: A high-fidelity "Simulation Engine" that allows for a complete, scripted demonstration **without needing an API key**.
- **📂 Session Portability**: One-click export of transcripts, AI suggestions, and chat history for post-meeting documentation.

---

## 🛠 Tech Stack

- **Backend**: Python 3.10, Flask, Groq SDK.
- **Frontend**: TypeScript, React, Vite, Vanilla CSS (Premium Dark Mode).
- **AI Models**: 
  - Transcription: `whisper-large-v3`
  - Reasoning: `openai/gpt-oss-120b` (via Groq API)

---

## 🚀 Quick Start (Local Setup)

### Option 1: Docker (Recommended - One Click)
Ensure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.

```bash
# Clone the repository
git clone https://github.com/IanJ332/TwinMind_Project.git
cd TwinMind_Project

# Start the entire stack
docker-compose up
```
Open [http://localhost:5173](http://localhost:5173) to view the app.

---

### Option 2: Manual Installation (Development)

#### 1. Backend Setup
```bash
# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python server.py
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🎭 How to use the "Mock Demo Mode"
TwinMind features a sophisticated **Simulation Engine** for demonstration purposes.

1.  Open the App.
2.  **Do NOT** enter a Groq API Key in the Settings.
3.  Click **"Start Mic"**.
4.  The system will enter **Keyless Mock Mode**, triggering a scripted scenario about "Scaling TwinMind and GDPR Compliance."
5.  Watch as transcripts and suggestions populate with choreographed pacing (1s for transcript, 1.5s for AI "thinking").

---

## ✅ Quality Assurance & Validation

TwinMind includes a built-in suite of logical validation tools to ensure suggestion accuracy and anti-repetition integrity.

### 🧪 Automated Logic Verification
You can run the Golden Scenario test suite to verify the suggestion engine's phase detection and Click-Repetition-Suppression logic.

```bash
# From the project root
python -m scripts.verify_logic
```

### 📋 Manual Testing & Evaluation
For a deep audit of the AI's "second brain" logical consistency, refer to our specialized documentation in `docs/testing/`:
- **`simulation_script.md`**: A step-by-step walkthrough to speak or paste into the system.
- **`validation_suite.md`**: A rubric for auditing recency bias, novelty recovery, and diversificiation.
- **`golden-scenarios.md`**: Detailed transcript benchmarks and expected AI outputs.

---

## ⚙️ Configuration & Deployment

### Environment Variables
Create a `.env` file in the root:
```env
GROQ_API_KEY=your_key_here
PORT=5000
```

### Vercel Deployment (Frontend)
1.  Connect your GitHub repo to Vercel.
2.  Set the **Root Directory** to `frontend`.
3.  Add the environment variable `VITE_API_BASE_URL` pointing to your deployed backend.

### Cloud Deployment (Backend)
The backend is Dockerized and ready for [Render](https://render.com/), [Railway](https://railway.app/), or [Fly.io](https://fly.io/).

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements.