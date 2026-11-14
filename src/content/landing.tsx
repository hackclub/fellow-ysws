// Landing page copy. Edit freely: the program-site spec fixes the sections, not the words.
import type { AccordionEntry } from "@/components/Accordion";

export const whyFellows = [
  "ten weeks is enough time to build something real.",
  "they have nothing else to do but ship.",
  "the last week is in san francisco, pitching real investors.",
];

export const howItWorks = [
  {
    eyebrow: "To apply",
    title: "A project + 2 hours™",
    body: "pick a project you've logged on hackatime, record a one minute video, and pay the fee in hours, not dollars. brand new to hack club? ask for aid instead of a project.",
  },
  {
    eyebrow: "Weeks 1–9",
    title: "Build from wherever you are",
    body: "nine weeks online with your cohort. ship something every week.",
  },
  {
    eyebrow: "Week 10",
    title: "San Francisco, IRL",
    body: "one week in person. pitch what you built to real investors.",
  },
];

const TODO = <p className="muted">[answer coming soon]</p>;

export const faq: AccordionEntry[] = [
  { question: "What is Fellows Fund™?", answer: "A 10 week accelerator to bring your idea to life. If accepted, you will be mentored and funded for 10 weeks, before meeting in San Francisco and pitching it to real investors." },
  { question: "What do we do?", answer: "these weekly meetings would be regarding strategy, how to get your first customer, and overall just helping you out wherever it makes sense." },
  {
    question: "Am I too early?",
    answer: (
      <p>
        probably not. the project you apply with doesn&apos;t have to be your startup. if you&apos;re brand new to hack
        club with a wild idea, you can apply for financial aid instead of with a project.
      </p>
    ),
  },
  {
    question: "Why does it cost 2 hours?",
    answer: (
      <p>
        we want to keep this model sustainable and allow for people to iterate quickly.
        we don&apos;t take money. we take time. you pick a project with at least 2 hours logged on hackatime, and we
        take 2 hours of it as the application fee. the rest of that project&apos;s hours are still yours to ship to
        another program.
      </p>
    ),
  },
  { question: "What happens in San Francisco?", answer: "you will stay for 3 days pitching and networking to real investors, touring companies, etc" },
  {
    question: "What is financial aid?",
    answer: (
      <p>
        aid is for people entirely new to hack club with a crazy idea, not for anyone who&apos;d rather not pay. you
        skip the project and the 2 hour fee, and just send the one minute video every applicant records.
        you can only ask for aid once.
      </p>
    ),
  },
];
