import { useEffect, useMemo, useState } from "react";
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
    price?: number;
    player?: string;
    sport?: string;
    brand?: string;
  };
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function CardItem({ card, badge, onClick, className }: CardItemProps) {
  const cardName = card.name || card.cardName || "Untitled Card";
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

    const candidates = [
      card.imageUrl,
      card.photoUrl,
      card.frontImageUrl,
      card.thumbnailUrl,
      card.cardImage,
      card.image,
      card.imagePath,
    ];

    const selectedUrl = candidates.find((candidate) => isRenderableImageUrl(candidate)) || "/placeholder-card.svg";
    
    // Debug logging
    console.log(`[CardItem] ${cardName}:`, {
      candidates: candidates.filter(c => c),
      selected: selectedUrl,
      allFields: {
        imageUrl: card.imageUrl,
        photoUrl: card.photoUrl,
        frontImageUrl: card.frontImageUrl,
        thumbnailUrl: card.thumbnailUrl,
        cardImage: card.cardImage,
        image: card.image,
        imagePath: card.imagePath,
      }
    });

    return selectedUrl;
  }, [card.cardImage, card.frontImageUrl, card.image, card.imagePath, card.imageUrl, card.photoUrl, card.thumbnailUrl]);

  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);

  useEffect(() => {
    setCurrentImageUrl(imageUrl);
  }, [imageUrl]);

  const handleImageError = () => {
    console.log(`[CardItem] Image failed to load: ${currentImageUrl} (card: ${cardName})`);
    if (currentImageUrl !== "/placeholder-card.svg") {
      setCurrentImageUrl("/placeholder-card.svg");
    }
  };

  const handleImageLoad = () => {
    console.log(`[CardItem] Image loaded successfully: ${currentImageUrl} (card: ${cardName})`);
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
          src={currentImageUrl}
          alt={cardName}
          className={styles.cardImage}
          onError={handleImageError}
          onLoad={handleImageLoad}
          loading="lazy"
          decoding="async"
        />
        {/* Hover preview - larger image display */}
        <div className={styles.hoverPreview}>
          <img
            src={currentImageUrl}
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

        {(card.value || card.price) && (
          <p className={styles.price}>
            ${(card.value || card.price)?.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
