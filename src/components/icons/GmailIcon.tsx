export function GmailIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="#EA4335"
        d="M24 5.5v13c0 .85-.65 1.5-1.5 1.5H1.5C.65 20 0 19.35 0 18.5v-13C0 4.65.65 4 1.5 4H5l3.5 4.5L12 4h10.5c.85 0 1.5.65 1.5 1.5z"
      />
      <path fill="#FBBC04" d="M0 6.5l8 6.5-8 6.5V6.5z" />
      <path fill="#34A853" d="M24 6.5v13l-8-6.5 8-6.5z" />
      <path fill="#4285F4" d="M0 6.5h8v13H1.5C.65 19.5 0 18.85 0 18V6.5z" />
      <path fill="#C5221F" d="M8 13 0 6.5V18c0 .85.65 1.5 1.5 1.5H8V13z" />
    </svg>
  );
}
