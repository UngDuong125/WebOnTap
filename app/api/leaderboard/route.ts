import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '../../../lib/supabaseClient';

export async function GET() {
  const response = NextResponse.next();
  const supabase = createRouteSupabaseClient(response);

  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, math_exp, lang_exp, flang_exp, sci_exp, hist_geo_exp, civic_exp')
    .neq('role', 'admin');

  if (error || !data) {
    return NextResponse.json([], { status: 200 });
  }

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

  return NextResponse.json(leaderboard);
}
