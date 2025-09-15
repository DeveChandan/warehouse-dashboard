import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const authToken = request.headers.get("authorization")
    console.log("TEG Update Request Body:", body)
    console.log("TEG Update Auth Token:", authToken)

    if (!authToken) {
      return NextResponse.json({ error: "Authorization token is required" }, { status: 401 })
    }

  //  const updateUrl = "https://tms-api-indenting.transporteg.com/indent/api/0.1/update/wms/picking/data"
const updateUrl = "https://beta-apis-indenting.transporteg.com/indent/api/0.1/update/wms/picking/data";
    const response = await fetch(updateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: authToken,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let errorMessage = "Failed to update TEG data";
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      console.error(`TEG Update API Error (${response.status}):`, errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("TEG update proxy error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
