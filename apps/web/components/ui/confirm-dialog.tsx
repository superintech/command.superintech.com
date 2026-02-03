'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  loading?: boolean;
  requireConfirmation?: boolean;
  confirmationText?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  loading = false,
  requireConfirmation = false,
  confirmationText = 'DELETE',
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');

  // Reset input when dialog closes
  useEffect(() => {
    if (!open) {
      setInputValue('');
    }
  }, [open]);

  const isConfirmEnabled = !requireConfirmation || inputValue === confirmationText;

  const handleConfirm = () => {
    if (isConfirmEnabled) {
      onConfirm();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#131d2e] border-slate-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {requireConfirmation && (
          <div className="space-y-2 py-2">
            <Label className="text-slate-300 text-sm">
              Type <span className="font-mono font-bold text-red-400">{confirmationText}</span> to confirm:
            </Label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmationText}
              className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-600 font-mono"
              autoComplete="off"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={loading}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white bg-transparent"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !isConfirmEnabled}
            className={
              variant === 'destructive'
                ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }
          >
            {loading ? 'Loading...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
