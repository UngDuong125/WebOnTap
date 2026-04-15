import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../lib/supabaseClient';

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
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

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

export async function GET(request: Request) {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const tag = searchParams.get('tag');
  const title = searchParams.get('quizTitle');
  const onlyPublished = searchParams.get('onlyPublished');

  let query = supabase
    .from('quizzes')
    .select('id, created_by, tag, quiz_title, question_count, display_count, category_display_counts, questions, target_user_ids, is_global, high_score, is_published, created_at')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('created_by', userId);
  }
  if (tag) {
    query = query.eq('tag', tag);
  }
  if (title) {
    query = query.ilike('quiz_title', `%${title}%`);
  }
  if (onlyPublished === 'true') {
    query = query.eq('is_published', true);
  }

  const { data, error } = await query;

  if (error || !data) {
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);
  const body = await request.json();
  const { adminId, title, tag, displayCount, rawText, targetUserIds, isGlobal, categoryDisplayCounts } = body;

  if (!adminId || !title || !tag || !displayCount || !rawText) {
    return NextResponse.json({ error: 'Thieu du lieu tao de.' }, { status: 400 });
  }

  const parsed = parseRawQuestions(rawText);
  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: 'Du lieu cau hoi khong hop le.', details: parsed.errors }, { status: 400 });
  }

  if (Number(displayCount) > parsed.questions.length) {
    return NextResponse.json({ error: 'So cau hien thi khong duoc lon hon tong cau hoi.' }, { status: 400 });
  }

  const normalizedTargets = Array.isArray(targetUserIds)
    ? targetUserIds.filter((value: unknown) => typeof value === 'string' && value.trim().length > 0)
    : [];
  const normalizedGlobal = Boolean(isGlobal) || normalizedTargets.length === 0;

  const safeCategoryDisplayCounts =
    categoryDisplayCounts && typeof categoryDisplayCounts === 'object' && !Array.isArray(categoryDisplayCounts)
      ? Object.fromEntries(
          Object.entries(categoryDisplayCounts).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]),
        )
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

  if (error || !data) {
    return NextResponse.json({ error: 'Khong the tao bo de.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);
  const body = await request.json();
  const { quizId, quizTitle, tag, questions, displayCount, questionCount, isPublished, targetUserIds, isGlobal, categoryDisplayCounts } = body;

  if (!quizId) {
    return NextResponse.json({ error: 'Missing quizId.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof quizTitle === 'string' && quizTitle.trim()) updates.quiz_title = quizTitle.trim();
  if (typeof tag === 'string' && tag.trim()) updates.tag = tag.trim();
  if (Array.isArray(questions)) updates.questions = questions;
  if (typeof displayCount === 'number' && Number.isFinite(displayCount)) updates.display_count = Math.max(1, Math.floor(displayCount));
  if (typeof questionCount === 'number' && Number.isFinite(questionCount)) updates.question_count = Math.max(1, Math.floor(questionCount));
  if (typeof isPublished === 'boolean') updates.is_published = isPublished;
  if (typeof isGlobal === 'boolean') updates.is_global = isGlobal;
  if (categoryDisplayCounts && typeof categoryDisplayCounts === 'object' && !Array.isArray(categoryDisplayCounts)) {
    updates.category_display_counts = Object.fromEntries(
      Object.entries(categoryDisplayCounts).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]),
    );
  }
  if (Array.isArray(targetUserIds)) {
    updates.target_user_ids = targetUserIds.filter((value: unknown) => typeof value === 'string' && value.trim().length > 0);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Không có dữ liệu hợp lệ để cập nhật.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('quizzes')
    .update(updates)
    .eq('id', quizId)
    .select('id, created_by, tag, quiz_title, question_count, display_count, category_display_counts, questions, target_user_ids, is_global, high_score, is_published, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Không thể cập nhật đề.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);
  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get('quizId');

  if (!quizId) {
    return NextResponse.json({ error: 'Missing quizId.' }, { status: 400 });
  }

  const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
  if (error) {
    return NextResponse.json({ error: 'Không thể xóa đề.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
