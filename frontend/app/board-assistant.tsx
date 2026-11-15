import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, getApiErrorMessage, requestApiJson } from './api-client';
import type { ProjectBoard } from './projects-store';

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AssistantResponse = {
  reply: string;
  board: ProjectBoard | null;
};

type BoardAssistantProps = {
  projectId: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  beforeRequest: () => Promise<boolean>;
  onBoardUpdate: (board: ProjectBoard) => void;
};

function getAssistantErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return 'The board changed while the assistant was responding. Reload the board and try again.';
    }
    if (error.status === 413) {
      return 'This conversation or board is too large for the assistant. Clear the conversation or simplify the board.';
    }
    if (error.status === 503) {
      return 'The assistant is not configured on the server.';
    }
  }
  return getApiErrorMessage(error, 'The assistant could not respond. Please try again.');
}

export function BoardAssistant({
  projectId,
  busy,
  onBusyChange,
  beforeRequest,
  onBoardUpdate,
}: BoardAssistantProps) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const submissionInProgress = useRef(false);

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy || submissionInProgress.current) return;

    submissionInProgress.current = true;
    onBusyChange(true);
    setError('');
    setErrorStatus(null);

    try {
      if (!(await beforeRequest())) {
        setError('Save your board changes before asking the assistant, then try again.');
        return;
      }

      const history = messages.slice(-10);
      setMessages((current) => [...current, { role: 'user', content: message }]);
      setDraft('');
      const response = await requestApiJson<AssistantResponse>(
        `/api/projects/${encodeURIComponent(projectId)}/assistant`,
        {
          method: 'POST',
          body: JSON.stringify({ message, history }),
        },
      );

      if (response.board) onBoardUpdate(response.board);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response.reply },
      ]);
    } catch (requestError: unknown) {
      setMessages((current) => current.slice(0, -1));
      setDraft(message);
      setError(getAssistantErrorMessage(requestError));
      setErrorStatus(requestError instanceof ApiError ? requestError.status : null);
    } finally {
      submissionInProgress.current = false;
      onBusyChange(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setError('');
    setErrorStatus(null);
  };

  return (
    <section className="assistant-panel" aria-labelledby="assistant-heading">
      <header className="assistant-header">
        <div>
          <p className="eyebrow"><span /> BOARD ASSISTANT</p>
          <h2 id="assistant-heading">Petal assistant</h2>
          <p className="assistant-description">
            Ask about this board or request a safe update. The assistant cannot delete cards or columns.
          </p>
        </div>
        <button
          className="assistant-clear-button"
          type="button"
          onClick={clearConversation}
          disabled={busy || messages.length === 0}
        >
          Clear conversation
        </button>
      </header>

      <ol className="assistant-messages" role="log" aria-label="Assistant conversation" aria-relevant="additions">
        {messages.length === 0 ? (
          <li className="assistant-empty">Your conversation will appear here.</li>
        ) : messages.map((entry, index) => (
          <li
            className={`assistant-message assistant-message-${entry.role}`}
            key={`${index}-${entry.role}`}
          >
            <span className="assistant-message-label">
              {entry.role === 'user' ? 'You' : 'Petal assistant'}
            </span>
            <p>{entry.content}</p>
          </li>
        ))}
      </ol>

      <p className="assistant-status" role="status" aria-live="polite">
        {busy ? 'Saving the board and waiting for the assistant...' : ''}
      </p>
      {error ? (
        <p className="assistant-error" role="alert">
          {error}
          {errorStatus === 401 ? <> <Link href="/login">Sign in</Link></> : null}
        </p>
      ) : null}

      <form className="assistant-form" aria-label="Ask the Petal assistant" onSubmit={submitMessage}>
        <label htmlFor="assistant-message">Your message</label>
        <textarea
          id="assistant-message"
          className="input-field assistant-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question or describe a board update..."
          maxLength={2000}
          rows={3}
          disabled={busy}
        />
        <div className="assistant-form-actions">
          <span className="assistant-limit">Up to 2,000 characters</span>
          <button
            className="new-card-submit assistant-submit"
            type="submit"
            disabled={busy || !draft.trim()}
          >
            {busy ? 'Sending...' : 'Send message'}
          </button>
        </div>
      </form>
    </section>
  );
}
