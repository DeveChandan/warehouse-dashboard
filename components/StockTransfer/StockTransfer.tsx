"use client"
import React, { useState, useCallback, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Edit,
  Trash2,
  FileCheck,
  Save,
  Copy,
  AlertTriangle,
} from "lucide-react"
import { v4 as uuidv4 } from "uuid"

// --- Type Definitions ---
const StorageTypes = ["EDO", "RVP", "SCK", "PICKER"] as const
const DestSlocs = ["ZF05", "ZF04", "ZF03", "ZF02", "ZF01"] as const

interface ODBItem {
  id: string
  sNo: number
  vepToken: string
  doNo: string
  wmsPicking: string
  pickingStatus: string
  pgiStatus: string
  posnr: string
  material: string
  materialDes: string
  qty: number
  batch: string
  uom: string
  bin: string
  storageType: (typeof StorageTypes)[number]
  destSloc: (typeof DestSlocs)[number]
  warehouse: string
  storage: string
  plant: string
  dock: string
  net: number
  gross: number
  truck: string
  toNo: string
  sequenceNo: string
  channel: string
  uecha: string
  docCata?: string
  actualBatch: string
  actualQuantity: number
  isNew: boolean
  status: "pending" | "loading" | "transferred" | "picked" | "completed" | "error"
  errorMessage?: string
}

interface ODBGroup {
  doNo: string
  items: ODBItem[]
  status: "pending" | "loading" | "transferred" | "picked" | "completed" | "error"
  isEditing: boolean
  validation: {
    status: "success" | "warning" | "error" | null;
    message: string | null;
  };
  pickingPayload?: any;
  sapResponse?: any;
}

interface StockTransferProps {
  odbGroups: ODBGroup[];
  onTransferComplete: (groups: ODBGroup[]) => void;
}

