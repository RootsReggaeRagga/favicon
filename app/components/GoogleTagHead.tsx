import { isGaId } from "@/lib/analytics";
import { gtagInitScript } from "@/lib/consent";

/**
 * Consent Mode v2 w <head>: `consent default` z wszystkim denied leci zawsze,
 * gtag.js laduje sie od razu tylko u powracajacych uzytkownikow z zapisana
 * zgoda. Nowym ladowanie wlacza ConsentBanner po akceptacji.
 */
export default function GoogleTagHead({ gaId }: { gaId: string | undefined }) {
  if (!isGaId(gaId)) return null;
  return <script dangerouslySetInnerHTML={{ __html: gtagInitScript(gaId) }} />;
}
