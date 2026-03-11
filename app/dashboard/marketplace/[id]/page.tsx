"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, updateDoc, increment, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FLAT_COLLECTIONS } from "@/lib/flatCollections";
import { useCurrentUser } from "../../../../lib/useCurrentUser";
import Link from "next/link";
import Image from "next/image";
import styles from "./listing.module.css";

interface CardDetails {
  cardId: string;
  cardName: string;
  cardNumber?: string;
  player?: string;
  year?: number;
  brand?: string;
  sport?: string;
  condition?: string;
  imageUrl?: string;
  value?: number;
}

interface Listing {
  id: string;
  userId: string;
  userName: string;
  cardName: string;
  cardNumber?: string;
  player?: string;
  year?: string;
  brand?: string;
  sport?: string;
  condition?: string;
  listingType: 'sale' | 'sell' | 'trade' | 'both';
  price?: number;
  tradeFor?: string;
  description?: string;
  imageUrl?: string;
  status: 'active' | 'sold' | 'traded';
  views: number;
  createdAt: any;
  cards?: CardDetails[];
  cardCount?: number;
}

const normalizeListing = (id: string, data: any): Listing => ({
  id,
  userId: data.userId || data.userID || data.sellerID || "",
  userName: data.userName || data.sellerName || "Unknown Seller",
  cardName: data.cardName || data.name || data.cardID || "Card",
  cardNumber: data.cardNumber || data.number || "",
  player: data.player || "",
  year: data.year,
  brand: data.brand || data.set || "",
  sport: data.sport || "",
  condition: data.condition || "",
  listingType: data.listingType === "sell" ? "sell" : data.listingType === "trade" ? "trade" : data.listingType === "both" ? "both" : "sale",
  price: Number(data.price || 0),
  tradeFor: data.tradeFor || "",
  description: data.description || "",
  imageUrl: data.imageUrl || data.image || "",
  status: data.status || "active",
  views: Number(data.views || 0),
  createdAt: data.createdAt || data.created || data.timestamp,
  cards: Array.isArray(data.cards)
    ? data.cards.map((card: any) => ({
        cardId: card.cardId || card.cardID || "",
        cardName: card.cardName || card.name || card.cardID || "Card",
        cardNumber: card.cardNumber || card.number || "",
        player: card.player || "",
        year: card.year,
        brand: card.brand,
        sport: card.sport,
        condition: card.condition,
        imageUrl: card.imageUrl || card.image,
        value: Number(card.value || 0),
      }))
    : [],
  cardCount: Number(data.cardCount || 0),
});

