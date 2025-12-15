'use client';

import { useState } from 'react';
import { SkillOwner } from '@/types/skill';

interface SkillOwnerEditorProps {
  owners: SkillOwner[];
  onOwnersChange: (owners: SkillOwner[]) => void;
  readOnly?: boolean;
}

const styles = {
  container: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#fefce8',
    borderRadius: '6px',
    border: '1px solid #fde047',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#854d0e',
    margin: 0,
  },
  ownerList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginBottom: '8px',
  },
  ownerPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '999px',
    backgroundColor: '#fef9c3',
    border: '1px solid #fde047',
    fontSize: '12px',
    color: '#713f12',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 2px',
    color: '#92400e',
    fontSize: '14px',
    lineHeight: 1,
  },
  addForm: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
    alignItems: 'flex-end',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  label: {
    fontSize: '11px',
    color: '#854d0e',
    fontWeight: 500,
  },
  input: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #fde047',
    fontSize: '13px',
    backgroundColor: '#fff',
  },
  addBtn: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#eab308',
    color: '#fff',
    fontWeight: 600,
    fontSize: '12px',
    cursor: 'pointer',
  },
  emptyText: {
    color: '#92400e',
    fontSize: '12px',
    fontStyle: 'italic' as const,
  },
};

export default function SkillOwnerEditor({
  owners,
  onOwnersChange,
  readOnly = false,
}: SkillOwnerEditorProps) {
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddOwner = () => {
    if (!newName.trim()) return;

    const newOwner: SkillOwner = {
      name: newName.trim(),
      email: newEmail.trim() || undefined,
    };

    // Don't add duplicates
    const exists = owners.some(
      o => o.name.toLowerCase() === newOwner.name.toLowerCase()
    );
    if (exists) return;

    onOwnersChange([...owners, newOwner]);
    setNewName('');
    setNewEmail('');
    setIsAdding(false);
  };

  const handleRemoveOwner = (index: number) => {
    const updated = owners.filter((_, i) => i !== index);
    onOwnersChange(updated);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>
          Skill Owners (SMEs) {owners.length > 0 && `(${owners.length})`}
        </h4>
        {!readOnly && !isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            style={{
              ...styles.addBtn,
              backgroundColor: 'transparent',
              color: '#854d0e',
              border: '1px solid #fde047',
            }}
          >
            + Add Owner
          </button>
        )}
      </div>

      {owners.length > 0 ? (
        <div style={styles.ownerList}>
          {owners.map((owner, idx) => (
            <span key={idx} style={styles.ownerPill}>
              <span>{owner.name}</span>
              {owner.email && (
                <a
                  href={`mailto:${owner.email}`}
                  style={{ color: '#92400e', textDecoration: 'none' }}
                  title={owner.email}
                >
                  ✉
                </a>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveOwner(idx)}
                  style={styles.removeBtn}
                  aria-label={`Remove ${owner.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p style={styles.emptyText}>No owners assigned</p>
      )}

      {isAdding && (
        <div style={styles.addForm}>
          <div style={styles.inputGroup}>
            <label htmlFor="owner-name-input" style={styles.label}>Name *</label>
            <input
              id="owner-name-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="John Doe"
              style={styles.input}
              maxLength={100}
            />
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="owner-email-input" style={styles.label}>Email (optional)</label>
            <input
              id="owner-email-input"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="john@example.com"
              style={styles.input}
              maxLength={200}
            />
          </div>
          <button
            type="button"
            onClick={handleAddOwner}
            disabled={!newName.trim()}
            style={{
              ...styles.addBtn,
              opacity: newName.trim() ? 1 : 0.5,
              cursor: newName.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewName('');
              setNewEmail('');
            }}
            style={{
              ...styles.addBtn,
              backgroundColor: 'transparent',
              color: '#854d0e',
              border: '1px solid #fde047',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
