import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../lib/supabaseClient';

export async function POST(request: Request) {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);
  const { username } = await request.json();

  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Username không hợp lệ.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, math_exp, lang_exp, flang_exp, sci_exp, hist_geo_exp, civic_exp')
    .eq('username', username.trim())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Username chưa tồn tại. Vui lòng liên hệ admin.' }, { status: 404 });
  }

  return NextResponse.json(data);
}
