import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 })
  }

  try {
    console.log("[v0] Fetching SAP picking data for token:", token)

    // SAP OData URL with expansion
    const sapUrl = `https://eqas4app.emamiagrotech.com:4443/sap/opu/odata/SAP/ZWH_BATCH_UPDATE_SRV/TokenDetailsSet(tokenno='${token}')?$expand=getloadingsequence`

    // Basic auth credentials (you should use environment variables)
    const username = process.env.SAP_USERNAME || "VERTIF_01"
    const password = process.env.SAP_PASSWORD || "EmamiWM@Qas24"
    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64")

    const response = await fetch(sapUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error("[v0] SAP API Error:", response.status, response.statusText)

      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        message: `SAP API Error: ${response.status} ${response.statusText}`,
        sapError: null as any,
        details: null as string | null,
      }

      try {
        const responseText = await response.text()
        console.error("[v0] SAP API Error Response:", responseText)

        // Try to parse as JSON first (SAP often returns detailed JSON errors)
        try {
          const errorJson = JSON.parse(responseText)

          // Extract SAP-specific error details
          if (errorJson.error) {
            errorDetails.sapError = errorJson.error

            // Build user-friendly error message from SAP error structure
            let sapMessage = ""
            if (errorJson.error.message?.value) {
              sapMessage = errorJson.error.message.value
            } else if (errorJson.error.message) {
              sapMessage = errorJson.error.message
            }

            errorDetails.message = `SAP Error (${errorJson.error.code || "Unknown"}): ${sapMessage}`
            errorDetails.details = `Transaction ID: ${errorJson.error.innererror?.transactionid || "N/A"}`
          }
        } catch (jsonParseError) {
          // If not JSON, handle as text
          if (
            responseText.includes("Invalid") ||
            responseText.includes("Error") ||
            responseText.includes("Unauthorized")
          ) {
            errorDetails.message = `SAP API Error: ${responseText.substring(0, 200)}...`
            errorDetails.details = responseText.length > 200 ? "..." : null
          }
        }
      } catch (textError) {
        console.error("[v0] Could not read error response text:", textError)
      }

      return NextResponse.json(
        {
          error: errorDetails.message,
          sapError: errorDetails.sapError,
          details: errorDetails.details,
          status: errorDetails.status,
        },
        { status: response.status },
      )
    }

    const contentType = response.headers.get("content-type")
    console.log("[v0] Response content type:", contentType)

    let data
    try {
      if (contentType && contentType.includes("application/json")) {
        data = await response.json()
      } else {
        // Handle non-JSON responses
        const responseText = await response.text()
        console.error("[v0] Non-JSON response received:", responseText.substring(0, 500))

        return NextResponse.json(
          {
            error: "SAP API returned non-JSON response",
            details: `Expected JSON but received: ${contentType || "unknown content type"}`,
            responsePreview: responseText.substring(0, 200),
          },
          { status: 502 },
        )
      }
    } catch (parseError) {
      console.error("[v0] JSON parsing error:", parseError)
      const responseText = await response.text()
      return NextResponse.json(
        {
          error: "Failed to parse SAP API response",
          details: (parseError as Error).message,
          responsePreview: responseText.substring(0, 200),
        },
        { status: 502 },
      )
    }

    console.log("[v0] SAP response received, processing data...")

    // Extract sequence results
    const sequenceResults = data.d?.getloadingsequence?.results || []
    const dock = data.d || {}

    // Format data according to the provided structure
    const formattedData = sequenceResults.map((item: any, index: number) => ({
      SNo: index + 1,
      VEPToken: dock.TokenNo || token,
      DONo: item.obd_no || "N/A",
      WMSPicking: item.LVSTK || "N/A",
      PickingStatus: item.KOSTK || "N/A",
      PGIStatus: item.WBSTK || "N/A",
      Posnr: item.posnr || "N/A",
      Material: item.matnr || "N/A",
      MaterialDes: item.maktx || "N/A",
      Qty: item.lfimg || "N/A",
      Batch: item.oldcharg || "N/A",
      BatchOld: item.oldcharg || "N/A",
      UOM: item.meins || "N/A",
      Bin: item.lgpla || "N/A",
      StorageType: item.lgtyp || "",
      Warehouse: item.lgnum || "N/A",
      Storage: item.lgort || "N/A",
      Plant: item.werks || "N/A",
      Dock: item.docknum || "N/A",
      DocCata: item.pstyv || "N/A",
      Ind: item.speLoekz || "N/A",
      Net: item.ntgew || "N/A",
      Gross: item.brgew || "N/A",
      Truck: item.bolnr || "N/A",
      ToNo: item.tanum || "N/A",
      SequenceNo: item.sequenceno || "N/A",
      Channel: item.vtweg || "N/A",
      Uecha: item.uecha || "N/A",
    }))

    console.log("[v0] Formatted", formattedData.length, "picking records")
console.log(" Sample record:", formattedData || "No records")
    return NextResponse.json({
      success: true,
      formattedData,
      rawData: data.d,
    })
  } catch (error) {
    console.error("[v0] Error fetching SAP picking data:", error)
    return NextResponse.json(
      { error: "Failed to fetch SAP picking data", details: (error as Error).message },
      { status: 500 },
    )
  }
}
