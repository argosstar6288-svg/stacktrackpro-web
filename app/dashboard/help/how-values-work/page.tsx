import Link from "next/link";
import styles from "./how-values-work.module.css";

const valuationSteps = [
  {
    title: "1. StackTrack identifies the card first",
    body:
      "When you scan a card, StackTrack tries a fast local pipeline first. It preprocesses the image, runs OCR, and attempts to match the card by lookup key, card number, and card name. If that does not produce a reliable match, it falls back to AI vision to read the card and extract the details.",
  },
  {
    title: "2. The card details are normalized",
    body:
      "After identification, StackTrack standardizes the card profile using fields like player, card name, year, brand, set name, card number, sport, condition, and grading details. That normalized profile is what the pricing system uses to avoid comparing the wrong cards.",
  },
  {
    title: "3. StackTrack checks for a strong known match",
    body:
      "If the scan maps cleanly to a card in the catalog, StackTrack can use the catalog record's average price as the first valuation anchor. Exact lookup and card-number matches carry the most confidence, while name-based matches are treated more cautiously.",
  },
  {
    title: "4. Cached market pricing is reused when it is still fresh",
    body:
      "StackTrack stores pricing in a card cache so the app does not hit pricing services on every page load. If cached pricing is still fresh, the app uses that value immediately. Pricing is treated as stale once it is about 30 days old.",
  },
  {
    title: "5. If pricing is stale or missing, StackTrack refreshes it",
    body:
      "When a refresh is needed, StackTrack builds a search query from the player, year, brand, and card name, then looks up current market data. The current automated refresh path uses PriceCharting data and stores the result back in cache for the next request.",
  },
  {
    title: "6. Condition and grade change the suggested number",
    body:
      "StackTrack does not use one flat value for every copy of a card. If the card is marked Mint and a higher 'new' value exists, that can be used. Poor and Fair cards lean toward lower loose pricing. If a more complete market price is available, StackTrack prefers that over a rough loose value. Graded cards also carry their grading company and grade in the card profile so they can be priced differently from raw cards.",
  },
];

const valueDrivers = [
  "Match confidence. Exact catalog matches are more reliable than fuzzy matches.",
  "Condition and grading. A PSA 10 and a raw Good copy should not land on the same number.",
  "Card identity details. Year, brand, set, and card number matter because similar-looking cards can have very different markets.",
  "Freshness of market data. Recently refreshed pricing is stronger than older cached pricing.",
  "Available market source. Some cards have stronger catalog pricing, while others depend on the latest external pricing lookup.",
];

const faqItems = [
  {
    question: "Why can a card's value change over time?",
    answer:
      "Values change when the market changes, when StackTrack refreshes stale pricing, or when better card details are available after a stronger match or better scan.",
  },
  {
    question: "Why does my scan sometimes show an estimate instead of an exact market value?",
    answer:
      "If StackTrack has identification details but does not yet have a stronger market result, it can temporarily use a scan-derived estimate until a better pricing source is available.",
  },
  {
    question: "Is StackTrack giving a formal appraisal?",
    answer:
      "No. StackTrack provides a market-based estimate designed for tracking, comparison, and collection management. Final sale price can still vary based on buyer demand, venue, timing, eye appeal, and grading accuracy.",
  },
];

export default function HowValuesWorkPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Card Values</p>
          <h1 className={styles.title}>How StackTrack comes up with card values</h1>
          <p className={styles.lead}>
            StackTrack does not guess from a single photo alone. The app first identifies the card,
            normalizes the details, checks known catalog data, reuses fresh cached pricing when it can,
            and refreshes market pricing when it needs a better number.
          </p>
        </div>

        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>In short</p>
          <ul className={styles.heroList}>
            <li>Identify the exact card</li>
            <li>Match it to known catalog data</li>
            <li>Use fresh cached market pricing when available</li>
            <li>Refresh pricing when the cache is stale</li>
            <li>Adjust the suggestion using condition and grade</li>
          </ul>
        </div>
      </section>

      <section className={styles.layout}>
        <div className={styles.main}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>Pipeline</p>
              <h2 className={styles.sectionTitle}>The valuation flow</h2>
            </div>

            <div className={styles.stepList}>
              {valuationSteps.map((step) => (
                <article key={step.title} className={styles.stepCard}>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepBody}>{step.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>What Matters</p>
              <h2 className={styles.sectionTitle}>What moves the number up or down</h2>
            </div>

            <div className={styles.driverGrid}>
              {valueDrivers.map((item) => (
                <div key={item} className={styles.driverCard}>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>Important Note</p>
              <h2 className={styles.sectionTitle}>What the value means</h2>
            </div>

            <div className={styles.noteBox}>
              <p>
                StackTrack values are market estimates built for collection tracking and decision support.
                They are useful for organizing your collection, spotting price movement, and comparing cards,
                but they are not a guaranteed sale price.
              </p>
            </div>
          </section>
        </div>

        <aside className={styles.side}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>Quick Answers</p>
              <h2 className={styles.sectionTitle}>FAQ</h2>
            </div>

            <div className={styles.faqList}>
              {faqItems.map((item) => (
                <article key={item.question} className={styles.faqCard}>
                  <h3 className={styles.faqQuestion}>{item.question}</h3>
                  <p className={styles.faqAnswer}>{item.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>Next Step</p>
              <h2 className={styles.sectionTitle}>Use it in the app</h2>
            </div>

            <div className={styles.linkStack}>
              <Link href="/dashboard/scan" className={styles.actionLink}>
                Scan a card
              </Link>
              <Link href="/dashboard/collection" className={styles.actionLink}>
                View your collection values
              </Link>
              <Link href="/dashboard/help" className={styles.actionLinkAlt}>
                Back to Help & FAQ
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}