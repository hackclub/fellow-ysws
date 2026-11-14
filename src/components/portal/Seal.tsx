/** The round FELLOWS FUND™ seal used on letters. Decorative. */
export function Seal({ size = 120 }: { size?: number }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <path id="seal-ring" d="M100,100 m-70,0 a70,70 0 1,1 140,0 a70,70 0 1,1 -140,0" />
      </defs>
      <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="100" cy="100" r="54" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fontSize="17" letterSpacing="1.5" fill="currentColor">
        <textPath href="#seal-ring" startOffset="0" textLength="430" lengthAdjust="spacing">
          HACK CLUB ★ FELLOWS FUND ★ WE BACK TEENAGE HACKERS ★
        </textPath>
      </text>
      <text x="100" y="117" textAnchor="middle" fontSize="50" fontStyle="italic" fill="currentColor">
        FF
      </text>
    </svg>
  );
}
