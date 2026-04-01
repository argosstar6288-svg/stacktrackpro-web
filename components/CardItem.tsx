import { useEffect, useMemo, useState } from "react";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/lib/currency";
import styles from "./CardItem.module.css";

interface CardItemProps {
  card: {
    id?: string;
    name?: string;
    cardName?: string;
    imageUrl?: string;
    photoUrl?: string;
    frontImageUrl?: string;
    thumbnailUrl?: string;
    cardImage?: string;
    image?: string;
    imagePath?: string;
    year?: number | string;
    condition?: string;
    value?: number;
    marketPrice?: number;
    price?: number;
    player?: string;
    sport?: string;
    brand?: string;
  };
  badge?: React.ReactNode;
  showPrice?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function CardItem({ card, badge, showPrice = true, onClick, className }: CardItemProps) {
  const { currency } = useCurrency();
  const cardName = card.name || card.cardName || "Untitled Card";
  const placeholderImageUrl = "/placeholder-card.svg";
  const imageUrl = useMemo(() => {
    const isRenderableImageUrl = (value?: string) => {
      if (!value || typeof value !== "string") return false;
      const trimmed = value.trim();
      return (
        trimmed.startsWith("https://") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("data:image/") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("/")
      );
    };

    // Prioritize high-quality image URLs first (TCG large images, then smaller variants)
    const candidates = [
      card.image,           // TCG image URL (often highest quality)
      card.imageUrl,        // Primary uploaded image
      card.frontImageUrl,   // Front-facing scans
      card.photoUrl,        // Photo uploads
      card.cardImage,       // Alternative image field
      card.thumbnailUrl,    // Thumbnails (lower priority)
      card.imagePath,       // Storage paths
    ];

    const selectedUrl = candidates.find((candidate) => isRenderableImageUrl(candidate)) || placeholderImageUrl;
    return selectedUrl;
  }, [card.image, card.imageUrl, card.frontImageUrl, card.photoUrl, card.cardImage, card.thumbnailUrl, card.imagePath]);

  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);

  useEffect(() => {
    setCurrentImageUrl(imageUrl);
  }, [imageUrl]);

  const handleImageError = () => {
    if (currentImageUrl !== placeholderImageUrl) {
      setCurrentImageUrl(placeholderImageUrl);
    }
  };

  const handleImageLoad = () => {
    // Image loaded successfully
  };

  return (
    <div 
      className={`${styles.cardItem} ${className || ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.imageWrapper}>
        <img
          src={currentImageUrl || placeholderImageUrl}
          alt={cardName}
          className={`${styles.cardImage} w-full rounded`}
          onError={handleImageError}
          onLoad={handleImageLoad}
          loading="lazy"
          decoding="async"
        />
        {/* Hover preview - larger image display */}
        <div className={styles.hoverPreview}>
          <img
            src={currentImageUrl || placeholderImageUrl}
            alt={cardName}
            className={styles.previewImage}
            onError={handleImageError}
            onLoad={handleImageLoad}
            loading="lazy"
            decoding="async"
          />
        </div>
        {badge && <div className={styles.badge}>{badge}</div>}
      </div>

      <div className={styles.cardInfo}>
        <h3 className={styles.cardName}>{cardName}</h3>
        
        {(card.player || card.year || card.sport) && (
          <div className={styles.cardMeta}>
            {card.player && <span>{card.player}</span>}
            {card.player && (card.year || card.sport) && <span>•</span>}
            {card.year && <span>{card.year}</span>}
            {card.year && card.sport && <span>•</span>}
            {card.sport && <span>{card.sport}</span>}
          </div>
        )}

        {card.condition && (
          <p className={styles.condition}>{card.condition}</p>
        )}

        {showPrice && (card.marketPrice || card.value || card.price) && (
          <p className={styles.price}>
            {formatCurrency(Number(card.marketPrice || card.value || card.price || 0), currency)}
          </p>
        )}
      </div>
    </div>
  );
}
