/**
 * Reusable form field component
 */
interface FormFieldProps {
  label: string;
  type: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export const FormField = ({
  label,
  type,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  error,
}: FormFieldProps) => {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        htmlFor={name}
        style={{
          display: 'block',
          marginBottom: '4px',
          fontWeight: 500,
          fontSize: '14px',
        }}
      >
        {label}
        {required && <span style={{ color: 'red' }}> *</span>}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: error ? '1px solid red' : '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '14px',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  );
};
