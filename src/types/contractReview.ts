// Contract Review Types

export type ContractReviewStatus =
  | "PENDING"
  | "ANALYZING"
  | "ANALYZED"
  | "REVIEWED"
  | "ARCHIVED";

export type AlignmentRating =
  | "can_comply"      // We fully meet this requirement
  | "partial"         // We partially meet this, may need adjustments
  | "gap"             // We don't currently support this
  | "risk"            // This clause poses a risk to us
  | "info_only";      // Informational, no action needed

export type FindingCategory =
  | "data_protection"
  | "security_controls"
  | "certifications"
  | "incident_response"
  | "audit_rights"
  | "subprocessors"
  | "data_retention"
  | "insurance"
  | "liability"
  | "confidentiality"
  | "other";

export type ContractFinding = {
  id: string;
  category: FindingCategory;
  clauseText: string;           // The actual text from the contract
  rating: AlignmentRating;
  rationale: string;            // Why we rated it this way
  relevantSkills: string[];     // Skill IDs that informed this finding
  suggestedResponse?: string;   // How to respond or what to negotiate
  flagged: boolean;             // Manually flagged for attention
  notes?: string;               // Human notes
};

export type ContractReview = {
  id: string;
  name: string;
  filename: string;
  fileType: string;
  customerName?: string;
  contractType?: string;
  extractedText: string;
  status: ContractReviewStatus;
  overallRating?: "compliant" | "mostly_compliant" | "needs_review" | "high_risk";
  summary?: string;
  findings?: ContractFinding[];
  skillsUsed?: string[];
  createdAt: string;
  updatedAt: string;
  analyzedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
};

// For API responses
export type ContractReviewSummary = Pick<
  ContractReview,
  "id" | "name" | "filename" | "customerName" | "contractType" | "status" | "overallRating" | "createdAt" | "analyzedAt"
> & {
  findingsCount: number;
  riskCount: number;
  gapCount: number;
};
