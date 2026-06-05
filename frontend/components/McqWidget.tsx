"use client";

import { useState } from "react";
import { useInterrupt } from "@copilotkit/react-core/v2";

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
  onSubmit: (index: number) => void;
};

function McqForm({ question, options, feedback, onSubmit }: McqFormProps) {
  const [selected, setSelected] = useState<number | null>(null);

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
                className="mt-0.5 shrink-0"
              />
              <span className="text-sm text-gray-800">{opt}</span>
            </label>
          </li>
        ))}
      </ol>

      <button
        disabled={selected === null}
        onClick={() => {
          if (selected !== null) onSubmit(selected);
        }}
        className="rounded bg-blue-600 px-6 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Submit
      </button>
    </div>
  );
}

export function useMcqWidget() {
  return useInterrupt({
    agentId: "learning_agent",
    renderInChat: false,
    enabled: (event) => parseMcqPayload(event.value)?.type === "mcq",
    render: ({ event, resolve }) => {
      const payload = parseMcqPayload(event.value);
      if (!payload) return <></>;
      const { question, options } = payload.content;
      const feedback = payload.feedback;

      return (
        <McqForm
          question={question}
          options={options}
          feedback={feedback}
          onSubmit={(index) => resolve({ kind: "answer", index })}
        />
      );
    },
  });
}
