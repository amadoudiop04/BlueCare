import { useEffect, useRef } from 'react'

import { cx } from '@/lib/ui.js'

/**
 * Saisie d un code a 6 chiffres, une case par chiffre.
 *
 * Details qui comptent a l usage : le collage d un code entier remplit toutes
 * les cases, la touche retour recule d une case quand la case est vide, et
 * `autocomplete="one-time-code"` laisse iOS et Android proposer le code recu.
 */
const LENGTH = 6

function OtpInput({ value, onChange, onComplete, disabled, autoFocus = true, invalid }) {
  const inputs = useRef([])
  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('')

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus()
  }, [autoFocus])

  const setDigit = (index, digit) => {
    const next = digits.map((entry, position) => (position === index ? digit : entry)).join('')
    const cleaned = next.replace(/\s/g, ' ').trimEnd()

    onChange(cleaned)
    return cleaned
  }

  const handleChange = (index, raw) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    if (!digit) return

    const next = setDigit(index, digit)

    if (index < LENGTH - 1) inputs.current[index + 1]?.focus()
    if (next.replace(/\s/g, '').length === LENGTH) onComplete?.(next.replace(/\s/g, ''))
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault()

      if (digits[index].trim()) {
        setDigit(index, ' ')
      } else if (index > 0) {
        setDigit(index - 1, ' ')
        inputs.current[index - 1]?.focus()
      }
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < LENGTH - 1) inputs.current[index + 1]?.focus()
  }

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!pasted) return

    event.preventDefault()
    onChange(pasted)
    inputs.current[Math.min(pasted.length, LENGTH - 1)]?.focus()

    if (pasted.length === LENGTH) onComplete?.(pasted)
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          // Les cases sont des positions fixes, pas une liste reordonnable :
          // l index est ici la cle stable.
          key={index}
          ref={(element) => {
            inputs.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`Chiffre ${index + 1} sur ${LENGTH}`}
          value={digit.trim()}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          className={cx(
            'h-[46px] flex-1 rounded-[10px] border bg-white text-center font-mono text-[17px]',
            'text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/[0.12]',
            'disabled:cursor-not-allowed disabled:opacity-60',
            invalid ? 'border-danger bg-danger-bg/40' : digit.trim() ? 'border-brand bg-[#F7FAFF]' : 'border-line',
          )}
        />
      ))}
    </div>
  )
}

export default OtpInput
