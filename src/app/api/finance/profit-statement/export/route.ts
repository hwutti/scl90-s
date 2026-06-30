import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeProfitStatement } from '@/lib/finance/profitStatement'
import { getBranding } from '@/lib/branding'
import { INCOME_CATS, EXPENSE_CATS } from '@/lib/finance/categoryLabels'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ProfitStatementPdf } from '@/lib/pdf/ProfitStatementPdf'

// GET /api/finance/profit-statement/export?year=2026
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role = (session.user as any).role
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString())

  const result = await computeProfitStatement(userId, role, year)
  const branding = await getBranding()
  const logoSrc = branding.logoBase64 ? `data:${branding.logoMimeType};base64,${branding.logoBase64}` : null
  const generatedAt = new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())

  const element = React.createElement(ProfitStatementPdf, {
    year: result.year,
    praxisName: branding.praxisName,
    praxisAddress: branding.address,
    taxNumber: branding.taxNumber,
    vatId: branding.vatId,
    logoSrc,
    generatedAt,
    income: result.income,
    ustSplit: result.ustSplit,
    expenses: result.expenses,
    profit: result.profit,
    grundfreibetrag: result.grundfreibetrag,
    einkuenfte: result.einkuenfte,
    incomeLabels: INCOME_CATS,
    expenseLabels: EXPENSE_CATS,
  }) as unknown as React.ReactElement<import('@react-pdf/renderer').DocumentProps>

  const pdfBuffer = await renderToBuffer(element)

  await prisma.auditLog.create({
    data: { userId, action: 'FINANCE_DATA_EXPORTED', details: { action: 'profit_statement_pdf', year } },
  }).catch(() => {})

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Einnahmen-Ausgaben-Aufstellung-${year}.pdf"`,
    },
  })
}
