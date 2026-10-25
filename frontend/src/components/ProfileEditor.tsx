import { useFieldArray, useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import type { ResumeProfile } from '../lib/types';
import { Button, IconButton } from './ui/Button';
import { Field, Input, Textarea } from './ui/Field';
import { InlineError } from './ui/States';

type FormValues = Omit<ResumeProfile, 'skills' | 'certifications' | 'total_experience_years'> & {
  skillsText: string;
  certificationsText: string;
  years: string;
};

const toForm = (profile: ResumeProfile): FormValues => ({
  ...profile,
  skillsText: profile.skills.join(', '),
  certificationsText: profile.certifications.join('\n'),
  years: profile.total_experience_years === null ? '' : String(profile.total_experience_years),
});

const clean = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

function fromForm(values: FormValues, original: ResumeProfile): ResumeProfile {
  const years = values.years.trim() === '' ? null : Number(values.years);
  return {
    ...original,
    name: clean(values.name),
    headline: clean(values.headline),
    summary: clean(values.summary),
    location: clean(values.location),
    skills: Array.from(new Set(values.skillsText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))).slice(0, 200),
    certifications: values.certificationsText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 60),
    total_experience_years: years,
    experiences: values.experiences
      .map((e) => ({ title: clean(e.title), company: clean(e.company), location: clean(e.location), start: clean(e.start), end: clean(e.end), description: clean(e.description) }))
      .filter((e) => e.title || e.company || e.description),
    education: values.education
      .map((e) => ({ degree: clean(e.degree), field: clean(e.field), institution: clean(e.institution), start: clean(e.start), end: clean(e.end) }))
      .filter((e) => e.degree || e.institution),
  };
}

/** Edit the extracted profile. Saving creates a new resume version; the document text is unchanged. */
export function ProfileEditor({ profile, onSave, onCancel, saving, error }: { profile: ResumeProfile; onSave: (profile: ResumeProfile) => void; onCancel: () => void; saving: boolean; error?: string | null }) {
  const { register, control, handleSubmit, formState } = useForm<FormValues>({ defaultValues: toForm(profile) });
  const experiences = useFieldArray({ control, name: 'experiences' });
  const education = useFieldArray({ control, name: 'education' });

  return (
    <form onSubmit={handleSubmit((values) => onSave(fromForm(values, profile)))} className="space-y-8" noValidate>
      <p className="rounded border border-line bg-sunk/50 px-3 py-2 text-sm text-ink-soft">
        Corrections are saved as a new version and used by future analyses. Skills you add here but that aren’t in the resume file will be marked “only in your profile”,
        because employers only see the file.
      </p>
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" optional>
          <Input {...register('name')} maxLength={200} />
        </Field>
        <Field label="Headline" optional>
          <Input {...register('headline')} maxLength={300} />
        </Field>
        <Field label="Summary" optional className="sm:col-span-2">
          <Textarea {...register('summary')} rows={4} maxLength={4000} />
        </Field>
        <Field label="Total years of experience" optional hint="Leave empty if unknown. A value you enter is labelled as entered by you." error={formState.errors.years?.message}>
          <Input
            inputMode="decimal"
            {...register('years', { validate: (value) => value.trim() === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 60) || 'Enter a number between 0 and 60.' })}
          />
        </Field>
        <Field label="Skills" hint="Separate with commas." className="sm:col-span-2">
          <Textarea {...register('skillsText')} rows={3} />
        </Field>
        <Field label="Certifications" optional hint="One per line." className="sm:col-span-2">
          <Textarea {...register('certificationsText')} rows={3} />
        </Field>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Experience</h3>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => experiences.append({ title: '', company: '', location: null, start: '', end: '', description: '' })}>
            Add role
          </Button>
        </div>
        <div className="space-y-3">
          {experiences.fields.map((field, index) => (
            <fieldset key={field.id} className="min-w-0 rounded-lg border border-line p-4">
              <legend className="sr-only">Role {index + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Job title"><Input {...register(`experiences.${index}.title`)} maxLength={300} /></Field>
                <Field label="Company"><Input {...register(`experiences.${index}.company`)} maxLength={300} /></Field>
                <Field label="Start" hint="e.g. Jan 2021"><Input {...register(`experiences.${index}.start`)} maxLength={40} /></Field>
                <Field label="End" hint="e.g. Present"><Input {...register(`experiences.${index}.end`)} maxLength={40} /></Field>
                <Field label="Description" className="sm:col-span-2"><Textarea {...register(`experiences.${index}.description`)} rows={3} maxLength={6000} /></Field>
              </div>
              <div className="mt-2 flex justify-end">
                <IconButton label={`Remove role ${index + 1}`} onClick={() => experiences.remove(index)}><Trash2 size={15} /></IconButton>
              </div>
            </fieldset>
          ))}
          {experiences.fields.length === 0 && <p className="text-sm text-ink-faint">No roles recorded.</p>}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Education</h3>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => education.append({ degree: '', field: null, institution: '', start: null, end: '' })}>
            Add education
          </Button>
        </div>
        <div className="space-y-3">
          {education.fields.map((field, index) => (
            <fieldset key={field.id} className="grid min-w-0 gap-3 rounded-lg border border-line p-4 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
              <legend className="sr-only">Education {index + 1}</legend>
              <Field label="Degree"><Input {...register(`education.${index}.degree`)} maxLength={300} /></Field>
              <Field label="Institution"><Input {...register(`education.${index}.institution`)} maxLength={300} /></Field>
              <Field label="Year"><Input {...register(`education.${index}.end`)} maxLength={40} /></Field>
              <IconButton label={`Remove education ${index + 1}`} onClick={() => education.remove(index)} className="mb-1"><Trash2 size={15} /></IconButton>
            </fieldset>
          ))}
          {education.fields.length === 0 && <p className="text-sm text-ink-faint">No education recorded.</p>}
        </div>
      </section>

      <InlineError message={error} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>Save as new version</Button>
      </div>
    </form>
  );
}
