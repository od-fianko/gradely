import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn   = !!req.auth;

  const isAuthRoute      = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isProtectedRoute = pathname.startsWith("/lecturer") || pathname.startsWith("/student") || pathname.startsWith("/admin");

  if (isAuthRoute && isLoggedIn) {
    const role = req.auth?.user?.role;
    const dest = role === "ADMIN" ? "/admin" : role === "LECTURER" ? "/lecturer" : "/student";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
