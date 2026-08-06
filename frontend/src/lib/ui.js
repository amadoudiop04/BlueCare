/**
 * Helpers de style partages.
 *
 * Separes de `components/ui/primitives.jsx` parce qu'un module qui exporte
 * autre chose que des composants casse le Fast Refresh de Vite : le fichier
 * entier serait recharge au lieu d'etre remplace a chaud.
 */

export const cx = (...classes) => classes.filter(Boolean).join(' ')

export const inputClass =
  'w-full rounded-[10px] border border-line bg-white px-3.5 py-3 text-[13.5px] text-ink outline-none ' +
  'placeholder:text-muted-light focus:border-brand focus:ring-[3px] focus:ring-brand/[0.12]'
