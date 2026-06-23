import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Drives a single questionnaire run: loads the form, holds in-progress answers
// (persisted to localStorage so a long form can be resumed), and submits to the
// server which re-scores and returns the authoritative result.
//
// A questionnaire is one atomic submit — unlike the math module there is no
// per-item grading, so there is no client-side scoring here; the server result
// is the source of truth.
export function useParentingQuiz(instrumentKey) {
  const { user } = useAuth();
  const draftKey = user?._id ? `parenting:draft:${user._id}:${instrumentKey}` : null;

  const [form, setForm] = useState(null);       // null = loading
  const [answers, setAnswers] = useState({});   // { itemId: value }
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load the form + any saved draft.
  useEffect(() => {
    let cancelled = false;
    setForm(null);
    setError(null);
    apiFetch(`/api/parenting/instruments/${instrumentKey}`)
      .then(f => {
        if (cancelled) return;
        setForm(f);
        if (draftKey) {
          try {
            const saved = JSON.parse(localStorage.getItem(draftKey) || '{}');
            if (saved && typeof saved === 'object') setAnswers(saved);
          } catch { /* ignore corrupt draft */ }
        }
      })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, [instrumentKey, draftKey]);

  const setAnswer = useCallback((itemId, value) => {
    setAnswers(prev => {
      const next = { ...prev, [itemId]: value };
      if (draftKey) {
        try { localStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* quota */ }
      }
      return next;
    });
  }, [draftKey]);

  const answeredCount = useMemo(
    () => (form ? form.items.filter(it => answers[it.id] != null).length : 0),
    [form, answers]
  );
  const total = form ? form.items.length : 0;
  const complete = total > 0 && answeredCount === total;
  const firstUnansweredId = form?.items.find(it => answers[it.id] == null)?.id || null;

  // Submit. On success clears the draft and returns the result (with _id).
  const submit = useCallback(async (subjectUserId) => {
    if (!form) throw new Error('Form not loaded');
    setSubmitting(true);
    setError(null);
    try {
      const responses = form.items.map(it => ({ itemId: it.id, value: answers[it.id] }));
      const body = { instrumentKey, responses };
      if (subjectUserId) body.subjectUserId = subjectUserId;
      const result = await apiFetch('/api/parenting/attempts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (draftKey) {
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      }
      return result;
    } catch (err) {
      setError(err.message || 'Submit failed');
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [form, answers, instrumentKey, draftKey]);

  return {
    form, answers, setAnswer,
    answeredCount, total, complete, firstUnansweredId,
    submit, submitting, error,
  };
}
