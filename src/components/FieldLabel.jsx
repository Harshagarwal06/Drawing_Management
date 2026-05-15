export default function FieldLabel({ children, req }) {
  return (
    <p className="text-xs font-semibold text-slate-600 mb-1.5">
      {children}{req && <span className="text-red-500 ml-0.5">*</span>}
    </p>
  );
}
