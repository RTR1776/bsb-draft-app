import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; BSBDraftApp/1.0)',
    }

    const [transactionsRes, rssRes] = await Promise.allSettled([
      fetch(
        `https://statsapi.mlb.com/api/v1/transactions?startDate=${sevenDaysAgo}&endDate=${today}`,
        { headers, cache: 'no-store' }
      ),
      fetch('https://www.mlbtraderumors.com/feed', {
        headers,
        cache: 'no-store',
      }),
    ])

    const transactions =
      transactionsRes.status === 'fulfilled' && transactionsRes.value.ok
        ? await transactionsRes.value.json()
        : null

    const rssText =
      rssRes.status === 'fulfilled' && rssRes.value.ok
        ? await rssRes.value.text()
        : null

    // Debug info for troubleshooting
    const debug = {
      mlb: transactionsRes.status === 'fulfilled'
        ? { ok: transactionsRes.value.ok, status: transactionsRes.value.status }
        : { error: (transactionsRes as PromiseRejectedResult).reason?.message || 'rejected' },
      rss: rssRes.status === 'fulfilled'
        ? { ok: rssRes.value.ok, status: rssRes.value.status }
        : { error: (rssRes as PromiseRejectedResult).reason?.message || 'rejected' },
    }

    return NextResponse.json({
      transactions: transactions?.transactions || [],
      rss: rssText,
      fetchedAt: Date.now(),
      debug,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch news', detail: err?.message },
      { status: 500 }
    )
  }
}
