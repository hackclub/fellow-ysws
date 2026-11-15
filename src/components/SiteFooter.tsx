const footerLinks = [
  {
    title: "Community",
    links: [
      { href: "https://slack.hackclub.com/", label: "Join our Slack" },
      { href: "https://events.hackclub.com/", label: "Community events" },
      { href: "https://workshops.hackclub.com/", label: "Workshops" },
      { href: "https://forms.hackclub.com/bounty", label: "Bounty" },
      { href: "https://hackclub.com/conduct/", label: "Code of conduct" },
    ],
  },
  {
    title: "Hack Club",
    links: [
      { href: "https://hackclub.com/philosophy/", label: "Philosophy" },
      { href: "https://hackclub.com/team/", label: "Our team & board" },
      { href: "https://hackclub.com/brand/", label: "Branding" },
      { href: "https://hackclub.com/philanthropy/", label: "Donate" },
      { href: "https://hackclub.com/privacy-and-terms", label: "Privacy and terms" },
    ],
  },
];

/** Explains what Hack Club is, with the standard Hack Club footer links. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="stack site-footer-about">
          <h2>
            A project by <a href="https://hackclub.com/?utm_source=fellows">Hack Club</a>
          </h2>
          <p className="small muted">
            Hack Club is a 501(c)(3) nonprofit and network of 100k+ technical high schoolers. We
            believe you learn best by building, so we&apos;re creating community and providing
            grants so you can make awesome projects. In the past few years, we&apos;ve{" "}
            <a href="https://www.youtube.com/watch?v=ufMUJ9D1fi8">
              sent 30 teen hackers hiking the Pacific Crest Trail
            </a>
            ,{" "}
            <a href="https://www.youtube.com/watch?v=8iM1W8kXrQA">
              hosted a hackathon for the worst ideas
            </a>
            , and{" "}
            <a href="https://www.youtube.com/watch?v=kaEFv7e49mo">
              ran the largest teen hardware hackathon at GitHub HQ
            </a>
            .
          </p>
          <p className="small muted">
            Read about Hack Club in{" "}
            <a href="https://www.wsj.com/articles/teen-hackers-try-to-convince-parents-they-are-up-to-good-11569922200">
              The Wall Street Journal
            </a>
            ,{" "}
            <a href="https://www.cbsnews.com/sanfrancisco/news/hack-club-hosts-teen-coders-san-francisco/">
              CBS News
            </a>
            , and{" "}
            <a href="https://www.nasa.gov/learning-resources/space-out-this-summer-with-variety-of-nasa-stem-activities/">
              NASA.gov
            </a>
            , or watch us{" "}
            <a href="https://www.youtube.com/live/UbfAhFxDomE?si=5DiK1_hGqKrB_r50&t=7033">
              on stage with AMD CEO Lisa Su at CES
            </a>
            .
          </p>
        </div>
        <nav aria-label="Footer" className="site-footer-nav">
          {footerLinks.map((group) => (
            <div key={group.title} className="stack-sm">
              <h3>{group.title}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
