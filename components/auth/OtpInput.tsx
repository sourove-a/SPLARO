'use client';

import React, { useMemo, useRef } from 'react';
import { cn } from '../../lib/utils';

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  className?: string;
};

export default function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  className,
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const chars = useMemo(() => {
    const normalized = String(value || '').replace(/\D/g, '').slice(0, length);
    return Array.from({ length }, (_, index) => normalized[index] || '');
  }, [value, length]);

  const focusIndex = (index: number) => {
    const input = inputsRef.current[index];
    if (input) {
      input.focus();
      input.select();
    }
  };

  const updateAt = (index: number, digit: string) => {
    const next = [...chars];
    next[index] = digit;
    onChange(next.join(''));
  };

  return (
    <div className={cn('flex items-center justify-between gap-2 sm:gap-3', className)}>
      {chars.map((char, index) => (
        <input
          key={`otp-${index}`}
          ref={(node) => {
            inputsRef.current[index] = node;
          }}
          value={char}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`OTP digit ${index + 1}`}
          className={cn(
            'h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border border-[#4a412d] bg-[#0d0d0d] text-center text-xl font-semibold text-[#f9eccc] outline-none transition-all duration-200',
            'focus-visible:border-[#e8c670] focus-visible:ring-2 focus-visible:ring-[#e8c670]/40',
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text',
          )}
          onChange={(event) => {
            const nextDigit = event.target.value.replace(/\D/g, '').slice(-1);
            updateAt(index, nextDigit);
            if (nextDigit && index < length - 1) {
              focusIndex(index + 1);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace') {
              if (chars[index]) {
                updateAt(index, '');
                return;
              }
              if (index > 0) {
                updateAt(index - 1, '');
                focusIndex(index - 1);
              }
              return;
            }
            if (event.key === 'ArrowLeft' && index > 0) {
              focusIndex(index - 1);
              return;
            }
            if (event.key === 'ArrowRight' && index < length - 1) {
              focusIndex(index + 1);
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            if (!pasted) return;
            const next = Array.from({ length }, (_, idx) => pasted[idx] || '');
            onChange(next.join(''));
            const target = Math.min(pasted.length, length - 1);
            focusIndex(target);
          }}
        />
      ))}
    </div>
  );
}
