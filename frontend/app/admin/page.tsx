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

type QuizRow = {
  id: string;
  created_by: string | null;
  tag: string;
  quiz_title: string;
  question_count: number;
  display_count: number;
  category_display_counts: Record<string, number>;
  questions: Question[];
  target_user_ids: string[];
  is_global: boolean;
  high_score: number;
  is_published: boolean;
};

type UserOption = {
  id: string;
  username: string;
  role: string;
};

const tags = ['math', 'lang', 'flang', 'sci', 'hist_geo', 'civic'] as const;

export default function AdminPage() {
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState<(typeof tags)[number]>('math');
  const [displayCount, setDisplayCount] = useState(5);
  const [rawText, setRawText] = useState('');
  const [isGlobalTarget, setIsGlobalTarget] = useState(true);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [editorQuestions, setEditorQuestions] = useState<Question[]>([]);
  const [editorCategoryCounts, setEditorCategoryCounts] = useState<Record<string, number>>({});
  const [savingEditor, setSavingEditor] = useState(false);
  const [uploadingImageIndexes, setUploadingImageIndexes] = useState<number[]>([]);

  const editingQuiz = useMemo(() => quizzes.find((quiz) => quiz.id === editingQuizId) ?? null, [quizzes, editingQuizId]);
  const editorCategoryStats = useMemo(() => {
    const totalsByCategory: Record<string, number> = {};
    for (const question of editorQuestions) {
      totalsByCategory[question.category] = (totalsByCategory[question.category] ?? 0) + 1;
    }

    const allCategories = new Set([...Object.keys(editorCategoryCounts), ...Object.keys(totalsByCategory)]);
    return [...allCategories].sort().map((category) => ({
      category,
      selectedCount: Math.max(0, Number(editorCategoryCounts[category] ?? 0) || 0),
      totalCount: totalsByCategory[category] ?? 0,
    }));
  }, [editorCategoryCounts, editorQuestions]);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('ai-quiz-user') : null;
    if (!raw) {
      window.location.href = '/login';
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed.role !== 'admin') {
      window.location.href = '/dashboard';
      return;
    }
    setUser(parsed);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void fetchQuizzes();
    void fetchUsers();
  }, [user?.id]);

  async function fetchQuizzes() {
    setLoading(true);
    const response = await fetch(apiUrl('/api/admin/quizzes'));
    if (!response.ok) {
      setMessage('Không thể tải danh sách đề thi.');
      setLoading(false);
      return;
    }
    setQuizzes(await response.json());
    setLoading(false);
  }

  async function fetchUsers() {
    const response = await fetch(apiUrl('/api/admin/users'));
    if (!response.ok) return;
    const payload = await response.json();
    const list = Array.isArray(payload) ? payload : [];
    setUsers(list.filter((item: UserOption) => item.role === 'user'));
  }

  async function handleCreateQuiz(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id) return;
    setCreating(true);
    setMessage(null);
    const response = await fetch(apiUrl('/api/admin/quizzes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: user.id,
        title,
        tag,
        displayCount,
        rawText,
        isGlobal: isGlobalTarget,
        targetUserIds: isGlobalTarget ? [] : selectedTargetIds,
      }),
    });
    setCreating(false);
    const payload = await response.json();
    if (!response.ok) {
      setMessage(Array.isArray(payload?.details) ? `${payload.error} ${payload.details.join(' | ')}` : payload?.error ?? 'Khong the tao bo de.');
      return;
    }
    setMessage('Đã tạo bộ đề thành công. Bạn có thể vào Editor Mode để chỉnh sửa.');
    setTitle('');
    setRawText('');
    setIsGlobalTarget(true);
    setSelectedTargetIds([]);
    await fetchQuizzes();
  }

  function openEditor(quiz: QuizRow) {
    setEditingQuizId(quiz.id);
    setEditorQuestions(quiz.questions ?? []);
    const byCategory: Record<string, number> = {};
    for (const question of quiz.questions ?? []) {
      byCategory[question.category] = (byCategory[question.category] ?? 0) + 1;
    }
    setEditorCategoryCounts(
      Object.keys(quiz.category_display_counts ?? {}).length > 0 ? quiz.category_display_counts : byCategory,
    );
  }

  async function handleSaveEditor() {
    if (!editingQuizId) return;
    setSavingEditor(true);
    const totalDisplay = Object.values(editorCategoryCounts).reduce((sum, item) => sum + Math.max(0, Number(item) || 0), 0);
    const response = await fetch(apiUrl('/api/admin/quizzes'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: editingQuizId,
        questions: editorQuestions,
        questionCount: editorQuestions.length,
        categoryDisplayCounts: editorCategoryCounts,
        displayCount: totalDisplay,
      }),
    });
    setSavingEditor(false);
    if (!response.ok) {
      setMessage('Không thể lưu thay đổi trong Editor Mode.');
      return;
    }
    setMessage('Đã lưu thay đổi trong Editor Mode.');
    const updated = await response.json();
    setQuizzes((prev) => prev.map((quiz) => (quiz.id === updated.id ? updated : quiz)));
  }

  async function handleQuestionImageUpload(questionIndex: number, file: File) {
    if (!file) return;

    setUploadingImageIndexes((prev) => (prev.includes(questionIndex) ? prev : [...prev, questionIndex]));
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(apiUrl('/api/upload'), {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || !payload?.url) {
        setMessage(payload?.error ?? 'Upload ảnh thất bại.');
        return;
      }

      setEditorQuestions((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === questionIndex
            ? {
                ...item,
                has_image: true,
                image_url: payload.url,
              }
            : item,
        ),
      );
      setMessage('Tải ảnh thành công. URL Cloudinary đã được gắn vào câu hỏi.');
    } catch {
      setMessage('Không thể tải ảnh lên Cloudinary.');
    } finally {
      setUploadingImageIndexes((prev) => prev.filter((item) => item !== questionIndex));
    }
  }

  async function handlePublish(quizId: string, isPublished: boolean) {
    const response = await fetch(apiUrl('/api/admin/quizzes'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId, isPublished }),
    });
    if (!response.ok) {
      setMessage('Không thể cập nhật trạng thái publish.');
      return;
    }
    const updated = await response.json();
    setQuizzes((prev) => prev.map((quiz) => (quiz.id === quizId ? updated : quiz)));
  }

  async function handleDeleteQuiz(quizId: string) {
    const response = await fetch(apiUrl(`/api/admin/quizzes?quizId=${encodeURIComponent(quizId)}`), { method: 'DELETE' });
    if (!response.ok) {
      setMessage('Không thể xóa bộ đề.');
      return;
    }
    setQuizzes((prev) => prev.filter((quiz) => quiz.id !== quizId));
  }

  async function handleUpdateTargets(quizId: string, isGlobal: boolean, targetUserIds: string[]) {
    const response = await fetch(apiUrl('/api/admin/quizzes'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId, isGlobal, targetUserIds }),
    });
    if (!response.ok) {
      setMessage('Không thể cập nhật mục tiêu phân phối.');
      return;
    }
    const updated = await response.json();
    setQuizzes((prev) => prev.map((quiz) => (quiz.id === quizId ? updated : quiz)));
  }

  function toggleTargetUser(userId: string) {
    setSelectedTargetIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  function renderTargetText(quiz: QuizRow) {
    if (quiz.is_global) return 'Tất cả người dùng';
    const names = users.filter((item) => quiz.target_user_ids.includes(item.id)).map((item) => item.username);
    return names.length > 0 ? names.join(', ') : 'Chưa chọn người dùng nào';
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 text-slate-100">
      <section className="mb-8 rounded-3xl border border-slate-700 bg-slate-900/90 p-8">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <a href="/" className="rounded-full border border-slate-600 px-4 py-2 hover:border-cyan-400">Trang chủ</a>
          <a href="/dashboard" className="rounded-full border border-slate-600 px-4 py-2 hover:border-cyan-400">Dashboard</a>
          <a href="/leaderboard" className="rounded-full border border-slate-600 px-4 py-2 hover:border-cyan-400">Leaderboard</a>
        </div>
      </section>

      <section className="mb-8 rounded-3xl border border-slate-700 bg-slate-900/90 p-6">
        <h2 className="text-2xl font-semibold">Tạo bộ đề</h2>
        <p className="text-sm text-slate-400">Định dạng câu hỏi</p>
        <p className="text-xs text-slate-500">Loại | Danh mục | Có ảnh? (Y/N) | Câu hỏi | Đáp án (MCQ tách ; hoặc để trống) | Đáp án đúng | Giải thích</p>
        <form className="mt-5 space-y-4" onSubmit={handleCreateQuiz}>
          <div className="grid gap-4 sm:grid-cols-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tên bộ đề" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
            <select value={tag} onChange={(event) => setTag(event.target.value as (typeof tags)[number])} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
              {tags.map((item) => (
                <option key={item} value={item}>{TAG_MAP[item] || item}</option>
              ))}
            </select>
            <input type="number" min={1} value={displayCount} onChange={(event) => setDisplayCount(Number(event.target.value))} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
          </div>
          <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={8} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isGlobalTarget} onChange={(event) => setIsGlobalTarget(event.target.checked)} />
            Phân phối cho tất cả người dùng
          </label>
          {!isGlobalTarget ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {users.map((item) => (
                <label key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm">
                  <input type="checkbox" checked={selectedTargetIds.includes(item.id)} onChange={() => toggleTargetUser(item.id)} />
                  {item.username}
                </label>
              ))}
            </div>
          ) : null}
          <button disabled={creating} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {creating ? 'Đang tạo...' : 'Tạo bộ đề'}
          </button>
        </form>
      </section>

      {editingQuiz ? (
        <section className="mb-8 rounded-3xl border border-slate-700 bg-slate-900/90 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Editor Mode - {editingQuiz.quiz_title}</h2>
            <button type="button" onClick={() => setEditingQuizId(null)} className="rounded-full border border-slate-600 px-4 py-2 text-sm">Dong</button>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
            <h3 className="font-semibold">Số câu hỏi theo danh mục</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {editorCategoryStats.map(({ category, selectedCount, totalCount }) => (
                <label key={category} className="text-sm">
                  <span>{category}</span>
                  <p className="text-xs text-slate-400">Đã chọn/Tổng: {selectedCount}/{totalCount}</p>
                  <input
                    type="number"
                    min={0}
                    value={selectedCount}
                    onChange={(event) =>
                      setEditorCategoryCounts((prev) => ({ ...prev, [category]: Math.max(0, Number(event.target.value) || 0) }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {editorQuestions.map((question, index) => (
              <div key={index} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <p className="mb-2 text-sm font-semibold">Cau {index + 1} - {question.type}</p>
                <input
                  value={question.category}
                  onChange={(event) =>
                    setEditorQuestions((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, category: event.target.value } : item)))
                  }
                  placeholder="Danh mục câu hỏi"
                  className="mb-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                />
                <textarea
                  value={question.question_text}
                  onChange={(event) =>
                    setEditorQuestions((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, question_text: event.target.value } : item)))
                  }
                  rows={2}
                  className="mb-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                />
                <div className="mb-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={question.has_image}
                      onChange={(event) =>
                        setEditorQuestions((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  has_image: event.target.checked,
                                  image_url: event.target.checked ? item.image_url : '',
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    Câu hỏi có hình ảnh
                  </label>
                  {question.has_image ? (
                    <div className="mt-2 space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const selectedFile = event.target.files?.[0];
                          if (!selectedFile) return;
                          void handleQuestionImageUpload(index, selectedFile);
                          event.currentTarget.value = '';
                        }}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-950"
                      />
                      {uploadingImageIndexes.includes(index) ? (
                        <p className="text-xs text-cyan-300">Đang tải ảnh lên Cloudinary...</p>
                      ) : null}
                      {question.image_url ? (
                        <>
                          <a href={question.image_url} target="_blank" rel="noreferrer" className="block text-xs text-cyan-300 hover:text-cyan-200">
                            Xem ảnh đã tải trên Cloudinary
                          </a>
                          <img src={question.image_url} alt={`question-${index + 1}`} className="max-h-48 rounded-xl border border-slate-700 object-contain" />
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">Chưa có ảnh. Hãy chọn file để tải lên.</p>
                      )}
                    </div>
                  ) : null}
                </div>
                {question.type === 'MCQ' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => (
                      <input
                        key={optionIndex}
                        value={option}
                        onChange={(event) =>
                          setEditorQuestions((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    options: item.options.map((optionValue, optionValueIndex) =>
                                      optionValueIndex === optionIndex ? event.target.value : optionValue,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                      />
                    ))}
                  </div>
                ) : null}
                <input
                  value={question.answer}
                  onChange={(event) =>
                    setEditorQuestions((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, answer: event.target.value } : item)))
                  }
                  placeholder="Đáp án đúng"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                />
                <textarea
                  value={question.explanation}
                  onChange={(event) =>
                    setEditorQuestions((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, explanation: event.target.value } : item)))
                  }
                  rows={2}
                  placeholder="Giải thích"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>

          <button onClick={handleSaveEditor} disabled={savingEditor} className="mt-4 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {savingEditor ? 'Đang lưu...' : 'Lưu Editor Mode'}
          </button>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-700 bg-slate-900/90 p-6">
        <h2 className="text-2xl font-semibold">Danh sách bộ đề</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-400">Đang tải...</p>
        ) : (
          <div className="mt-4 space-y-3">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <p className="font-semibold">{quiz.quiz_title}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {TAG_MAP[quiz.tag] || quiz.tag} - {quiz.display_count}/{quiz.question_count} câu - Mục tiêu: {renderTargetText(quiz)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => openEditor(quiz)} className="rounded-full border border-cyan-500 px-4 py-2 text-sm text-cyan-300">Editor mode</button>
                  <button onClick={() => handlePublish(quiz.id, !quiz.is_published)} className="rounded-full border border-emerald-500 px-4 py-2 text-sm text-emerald-300">
                    {quiz.is_published ? 'Bỏ publish' : 'Publish'}
                  </button>
                  <button onClick={() => handleDeleteQuiz(quiz.id)} className="rounded-full border border-rose-600 px-4 py-2 text-sm text-rose-300">Xóa đề</button>
                  <button onClick={() => handleUpdateTargets(quiz.id, true, [])} className="rounded-full border border-sky-600 px-4 py-2 text-sm text-sky-300">Tất cả người dùng</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {message ? <p className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-amber-300">{message}</p> : null}
    </main>
  );
}
