import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token parameter" }, { status: 400 });
  }

  const sapUrl = `https://eqas4app.emamiagrotech.com:4443/sap/opu/odata/SAP/ZWH_BATCH_UPDATE_SRV/LoadedDetailsSet?$filter=tokenno eq '${token}'`;

  // SAP credentials (should be stored securely in env variables for production)
  const SAP_USERNAME = 'VERTIF_01';
  const SAP_PASSWORD = 'EmamiWM@Qas24';
  const SAP_CLIENT = '300';
  const basicAuth = Buffer.from(`${SAP_USERNAME}:${SAP_PASSWORD}`).toString('base64');

  try {
    const response = await fetch(sapUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Basic ${basicAuth}`,
        "sap-client": SAP_CLIENT,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch from SAP" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Proxy error", details: String(error) }, { status: 500 });
  }
}
