"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "../../../../lib/useCurrentUser";
import Link from "next/link";
import Image from "next/image";
import styles from "./listing.module.css";

interface Listing {
  id: string;
  userId: string;
  userName: string;
  cardName: string;
  player?: string;
  year?: string;
  brand?: string;
  sport?: string;
  condition?: string;
  listingType: 'sale' | 'trade' | 'both';
  price?: number;
  tradeFor?: string;
  description?: string;
  imageUrl?: string;
  status: 'active' | 'sold' | 'traded';
  views: number;
  createdAt: any;
}

export default function ListingDetailPage() {
  const params = useParams();
  const listingId = params?.id as string;
  const router = useRouter();
  const { user } = useCurrentUser();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      if (!listingId) return;
      
      try {
        const listingRef = doc(db, "marketplace", listingId);
        const listingSnap = await getDoc(listingRef);
        
        if (listingSnap.exists()) {
          const data = { id: listingSnap.id, ...listingSnap.data() } as Listing;
          setListing(data);
          
          // Increment view count
          if (user && user.uid !== data.userId) {
            await updateDoc(listingRef, {
              views: increment(1)
            });
          }
        } else {
          router.push("/dashboard/marketplace");
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

  if (loading) {
    return <div className={styles.loading}>Loading listing...</div>;
  }

  if (!listing) {
    return <div className={styles.loading}>Listing not found</div>;
  }

  const isOwner = user && user.uid === listing.userId;
  const forSale = listing.listingType === 'sale' || listing.listingType === 'both';
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
          <div className={styles.imageContainer}>
            {listing.imageUrl ? (
              <Image src={listing.imageUrl} alt={listing.cardName} width={300} height={420} className={styles.cardImage} unoptimized />
            ) : (
              <div className={styles.placeholderImage}>
                <span>📷</span>
                <p>No image</p>
              </div>
            )}
          </div>
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
            </div>
            <h1 className={styles.cardName}>{listing.cardName}</h1>
            
            {listing.player && (
              <p className={styles.player}>{listing.player}</p>
            )}

            <div className={styles.cardDetails}>
              {listing.year && <span>Year: {listing.year}</span>}
              {listing.brand && <span>Brand: {listing.brand}</span>}
              {listing.sport && <span>Sport: {listing.sport}</span>}
              {listing.condition && <span>Condition: {listing.condition}</span>}
            </div>
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

          {listing.description && (
            <div className={styles.descriptionSection}>
              <h3>Description</h3>
              <p className={styles.description}>{listing.description}</p>
            </div>
          )}

          <div className={styles.sellerSection}>
            <h3>Seller Information</h3>
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
                <button className={styles.deleteButton}>Remove Listing</button>
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
