import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { MODULES, type ModuleKey } from "@/lib/modules";

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/reporte-diario/build", "/sin-acceso"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function moduleKeyForPath(pathname: string): ModuleKey | null {
  const match = MODULES.find((m) => (m.href === "/" ? pathname === "/" : pathname.startsWith(m.href)));
  return match ? match.key : null;
}

interface ProfileRow {
  role: "superadmin" | "admin";
  active: boolean;
  module_permissions: string[];
}

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=role,active,module_permissions`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Accept-Profile": "paneltraffiker",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

export async function middleware(request: NextRequest) {
  if (isPublic(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isApi = request.nextUrl.pathname.startsWith("/api/");

  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Las rutas de API validan rol/permiso por su cuenta cuando aplica
  // (ej. bloquear escrituras del rol admin); aquí solo se filtran las
  // PÁGINAS según los módulos permitidos.
  if (isApi) {
    return response;
  }

  const profile = await fetchProfile(user.id);
  if (!profile || !profile.active) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const isSuperAdmin = profile.role === "superadmin";

  if (request.nextUrl.pathname === "/usuarios" || request.nextUrl.pathname.startsWith("/usuarios/")) {
    if (!isSuperAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/sin-acceso";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const moduleKey = moduleKeyForPath(request.nextUrl.pathname);
  if (moduleKey && !isSuperAdmin && !(profile.module_permissions ?? []).includes(moduleKey)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sin-acceso";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
