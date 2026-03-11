import type { ReactNode } from "react";

interface CardGridItem {
  id: string;
  image?: string;
  imageUrl?: string;
  name: string;
  set?: string;
}

interface CardGridProps {
  cards?: CardGridItem[];
  children?: ReactNode;
  className?: string;
}

export default function CardGrid({ cards, children, className = "" }: CardGridProps) {
  if (Array.isArray(cards)) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 ${className}`.trim()}>
        {cards.map((card) => (
          <div key={card.id} className="card hover:scale-105 transition">
            <img
              src={card.image || card.imageUrl || "/placeholder-card.svg"}
              className="rounded-lg w-full object-cover"
              alt={card.name}
            />

            <h3 className="font-bold mt-2">{card.name}</h3>
            <p className="text-sm text-gray-300">{card.set || "Card details"}</p>
          </div>
        ))}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}
