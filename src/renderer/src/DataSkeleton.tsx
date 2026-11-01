import { useLanguage } from './Language'
import { Skeleton } from '@chakra-ui/react'
type Shape = 'lines' | 'providers' | 'models' | 'details' | 'keys' | 'service' | 'logs' | 'button' | 'quota' | 'quota-summary'
export function DataSkeleton({ label, rows = 3, shape = 'lines' }: { label: string; rows?: number; shape?: Shape }) {
  const { t } = useLanguage()
  const bar = (width: string, height = '14px') => <Skeleton as="span" height={height} width={width} borderRadius="4px" css={{ '--start-color': 'var(--line)', '--end-color': 'var(--sidebar)' }} />
  const button = () => bar('90px', '32px')
  const cards = shape === 'providers' || shape === 'models'
  return <span className={`data-skeleton skeleton-${shape}`} role="status" aria-label={label} aria-busy="true">
    {shape === 'quota-summary' ? <span className="quota-summary">{Array.from({ length: 3 }, (_, i) => <span className="quota-summary-item" key={i}>{bar('65%')}{bar('45px', '34px')}{bar('85%', '11px')}</span>)}</span>
    : shape === 'quota' ? <><span className="quota-filters skeleton-actions">{bar('65%', '38px')}{bar('130px', '38px')}</span><span className="quota-account-grid">{Array.from({ length: 4 }, (_, i) => <span className="router-quota-account skeleton-card" key={i}><span className="skeleton-actions">{bar('38px', '38px')}{bar('50%', '20px')}</span>{Array.from({ length: 3 }, (_, j) => <span className="router-quota-window skeleton-card" key={j}>{bar('45%')}{bar('60%', '26px')}{bar('100%', '7px')}<span className="skeleton-actions">{bar('35%', '11px')}{bar('45%', '11px')}</span></span>)}<span className="quota-account-footer">{bar('40%', '10px')}{bar('40%', '10px')}</span></span>)}</span></>
    : cards ? <span className="router-catalog-grid">{Array.from({ length: 4 }, (_, i) => <span className="router-overview-card skeleton-card" key={i}>{bar('45%', '20px')}{bar('60%')}<span className="skeleton-actions">{shape === 'providers' ? <>{button()}{button()}{button()}</> : button()}</span>{shape === 'models' && <><span className="skeleton-actions skeleton-endpoint">{bar('65%')}{button()}</span><span className="skeleton-actions">{bar('65%', '36px')}{button()}</span></>}</span>)}</span>
    : shape === 'details' ? <span className="settings-details">{Array.from({ length: rows }, (_, i) => <span className="skeleton-detail-row" key={i}>{bar('110px')}{bar('85px')}</span>)}</span>
    : shape === 'keys' ? <>{Array.from({ length: 2 }, (_, i) => <span className="router-key-row" key={i}>{bar('100px')}{bar('35%')}{button()}{button()}</span>)}</>
    : shape === 'service' ? bar('60%', '24px')
    : shape === 'button' ? bar('150px', '32px')
    : <span className={shape === 'logs' ? "plugin-output-log skeleton-log" : "skeleton-lines"}>{Array.from({ length: rows }, (_, index) => <span className="skeleton-line" key={index}>{bar(`${[85, 60, 95, 45, 75][index % 5]}%`, '14px')}</span>)}</span>}
  </span>
}
