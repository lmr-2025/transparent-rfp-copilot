"use client";

import { ChangeEvent } from "react";
import Link from "next/link";
import { User, CustomerOption, styles } from "./types";

type ProjectMetadataCardProps = {
  projectName: string;
  customerId: string;
  selectedOwnerId: string;
  users: User[];
  customers: CustomerOption[];
  customersLoading: boolean;
  currentUserId?: string;
  detectedRows: number;
  isParsing: boolean;
  onProjectNameChange: (value: string) => void;
  onCustomerIdChange: (value: string) => void;
  onOwnerIdChange: (value: string) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function ProjectMetadataCard({
  projectName,
  customerId,
  selectedOwnerId,
  users,
  customers,
  customersLoading,
  currentUserId,
  detectedRows,
  isParsing,
  onProjectNameChange,
  onCustomerIdChange,
  onOwnerIdChange,
  onFileUpload,
}: ProjectMetadataCardProps) {
  return (
    <div style={styles.card}>
      <label style={styles.label} htmlFor="ownerId">
        Project Owner
      </label>
      <select
        id="ownerId"
        value={selectedOwnerId}
        onChange={(event) => onOwnerIdChange(event.target.value)}
        style={styles.input}
      >
        {users.length === 0 && (
          <option value="">Loading users...</option>
        )}
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name || user.email || "Unknown user"}
            {user.id === currentUserId ? " (you)" : ""}
          </option>
        ))}
      </select>
      <p style={{ color: "#64748b", fontSize: "13px", marginTop: "-8px" }}>
        The owner can edit this project and will receive review notifications.
      </p>

      <label style={styles.label} htmlFor="customerId">
        Customer (optional)
      </label>
      <select
        id="customerId"
        value={customerId}
        onChange={(event) => onCustomerIdChange(event.target.value)}
        style={styles.input}
        disabled={customersLoading}
      >
        <option value="">{customersLoading ? "Loading customers..." : "Select customer"}</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </select>
      {customers.length === 0 && !customersLoading && (
        <p style={{ color: "#64748b", fontSize: "13px", marginTop: "-8px", marginBottom: "12px" }}>
          No customer profiles yet.{" "}
          <Link href="/customers" style={{ color: "#3b82f6" }}>
            Create one
          </Link>
        </p>
      )}

      <label style={styles.label} htmlFor="projectName">
        Project name
      </label>
      <input
        id="projectName"
        type="text"
        value={projectName}
        onChange={(event) => onProjectNameChange(event.target.value)}
        style={styles.input}
        placeholder="e.g. Vendor Security Questionnaire - Q1"
      />

      <label style={styles.label}>Upload CSV or Excel</label>
      <input
        type="file"
        accept=".csv,.xls,.xlsx"
        onChange={onFileUpload}
        disabled={isParsing}
        style={{ marginBottom: "8px" }}
      />
      {isParsing && <p style={{ color: "#0f172a" }}>Parsing file...</p>}
      {detectedRows > 0 && !isParsing && (
        <p style={{ color: "#0f172a" }}>
          Detected <strong>{detectedRows}</strong> data rows in this worksheet.
        </p>
      )}
    </div>
  );
}
