import { createContext, useCallback, useContext } from 'react';
import type { ViewNode } from '../parse/registry';
import type { TextSpan } from '../nodes/schemas';
import type { FormSubmission } from './context';

export type FormValue = string[] | number | string;

export interface FormInputInfo {
  name: string;
  human(value: FormValue): string;
}

export interface FormState {
  id?: string;
  values: Record<string, FormValue>;
  inputs: Record<string, FormInputInfo>;
  valid: boolean;
  locked: boolean;
  set(name: string, value: FormValue): void;
}

export const FormContext = createContext<FormState | null>(null);

export function useForm(): FormState | null {
  return useContext(FormContext);
}

const READ = /(?<!\{)\{([a-z][a-zA-Z0-9]*)\}(?!\})/g;

export function fillHuman(text: string, form: FormState): string {
  return text.replace(READ, (whole, name: string) => {
    const info = form.inputs[name];
    const v = form.values[name];
    return info && v !== undefined ? info.human(v) : whole;
  });
}

export function useFormButton(node: ViewNode) {
  const form = useForm();
  const submission = useCallback((): FormSubmission | undefined => (form ? { ...(form.id ? { id: form.id } : {}), values: form.values } : undefined), [form]);
  const fill = (label: string | TextSpan[] | undefined) => {
    if (!form || label === undefined) return label;
    if (typeof label === 'string') return fillHuman(label, form);
    return label.map((s) => ({ ...s, text: fillHuman(s.text, form) }));
  };
  return {
    blocked: form !== null && !form.valid && node.ignoreFormValidity !== true,
    submission: form ? submission : undefined,
    fill,
  };
}
