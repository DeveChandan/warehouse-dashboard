"use client"
import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Loader2,
  ArrowRight,
  XCircle,
  Truck,
} from "lucide-react"
import { v4 as uuidv4 } from "uuid"

// --- Type Definitions ---
interface ODBItem {
  id: string;
  sNo: number;
  vepToken: string;
  doNo: string;
  wmsPicking: string;
  pickingStatus: string;
  pgiStatus: string;
  posnr: string;
  material: string;
  materialDes: string;
  qty: number;
  batch: string;
  uom: string;
  bin: string;
  storageType: string;
  destSloc: string;
  warehouse: string;
  storage: string;
  plant: string;
  dock: string;
  net: number;
  gross: number;
  truck: string;
  toNo: string;
  sequenceNo: string;
  channel: string;
  uecha: string;
  docCata?: string;
  actualBatch: string;
  actualQuantity: number;
  isNew: boolean;
  status: 'pending' | 'loading' | 'transferred' | 'picked' | 'completed' | 'error';
  errorMessage?: string;
  // New fields for original values
  originalQuantity: number;
  originalBatch: string;
}

interface ODBGroup {
  doNo: string;
  items: ODBItem[];
  status: 'pending' | 'loading' | 'transferred' | 'picked' | 'completed' | 'error';
  isEditing: boolean;
  validation: {
    status: 'success' | 'warning' | 'error' | null;
    message: string | null;
  };
}

interface LoadingProps {
  onLoadingComplete: (groups: ODBGroup[]) => void;
}

const Loading: React.FC<LoadingProps> = ({ onLoadingComplete }) => {
  const [vepToken, setVepToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVepTokenData = async () => {
    if (!vepToken.trim()) {
      setError("Please enter a VEP Token.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sap-picking?token=${encodeURIComponent(vepToken)}`);
      
      if (!response.ok) {
        // Attempt to parse a specific error message from the API response
        let errorMessage = "Failed to fetch VEP Token data. Please try again.";
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          // If JSON parsing fails, use the default message
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      const sapDataArray = Array.isArray(data.formattedData) ? data.formattedData : Array.isArray(data) ? data : [data];
      const groupedData: Record<string, ODBItem[]> = {};

      if (sapDataArray.length === 0) {
        throw new Error("No data found for the provided VEP Token.");
      }

      sapDataArray.forEach((item: any, index: number) => {
        const doNo = item.DONo || item.obd_no || item.DeliveryOrder || item.OBD || item.VBELN || `DO-${index + 1}`;
        if (!groupedData[doNo]) {
          groupedData[doNo] = [];
        }

        const initialQty = Number.parseFloat(item.Qty || "0");
        const initialBatch = item.Batch || `BATCH-${index + 1}`;
        
        // Determine the initial status based on pickingStatus
        const initialStatus = item.PickingStatus?.toUpperCase() === "C" ? "completed" : "pending";

        groupedData[doNo].push({
          id: uuidv4(),
          sNo: item.SNo || index + 1,
          vepToken: item.VEPToken || vepToken,
          doNo,
          wmsPicking: item.WMSPicking || "N/A",
          pickingStatus: item.PickingStatus || "N/A",
          pgiStatus: item.PGIStatus || "N/A",
          posnr: item.Posnr || `${index + 1}0`,
          material: item.Material || `MAT-${index + 1}`,
          materialDes: item.MaterialDes || "Material Description",
          qty: initialQty,
          batch: initialBatch,
          uom: item.UOM || "KG",
          bin: item.Bin || "BIN-001",
          storageType: "EDO", // Default value
          destSloc: "ZF05", // Default value
          warehouse: item.Warehouse || "WH-001",
          storage: item.Storage || "SL-001",
          plant: item.Plant || "P001",
          dock: item.Dock || "DOCK-1",
          docCata: item.DocCata,
          net: Number.parseFloat(item.Net || "0"),
          gross: Number.parseFloat(item.Gross || "0"),
          truck: item.Truck || "TRUCK-001",
          toNo: item.ToNo || "TO-001",
          sequenceNo: item.SequenceNo || `${index + 1}`,
          channel: item.Channel || "01",
          uecha: item.Uecha || "",
          actualBatch: initialBatch,
          actualQuantity: initialQty,
          isNew: false,
          status: initialStatus,
          originalQuantity: initialQty,
          originalBatch: initialBatch,
        } as ODBItem);
      });
      
      const odbGroups: ODBGroup[] = Object.entries(groupedData).map(([doNo, items]) => {
        // Check if all items in the group are completed
        const isGroupCompleted = items.every(item => item.status === "completed");
        return {
          doNo,
          items,
          status: isGroupCompleted ? "completed" : "pending",
          isEditing: false,
          validation: { status: null, message: null },
        };
      });

      onLoadingComplete(odbGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Trigger data fetching when the Enter key is pressed and a token is entered
    if (event.key === 'Enter' && vepToken.trim() && !isLoading) {
      fetchVepTokenData();
    }
  };

  return (
    <Card className="shadow-lg border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl text-primary">
          <Truck className="h-6 w-6" />
          Enter VEP Token
        </CardTitle>
        <CardDescription>Enter the VEP Token to fetch Outbound Delivery details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vepToken" className="font-semibold">VEP Token Number</Label>
          <Input
            id="vepToken"
            value={vepToken}
            onChange={(e) => setVepToken(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., VEP12345"
            className="max-w-md text-lg"
          />
        </div>
        <Button
          onClick={fetchVepTokenData}
          disabled={isLoading || !vepToken.trim()}
          size="lg"
          className="w-full max-w-md bg-primary hover:bg-primary/90"
        >
          {isLoading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Fetching Data...</>
          ) : (
            <><ArrowRight className="mr-2 h-5 w-5" /> Fetch ODB Details</>
          )}
        </Button>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default Loading;
