import { NextResponse } from "next/server"

//const TEG_USERNAME = "WmsIntegrationOperatorProd"
//const TEG_PASSWORD = "ProdOperator@2025"
const TEG_USERNAME = "WmsIntegrationOperator"
const TEG_PASSWORD = "Operator@2025"

export async function POST() {
  try {
    console.log(" TEG Auth: Starting authentication request")
    //const authUrl = "https://teg-api-admin.transporteg.com/api/0.1/fetch/master/token"
    const authUrl = "https://beta-api-admin.transporteg.com/api/0.1/fetch/master/token"
    const authPayload = {
      username: TEG_USERNAME,
      password: TEG_PASSWORD,
    }

    console.log(" TEG Auth: Making request to", authUrl)
    const response = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authPayload),
    })

    console.log("[v0] TEG Auth: Response status", response.status)
    console.log("[v0] TEG Auth: Response headers", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`TEG Auth API Error (${response.status}):`, errorText)
      return NextResponse.json({ error: "Failed to authenticate with TEG" }, { status: response.status })
    }

    const data = await response.json()
    console.log(" TEG Auth: Full response data:", JSON.stringify(data, null, 2))
    console.log(" TEG Auth: Response data type:", typeof data)
    console.log(" TEG Auth: Response data keys:", Object.keys(data || {}))

    let token = null

    if (data) {
      // Try different possible token field names
      token =
        data.token ||
        data.access_token ||
        data.authToken ||
        data.auth_token ||
        data.Token ||
        data.AccessToken ||
        data.AuthToken ||
        data.jwt ||
        data.JWT

      // If data itself is a string token
      if (!token && typeof data === "string" && data.length > 10) {
        token = data
      }

      // Check if token is nested in a data field
      if (!token && data.data) {
        token = data.data.token || data.data.access_token || data.data.authToken
      }

      // Check if token is in result field
      if (!token && data.result) {
        token = data.result.token || data.result.access_token || data.result.authToken
      }
    }

    console.log("[v0] TEG Auth: Extracted token:", token ? `${token.substring(0, 20)}...` : "null")

    if (token) {
      return NextResponse.json({ token })
    } else {
      console.error("TEG Auth: No token found in any expected field")
      console.error("TEG Auth: Available fields:", Object.keys(data || {}))
      return NextResponse.json(
        {
          error: "No token received from TEG API",
          debug: {
            responseKeys: Object.keys(data || {}),
            responseType: typeof data,
            hasData: !!data,
          },
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("TEG auth proxy error:", error)
    return NextResponse.json({ error: "Internal server error", }, { status: 500 })
  }
}
