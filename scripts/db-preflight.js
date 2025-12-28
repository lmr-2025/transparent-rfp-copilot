// Quick preflight checks before applying DB hardening migrations.
// - Looks for duplicate Skill titles and CustomerProfile names (case-insensitive)
// - Looks for null ownerId across core domain tables
// Exits non-zero if findings are present.

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const missingTables = new Set()
const missingColumns = new Set()

function isMissingTableError(err) {
  return err?.code === 'P2010' && err?.meta?.code === '42P01'
}

function isMissingColumnError(err) {
  return err?.code === 'P2010' && err?.meta?.code === '42703'
}

async function safeQuery(label, fn) {
  try {
    return await fn()
  } catch (err) {
    if (isMissingTableError(err)) {
      missingTables.push(label)
      return []
    }
    throw err
  }
}

async function findDuplicateTitles() {
  return safeQuery('Skill', () =>
    prisma.$queryRaw`
      SELECT lower("title") AS normalized, count(*)::int AS count
      FROM "Skill"
      GROUP BY lower("title")
      HAVING count(*) > 1
    `,
  )
}

async function findDuplicateCustomers() {
  return safeQuery('CustomerProfile', () =>
    prisma.$queryRaw`
      SELECT lower("name") AS normalized, count(*)::int AS count
      FROM "CustomerProfile"
      GROUP BY lower("name")
      HAVING count(*) > 1
    `,
  )
}

async function findNullOwners() {
  const columnExists = async (table, column) => {
    const [row] = await prisma.$queryRawUnsafe(
      `
        SELECT COUNT(*)::int AS count
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      `,
      table,
      column,
    )
    return (row?.count ?? 0) > 0
  }

  const tables = [
    { table: 'Skill', column: 'ownerId' },
    { table: 'CustomerProfile', column: 'ownerId' },
    { table: 'KnowledgeDocument', column: 'ownerId' },
    { table: 'BulkProject', column: 'ownerId' },
    { table: 'Template', column: 'ownerId' },
    { table: 'CollateralOutput', column: 'ownerId' },
    { table: 'ContractReview', column: 'ownerId' },
  ]

  const results = []
  for (const { table, column } of tables) {
    try {
      // Skip if table or column is missing
      const exists = await columnExists(table, column)
      if (!exists) {
        missingColumns.add(`${table}.${column}`)
        continue
      }

      const [row] = await prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS count FROM "${table}" WHERE "${column}" IS NULL`,
      )
      results.push({ table, nullCount: row?.count ?? 0 })
    } catch (err) {
      if (isMissingTableError(err)) {
        missingTables.add(table)
        continue
      }
      if (isMissingColumnError(err)) {
        missingColumns.add(`${table}.${column}`)
        continue
      }
      throw err
    }
  }

  return results.filter((row) => row.nullCount > 0)
}

async function main() {
  const findings = []
  const warnings = []

  const [skillDupes, customerDupes, nullOwners] = await Promise.all([
    findDuplicateTitles(),
    findDuplicateCustomers(),
    findNullOwners(),
  ])

  if (skillDupes.length) {
    findings.push(
      `Duplicate Skill titles (case-insensitive): ${skillDupes
        .map((d) => `${d.normalized} (${d.count})`)
        .join(', ')}`,
    )
  }

  if (customerDupes.length) {
    findings.push(
      `Duplicate CustomerProfile names (case-insensitive): ${customerDupes
        .map((d) => `${d.normalized} (${d.count})`)
        .join(', ')}`,
    )
  }

  if (nullOwners.length) {
    findings.push(
      `Null owners found: ${nullOwners
        .map((row) => `${row.table}=${row.nullCount}`)
        .join(', ')}`,
    )
  }

  if (missingTables.length) {
    warnings.push(
      `Tables missing (migrations not applied?): ${Array.from(missingTables).join(', ')}`,
    )
  }

  if (missingColumns.size) {
    warnings.push(
      `Columns missing (migrations not applied?): ${Array.from(missingColumns).join(', ')}`,
    )
  }

  if (!findings.length) {
    warnings.push('No blockers found.')
  }

  warnings.push('Run this before applying the new constraints/indexes.')

  if (findings.length) {
    console.error('DB hardening preflight found issues:')
    for (const line of findings) console.error(`- ${line}`)
    for (const line of warnings) console.error(`- ${line}`)
    process.exitCode = 1
  } else {
    for (const line of warnings) console.log(`- ${line}`)
  }
}

main()
  .catch((err) => {
    console.error('Preflight failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
