import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/dashboard", "/cases"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const hasAuthCookie = req.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.includes("sb-") &&
        (cookie.name.includes("auth-token") || cookie.name.includes("access-token"))
    );

  const isProtected = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  if (!hasAuthCookie && isProtected) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (hasAuthCookie && req.nextUrl.pathname === "/login") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/cases/:path*", "/login"]
};

