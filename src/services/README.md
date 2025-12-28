# Service Layer

This directory contains the business logic layer for the Transparent Trust application. Services provide a clean separation between API routes and data access, making the codebase more testable, maintainable, and scalable.

## Architecture

```
API Routes (src/app/api/*)
    ↓
Service Layer (src/services/*)
    ↓
Data Access (Prisma/Database)
```

## Benefits

1. **Testability**: Services can be tested independently without HTTP overhead
2. **Reusability**: Business logic can be shared across multiple API routes
3. **Maintainability**: Changes to business logic are centralized
4. **Scalability**: Easier to optimize and refactor as the app grows
5. **Type Safety**: Full TypeScript support with proper types

## Available Services

### Skills Service (`skills.service.ts`)

Manages skill CRUD operations, search, and refresh from source URLs.

```typescript
import { getAllSkills, createSkill, refreshSkillFromSources } from '@/services';

// Get all skills
const skills = await getAllSkills();

// Get only active skills
const activeSkills = await getActiveSkills();

// Create a new skill
const newSkill = await createSkill({
  title: 'Customer Onboarding Process',
  content: 'Our onboarding process includes...',
  categories: ['Sales', 'Customer Success'],
  tier: 'core',
});

// Refresh skill from source URLs
const refreshResult = await refreshSkillFromSources(skillId);
if (refreshResult.hasChanges) {
  // Present draft to user for approval
  await applyRefreshChanges(skillId, refreshResult.draft);
}

// Search skills
const results = await searchSkills('onboarding', {
  activeOnly: true,
  categories: ['Sales'],
  limit: 10,
});
```

**Key Functions:**
- `getAllSkills()` - Fetch all skills
- `getActiveSkills()` - Fetch only active skills
- `getSkillById(id)` - Get single skill
- `createSkill(data)` - Create new skill
- `updateSkill(id, updates)` - Update skill
- `deleteSkill(id)` - Delete skill
- `refreshSkillFromSources(id)` - AI-powered refresh from URLs
- `applyRefreshChanges(id, changes)` - Apply refresh updates
- `searchSkills(query, options)` - Search with filters

### Categories Service (`categories.service.ts`)

Manages categories and their relationships with knowledge items.

```typescript
import { getAllCategories, getCategoryStats, mergeCategories } from '@/services';

// Get all categories
const categories = await getAllCategories();

// Get usage statistics
const stats = await getCategoryStats();
// Returns: [{ name: 'Sales', color: '#3b82f6', skillCount: 12, documentCount: 5, urlCount: 3 }]

// Get all items in a category
const items = await getItemsByCategory('Sales');
// Returns: { skills: [...], documents: [...], urls: [...] }

// Merge two categories
await mergeCategories('Old Category', 'New Category');
// All items from 'Old Category' are moved to 'New Category', then 'Old Category' is deleted
```

**Key Functions:**
- `getAllCategories()` - Fetch all categories
- `getCategoryByName(name)` - Get single category
- `createCategory(data)` - Create new category
- `updateCategory(name, updates)` - Update category
- `deleteCategory(name)` - Delete category
- `getCategoryStats()` - Usage statistics per category
- `getItemsByCategory(name)` - All items in a category
- `mergeCategories(source, target)` - Merge two categories

### Documents Service (`documents.service.ts`)

Manages knowledge documents and their metadata.

```typescript
import { getAllDocuments, getDocumentUsageStats, searchDocuments } from '@/services';

// Get all documents
const documents = await getAllDocuments();

// Get by category
const salesDocs = await getDocumentsByCategory('Sales');

// Create a document
const newDoc = await createDocument({
  title: 'Product Overview 2024',
  filename: 'product-overview-2024.pdf',
  content: 'Extracted PDF content...',
  categories: ['Product', 'Marketing'],
  fileSize: 1024000,
  fileType: 'pdf',
});

// Get usage statistics (which skills reference this doc)
const usage = await getDocumentUsageStats(docId);
// Returns: { skillCount: 3, skills: [{ id: '...', title: 'Skill 1' }] }

// Search documents
const results = await searchDocuments('product roadmap', {
  categories: ['Product'],
  limit: 5,
});

// Get uncategorized documents
const uncategorized = await getUncategorizedDocuments();

// Get statistics
const stats = await getDocumentStats();
// Returns: { total: 45, byFileType: { pdf: 20, docx: 15 }, totalSize: 50000000, averageSize: 1111111 }
```

