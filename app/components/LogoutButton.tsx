"use client";

import { logOut } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logOut();
    router.push("/login");
  }

  return <button onClick={handleLogout}>Logout</button>;
}
