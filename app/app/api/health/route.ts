// Sonda healthchecka kontenera. Aplikacja nie ma zaleznosci zewnetrznych —
// cale generowanie ikon dzieje sie w przegladarce — wiec "zyje" znaczy tyle,
// ze serwer Next odpowiada.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
