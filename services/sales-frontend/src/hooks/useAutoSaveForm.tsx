import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  message?: string;
}

interface FieldConfig {
  name: string;
  rules?: ValidationRule[];
  transform?: (value: any) => any;
}

interface AutoSaveConfig {
  enabled?: boolean;
  delay?: number;
  onSave?: (data: any) => Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  storage?: 'localStorage' | 'sessionStorage' | 'none';
  storageKey?: string;
}

interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isDirty: boolean;
  isValid: boolean;
  isSaving: boolean;
  lastSaved?: Date;
  saveError?: string;
}

/**
 * World-class Form Management Hook
 * Auto-save, validation, and state management
 */
export function useAutoSaveForm<T extends Record<string, any>>(
  initialValues: T,
  fields: FieldConfig[],
  config: AutoSaveConfig = {}
) {
  const {
    enabled = true,
    delay = 1000,
    onSave,
    validateOnChange = true,
    validateOnBlur = true,
    storage = 'localStorage',
    storageKey = 'form_autosave',
  } = config;

  // Form state
  const [formState, setFormState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isDirty: false,
    isValid: true,
    isSaving: false,
  });

  // Refs for debounced functions
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const validationCache = useRef<Map<string, { value: any; error: string }>>(new Map());

  // Load saved data from storage
  useEffect(() => {
    if (storage !== 'none') {
      const storageApi = storage === 'localStorage' ? localStorage : sessionStorage;
      const savedData = storageApi.getItem(storageKey);
      
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setFormState(prev => ({
            ...prev,
            values: { ...initialValues, ...parsed.values },
            touched: parsed.touched || {},
          }));
        } catch (error) {
          console.error('Failed to load saved form data:', error);
        }
      }
    }
  }, []);

  // Validate single field
  const validateField = useCallback((name: string, value: any): string => {
    const field = fields.find(f => f.name === name);
    if (!field?.rules) return '';

    // Check cache
    const cached = validationCache.current.get(name);
    if (cached && cached.value === value) {
      return cached.error;
    }

    for (const rule of field.rules) {
      // Required
      if (rule.required && (!value || value === '')) {
        const error = rule.message || `${name} is required`;
        validationCache.current.set(name, { value, error });
        return error;
      }

      // Min length
      if (rule.minLength && value && value.length < rule.minLength) {
        const error = rule.message || `${name} must be at least ${rule.minLength} characters`;
        validationCache.current.set(name, { value, error });
        return error;
      }

      // Max length
      if (rule.maxLength && value && value.length > rule.maxLength) {
        const error = rule.message || `${name} must be at most ${rule.maxLength} characters`;
        validationCache.current.set(name, { value, error });
        return error;
      }

      // Pattern
      if (rule.pattern && value && !rule.pattern.test(value)) {
        const error = rule.message || `${name} is invalid`;
        validationCache.current.set(name, { value, error });
        return error;
      }

      // Custom validation
      if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
          const error = typeof result === 'string' ? result : rule.message || `${name} is invalid`;
          validationCache.current.set(name, { value, error });
          return error;
        }
      }
    }

    validationCache.current.set(name, { value, error: '' });
    return '';
  }, [fields]);

  // Validate all fields
  const validateAll = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    fields.forEach(field => {
      const value = formState.values[field.name];
      const error = validateField(field.name, value);
      if (error) {
        errors[field.name] = error;
      }
    });

    return errors;
  }, [fields, formState.values, validateField]);

  // Auto-save function
  const performAutoSave = useCallback(async (values: T) => {
    if (!enabled || !onSave) return;

    setFormState(prev => ({ ...prev, isSaving: true, saveError: undefined }));

    try {
      await onSave(values);
      
      setFormState(prev => ({
        ...prev,
        isSaving: false,
        lastSaved: new Date(),
        isDirty: false,
      }));

      // Clear storage after successful save
      if (storage !== 'none') {
        const storageApi = storage === 'localStorage' ? localStorage : sessionStorage;
        storageApi.removeItem(storageKey);
      }
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        isSaving: false,
        saveError: error instanceof Error ? error.message : 'Save failed',
      }));
    }
  }, [enabled, onSave, storage, storageKey]);

  // Debounced auto-save
  const debouncedSave = useCallback(
    debounce((values: T) => {
      performAutoSave(values);
    }, delay),
    [performAutoSave, delay]
  );

  // Handle field change
  const handleChange = useCallback((name: string, value: any) => {
    const field = fields.find(f => f.name === name);
    const transformedValue = field?.transform ? field.transform(value) : value;

    setFormState(prev => {
      const newValues = { ...prev.values, [name]: transformedValue };
      const newErrors = { ...prev.errors };

      // Validate on change if enabled
      if (validateOnChange && prev.touched[name]) {
        const error = validateField(name, transformedValue);
        if (error) {
          newErrors[name] = error;
        } else {
          delete newErrors[name];
        }
      }

      const isValid = Object.keys(newErrors).length === 0;

      // Save to storage
      if (storage !== 'none') {
        const storageApi = storage === 'localStorage' ? localStorage : sessionStorage;
        storageApi.setItem(storageKey, JSON.stringify({
          values: newValues,
          touched: prev.touched,
          timestamp: Date.now(),
        }));
      }

      // Trigger auto-save
      if (enabled && isValid) {
        debouncedSave(newValues);
      }

      return {
        ...prev,
        values: newValues,
        errors: newErrors,
        isDirty: true,
        isValid,
      };
    });
  }, [fields, validateOnChange, validateField, storage, storageKey, enabled, debouncedSave]);

  // Handle field blur
  const handleBlur = useCallback((name: string) => {
    setFormState(prev => {
      const newTouched = { ...prev.touched, [name]: true };
      const newErrors = { ...prev.errors };

      // Validate on blur if enabled
      if (validateOnBlur) {
        const error = validateField(name, prev.values[name]);
        if (error) {
          newErrors[name] = error;
        } else {
          delete newErrors[name];
        }
      }

      return {
        ...prev,
        touched: newTouched,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
      };
    });
  }, [validateOnBlur, validateField]);

  // Submit form
  const handleSubmit = useCallback(async (onSubmit: (values: T) => Promise<void>) => {
    // Touch all fields
    const allTouched = fields.reduce((acc, field) => ({
      ...acc,
      [field.name]: true,
    }), {});

    // Validate all
    const errors = validateAll();

    setFormState(prev => ({
      ...prev,
      touched: allTouched,
      errors,
      isValid: Object.keys(errors).length === 0,
    }));

    if (Object.keys(errors).length === 0) {
      try {
        await onSubmit(formState.values);
        
        // Clear storage after successful submit
        if (storage !== 'none') {
          const storageApi = storage === 'localStorage' ? localStorage : sessionStorage;
          storageApi.removeItem(storageKey);
        }

        // Reset form
        setFormState({
          values: initialValues,
          errors: {},
          touched: {},
          isDirty: false,
          isValid: true,
          isSaving: false,
        });
      } catch (error) {
        console.error('Form submission failed:', error);
      }
    }
  }, [fields, validateAll, formState.values, storage, storageKey, initialValues]);

  // Reset form
  const reset = useCallback((values?: T) => {
    setFormState({
      values: values || initialValues,
      errors: {},
      touched: {},
      isDirty: false,
      isValid: true,
      isSaving: false,
    });

    // Clear storage
    if (storage !== 'none') {
      const storageApi = storage === 'localStorage' ? localStorage : sessionStorage;
      storageApi.removeItem(storageKey);
    }

    // Clear validation cache
    validationCache.current.clear();
  }, [initialValues, storage, storageKey]);

  // Set field value
  const setFieldValue = useCallback((name: string, value: any) => {
    handleChange(name, value);
  }, [handleChange]);

  // Set field error
  const setFieldError = useCallback((name: string, error: string) => {
    setFormState(prev => ({
      ...prev,
      errors: { ...prev.errors, [name]: error },
      isValid: false,
    }));
  }, []);

  // Get field props
  const getFieldProps = useCallback((name: string) => ({
    name,
    value: formState.values[name] || '',
    onChange: (e: any) => handleChange(name, e.target?.value ?? e),
    onBlur: () => handleBlur(name),
    error: !!formState.errors[name] && formState.touched[name],
    helperText: formState.touched[name] ? formState.errors[name] : undefined,
  }), [formState, handleChange, handleBlur]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  return {
    // Form state
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    isDirty: formState.isDirty,
    isValid: formState.isValid,
    isSaving: formState.isSaving,
    lastSaved: formState.lastSaved,
    saveError: formState.saveError,

    // Methods
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    setFieldError,
    getFieldProps,
    validateField,
    validateAll,
  };
}

