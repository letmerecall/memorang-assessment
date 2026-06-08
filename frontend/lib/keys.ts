import type { Objective } from "./types";

export function objectiveKey(obj: Objective, index: number): string {
  return `${index}:${obj.title}`;
}

export function mcqOptionKey(question: string, index: number): string {
  return `${question}:${index}`;
}
