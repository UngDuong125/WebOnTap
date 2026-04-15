import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function buildCookieHelpers(response: NextResponse) {
  return {
    getAll: async () => cookies().getAll().map((cookie) => ({ name: cookie.name, value: cookie.value })),
    setAll: async (cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
      cookiesToSet.forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie.options as any);
      });
    },
  };
}

export function createRouteSupabaseClient(response: NextResponse) {
  return createServerClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    cookies: buildCookieHelpers(response),
  });
}

export function createServerSupabaseClient(response: NextResponse) {
  return createServerClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    cookies: buildCookieHelpers(response),
  });
}
