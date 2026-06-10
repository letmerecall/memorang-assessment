"use client";

import { useRef, useState, type ReactNode } from "react";
import { useAgent, useInterrupt } from "@copilotkit/react-core/v2";
import { LEARNING_AGENT_ID } from "@/lib/agent";
import { mcqOptionKey } from "@/lib/keys";
import { parseInterruptValue } from "@/lib/parseInterrupt";
import type { MCQFeedback, MCQPayload } from "@/lib/types";

function parseMcqPayload(raw: unknown): MCQPayload | null {
  const payload = parseInterruptValue<MCQPayload>(raw);
  return payload?.type === "mcq" ? payload : null;
}

function optionStyle(feedback: MCQFeedback, index: number): string {
  if (!feedback || feedback.selected_index !== index) {
    return "border-gray-200 bg-white hover:bg-gray-50";
  }
  if (feedback.correct) {
    return "border-green-400 bg-green-50";
  }
  return "border-red-400 bg-red-50";
}

type McqFormProps = {
  question: string;
  options: string[];
  feedback: MCQFeedback;
  tutorReply: string | null;
  onSubmit: (index: number) => void;
  onAsk: (text: string) => void;
  onContinue: () => void;
};

function McqForm({
  question,
  options,
  feedback,
  tutorReply,
  onSubmit,
  onAsk,
  onContinue,
}: McqFormProps) {
  // Subscribed here rather than passed as a prop: while the agent runs, the
  // hook below re-returns the previous (frozen) element, so a prop would go
  // stale and the loading/disabled states would never show.
  const { agent } = useAgent({ agentId: LEARNING_AGENT_ID });
  const isRunning = agent.isRunning;
  const [selected, setSelected] = useState<number | null>(null);
  const [askText, setAskText] = useState("");
  const [pending, setPending] = useState<"submit" | "ask" | "continue" | null>(null);

  const isCorrectReveal = feedback?.correct === true;
  const submitLoading = pending === "submit" && isRunning;
  const tutorLoading = pending === "ask" && isRunning;
  const continueLoading = pending === "continue" && isRunning;
  const disabled = submitLoading || tutorLoading || continueLoading || isCorrectReveal;

  function handleAsk(text: string) {
    setPending("ask");
    onAsk(text);
    setAskText("");
  }

  return (
    <div className="w-full max-w-xl mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Question</h2>

      {feedback && !feedback.correct && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span className="font-medium">Incorrect.</span> {feedback.hint}
        </div>
      )}

      {feedback?.correct && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <span className="font-medium">Correct!</span> {feedback.explanation}
          {feedback.source_quote && (
            <p className="mt-2 text-xs text-green-700 italic">
              Source: {feedback.source_quote}
            </p>
          )}
        </div>
      )}

      <p className="text-sm text-gray-800 mb-4">{question}</p>

      <fieldset className="space-y-2 mb-6 border-0 p-0 m-0">
        <legend className="sr-only">Answer choices</legend>
        <ol className="space-y-2">
          {options.map((opt, i) => (
            <li key={mcqOptionKey(question, i)}>
              <label
                className={`flex items-start gap-3 rounded border p-3 ${
                  isCorrectReveal ? "cursor-default" : "cursor-pointer"
                } ${optionStyle(feedback, i)}`}
              >
                <input
                  type="radio"
                  name="mcq-option"
                  value={i}
                  checked={
                    isCorrectReveal
                      ? feedback?.selected_index === i
                      : selected === i
                  }
                  onChange={() => setSelected(i)}
                  disabled={disabled}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-sm text-gray-800">{opt}</span>
              </label>
            </li>
          ))}
        </ol>
      </fieldset>

      {isCorrectReveal ? (
        <button
          disabled={continueLoading}
          onClick={() => {
            setPending("continue");
            onContinue();
          }}
          className="rounded bg-green-600 px-6 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {continueLoading ? "Continuing…" : "Continue"}
        </button>
      ) : (
        <button
          disabled={selected === null || disabled}
          onClick={() => {
            if (selected !== null) {
              setPending("submit");
              onSubmit(selected);
            }
          }}
          className="rounded bg-blue-600 px-6 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitLoading ? "Checking answer…" : "Submit"}
        </button>
      )}

      {!isCorrectReveal && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          {tutorReply && (
            <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <span className="font-medium">Tutor:</span> {tutorReply}
            </div>
          )}
          {tutorLoading && (
            <p className="mb-3 text-xs text-blue-600">Getting hint…</p>
          )}
          <p className="text-xs text-gray-500 mb-2">Need a hint or want to ask a question?</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && askText.trim() && !disabled) {
                  handleAsk(askText.trim());
                }
              }}
              disabled={disabled}
              placeholder="Ask your tutor…"
              className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            />
            <button
              disabled={!askText.trim() || disabled}
              onClick={() => {
                if (askText.trim()) handleAsk(askText.trim());
              }}
              className="rounded border border-blue-300 bg-blue-50 px-4 py-1.5 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function useMcqWidget() {
  const { agent } = useAgent({ agentId: LEARNING_AGENT_ID });
  const heldRef = useRef<ReactNode>(null);

  const live = useInterrupt({
    agentId: LEARNING_AGENT_ID,
    renderInChat: false,
    enabled: (event) => parseMcqPayload(event.value) !== null,
    render: ({ event, resolve }) => {
      const payload = parseMcqPayload(event.value);
      if (!payload) return <></>;

      const { question, options } = payload.content;

      return (
        <McqForm
          key={question}
          question={question}
          options={options}
          feedback={payload.feedback}
          tutorReply={payload.tutor_reply ?? null}
          onSubmit={(index) => resolve({ kind: "answer", index })}
          onAsk={(text) => resolve({ kind: "question", text })}
          onContinue={() => resolve({ kind: "continue" })}
        />
      );
    },
  });

  // resolve() clears the interrupt for the entire run (useInterrupt only
  // re-emits at run end), which unmounted the form and made every Submit/Ask/
  // Continue look like a page refresh. Hold the last element while the agent
  // is running so the form stays mounted; useInterrupt's resolve is a stable
  // callback, so the held element remains functional. Once the run ends
  // without a new MCQ interrupt (summary, error), drop it.
  if (live) {
    heldRef.current = live;
  } else if (!agent.isRunning) {
    heldRef.current = null;
  }
  return live ?? heldRef.current;
}