export default function ListingDetailPage() {
  const params = useParams();
  const listingId = params?.id as string;
  const router = useRouter();
  const { user } = useCurrentUser();
  const [listing, setListing] = useState<Listing | null>(null);
  const [listingSource, setListingSource] = useState<"flat" | "legacy">("flat");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      if (!listingId) return;

      try {
        const flatRef = doc(db, FLAT_COLLECTIONS.marketListings, listingId);
        const legacyRef = doc(db, "marketplace", listingId);

        const [flatSnap, legacySnap] = await Promise.all([getDoc(flatRef), getDoc(legacyRef)]);

        let resolvedListing: Listing | null = null;
        let source: "flat" | "legacy" = "flat";

        if (flatSnap.exists()) {
          resolvedListing = normalizeListing(flatSnap.id, flatSnap.data());
          source = "flat";
        } else if (legacySnap.exists()) {
          resolvedListing = normalizeListing(legacySnap.id, legacySnap.data());
          source = "legacy";
        }

        if (!resolvedListing) {
          router.push("/dashboard/marketplace");
          return;
        }

        setListing(resolvedListing);
        setListingSource(source);

        // Increment view count
        if (user && user.uid !== resolvedListing.userId) {
          await updateDoc(source === "flat" ? flatRef : legacyRef, {
            views: increment(1),
          });
        }
      } catch (error) {
        console.error("Error fetching listing:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [listingId, user, router]);

  const handleContactSeller = () => {
    if (!listing) return;
    router.push(`/dashboard/inbox?user=${listing.userId}`);
  };

  const handleBuyNow = () => {
    if (!listing) return;
    // In the future, this would integrate with a payment system
    alert("Buy now functionality coming soon! For now, please contact the seller.");
    handleContactSeller();
  };

  const handleMakeOffer = () => {
    if (!listing) return;
    alert("Make offer functionality coming soon! For now, please contact the seller.");
    handleContactSeller();
  };

  const handleProposeTrade = () => {
    if (!listing) return;
    alert("Propose trade functionality coming soon! For now, please contact the seller.");
    handleContactSeller();
  };

  const handleDeleteListing = async () => {
    if (!listing) return;
    
    const confirmed = window.confirm(
      "Are you sure you want to delete this listing? This action cannot be undone."
    );
    
    if (!confirmed) return;
    
    try {
      const targetRef =
        listingSource === "flat"
          ? doc(db, FLAT_COLLECTIONS.marketListings, listingId)
          : doc(db, "marketplace", listingId);
      await deleteDoc(targetRef);
      alert("Listing deleted successfully!");
      router.push("/dashboard/marketplace");
    } catch (error) {
      console.error("Error deleting listing:", error);
      alert("Failed to delete listing. Please try again.");
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading listing...</div>;
  }

  if (!listing) {
    return <div className={styles.loading}>Listing not found</div>;
  }

  const isOwner = user && user.uid === listing.userId;
  const forSale = listing.listingType === 'sale' || listing.listingType === 'sell' || listing.listingType === 'both';
  const forTrade = listing.listingType === 'trade' || listing.listingType === 'both';

  return (
    <div className={styles.page}>
      <div className={styles.backNav}>
        <Link href="/dashboard/marketplace" className={styles.backLink}>
          ← Back to Marketplace
        </Link>
      </div>

      <div className={styles.content}>
        <div className={styles.imageSection}>
          {listing.cards && listing.cards.length > 0 ? (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: listing.cards.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                {listing.cards.map((card, index) => (
                  <div key={card.cardId || index} className={styles.imageContainer}>
                    {card.imageUrl ? (
                      <Image 
                        src={card.imageUrl} 
                        alt={card.cardName} 
                        width={300} 
                        height={420} 
                        sizes="(max-width: 768px) 100vw, 300px" 
                        className={styles.cardImage} 
                        unoptimized 
                      />
                    ) : (
                      <div className={styles.placeholderImage}>
                        <span>📷</span>
                        <p>No image</p>
                      </div>
                    )}
                    <div style={{
                      marginTop: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      textAlign: 'center'
                    }}>
                      {card.cardName}
                    </div>
                    {(card.cardNumber || card.cardId) && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'rgba(255,255,255,0.7)',
                        textAlign: 'center',
                        marginTop: '0.25rem'
                      }}>
                        {card.cardNumber ? `Card #${card.cardNumber}` : `Card ID: ${card.cardId}`}
                      </div>
                    )}
                    {card.value && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'rgba(255,255,255,0.6)',
                        textAlign: 'center'
                      }}>
                        ${card.value.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {listing.cards.length > 1 && (
                <div style={{
                  padding: '0.75rem',
                  background: 'rgba(30,144,255,0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(30,144,255,0.3)',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  <strong>{listing.cards.length} cards included in this listing</strong>
                </div>
              )}
            </>
          ) : (
            <div className={styles.imageContainer}>
              {listing.imageUrl ? (
                <Image src={listing.imageUrl} alt={listing.cardName} width={300} height={420} sizes="(max-width: 768px) 100vw, 400px" className={styles.cardImage} unoptimized />
              ) : (
                <div className={styles.placeholderImage}>
                  <span>📷</span>
                  <p>No image</p>
                </div>
              )}
            </div>
          )}
          <div className={styles.imageMeta}>
            <span className={styles.views}>👁️ {listing.views} views</span>
            {listing.status !== 'active' && (
              <span className={styles.statusBadge}>
                {listing.status === 'sold' ? '✓ Sold' : '✓ Traded'}
              </span>
            )}
          </div>
        </div>

        <div className={styles.detailsSection}>
          <div className={styles.listingHeader}>
            <div className={styles.badges}>
              {forSale && <span className={styles.badge}>💵 For Sale</span>}
              {forTrade && <span className={styles.badge}>🔄 For Trade</span>}
              {listing.cards && listing.cards.length > 1 && (
                <span className={styles.badge}>📦 {listing.cards.length} Cards</span>
              )}
            </div>
            <h1 className={styles.cardName}>
              {listing.cards && listing.cards.length > 1 
                ? `${listing.cards.length} Card Bundle` 
                : listing.cardName}
            </h1>

            {listing.description ? (
              <div className={styles.descriptionSection}>
                <h3>📝 DESCRIPTION</h3>
                <p className={styles.description}>{listing.description}</p>
              </div>
            ) : (
              <div className={styles.descriptionSection} style={{ background: 'rgba(255, 255, 255, 0.03)', borderStyle: 'dashed' }}>
                <h3>📝 DESCRIPTION</h3>
                <p className={styles.description} style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
                  No description provided by seller
                </p>
              </div>
            )}
            
            {listing.player && !(listing.cards && listing.cards.length > 1) && (
              <p className={styles.player}>{listing.player}</p>
            )}

            {listing.cards && listing.cards.length > 1 ? (
              <div className={styles.cardsList}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>
                  Included Cards:
                </h3>
                {listing.cards.map((card, index) => (
                  <div key={card.cardId || index} style={{ 
                    padding: '0.5rem',
                    borderBottom: index < listing.cards!.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'
                  }}>
                    <div style={{ fontWeight: '600' }}>{card.cardName}</div>
                    <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>
                      {card.cardNumber && <span>#{card.cardNumber} • </span>}
                      {card.player && <span>{card.player} • </span>}
                      {card.year && <span>{card.year} • </span>}
                      {card.brand && <span>{card.brand} • </span>}
                      {card.condition && <span>{card.condition}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.cardDetails}>
                {listing.cardNumber && <span>Card #: {listing.cardNumber}</span>}
                {listing.year && <span>Year: {listing.year}</span>}
                {listing.brand && <span>Brand: {listing.brand}</span>}
                {listing.sport && <span>Sport: {listing.sport}</span>}
                {listing.condition && <span>Condition: {listing.condition}</span>}
              </div>
            )}
          </div>

          {forSale && listing.price && (
            <div className={styles.priceSection}>
              <span className={styles.priceLabel}>Price</span>
              <span className={styles.price}>${listing.price.toLocaleString()}</span>
            </div>
          )}

          {forTrade && listing.tradeFor && (
            <div className={styles.tradeSection}>
              <span className={styles.tradeLabel}>Looking to trade for:</span>
              <p className={styles.tradeFor}>{listing.tradeFor}</p>
            </div>
          )}

          <div className={styles.sellerSection}>
            <h3>👤 Seller Information</h3>
            <div className={styles.sellerInfo}>
              <span className={styles.sellerName}>{listing.userName}</span>
              <span className={styles.listedDate}>
                Listed {new Date(listing.createdAt?.toDate?.() || listing.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {!isOwner && listing.status === 'active' && user && (
            <div className={styles.actions}>
              <button 
                onClick={handleContactSeller}
                className={styles.contactButton}
              >
                💬 Contact Seller
              </button>
              
              {forSale && (
                <>
                  <button 
                    onClick={handleBuyNow}
                    className={styles.buyButton}
                  >
                    Buy Now - ${listing.price?.toLocaleString()}
                  </button>
                  <button 
                    onClick={handleMakeOffer}
                    className={styles.offerButton}
                  >
                    Make Offer
                  </button>
                </>
              )}
              
              {forTrade && (
                <button 
                  onClick={handleProposeTrade}
                  className={styles.tradeButton}
                >
                  Propose Trade
                </button>
              )}
            </div>
          )}

          {isOwner && (
            <div className={styles.ownerActions}>
              <p className={styles.ownerNote}>This is your listing</p>
              <div className={styles.actions}>
                <button className={styles.editButton}>Edit Listing</button>
                <button 
                  className={styles.deleteButton}
                  onClick={handleDeleteListing}
                >
                  Remove Listing
                </button>
              </div>
            </div>
          )}

          {!user && (
            <div className={styles.authPrompt}>
              <p>Sign in to contact the seller or make a purchase</p>
              <Link href="/auth/signin" className={styles.signInButton}>
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
