"use client";

import { useEffect, useState } from "react";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: "superadmin" | "admin";
  module_permissions: string[];
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setUser(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, isSuperAdmin: user?.role === "superadmin" };
}
