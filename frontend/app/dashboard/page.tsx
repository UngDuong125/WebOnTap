'use client';

import { useEffect, useMemo, useState } from 'react';
import { TAG_MAP } from '../../constants/tags';
import { apiUrl } from '../../lib/api';

type Question = {
  type: 'MCQ' | 'FILL';
  category: string;
  has_image: boolean;
  image_url: string;
  question_text: string;
  options: string[];
  answer: string;
  explanation: string;
};

type Quiz = {
  id: string;
  tag: string;
  quiz_title: string;
  question_count: number;
  display_count: number;
  category_display_counts: Record<string, number>;
  questions: Question[];
  high_score: number;
  is_published: boolean;
};

export default function DashboardPage() {
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [reviewAnswers, setReviewAnswers] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [scoreMessage, setScoreMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attemptSeed, setAttemptSeed] = useState(0);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('ai-quiz-user') : null;
    if (!raw) {
      window.location.href = '/login';
      return;
    }
    const parsed = JSON.parse(raw);
    setUser(parsed);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void fetchPublishedQuizzes(user.id);
  }, [user?.id]);

  function shuffleQuestions(items: Question[]) {
    const cloned = [...items];
    for (let i = cloned.length - 1; i > 0; i -= 1) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      [cloned[i], cloned[randomIndex]] = [cloned[randomIndex], cloned[i]];
    }
    return cloned;
  }

  const visibleQuestions = useMemo(() => {
    if (!selectedQuiz) return [];

    const totalToDisplay = Math.max(0, selectedQuiz.display_count ?? 0);
    const shuffledAll = shuffleQuestions(selectedQuiz.questions);

    if (totalToDisplay === 0 || shuffledAll.length === 0) {
      return [];
    }

    const categoryPlan = selectedQuiz.category_display_counts ?? {};
    if (!categoryPlan || Object.keys(categoryPlan).length === 0) {
      return shuffledAll.slice(0, totalToDisplay);
    }

    const byCategoryPool = shuffledAll.reduce<Record<string, Question[]>>((acc, question) => {
      const key = question.category ?? 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(question);
      return acc;
    }, {});

    const selected: Question[] = [];
    const usedQuestions = new Set<Question>();
    for (const [category, configuredCount] of Object.entries(categoryPlan)) {
      const pool = byCategoryPool[category] ?? [];
      const quota = Math.max(0, configuredCount);
      const picked = pool.slice(0, quota);
      for (const question of picked) {
        selected.push(question);
        usedQuestions.add(question);
      }
    }

    if (selected.length < totalToDisplay) {
      const remaining = shuffledAll.filter((question) => !usedQuestions.has(question));
      selected.push(...remaining.slice(0, totalToDisplay - selected.length));
    }

    return shuffleQuestions(selected).slice(0, totalToDisplay);
  }, [selectedQuiz, attemptSeed]);

  function handleRegenerateQuiz() {
    setAnswers({});
    setReviewAnswers({});
    setScoreMessage(null);
    setMessage(null);
    setAttemptSeed((prev) => prev + 1);
  }

  function normalizeAnswer(value: string) {
    return value.trim().toLowerCase();
  }

  function isCorrectAnswer(question: Question, userAnswer: string) {
    const actual = normalizeAnswer(userAnswer);
    const expected = normalizeAnswer(question.answer);
    if (actual === expected) return true;

    if (question.type === 'MCQ') {
      const letters = ['a', 'b', 'c', 'd'];
      const optionIndex = letters.indexOf(expected);
      if (optionIndex >= 0 && question.options[optionIndex]) {
        return actual === normalizeAnswer(question.options[optionIndex]);
      }
      const userOptionIndex = letters.indexOf(actual);
      if (userOptionIndex >= 0 && question.options[userOptionIndex]) {
        return normalizeAnswer(question.options[userOptionIndex]) === expected;
      }
    }

    return false;
  }

  function formatCorrectAnswer(question: Question) {
    if (question.type !== 'MCQ') {
      return question.answer;
    }

    const expected = normalizeAnswer(question.answer);
    const letters = ['a', 'b', 'c', 'd'];
    const optionIndex = letters.indexOf(expected);
    if (optionIndex >= 0 && question.options[optionIndex]) {
      const letter = String.fromCharCode(65 + optionIndex);
      return `${letter}. ${question.options[optionIndex]}`;
    }

    return question.answer;
  }

  async function fetchPublishedQuizzes(userId: string) {
    setLoading(true);
    const response = await fetch(apiUrl(`/api/quizzes?userId=${encodeURIComponent(userId)}`));
    if (!response.ok) {
      setMessage('Không thể tải danh sách đề.');
      setLoading(false);
      return;
    }

    const payload = await response.json();
    const list = Array.isArray(payload) ? payload : [];
    setQuizzes(list);
    setLoading(false);
  }

  async function handleSubmitExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQuiz || !user) return;

    const total = visibleQuestions.length;
    const correct = visibleQuestions.reduce((acc, question, index) => {
      return acc + (isCorrectAnswer(question, answers[index] ?? '') ? 1 : 0);
    }, 0);
    const nextReviewAnswers = visibleQuestions.reduce<Record<number, string>>((acc, question, index) => {
      const userAnswer = answers[index] ?? '';
      const hasAnswered = userAnswer.trim().length > 0;
      const isCorrect = isCorrectAnswer(question, userAnswer);
      if (!hasAnswered || !isCorrect) {
        acc[index] = formatCorrectAnswer(question);
      }
      return acc;
    }, {});
    setReviewAnswers(nextReviewAnswers);

    const response = await fetch(apiUrl('/api/quizzes'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: selectedQuiz.id,
        userId: user.id,
        tag: selectedQuiz.tag,
        score: correct,
      }),
    });

    if (!response.ok) {
      setScoreMessage(`Ban dat ${correct}/${total}. Khong the cap nhat diem.`);
      return;
    }

    const payload = await response.json();
    setScoreMessage(`Ban dat ${correct}/${total}. ${payload.message}`);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 text-slate-100">
      <section className="mb-8 rounded-3xl border border-slate-700 bg-slate-900/90 p-8 shadow-2xl shadow-slate-950/40">
        <h1 className="text-3xl font-semibold">Chào mừng, {user?.username}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <a href="/" className="rounded-full border border-slate-600 px-4 py-2 hover:border-cyan-400">Trang chủ</a>
          <a href="/leaderboard" className="rounded-full border border-slate-600 px-4 py-2 hover:border-cyan-400">Leaderboard</a>
          <a href="/admin" className="rounded-full border border-slate-600 px-4 py-2 hover:border-cyan-400">Admin</a>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-slate-700 bg-slate-900/90 p-6">
          <h2 className="text-xl font-semibold">Bộ đề khả dụng</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Đang tải danh sách đề...</p>
          ) : quizzes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Chưa có bộ đề nào được publish.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {quizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  type="button"
                  onClick={() => {
                    setSelectedQuiz(quiz);
                    setAnswers({});
                    setReviewAnswers({});
                    setScoreMessage(null);
                    setMessage(null);
                    setAttemptSeed((prev) => prev + 1);
                  }}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-left text-sm transition hover:border-cyan-400"
                >
                  <p className="font-semibold text-white">{quiz.quiz_title}</p>
                  <p className="mt-1 text-slate-400">
                    Tag: {TAG_MAP[quiz.tag] || quiz.tag} - {quiz.display_count}/{quiz.question_count} câu - High score: {quiz.high_score}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-700 bg-slate-900/90 p-6">
          {!selectedQuiz ? (
            <p className="text-sm text-slate-400">Chọn một bộ đề để bắt đầu làm bài.</p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmitExam}>
              <div>
                <h2 className="text-2xl font-semibold">{selectedQuiz.quiz_title}</h2>
                <p className="mt-1 text-sm text-slate-400">Tag: {TAG_MAP[selectedQuiz.tag] || selectedQuiz.tag}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRegenerateQuiz}
                  className="rounded-xl border border-cyan-500 px-5 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
                >
                  Làm lại đề mới
                </button>
              </div>

              {visibleQuestions.map((question, index) => (
                <fieldset key={index} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
                  <legend className="text-sm font-semibold text-slate-200">Câu {index + 1}</legend>
                  <p>{question.question_text}</p>
                  {question.has_image && question.image_url ? (
                    <img src={question.image_url} alt={`Câu ${index + 1}`} className="max-h-72 w-full rounded-xl border border-slate-700 object-contain" />
                  ) : null}

                  {question.type === 'MCQ' ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {question.options.map((option, optionIndex) => {
                        const letter = String.fromCharCode(65 + optionIndex);
                        return (
                          <label key={`${index}-${optionIndex}`} className="rounded-xl border border-slate-700 px-3 py-2 text-sm">
                            <input
                              type="radio"
                              name={`question-${index}`}
                              value={letter}
                              checked={answers[index] === letter}
                              onChange={() => setAnswers((prev) => ({ ...prev, [index]: letter }))}
                              className="mr-2"
                            />
                            {letter}. {option}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={answers[index] ?? ''}
                      onChange={(event) => setAnswers((prev) => ({ ...prev, [index]: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                      placeholder="Nhập đáp án của bạn"
                    />
                  )}
                  {reviewAnswers[index] ? (
                    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                      Đáp án đúng: {reviewAnswers[index]}
                    </p>
                  ) : null}
                </fieldset>
              ))}

              {scoreMessage ? <p className="text-sm text-cyan-300">{scoreMessage}</p> : null}
              {message ? <p className="text-sm text-rose-300">{message}</p> : null}
              <button type="submit" className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
                Nộp bài
              </button>
              <button
                type="button"
                onClick={handleRegenerateQuiz}
                className="rounded-xl border border-cyan-500 px-5 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
              >
                Làm lại đề mới
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
