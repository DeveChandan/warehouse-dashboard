import { NextResponse } from "next/server";

// Centralize SAP configuration for easier maintenance and security
const sapConfig = {
    url: "https://eqas4app.emamiagrotech.com:4443/sap/opu/odata/SAP/ZWH_BATCH_UPDATE_SRV/TokenDetailsSet",
    username: process.env.SAP_USERNAME || "VERTIF_01",
    password: process.env.SAP_PASSWORD || "EmamiWM@Qas24",
};

/**
 * Handles the SAP picking status update request.
 * @param {Request} request The incoming request object.
 * @returns {NextResponse} The JSON response.
 */
export async function POST(request: Request) {
    try {
        const pickingPayload = await request.json();

        // Helper function to handle authenticated fetches to SAP
        const sapFetch = async (options: {
            method: string;
            headers: Record<string, string>;
            body?: BodyInit;
        }) => {
            const authHeader = `Basic ${Buffer.from(`${sapConfig.username}:${sapConfig.password}`).toString("base64")}`;
            const headers = {
                ...options.headers,
                Authorization: authHeader,
                Accept: "application/json",
            };

            const response = await fetch(sapConfig.url, {
                method: options.method,
                headers: headers,
                body: options.body,
            });

            if (!response.ok) {
                const errorText = await response.text();
                // Throw an error with the SAP status and response text for better debugging
                throw new Error(`SAP request failed with status ${response.status}: ${errorText}`);
            }

            return response;
        };

        // Step 1: Get CSRF token and cookies from SAP
        const csrfResponse = await sapFetch({
            method: "GET",
            headers: { "X-CSRF-Token": "Fetch" },
        });

        const csrfToken = csrfResponse.headers.get("X-CSRF-Token");
        const setCookieHeaders = csrfResponse.headers.getSetCookie();

        if (!csrfToken) {
            throw new Error("Failed to obtain CSRF token from SAP.");
        }
        const cookies = setCookieHeaders.map(cookie => cookie.split(';')[0]).join('; ');

        // Step 2: Send the picking request with the obtained token and cookies
        console.log('SAP Payload:', JSON.stringify(pickingPayload, null, 2));
        const sapPostResponse = await sapFetch({
            method: "POST",
            headers: {
                "X-CSRF-Token": csrfToken,
                "Content-Type": "application/json",
                Cookie: cookies,
            },
            body: JSON.stringify(pickingPayload),
        });

        const result = await sapPostResponse.json();
        const sapMessage = result?.d?.message || result?.d?.Message || result?.message || "Picking request sent successfully.";
        const sapRescode = result?.d?.rescode || "";

        console.log('SAP Response:', JSON.stringify(result, null, 2));
        console.log('SAP Message:', sapMessage, 'Rescode:', sapRescode);

        // Return a consistent success response
        return NextResponse.json({
            success: true,
            message: sapMessage,
            rescode: sapRescode,
            result,
        });
    } catch (error) {
        // Centralized error handling to provide detailed feedback
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("SAP API Error:", errorMessage);

        return NextResponse.json(
            { success: false, error: "Failed to send picking request", details: errorMessage },
            { status: 500 }
        );
    }
}
