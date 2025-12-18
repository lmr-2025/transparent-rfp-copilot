"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Database, Table, Columns, Eye, RefreshCw, Check, X } from "lucide-react";
import { toast } from "sonner";
import { parseApiData } from "@/lib/apiClient";

type TableInfo = {
  tableName: string;
  tableType: string;
  rowCount?: number;
};

type ColumnInfo = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  comment: string | null;
};

type ConnectionStatus = {
  connected: boolean;
  message: string;
  details?: {
    account: string;
    warehouse: string;
    database: string;
    schema: string;
  };
};

export default function SnowflakeExplorer() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState<"schemas" | "tables" | "columns" | "preview" | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["connection"]));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/snowflake/test");
      if (res.status === 501) {
        setConnectionStatus({ connected: false, message: "Snowflake not configured" });
        return;
      }
      const json = await res.json();
      const data = parseApiData<ConnectionStatus>(json);
      setConnectionStatus(data);
      if (data.connected) {
        toast.success("Connected to Snowflake!");
        loadSchemas();
      }
    } catch (error) {
      setConnectionStatus({
        connected: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
      toast.error("Failed to connect to Snowflake");
    } finally {
      setTesting(false);
    }
  };

  const loadSchemas = async () => {
    setLoading("schemas");
    try {
      const res = await fetch("/api/snowflake/schema?action=schemas");
      if (!res.ok) throw new Error("Failed to load schemas");
      const json = await res.json();
      const data = parseApiData<{ schemas: string[] }>(json);
      setSchemas(data.schemas || []);
    } catch (error) {
      toast.error("Failed to load schemas");
    } finally {
      setLoading(null);
    }
  };

  const loadTables = async (schema: string) => {
    setSelectedSchema(schema);
    setSelectedTable(null);
    setColumns([]);
    setPreviewData(null);
    setLoading("tables");
    try {
      const res = await fetch(`/api/snowflake/schema?action=tables&schema=${encodeURIComponent(schema)}`);
      if (!res.ok) throw new Error("Failed to load tables");
      const json = await res.json();
      const data = parseApiData<{ tables: TableInfo[] }>(json);
      setTables(data.tables || []);
    } catch (error) {
      toast.error("Failed to load tables");
    } finally {
      setLoading(null);
    }
  };

  const loadColumns = async (table: string) => {
    if (!selectedSchema) return;
    setSelectedTable(table);
    setPreviewData(null);
    setLoading("columns");
    try {
      const res = await fetch(
        `/api/snowflake/schema?action=columns&schema=${encodeURIComponent(selectedSchema)}&table=${encodeURIComponent(table)}`
      );
      if (!res.ok) throw new Error("Failed to load columns");
      const json = await res.json();
      const data = parseApiData<{ columns: ColumnInfo[] }>(json);
      setColumns(data.columns || []);
    } catch (error) {
      toast.error("Failed to load columns");
    } finally {
      setLoading(null);
    }
  };

  const loadPreview = async () => {
    if (!selectedSchema || !selectedTable) return;
    setLoading("preview");
    try {
      const res = await fetch(
        `/api/snowflake/schema?action=preview&schema=${encodeURIComponent(selectedSchema)}&table=${encodeURIComponent(selectedTable)}&limit=5`
      );
      if (!res.ok) throw new Error("Failed to load preview");
      const json = await res.json();
      const data = parseApiData<{ data: Record<string, unknown>[] }>(json);
      setPreviewData(data.data || []);
    } catch (error) {
      toast.error("Failed to load preview data");
    } finally {
      setLoading(null);
    }
  };

  // Test connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="mt-4 border border-blue-200 rounded-lg bg-blue-50 p-4">
      <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
        <Database className="h-4 w-4" />
        Snowflake Schema Explorer
      </h4>

      {/* Connection Status */}
      <div className="mb-4">
        <button
          onClick={() => toggleSection("connection")}
          className="flex items-center gap-2 text-sm font-medium text-blue-800"
        >
          {expandedSections.has("connection") ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Connection Status
        </button>
        {expandedSections.has("connection") && (
          <div className="mt-2 pl-6">
            <div className="flex items-center gap-2">
              {connectionStatus?.connected ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <X className="h-4 w-4 text-red-600" />
              )}
              <span className={connectionStatus?.connected ? "text-green-700" : "text-red-700"}>
                {connectionStatus?.message || "Not tested"}
              </span>
              <button
                onClick={testConnection}
                disabled={testing}
                className="ml-2 p-1 text-blue-600 hover:bg-blue-100 rounded"
                title="Test connection"
              >
                <RefreshCw className={`h-4 w-4 ${testing ? "animate-spin" : ""}`} />
              </button>
            </div>
            {connectionStatus?.details && (
              <div className="mt-2 text-xs text-blue-700 space-y-1">
                <div>Account: {connectionStatus.details.account}</div>
                <div>Warehouse: {connectionStatus.details.warehouse}</div>
                <div>Database: {connectionStatus.details.database}</div>
                <div>Schema: {connectionStatus.details.schema}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {connectionStatus?.connected && (
        <>
          {/* Schema Browser */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection("schemas")}
              className="flex items-center gap-2 text-sm font-medium text-blue-800"
            >
              {expandedSections.has("schemas") ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Browse Schemas
              {loading === "schemas" && <RefreshCw className="h-3 w-3 animate-spin" />}
            </button>
            {expandedSections.has("schemas") && (
              <div className="mt-2 pl-6">
                <div className="flex flex-wrap gap-2">
                  {schemas.map((schema) => (
                    <button
                      key={schema}
                      onClick={() => loadTables(schema)}
                      className={`px-3 py-1 text-sm rounded-md border ${
                        selectedSchema === schema
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-blue-700 border-blue-300 hover:bg-blue-100"
                      }`}
                    >
                      {schema}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tables */}
          {selectedSchema && (
            <div className="mb-4">
              <button
                onClick={() => toggleSection("tables")}
                className="flex items-center gap-2 text-sm font-medium text-blue-800"
              >
                {expandedSections.has("tables") ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Table className="h-4 w-4" />
                Tables in {selectedSchema}
                <span className="text-blue-600 font-normal">({tables.length})</span>
                {loading === "tables" && <RefreshCw className="h-3 w-3 animate-spin" />}
              </button>
              {expandedSections.has("tables") && (
                <div className="mt-2 pl-6 max-h-48 overflow-y-auto">
                  <div className="space-y-1">
                    {tables.map((table) => (
                      <button
                        key={table.tableName}
                        onClick={() => loadColumns(table.tableName)}
                        className={`w-full text-left px-3 py-1.5 text-sm rounded-md flex justify-between items-center ${
                          selectedTable === table.tableName
                            ? "bg-blue-600 text-white"
                            : "bg-white text-blue-700 hover:bg-blue-100"
                        }`}
                      >
                        <span>{table.tableName}</span>
                        {table.rowCount !== undefined && (
                          <span className="text-xs opacity-70">
                            {table.rowCount.toLocaleString()} rows
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Columns */}
          {selectedTable && (
            <div className="mb-4">
              <button
                onClick={() => toggleSection("columns")}
                className="flex items-center gap-2 text-sm font-medium text-blue-800"
              >
                {expandedSections.has("columns") ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Columns className="h-4 w-4" />
                Columns in {selectedTable}
                <span className="text-blue-600 font-normal">({columns.length})</span>
                {loading === "columns" && <RefreshCw className="h-3 w-3 animate-spin" />}
              </button>
              {expandedSections.has("columns") && (
                <div className="mt-2 pl-6">
                  <div className="bg-white rounded-md border border-blue-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-blue-800">Column</th>
                          <th className="px-3 py-2 text-left text-blue-800">Type</th>
                          <th className="px-3 py-2 text-left text-blue-800">Nullable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {columns.map((col, idx) => (
                          <tr key={col.columnName} className={idx % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                            <td className="px-3 py-1.5 font-mono text-blue-900">{col.columnName}</td>
                            <td className="px-3 py-1.5 text-gray-600">{col.dataType}</td>
                            <td className="px-3 py-1.5 text-gray-600">{col.isNullable ? "Yes" : "No"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={loadPreview}
                    disabled={loading === "preview"}
                    className="mt-2 flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Eye className="h-4 w-4" />
                    {loading === "preview" ? "Loading..." : "Preview Data"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Preview Data */}
          {previewData && previewData.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection("preview")}
                className="flex items-center gap-2 text-sm font-medium text-blue-800"
              >
                {expandedSections.has("preview") ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Eye className="h-4 w-4" />
                Data Preview
                <span className="text-blue-600 font-normal">({previewData.length} rows)</span>
              </button>
              {expandedSections.has("preview") && (
                <div className="mt-2 pl-6 overflow-x-auto">
                  <div className="bg-white rounded-md border border-blue-200 overflow-hidden">
                    <table className="text-xs">
                      <thead className="bg-blue-100">
                        <tr>
                          {Object.keys(previewData[0]).map((key) => (
                            <th key={key} className="px-3 py-2 text-left text-blue-800 whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                            {Object.values(row).map((val, colIdx) => (
                              <td key={colIdx} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-xs truncate">
                                {val === null ? (
                                  <span className="text-gray-400 italic">null</span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
