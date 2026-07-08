import { AlertTriangle } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  loading = false,
  onClose,
  onConfirm
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={loading} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={loading} onClick={onConfirm}>
            {loading ? "Deleting..." : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/5 p-5">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-white">This action cannot be undone.</p>
            <p className="mt-2 text-sm text-slate-300">{description}</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
