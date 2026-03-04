import Image from "next/image";
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
  const imageUrl = card.imageUrl || card.photoUrl || card.frontImageUrl || card.thumbnailUrl || "/placeholder-card.svg";

  // Debug: Log image URL to verify it's being passed correctly
  if (typeof window !== 'undefined') {
    console.log(`[CardItem] Card: ${cardName}, ImageURL:`, imageUrl);
  }

  return (
    <div 
      className={`${styles.cardItem} ${className || ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.imageWrapper}>
        <Image
          src={imageUrl}
          alt={cardName}
          width={300}
          height={420}
          sizes="(max-width: 768px) 100vw, 400px"
          className={styles.cardImage}
          unoptimized
        />
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
