"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";

const INTERRUPT_EVENT_NAME = "on_interrupt";

type MCQContent = {
  question: string;
  options: string[];
};

type MCQFeedback = {
  correct: boolean;
  hint?: string;
} | null;

type MCQPayload = {
  type: string;
  content: MCQContent;
  feedback: MCQFeedback;
  tutor_reply?: string | null;
};

type InterruptEvent = {
  name: string;
  value: unknown;
};

function parseMcqPayload(raw: unknown): MCQPayload | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as MCQPayload;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as MCQPayload;
  }
  return null;
}

type McqFormProps = {
  question: string;
  options: string[];
  feedback: MCQFeedback;
  tutorReply: string | null;
  tutorLoading: boolean;
  onSubmit: (index: number) => void;
  onAsk: (text: string) => void;
};

function McqForm({
  question,
  options,
  feedback,
  tutorReply,
  tutorLoading,
  onSubmit,
  onAsk,
}: McqFormProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [askText, setAskText] = useState("");

  return (
    <div className="w-full max-w-xl mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Question</h2>

      {feedback && !feedback.correct && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span className="font-medium">Incorrect.</span>{" "}
          {feedback.hint}
        </div>
      )}

      <p className="text-sm text-gray-800 mb-4">{question}</p>

      <ol className="space-y-2 mb-6">
        {options.map((opt, i) => (
          <li key={i}>
            <label className="flex items-start gap-3 cursor-pointer rounded border border-gray-200 bg-white p-3 hover:bg-gray-50">
              <input
                type="radio"
                name="mcq-option"
                value={i}
                checked={selected === i}
                onChange={() => setSelected(i)}
                disabled={tutorLoading}
                className="mt-0.5 shrink-0"
              />
              <span className="text-sm text-gray-800">{opt}</span>
            </label>
          </li>
        ))}
      </ol>

      <button
        disabled={selected === null || tutorLoading}
        onClick={() => {
          if (selected !== null) onSubmit(selected);
        }}
        className="rounded bg-blue-600 px-6 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Submit
      </button>

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
              if (e.key === "Enter" && askText.trim() && !tutorLoading) {
                onAsk(askText.trim());
              }
            }}
            disabled={tutorLoading}
            placeholder="Ask your tutor…"
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          />
          <button
            disabled={!askText.trim() || tutorLoading}
            onClick={() => {
              if (askText.trim()) onAsk(askText.trim());
            }}
            className="rounded border border-blue-300 bg-blue-50 px-4 py-1.5 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

export function useMcqWidget() {
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({ agentId: "learning_agent" });
  const [mcqPayload, setMcqPayload] = useState<MCQPayload | null>(null);
  const pendingEventRef = useRef<InterruptEvent | null>(null);

  useEffect(() => {
    let localInterrupt: InterruptEvent | null = null;

    const subscription = agent.subscribe({
      onCustomEvent: ({ event }) => {
        if (event.name === INTERRUPT_EVENT_NAME) {
          localInterrupt = { name: event.name, value: event.value };
        }
      },
      onRunFinalized: () => {
        if (!localInterrupt) return;
        const payload = parseMcqPayload(localInterrupt.value);
        if (payload?.type === "mcq") {
          pendingEventRef.current = localInterrupt;
          setMcqPayload(payload);
        } else {
          pendingEventRef.current = null;
          setMcqPayload(null);
        }
        localInterrupt = null;
      },
      onRunFailed: () => {
        localInterrupt = null;
      },
    });

    return () => subscription.unsubscribe();
  }, [agent]);

  const resolve = useCallback(
    (response: unknown) => {
      copilotkit.runAgent({
        agent,
        forwardedProps: {
          command: {
            resume: response,
            interruptEvent: pendingEventRef.current?.value,
          },
        },
      });
    },
    [agent, copilotkit]
  );

  if (!mcqPayload) return null;

  const { question, options } = mcqPayload.content;

  return (
    <McqForm
      key={question}
      question={question}
      options={options}
      feedback={mcqPayload.feedback}
      tutorReply={mcqPayload.tutor_reply ?? null}
      tutorLoading={agent.isRunning}
      onSubmit={(index) => resolve({ kind: "answer", index })}
      onAsk={(text) => resolve({ kind: "question", text })}
    />
  );
}
