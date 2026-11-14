import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" }) {
  return <button className={cx("button", variant === "quiet" && "quiet", className)} {...props} />;
}

/** Underlined uppercase action, e.g. "START RECORDING". Renders a link when given href. */
export function TextLink({
  tone,
  className,
  ...props
}: (ButtonHTMLAttributes<HTMLButtonElement> | AnchorHTMLAttributes<HTMLAnchorElement>) & {
  tone?: "accent" | "danger";
}) {
  const cls = cx("text-link", tone, className);
  if ("href" in props && props.href) return <a className={cls} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  return <button type="button" className={cls} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}

type FieldChrome = { label: ReactNode; hint?: ReactNode; error?: string };

function FieldFrame({ id, label, hint, error, children }: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return cx(hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined) || undefined;
}

export function Field({ label, hint, error, id, ...props }: FieldChrome & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldFrame id={fid} label={label} hint={hint} error={error}>
      <input
        id={fid}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...props}
      />
    </FieldFrame>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  ...props
}: FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldFrame id={fid} label={label} hint={hint} error={error}>
      <textarea
        id={fid}
        className="textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...props}
      />
    </FieldFrame>
  );
}

export function Checkbox({
  children,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode; error?: string }) {
  return (
    <div className="stack-sm">
      <label className="check">
        <input type="checkbox" aria-invalid={error ? true : undefined} {...props} />
        <span>{children}</span>
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("panel", className)}>{children}</div>;
}

export function PhotoStrip({ photos }: { photos: { src?: string; alt: string }[] }) {
  // Two identical halves (each holding the set twice so it's wider than the viewport);
  // the track slides right by exactly one half, then loops seamlessly.
  const half = [...photos, ...photos];
  const track = [...half, ...half];
  return (
    <div className="photo-strip">
      <ul className="photo-track" aria-label="Past fellows">
        {track.map((p, i) => {
          const hidden = i >= photos.length;
          return (
            <li key={i} aria-hidden={hidden || undefined}>
              {p.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="photo" src={p.src} alt={hidden ? "" : p.alt} loading="lazy" decoding="async" />
              ) : (
                <div className="photo" aria-label={hidden ? undefined : p.alt}>
                  [fellow photo]
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
