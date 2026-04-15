import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../../../lib/supabaseClient';
import { TagKey } from '../../../lib/types';

export async function GET(request: Request) {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);
  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get('quizId');
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
  }

  let query = supabase
    .from('quizzes')
    .select('id, tag, quiz_title, question_count, display_count, category_display_counts, questions, target_user_ids, is_global, high_score, is_published, created_at')
    .eq('is_published', true)
    .or(`is_global.eq.true,target_user_ids.cs.${JSON.stringify([userId])}`)
    .order('created_at', { ascending: false });

  if (quizId) {
    query = query.eq('id', quizId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Không thể tải danh sách đề.' }, { status: 500 });
  }

  return NextResponse.json(quizId ? data?.[0] ?? null : data ?? []);
}

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

export async function PATCH(request: Request) {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);

  const body = await request.json();
  const { quizId, userId, tag, score } = body;

  if (!quizId || !userId || !tag || typeof score !== 'number') {
    return NextResponse.json({ error: 'Missing data to update score.' }, { status: 400 });
  }

  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id, high_score')
    .eq('id', quizId)
    .single();

  if (quizError || !quiz) {
    return NextResponse.json({ error: 'Quiz không tồn tại.' }, { status: 404 });
  }

  const expField = getExpField(tag as TagKey);
  const { data: user, error: userError } = await supabase
    .from('users')
    .select(`id, ${expField}`)
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: 'Người dùng không tồn tại.' }, { status: 404 });
  }

  const currentHigh = quiz.high_score ?? 0;
  const additional = Math.max(0, score - currentHigh);

  if (additional > 0) {
    const currentValue = (user as Record<string, number>)[expField] ?? 0;
    await supabase.from('quizzes').update({ high_score: score }).eq('id', quizId);
    await supabase.from('users').update({ [expField]: currentValue + additional }).eq('id', userId);
    return NextResponse.json({ message: `Cộng thêm ${additional} điểm EXP cho lĩnh vực ${tag}.` });
  }

  return NextResponse.json({ message: 'Không có điểm EXP mới vì không vượt kỷ lục cũ.' });
}
