"use client";

import { ExternalLink, FileText, Globe, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SourceUrl, SourceDocument, UnifiedLibraryItem } from "@/hooks/use-knowledge-data";

interface SkillSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: UnifiedLibraryItem;
}

export function SkillSourcesDialog({
  open,
  onOpenChange,
  item,
}: SkillSourcesDialogProps) {
  const sourceUrls = (item.sourceUrls || []) as SourceUrl[];
  const sourceDocuments = (item.sourceDocuments || []) as SourceDocument[];
  const hasNoSources = sourceUrls.length === 0 && sourceDocuments.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sources for &ldquo;{item.title}&rdquo;
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {hasNoSources ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No sources linked to this skill.</p>
              <p className="text-sm mt-2">This skill may have been created manually.</p>
            </div>
          ) : (
            <>
              {/* Source Documents */}
              {sourceDocuments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documents ({sourceDocuments.length})
                  </h4>
                  <ul className="space-y-2">
                    {sourceDocuments.map((doc, i) => (
                      <li
                        key={doc.id || i}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-sm">{doc.filename}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Source URLs */}
              {sourceUrls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    URLs ({sourceUrls.length})
                  </h4>
                  <ul className="space-y-2">
                    {sourceUrls.map((source, i) => (
                      <li
                        key={source.url || i}
                        className="p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium truncate max-w-[300px]"
                          >
                            <Globe className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{source.url}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Added: {new Date(source.addedAt).toLocaleDateString()}
                          </span>
                          {source.lastFetchedAt && (
                            <span className="flex items-center gap-1">
                              Last fetched: {new Date(source.lastFetchedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
