"use client"

import { useState } from "react";
import Loading from "@/components/Loading/Loading";
import StockTransfer from "@/components/StockTransfer/StockTransfer";
import SapPicking from "@/components/Picking/SapPicking";
import Gross from "@/components/Gross/Gross";

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

type WorkflowStep = "loading" | "transfer" | "picking" | "gross";

export default function WelcomePage() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("loading");
  const [odbGroups, setOdbGroups] = useState<ODBGroup[]>([]);

  const handleLoadingComplete = (groups: ODBGroup[]) => {
    setOdbGroups(groups);
    setCurrentStep("transfer");
  };

  const handleTransferComplete = (groups: ODBGroup[]) => {
    setOdbGroups(groups);
    setCurrentStep("picking");
  };

  const handlePickingComplete = () => {
    setCurrentStep("gross");
  };

  const handleStartNew = () => {
    setOdbGroups([]);
    setCurrentStep("loading");
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "loading":
        return <Loading onLoadingComplete={handleLoadingComplete} />;
      case "transfer":
        return <StockTransfer odbGroups={odbGroups} onTransferComplete={handleTransferComplete} />;
      case "picking":
        return <SapPicking odbGroups={odbGroups} onComplete={handlePickingComplete} />;
      case "gross":
        return <Gross onStartNew={handleStartNew} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-sky-900 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
