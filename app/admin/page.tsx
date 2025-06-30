import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AdminDashboard } from "@/components/admin-dashboard"

export default async function AdminPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("session")
  if (!sessionCookie) {
    // no session → force sign‐in
    return redirect("/login")
  }

  // parse the JSON you stored in login route
  const { userId } = JSON.parse(sessionCookie.value)

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage the AI assistant knowledge base and settings
        </p>
      </div>
      <AdminDashboard userId={userId} />
    </div>
  )
}