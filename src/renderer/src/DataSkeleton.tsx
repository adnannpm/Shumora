import { useLanguage } from './Language'
import { Skeleton } from '@chakra-ui/react'
type Shape = 'lines' | 'providers' | 'models' | 'details' | 'keys' | 'service' | 'logs' | 'button' | 'quota' | 'quota-summary'
export function DataSkeleton({ label, rows = 3, shape = 'lines' }: { label: string; rows?: number; shape?: Shape }) {
  const { t } = useLanguage()
  const bar = (width: string, height = '14px') => <Skeleton as="span" height={height} width={width} borderRadius="4px" css={{ '--start-color': 'var(--line)', '--end-color': 'var(--sidebar)' }} />
  const button = () => bar('90px', '32px')
  if (shape === 'models') return <div className="data-skeleton skeleton-models" role="status" aria-label={label} aria-busy="true">
    <div className="router-model-results">{bar('100px', '14px')}</div>
    <div className="router-model-table-scroll">
      <table className="router-model-table" aria-hidden="true">
        <thead><tr>{['Models', 'Connection status', 'Routing alias', 'Actions'].map(heading => <th scope="col" key={heading}>{t(heading)}</th>)}</tr></thead>
        <tbody>{Array.from({ length: 6 }, (_, i) => <tr key={i}>
          <th scope="row"><span className="skeleton-model-name">{bar(`${[55, 70, 45][i % 3]}%`, '14px')}{bar('55px', '10px')}</span><span className="router-model-identity">{bar('65%', '12px')}{bar('40px', '26px')}</span></th>
          <td>{bar('70px', '24px')}</td>
          <td><span className="router-model-alias-inline">{bar('100%', '28px')}{bar('68px', '26px')}</span></td>
          <td>{bar('55px', '26px')}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="router-model-pagination"><span>{bar('95px', '14px')}</span><div>{button()}{bar('75px', '14px')}{button()}</div></div>
  </div>
  return <span className={`data-skeleton skeleton-${shape}`} role="status" aria-label={label} aria-busy="true">
    {shape === 'quota-summary' ? <span className="quota-summary">{Array.from({ length: 3 }, (_, i) => <span className="quota-summary-item" key={i}>{bar('65%')}{bar('45px', '34px')}{bar('85%', '11px')}</span>)}</span>
    : shape === 'quota' ? <><span className="quota-filters skeleton-actions">{bar('65%', '38px')}{bar('130px', '38px')}</span><span className="quota-account-grid">{Array.from({ length: 4 }, (_, i) => <span className="router-quota-account skeleton-card" key={i}><span className="skeleton-actions">{bar('38px', '38px')}{bar('50%', '20px')}</span>{Array.from({ length: 3 }, (_, j) => <span className="router-quota-window skeleton-card" key={j}>{bar('45%')}{bar('60%', '26px')}{bar('100%', '7px')}<span className="skeleton-actions">{bar('35%', '11px')}{bar('45%', '11px')}</span></span>)}<span className="quota-account-footer">{bar('40%', '10px')}{bar('40%', '10px')}</span></span>)}</span></>
    : shape === 'providers' ? <span className="router-catalog-grid">{Array.from({ length: 4 }, (_, i) => <span className="router-overview-card skeleton-card" key={i}>{bar('45%', '20px')}{bar('60%')}<span className="skeleton-actions">{button()}{button()}{button()}</span></span>)}</span>
    : shape === 'details' ? <span className="settings-details">{Array.from({ length: rows }, (_, i) => <span className="skeleton-detail-row" key={i}>{bar('110px')}{bar('85px')}</span>)}</span>
    : shape === 'keys' ? <>{Array.from({ length: 2 }, (_, i) => <span className="router-key-row" key={i}>{bar('100px')}{bar('35%')}{button()}{button()}</span>)}</>
    : shape === 'service' ? bar('60%', '24px')
    : shape === 'button' ? bar('150px', '32px')
    : <span className={shape === 'logs' ? "plugin-output-log skeleton-log" : "skeleton-lines"}>{Array.from({ length: rows }, (_, index) => <span className="skeleton-line" key={index}>{bar(`${[85, 60, 95, 45, 75][index % 5]}%`, '14px')}</span>)}</span>}
  </span>
}
