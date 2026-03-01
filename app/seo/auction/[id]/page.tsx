import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import styles from "./listing.module.css";

interface ListingData {
  id: string;
  cardName: string;
  description: string;
  category: string;
  rarity?: string;
  condition?: string;
  imageUrl?: string;
  currentBid: number;
  startingBid: number;
  bidIncrement: number;
  endTime?: Date;
  seller?: string;
  bids?: number;
  views?: number;
  createdAt?: Date;
}

/**
 * Generate static params for SEO pages
 * Note: In static export mode, we generate params for top auctions
 * For more dynamic builds, migrate to ISR mode
 */
export async function generateStaticParams() {
  try {
    // Try to fetch from Firebase if available
    const auctionsRef = collection(db, "auctions");
    const snapshot = await getDocs(query(auctionsRef, where("status", "==", "active")));
    
    if (snapshot.docs.length > 0) {
      return snapshot.docs.slice(0, 50).map((doc) => ({
        id: doc.id,
      }));
    }
    
    // Fallback: return empty array (pages will be generated on-demand during preview)
    return [];
  } catch (error) {
    console.error("Error generating static params:", error);
    // Return empty array to allow build to proceed
    // In production, set up ISR or regeneration strategy
    return [];
  }
}

/**
 * Load listing data server-side
 */
async function loadListing(id: string): Promise<ListingData | null> {
  try {
    const docSnap = await getDoc(doc(db, "auctions", id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        cardName: data.cardName || "",
        description: data.description || "",
        category: data.category || "",
        rarity: data.rarity,
        condition: data.condition,
        imageUrl: data.imageUrl,
        currentBid: data.currentBid || 0,
        startingBid: data.startingBid || 0,
        bidIncrement: data.bidIncrement || 1,
        endTime: data.endTime?.toDate?.(),
        seller: data.createdBy,
        bids: data.bidCount || 0,
        views: data.viewCount || 0,
        createdAt: data.createdAt?.toDate?.(),
      };
    }
    return null;
  } catch (error) {
    console.error("Error loading listing:", error);
    return null;
  }
}

/**
 * Public SEO-friendly auction listing page
 * Optimized for search engine indexing
 */
export default async function AuctionListingPage({
  params,
}: {
  params: { id: string };
}) {
  const listing = await loadListing(params.id);

  if (!listing) {
    return <div className={styles.container}>Listing not found</div>;
  }

  // Calculate time remaining
  const timeRemaining = listing.endTime
    ? Math.max(0, listing.endTime.getTime() - new Date().getTime())
    : 0;
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AggregateOffer",
    name: listing.cardName,
    description: listing.description,
    image: listing.imageUrl,
    category: listing.category,
    priceCurrency: "USD",
    priceSorted: listing.currentBid,
    availability: hoursRemaining > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: listing.currentBid.toString(),
      priceValidUntil: listing.endTime?.toISOString(),
      availability: hoursRemaining > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `https://stacktrackpro.web.app/auction/${listing.id}`,
    },
  };

  return (
    <>
      <Head>
        <title>{listing.cardName} - Auction | StackTrackPro</title>
        <meta
          name="description"
          content={`${listing.cardName} - Current bid: $${listing.currentBid.toFixed(2)}. Category: ${listing.category}. ${hoursRemaining} hours remaining.`}
        />

        {/* Open Graph Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://stacktrackpro.web.app/auction/${listing.id}`} />
        <meta property="og:title" content={listing.cardName} />
        <meta
          property="og:description"
          content={`Bid now: $${listing.currentBid.toFixed(2)} | ${listing.category}`}
        />
        {listing.imageUrl && <meta property="og:image" content={listing.imageUrl} />}

        {/* Twitter Card Tags */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={`https://stacktrackpro.web.app/auction/${listing.id}`} />
        <meta property="twitter:title" content={listing.cardName} />
        <meta property="twitter:description" content={`Current bid: $${listing.currentBid.toFixed(2)}`} />
        {listing.imageUrl && <meta property="twitter:image" content={listing.imageUrl} />}

        {/* Structured Data */}
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

        {/* Canonical URL */}
        <link rel="canonical" href={`https://stacktrackpro.web.app/auction/${listing.id}`} />
      </Head>

      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/auction">Auctions</Link>
          <span>/</span>
          <span>{listing.category}</span>
        </div>

        <div className={styles.mainContent}>
          {/* Image Section */}
          <div className={styles.imageSection}>
            {listing.imageUrl ? (
              <Image
                src={listing.imageUrl}
                alt={listing.cardName}
                width={500}
                height={600}
                priority
                className={styles.mainImage}
              />
            ) : (
              <div className={styles.imagePlaceholder}>No image available</div>
            )}

            {/* Quick Stats */}
            <div className={styles.quickStats}>
              <div className={styles.stat}>
                <div className={styles.label}>Views</div>
                <div className={styles.value}>{listing.views || 0}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.label}>Bids</div>
                <div className={styles.value}>{listing.bids || 0}</div>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className={styles.detailsSection}>
            {/* Title & Category */}
            <h1 className={styles.title}>{listing.cardName}</h1>
            <div className={styles.category}>{listing.category}</div>

            {/* Condition & Rarity */}
            {(listing.condition || listing.rarity) && (
              <div className={styles.badges}>
                {listing.condition && (
                  <span className={styles.badge}>
                    <strong>Condition:</strong> {listing.condition}
                  </span>
                )}
                {listing.rarity && (
                  <span className={styles.badge}>
                    <strong>Rarity:</strong> {listing.rarity}
                  </span>
                )}
              </div>
            )}

            {/* Pricing Section */}
            <div className={styles.pricingSection}>
              <div className={styles.currentBid}>
                <label>Current Bid</label>
                <div className={styles.price}>${listing.currentBid.toFixed(2)}</div>
              </div>

              <div className={styles.bidInfo}>
                <div className={styles.infoRow}>
                  <span>Starting Bid:</span>
                  <strong>${listing.startingBid.toFixed(2)}</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Bid Increment:</span>
                  <strong>${listing.bidIncrement.toFixed(2)}</strong>
                </div>
              </div>

              {/* Time Remaining */}
              {listing.endTime && (
                <div className={styles.timeRemaining}>
                  <label>Time Remaining</label>
                  <div
                    className={`${styles.time} ${hoursRemaining < 1 ? styles.urgency : ""}`}
                  >
                    {hoursRemaining > 0
                      ? `${hoursRemaining} hours ${Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))} minutes`
                      : "Auction Ended"}
                  </div>
                </div>
              )}

              {/* CTA Button */}
              <Link href={`/auction/${listing.id}`} className={styles.bidButton}>
                Place Bid Now
              </Link>
            </div>

            {/* Description */}
            {listing.description && (
              <div className={styles.descriptionSection}>
                <h2>Description</h2>
                <p className={styles.description}>{listing.description}</p>
              </div>
            )}

            {/* Additional Details */}
            <div className={styles.additionalDetails}>
              <h3>Auction Details</h3>
              <table className={styles.detailsTable}>
                <tbody>
                  <tr>
                    <td>Status</td>
                    <td>{hoursRemaining > 0 ? "Active" : "Ended"}</td>
                  </tr>
                  {listing.createdAt && (
                    <tr>
                      <td>Listed</td>
                      <td>{listing.createdAt.toLocaleDateString()}</td>
                    </tr>
                  )}
                  {listing.bids !== undefined && (
                    <tr>
                      <td>Number of Bids</td>
                      <td>{listing.bids}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
