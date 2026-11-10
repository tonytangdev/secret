/** A check mark that pops in. Decoration: the text next to it says what's done. */
export const CheckIcon = ({ class: className }: { readonly class: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" class={`shrink-0 animate-pop ${className}`}>
    <path
      d="M4 10.5l4 4 8-9"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
)