const StockTransfer: React.FC<StockTransferProps> = ({ odbGroups, onTransferComplete }) => {
  const [groups, setGroups] = useState(odbGroups);
  const [error, setError] = useState<string | null>(null);

  const hasPendingTransfers = useMemo(() => {
    return groups.some(group => group.status === "pending" || group.isEditing);
  }, [groups]);

  const allGroupsAreTransferred = useMemo(() => {
    return groups.length > 0 && groups.every(group => group.status === "transferred" || group.status === "completed");
  }, [groups]);

  const [isTransferComplete, setIsTransferComplete] = useState(false);

  useEffect(() => {
    if (allGroupsAreTransferred) {
      setIsTransferComplete(true);
    }
  }, [allGroupsAreTransferred]);

  const handleTransfer = async (group: ODBGroup): Promise<void> => {
    setGroups((prev) =>
      prev.map((g) => (g.doNo === group.doNo ? { ...g, status: "loading" } : g))
    );

    try {
      const requestBody = {
        doNo: group.doNo,
        items: group.items.map((item) => ({
          material: item.material,
          originalQuantity: item.qty,
          actualQuantity: item.actualQuantity,
          originalBatch: item.batch,
          actualBatch: item.actualBatch,
          uom: item.uom,
          bin: item.bin,
          storage: item.storage,
          storageType: item.storageType,
          destSloc: item.destSloc,
          plant: item.plant,
          warehouse: item.warehouse,
          posnr: item.posnr,
          vepToken: item.vepToken,
          uecha: item.uecha,
          docCata: item.docCata || '',
        })),
      };

      const response = await fetch("/api/stock-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      let newStatus: ODBGroup["status"];

      if (data.status === "success") {
        newStatus = "transferred";
      } else if (data.status === "warning") {
        newStatus = "transferred";
      } else {
        newStatus = "error";
      }

      setGroups((prev) =>
        prev.map((g) =>
          g.doNo === group.doNo
            ? {
                ...g,
                status: newStatus,
                isEditing: false,
                validation: { status: data.status, message: data.message },
                items: data.data?.items || g.items,
                pickingPayload: data.data?.pickingPayload,
                sapResponse: data.data?.sapResponse,
              }
            : g
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Stock transfer failed due to an unexpected error.";
      setGroups((prev) =>
        prev.map((g) =>
          g.doNo === group.doNo
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

  const handleTransferAll = async () => {
    const pendingGroups = groups.filter((g) => g.status === "pending" || g.isEditing);
    if (pendingGroups.length === 0) {
      setError("No pending ODBs to transfer.");
      return;
    }
    setError(null);
    await Promise.all(pendingGroups.map(group => handleTransfer(group)));
  };

  const handleItemChange = (doNo: string, itemId: string, field: keyof ODBItem, value: any) => {
    setGroups((prev) =>
      prev.map((group) => {
        if (group.doNo === doNo) {
          const newItems = group.items.map((item) => {
            if (item.id === itemId) {
              const updatedItem = { ...item, [field]: value };
              if (field === "actualQuantity") {
                updatedItem.actualQuantity = Number.isNaN(parseFloat(value)) ? 0 : parseFloat(value);
              }
              return updatedItem;
            }
            return item;
          });

          return { ...group, items: newItems };
        }
        return group;
      })
    );
  };

  const handleDuplicateItem = (doNo: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((group) => {
        if (group.doNo === doNo) {
          const itemToDuplicate = group.items.find((item) => item.id === itemId)
          if (!itemToDuplicate) return group
          const duplicatedItem: ODBItem = {
            ...itemToDuplicate,
            id: uuidv4(),
            isNew: true,
            // Reset both proposed and actual quantities to 0 for the new row
            qty: 0,
            actualQuantity: 0,
            actualBatch: ""
          }
          const itemIndex = group.items.findIndex((item) => item.id === itemId)
          const newItems = [...group.items]
          newItems.splice(itemIndex + 1, 0, duplicatedItem)
          return { ...group, items: newItems }
        }
        return group
      })
    )
  };

  const handleDeleteItem = (doNo: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.doNo === doNo
          ? { ...group, items: group.items.filter((item) => item.id !== itemId) }
          : group
      )
    )
  };

  const toggleEditMode = (doNo: string) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.doNo === doNo
          ? { ...group, isEditing: !group.isEditing, validation: { status: null, message: null } }
          : group
      )
    );
  };

  return (
    <div className="space-y-6">
      {isTransferComplete ? (
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-success">Stock Transfer Complete!</CardTitle>
            <CardDescription>All ODBs have been successfully transferred.</CardDescription>
          </CardHeader>
          <CardContent>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <Button size="lg" onClick={() => onTransferComplete(groups)}>
              Move to Picking <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-center">Loading & Stock Transfer</h2>
            <Button onClick={handleTransferAll} disabled={!hasPendingTransfers} className="bg-primary hover:bg-primary/90">
              Transfer All Pending <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {groups.map((group) => (
            <ODBGroupCard
              key={group.doNo}
              group={group}
              onToggleEditMode={toggleEditMode}
              onItemChange={handleItemChange}
              onDuplicateItem={handleDuplicateItem}
              onDeleteItem={handleDeleteItem}
              onTransfer={handleTransfer}
            />
          ))}
        </>
      )}
    </div>
  );
};

const ODBGroupCard = ({ group, onToggleEditMode, onItemChange, onDuplicateItem, onDeleteItem, onTransfer }: { group: ODBGroup, onToggleEditMode: (doNo: string) => void, onItemChange: (doNo: string, itemId: string, field: keyof ODBItem, value: any) => void, onDuplicateItem: (doNo: string, itemId: string) => void, onDeleteItem: (doNo: string, itemId: string) => void, onTransfer: (group: ODBGroup) => void }) => {
  const { doNo, items, status, isEditing } = group
  const statusMap: Record<typeof status, { color: string; icon: React.ReactNode }> = {
    pending: { color: "border-muted", icon: <Clock className="h-5 w-5 text-muted-foreground" /> },
    loading: { color: "border-yellow-500 animate-pulse", icon: <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" /> },
    completed: { color: "border-success", icon: <CheckCircle className="h-5 w-5 text-success" /> },
    error: { color: "border-destructive", icon: <XCircle className="h-5 w-5 text-destructive" /> },
    transferred: { color: "border-blue-500", icon: <CheckCircle className="h-5 w-5 text-blue-500" /> },
    picked: { color: "border-purple-500", icon: <CheckCircle className="h-5 w-5 text-purple-500" /> },
  }

  const { materialTotals, validationStatus } = useMemo(() => {
    const totals: { [key: string]: { proposed: number; actual: number } } = {};
    let isValid = true;
    let message: string | null = null;

    // Step 1: aggregate totals
    items.forEach(item => {
      if (!totals[item.material]) {
        totals[item.material] = { proposed: 0, actual: 0 };
      }
      totals[item.material].proposed += item.qty;
      totals[item.material].actual += item.actualQuantity;
    });

    // Step 2: validation
    for (const material in totals) {
      const { proposed, actual } = totals[material];

      if (actual > 0) {
        // Rule 1: proposed must not be greater than actual
        if (proposed < actual) {
          isValid = false;
          message = `For material ${material}, proposed quantity (${proposed}) cannot be greater than actual available quantity (${actual}).`;
          break;
        }

        // Rule 2: shortage tolerance check (20%)
        const diffPercentage = ((proposed - actual) / proposed) * 100;
        if (diffPercentage > 20) {
          isValid = false;
          message = `For material ${material}, the proposed quantity exceeds the actual quantity by more than 20% tolerance.`;
          break;
        }
      }
    }

    // Step 3: return results
    return {
      materialTotals: totals,
      validationStatus: { isValid, message }
    };
  }, [items]);



  return (
    <Card className={`shadow-md transition-all duration-300 ${statusMap[status].color}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          {statusMap[status].icon}
          <CardTitle className="text-xl">Delivery Order: {doNo}</CardTitle>
          <Badge variant={status === 'completed' ? 'default' : 'secondary'}>{status}</Badge>
        </div>
        <div className="flex flex-col text-sm text-muted-foreground mr-4">
          {Object.entries(materialTotals).map(([material, totals]) => (
            <div key={material} className="flex items-center">
              <span className="font-medium mr-1">{material}:</span>
              <span className="font-semibold text-blue-500">{totals.actual}</span>
              <span className="mx-1">/</span>
              <span className="text-green-500">{totals.proposed}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {status !== 'completed' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => onToggleEditMode(doNo)}>
                {isEditing ? <><Save className="mr-2 h-4 w-4" /> Save</> : <><Edit className="mr-2 h-4 w-4" /> Edit</>}
              </Button>
              {isEditing && (
                <Button
                  size="sm"
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => onTransfer(group)}
                  disabled={!validationStatus.isValid}
                >
                  <FileCheck className="mr-2 h-4 w-4" /> Complete Load
                </Button>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>VEP</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Posnr</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Proposed Qty</TableHead>
                  <TableHead>Actual Qty</TableHead>
                  <TableHead>Actual Batch</TableHead>
                  <TableHead>Storage Type</TableHead>
                  <TableHead>Proposed Sloc</TableHead>
                  <TableHead>Dest. Sloc</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.vepToken}</TableCell>
                    <TableCell>{item.uecha}</TableCell>
                    <TableCell>{item.posnr}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.material}</div>
                      <div className="text-xs text-muted-foreground">{item.materialDes}</div>
                    </TableCell>
                    <TableCell>{item.qty} {item.uom}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.actualQuantity}
                        onChange={(e) => onItemChange(doNo, item.id, "actualQuantity", e.target.value)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.actualBatch}
                        onChange={(e) => onItemChange(doNo, item.id, "actualBatch", e.target.value)}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={item.storageType} onValueChange={(value) => onItemChange(doNo, item.id, "storageType", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{StorageTypes.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{item.storage}</TableCell>
                    <TableCell>
                      <Select value={item.destSloc} onValueChange={(value) => onItemChange(doNo, item.id, "destSloc", value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DestSlocs.map(ds => <SelectItem key={ds} value={ds}>{ds}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onDuplicateItem(doNo, item.id)}>
                        <Copy className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteItem(doNo, item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {items.map(item => (
              <div key={item.id} className="p-2 bg-slate-50 rounded-md dark:bg-slate-800">
                <p className="font-bold">{item.material}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{item.materialDes}</p>
                <p>Qty: <span className="font-semibold">{item.actualQuantity}</span> <span className="text-xs text-muted-foreground">({item.qty})</span></p>
                <p>Batch: <span className="font-semibold">{item.actualBatch}</span> <span className="text-xs text-muted-foreground">({item.batch})</span></p>
              </div>
            ))}
          </div>
        )}
        {(isEditing && validationStatus.message) && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Validation Error</AlertTitle>
            <AlertDescription>{validationStatus.message}</AlertDescription>
          </Alert>
        )}
        {!isEditing && group.validation.message && (
          <Alert variant={group.validation.status === 'success' ? 'default' : group.validation.status === 'warning' ? 'warning' : 'destructive'} className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{group.validation.status}</AlertTitle>
            <AlertDescription>{group.validation.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
};

export default StockTransfer;
