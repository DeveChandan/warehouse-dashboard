import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const vepToken = searchParams.get("vepToken")
    const obd = searchParams.get("obd")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "100")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    console.log("[v0] Fetching logs data from records endpoint with filters:", {
      vepToken,
      obd,
      page,
      limit,
      startDate,
      endDate,
    })

    const response = await fetch("http://10.255.20.7:4000/records/toGeneratedLogs", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("[v0] Logs API Error:", response.status, response.statusText)
      return NextResponse.json(
        { error: `Logs API Error: ${response.status} ${response.statusText}` },
        { status: response.status },
      )
    }

    const allData = await response.json()
    console.log("[v0] Raw logs data received, total count:", allData?.length || 0)

    let filteredData = allData || []

    if (vepToken) {
      filteredData = filteredData.filter(
        (record: any) =>
          record.vepToken?.toLowerCase().includes(vepToken.toLowerCase()) ||
          record.VEPToken?.toLowerCase().includes(vepToken.toLowerCase()),
      )
    }

    if (obd) {
      filteredData = filteredData.filter(
        (record: any) =>
          record.obd?.toLowerCase().includes(obd.toLowerCase()) ||
          record.OBD?.toLowerCase().includes(obd.toLowerCase()) ||
          record.deliveryOrder?.toLowerCase().includes(obd.toLowerCase()),
      )
    }

    if (startDate) {
      const start = new Date(startDate)
      filteredData = filteredData.filter((record: any) => {
        const recordDate = new Date(record.createdAt || record.timestamp || record.date)
        return recordDate >= start
      })
    }

    if (endDate) {
      const end = new Date(endDate)
      filteredData = filteredData.filter((record: any) => {
        const recordDate = new Date(record.createdAt || record.timestamp || record.date)
        return recordDate <= end
      })
    }

    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedData = filteredData.slice(startIndex, endIndex)

    console.log("[v0] Filtered and paginated logs data:", {
      totalRecords: allData?.length || 0,
      filteredRecords: filteredData.length,
      returnedRecords: paginatedData.length,
      page,
      limit,
    })

    return NextResponse.json(
      {
        success: true,
        records: paginatedData,
        pagination: {
          page,
          limit,
          total: filteredData.length,
          totalPages: Math.ceil(filteredData.length / limit),
          hasNext: endIndex < filteredData.length,
          hasPrev: page > 1,
        },
        filters: {
          vepToken,
          obd,
          startDate,
          endDate,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      },
    )
  } catch (error) {
    console.error("[v0] Error fetching logs data:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch logs data",
        details: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
