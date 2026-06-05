# Problem

Platforms like ChatGPT and Gemini are excellent for learning but lack a structured, persistent pedagogical flow.

# Assignment

Build an AI learning agent that transforms a PDF into an interactive lesson. The agent should:

- **Plan**: Analyze the PDF and propose a learning path (objectives, difficulty).
- **Interact**: Use a Human-in-the-Loop (HITL) flow to get user approval on the plan.
- **Quiz**: Generate and render MCQs in a custom UI widget for each objective.
- **Feedback**: Provide visual (green/red highlights) and textual feedback (hints/explanations).
- **Summarize**: Conclude with a progress report and study tips.

# Desired Flow

1. **Setup**: User uploads PDF. Agent extracts content and drafts a lesson plan (objectives & difficulty).
2. **Approval**: Agent presents the plan. User reviews and confirms (HITL).
3. **Learning Loop**:
    - **Agent:** Generates MCQs for the current objective.
    - **Widget**: Renders question, choices, and submit button.
    - **Interaction**:
        - **Correct**: Highlight green, show explanation, move to next.
        - **Incorrect**: Highlight red, show hint, allow retry.
        - User can ask to learn more about the topic and for hints, but the agent must not give away the answer. Ultimately, the agent should steer the user to continue with completing the lesson.
    - Repeat until learning objectives are exhausted.
4. **Conclusion**: Agent summarizes performance and provides personalized study tips.

# Acceptance Criteria

- [ ]  Agent accepts a PDF upload and parses relevant content
- [ ]  Agent presents a plan (todo list) for generation
- [ ]  HITL interrupt allows user to review plan before proceeding
- [ ]  MCQs are generated directly from the PDF content
- [ ]  MCQ genUI widget renders with radio button selection
- [ ]  On correct answer, an explanation is displayed
- [ ]  On incorrect answer, a hint is displayed and the user can retry without penalty
- [ ]  Users can proceed through all generated MCQs until completion
- [ ]  Agent provides summary of results and study tips at the end

# Tools of the Trade

The following are recommended libraries that may help expedite your build:

- **Agents:** LangChain or Mastra
- **UI:** CopilotKit
- **Backend:** PostgreSQL or Redis

# Deliverables

Send an email with:

- 🔗 **GitHub Repo**: Public repository with README instructions.
- 📹 **Loom**: Walkthrough of the flow end-to-end (< 5 mins).

# Resources

- LangGraph Documentation
- CopilotKit Documentation

# Next Steps

1. **Submission:** Send completed assignment via email
2. **Review:** We will meet to review the submission and ask questions