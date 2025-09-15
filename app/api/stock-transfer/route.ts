import { NextResponse } from 'next/server';

// IMPORTANT: Store these values in environment variables in a real application
const SAP_URL = process.env.SAP_ODATA_URL || 'https://eqas4app.emamiagrotech.com:4443/sap/opu/odata/sap/ZSTOCK_MOVE_SRV/StockHeadSet';
const SAP_USERNAME = process.env.SAP_USERNAME || 'VERTIF_01';
const SAP_PASSWORD = process.env.SAP_PASSWORD || "EmamiWM@Qas24";
const SAP_CLIENT = process.env.SAP_CLIENT || '300';
const SAP_PICKING_URL = process.env.SAP_PICKING_URL || 'https://your-sap-picking-service.com/odata/PickingSet';

export async function POST(request: Request) {
  const body = await request.json();

  try {
    // Step 1: Fetch CSRF token and cookies from SAP
    const headResponse = await fetch(`${SAP_URL}`, {
      method: 'HEAD',
      headers: {
        'Authorization': 'Basic ' + btoa(`${SAP_USERNAME}:${SAP_PASSWORD}`),
        'x-csrf-token': 'fetch',
        'accept': 'application/json',
        'sap-client': SAP_CLIENT,
      },
    });

    if (!headResponse.ok) {
      const errorDetails = await headResponse.text();
      return NextResponse.json(
        { status: 'error', message: 'Failed to fetch CSRF token', details: errorDetails },
        { status: headResponse.status }
      );
    }

    const csrfToken = headResponse.headers.get('x-csrf-token');
    const allCookies = headResponse.headers.getSetCookie();

    if (!csrfToken || allCookies.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'CSRF token or cookies not found in response' },
        { status: 500 }
      );
    }

    const { doNo, items } = body;
    
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid request body: "items" must be a valid array.' },
        { status: 400 }
      );
    }

    // Prepare the payload for the SAP OData service
    const payload = {
      Dono: doNo,
      OrderToItem: items.map((item: any) => ({
        Posnr: item.posnr,
        Matnr: item.material,
        Batch: item.actualBatch,
        Quantity: (item.actualQuantity)?.toString(),
        Uom: item.uom,
        StorageType: item.storageType,
        Storage: item.storage,
        ToStorage: item.destSloc,
        VepToken: item.vepToken || '',
        DocCata:item.docCata,
        UECHA: item.uecha || '',
      })),
    };
console.log('Stock Move Payload:', JSON.stringify(payload, null, 2));
    // Step 2: Make the actual POST request with the token and cookies
    const stockMoveResponse = await fetch(`${SAP_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${SAP_USERNAME}:${SAP_PASSWORD}`),
        'x-csrf-token': csrfToken,
        'sap-client': SAP_CLIENT,
        'accept': 'application/json',
        'Cookie': allCookies.join('; '),
      },
      body: JSON.stringify(payload),
    });

    const responseText = await stockMoveResponse.text();
    console.log('SAP Stock Move Response Text:', responseText);

    if (!stockMoveResponse.ok) {
      let errorMessage = `SAP stock transfer failed with HTTP status: ${stockMoveResponse.status}`;
      try {
        const errorResult = JSON.parse(responseText);
        errorMessage = errorResult.error?.message?.value || errorMessage;
      } catch (parseError) {
        const xmlMatch = responseText.match(/<message[^>]*>([^<]+)<\/message>/);
        if (xmlMatch && xmlMatch[1]) {
          errorMessage = xmlMatch[1];
        }
      }
      return NextResponse.json(
        { status: 'error', message: errorMessage, details: responseText },
        { status: stockMoveResponse.status }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
  
      const firstItem = result.d?.OrderToItem?.results[0];
      const rawMessage = firstItem?.Message;
      
      if (rawMessage?.includes("Transfer posting Completed")) {
        // ---- UPDATED LOGIC: Use the successful response to build the picking payload ----
        
        // This is where we create the new payload for the "picking" process.
        // We are using data from the successful stock move response (parsed into the 'result' object).
        const pickingPayload = {
          tokenno: result.d?.OrderToItem?.results[0].VepToken,
          getloadingsequence: {
            results: result.d?.OrderToItem?.results.map((sapItem: any) => ({
              tokenno: sapItem.VepToken, // Using Dono from the main response
              obd_no: result.d.Dono, // Using Dono as a placeholder for obd_no
              posnr: sapItem.Posnr,
              matnr: sapItem.Matnr,
              charg: sapItem.Batch,
              sequenceno: sapItem.Sequenceno || '01', // Using the Sequenceno from the SAP item or a default
              maktx: sapItem.Matnr || '', // Using Matnr as a placeholder for maktx
              pstyv: sapItem.DocCata, // Hardcoded value as per your example
              speLoekz: false,
              werks:'M251', // Using Warehouse as a placeholder
              lgort: sapItem.destSloc,
              lgnum: sapItem.Warehouse,
              lgtyp: sapItem.StorageType,
              docknum: '', // Empty string as per your example
              lgpla: sapItem.Bin || '', // Using Bin as a placeholder
              lfimg: sapItem.Quantity,
              meins: sapItem.Uom,
              bolnr: '', // Empty string as per your example
              tanum: '', // Empty string as per your example
              oldcharg: sapItem.OldBatch,
              vtweg: '', // Empty string as per your example
              uecha: sapItem.UECHA || '' // Using Uecha from the SAP item if available
            }))
          }
        };
        
        // Log the newly created picking payload as requested
        console.log('Picking Payload Generated:', JSON.stringify(pickingPayload, null, 2));

        // On success, return the newly created picking payload for the next step
        return NextResponse.json({
          status: 'success',
          message: rawMessage,
          data: {
            pickingPayload: pickingPayload,
            sapResponse: result
          }
        }, { status: 200 });
      } else if (rawMessage?.includes("Already Transfer posting Completed")) {
        return NextResponse.json({
          status: 'warning',
          message: rawMessage,
          data: { items: items }
        }, { status: 200 });
      } else {
        return NextResponse.json({
          status: 'error',
          message: rawMessage || "An unknown error occurred.",
          data: result
        }, { status: 400 });
      }
      
    } catch (parseError) {
      console.error('Failed to parse response JSON:', parseError);
      return NextResponse.json(
        { status: 'error', message: 'Failed to parse response JSON', details: responseText },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in stock transfer API route:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
