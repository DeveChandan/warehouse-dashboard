"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  User,
  Database,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Calendar,
  BarChart3,
  Settings,
  Download,
  Eye,
  EyeOff,
  Zap,
  TrendingUp,
  Activity,
  Server,
  Trash2,
  Truck,
  AlertTriangle,
  Package,
  Info,
} from "lucide-react"
import { format, isAfter, isBefore, parseISO } from "date-fns"

const API_BASE_URL = "http://10.255.20.7:4000/records"

const COLLECTIONS = [
  {
    value: "non_wms_partial_saves",
    label: "Non WMS Partial Saves",
    icon: <Database className="w-4 h-4" />,
    color: "bg-blue-500",
    allowDelete: true,
  },
  {
    value: "sendToSAPLogs",
    label: "Send To SAP Logs",
    icon: <Server className="w-4 h-4" />,
    color: "bg-purple-500",
    allowDelete: false,
  },
  {
    value: "toGeneratedLogs",
    label: "TO Generated Logs",
    icon: <Activity className="w-4 h-4" />,
    color: "bg-green-500",
    allowDelete: false,
  },
  {
    value: "sendToTEG_PreSendLog",
    label: "Send To TEG Pre-Send Log",
    icon: <TrendingUp className="w-4 h-4" />,
    color: "bg-orange-500",
    allowDelete: false,
  },
  {
    value: "sendToTEGLogs",
    label: "Send To TEG Logs",
    icon: <Truck className="w-4 h-4" />,
    color: "bg-cyan-500",
    allowDelete: false,
  },
  {
    value: "non_wms_logs",
    label: "Non WMS Logs",
    icon: <BarChart3 className="w-4 h-4" />,
    color: "bg-indigo-500",
    allowDelete: false,
  },
]

interface Record {
  _id: string
  username: string
  timestamp: string
  status?: string
  vepToken?: string
  vepTokenCard?: string
  doNo?: string
  action?: string
  collection?: string
  error?: string
  payload?: any
  response?: any
  [key: string]: any
}

interface Stats {
  total: number
  success: number
  failure: number
  partialSave: number
  truckComplete: number
  truckIssues: number
}

const ITEMS_PER_PAGE = 20

