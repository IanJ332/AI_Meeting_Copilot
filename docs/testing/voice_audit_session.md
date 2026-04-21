# 🎙 Voice Audit Session: High-Fidelity Logic Test

Use this document as your script for the live audit. This scenario is designed to stress-test the **Phase Detection**, **Action Item Extraction**, and **Intelligence Report** generation.

---

## 📅 Submission Checklist (After the Test)

To help me analyze the results, please provide:
1.  **[MANDATORY]** The `.json` file content from the **"Export Session"** button.
2.  **[OPTIONAL]** A copy of the `server.py` console logs.
3.  **[OPTIONAL]** A screenshot of the final **Intelligence Report** section in the UI (if you've customized it).

---

## 🎭 The Script: "Cloud Infrastructure Pivot"

### Phase 1: Early Exploration (Start Mic)
*Read this naturally. Pause for 5 seconds after.*

> "Team, we need to talk about our database strategy. Right now we are hitting scaling bottlenecks on our self-hosted PostgreSQL. We need to decide if we should move to AWS RDS or take a risk and go with a serverless Vercel Postgres setup."

**Check**: 
- Does a `question` card appear about RDS costs?
- Does an `insight` card mention serverless cold starts?

---

### Phase 2: Mid-Discussion & Tradeoffs (Wait for 30s)
*Read this and act slightly concerned.*

> "The issue is that Vercel Postgres simplifies deployment, but AWS gives us more control over the VPC and region-level latency. We only have a $2,000 monthly budget for the database tier. Also, we need to ensure whatever we choose complies with our SOC2 audit requirements."

**Check**: 
- Does a `fact_check` appear regarding SOC2 or RDS?
- Is there a `tradeoff` card comparing "Control vs Simplicity"?

---

### Phase 3: Decision & Action (Wait for 30s)
*Read this with clarity and authority.*

> "Okay, let's make a call. We will go with **AWS RDS** for the production environment because of the SOC2 compliance. **Priya**, please start the terraform migration script by Thursday. **Alex**, can you double-check the billing alerts so we don't blow the $2,000 budget?"

**Check**: 
- Does a `summary` card appear acknowledging the AWS decision?

---

### Phase 4: The Intelligent Export (Final Step)
1.  Click **"Export Session"**.
2.  Wait for `⏳ Generating Report...` to finish.
3.  Open the downloaded `.json` file and look for `intelligence_report`.

**Target Audit Items**:
- Is **Priya** assigned the "terraform migration"?
- Is **Alex** assigned the "billing alerts"?
- Is the **$2,000 budget** mentioned as an "Important Fact"?
- Is the **Follow-up Email** professional?

---

## 🛠 Troubleshooting Note
If the AI is "silent" or non-responsive, ensure your **Groq API Key** is active in the settings panel. If in Simulation Mode, the AI will ignore your voice and follow its own internal script.
