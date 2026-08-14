import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase para Server Components / Route Handlers que lee y
// escribe la sesión desde las cookies de la petición (a diferencia de
// supabaseServer(), que usa la service role sin sesión de usuario).
export async function supabaseServerAuth() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Se puede llamar desde un Server Component, donde no se pueden
          // escribir cookies; el middleware ya se encarga de refrescarlas.
        }
      },
    },
  });
}
