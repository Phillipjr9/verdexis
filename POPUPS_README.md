Popup components and usage

Files added
- `app/src/components/Modal.tsx` — accessible base modal used for all popups.
- `app/src/components/DepositPrompt.tsx` — deposit flow prompt modal (amount, address, network, memo).
- `app/src/components/CongratsPopup.tsx` — celebration popup used on wallet creation (already added).

Usage examples

1) Show `DepositPrompt` in a page:

```
const [open, setOpen] = useState(false)

<DepositPrompt
  open={open}
  onClose={() => setOpen(false)}
  onConfirm={(payload) => {
    // call API to create deposit request / show pending modal
    console.log('deposit', payload)
  }}
/>
```

2) Use `Modal` directly for confirmations and admin overrides.

Design notes
- Keep animations short and respect `prefers-reduced-motion`.
- Lazy-load heavy animation assets (3D models or confetti libs) and provide 2D fallbacks.

3) Withdrawal flow

- Use the `WithdrawalPrompt` modal to collect withdrawal amount, destination, network, and optional note.
- Use the event API in `app/src/lib/txNotifier.ts` to emit withdrawal lifecycle events and show pending/result modals via `TxModalHost`.

Example:

```
import { showWithdrawalPending } from './lib/txNotifier'

const id = showWithdrawalPending({ amount: '0.5', address: '0x...', network: 'Ethereum' })

// later, when confirmed by backend
showWithdrawalResult(id, true, '0xTRANSACTIONHASH')
```
