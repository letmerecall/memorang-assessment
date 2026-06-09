type ErrorCardProps = {
  message: string;
  onRetry: () => void;
  onReset?: () => void;
  retrying?: boolean;
  retryLabel?: string;
};

export function ErrorCard({
  message,
  onRetry,
  onReset,
  retrying = false,
  retryLabel = "Retry",
}: ErrorCardProps) {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 rounded-lg border border-red-200 bg-red-50 p-6 max-w-sm w-full">
      <p className="text-sm text-red-800 text-center">{message}</p>
      <button
        disabled={retrying}
        onClick={onRetry}
        className="w-full rounded bg-red-600 px-4 py-2 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {retrying ? "Retrying…" : retryLabel}
      </button>
      {onReset && (
        <button
          disabled={retrying}
          onClick={onReset}
          className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
        >
          Start over
        </button>
      )}
    </div>
  );
}
