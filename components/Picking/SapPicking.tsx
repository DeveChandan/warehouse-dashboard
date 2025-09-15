"use client"
import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

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
  pickingPayload?: any;
  sapResponse?: any;
}

interface SapPickingProps {
  odbGroups: ODBGroup[];
  onComplete: () => void;
}

const SapPicking: React.FC<SapPickingProps> = ({ odbGroups, onComplete }) => {
  const [pickingState, setPickingState] = useState(odbGroups);
  const [sapResponses, setSapResponses] = useState<Record<string, any>>({});
  const [showRawResponse, setShowRawResponse] = useState<Record<string, boolean>>({});

  const toggleRawResponse = (doNo: string) => {
    setShowRawResponse(prev => ({ ...prev, [doNo]: !prev[doNo] }));
  };

  const allGroupsAreFinalized = useMemo(() => {
    return pickingState.length > 0 && pickingState.every((group) => group.status === "picked" || group.status === "completed");
  }, [pickingState]);

  const initiatePicking = async (doNo: string, pickingPayload: any): Promise<void> => {
    // set loading
    setPickingState(prev =>
      prev.map(g => (g.doNo === doNo ? { ...g, status: "loading" } : g))
    );

    try {
      const response = await fetch("/api/sap-picking-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pickingPayload),
      });

      // Try to parse JSON, but fall back to raw text if parse fails
      const rawText = await response.text();
      let data: any;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseErr) {
        data = { __raw: rawText };
      }

      // helpful debugging logs (remove or lower verbosity in production)
      console.log("Picking API response (doNo):", doNo, {
        status: response.status,
        ok: response.ok,
        rawText,
        parsed: data,
      });

      // keep full response mapping for later inspection
      setSapResponses(prev => ({ ...prev, [doNo]: data }));

      // determine newStatus robustly
      let newStatus: ODBGroup["status"] = "error";

      // normalize rescode (may be under data.rescode or data.d.rescode)
      const rescode = (data?.rescode ?? data?.d?.rescode ?? "").toString().trim().toLowerCase();

      // normalize message (may be under data.message or data.d.message)
      const messageRaw = (data?.message ?? data?.d?.message ?? data?.__raw ?? "").toString();
      const message = messageRaw.trim().toLowerCase();

      // Rule: success if rescode is 's' or 'c'
      if (rescode === "s" || rescode === "c") {
        newStatus = "picked";
      }

      // Rule: success if message contains a success indicator
      // check a few likely phrases — be tolerant to spacing/casing
      const successPhrases = [
        "DO already has an existing TO",
        "already has an existing to",
        "do already has",
        "success",
        "picked",
        "already exists",
      ];

      if (newStatus !== "picked") {
        for (const phrase of successPhrases) {
          if (phrase && message.includes(phrase)) {
            newStatus = "picked";
            break;
          }
        }
      }

      // update state
      setPickingState(prev =>
        prev.map(g =>
          g.doNo === doNo
            ? {
                ...g,
                status: newStatus,
                validation: {
                  status: newStatus === "picked" ? "success" : "error",
                  message: messageRaw || `Response status ${response.status}`,
                },
              }
            : g
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Picking confirmation failed.";
      console.error("initiatePicking error", doNo, err);

      setPickingState(prev =>
        prev.map(g =>
          g.doNo === doNo
            ? {
                ...g,
                status: "error",
                validation: { status: "error", message: errorMessage },
              }
            : g
        )
      );
    }
  };

  const handlePicking = useCallback(async (doNo: string): Promise<void> => {
    const group = pickingState.find((g) => g.doNo === doNo);
    if (!group || !group.pickingPayload) return;
    console.log('Initiating picking for DO:', doNo, 'with payload:', group.pickingPayload);
    await initiatePicking(doNo, group.pickingPayload);
  }, [pickingState]);

  const handlePickingAll = async () => {
    const pendingPickingGroups = pickingState.filter((g) => g.status === "transferred");
    await Promise.all(pendingPickingGroups.map(group => handlePicking(group.doNo)));
  };

  const getStatusIcon = (status: 'success' | 'warning' | 'error' | null) => {
    if (status === 'success') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (status === 'error') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return null;
  };

  const getStatusBadge = (status: ODBGroup['status']) => {
    const statusMap = {
      pending: "bg-gray-500 text-white",
      loading: "bg-yellow-500 text-white animate-pulse",
      transferred: "bg-blue-500 text-white",
      picked: "bg-green-500 text-white",
      completed: "bg-green-700 text-white",
      error: "bg-red-500 text-white",
    };
    return <Badge className={statusMap[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-center">Picking Confirmation</h2>
        {allGroupsAreFinalized ? (
          <Button onClick={onComplete} className="bg-green-500 hover:bg-green-600 text-white">
            Complete DockOut <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handlePickingAll} className="bg-primary hover:bg-primary/90">
            Complete All Picking <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      {pickingState.map((group) => {
        const sapResponse = sapResponses[group.doNo];
        return (
          <Card key={group.doNo} className="shadow-md">
            <CardHeader>
              <CardTitle>DO: {group.doNo}</CardTitle>
              <CardDescription>{(group.sapResponse?.d?.OrderToItem?.results || group.items).length} line item(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Uecha</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead>To Sloc</TableHead>
                    <TableHead>VEP</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(group.sapResponse?.d?.OrderToItem?.results || group.items).map((item: any, index: number) => (
                    <TableRow key={item.id || index}>
                      <TableCell>{item.material || item.Matnr}</TableCell>
                      <TableCell>{item.actualQuantity || item.Quantity} {item.uom || item.Uom}</TableCell>
                      <TableCell>{item.actualBatch || item.Batch}</TableCell>
                      <TableCell>{item.uecha || item.UECHA}</TableCell>
                      <TableCell>{item.bin || item.Bin}</TableCell>
                      <TableCell>{item.destSloc || item.ToStorage}</TableCell>
                      <TableCell>{item.vepToken||item.VepToken}</TableCell>
                      <TableCell>{item.posnr || item.Posnr}</TableCell>
                      <TableCell>
                        {getStatusBadge(group.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {group.status !== 'picked' && (
                <Button onClick={() => handlePicking(group.doNo)} className="mt-4">Complete Picking</Button>
              )}

              {sapResponse && (
                <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 text-lg font-semibold">
                      {getStatusIcon(group.validation.status)}
                      <span>SAP Response</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => toggleRawResponse(group.doNo)}>
                      {showRawResponse[group.doNo] ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Badge variant={group.validation.status === 'success' ? 'default' : 'destructive'}>
                      {sapResponse.message}
                    </Badge>
                    {sapResponse.rescode && (
                      <Badge variant="secondary">
                        Response Code: {sapResponse.rescode}
                      </Badge>
                    )}
                  </div>
                  {showRawResponse[group.doNo] && (
                    <div className="mt-4">
                      <p className="font-semibold mb-1">Raw SAP Response:</p>
                      <pre className="bg-gray-200 p-2 rounded-md text-sm overflow-auto">
                        {JSON.stringify(sapResponse.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default SapPicking;
