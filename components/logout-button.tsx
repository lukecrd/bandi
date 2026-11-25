"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return <button onClick={logout}><LogOut size={17} strokeWidth={1.75} aria-hidden="true" />Esci</button>;
}