// Validation helpers
export const validators = {
  required: (message?: string): ValidationRule => ({
    required: true,
    message: message || 'This field is required',
  }),

  email: (message?: string): ValidationRule => ({
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: message || 'Invalid email address',
  }),

  phone: (message?: string): ValidationRule => ({
    pattern: /^[\d\s\-\+\(\)]+$/,
    message: message || 'Invalid phone number',
  }),

  url: (message?: string): ValidationRule => ({
    pattern: /^https?:\/\/.+\..+/,
    message: message || 'Invalid URL',
  }),

  min: (min: number, message?: string): ValidationRule => ({
    custom: (value) => !value || Number(value) >= min,
    message: message || `Must be at least ${min}`,
  }),

  max: (max: number, message?: string): ValidationRule => ({
    custom: (value) => !value || Number(value) <= max,
    message: message || `Must be at most ${max}`,
  }),

  minLength: (length: number, message?: string): ValidationRule => ({
    minLength: length,
    message: message || `Must be at least ${length} characters`,
  }),

  maxLength: (length: number, message?: string): ValidationRule => ({
    maxLength: length,
    message: message || `Must be at most ${length} characters`,
  }),

  pattern: (pattern: RegExp, message?: string): ValidationRule => ({
    pattern,
    message: message || 'Invalid format',
  }),

  custom: (validate: (value: any) => boolean | string, message?: string): ValidationRule => ({
    custom: validate,
    message,
  }),
};