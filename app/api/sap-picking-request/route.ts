import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const pickingPayload = await request.json();
    const { vepToken, selectedItems } = pickingPayload;

    // Validate the incoming payload from the frontend.
    if (!vepToken || !selectedItems || selectedItems.length === 0) {
      console.error('Validation failed: Missing vepToken or selectedItems.');
      return NextResponse.json({ message: "vepToken and selectedItems are required and must not be empty" }, { status: 400 });
    }

    const sapUrl = "https://eprs4ascs.emamiagrotech.com:4443/sap/opu/odata/SAP/ZWH_BATCH_UPDATE_SRV/TokenDetailsSet";
    const username = process.env.SAP_USERNAME || "WMS_BGUSER";
    const password = process.env.SAP_PASSWORD || "Welcome@123456";
    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

    // Step 1: Get CSRF token and cookies
    const csrfResponse = await fetch(sapUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "X-CSRF-Token": "Fetch",
        Accept: "application/json",
      },
    });

    const csrfToken = csrfResponse.headers.get("X-CSRF-Token");
    
    // Use getSetCookie() to retrieve all cookies as an array
    const setCookieHeaders = csrfResponse.headers.getSetCookie();

    if (!csrfToken) {
      console.error('Failed to obtain CSRF token from SAP.');
      throw new Error("Failed to obtain CSRF token");
    }

    // Format the cookies into a single string for the 'Cookie' header
    const cookies = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');

    // Prepare the payload for the SAP POST request with correct keys
    const sapPayload = {
      tokenno: vepToken,
      getloadingsequence: {
        results: selectedItems,
      },
    };
console.log('SAP Payload:', JSON.stringify(sapPayload, null, 2)); // Log the payload for debugging
    // Step 2: Send picking request
    const response = await fetch(sapUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "X-CSRF-Token": csrfToken,
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookies || "", // Ensure the formatted cookies are passed here
      },
      body: JSON.stringify(sapPayload),
    });

    // Check if the response is OK before trying to parse as JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SAP POST request failed with status:', response.status, 'Body:', errorText);
      return NextResponse.json({ error: `SAP request failed with status ${response.status}: ${errorText}` }, { status: response.status });
    }

    // Safely parse the JSON response now that we know it's ok
    const result = await response.json();
console.log('SAP Response:', JSON.stringify(result, null, 2)); // Log the SAP response for debugging
    // Try to extract SAP message and rescode
    const sapMessage = result?.d?.message || result?.d?.Message || result?.message || "Picking request sent successfully.";
    const sapRescode = result?.d?.rescode || "";
console.log('Extracted SAP Message:', sapMessage, 'Rescode:', sapRescode); // Log extracted message and rescode
    return NextResponse.json({ success: true, message: sapMessage, rescode: sapRescode, result });
  } catch (error) {
    console.error('API route failed with an exception:', error);
    return NextResponse.json({ error: "Failed to send picking request", details: (error as Error).message }, { status: 500 });
  }
}