**Key Functions:**
- `getAllDocuments()` - Fetch all documents
- `getDocumentById(id)` - Get single document
- `getDocumentsByCategory(category)` - Filter by category
- `createDocument(data)` - Create new document
- `updateDocument(id, updates)` - Update document
- `deleteDocument(id)` - Delete document
- `searchDocuments(query, options)` - Search with filters
- `getDocumentUsageStats(id)` - Which skills reference this
- `bulkUpdateDocumentCategories(ids, categories)` - Bulk update
- `getUncategorizedDocuments()` - Find uncategorized docs
- `getDocumentStats()` - Overall statistics

### Customer Profiles Service (`customer-profiles.service.ts`)

Manages customer profiles and their associated documents.

```typescript
import {
  getAllCustomerProfiles,
  getCustomerProfileWithDocuments,
  addCustomerDocument,
  migrateLegacyProfile,
} from '@/services';

// Get all profiles
const profiles = await getAllCustomerProfiles();

// Get only active profiles
const activeProfiles = await getActiveCustomerProfiles();

// Create a profile
const newProfile = await createCustomerProfile({
  name: 'Acme Corp',
  industry: 'Technology',
  content: `## Overview\nAcme is a leading provider of...`,
  considerations: ['Focus on ROI', 'Technical buyer'],
  isActive: true,
});

// Get profile with documents
const profileData = await getCustomerProfileWithDocuments(profileId);
// Returns: { profile: {...}, documents: [{id, title, content, docType}] }

// Add a document to profile
await addCustomerDocument({
  customerId: profileId,
  title: 'Q4 2024 Business Review',
  content: 'Key takeaways from the meeting...',
  docType: 'meeting-notes',
});

// Search profiles
const results = await searchCustomerProfiles('acme', {
  activeOnly: true,
  limit: 5,
});

// Get statistics
const stats = await getCustomerProfileStats();
// Returns: { total: 30, active: 25, inactive: 5, byIndustry: {...}, withDocuments: 15 }

// Migrate legacy profile to unified content format
await migrateLegacyProfile(profileId);

// Bulk migrate all profiles
const migrationResult = await bulkMigrateLegacyProfiles();
// Returns: { migrated: 10, skipped: 5, errors: 0 }
```

**Key Functions:**
- `getAllCustomerProfiles()` - Fetch all profiles
- `getActiveCustomerProfiles()` - Fetch only active profiles
- `getCustomerProfileById(id)` - Get single profile
- `createCustomerProfile(data)` - Create new profile
- `updateCustomerProfile(id, updates)` - Update profile
- `deleteCustomerProfile(id)` - Delete profile
- `searchCustomerProfiles(query, options)` - Search with filters
- `getCustomerProfileWithDocuments(id)` - Profile + documents
- `addCustomerDocument(data)` - Add document to profile
- `deleteCustomerDocument(id)` - Remove document
- `getCustomerProfileStats()` - Overall statistics
- `migrateLegacyProfile(id)` - Migrate to unified format
- `bulkMigrateLegacyProfiles()` - Bulk migration

### Knowledge Chat Service (`knowledge-chat.service.ts`)

Handles complex knowledge chat operations with AI.

```typescript
import { processKnowledgeChat } from '@/services';

const response = await processKnowledgeChat({
  message: 'How do we handle enterprise customers?',
  skills: selectedSkills,
  customerProfiles: [acmeProfile],
  documentIds: ['doc1', 'doc2'],
  referenceUrls: [{ id: 'url1', url: 'https://...', title: 'Reference' }],
  conversationHistory: previousMessages,
  userInstructions: 'Be concise and focus on practical advice',
  quickMode: false,
  callMode: false,
});

