"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VolunteerRegisterRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/staff");
  }, [router]);
  return null;
}
