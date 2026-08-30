'use client'

/** NFD names that match a fragment: the name, who owns it, what it asks if listed. */
import { formatMicroAlgos, type NfdList } from '@initlabs/vibekit/views'

import { Table, type Column } from '../../generic-cards'
import { Copyable, FooterNote, Frame, Header } from '../../primitives'
import { shorten } from '../../theme'

type Row = NfdList['nfds'][number]

export function NfdListCard({
  data,
  network,
  onOpen,
}: {
  data: NfdList
  network: string
  onOpen?: (name: string) => void
}) {
  const columns: Column<Row>[] = [
    {
      key: 'name',
      label: 'name',
      width: 'minmax(10rem, 2fr)',
      cell: (n) => (
        <span className="arcade-title">
          {n.properties?.avatar?.startsWith('https://') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="arcade-thumb" src={n.properties.avatar} alt="" width={28} height={28} />
          ) : null}
          {n.name}
        </span>
      ),
    },
    { key: 'state', label: 'state', width: 'minmax(5rem, .7fr)', cell: (n) => n.state ?? '' },
    {
      key: 'owner',
      label: 'owner',
      width: 'minmax(8rem, 1.2fr)',
      cell: (n) => (n.owner ? <Copyable value={n.owner} display={shorten(n.owner, 14)} /> : ''),
    },
    {
      key: 'price',
      label: 'asks',
      align: 'right',
      sortValue: (n) => n.sellAmountMicroAlgos ?? 0,
      cell: (n) =>
        n.sellAmountMicroAlgos ? `${formatMicroAlgos(n.sellAmountMicroAlgos)} ALGO` : '',
    },
  ]
  return (
    <Frame>
      <Header
        kicker="NAMES"
        chip="NFD"
        pill={`${data.nfds.length}${data.total > data.nfds.length ? ` of ${data.total}` : ''}`}
        tone="idle"
      />
      <p className="web-query">“{data.query}”</p>
      {data.nfds.length === 0 ? (
        <FooterNote text={`No names match on ${network}.`} />
      ) : (
        <Table
          columns={columns}
          rows={data.nfds}
          keyOf={(n) => n.name}
          searchText={(n) => `${n.name} ${n.owner ?? ''}`}
          onOpen={onOpen ? (n) => onOpen(n.name) : undefined}
        />
      )}
    </Frame>
  )
}
