import { Checkbox } from '@chakra-ui/react'
import type { ReactNode } from 'react'

export function AppCheckbox({ checked, disabled, onCheckedChange, children, className, title, 'aria-label': ariaLabel }: {
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
  children?: ReactNode
  className?: string
  title?: string
  'aria-label'?: string
}) {
  return <Checkbox.Root className={className} title={title} checked={checked} disabled={disabled} onCheckedChange={details => onCheckedChange(details.checked === true)} size="sm" colorPalette="brand" gap="2" cursor={disabled ? 'not-allowed' : 'pointer'}>
    <Checkbox.HiddenInput aria-label={ariaLabel} />
    <Checkbox.Control flexShrink="0" borderColor="var(--line)" bg="var(--surface)" _checked={{ bg: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' }} _focusVisible={{ outline: '2px solid var(--accent)', outlineOffset: '2px' }}><Checkbox.Indicator /></Checkbox.Control>
    {children && <Checkbox.Label>{children}</Checkbox.Label>}
  </Checkbox.Root>
}
