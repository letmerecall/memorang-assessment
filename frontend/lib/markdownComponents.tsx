import type { Components } from "react-markdown";

export const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="text-sm text-gray-700 mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-800">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-sm text-gray-700 mb-2 space-y-1">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-sm text-gray-700 mb-2 space-y-1">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-sm text-gray-700">{children}</li>,
  h1: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-800 mb-1">{children}</h4>
  ),
  h2: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-800 mb-1">{children}</h4>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-800 mb-1">{children}</h4>
  ),
};
