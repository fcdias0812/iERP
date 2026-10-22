/* Peças usadas por mais de uma aba do cliente. */

export function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="break-all text-link underline-offset-4 hover:underline">
      {email}
    </a>
  )
}
