"use client";

import { ChangeEvent } from "react";
import { User, styles } from "./types";

type ProjectMetadataCardProps = {
  projectName: string;
  customerName: string;
  selectedOwnerId: string;
  users: User[];
  currentUserId?: string;
  detectedRows: number;
  isParsing: boolean;
  onProjectNameChange: (value: string) => void;
  onCustomerNameChange: (value: string) => void;
  onOwnerIdChange: (value: string) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function ProjectMetadataCard({
  projectName,
  customerName,
  selectedOwnerId,
  users,
  currentUserId,
  detectedRows,
  isParsing,
  onProjectNameChange,
  onCustomerNameChange,
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

      <label style={styles.label} htmlFor="customerName">
        Customer Name (optional)
      </label>
      <input
        id="customerName"
        type="text"
        value={customerName}
        onChange={(event) => onCustomerNameChange(event.target.value)}
        style={styles.input}
        placeholder="e.g. Acme Corp"
      />

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