export default function Dashboard() {
  const [allRecords, setAllRecords] = useState<Record[]>([]) // Store all raw data
  const [filteredRecords, setFilteredRecords] = useState<Record[]>([]) // Store filtered data
  const [displayedRecords, setDisplayedRecords] = useState<Record[]>([]) // Store paginated data
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedCollection, setSelectedCollection] = useState("non_wms_partial_saves")
  const [usernames, setUsernames] = useState<string[]>([])
  const [selectedUsername, setSelectedUsername] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("")
  const [vepTokenFilter, setVepTokenFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({
    total: 0,
    success: 0,
    failure: 0,
    partialSave: 0,
    truckComplete: 0,
    truckIssues: 0,
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)

  // Set default dates to current date
  useEffect(() => {
    const now = new Date()
    const today = format(now, "yyyy-MM-dd")
    const currentTime = format(now, "HH:mm")

    if (!startDate) {
      setStartDate(`${today}T00:00`)
    }
    if (!endDate) {
      setEndDate(`${today}T${currentTime}`)
    }
  }, [])

  // Client-side filtering function
  const applyFilters = (data: Record[]) => {
    let filtered = [...data]

    // Filter by username
    if (selectedUsername) {
      filtered = filtered.filter((record) => record.username === selectedUsername)
    }

    // Filter by status
    if (selectedStatus && selectedStatus !== "all") {
      filtered = filtered.filter((record) => record.status === selectedStatus)
    }

    // Filter by VEP Token (supports both vepToken and vepTokenCard)
    if (vepTokenFilter) {
      filtered = filtered.filter(
        (record) =>
          record.vepToken?.toLowerCase().includes(vepTokenFilter.toLowerCase()) ||
          record.vepTokenCard?.toLowerCase().includes(vepTokenFilter.toLowerCase()),
      )
    }

    // Filter by date range
    if (startDate) {
      const startDateTime = parseISO(startDate)
      filtered = filtered.filter((record) => {
        try {
          const recordDate = parseISO(record.timestamp)
          return isAfter(recordDate, startDateTime) || recordDate.getTime() === startDateTime.getTime()
        } catch {
          return true // Keep record if date parsing fails
        }
      })
    }

    if (endDate) {
      const endDateTime = parseISO(endDate)
      filtered = filtered.filter((record) => {
        try {
          const recordDate = parseISO(record.timestamp)
          return isBefore(recordDate, endDateTime) || recordDate.getTime() === endDateTime.getTime()
        } catch {
          return true // Keep record if date parsing fails
        }
      })
    }

    // Filter by search term (searches all fields)
    if (searchTerm) {
      filtered = filtered.filter((record) => JSON.stringify(record).toLowerCase().includes(searchTerm.toLowerCase()))
    }

    return filtered
  }

  // Client-side pagination
  const applyPagination = (data: Record[]) => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return data.slice(startIndex, endIndex)
  }

  // Calculate stats from filtered records
  const calculateStats = (data: Record[]) => {
    const stats = {
      total: data.length,
      success: data.filter((r) => r.status === "success").length,
      failure: data.filter((r) => r.status === "failure").length,
      partialSave: data.filter((r) => r.event === "partial_save" || r.action?.includes("Partial")).length,
      truckComplete: selectedCollection === "sendToTEGLogs" ? data.filter((r) => r.status === "success").length : 0,
      truckIssues: selectedCollection === "sendToTEGLogs" ? data.filter((r) => r.status === "failure").length : 0,
    }
    setStats(stats)
  }

  // Apply all filters and pagination
  useEffect(() => {
    const filtered = applyFilters(allRecords)
    setFilteredRecords(filtered)
    calculateStats(filtered)

    // Calculate total pages
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    setTotalPages(totalPages)

    // Reset to page 1 if current page is beyond total pages
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
      return
    }

    // Apply pagination
    const paginated = applyPagination(filtered)
    setDisplayedRecords(paginated)
  }, [
    allRecords,
    selectedUsername,
    selectedStatus,
    vepTokenFilter,
    startDate,
    endDate,
    searchTerm,
    currentPage,
    selectedCollection,
  ])

  // Extract unique usernames from all records
  useEffect(() => {
    const uniqueUsernames = [...new Set(allRecords.map((record) => record.username))]
    setUsernames(uniqueUsernames.filter(Boolean))
  }, [allRecords])

  // Delete record function
  const deleteRecord = async (recordId: string) => {
    setDeleteLoading(recordId)
    try {
      const response = await fetch(`${API_BASE_URL}/${selectedCollection}/${recordId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      // Remove record from local state
      setAllRecords((prev) => prev.filter((record) => record._id !== recordId))
      setError("")
    } catch (error) {
      console.error("Error deleting record:", error)
      setError("Failed to delete record. Please try again.")
    } finally {
      setDeleteLoading(null)
    }
  }

  // Fetch all records from API (no server-side filtering)
  const fetchRecords = async () => {
    setLoading(true)
    setError("")

    try {
      // Simple API call without any query parameters since server doesn't support filtering
      const url = `${API_BASE_URL}/${selectedCollection}`

      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const data = await response.json()

      if (Array.isArray(data)) {
        // Sort by timestamp (newest first)
        const sortedData = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setAllRecords(sortedData)
        setCurrentPage(1) // Reset to first page when fetching new data
      } else {
        setAllRecords([])
      }
    } catch (error) {
      console.error("Error fetching records:", error)
      setError("Failed to fetch records. Please check your API connection.")
      setAllRecords([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch data when collection changes
  useEffect(() => {
    fetchRecords()
  }, [selectedCollection])

  const getStatusBadge = (status: string, action?: string, collection?: string) => {
    const isPartialSave = action?.includes("Partial") || status === "partial_save"

    if (isPartialSave) {
      return (
        <Badge className="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border-yellow-200 hover:from-yellow-200 hover:to-amber-200 transition-all duration-200">
          <Clock className="w-3 h-3 mr-1" />
          Partial Save
        </Badge>
      )
    }

    // Special handling for sendToTEGLogs
    if (collection === "sendToTEGLogs") {
      switch (status?.toLowerCase()) {
        case "success":
          return (
            <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200 hover:from-green-200 hover:to-emerald-200 transition-all duration-200">
              <Truck className="w-3 h-3 mr-1" />
              Truck Complete
            </Badge>
          )
        case "failure":
          return (
            <Badge className="bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 border-orange-200 hover:from-orange-200 hover:to-red-200 transition-all duration-200">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Truck Issues
            </Badge>
          )
      }
    }

    switch (status?.toLowerCase()) {
      case "success":
        return (
          <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200 hover:from-green-200 hover:to-emerald-200 transition-all duration-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </Badge>
        )
      case "failure":
        return (
          <Badge className="bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-200 hover:from-red-200 hover:to-rose-200 transition-all duration-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failure
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border-gray-200">
            <Activity className="w-3 h-3 mr-1" />
            {status || action || "Unknown"}
          </Badge>
        )
    }
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "MMM dd, yyyy HH:mm:ss")
    } catch {
      return timestamp
    }
  }

  const clearFilters = () => {
    setSelectedUsername("")
    setSelectedStatus("")
    setVepTokenFilter("")
    setSearchTerm("")
    setCurrentPage(1)

    // Reset to current date
    const now = new Date()
    const today = format(now, "yyyy-MM-dd")
    const currentTime = format(now, "HH:mm")
    setStartDate(`${today}T00:00`)
    setEndDate(`${today}T${currentTime}`)
  }

  const renderRecordDetails = (record: Record) => {
    const excludeKeys = ["_id", "username", "timestamp", "status", "collection"]
    const details = Object.entries(record).filter(([key]) => !excludeKeys.includes(key))

    return (
      <div className="mt-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-inner">
        <h4 className="font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Record Details
        </h4>

        {/* Special handling for sendToTEGLogs error messages */}
        {record.error && selectedCollection === "sendToTEGLogs" && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h5 className="font-medium text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Truck Movement Issue
            </h5>
            <p className="text-red-700 text-sm">
              {typeof record.error === "string"
                ? (() => {
                    try {
                      return JSON.parse(record.error).message || record.error
                    } catch {
                      return record.error
                    }
                  })()
                : record.error}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {details.map(([key, value]) => (
            <div key={key} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <span className="font-medium text-gray-600 block mb-1 capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}:
              </span>
              <span className="text-gray-800 break-all font-mono text-xs">
                {typeof value === "object" ? (
                  <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded border max-h-40 overflow-y-auto">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ) : (
                  String(value)
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const getRowClassName = (record: Record) => {
    const isPartialSave = record.event === "partial_save" || record.action?.includes("Partial")

    if (isPartialSave) {
      return "bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 hover:from-yellow-100 hover:to-amber-100"
    }

    // Special styling for sendToTEGLogs
    if (selectedCollection === "sendToTEGLogs") {
      switch (record.status?.toLowerCase()) {
        case "success":
          return "bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400 hover:from-green-100 hover:to-emerald-100"
        case "failure":
          return "bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-400 hover:from-orange-100 hover:to-red-100"
      }
    }

    switch (record.status?.toLowerCase()) {
      case "success":
        return "bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400 hover:from-green-100 hover:to-emerald-100"
      case "failure":
        return "bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-400 hover:from-red-100 hover:to-rose-100"
      default:
        return "bg-white hover:bg-gray-50 border-l-4 border-gray-200"
    }
  }

  const selectedCollectionData = COLLECTIONS.find((c) => c.value === selectedCollection)
  const canDelete = selectedCollectionData?.allowDelete && selectedCollection === "non_wms_partial_saves"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden">
          <Card className="border-0 shadow-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600">
            <CardHeader className="pb-8">
              <CardTitle className="flex items-center gap-3 text-white text-2xl font-bold">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Database className="w-8 h-8" />
                </div>
                Warehouse Management Dashboard
                <div className="ml-auto flex items-center gap-2">
                  <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                    <Zap className="w-3 h-3 mr-1" />
                    Client-Side Filtering
                  </Badge>
                </div>
              </CardTitle>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
            </CardHeader>
          </Card>
        </div>

        {/* API Info Alert */}
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Note:</strong> API doesn't support server-side filtering. All filtering is done client-side after
            fetching complete data. Total records loaded: <strong>{allRecords.length}</strong> | Filtered results:{" "}
            <strong>{filteredRecords.length}</strong>
          </AlertDescription>
        </Alert>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white transform hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Records</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                  <p className="text-blue-200 text-xs">of {allRecords.length} loaded</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white transform hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Success</p>
                  <p className="text-3xl font-bold">{stats.success}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white transform hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium">Failures</p>
                  <p className="text-3xl font-bold">{stats.failure}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-white transform hover:scale-105 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm font-medium">Partial Saves</p>
                  <p className="text-3xl font-bold">{stats.partialSave}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-200" />
              </div>
            </CardContent>
          </Card>

          {selectedCollection === "sendToTEGLogs" && (
            <>
              <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-500 to-cyan-600 text-white transform hover:scale-105 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-cyan-100 text-sm font-medium">Truck Complete</p>
                      <p className="text-3xl font-bold">{stats.truckComplete}</p>
                    </div>
                    <Truck className="w-8 h-8 text-cyan-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white transform hover:scale-105 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm font-medium">Truck Issues</p>
                      <p className="text-3xl font-bold">{stats.truckIssues}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-orange-200" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <Filter className="w-5 h-5" />
              Client-Side Filters
              {selectedCollectionData && (
                <Badge className={`ml-2 text-white ${selectedCollectionData.color}`}>
                  {selectedCollectionData.icon}
                  <span className="ml-1">{selectedCollectionData.label}</span>
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Collection Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Collection</Label>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                  <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLECTIONS.map((collection) => (
                      <SelectItem key={collection.value} value={collection.value}>
                        <div className="flex items-center gap-2">
                          {collection.icon}
                          {collection.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Username Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Username</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-white border-gray-300 hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {selectedUsername || "All Users"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full">
                    <DropdownMenuItem onClick={() => setSelectedUsername("")}>
                      <User className="w-4 h-4 mr-2" />
                      All Users
                    </DropdownMenuItem>
                    {usernames.map((username) => (
                      <DropdownMenuItem key={username} onClick={() => setSelectedUsername(username)}>
                        <User className="w-4 h-4 mr-2" />
                        {username}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">
                      <div className="flex items-center gap-2">
                        {selectedCollection === "sendToTEGLogs" ? (
                          <Truck className="w-4 h-4 text-green-600" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        {selectedCollection === "sendToTEGLogs" ? "Truck Complete" : "Success"}
                      </div>
                    </SelectItem>
                    <SelectItem value="failure">
                      <div className="flex items-center gap-2">
                        {selectedCollection === "sendToTEGLogs" ? (
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        {selectedCollection === "sendToTEGLogs" ? "Truck Issues" : "Failure"}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search all fields..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* VEP Token Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">VEP Token</Label>
                <Input
                  placeholder="Enter VEP Token"
                  value={vepTokenFilter}
                  onChange={(e) => setVepTokenFilter(e.target.value)}
                  className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">End Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 items-end">
                <Button
                  onClick={fetchRecords}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="border-gray-300 hover:bg-gray-50 transform hover:scale-105 transition-all duration-200 bg-transparent"
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Records (Page {currentPage} of {totalPages} - Showing {displayedRecords.length} of{" "}
                {filteredRecords.length} filtered)
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                {canDelete && (
                  <Badge variant="secondary" className="text-xs">
                    <Package className="w-3 h-3 mr-1" />
                    Delete Available
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Username</TableHead>
                        <TableHead className="font-semibold text-gray-700">Timestamp</TableHead>
                        <TableHead className="font-semibold text-gray-700">Status</TableHead>
                        <TableHead className="font-semibold text-gray-700">VEP Token</TableHead>
                        <TableHead className="font-semibold text-gray-700">DO Number</TableHead>
                        <TableHead className="font-semibold text-gray-700">Action</TableHead>
                        <TableHead className="font-semibold text-gray-700">Details</TableHead>
                        {canDelete && <TableHead className="font-semibold text-gray-700">Delete</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedRecords.map((record) => (
                        <>
                          <TableRow
                            key={record._id}
                            className={`${getRowClassName(record)} transition-all duration-300 cursor-pointer`}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                  {record.username?.charAt(0) || "U"}
                                </div>
                                {record.username}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{formatTimestamp(record.timestamp)}</TableCell>
                            <TableCell>
                              {getStatusBadge(record.status || "", record.action, selectedCollection)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {record.vepToken || record.vepTokenCard ? (
                                <Badge variant="outline" className="font-mono">
                                  {record.vepToken || record.vepTokenCard}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{record.doNo || "-"}</TableCell>
                            <TableCell>
                              {record.action || record.event ? (
                                <Badge variant="secondary" className="text-xs">
                                  {record.action || record.event}
                                </Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedRow(expandedRow === record._id ? null : record._id)}
                                className="hover:bg-blue-50 transition-colors duration-200"
                              >
                                {expandedRow === record._id ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </TableCell>
                            {canDelete && (
                              <TableCell>
                                {(record.event === "partial_save" || record.action?.includes("Partial")) && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors duration-200"
                                        disabled={deleteLoading === record._id}
                                      >
                                        {deleteLoading === record._id ? (
                                          <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Partial Save Record</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this partial save record? This action cannot
                                          be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteRecord(record._id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                          {expandedRow === record._id && (
                            <TableRow>
                              <TableCell colSpan={canDelete ? 8 : 7} className="p-0">
                                {renderRecordDetails(record)}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {displayedRecords.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No records found matching your criteria.</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {filteredRecords.length === 0
                        ? "Try adjusting your filters or search terms."
                        : `${filteredRecords.length} records match your filters but none on this page.`}
                    </p>
                  </div>
                )}

                {/* Pagination */}
                {filteredRecords.length > 0 && (
                  <div className="flex items-center justify-between p-6 bg-gray-50 border-t">
                    <div className="text-sm text-gray-600">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                      {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length}{" "}
                      filtered records
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="hover:bg-blue-50 transition-colors duration-200"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="hover:bg-blue-50 transition-colors duration-200"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
