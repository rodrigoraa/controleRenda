import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type SubmitEvent,
  type FormHTMLAttributes,
} from "react";
import "./forms.css";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FieldError = { field: Field; id: string; label: string; message: string };

function constraintValue(field: Field, value: string) {
  if (field.type === "date") return value.split("-").reverse().join("/");
  if (field.type === "month") return value.split("-").reverse().join("/");
  return value;
}

function validationMessage(field: Field) {
  const { validity } = field;
  if (validity.valueMissing) return "Preencha este campo.";
  if (validity.typeMismatch)
    return field.type === "email"
      ? "Informe um e-mail válido."
      : "Confira o formato deste campo.";
  if (validity.tooShort)
    return `Use pelo menos ${(field as HTMLInputElement).minLength} caracteres.`;
  if (validity.tooLong)
    return `Use no máximo ${(field as HTMLInputElement).maxLength} caracteres.`;
  if (validity.rangeUnderflow) {
    const minimum = constraintValue(field, (field as HTMLInputElement).min);
    return field.type === "date" || field.type === "month"
      ? `Escolha uma data a partir de ${minimum}.`
      : `Informe um valor maior ou igual a ${minimum}.`;
  }
  if (validity.rangeOverflow) {
    const maximum = constraintValue(field, (field as HTMLInputElement).max);
    return field.type === "date" || field.type === "month"
      ? `Escolha uma data até ${maximum}.`
      : `Informe um valor menor ou igual a ${maximum}.`;
  }
  if (validity.stepMismatch)
    return "Informe um valor dentro do intervalo permitido.";
  if (validity.badInput) return "Informe um valor válido.";
  if (validity.patternMismatch)
    return "Confira o formato solicitado para este campo.";
  return "Confira este campo antes de continuar.";
}

function fieldLabel(field: Field) {
  return (
    field.getAttribute("aria-label") ||
    Array.from(field.labels ?? [])
      .map((label) => label.textContent?.replace(/\*/g, "").trim())
      .join(" ") ||
    field.name ||
    "Campo"
  );
}

/** Keeps native constraints while presenting validation in the product language. */
export function ValidatedForm({
  children,
  onSubmit,
  onInput,
  onChange,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  const formId = useId();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const pendingFocus = useRef<Field | null>(null);

  useLayoutEffect(() => {
    const field = pendingFocus.current;
    pendingFocus.current = null;
    field?.focus();
    field?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
  }, [errors]);

  function clearAssociation(error: FieldError) {
    error.field.removeAttribute("aria-invalid");
    const descriptions = (error.field.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .filter((id) => id && id !== error.id);
    if (descriptions.length)
      error.field.setAttribute("aria-describedby", descriptions.join(" "));
    else error.field.removeAttribute("aria-describedby");
  }

  function revalidate() {
    if (!errors.length) return;
    setErrors((current) =>
      current.filter((error) => {
        if (error.field.isConnected && !error.field.validity.valid) return true;
        clearAssociation(error);
        return false;
      }),
    );
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    if (form.getAttribute("aria-busy") === "true") {
      event.preventDefault();
      return;
    }
    const valid = form.checkValidity();
    errors.forEach(clearAssociation);
    if (!valid) {
      event.preventDefault();
      const nextErrors = Array.from(form.elements)
        .filter(
          (field): field is Field =>
            (field instanceof HTMLInputElement ||
              field instanceof HTMLSelectElement ||
              field instanceof HTMLTextAreaElement) &&
            field.willValidate &&
            !field.validity.valid,
        )
        .map((field, index) => {
          const id = `${formId}-error-${index}`;
          field.setAttribute("aria-invalid", "true");
          field.setAttribute(
            "aria-describedby",
            [field.getAttribute("aria-describedby"), id]
              .filter(Boolean)
              .join(" "),
          );
          return {
            field,
            id,
            label: fieldLabel(field),
            message: validationMessage(field),
          };
        });
      pendingFocus.current = nextErrors[0]?.field ?? null;
      setErrors(nextErrors);
      return;
    }
    setErrors([]);
    onSubmit?.(event);
  }

  return (
    <form
      {...props}
      noValidate
      onSubmit={submit}
      onInput={(event) => {
        revalidate();
        onInput?.(event);
      }}
      onChange={(event) => {
        revalidate();
        onChange?.(event);
      }}
    >
      {errors.length > 0 && (
        <div className="cr-form-validation" role="alert">
          <strong>Confira os campos para continuar.</strong>
          <ul>
            {errors.map((error) => (
              <li key={error.id} id={error.id}>
                <button type="button" onClick={() => error.field.focus()}>
                  {error.label}: {error.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </form>
  );
}
