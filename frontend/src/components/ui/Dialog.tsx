import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { Field, Input } from './Field';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

/** Native <dialog>: focus trapping, Escape and inert background come from the browser. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'sm' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={`w-[calc(100%-2rem)] ${width} rounded-lg border border-line bg-paper p-0 text-ink shadow-pop backdrop:bg-obsidian/50`}
    >
      {open && (
        <div className="animate-enter">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <div id={descriptionId} className="mt-1 text-sm text-ink-soft">
                  {description}
                </div>
              )}
            </div>
            <button type="button" onClick={onClose} className="-mr-1 rounded p-1 text-ink-faint hover:bg-sunk hover:text-ink" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          {children && <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

type ConfirmProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  pending?: boolean;
  danger?: boolean;
  /** When set, the user must type this text to enable the confirm button. */
  typeToConfirm?: string;
};

export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onClose, pending, danger = true, typeToConfirm }: ConfirmProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const blocked = typeToConfirm ? typed.trim() !== typeToConfirm : false;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => void onConfirm()} loading={pending} disabled={blocked}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {typeToConfirm && (
        <Field label={`Type ${typeToConfirm} to confirm`}>
          <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
        </Field>
      )}
    </Dialog>
  );
}
