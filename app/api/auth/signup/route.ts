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

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { email, password } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Database check error:", checkError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 })
    }

    // Hash password with argon2
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    })

    // Insert new user
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          email,
          password_hash: passwordHash,
          created_at: new Date().toISOString(),
        },
      ])
      .select("id, email")
      .single()

    if (error) {
      console.error("Signup error:", error)

      // Handle specific database errors
      if (error.code === "23505") {
        // Unique constraint violation
        return NextResponse.json({ error: "User already exists" }, { status: 400 })
      }

      if (error.code === "42P01") {
        // Table doesn't exist
        return NextResponse.json({ error: "Database not properly configured" }, { status: 500 })
      }

      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    return NextResponse.json({
      message: "User created successfully",
      user: { id: data.id, email: data.email },
    })
  } catch (error) {
    console.error("Signup route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