// Response includes:
// - response: AI-generated answer
// - skillsUsed: Which skills were referenced
// - customersUsed: Which customer profiles were used
// - documentsUsed: Which documents were included
// - urlsUsed: Which URLs were referenced
// - contextTruncated: Whether context was truncated
// - transparency: Full prompt details for debugging
```

**Key Function:**
- `processKnowledgeChat(request)` - Process AI chat with knowledge context

## Usage in API Routes

### Before (Direct Database Access)

```typescript
// src/app/api/skills/route.ts
export async function GET() {
  const skills = await prisma.skill.findMany({
    orderBy: { updatedAt: 'desc' },
  });

  return Response.json({
    skills: skills.map(skill => ({
      ...skill,
      categories: skill.categories as string[],
      // ... lots of type casting
    }))
  });
}
```

### After (Using Service Layer)

```typescript
// src/app/api/skills/route.ts
import { getAllSkills } from '@/services';

export async function GET() {
  const skills = await getAllSkills();
  return Response.json({ skills });
}
```

Much cleaner! The type casting and business logic are handled in the service.

## Testing

Services can be tested independently:

```typescript
// __tests__/services/skills.test.ts
import { createSkill, getSkillById } from '@/services';

describe('Skills Service', () => {
  it('should create and retrieve a skill', async () => {
    const newSkill = await createSkill({
      title: 'Test Skill',
      content: 'Test content',
    });

    const retrieved = await getSkillById(newSkill.id);
    expect(retrieved?.title).toBe('Test Skill');
  });
});
```

## Performance Considerations

### Smart Truncation

The knowledge chat service uses smart truncation to prioritize the most relevant content:

```typescript
// Automatically scores and ranks content by relevance
const truncatedSkills = smartTruncate(message, skillItems, CONTEXT_LIMITS.skills, {
  topKFullContent: 10,    // Top 10 most relevant with full content
  nextKSummaries: 10,     // Next 10 with AI-generated summaries
});
```

### Parallel Queries

Services use `Promise.all()` for parallel database queries:

```typescript
const [categories, skills, documents] = await Promise.all([
  getAllCategories(),
  getAllSkills(),
  getAllDocuments(),
]);
```

## Error Handling

Services throw errors that should be caught in API routes:

```typescript
// Service throws error
export async function getSkillById(id: string): Promise<Skill | null> {
  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) return null;  // Return null for not found
  return transformSkill(skill);
}

// API route handles error
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const skill = await getSkillById(params.id);
    if (!skill) {
      return Response.json({ error: 'Skill not found' }, { status: 404 });
    }
    return Response.json({ skill });
  } catch (error) {
    console.error('Error fetching skill:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## Migration Guide

To migrate existing API routes to use services:

1. **Identify business logic** in the route
2. **Move logic to service** function
3. **Update route** to call service
4. **Remove duplicate** type casting code
5. **Test** the endpoint

Example migration:

```typescript
// BEFORE: src/app/api/skills/[id]/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const skill = await prisma.skill.findUnique({
    where: { id: params.id },
  });

  if (!skill) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({
    skill: {
      ...skill,
      categories: skill.categories as string[],
      tier: skill.tier as 'core' | 'extended' | 'library',
      // ... more type casting
    }
  });
}

// AFTER: src/app/api/skills/[id]/route.ts
import { getSkillById } from '@/services';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const skill = await getSkillById(params.id);

  if (!skill) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({ skill });
}
```

## Future Enhancements

Potential additions to the service layer:

1. **Caching Layer** - Add Redis caching to frequently accessed data
2. **Batch Operations** - Bulk create/update operations for performance
3. **Webhooks Service** - Handle external integrations
4. **Analytics Service** - Track usage and generate insights
5. **Export Service** - Handle data exports in various formats
6. **Import Service** - Bulk import from CSV, JSON, etc.
7. **Validation Service** - Centralized data validation rules
8. **Notification Service** - Email, Slack, etc. notifications

## Best Practices

1. **Keep services focused** - Each service should handle one domain
2. **Use transactions** - For operations that modify multiple tables
3. **Return typed data** - Always return properly typed objects
4. **Document functions** - Use JSDoc comments for public functions
5. **Handle errors gracefully** - Return null for not found, throw for errors
6. **Avoid side effects** - Services should be pure functions when possible
7. **Use dependency injection** - For easier testing with mocks

## Contributing

When adding new services:

1. Create a new file: `src/services/your-domain.service.ts`
2. Export functions from `src/services/index.ts`
3. Add documentation to this README
4. Write tests in `__tests__/services/`
5. Update API routes to use the new service

---

**Last Updated:** 2024-12-28
**Maintainer:** Development Team
