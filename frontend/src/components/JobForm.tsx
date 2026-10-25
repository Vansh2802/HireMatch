import { useState, type FormEvent } from 'react';
import { Field, Input, Textarea } from './ui/Field';

export type JobFormValues = { title: string; company: string; location: string; url: string; description: string };
export const EMPTY_JOB: JobFormValues = { title: '', company: '', location: '', url: '', description: '' };
export const MIN_DESCRIPTION = 80;
export const MAX_DESCRIPTION = 20000;

export function validateJob(values: JobFormValues): Partial<Record<keyof JobFormValues, string>> {
  const errors: Partial<Record<keyof JobFormValues, string>> = {};
  if (!values.title.trim()) errors.title = 'Enter the job title.';
  const length = values.description.trim().length;
  if (length < MIN_DESCRIPTION) errors.description = `Paste the full job description (at least ${MIN_DESCRIPTION} characters; currently ${length}).`;
  if (length > MAX_DESCRIPTION) errors.description = `The description is too long (${length.toLocaleString()} of ${MAX_DESCRIPTION.toLocaleString()} characters).`;
  if (values.url.trim() && !/^https?:\/\//i.test(values.url.trim())) errors.url = 'Links must start with http:// or https://';
  return errors;
}

export function toJobPayload(values: JobFormValues) {
  return {
    title: values.title.trim(),
    company: values.company.trim() || null,
    location: values.location.trim() || null,
    url: values.url.trim() || null,
    description: values.description.trim(),
  };
}

/** Controlled job fields; the parent owns submission so state survives failed requests. */
export function JobFields({
  values,
  onChange,
  errors,
  disabled,
  compact = false,
}: {
  values: JobFormValues;
  onChange: (values: JobFormValues) => void;
  errors: Partial<Record<keyof JobFormValues, string>>;
  disabled?: boolean;
  compact?: boolean;
}) {
  const set = (key: keyof JobFormValues) => (event: { target: { value: string } }) => onChange({ ...values, [key]: event.target.value });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job title" error={errors.title}>
          <Input value={values.title} onChange={set('title')} maxLength={200} disabled={disabled} placeholder="e.g. Senior Backend Engineer" />
        </Field>
        <Field label="Company" optional>
          <Input value={values.company} onChange={set('company')} maxLength={200} disabled={disabled} />
        </Field>
        {!compact && (
          <>
            <Field label="Location" optional>
              <Input value={values.location} onChange={set('location')} maxLength={200} disabled={disabled} placeholder="e.g. Remote, Berlin" />
            </Field>
            <Field label="Link to posting" optional error={errors.url}>
              <Input type="url" value={values.url} onChange={set('url')} maxLength={1000} disabled={disabled} placeholder="https://" />
            </Field>
          </>
        )}
      </div>
      <Field
        label="Job description"
        error={errors.description}
        hint={`Paste the full posting, including requirements and “nice to have” sections. ${values.description.trim().length.toLocaleString()} / ${MAX_DESCRIPTION.toLocaleString()} characters.`}
      >
        <Textarea value={values.description} onChange={set('description')} rows={compact ? 10 : 14} disabled={disabled} className="font-normal" />
      </Field>
    </div>
  );
}

export function useJobForm(initial: JobFormValues = EMPTY_JOB) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormValues, string>>>({});
  const check = (event?: FormEvent) => {
    event?.preventDefault();
    const found = validateJob(values);
    setErrors(found);
    return Object.keys(found).length === 0;
  };
  return { values, setValues, errors, setErrors, check };
}
