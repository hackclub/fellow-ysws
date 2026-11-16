// Public docs copy (/docs). Written for someone who has never heard of Hack Club or Hackatime.
// Keep each section short: a few bullets or cards, no walls of text. Edit freely.
import type { ReactNode } from "react";

export type DocSection = {
  /** Anchor id, used in the sidebar and in links like /docs#hackatime. */
  id: string;
  /** Short label for the sidebar. */
  label: string;
  title: string;
  body: ReactNode;
};

const HACKATIME_URL = "https://hackatime.hackclub.com";
const HACK_CLUB_URL = "https://hackclub.com/?utm_source=fellows";
const EXAMPLE_VIDEOS_URL = "https://www.youtube.com/watch?v=RJsPYnx4av4&list=PLK7HoSSSROuL9e1bdG_oGEo-jSPuOjw6X";

const ext = (href: string, label: string) => (
  <a href={href} className="doc-link" target="_blank" rel="noopener noreferrer">
    {label}
  </a>
);

export const docSections: DocSection[] = [
  {
    id: "start-here",
    label: "Start here",
    title: "Start here",
    body: (
      <ul className="bullets">
        <li>Fellows Fund™ is a 10 week program for teenagers with an idea worth building.</li>
        <li>get in, and you&apos;re mentored and funded for 10 weeks.</li>
        <li>it ends with a fully funded trip to San Francisco to pitch real investors.</li>
        <li>applying costs no money. you pay with time you&apos;ve already spent coding.</li>
      </ul>
    ),
  },
  {
    id: "hack-club",
    label: "What's Hack Club?",
    title: "What's Hack Club?",
    body: (
      <>
        <ul className="bullets">
          <li>{ext(HACK_CLUB_URL, "Hack Club")} is a nonprofit for teenagers who make things with code.</li>
          <li>it runs programs like this one: you build something, and Hack Club backs you.</li>
          <li>you sign in to Fellows Fund™ with a free Hack Club account.</li>
        </ul>
      </>
    ),
  },
  {
    id: "the-program",
    label: "The 10 weeks",
    title: "The 10 weeks",
    body: (
      <div className="doc-cards">
        <div className="panel card">
          <span className="card-eyebrow">Weeks 1–9</span>
          <span className="card-title">Online, with your cohort</span>
          <ul className="bullets small">
            <li>mentorship and funding.</li>
            <li>weekly meetings on strategy and landing your first customer.</li>
            <li>help wherever you&apos;re stuck.</li>
          </ul>
        </div>
        <div className="panel card">
          <span className="card-eyebrow">Week 10</span>
          <span className="card-title">San Francisco, IRL</span>
          <ul className="bullets small">
            <li>a fully funded trip.</li>
            <li>pitch what you built to real investors.</li>
            <li>network and tour companies.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "ways-to-apply",
    label: "Two ways to apply",
    title: "Two ways to apply",
    body: (
      <div className="doc-cards">
        <div className="panel card">
          <span className="card-eyebrow">Most people</span>
          <span className="card-title">With a project</span>
          <ul className="bullets small">
            <li>a project with 2+ hours on <a href="#hackatime" className="doc-link">Hackatime</a>.</li>
            <li>its code on GitHub, plus a link we can try.</li>
            <li>a <a href="#the-video" className="doc-link">1 minute video</a>.</li>
            <li>costs <a href="#the-fee" className="doc-link">2 hours per person</a> on your team, from that project.</li>
          </ul>
        </div>
        <div className="panel card">
          <span className="card-eyebrow">Brand new to Hack Club</span>
          <span className="card-title">With financial aid</span>
          <ul className="bullets small">
            <li>no project, no fee.</li>
            <li>just the 1 minute video and why you&apos;re asking.</li>
            <li>for people entirely new to Hack Club with a big idea.</li>
            <li>you can only ask once.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "why-a-project",
    label: "Why a project?",
    title: "Why a project?",
    body: (
      <ul className="bullets">
        <li>
          <span className="doc-lead">it shows you can ship.</span> we back builders, and something you&apos;ve made is the best proof.
        </li>
        <li>
          <span className="doc-lead">it doesn&apos;t have to be your startup.</span> a game, a tool, a website: anything you&apos;ve built counts.
        </li>
        <li>
          <span className="doc-lead">we look at the real thing.</span> your code on GitHub, and a live link we can actually use.
        </li>
        <li>
          <span className="doc-lead">time, not money.</span> charging hours instead of dollars keeps the program sustainable. we&apos;ve realized that people that instead of having people write an essay on why they are deserving, we can filter out low quality applications by making people have to actually build something in order to apply
        </li>
      </ul>
    ),
  },
  {
    id: "hackatime",
    label: "What's Hackatime?",
    title: "What's Hackatime?",
    body: (
      <>
        <ul className="bullets">
          <li>Hackatime is Hack Club&apos;s free tracker for time spent coding.</li>
          <li>it lives in your code editor and counts time while you code, per project.</li>
          <li>no timer to start or stop. it runs in the background.</li>
        </ul>
        <ol className="doc-steps">
          <li>
            <span>sign up at {ext(HACKATIME_URL, "hackatime.hackclub.com")}.</span>
          </li>
          <li>
            <span>follow its setup to add it to your editor.</span>
          </li>
          <li>
            <span>code like normal. your hours show up on your dashboard.</span>
          </li>
          <li>
            <span>when you apply, connect Hackatime so we can see your projects.</span>
          </li>
        </ol>
        <p className="notice small">
          hours only count from when it&apos;s installed. haven&apos;t tracked anything yet? that&apos;s what{" "}
          <a href="#ways-to-apply" className="doc-link">financial aid</a> is for.
        </p>
      </>
    ),
  },
  {
    id: "the-fee",
    label: "The fee: 2 hours per person",
    title: "The fee: 2 hours per person",
    body: (
      <>
        <ul className="bullets">
          <li>the fee is 2 hours for each person on your team, you included. solo is 2 hours; a full team of 4 is 8.</li>
          <li>only you, the person submitting, pay. it all comes out of the one project you pick, so it needs at least that much logged.</li>
          <li>partners don&apos;t pay hours.</li>
          <li>those hours are used up, so they can&apos;t count again somewhere else. you can&apos;t submit them to another program.</li>
          <li>the rest of the project&apos;s time is still yours to use in other Hack Club programs.</li>
        </ul>
        <div className="panel doc-example" aria-label="Example">
          <span className="card-eyebrow">Example: solo</span>
          <div className="doc-math">
            <span>7 hours logged</span>
            <span aria-hidden="true">→</span>
            <span>2 to Fellows Fund™</span>
            <span aria-hidden="true">→</span>
            <span>5 still yours</span>
          </div>
          <span className="card-eyebrow">Example: team of 3</span>
          <div className="doc-math">
            <span>7 hours logged</span>
            <span aria-hidden="true">→</span>
            <span>6 to Fellows Fund™</span>
            <span aria-hidden="true">→</span>
            <span>1 still yours</span>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "the-video",
    label: "The 1 minute video",
    title: "The 1 minute video",
    body: (
      <>
        <ul className="bullets">
          <li>everyone records one, on both paths.</li>
          <li>about a minute: who&apos;s on the team, and what your startup is about.</li>
          <li>keep it high level. no slides needed.</li>
          <li>upload it to YouTube as <em>unlisted</em>. private videos can&apos;t be watched.</li>
        </ul>
        <p className="small">need ideas? {ext(EXAMPLE_VIDEOS_URL, "watch some example videos")}.</p>
      </>
    ),
  },
  {
    id: "teams",
    label: "Applying as a team",
    title: "Applying as a team",
    body: (
      <ul className="bullets">
        <li>teams can have up to 4 people: you and 3 partners.</li>
        <li>you fill out the application and share an invite link.</li>
        <li>partners join by signing in with Hack Club through the link.</li>
        <li>each person adds 2 hours to the <a href="#the-fee" className="doc-link">fee</a>. partners don&apos;t pay hours; only you do, from your project.</li>
        <li>the team locks when you submit.</li>
        <li>applying solo? skip all of this.</li>
      </ul>
    ),
  },
  {
    id: "after-you-apply",
    label: "After you apply",
    title: "After you apply",
    body: (
      <>
        <p className="small muted">your status shows on your submissions page. here&apos;s what each one means.</p>
        <dl className="doc-statuses">
          <dt>Under review</dt>
          <dd>we&apos;re looking at it.</dd>
          <dt>Accepted</dt>
          <dd>you&apos;re in. your acceptance letter is waiting on your submissions page.</dd>
          <dt>Needs changes</dt>
          <dd>something was missing or broken. read our note, fix it, and submit again.</dd>
          <dt>Not accepted</dt>
          <dd>not this time. you can apply again with a new application.</dd>
        </dl>
        <p className="notice small">faking hours gets you banned from Fellows Fund™.</p>
      </>
    ),
  },
];
