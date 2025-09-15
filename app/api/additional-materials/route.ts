import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const authToken = request.headers.get("Authorization")
    if (!authToken) {
      return NextResponse.json({ error: "Authorization token required" }, { status: 401 })
    }

    const payload = await request.json()
    console.log("Additional materials payload:", JSON.stringify(payload, null, 2))

    const response = await fetch(
      "https://beta-apis-indenting.transporteg.com/indent/api/0.2/update/wms/additional/material",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: authToken,
        },
        body: JSON.stringify(payload),
      },
    )

    console.log("Additional materials API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Additional materials API error:", errorText)
      return NextResponse.json(
        { error: "Failed to save additional materials", details: errorText },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("Additional materials API success:", data)

    return NextResponse.json(data)
  } catch (error) {
    console.error(" Additional materials API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
