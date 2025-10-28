import React from 'react';

// A simple, unstyled checkbox component to be used in forms.
// It accepts a boolean `checked` prop and an `onCheckedChange` callback.

interface CheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  className = '',
}, ref) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange(event.target.checked);
  };

  return (
    <input
      id={id}
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={handleChange}
      disabled={disabled}
      className={`h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary ${className}`}
    />
  );
});