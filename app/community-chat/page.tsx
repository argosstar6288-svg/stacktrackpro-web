import { redirect } from "next/navigation";

export default function CommunityChatAliasPage() {
  redirect("/dashboard/inbox?tab=groups");
}
