"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { ACTIVITY_PING_MS, ACTIVITY_STORAGE_KEY, INACTIVITY_MS } from "@/lib/inactivity";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "wheel", "touchstart", "click"] as const;

// Una sola vez por carga completa de la página (recargar o reabrir la
// pestaña), no en cada cambio de ruta dentro de la app.
let resumeChecked = false;

function readStoredActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function storeActivity(ts: number) {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(ts));
  } catch {
    // sin localStorage: queda solo el control del servidor
  }
}

function clearStoredActivity() {
  try {
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    // nada que limpiar
  }
}

// Cierra la sesión sin avisar ni pedir confirmación. Antes deja constancia
// en el historial de conexiones (si falla, igual se cierra).
async function closeSession() {
  try {
    await fetch("/api/auth/record-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "timeout" }),
    });
  } catch {
    // se cierra igual
  }
  try {
    await supabaseBrowser().auth.signOut();
  } catch {
    // la cookie de sesión se limpia al cargar el login
  }
  clearStoredActivity();
  window.location.href = "/login";
}

// Vigila la actividad del usuario y:
//  - Admin: cierra la sesión tras 30 minutos sin actividad.
//  - Todos: deja constancia en el historial de conexiones cuando alguien
//    vuelve a la app con la sesión ya abierta (recargó o reabrió la pestaña).
export default function InactivityGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") {
      // Un ingreso nuevo siempre empieza de cero.
      clearStoredActivity();
      return;
    }

    let cancelled = false;
    let stop: (() => void) | undefined;

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || json.error) return;

        if (!resumeChecked) {
          resumeChecked = true;
          fetch("/api/auth/record-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "resume" }),
          }).catch(() => {});
        }

        if (json.data.role === "superadmin") return;

        // Si la última actividad guardada ya está vencida (la pestaña quedó
        // abierta o el equipo estuvo dormido), se cierra de una vez.
        const stored = readStoredActivity();
        if (stored && Date.now() - stored >= INACTIVITY_MS) {
          closeSession();
          return;
        }
        if (!stored) storeActivity(Date.now());

        let lastPing = Date.now();
        let closing = false;

        const check = () => {
          if (closing) return;
          const last = readStoredActivity();
          if (last && Date.now() - last >= INACTIVITY_MS) {
            closing = true;
            closeSession();
          }
        };

        const onActivity = () => {
          const now = Date.now();
          if (now - readStoredActivity() < 1000) return;
          storeActivity(now);
          if (now - lastPing >= ACTIVITY_PING_MS) {
            lastPing = now;
            fetch("/api/auth/activity", { method: "POST" })
              .then((res) => {
                if (res.status === 401 && !closing) {
                  closing = true;
                  closeSession();
                }
              })
              .catch(() => {});
          }
        };

        const onVisible = () => {
          if (document.visibilityState === "visible") check();
        };

        ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
        window.addEventListener("focus", check);
        document.addEventListener("visibilitychange", onVisible);
        const timer = window.setInterval(check, 30 * 1000);

        stop = () => {
          ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
          window.removeEventListener("focus", check);
          document.removeEventListener("visibilitychange", onVisible);
          window.clearInterval(timer);
        };
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [pathname]);

  return null;
}
