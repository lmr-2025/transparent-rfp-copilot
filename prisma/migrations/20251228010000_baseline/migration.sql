-- Reset schema for clean baseline (dev only)
DROP SCHEMA IF EXISTS "public" CASCADE;
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'PROMPT_ADMIN');

-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('ASK_QUESTIONS', 'CREATE_PROJECTS', 'REVIEW_ANSWERS', 'MANAGE_KNOWLEDGE', 'MANAGE_PROMPTS', 'VIEW_ORG_DATA', 'MANAGE_USERS', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'NEEDS_REVIEW', 'FINALIZED');

-- CreateEnum
CREATE TYPE "RowStatus" AS ENUM ('PENDING', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "RowReviewStatus" AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'CORRECTED');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InstructionShareStatus" AS ENUM ('PRIVATE', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractReviewStatus" AS ENUM ('PENDING', 'ANALYZING', 'ANALYZED', 'REVIEWED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('SKILL', 'CUSTOMER', 'PROJECT', 'DOCUMENT', 'REFERENCE_URL', 'CONTRACT', 'USER', 'SETTING', 'PROMPT', 'CONTEXT_SNIPPET', 'ANSWER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'VIEWED', 'EXPORTED', 'OWNER_ADDED', 'OWNER_REMOVED', 'STATUS_CHANGED', 'REFRESHED', 'MERGED', 'CORRECTED', 'APPROVED', 'REVIEW_REQUESTED', 'FLAG_RESOLVED', 'CLARIFY_USED');

