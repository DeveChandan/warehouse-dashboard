'use client'
import React, { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCcw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// --- Type Definitions ---
interface SapDataItem {
  tokenno: string
  obd_no: string
  posnr: string
  lfimg: string
  prqty: string
  matnr: string
  uecha: string
  charg: string
  ntgew: string
  brgew: string
  lgort: string
  werks: string
}

interface SapData {
  d: {
    results: SapDataItem[]
  }
}

interface AdditionalMaterial {
  materialId: string
  quantity: string
  uom: string
}

// Material and UOM options
const materialOptions = [
  {label: 'Select Material', value: ''},
  {label: 'Husk', value: 'Husk'},
  {label: 'Ply', value: 'Ply'},
  {label: 'Wastage Carton', value: 'Wastage Carton'},
  {label: 'Hardboard', value: 'Hardboard'},
  {label: 'Ply 3mm', value: 'Ply 3mm'},
  {label: 'Black Polythene Paper', value: 'Black Polythene Paper'},
  {label: 'Tarpoline', value: 'Tarpoline'},
  {label: 'Tin Sheet', value: 'Tin Sheet'},
  {label: 'Gift Items', value: 'Gift Items'},
];

const uomOptions = [
  {label: 'Kilogram (KG)', value: 'KG'},
  {label: 'Gram (G)', value: 'G'},
  {label: 'Piece (PC)', value: 'PC'},
];

const Gross: React.FC = () => {
  const [vepToken, setVepToken] = useState<string>('')
  const [loadingSequence, setLoadingSequence] = useState<SapDataItem[] | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'initial' | 'data-loaded' | 'completed'>('initial')
  const [showAdditionalMaterialPopup, setShowAdditionalMaterialPopup] = useState<boolean>(false)
  const [additionalMaterials, setAdditionalMaterials] = useState<AdditionalMaterial[]>([{ materialId: '', quantity: '', uom: '' }])
  const [lastUpdateAttempt, setLastUpdateAttempt] = useState<{ isCompleted: boolean; materials: AdditionalMaterial[] | null } | null>(null);

  const totalBrgew = useMemo(() => {
    if (!loadingSequence) return 0;
    return loadingSequence.reduce((sum, item) => sum + parseFloat(item.brgew || '0'), 0);
  }, [loadingSequence]);

  const handleFetchData = async () => {
    if (!vepToken) {
      setError('VEP Token is required.')
      return
    }
    setIsLoading(true)
    setError(null)
    setLoadingSequence(null)

    try {
      const response = await fetch(`/api/sap-proxy?token=${vepToken}`)
      if (!response.ok) {
        throw new Error('Failed to fetch SAP data.')
      }
      const data: SapData = await response.json()
      const results = data.d.results

      if (results.length === 0) {
        setError('No data found for the provided VEP Token.')
        setStep('initial')
        return
      }

      const isValid = results.every(item => item.lfimg === item.prqty)
      if (!isValid) {
        setError('LFIMG and PRQTY fields do not match for all items.')
        setLoadingSequence(results)
        setStep('data-loaded') // Still show data but with an error
      } else {
        setLoadingSequence(results)
        setStep('data-loaded')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.')
      setStep('initial')
    } finally {
      setIsLoading(false)
    }
  }

  const processTegUpdate = async (isCompleted: boolean, materials: AdditionalMaterial[] | null = null) => {
    setIsLoading(true)
    setError(null)
    setLastUpdateAttempt({ isCompleted, materials });

    try {
      // 1. Get TEG Auth Token
      const authResponse = await fetch('/api/teg-auth', { method: 'POST' })
      if (!authResponse.ok) throw new Error('Failed to get TEG authentication token.')
      const { token: tegToken } = await authResponse.json()
      if (!tegToken) throw new Error('TEG Authentication token not received.')

      // 2. Send TEG Update with the new payload structure
      const tegUpdatePayload = {
        token: vepToken,
        isLoadingCompleted: isCompleted,
        loadingDetails: loadingSequence?.map(item => ({
          doNumber: item.obd_no,
          quantity: item.prqty,
          batchNo: item.charg,
          batchLineNo: item.posnr || '900005',
          storageLocation: item.lgort,
          batchQuantity: item.lfimg,
          loadedQuantity: item.lfimg,
          materialCode: item.matnr,
          actualWeight: item.ntgew || '1183.096',
          lineItem: !item.uecha || item.uecha === '000000' ? '000010' : item.uecha,
          chargedWeight: item.brgew || '2127.870',
        })),
      }

      const tegUpdateResponse = await fetch('/api/teg-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': tegToken },
        body: JSON.stringify(tegUpdatePayload),
      })
      if (!tegUpdateResponse.ok) throw new Error('Failed to send TEG update.')

      // 3. If additional materials exist, send them
      if (materials && materials.length > 0 && materials[0].materialId) {
        const additionalMaterialsPayload = {
          token: vepToken,
          isLoadingCompleted: true,
          additionalMaterials: materials.map(row => ({
            materialDescription: row.materialId,
            chargedWeight: row.quantity,
            uom: row.uom,
          })),
        };
        const additionalMaterialsResponse = await fetch('/api/additional-materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': tegToken },
          body: JSON.stringify(additionalMaterialsPayload),
        })
        if (!additionalMaterialsResponse.ok) throw new Error('Failed to send additional materials.')
        console.log('TEG update process completed successfully.', additionalMaterialsPayload);
      }

      setStep('completed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during the update process.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleRetryUpdate = () => {
    if (lastUpdateAttempt) {
      processTegUpdate(lastUpdateAttempt.isCompleted, lastUpdateAttempt.materials);
    }
  }

  const handleAddAdditionalMaterial = () => {
    processTegUpdate(false, additionalMaterials)
    setShowAdditionalMaterialPopup(false)
  }

  const handleAdditionalMaterialChange = (index: number, field: keyof AdditionalMaterial, value: string) => {
    const newMaterials = [...additionalMaterials]
    newMaterials[index][field] = value
    setAdditionalMaterials(newMaterials)
  }

  const addAdditionalMaterialRow = () => {
    setAdditionalMaterials([...additionalMaterials, { materialId: '', quantity: '', uom: '' }])
  }

  const onStartNew = () => {
    setVepToken('')
    setLoadingSequence(null)
    setIsLoading(false)
    setError(null)
    setStep('initial')
    setAdditionalMaterials([{ materialId: '', quantity: '', uom: '' }])
    setLastUpdateAttempt(null);
  }

  const renderInitialStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Gross Weight Check</CardTitle>
        <CardDescription>Enter a VEP Token to fetch SAP data and verify quantities.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vepToken">VEP Token</Label>
          <Input
            id="vepToken"
            value={vepToken}
            onChange={(e) => setVepToken(e.target.value)}
            placeholder="Enter VEP Token"
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-4">
          <Button onClick={handleFetchData} disabled={isLoading || !!error}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Fetch Data
          </Button>
          {error && (
            <Button onClick={handleFetchData} variant="outline">
              <RefreshCcw className="mr-2 h-4 w-4" /> Retry
            </Button>
          )}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )

  const renderDataLoadedStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>SAP Data for VEP Token: {vepToken}</CardTitle>
        <CardDescription>Review the data below. LFIMG and PRQTY must match to proceed without errors.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Validation Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="text-right mb-4">
          <span className="text-sm font-semibold">Total Gross Weight: </span>
          <span className="text-lg font-bold text-green-600">{totalBrgew.toFixed(2)} KG</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OBD</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Posnr</TableHead>
              <TableHead>NTGEW</TableHead>
              <TableHead>BRGEW</TableHead>
              <TableHead>LFIMG</TableHead>
              <TableHead>PRQTY</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Item</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingSequence?.map((item, index) => (
              <TableRow key={index} className={item.lfimg !== item.prqty ? 'bg-red-100 dark:bg-red-900/30' : ''}>
                <TableCell>{item.obd_no}</TableCell>
                <TableCell>{item.matnr}</TableCell>
                <TableCell>{item.posnr}</TableCell>
                <TableCell>{item.ntgew}</TableCell>
                <TableCell>{item.brgew}</TableCell>
                <TableCell>{item.lfimg}</TableCell>
                <TableCell>{item.prqty}</TableCell>
                <TableCell>{item.charg}</TableCell>
                <TableCell>{item.lgort}</TableCell>
                <TableCell>{item.uecha}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end gap-4 mt-6">
          <Dialog open={showAdditionalMaterialPopup} onOpenChange={setShowAdditionalMaterialPopup}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isLoading || !!error}>Add Additional Material</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Add Additional Material</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {additionalMaterials.map((mat, index) => (
                  <div key={index} className="grid grid-cols-3 gap-4">
                    <select
                      value={mat.materialId}
                      onChange={(e) => handleAdditionalMaterialChange(index, 'materialId', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus-visible:ring-gray-300"
                    >
                      {materialOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Input placeholder="Quantity" value={mat.quantity} onChange={(e) => handleAdditionalMaterialChange(index, 'quantity', e.target.value)} />
                    <select
                      value={mat.uom}
                      onChange={(e) => handleAdditionalMaterialChange(index, 'uom', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus-visible:ring-gray-300"
                    >
                      {uomOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addAdditionalMaterialRow}>Add Row</Button>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setShowAdditionalMaterialPopup(false)}>Cancel</Button>
                <Button onClick={handleAddAdditionalMaterial} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add and Complete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={() => processTegUpdate(true)} disabled={isLoading || !!error}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continue without Additional Material
          </Button>
          {error && (
            <Button onClick={handleRetryUpdate} variant="outline" disabled={isLoading}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const renderCompletedStep = () => (
    <Card className="text-center">
      <CardHeader>
        <CardTitle className="text-2xl text-green-500">Process Completed!</CardTitle>
        <CardDescription>All updates have been sent successfully.</CardDescription>
      </CardHeader>
      <CardContent>
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <Button variant="outline" onClick={onStartNew} className="mt-6">
          Start New VEP Token
        </Button>
      </CardContent>
    </Card>
  )

  switch (step) {
    case 'data-loaded':
      return renderDataLoadedStep()
    case 'completed':
      return renderCompletedStep()
    case 'initial':
    default:
      return renderInitialStep()
  }
}

export default Gross
