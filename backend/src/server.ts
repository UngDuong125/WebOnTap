import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const port = Number(process.env.PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const cloudKey = process.env.CLOUDINARY_API_KEY;
const cloudSecret = process.env.CLOUDINARY_API_SECRET;

const supabase = createClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TagKey = 'math' | 'lang' | 'flang' | 'sci' | 'hist_geo' | 'civic';

app.use(cors({ origin: frontendOrigin }));
app.use(express.json({ limit: '2mb' }));

app.post('/api/auth/login', async (req, res) => {
  const { username } = req.body ?? {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username không hợp lệ.' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, math_exp, lang_exp, flang_exp, sci_exp, hist_geo_exp, civic_exp')
    .eq('username', username.trim())
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Username chưa tồn tại. Vui lòng liên hệ admin.' });
  }
  return res.json(data);
});

app.get('/api/quizzes', async (req, res) => {
  const quizId = req.query.quizId as string | undefined;
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId.' });
  }

  let query = supabase
    .from('quizzes')
    .select('id, tag, quiz_title, question_count, display_count, category_display_counts, questions, target_user_ids, is_global, high_score, is_published, created_at')
    .eq('is_published', true)
    .or(`is_global.eq.true,target_user_ids.cs.${JSON.stringify([userId])}`)
    .order('created_at', { ascending: false });

  if (quizId) query = query.eq('id', quizId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Không thể tải danh sách đề.' });
  return res.json(quizId ? data?.[0] ?? null : data ?? []);
});

function getExpField(tag: TagKey) {
  switch (tag) {
    case 'math':
      return 'math_exp';
    case 'lang':
      return 'lang_exp';
    case 'flang':
      return 'flang_exp';
    case 'sci':
      return 'sci_exp';
    case 'hist_geo':
      return 'hist_geo_exp';
    case 'civic':
      return 'civic_exp';
    default:
      return 'math_exp';
  }
}

app.patch('/api/quizzes', async (req, res) => {
  const { quizId, userId, tag, score } = req.body ?? {};
  if (!quizId || !userId || !tag || typeof score !== 'number') {
    return res.status(400).json({ error: 'Missing data to update score.' });
  }

  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id, high_score')
    .eq('id', quizId)
    .single();
  if (quizError || !quiz) return res.status(404).json({ error: 'Quiz không tồn tại.' });

  const expField = getExpField(tag as TagKey);
  const { data: user, error: userError } = await supabase.from('users').select(`id, ${expField}`).eq('id', userId).single();
  if (userError || !user) return res.status(404).json({ error: 'Người dùng không tồn tại.' });

  const currentHigh = quiz.high_score ?? 0;
  const additional = Math.max(0, score - currentHigh);
  if (additional > 0) {
    const currentValue = (user as Record<string, number>)[expField] ?? 0;
    await supabase.from('quizzes').update({ high_score: score }).eq('id', quizId);
    await supabase.from('users').update({ [expField]: currentValue + additional }).eq('id', userId);
    return res.json({ message: `Cộng thêm ${additional} điểm EXP cho lĩnh vực ${tag}.` });
  }
  return res.json({ message: 'Không có điểm EXP mới vì không vượt kỷ lục cũ.' });
});

type ParsedQuestion = {
  type: 'MCQ' | 'FILL';
  category: string;
  has_image: boolean;
  image_url: string;
  question_text: string;
  options: string[];
  answer: string;
  explanation: string;
};

function parseRawQuestions(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];
  lines.forEach((line, index) => {
    const parts = line.split('|').map((part) => part.trim());
    if (parts.length < 7) {
      errors.push(`Dong ${index + 1}: Khong du 7 cot theo dinh dang.`);
      return;
    }
    const [typeRaw, category, hasImageRaw, questionText, optionsRaw, answerRaw, explanation] = parts;
    const type = typeRaw.toUpperCase() === 'FILL' ? 'FILL' : typeRaw.toUpperCase() === 'MCQ' ? 'MCQ' : null;
    if (!type) {
      errors.push(`Dong ${index + 1}: Loai cau hoi phai la MCQ hoac FILL.`);
      return;
    }
    const has_image = hasImageRaw.toUpperCase() === 'Y';
    const options = type === 'MCQ' ? optionsRaw.split(';').map((option) => option.trim()).filter(Boolean) : [];
    if (type === 'MCQ' && options.length < 2) {
      errors.push(`Dong ${index + 1}: Cau hoi MCQ can it nhat 2 lua chon.`);
      return;
    }
    questions.push({
      type,
      category,
      has_image,
      image_url: '',
      question_text: questionText,
      options,
      answer: answerRaw,
      explanation,
    });
  });
  return { questions, errors };
}

