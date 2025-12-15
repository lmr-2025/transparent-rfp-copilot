'use client';

import { useState } from 'react';
import { SkillHistoryEntry } from '@/types/skill';

interface SkillHistoryViewerProps {
  history: SkillHistoryEntry[];
}

const styles = {
  container: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    margin: 0,
  },
  toggleBtn: {
    fontSize: '12px',
    color: '#64748b',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  timeline: {
    marginTop: '12px',
    paddingLeft: '12px',
    borderLeft: '2px solid #e2e8f0',
  },
  entry: {
    position: 'relative' as const,
    paddingLeft: '16px',
    paddingBottom: '12px',
    marginBottom: '8px',
  },
  dot: {
    position: 'absolute' as const,
    left: '-7px',
    top: '4px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '2px solid #fff',
  },
  date: {
    fontSize: '11px',
    color: '#94a3b8',
    marginBottom: '2px',
  },
  action: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'inline-block',
    marginRight: '6px',
  },
  summary: {
    fontSize: '13px',
    color: '#334155',
    marginTop: '4px',
    lineHeight: 1.4,
  },
  user: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: '12px',
    fontStyle: 'italic' as const,
    marginTop: '8px',
  },
};

const actionColors: Record<string, { bg: string; text: string; dot: string }> = {
  created: { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
  updated: { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
  refreshed: { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' },
  owner_added: { bg: '#fef9c3', text: '#854d0e', dot: '#eab308' },
  owner_removed: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
};

const actionLabels: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  refreshed: 'Refreshed',
  owner_added: 'Owner Added',
  owner_removed: 'Owner Removed',
};

export default function SkillHistoryViewer({ history }: SkillHistoryViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort history by date, most recent first
  const sortedHistory = [...(history || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div style={styles.container}>
      <div
        style={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls="skill-history-content"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <h4 style={styles.title}>
          Change History ({sortedHistory.length} {sortedHistory.length === 1 ? 'entry' : 'entries'})
        </h4>
        <span style={styles.toggleBtn} aria-hidden="true">
          {isExpanded ? 'Hide' : 'Show'}
        </span>
      </div>

      {isExpanded && (
        sortedHistory.length > 0 ? (
          <div id="skill-history-content" style={styles.timeline}>
            {sortedHistory.map((entry, idx) => {
              const colors = actionColors[entry.action] || actionColors.updated;
              return (
                <div key={idx} style={styles.entry}>
                  <div
                    style={{
                      ...styles.dot,
                      backgroundColor: colors.dot,
                    }}
                  />
                  <div style={styles.date}>
                    {new Date(entry.date).toLocaleString()}
                  </div>
                  <span
                    style={{
                      ...styles.action,
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                  >
                    {actionLabels[entry.action] || entry.action}
                  </span>
                  <div style={styles.summary}>{entry.summary}</div>
                  {entry.user && <div style={styles.user}>by {entry.user}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={styles.emptyText}>No history recorded</p>
        )
      )}
    </div>
  );
}
