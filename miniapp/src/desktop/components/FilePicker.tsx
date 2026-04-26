import { useId, useRef, type ChangeEvent } from 'react';
import { UploadIcon } from './icons';

interface FilePickerProps {
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  buttonLabel?: string;
  emptyLabel?: string;
}

/**
 * Replaces the unstyled native `<input type="file">` with a normal-looking
 * button that matches the rest of the platform's button styling.
 *
 * Renders a hidden file input and a "Choose file" button, plus a filename
 * label that updates when the user picks a file.
 */
export default function FilePicker({
  accept,
  file,
  onChange,
  disabled = false,
  buttonLabel = 'Choose file',
  emptyLabel = 'No file selected',
}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    onChange(f);
  }

  function handleClick() {
    if (disabled) return;
    inputRef.current?.click();
  }

  return (
    <div className="file-picker">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="file-picker__input"
      />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={handleClick}
        disabled={disabled}
      >
        <UploadIcon size={14} />
        {buttonLabel}
      </button>
      <span
        className={`file-picker__name${file ? '' : ' file-picker__name--empty'}`}
        title={file?.name}
      >
        {file ? file.name : emptyLabel}
      </span>
    </div>
  );
}

/**
 * Imperatively reset the file input inside a FilePicker. Useful when the
 * parent has just successfully uploaded the file and wants to clear the
 * picker. We expose this as a tiny utility so callers don't have to manage
 * input refs themselves.
 */
export function resetFilePicker(form: HTMLFormElement | null, inputName: string) {
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>(`input[name="${inputName}"]`);
  if (input) input.value = '';
}
