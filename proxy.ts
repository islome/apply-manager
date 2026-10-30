import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/hr-session";
import { isUuid } from "@/lib/hr-http";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySession(token) : null;
  const isValidSession = userId !== null && isUuid(userId);

  if (isValidSession) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: user, error } = await supabase
      .from("hr_users")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[hr-proxy] user lookup failed", error);
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 },
      );
    }

    if (user?.is_active) {
      if (request.nextUrl.pathname === "/login") {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }
  }

  if (request.nextUrl.pathname === "/login") {
    const response = NextResponse.next();
    if (token) clearSessionCookie(response);
    return response;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const response = NextResponse.redirect(loginUrl);
  if (token) clearSessionCookie(response);
  return response;
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
