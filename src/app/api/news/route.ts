import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const [transactionsRes, rssRes] = await Promise.allSettled([
      fetch(
        `https://statsapi.mlb.com/api/v1/transactions?startDate=${thirtyDaysAgo}&endDate=${today}`,
        { next: { revalidate: 300 } }
      ),
      fetch('https://www.rotowire.com/rss/news.xml', { next: { revalidate: 300 } }),
    ])

    const transactions =
      transactionsRes.status === 'fulfilled' && transactionsRes.value.ok
        ? await transactionsRes.value.json()
        : null

    const rssText =
      rssRes.status === 'fulfilled' && rssRes.value.ok
        ? await rssRes.value.text()
        : null

    return NextResponse.json({
      transactions: transactions?.transactions || [],
      rss: rssText,
      fetchedAt: Date.now(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
