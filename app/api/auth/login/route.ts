import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import argon2 from "argon2"

export async function POST(request: Request) {
  try {
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase environment variables")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Create Supabase client
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { email, password } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Query user from database
    const { data, error } = await supabase.from("users").select("id, email, password_hash").eq("email", email).single()

    if (error || !data) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Verify password
    if (!data.password_hash || !data.password_hash.startsWith("$")) {
      console.error("Invalid password hash format:", data.password_hash)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    try {
      const valid = await argon2.verify(data.password_hash, password)
      if (!valid) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      }
    } catch (verifyError) {
      console.error("Password verification error:", verifyError)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Create session cookie
    const sessionData = { userId: data.id, email: data.email }
    const response = NextResponse.json({ user: { id: data.id, email: data.email } })

    // Set session cookie
    response.cookies.set("session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Login route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
