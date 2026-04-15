import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../../../../lib/supabaseClient';

export async function GET() {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);

  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, math_exp, lang_exp, flang_exp, sci_exp, hist_geo_exp, civic_exp');

  if (error || !data) {
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);

  const body = await request.json();
  const { userId, action } = body;

  if (!userId || !action) {
    return NextResponse.json({ error: 'Missing or invalid action.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (action === 'reset') {
    updates.math_exp = 0;
    updates.lang_exp = 0;
    updates.flang_exp = 0;
    updates.sci_exp = 0;
    updates.hist_geo_exp = 0;
    updates.civic_exp = 0;
  }

  if (action === 'update_exp') {
    const fields = ['math_exp', 'lang_exp', 'flang_exp', 'sci_exp', 'hist_geo_exp', 'civic_exp'] as const;
    const payload = body.values as Record<string, unknown> | undefined;
    for (const field of fields) {
      const value = payload?.[field];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        updates[field] = Math.floor(value);
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Không có điểm EXP hợp lệ để cập nhật.' }, { status: 400 });
    }
  }

  if (action === 'set_role') {
    const nextRole = body.role;
    if (nextRole !== 'admin' && nextRole !== 'user') {
      return NextResponse.json({ error: 'Role không hợp lệ.' }, { status: 400 });
    }
    updates.role = nextRole;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Action không được hỗ trợ.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, username, role, math_exp, lang_exp, flang_exp, sci_exp, hist_geo_exp, civic_exp')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Không thể reset điểm người dùng.' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });
  }

  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) {
    return NextResponse.json({ error: 'Không thể xóa người dùng.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
