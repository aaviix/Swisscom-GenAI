import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AgentDashboard } from "@/components/admin/agent-dashboard"

export default function AgentPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get("session")
  if (!sessionCookie) {
    return redirect("/login")
  }
  const { userId } = JSON.parse(sessionCookie.value)

  return <AgentDashboard userId={userId} />
}