-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('THUMBS_UP', 'THUMBS_DOWN');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('WRONG_SKILL_MATCHED', 'OUTDATED_KNOWLEDGE', 'MISSING_KNOWLEDGE', 'HALLUCINATION', 'INCOMPLETE_ANSWER', 'WRONG_TONE', 'TECHNICAL_ERROR', 'FORMATTING_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "CollateralStatus" AS ENUM ('DRAFT', 'GENERATED', 'EXPORTED', 'NEEDS_REVIEW', 'APPROVED', 'FINALIZED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "capabilities" "Capability"[] DEFAULT ARRAY['ASK_QUESTIONS']::"Capability"[],
    "manualCapabilities" "Capability"[] DEFAULT ARRAY[]::"Capability"[],
    "ssoGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "llmSpeedOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AuthGroupMapping" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT,
    "capabilities" "Capability"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthGroupMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "columns" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL,
    "ownerName" TEXT,
    "ownerId" TEXT,
    "assignedUsers" JSONB,
    "customerName" TEXT,
    "customerId" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "reviewRequestedAt" TIMESTAMP(3),
    "reviewRequestedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "BulkProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkRow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT '',
    "status" "RowStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "askedById" TEXT,
    "askedByName" TEXT,
    "askedByEmail" TEXT,
    "conversationHistory" JSONB,
    "confidence" TEXT,
    "sources" TEXT,
    "reasoning" TEXT,
    "inference" TEXT,
    "remarks" TEXT,
    "usedSkills" JSONB,
    "showRecommendation" BOOLEAN NOT NULL DEFAULT false,
    "clarifyConversation" JSONB,
    "originalResponse" TEXT,
    "originalConfidence" TEXT,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flaggedAt" TIMESTAMP(3),
    "flaggedBy" TEXT,
    "flagNote" TEXT,
    "flagResolved" BOOLEAN NOT NULL DEFAULT false,
    "flagResolvedAt" TIMESTAMP(3),
    "flagResolvedBy" TEXT,
    "flagResolutionNote" TEXT,
    "queuedForReview" BOOLEAN NOT NULL DEFAULT false,
    "queuedAt" TIMESTAMP(3),
    "queuedBy" TEXT,
    "queuedNote" TEXT,
    "queuedReviewerId" TEXT,
    "queuedReviewerName" TEXT,
    "reviewStatus" "RowReviewStatus" NOT NULL DEFAULT 'NONE',
    "reviewRequestedAt" TIMESTAMP(3),
    "reviewRequestedBy" TEXT,
    "reviewNote" TEXT,
    "assignedReviewerId" TEXT,
    "assignedReviewerName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "userEditedAnswer" TEXT,

    CONSTRAINT "BulkRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileData" BYTEA,
    "fileSize" INTEGER NOT NULL,
    "categories" TEXT[],
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateContent" TEXT,
    "ownerId" TEXT,
    "createdBy" TEXT,
    "isReferenceOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "salesforceId" TEXT,
    "region" TEXT,
    "tier" TEXT,
    "employeeCount" INTEGER,
    "annualRevenue" DOUBLE PRECISION,
    "accountType" TEXT,
    "billingLocation" TEXT,
    "lastSalesforceSync" TIMESTAMP(3),
    "content" TEXT,
    "considerations" TEXT[],
    "sourceDocuments" JSONB,
    "overview" TEXT NOT NULL,
    "products" TEXT,
    "challenges" TEXT,
    "keyFacts" JSONB,
    "sourceUrls" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "ownerId" TEXT,
    "owners" JSONB,
    "history" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT,
    "gitCommitSha" TEXT,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "docType" TEXT,

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSyncLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "gitCommitSha" TEXT,
    "syncedBy" TEXT,

    CONSTRAINT "CustomerSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCustomerProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categories" TEXT[],
    "quickFacts" JSONB,
    "edgeCases" TEXT[],
    "sourceUrls" JSONB,
    "sourceDocuments" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "ownerId" TEXT,
    "owners" JSONB,
    "history" JSONB,
    "requiresReview" BOOLEAN,
    "minApprovers" INTEGER,
    "approvers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SkillStatus" NOT NULL DEFAULT 'PUBLISHED',
    "draftContent" TEXT,
    "pendingReviewers" JSONB,
    "reviewRequestedAt" TIMESTAMP(3),
    "reviewRequestedBy" TEXT,
    "reviewComments" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT,
    "gitCommitSha" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'library',
    "tierOverrides" JSONB,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillSource" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SkillSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requiresReview" BOOLEAN,
    "minApprovers" INTEGER DEFAULT 1,
    "approvers" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "SkillCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillSyncLog" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "gitCommitSha" TEXT,
    "syncedBy" TEXT,

    CONSTRAINT "SkillSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemPrompt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptBlock" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 3,
    "variants" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT,
    "gitCommitSha" TEXT,

    CONSTRAINT "PromptBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptModifier" (
    "id" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 3,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT,
    "gitCommitSha" TEXT,

    CONSTRAINT "PromptModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptSyncLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "gitCommitSha" TEXT,
    "syncedBy" TEXT,
    "blockUuid" TEXT,
    "modifierUuid" TEXT,

    CONSTRAINT "PromptSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceUrl" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "categories" TEXT[],
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "createdBy" TEXT,
    "isReferenceOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReferenceUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedUrls" TEXT[],
    "categories" TEXT[],
    "status" "KnowledgeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedByEmail" TEXT,
    "requestedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedByEmail" TEXT,
    "reviewNote" TEXT,
    "skillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPrompt" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ChatPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructionPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "shareStatus" "InstructionShareStatus" NOT NULL DEFAULT 'PRIVATE',
    "shareRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdByEmail" TEXT,
    "defaultCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "InstructionPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextSnippet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ContextSnippet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPromptCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatPromptCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractReview" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "customerName" TEXT,
    "customerId" TEXT,
    "contractType" TEXT,
    "extractedText" TEXT NOT NULL,
    "status" "ContractReviewStatus" NOT NULL DEFAULT 'PENDING',
    "overallRating" TEXT,
    "summary" TEXT,
    "findings" JSONB,
    "skillsUsed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analyzedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "legalReviewerId" TEXT,
    "legalReviewerName" TEXT,
    "legalReviewedAt" TIMESTAMP(3),
    "legalReviewNotes" TEXT,
    "securityReviewerId" TEXT,
    "securityReviewerName" TEXT,
    "securityReviewedAt" TIMESTAMP(3),
    "securityReviewNotes" TEXT,
    "securityReviewRequested" BOOLEAN NOT NULL DEFAULT false,
    "securityReviewRequestedAt" TIMESTAMP(3),
    "securityReviewRequestedBy" TEXT,

    CONSTRAINT "ContractReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractFinding" (
    "id" TEXT NOT NULL,
    "contractReviewId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "clauseText" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "relevantSkills" JSONB,
    "suggestedResponse" TEXT,
    "isManuallyAdded" BOOLEAN NOT NULL DEFAULT false,
    "originalSuggestedResponse" TEXT,
    "originalRating" TEXT,
    "originalRationale" TEXT,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flaggedAt" TIMESTAMP(3),
    "flaggedBy" TEXT,
    "flagNote" TEXT,
    "flagResolved" BOOLEAN NOT NULL DEFAULT false,
    "flagResolvedAt" TIMESTAMP(3),
    "flagResolvedBy" TEXT,
    "flagResolutionNote" TEXT,
    "reviewStatus" "RowReviewStatus" NOT NULL DEFAULT 'NONE',
    "reviewRequestedAt" TIMESTAMP(3),
    "reviewRequestedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "userEditedResponse" TEXT,
    "assignedToSecurity" BOOLEAN NOT NULL DEFAULT false,
    "assignedToSecurityAt" TIMESTAMP(3),
    "assignedToSecurityBy" TEXT,
    "securityReviewNote" TEXT,
    "securityReviewedAt" TIMESTAMP(3),
    "securityReviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "question" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "confidence" TEXT,
    "sources" TEXT,
    "reasoning" TEXT,
    "inference" TEXT,
    "remarks" TEXT,
    "skillsUsed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flaggedAt" TIMESTAMP(3),
    "flaggedBy" TEXT,
    "flagNote" TEXT,
    "flagResolved" BOOLEAN NOT NULL DEFAULT false,
    "flagResolvedAt" TIMESTAMP(3),
    "flagResolvedBy" TEXT,
    "flagResolutionNote" TEXT,
    "reviewStatus" "RowReviewStatus" NOT NULL DEFAULT 'NONE',
    "reviewRequestedAt" TIMESTAMP(3),
    "reviewRequestedBy" TEXT,
    "reviewNote" TEXT,
    "assignedReviewerId" TEXT,
    "assignedReviewerName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "userEditedAnswer" TEXT,

    CONSTRAINT "QuestionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "title" TEXT,
    "messages" JSONB NOT NULL,
    "skillsUsed" JSONB,
    "documentsUsed" JSONB,
    "customersUsed" JSONB,
    "urlsUsed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityTitle" TEXT,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userName" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "feature" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "comment" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidence" TEXT,
    "skillsUsed" JSONB,
    "questionHistoryId" TEXT,
    "bulkRowId" TEXT,
    "chatSessionId" TEXT,
    "model" TEXT,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "outputFormat" TEXT NOT NULL DEFAULT 'markdown',
    "placeholderHint" TEXT,
    "placeholderMappings" JSONB,
    "instructionPresetId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT,
    "gitCommitSha" TEXT,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSyncLog" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "gitCommitSha" TEXT,
    "syncedBy" TEXT,

    CONSTRAINT "TemplateSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralOutput" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "templateName" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "filledContent" JSONB,
    "generatedMarkdown" TEXT,
    "googleSlidesId" TEXT,
    "googleSlidesUrl" TEXT,
    "status" "CollateralStatus" NOT NULL DEFAULT 'DRAFT',
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flaggedAt" TIMESTAMP(3),
    "flaggedBy" TEXT,
    "flagNote" TEXT,
    "flagResolved" BOOLEAN NOT NULL DEFAULT false,
    "flagResolvedAt" TIMESTAMP(3),
    "flagResolvedBy" TEXT,
    "flagResolutionNote" TEXT,
    "reviewStatus" "RowReviewStatus" NOT NULL DEFAULT 'NONE',
    "reviewRequestedAt" TIMESTAMP(3),
    "reviewRequestedBy" TEXT,
    "reviewNote" TEXT,
    "assignedReviewerId" TEXT,
    "assignedReviewerName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "queuedForReview" BOOLEAN NOT NULL DEFAULT false,
    "queuedAt" TIMESTAMP(3),
    "queuedBy" TEXT,
    "queuedNote" TEXT,
    "queuedReviewerId" TEXT,
    "queuedReviewerName" TEXT,
    "rating" "FeedbackRating",
    "feedbackComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "ownerId" TEXT,

    CONSTRAINT "CollateralOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatFeedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "rating" TEXT,
    "comment" TEXT,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flagNote" TEXT,
    "reviewRequested" BOOLEAN NOT NULL DEFAULT false,
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "reviewNote" TEXT,
    "sendNow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMTrace" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "parentTraceId" TEXT,
    "spanName" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptHash" TEXT,
    "promptSnapshot" TEXT,
    "userMessage" TEXT NOT NULL,
    "skillsProvided" JSONB,
    "response" TEXT NOT NULL,
    "confidence" TEXT,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "cacheCreationTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "userId" TEXT,
    "userEmail" TEXT,
    "questionHistoryId" TEXT,
    "bulkRowId" TEXT,
    "chatSessionId" TEXT,
    "contractFindingId" TEXT,
    "skillId" TEXT,
    "feedbackCategories" "FeedbackCategory"[] DEFAULT ARRAY[]::"FeedbackCategory"[],
    "feedbackNote" TEXT,
    "wasEdited" BOOLEAN NOT NULL DEFAULT false,
    "editDelta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "AuthGroupMapping_provider_idx" ON "AuthGroupMapping"("provider");

-- CreateIndex
CREATE INDEX "AuthGroupMapping_isActive_idx" ON "AuthGroupMapping"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuthGroupMapping_provider_groupId_key" ON "AuthGroupMapping"("provider", "groupId");

-- CreateIndex
CREATE INDEX "BulkProject_status_idx" ON "BulkProject"("status");

-- CreateIndex
CREATE INDEX "BulkProject_lastModifiedAt_idx" ON "BulkProject"("lastModifiedAt");

-- CreateIndex
CREATE INDEX "BulkProject_ownerId_idx" ON "BulkProject"("ownerId");

-- CreateIndex
CREATE INDEX "BulkProject_customerId_idx" ON "BulkProject"("customerId");

-- CreateIndex
CREATE INDEX "BulkRow_projectId_idx" ON "BulkRow"("projectId");

-- CreateIndex
CREATE INDEX "BulkRow_status_idx" ON "BulkRow"("status");

-- CreateIndex
CREATE INDEX "BulkRow_flaggedForReview_idx" ON "BulkRow"("flaggedForReview");

-- CreateIndex
CREATE INDEX "BulkRow_queuedForReview_idx" ON "BulkRow"("queuedForReview");

-- CreateIndex
CREATE INDEX "BulkRow_askedById_idx" ON "BulkRow"("askedById");

-- CreateIndex
CREATE INDEX "BulkRow_createdAt_idx" ON "BulkRow"("createdAt");

-- CreateIndex
CREATE INDEX "BulkRow_projectId_status_idx" ON "BulkRow"("projectId", "status");

-- CreateIndex
CREATE INDEX "BulkRow_reviewStatus_createdAt_idx" ON "BulkRow"("reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "BulkRow_flagResolved_flaggedForReview_idx" ON "BulkRow"("flagResolved", "flaggedForReview");

-- CreateIndex
CREATE UNIQUE INDEX "BulkRow_projectId_rowNumber_key" ON "BulkRow"("projectId", "rowNumber");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_categories_idx" ON "KnowledgeDocument" USING GIN ("categories");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_uploadedAt_idx" ON "KnowledgeDocument"("uploadedAt");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_isTemplate_idx" ON "KnowledgeDocument"("isTemplate");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_ownerId_idx" ON "KnowledgeDocument"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_salesforceId_key" ON "CustomerProfile"("salesforceId");

-- CreateIndex
CREATE INDEX "CustomerProfile_isActive_updatedAt_idx" ON "CustomerProfile"("isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "CustomerProfile_industry_idx" ON "CustomerProfile"("industry");

-- CreateIndex
CREATE INDEX "CustomerProfile_ownerId_idx" ON "CustomerProfile"("ownerId");

-- CreateIndex
CREATE INDEX "CustomerProfile_salesforceId_idx" ON "CustomerProfile"("salesforceId");

-- CreateIndex
CREATE INDEX "CustomerProfile_syncStatus_idx" ON "CustomerProfile"("syncStatus");

-- CreateIndex
CREATE INDEX "CustomerProfile_lastSyncedAt_idx" ON "CustomerProfile"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_name_key" ON "CustomerProfile"("name");

-- CreateIndex
CREATE INDEX "CustomerDocument_customerId_idx" ON "CustomerDocument"("customerId");

-- CreateIndex
CREATE INDEX "CustomerDocument_uploadedAt_idx" ON "CustomerDocument"("uploadedAt");

-- CreateIndex
CREATE INDEX "CustomerDocument_docType_idx" ON "CustomerDocument"("docType");

-- CreateIndex
CREATE INDEX "CustomerSyncLog_customerId_idx" ON "CustomerSyncLog"("customerId");

-- CreateIndex
CREATE INDEX "CustomerSyncLog_status_idx" ON "CustomerSyncLog"("status");

-- CreateIndex
CREATE INDEX "CustomerSyncLog_startedAt_idx" ON "CustomerSyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "CustomerSyncLog_direction_idx" ON "CustomerSyncLog"("direction");

-- CreateIndex
CREATE INDEX "ProjectCustomerProfile_projectId_idx" ON "ProjectCustomerProfile"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCustomerProfile_profileId_idx" ON "ProjectCustomerProfile"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCustomerProfile_projectId_profileId_key" ON "ProjectCustomerProfile"("projectId", "profileId");

-- CreateIndex
CREATE INDEX "Skill_isActive_updatedAt_idx" ON "Skill"("isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "Skill_ownerId_idx" ON "Skill"("ownerId");

-- CreateIndex
CREATE INDEX "Skill_status_idx" ON "Skill"("status");

-- CreateIndex
CREATE INDEX "Skill_reviewRequestedAt_idx" ON "Skill"("reviewRequestedAt");

-- CreateIndex
CREATE INDEX "Skill_syncStatus_idx" ON "Skill"("syncStatus");

-- CreateIndex
CREATE INDEX "Skill_lastSyncedAt_idx" ON "Skill"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "Skill_categories_idx" ON "Skill" USING GIN ("categories");

-- CreateIndex
CREATE INDEX "Skill_tier_isActive_idx" ON "Skill"("tier", "isActive");

-- CreateIndex
CREATE INDEX "Skill_tier_categories_idx" ON "Skill"("tier", "categories");

-- CreateIndex
CREATE INDEX "Skill_usageCount_idx" ON "Skill"("usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_title_key" ON "Skill"("title");

-- CreateIndex
CREATE INDEX "SkillSource_sourceId_sourceType_idx" ON "SkillSource"("sourceId", "sourceType");

-- CreateIndex
CREATE INDEX "SkillSource_skillId_idx" ON "SkillSource"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillSource_skillId_sourceId_sourceType_key" ON "SkillSource"("skillId", "sourceId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "SkillCategory_name_key" ON "SkillCategory"("name");

-- CreateIndex
CREATE INDEX "SkillCategory_sortOrder_idx" ON "SkillCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "SkillSyncLog_skillId_idx" ON "SkillSyncLog"("skillId");

-- CreateIndex
CREATE INDEX "SkillSyncLog_status_idx" ON "SkillSyncLog"("status");

-- CreateIndex
CREATE INDEX "SkillSyncLog_startedAt_idx" ON "SkillSyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "SkillSyncLog_direction_idx" ON "SkillSyncLog"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "SystemPrompt_key_key" ON "SystemPrompt"("key");

-- CreateIndex
CREATE INDEX "SystemPrompt_key_idx" ON "SystemPrompt"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PromptBlock_blockId_key" ON "PromptBlock"("blockId");

-- CreateIndex
CREATE INDEX "PromptBlock_blockId_idx" ON "PromptBlock"("blockId");

-- CreateIndex
CREATE INDEX "PromptBlock_syncStatus_idx" ON "PromptBlock"("syncStatus");

-- CreateIndex
CREATE INDEX "PromptBlock_lastSyncedAt_idx" ON "PromptBlock"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptModifier_modifierId_key" ON "PromptModifier"("modifierId");

-- CreateIndex
CREATE INDEX "PromptModifier_modifierId_idx" ON "PromptModifier"("modifierId");

-- CreateIndex
CREATE INDEX "PromptModifier_type_idx" ON "PromptModifier"("type");

-- CreateIndex
CREATE INDEX "PromptModifier_syncStatus_idx" ON "PromptModifier"("syncStatus");

-- CreateIndex
CREATE INDEX "PromptModifier_lastSyncedAt_idx" ON "PromptModifier"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "PromptSyncLog_entityType_entityId_idx" ON "PromptSyncLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "PromptSyncLog_status_idx" ON "PromptSyncLog"("status");

-- CreateIndex
CREATE INDEX "PromptSyncLog_startedAt_idx" ON "PromptSyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "PromptSyncLog_direction_idx" ON "PromptSyncLog"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceUrl_url_key" ON "ReferenceUrl"("url");

-- CreateIndex
CREATE INDEX "ReferenceUrl_categories_idx" ON "ReferenceUrl" USING GIN ("categories");

-- CreateIndex
CREATE INDEX "ReferenceUrl_addedAt_idx" ON "ReferenceUrl"("addedAt");

-- CreateIndex
CREATE INDEX "ReferenceUrl_ownerId_idx" ON "ReferenceUrl"("ownerId");

-- CreateIndex
CREATE INDEX "KnowledgeRequest_categories_idx" ON "KnowledgeRequest" USING GIN ("categories");

-- CreateIndex
CREATE INDEX "KnowledgeRequest_status_idx" ON "KnowledgeRequest"("status");

-- CreateIndex
CREATE INDEX "KnowledgeRequest_requestedById_idx" ON "KnowledgeRequest"("requestedById");

-- CreateIndex
CREATE INDEX "KnowledgeRequest_createdAt_idx" ON "KnowledgeRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ChatPrompt_category_idx" ON "ChatPrompt"("category");

-- CreateIndex
CREATE INDEX "ChatPrompt_isBuiltin_idx" ON "ChatPrompt"("isBuiltin");

-- CreateIndex
CREATE INDEX "InstructionPreset_defaultCategories_idx" ON "InstructionPreset" USING GIN ("defaultCategories");

-- CreateIndex
CREATE INDEX "InstructionPreset_isShared_idx" ON "InstructionPreset"("isShared");

-- CreateIndex
CREATE INDEX "InstructionPreset_shareStatus_idx" ON "InstructionPreset"("shareStatus");

-- CreateIndex
CREATE INDEX "InstructionPreset_createdBy_idx" ON "InstructionPreset"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "ContextSnippet_key_key" ON "ContextSnippet"("key");

-- CreateIndex
CREATE INDEX "ContextSnippet_category_idx" ON "ContextSnippet"("category");

-- CreateIndex
CREATE INDEX "ContextSnippet_isActive_idx" ON "ContextSnippet"("isActive");

-- CreateIndex
CREATE INDEX "ContextSnippet_key_idx" ON "ContextSnippet"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ChatPromptCategory_name_key" ON "ChatPromptCategory"("name");

-- CreateIndex
CREATE INDEX "ChatPromptCategory_sortOrder_idx" ON "ChatPromptCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "ContractReview_status_idx" ON "ContractReview"("status");

-- CreateIndex
CREATE INDEX "ContractReview_createdAt_idx" ON "ContractReview"("createdAt");

-- CreateIndex
CREATE INDEX "ContractReview_customerName_idx" ON "ContractReview"("customerName");

-- CreateIndex
CREATE INDEX "ContractReview_customerId_idx" ON "ContractReview"("customerId");

-- CreateIndex
CREATE INDEX "ContractReview_ownerId_idx" ON "ContractReview"("ownerId");

-- CreateIndex
CREATE INDEX "ContractFinding_contractReviewId_idx" ON "ContractFinding"("contractReviewId");

-- CreateIndex
CREATE INDEX "ContractFinding_flaggedForReview_idx" ON "ContractFinding"("flaggedForReview");

-- CreateIndex
CREATE INDEX "ContractFinding_reviewStatus_idx" ON "ContractFinding"("reviewStatus");

-- CreateIndex
CREATE INDEX "ContractFinding_rating_idx" ON "ContractFinding"("rating");

-- CreateIndex
CREATE INDEX "QuestionHistory_userId_createdAt_idx" ON "QuestionHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionHistory_createdAt_idx" ON "QuestionHistory"("createdAt");

-- CreateIndex
CREATE INDEX "QuestionHistory_flaggedForReview_idx" ON "QuestionHistory"("flaggedForReview");

-- CreateIndex
CREATE INDEX "QuestionHistory_reviewStatus_createdAt_idx" ON "QuestionHistory"("reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionHistory_flagResolved_flaggedForReview_idx" ON "QuestionHistory"("flagResolved", "flaggedForReview");

-- CreateIndex
CREATE INDEX "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatSession_createdAt_idx" ON "ChatSession"("createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_userId_createdAt_idx" ON "ApiUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_feature_createdAt_idx" ON "ApiUsage"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsage_createdAt_idx" ON "ApiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_createdAt_idx" ON "AuditLog"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AnswerFeedback_feature_createdAt_idx" ON "AnswerFeedback"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AnswerFeedback_rating_createdAt_idx" ON "AnswerFeedback"("rating", "createdAt");

-- CreateIndex
CREATE INDEX "AnswerFeedback_userId_createdAt_idx" ON "AnswerFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnswerFeedback_createdAt_idx" ON "AnswerFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "Template_category_idx" ON "Template"("category");

-- CreateIndex
CREATE INDEX "Template_isActive_idx" ON "Template"("isActive");

-- CreateIndex
CREATE INDEX "Template_sortOrder_idx" ON "Template"("sortOrder");

-- CreateIndex
CREATE INDEX "Template_instructionPresetId_idx" ON "Template"("instructionPresetId");

-- CreateIndex
CREATE INDEX "Template_syncStatus_idx" ON "Template"("syncStatus");

-- CreateIndex
CREATE INDEX "Template_lastSyncedAt_idx" ON "Template"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "TemplateSyncLog_templateId_idx" ON "TemplateSyncLog"("templateId");

-- CreateIndex
CREATE INDEX "TemplateSyncLog_status_idx" ON "TemplateSyncLog"("status");

-- CreateIndex
CREATE INDEX "TemplateSyncLog_startedAt_idx" ON "TemplateSyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "TemplateSyncLog_direction_idx" ON "TemplateSyncLog"("direction");

-- CreateIndex
CREATE INDEX "CollateralOutput_status_idx" ON "CollateralOutput"("status");

-- CreateIndex
CREATE INDEX "CollateralOutput_customerId_idx" ON "CollateralOutput"("customerId");

-- CreateIndex
CREATE INDEX "CollateralOutput_templateId_idx" ON "CollateralOutput"("templateId");

-- CreateIndex
CREATE INDEX "CollateralOutput_ownerId_idx" ON "CollateralOutput"("ownerId");

-- CreateIndex
CREATE INDEX "CollateralOutput_flaggedForReview_idx" ON "CollateralOutput"("flaggedForReview");

-- CreateIndex
CREATE INDEX "CollateralOutput_reviewStatus_idx" ON "CollateralOutput"("reviewStatus");

-- CreateIndex
CREATE INDEX "CollateralOutput_queuedForReview_idx" ON "CollateralOutput"("queuedForReview");

-- CreateIndex
CREATE INDEX "CollateralOutput_createdAt_idx" ON "CollateralOutput"("createdAt");

-- CreateIndex
CREATE INDEX "CollateralOutput_ownerId_status_idx" ON "CollateralOutput"("ownerId", "status");

-- CreateIndex
CREATE INDEX "CollateralOutput_ownerId_createdAt_idx" ON "CollateralOutput"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatFeedback_userId_idx" ON "ChatFeedback"("userId");

-- CreateIndex
CREATE INDEX "ChatFeedback_orgId_idx" ON "ChatFeedback"("orgId");

-- CreateIndex
CREATE INDEX "ChatFeedback_sessionId_idx" ON "ChatFeedback"("sessionId");

-- CreateIndex
CREATE INDEX "ChatFeedback_flaggedForReview_idx" ON "ChatFeedback"("flaggedForReview");

-- CreateIndex
CREATE INDEX "ChatFeedback_reviewRequested_idx" ON "ChatFeedback"("reviewRequested");

-- CreateIndex
CREATE INDEX "ChatFeedback_createdAt_idx" ON "ChatFeedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatFeedback_messageId_sessionId_key" ON "ChatFeedback"("messageId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LLMTrace_traceId_key" ON "LLMTrace"("traceId");

-- CreateIndex
CREATE INDEX "LLMTrace_traceId_idx" ON "LLMTrace"("traceId");

-- CreateIndex
CREATE INDEX "LLMTrace_parentTraceId_idx" ON "LLMTrace"("parentTraceId");

-- CreateIndex
CREATE INDEX "LLMTrace_feature_createdAt_idx" ON "LLMTrace"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "LLMTrace_userId_createdAt_idx" ON "LLMTrace"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LLMTrace_model_createdAt_idx" ON "LLMTrace"("model", "createdAt");

-- CreateIndex
CREATE INDEX "LLMTrace_wasEdited_createdAt_idx" ON "LLMTrace"("wasEdited", "createdAt");

-- CreateIndex
CREATE INDEX "LLMTrace_createdAt_idx" ON "LLMTrace"("createdAt");

-- CreateIndex
CREATE INDEX "LLMTrace_feature_wasEdited_idx" ON "LLMTrace"("feature", "wasEdited");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkProject" ADD CONSTRAINT "BulkProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkProject" ADD CONSTRAINT "BulkProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkRow" ADD CONSTRAINT "BulkRow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BulkProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSyncLog" ADD CONSTRAINT "CustomerSyncLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCustomerProfile" ADD CONSTRAINT "ProjectCustomerProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BulkProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCustomerProfile" ADD CONSTRAINT "ProjectCustomerProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillSource" ADD CONSTRAINT "SkillSource_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillSyncLog" ADD CONSTRAINT "SkillSyncLog_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptSyncLog" ADD CONSTRAINT "PromptSyncLog_blockUuid_fkey" FOREIGN KEY ("blockUuid") REFERENCES "PromptBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptSyncLog" ADD CONSTRAINT "PromptSyncLog_modifierUuid_fkey" FOREIGN KEY ("modifierUuid") REFERENCES "PromptModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceUrl" ADD CONSTRAINT "ReferenceUrl_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRequest" ADD CONSTRAINT "KnowledgeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractReview" ADD CONSTRAINT "ContractReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractFinding" ADD CONSTRAINT "ContractFinding_contractReviewId_fkey" FOREIGN KEY ("contractReviewId") REFERENCES "ContractReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionHistory" ADD CONSTRAINT "QuestionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerFeedback" ADD CONSTRAINT "AnswerFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSyncLog" ADD CONSTRAINT "TemplateSyncLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralOutput" ADD CONSTRAINT "CollateralOutput_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralOutput" ADD CONSTRAINT "CollateralOutput_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