app.get('/api/admin/quizzes', async (req, res) => {
  const userId = req.query.userId as string | undefined;
  const tag = req.query.tag as string | undefined;
  const title = req.query.quizTitle as string | undefined;
  const onlyPublished = req.query.onlyPublished as string | undefined;

  let query = supabase
    .from('quizzes')
    .select('id, created_by, tag, quiz_title, question_count, display_count, category_display_counts, questions, target_user_ids, is_global, high_score, is_published, created_at')
    .order('created_at', { ascending: false });
  if (userId) query = query.eq('created_by', userId);
  if (tag) query = query.eq('tag', tag);
  if (title) query = query.ilike('quiz_title', `%${title}%`);
  if (onlyPublished === 'true') query = query.eq('is_published', true);

  const { data, error } = await query;
  if (error || !data) return res.json([]);
  return res.json(data);
});

app.post('/api/admin/quizzes', async (req, res) => {
  const { adminId, title, tag, displayCount, rawText, targetUserIds, isGlobal, categoryDisplayCounts } = req.body ?? {};
  if (!adminId || !title || !tag || !displayCount || !rawText) {
    return res.status(400).json({ error: 'Thieu du lieu tao de.' });
  }

  const parsed = parseRawQuestions(rawText);
  if (parsed.errors.length > 0) return res.status(400).json({ error: 'Du lieu cau hoi khong hop le.', details: parsed.errors });
  if (Number(displayCount) > parsed.questions.length) {
    return res.status(400).json({ error: 'So cau hien thi khong duoc lon hon tong cau hoi.' });
  }

  const normalizedTargets = Array.isArray(targetUserIds)
    ? targetUserIds.filter((value: unknown) => typeof value === 'string' && value.trim().length > 0)
    : [];
  const normalizedGlobal = Boolean(isGlobal) || normalizedTargets.length === 0;
  const safeCategoryDisplayCounts =
    categoryDisplayCounts && typeof categoryDisplayCounts === 'object' && !Array.isArray(categoryDisplayCounts)
      ? Object.fromEntries(Object.entries(categoryDisplayCounts).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]))
      : {};

  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      created_by: adminId,
      tag: String(tag).trim(),
      quiz_title: String(title).trim(),
      question_count: parsed.questions.length,
      display_count: Math.floor(Number(displayCount)),
      category_display_counts: safeCategoryDisplayCounts,
      questions: parsed.questions,
      target_user_ids: normalizedGlobal ? [] : normalizedTargets,
      is_global: normalizedGlobal,
      high_score: 0,
      is_published: false,
    })
    .select('id, created_by, tag, quiz_title, question_count, display_count, category_display_counts, questions, target_user_ids, is_global, high_score, is_published, created_at')
    .single();

  if (error || !data) return res.status(500).json({ error: 'Khong the tao bo de.' });
  return res.json(data);
});

app.patch('/api/admin/quizzes', async (req, res) => {
  const { quizId, quizTitle, tag, questions, displayCount, questionCount, isPublished, targetUserIds, isGlobal, categoryDisplayCounts } = req.body ?? {};
  if (!quizId) return res.status(400).json({ error: 'Missing quizId.' });

  const updates: Record<string, unknown> = {};
  if (typeof quizTitle === 'string' && quizTitle.trim()) updates.quiz_title = quizTitle.trim();
  if (typeof tag === 'string' && tag.trim()) updates.tag = tag.trim();
  if (Array.isArray(questions)) updates.questions = questions;
  if (typeof displayCount === 'number' && Number.isFinite(displayCount)) updates.display_count = Math.max(1, Math.floor(displayCount));
  if (typeof questionCount === 'number' && Number.isFinite(questionCount)) updates.question_count = Math.max(1, Math.floor(questionCount));
  if (typeof isPublished === 'boolean') updates.is_published = isPublished;
  if (typeof isGlobal === 'boolean') updates.is_global = isGlobal;
  if (categoryDisplayCounts && typeof categoryDisplayCounts === 'object' && !Array.isArray(categoryDisplayCounts)) {
    updates.category_display_counts = Object.fromEntries(Object.entries(categoryDisplayCounts).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]));
  }
  if (Array.isArray(targetUserIds)) {
    updates.target_user_ids = targetUserIds.filter((value: unknown) => typeof value === 'string' && value.trim().length > 0);
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Không có dữ liệu hợp lệ để cập nhật.' });

  const { data, error } = await supabase
    .from('quizzes')
    .update(updates)
    .eq('id', quizId)
    .select('id, created_by, tag, quiz_title, question_count, display_count, category_display_counts, questions, target_user_ids, is_global, high_score, is_published, created_at')
    .single();
  if (error || !data) return res.status(500).json({ error: 'Không thể cập nhật đề.' });
  return res.json(data);
});

