# Intelligence Report Audit & Validation Plan

This document outlines the targeted testing procedures for the **Intelligence Report** incremental feature. These tests ensure the AI-generated "Meeting Memory" is structurally sound, logically grounded, and provides high-value professional documentation.

---

## 1. Structural Validation (JSON Integrity)
*Goal: Ensure the exported data is machine-readable and perfectly maps to the schema defined in `prompts/report-engine.md`.*

| Checkpoint | Target Behavior | Verification Method |
| :--- | :--- | :--- |
| **Schema Completeness** | The `intelligence_report` key in the JSON export must contain all 7 mandatory sub-keys (decisions, actions, etc.). | Check the exported `.json` file for the presence of all keys. |
| **Data Typing** | `key_decisions`, `bullet_summary`, and `important_facts` MUST be arrays of strings. | Validate type of exported JSON keys. |
| **Optionality** | If a deadline for an action item was not mentioned, the field MUST be `null`, not a placeholder string. | Perform a meeting simulation without mentioning dates; check export. |

---

## 2. Logical Accuracy (Grounding & Zero-Hallucination)
*Goal: Ensure the AI does not "invent" decisions or tasks that didn't happen.*

### A. The "Ghost Action" Test
1. **Scenario**: Conduct a meeting where no tasks are assigned and no decisions are made (e.g., just general chatting about a topic).
2. **Success Criteria**: The `action_items` and `key_decisions` arrays in the report MUST be empty `[]`.
3. **Failure**: AI "infers" next steps that weren't discussed.

### B. Ownership Attribution
1. **Scenario**: Use the `simulation_script.md` where "Priya" is assigned the security audit.
2. **Success Criteria**: The `action_items` array must identify "Priya" as the owner of the "security audit documentation".
3. **Failure**: Misattributing tasks or using a generic "The Team" owner.

---

## 3. UX & Functional Verification
*Goal: Ensure the integration between Frontend and Backend handles latency and errors gracefully.*

- [ ] **Locking Mechanism**: Verify the "Export Session" button becomes disabled and shows `⏳ Generating Report...` during the API call.
- [ ] **Graceful Degradation**: 
    1. Temporarily disable the internet or use an invalid API key.
    2. Click Export.
    3. **Success**: The JSON should still download with `intelligence_report: null`, preserving the raw transcript/chat data.
- [ ] **Latency Benchmark**: The report should be generated in < 5 seconds for a 15-minute meeting transcript.

---

## 4. Professionalism & Tone (Follow-up Email)
*Goal: Ensure the `follow_up_email_draft` is ready to send without heavy editing.*

- **Rubric**:
    - Does it include a professional greeting/closing?
    - Is the tone appropriate for an corporate/enterprise setting?
    - Does it mention the specific next steps discussed?

---

## 5. Mock Mode Consistency
*Goal: Ensure the simulation experience is high-fidelity even without an API key.*

1. **Action**: Run the app in **Simlation Mode** (no API key).
2. **Logic**: Trigger the full script (Scaling -> GDPR -> Priya Audit).
3. **Audit**: Verify the Mock Report in the export matches the "US-only pilot" decision and the "Priya" task assignment exactly.
