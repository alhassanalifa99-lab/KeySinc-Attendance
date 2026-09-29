import { NextResponse } from "next/server";
import { requireAdmin } from "./lib/adminAuth";

export async function middleware(request) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (await requireAdmin(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};