app.delete('/api/admin/quizzes', async (req, res) => {
  const quizId = req.query.quizId as string | undefined;
  if (!quizId) return res.status(400).json({ error: 'Missing quizId.' });
  const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
  if (error) return res.status(500).json({ error: 'Không thể xóa đề.' });
  return res.json({ success: true });
});

app.get('/api/admin/users', async (_, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, math_exp, lang_exp, flang_exp, sci_exp, hist_geo_exp, civic_exp');
  if (error || !data) return res.json([]);
  return res.json(data);
});

app.patch('/api/admin/users', async (req, res) => {
  const { userId, action } = req.body ?? {};
  if (!userId || !action) return res.status(400).json({ error: 'Missing or invalid action.' });
  const updates: Record<string, unknown> = {};

  if (action === 'reset') {
    updates.math_exp = 0;
    updates.lang_exp = 0;
    updates.flang_exp = 0;
    updates.sci_exp = 0;
    updates.hist_geo_exp = 0;
    updates.civic_exp = 0;
  }

  if (action === 'set_role') {
    const nextRole = req.body.role;
    if (nextRole !== 'admin' && nextRole !== 'user') return res.status(400).json({ error: 'Role không hợp lệ.' });
    updates.role = nextRole;
  }

  if (action === 'update_exp') {
    const fields = ['math_exp', 'lang_exp', 'flang_exp', 'sci_exp', 'hist_geo_exp', 'civic_exp'] as const;
    const payload = req.body.values as Record<string, unknown> | undefined;
    for (const field of fields) {
      const value = payload?.[field];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        updates[field] = Math.floor(value);
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Không có điểm EXP hợp lệ để cập nhật.' });
    }
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Action không được hỗ trợ.' });

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, username, role, math_exp, lang_exp, flang_exp, sci_exp, hist_geo_exp, civic_exp')
    .single();
  if (error || !data) return res.status(500).json({ error: 'Không thể reset điểm người dùng.' });
  return res.json(data);
});

app.delete('/api/admin/users', async (req, res) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) return res.status(400).json({ error: 'Missing userId.' });
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) return res.status(500).json({ error: 'Không thể xóa người dùng.' });
  return res.json({ success: true });
});

app.get('/api/leaderboard', async (_, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, math_exp, lang_exp, flang_exp, sci_exp, hist_geo_exp, civic_exp')
    .neq('role', 'admin');
  if (error || !data) return res.json([]);

  const leaderboard = data
    .map((user: { math_exp?: number; lang_exp?: number; flang_exp?: number; sci_exp?: number; hist_geo_exp?: number; civic_exp?: number }) => ({
      ...user,
      total_exp:
        (user.math_exp ?? 0) +
        (user.lang_exp ?? 0) +
        (user.flang_exp ?? 0) +
        (user.sci_exp ?? 0) +
        (user.hist_geo_exp ?? 0) +
        (user.civic_exp ?? 0),
    }))
    .sort((a, b) => b.total_exp - a.total_exp)
    .slice(0, 20);

  return res.json(leaderboard);
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!cloudName || !cloudKey || !cloudSecret) {
    return res.status(500).json({ error: 'Cloudinary chưa được cấu hình đầy đủ.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Thiếu file upload.' });

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash('sha1').update(`timestamp=${timestamp}${cloudSecret}`).digest('hex');
  const formData = new FormData();
  const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
  formData.append('file', blob, req.file.originalname);
  formData.append('api_key', cloudKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: data.error?.message ?? 'Cloudinary upload failed.' });
  return res.json({ url: data.secure_url });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend is running on http://localhost:${port}`);
});
