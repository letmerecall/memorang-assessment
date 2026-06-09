"use client";

import { useState } from "react";
import { useAgent, useInterrupt } from "@copilotkit/react-core/v2";
import { LEARNING_AGENT_ID } from "@/lib/agent";
import { mcqOptionKey } from "@/lib/keys";
import { parseInterruptValue } from "@/lib/parseInterrupt";
import type { MCQFeedback, MCQPayload } from "@/lib/types";

function parseMcqPayload(raw: unknown): MCQPayload | null {
  const payload = parseInterruptValue<MCQPayload>(raw);
  return payload?.type === "mcq" ? payload : null;
}

type McqFormProps = {
  question: string;
  options: string[];
  feedback: MCQFeedback;
  tutorReply: string | null;
  isRunning: boolean;
  onSubmit: (index: number) => void;
  onAsk: (text: string) => void;
};

function McqForm({
  question,
  options,
  feedback,
  tutorReply,
  isRunning,
  onSubmit,
  onAsk,
}: McqFormProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [askText, setAskText] = useState("");
  const [pending, setPending] = useState<"submit" | "ask" | null>(null);

  const submitLoading = pending === "submit" && isRunning;
  const tutorLoading = pending === "ask" && isRunning;
  const disabled = submitLoading || tutorLoading;

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
          <span className="font-medium">Incorrect.</span>{" "}
          {feedback.hint}
        </div>
      )}

      <p className="text-sm text-gray-800 mb-4">{question}</p>

      <fieldset className="space-y-2 mb-6 border-0 p-0 m-0">
        <legend className="sr-only">Answer choices</legend>
        <ol className="space-y-2">
          {options.map((opt, i) => (
            <li key={mcqOptionKey(question, i)}>
              <label className="flex items-start gap-3 cursor-pointer rounded border border-gray-200 bg-white p-3 hover:bg-gray-50">
                <input
                  type="radio"
                  name="mcq-option"
                  value={i}
                  checked={selected === i}
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
    </div>
  );
}

export function useMcqWidget() {
  const { agent } = useAgent({ agentId: LEARNING_AGENT_ID });

  return useInterrupt({
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
          isRunning={agent.isRunning}
          onSubmit={(index) => resolve({ kind: "answer", index })}
          onAsk={(text) => resolve({ kind: "question", text })}
        />
      );
    },
  });
}
